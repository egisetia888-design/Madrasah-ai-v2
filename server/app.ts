import express from "express";
import path from "path";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// Process-level safety net for unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  console.warn('[Process Warning] Handled late unhandled promise rejection:', reason?.message || reason);
});

// In-memory cache for AI responses
const aiCache = new Map<string, { timestamp: number, data: any }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function getCacheKey(endpoint: string, body: any) {
  return `${endpoint}:${JSON.stringify(body)}`;
}

/**
 * Attempts to repair JSON that was prematurely cut off by LLM token limits
 * by closing unclosed strings, dangling keys, and balancing delimiters.
 */
function repairTruncatedJson(str: string): string {
  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}' || char === ']') {
        const top = stack[stack.length - 1];
        if ((char === '}' && top === '{') || (char === ']' && top === '[')) {
          stack.pop();
        }
      }
    }
  }

  let repaired = str;
  // If ended while still inside a string literal, close it
  if (inString) {
    repaired += '"';
  }

  // Remove trailing dangling keys or trailing commas: e.g. `,"key": ` or `,"key"` or `, `
  repaired = repaired.trim();
  repaired = repaired.replace(/,\s*$/, '');
  repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*$/, '');
  repaired = repaired.replace(/,\s*"[^"]*"\s*$/, '');

  // Close all remaining unclosed braces and brackets in LIFO order
  while (stack.length > 0) {
    const openChar = stack.pop();
    if (openChar === '{') repaired += '}';
    else if (openChar === '[') repaired += ']';
  }

  return repaired;
}

function cleanAndParseJson(text: string, fallback: any = {}) {
  if (!text) return fallback;
  try {
    let cleanText = text.trim();
    // Strip markdown code fences if present anywhere in text
    cleanText = cleanText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```[a-zA-Z0-9_-]*\n?/, "");
      if (cleanText.endsWith("```")) {
        cleanText = cleanText.slice(0, -3);
      }
    }
    cleanText = cleanText.trim();
    
    // Direct parse attempt
    try {
      return JSON.parse(cleanText);
    } catch (directErr) {
      // Find candidate starting with outermost brace or bracket
      const firstBrace = cleanText.indexOf('{');
      const firstBracket = cleanText.indexOf('[');
      let candidate = cleanText;
      if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        candidate = cleanText.substring(firstBrace);
      } else if (firstBracket !== -1) {
        candidate = cleanText.substring(firstBracket);
      }

      // Try repairing potentially truncated JSON
      try {
        const repaired = repairTruncatedJson(candidate);
        const sanitized = repaired
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        return JSON.parse(sanitized);
      } catch (repairErr) {
        // As secondary fallback, check substring between first and last delimiters if present
        const lastBrace = cleanText.lastIndexOf('}');
        const lastBracket = cleanText.lastIndexOf(']');
        let sliceCandidate = "";
        if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
          sliceCandidate = cleanText.substring(firstBrace, lastBrace + 1);
        } else if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
          sliceCandidate = cleanText.substring(firstBracket, lastBracket + 1);
        }

        if (sliceCandidate) {
          const sanitized = sliceCandidate
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']');
          return JSON.parse(sanitized);
        }
        throw directErr;
      }
    }
  } catch (error) {
    if (fallback !== null) {
      console.error("JSON Parsing Error on AI output:", text.substring(0, 150) + "...");
    }
    return fallback;
  }
}

// Lazy initialize GoogleGenAI client
let genAIClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'madrasah-pkos',
        }
      }
    });
  }
  return genAIClient;
}

interface AICallOptions {
  systemInstruction: string;
  userPrompt: string;
  jsonMode?: boolean;
  responseSchema?: any;
  timeoutMs?: number;
  tools?: any[];
  maxTokens?: number;
  temperature?: number;
  purpose?: string;
}

function formatAIEndpoint(rawBaseUrl?: string): string {
  let url = (rawBaseUrl || "").trim();
  if (!url) return "https://openrouter.ai/api/v1/chat/completions";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  url = url.replace(/\/+$/, "");
  if (url.endsWith("/chat/completions")) {
    return url;
  }
  if (url.endsWith("/v1")) {
    return `${url}/chat/completions`;
  }
  return `${url}/chat/completions`;
}

async function executeAIRequest(options: AICallOptions): Promise<string> {
  const timeoutMs = options.timeoutMs || 45000;
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.maxTokens || 1200;
  const purpose = options.purpose || "general";
  const startTime = Date.now();
  
  const aiPromise = (async () => {
    // =========================================================================
    // 1. TIER 1: HCNSEC / Enterprise OpenAI-compatible Provider (PRIMARY)
    // =========================================================================
    const hcnsecApiKey = (process.env.HCNSEC_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "").trim();
    const hcnsecBaseUrl = process.env.HCNSEC_BASE_URL || process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || process.env.BASE_URL;

    if (hcnsecApiKey || hcnsecBaseUrl) {
      const apiKey = hcnsecApiKey || (process.env.OPENROUTER_API_KEY || "").trim();
      const endpoint = formatAIEndpoint(hcnsecBaseUrl);

      // Model priority for HCNSEC:
      // Verified active responsive models on api.hcnsec.cn: Qwen3.8-27B and DeepSeek-V4-Pro.
      // Unresponsive upstream models (MiniMax-M3, kimi-k3) are excluded.
      const configuredModel = (process.env.HCNSEC_MODEL || process.env.AI_MODEL || "").trim();
      const candidateModels: string[] = [];
      
      if (configuredModel && configuredModel !== "kimi-k3" && configuredModel !== "MiniMax-M3") {
        candidateModels.push(configuredModel);
      }
      if (!candidateModels.includes("Qwen3.8-27B")) {
        candidateModels.push("Qwen3.8-27B");
      }
      if (!candidateModels.includes("DeepSeek-V4-Pro")) {
        candidateModels.push("DeepSeek-V4-Pro");
      }

      const messages = [
        { role: "system", content: options.systemInstruction },
        { role: "user", content: options.userPrompt }
      ];

      for (const model of candidateModels) {
        const remainingTime = timeoutMs - (Date.now() - startTime);
        if (remainingTime < 8000) break; // Reserve time for subsequent tiers

        // Realistic per-model timeout to avoid starving subsequent providers
        const maxModelTime = purpose === "generate-syllabus" ? 18000 : 12000;
        const modelTimeout = Math.max(6000, Math.min(maxModelTime, remainingTime - 10000));
        
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), modelTimeout);

        try {
          const body: any = {
            model,
            messages,
            temperature,
            max_tokens: maxTokens
          };

          if (options.jsonMode) {
            body.response_format = { type: "json_object" };
          }

          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": process.env.APP_URL || "https://madrasah.remix",
              "X-Title": "Remix Madrasah"
            },
            body: JSON.stringify(body),
            signal: controller.signal
          });
          clearTimeout(timer);

          if (response.ok) {
            const data = await response.json() as any;
            const content = data.choices?.[0]?.message?.content;
            if (typeof content === "string" && content.trim()) {
              if (options.jsonMode) {
                const parsed = cleanAndParseJson(content, null);
                if (parsed === null) {
                  throw new Error("Invalid JSON generated by model (likely truncated).");
                }
                console.log(`[AI Provider: HCNSEC] Served (${purpose}) using model ${model}`);
                return JSON.stringify(parsed);
              }
              console.log(`[AI Provider: HCNSEC] Served (${purpose}) using model ${model}`);
              return content;
            }
          } else {
            const errText = await response.text();
            console.warn(`[AI Provider: HCNSEC] Model ${model} returned status ${response.status}:`, errText.slice(0, 150));
          }
        } catch (err: any) {
          clearTimeout(timer);
          const isAborted = controller.signal.aborted || err?.name === 'AbortError' || String(err?.message).includes('aborted');
          console.warn(`[AI Provider: HCNSEC] Model ${model} failed:`, err?.message || err);
          if (isAborted) {
            console.warn(`[AI Provider: HCNSEC] Endpoint is unresponsive (timed out after ${modelTimeout}ms). Fast-failing HCNSEC to preserve time for Tier 2/3...`);
            break; // Fast-fail to Tier 2 immediately instead of hanging again on same host
          }
        }
      }
      console.warn("[AI Provider] HCNSEC models exhausted or unresponsive, seamlessly switching to Tier 2 (OpenRouter)...");
    }

    // =========================================================================
    // 2. TIER 2: OpenRouter Multi-Model Provider (SECONDARY STABILITY PROVIDER)
    // =========================================================================
    if (process.env.OPENROUTER_API_KEY) {
      const orApiKey = process.env.OPENROUTER_API_KEY.trim();
      const configuredOrModel = (process.env.OPENROUTER_MODEL || "").trim();

      const orCandidateModels: string[] = [];
      if (configuredOrModel && configuredOrModel !== "google/gemini-2.0-flash-001") {
        orCandidateModels.push(configuredOrModel);
      }
      orCandidateModels.push(
        "deepseek/deepseek-chat",
        "qwen/qwen-2.5-72b-instruct",
        "google/gemini-2.5-flash",
        "meta-llama/llama-3.3-70b-instruct"
      );
      const uniqueOrModels = [...new Set(orCandidateModels)];

      const messages = [
        { role: "system", content: options.systemInstruction },
        { role: "user", content: options.userPrompt }
      ];

      for (const model of uniqueOrModels) {
        const remainingTime = timeoutMs - (Date.now() - startTime);
        if (remainingTime < 10000) break; // Reserve at least 10s for Tier 3

        const maxModelTime = purpose === "generate-syllabus" ? 22000 : 14000;
        const modelTimeout = Math.max(6000, Math.min(maxModelTime, remainingTime - 8000));
        
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), modelTimeout);

        try {
          const body: any = {
            model,
            messages,
            temperature,
            max_tokens: maxTokens
          };

          if (options.jsonMode) {
            body.response_format = { type: "json_object" };
          }

          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${orApiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": process.env.APP_URL || "https://madrasah.remix",
              "X-Title": "Remix Madrasah"
            },
            body: JSON.stringify(body),
            signal: controller.signal
          });
          clearTimeout(timer);

          if (response.ok) {
            const data = await response.json() as any;
            const content = data.choices?.[0]?.message?.content;
            if (typeof content === "string" && content.trim()) {
              if (options.jsonMode) {
                const parsed = cleanAndParseJson(content, null);
                if (parsed === null) {
                  throw new Error("Invalid JSON generated by model (likely truncated).");
                }
                console.log(`[AI Provider: OpenRouter] Served (${purpose}) using model ${model}`);
                return JSON.stringify(parsed);
              }
              console.log(`[AI Provider: OpenRouter] Served (${purpose}) using model ${model}`);
              return content;
            }
          } else {
            const errText = await response.text();
            console.warn(`[AI Provider: OpenRouter] Model ${model} returned status ${response.status}:`, errText.slice(0, 150));
          }
        } catch (err: any) {
          clearTimeout(timer);
          console.warn(`[AI Provider: OpenRouter] Model ${model} failed:`, err?.message || err);
        }
      }
      console.warn("[AI Provider] OpenRouter models exhausted or unresponsive, checking last-resort fallback...");
    }

    // =========================================================================
    // 3. TIER 3: Google GenAI SDK (LAST-RESORT SAFETY NET ONLY)
    // =========================================================================
    const gemini = getGeminiClient();
    if (gemini) {
      try {
        console.log(`[AI Provider: Gemini SDK] Invoking last-resort safety net for (${purpose})...`);
        const config: any = {
          systemInstruction: options.systemInstruction,
          temperature
        };
        if (options.maxTokens) {
          config.maxOutputTokens = options.maxTokens;
        }
        if (options.jsonMode) {
          config.responseMimeType = "application/json";
          if (options.responseSchema) {
            config.responseSchema = options.responseSchema;
          }
        }
        if (options.tools) {
          config.tools = options.tools;
        }

        const geminiModels = [
          process.env.GEMINI_MODEL,
          "gemini-3.8-flash",
          "gemini-3.1-flash-lite",
          "gemini-3.1-pro-preview"
        ].filter(Boolean) as string[];
        const uniqueGeminiModels = [...new Set(geminiModels)];

        let lastGeminiError: any = null;

        for (const geminiModel of uniqueGeminiModels) {
          try {
            // If previous model hit 503 (high demand spike), brief 600ms pause
            if (lastGeminiError && (lastGeminiError?.status === 503 || String(lastGeminiError?.message).includes('503'))) {
              await new Promise(r => setTimeout(r, 600));
            }

            const response = await gemini.models.generateContent({
              model: geminiModel,
              contents: options.userPrompt,
              config
            });

            if (response.text) {
              if (options.jsonMode) {
                const parsed = cleanAndParseJson(response.text, null);
                if (parsed === null) {
                  throw new Error("Invalid JSON generated by model (likely truncated).");
                }
                console.log(`[AI Provider: Gemini SDK] Served (${purpose}) via ${geminiModel}`);
                return JSON.stringify(parsed);
              }
              console.log(`[AI Provider: Gemini SDK] Served (${purpose}) via ${geminiModel}`);
              return response.text;
            }
          } catch (modelErr: any) {
            lastGeminiError = modelErr;
            console.warn(`[AI Provider: Gemini SDK] Model ${geminiModel} failed:`, modelErr?.message || modelErr);
            if (modelErr?.message?.includes('429') || modelErr?.message?.includes('RESOURCE_EXHAUSTED')) {
              continue;
            }
          }
        }
        if (lastGeminiError) {
          throw lastGeminiError;
        }
      } catch (err: any) {
        console.warn("[AI Provider: Gemini SDK] Last-resort fallback failed:", err?.message || err);
        if (err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
          throw new Error("Kuota AI pada semua penyedia telah habis (Rate Limit 429). Silakan tunggu beberapa saat.");
        }
        if (err?.message?.includes('503') || err?.status === 503) {
          throw new Error("Layanan model AI sedang mengalami lonjakan beban tinggi (503). Silakan coba sesaat lagi.");
        }
        throw new Error(`AI Provider Error: ${err?.message || err}`);
      }
    }

    throw new Error("Layanan AI mandiri (HCNSEC / OpenRouter) tidak dapat dihubungi dan tidak ada cadangan aktif. Periksa konfigurasi di Settings > Secrets.");
  })();

  let isSettled = false;
  let timeoutTimer: any = null;

  const timeoutPromise = new Promise<string>((_, reject) => {
    timeoutTimer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        reject(new Error("Permintaan AI melebihi batas waktu maksimal. Silakan coba lagi."));
      }
    }, timeoutMs);
  });

  aiPromise.catch((err) => {
    // Safely absorb any background rejection if timeout already won the race
    if (isSettled) {
      console.debug("[AI Provider] Late background operation error absorbed:", err?.message || err);
    }
  });

  try {
    const result = await Promise.race([aiPromise, timeoutPromise]);
    isSettled = true;
    if (timeoutTimer) clearTimeout(timeoutTimer);
    return result;
  } catch (err) {
    isSettled = true;
    if (timeoutTimer) clearTimeout(timeoutTimer);
    throw err;
  }
}

const app = express();

// Trust proxy for rate limiter to work correctly behind reverse proxies (Vercel, Cloud Run, Nginx)
app.set("trust proxy", 1);

// Safety middleware: ensure pre-parsed JSON bodies in serverless environments (e.g. Vercel) do not hang body-parser
app.use((req, res, next) => {
  if (req.body !== undefined && (req as any)._body === undefined) {
    (req as any)._body = true;
  }
  next();
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window`
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests from this IP, please try again after 15 minutes." }
  });

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 AI requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Terlalu banyak permintaan ke AI. Silakan tunggu beberapa saat." }
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use("/api/", apiLimiter);
  app.use("/api/ai/", aiLimiter);

  // Logging middleware for audit trail
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      console.log(`[API Audit] ${new Date().toISOString()} | ${req.method} ${req.path} | IP: ${req.ip}`);
    }
    next();
  });

const apiRouter = express.Router();

// Health check endpoint for deployment monitoring (Vercel / Cloud Run / Docker)
apiRouter.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "madrasah-api",
    timestamp: Date.now(),
    environment: process.env.VERCEL ? "vercel" : (process.env.NODE_ENV || "development")
  });
});

// AI Routes
  apiRouter.post("/ai/zettelkasten", async (req, res) => {
    try {
      const { prompt, notes = [], concepts = [], fragments = [], relations = [] } = req.body;
      const sanitizedNotes = Array.isArray(notes) 
        ? notes.slice(0, 10).map((n: any) => ({ id: n.id, title: n.title, excerpt: (n.content || '').slice(0, 500) }))
        : [];
      
      const sanitizedConcepts = Array.isArray(concepts)
        ? concepts.slice(0, 5).map((c: any) => ({ name: c.name, definition: c.definition })) : [];
        
      const sanitizedFragments = Array.isArray(fragments)
        ? fragments.slice(0, 5).map((f: any) => ({ quote: f.quote, context: f.context })) : [];

      const cacheKey = getCacheKey("zettelkasten", { prompt, notesCount: sanitizedNotes.length });
      
      const cached = aiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Cache Hit] /api/ai/zettelkasten`);
        return res.json(cached.data);
      }
      
      const systemInstruction = `
      You are the Madrasah PKOS Knowledge Synthesis Engine.
      Analyze the user's semantic knowledge base with precision and intellectual humility (ta'dib).
      Your objectives:
      1. Conceptual Synthesis: Synthesize core ideas directly grounded in the provided notes, concepts, and source fragments (preserve provenance).
      2. Semantic Relationships: Identify genuine connections, contradictions, or complementary relationships between knowledge blocks.
      3. Epistemic Gaps & Thought Trajectories: Point out logical gaps, missing premises, or promising directions for deeper inquiry.

      Strict Rules:
      - Output in clean, articulate Indonesian Markdown.
      - Cite exact note titles or source quotes when making assertions.
      - Be concise, analytical, and completely free of conversational filler, sycophancy, or marketing clichés.
      
      User's Context:
      Notes: ${JSON.stringify(sanitizedNotes)}
      Concepts: ${JSON.stringify(sanitizedConcepts)}
      Source Fragments: ${JSON.stringify(sanitizedFragments)}
      Relations: ${JSON.stringify(relations.slice(0, 10))}
      `;

      const text = await executeAIRequest({
        systemInstruction,
        userPrompt: String(prompt || '').slice(0, 2000),
        temperature: 0.25,
        maxTokens: 1200,
        purpose: "zettelkasten"
      });

      const resultData = { result: text };
      
      aiCache.set(cacheKey, { timestamp: Date.now(), data: resultData });
      res.json(resultData);
    } catch (error: any) {
      console.error("AI Assistant Error:", error);
      res.status(500).json({ error: error.message || "Failed to process AI request" });
    }
  });

  apiRouter.post("/ai/suggest-tags", async (req, res) => {
    try {
      const { content, notes = [], concepts = [] } = req.body;
      const sanitizedContent = String(content || '').slice(0, 4000);
      const sanitizedNotes = Array.isArray(notes)
        ? notes.slice(0, 10).map((n: any) => ({ id: n.id, title: n.title }))
        : [];
      const sanitizedConcepts = Array.isArray(concepts)
        ? concepts.slice(0, 10).map((c: any) => ({ id: c.id, name: c.name }))
        : [];

      const cacheKey = getCacheKey("suggest-tags", { content: sanitizedContent });
      
      const cached = aiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Cache Hit] /api/ai/suggest-tags`);
        return res.json(cached.data);
      }
      
      const systemInstruction = `
      You are the Madrasah Knowledge Taxonomy Engine.
      Analyze the input snippet and extract concise, deterministic conceptual metadata.

      Output Requirements:
      1. tags: 3 to 5 lowercase conceptual keywords in Indonesian or English (no hashtag symbols, no spaces within a single tag).
      2. icon: Exactly 1 valid Lucide-react icon name that best represents the semantic theme (strictly choose from: 'Brain', 'BookOpen', 'Bookmark', 'FileText', 'Lightbulb', 'Layers', 'Sparkles', 'Compass', 'Search', 'Archive', 'Code', 'PenTool', 'Scale', 'Shield', 'Target', 'Folder', 'GraduationCap').
      3. connections: 1 to 3 exact matching titles from existing notes if there is a direct conceptual relation.
      
      Context references:
      Existing Notes: ${JSON.stringify(sanitizedNotes)}
      Existing Concepts: ${JSON.stringify(sanitizedConcepts)}
      
      Respond ONLY with a raw JSON object matching the schema:
      {"tags": ["tag1", "tag2"], "icon": "BookOpen", "connections": ["Note Title"]}
      `;

      const schema = {
        type: Type.OBJECT,
        properties: {
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          icon: { type: Type.STRING },
          connections: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["tags", "icon", "connections"]
      };

      const text = await executeAIRequest({
        systemInstruction,
        userPrompt: `New snippet:\n${sanitizedContent}`,
        jsonMode: true,
        responseSchema: schema,
        temperature: 0.1,
        maxTokens: 350,
        purpose: "suggest-tags"
      });

      const parsed = cleanAndParseJson(text, { tags: [], icon: "FileText", connections: [] });
      
      const rawTags = Array.isArray(parsed.tags) ? parsed.tags : [];
      const tags = rawTags.map((t: any) => String(t).trim()).filter(Boolean);
      
      let icon = typeof parsed.icon === 'string' ? parsed.icon.replace(/[^a-zA-Z]/g, '') : 'FileText';
      if (!icon) icon = 'FileText';

      const rawConns = Array.isArray(parsed.connections) ? parsed.connections : [];
      const connections = rawConns.map((c: any) => String(c).trim()).filter(Boolean);

      const resultData = { tags, icon, connections };
      
      aiCache.set(cacheKey, { timestamp: Date.now(), data: resultData });
      res.json(resultData);
    } catch (error: any) {
      console.error("AI Suggestion Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate suggestions" });
    }
  });

  apiRouter.post("/ai/generate-flashcards", async (req, res) => {
    try {
      const { content } = req.body;
      const sanitizedContent = String(content || '').slice(0, 6000);

      const cacheKey = getCacheKey("generate-flashcards", { content: sanitizedContent });
      
      const cached = aiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Cache Hit] /api/ai/generate-flashcards`);
        return res.json(cached.data);
      }
      
      const systemInstruction = `
      You are the Madrasah Spaced Repetition Flashcard Engine, strictly adhering to the SuperMemo Minimum Information Principle (MIP).
      Extract 5-8 high-yield active recall Question & Answer pairs from the content in Indonesian.

      Core Principles:
      - 1 concept per card (atomic flashcards). Never create complex multi-part questions.
      - Question (front): Clear, unambiguous, and focused on principles, causes, definitions, or mechanisms.
      - Answer (back): Concise, direct, and factual (1-3 sentences maximum).
      
      Respond ONLY with a raw JSON object with the "flashcards" array:
      {"flashcards": [{"front": "Pertanyaan spesifik...", "back": "Jawaban padat..."}]}
      `;

      const schema = {
        type: Type.OBJECT,
        properties: {
          flashcards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                front: { type: Type.STRING },
                back: { type: Type.STRING }
              },
              required: ["front", "back"]
            }
          }
        },
        required: ["flashcards"]
      };

      const text = await executeAIRequest({
        systemInstruction,
        userPrompt: `Create flashcards from this note:\n\n${sanitizedContent}`,
        jsonMode: true,
        responseSchema: schema,
        temperature: 0.2,
        maxTokens: 1000,
        timeoutMs: 48000,
        purpose: "generate-flashcards"
      });

      const parsed = cleanAndParseJson(text, { flashcards: [] });
      const rawList = Array.isArray(parsed.flashcards) 
        ? parsed.flashcards 
        : (Array.isArray(parsed.cards) ? parsed.cards : (Array.isArray(parsed) ? parsed : []));

      const flashcards = rawList
        .map((c: any) => {
          if (!c || typeof c !== 'object') return null;
          const front = String(c.front || c.question || c.q || c.pertanyaan || c.tanya || c.prompt || '').trim();
          const back = String(c.back || c.answer || c.a || c.jawaban || c.jawab || c.solution || c.penjelasan || '').trim();
          if (front && back) {
            return { front, back };
          }
          return null;
        })
        .filter(Boolean);

      const resultData = { flashcards };
      
      aiCache.set(cacheKey, { timestamp: Date.now(), data: resultData });
      res.json(resultData);
    } catch (error: any) {
      console.error("AI Flashcard Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate flashcards" });
    }
  });

  apiRouter.post("/ai/grade-flashcard", async (req, res) => {
    try {
      const { question, correctAnswer, userAnswer } = req.body;
      const cacheKey = getCacheKey("grade-flashcard", { question, correctAnswer, userAnswer });
      
      const cached = aiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Cache Hit] /api/ai/grade-flashcard`);
        return res.json(cached.data);
      }
      
      const systemInstruction = `
      You are an objective SuperMemo-2 (SM-2) Conceptual Grading Engine.
      Evaluate the user's answer based on SEMANTIC EQUIVALENCE to the correct answer, NOT literal verbatim matching.

      SM-2 Quality Scale (0 to 5 integer):
      - 5: Perfect conceptual recall; fully accurate and complete.
      - 4: Correct and substantive recall, with minor non-critical omission.
      - 3: Partially correct; grasped the core theme but missed an essential mechanism or element.
      - 2: Incorrect, but showed tangential familiarity or partial recall of keywords.
      - 1: Incorrect, completely failed to demonstrate understanding.
      - 0: Completely blank, nonsensical, or irrelevant answer.

      Feedback rules:
      - 1-2 objective, respectful sentences in Indonesian explaining precisely what was accurate and what was missing.
      - No sycophantic praise, no generic filler.
 
      Respond ONLY with a raw JSON object matching the schema:
      {"isCorrect": true, "quality": 4, "feedback": "Penjelasan evaluasi objektif dalam Bahasa Indonesia."}
      `;

      const schema = {
        type: Type.OBJECT,
        properties: {
          isCorrect: { type: Type.BOOLEAN },
          quality: { type: Type.NUMBER },
          feedback: { type: Type.STRING }
        },
        required: ["isCorrect", "quality", "feedback"]
      };

      const text = await executeAIRequest({
        systemInstruction,
        userPrompt: `Question: ${question}\nCorrect Answer: ${correctAnswer}\nUser's Answer: ${userAnswer}`,
        jsonMode: true,
        responseSchema: schema,
        temperature: 0.0,
        maxTokens: 300,
        purpose: "grade-flashcard"
      });

      const parsed = cleanAndParseJson(text, { isCorrect: false, quality: 1, feedback: "Jawaban perlu diperdalam lagi." });
      
      let rawQuality = parsed.quality ?? parsed.score ?? parsed.rating ?? (parsed.isCorrect ? 4 : 1);
      let quality = typeof rawQuality === 'number' ? Math.round(rawQuality) : parseInt(String(rawQuality), 10);
      if (isNaN(quality)) quality = (parsed.isCorrect || parsed.correct) ? 4 : 1;
      quality = Math.max(0, Math.min(5, quality));

      const isCorrect = typeof parsed.isCorrect === 'boolean' 
        ? parsed.isCorrect 
        : (typeof parsed.correct === 'boolean' ? parsed.correct : quality >= 3);
      const feedback = String(parsed.feedback || parsed.explanation || parsed.ulasan || (isCorrect ? 'Jawaban Anda tepat.' : 'Jawaban belum tepat.')).trim();

      const resultData = { isCorrect, quality, feedback };
      
      aiCache.set(cacheKey, { timestamp: Date.now(), data: resultData });
      res.json(resultData);
    } catch (error: any) {
      console.error("AI Grading Error:", error);
      res.status(500).json({ error: error.message || "Failed to grade answer" });
    }
  });

  apiRouter.post("/ai/generate-syllabus", async (req, res) => {
    try {
      const { topic } = req.body;
      const cacheKey = getCacheKey("generate-syllabus", { topic });
      
      const cached = aiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Cache Hit] /api/ai/generate-syllabus`);
        return res.json(cached.data);
      }
      
      const systemInstruction = `
      You are the Madrasah Modular Curriculum & Syllabus Engine.
      Design a rigorous, structured learning path based on progressive Bloom's taxonomy (Foundational Knowledge -> Core Methodology -> Advanced Synthesis & Application).

      Structural Requirements:
      1. Title and concise description in Indonesian.
      2. Exactly 3 sequential pedagogical phases:
         - Phase 1: Fondasi Konseptual & Terminologi Inti
         - Phase 2: Metode, Praktik, & Analisis Inti
         - Phase 3: Implementasi Kritis & Sintesis Terapan
      3. Each phase must contain 3 to 4 focused competencies. Keep each competency title and description concise (1 short sentence, max 15 words per description) to ensure complete, well-formed JSON output without token truncation.
 
      Provide all responses in Indonesian.
 
      Respond ONLY with a raw JSON object matching the schema:
      {
        "title": "Judul Jalur Belajar",
        "description": "Deskripsi singkat tujuan kurikulum",
        "phases": [
          {
            "title": "Fase 1: Judul",
            "description": "Deskripsi singkat fase",
            "order": 1,
            "competencies": [
              { "title": "Kompetensi 1", "description": "Deskripsi capaian terukur" }
            ]
          }
        ]
      }
      `;

      const schema = {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          phases: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                order: { type: Type.INTEGER },
                competencies: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING }
                    },
                    required: ["title", "description"]
                  }
                }
              },
              required: ["title", "description", "order", "competencies"]
            }
          }
        },
        required: ["title", "description", "phases"]
      };

      const text = await executeAIRequest({
        systemInstruction,
        userPrompt: `Topic: ${topic}`,
        jsonMode: true,
        responseSchema: schema,
        temperature: 0.25,
        maxTokens: 3500,
        timeoutMs: 48000,
        purpose: "generate-syllabus"
      });

      const parsed = cleanAndParseJson(text, { title: topic, description: "Silabus pembelajaran komprehensif.", phases: [] });
      
      const rawPhases = Array.isArray(parsed.phases) 
        ? parsed.phases 
        : (Array.isArray(parsed.fase) ? parsed.fase : (Array.isArray(parsed.stages) ? parsed.stages : (Array.isArray(parsed.modules) ? parsed.modules : [])));

      const phases = rawPhases.map((p: any, idx: number) => {
        const rawComps = Array.isArray(p.competencies) 
          ? p.competencies 
          : (Array.isArray(p.kompetensi) ? p.kompetensi : (Array.isArray(p.tasks) ? p.tasks : (Array.isArray(p.steps) ? p.steps : (Array.isArray(p.items) ? p.items : []))));

        const competencies = rawComps.map((c: any, cIdx: number) => ({
          title: String(c.title || c.name || c.kompetensi || c.task || `Kompetensi ${cIdx + 1}`).trim(),
          description: String(c.description || c.deskripsi || '').trim(),
          order: typeof c.order === 'number' ? c.order : cIdx + 1
        })).filter((c: any) => Boolean(c.title));

        return {
          title: String(p.title || p.name || p.phase_name || p.phaseTitle || p.fase || `Fase ${idx + 1}`).trim(),
          description: String(p.description || p.deskripsi || '').trim(),
          order: typeof p.order === 'number' ? p.order : idx + 1,
          competencies
        };
      }).filter((p: any) => Boolean(p.title));

      const resultData = {
        title: String(parsed.title || parsed.name || topic).trim(),
        description: String(parsed.description || parsed.deskripsi || `Panduan belajar untuk ${topic}`).trim(),
        phases
      };
      
      aiCache.set(cacheKey, { timestamp: Date.now(), data: resultData });
      res.json(resultData);
    } catch (error: any) {
      console.error("AI Syllabus Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate syllabus" });
    }
  });

  apiRouter.post("/ai/summarize-literature", async (req, res) => {
    try {
      const { content } = req.body;
      const cacheKey = getCacheKey("summarize-literature", { content });
      
      const cached = aiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Cache Hit] /api/ai/summarize-literature`);
        return res.json(cached.data);
      }
      
      const systemInstruction = `
      You are the Madrasah Academic Literature Analysis Engine.
      Deconstruct academic or philosophical literature into the Three Pillars of Scholarly Review in Indonesian:
      1. mainProblem (Masalah Utama): The central epistemic, theoretical, or empirical question addressed.
      2. methodology (Metodologi / Alur Argumen): The analytical framework, conceptual apparatus, or line of reasoning employed.
      3. conclusion (Kesimpulan & Implikasi): The core thesis, findings, or practical implications established.
 
      Respond ONLY with a raw JSON object matching this schema:
      {
        "mainProblem": "Penjelasan masalah utama...",
        "methodology": "Penjelasan metodologi...",
        "conclusion": "Penjelasan kesimpulan..."
      }
      `;

      const schema = {
        type: Type.OBJECT,
        properties: {
          mainProblem: { type: Type.STRING },
          problem: { type: Type.STRING },
          methodology: { type: Type.STRING },
          conclusion: { type: Type.STRING }
        },
        required: ["mainProblem", "methodology", "conclusion"]
      };

      const text = await executeAIRequest({
        systemInstruction,
        userPrompt: `Literature Content:\n${content}`,
        jsonMode: true,
        responseSchema: schema,
        temperature: 0.15,
        maxTokens: 800,
        purpose: "summarize-literature"
      });

      const parsed = cleanAndParseJson(text, {});
      const mainProblem = String(
        parsed.mainProblem || 
        parsed.problem || 
        parsed.masalahUtama || 
        parsed.masalah_utama || 
        parsed.inti_masalah || 
        "Masalah utama belum diekstrak secara spesifik."
      ).trim();

      const methodology = String(
        parsed.methodology || 
        parsed.metodologi || 
        parsed.metode || 
        parsed.pendekatan || 
        "Metodologi pendekatan konseptual."
      ).trim();

      const conclusion = String(
        parsed.conclusion || 
        parsed.kesimpulan || 
        parsed.takeaway || 
        parsed.summary || 
        "Kesimpulan materi literatur."
      ).trim();

      const resultData = {
        mainProblem,
        problem: mainProblem,
        methodology,
        conclusion
      };
      
      aiCache.set(cacheKey, { timestamp: Date.now(), data: resultData });
      res.json(resultData);
    } catch (error: any) {
      console.error("AI Literature Summarizer Error:", error);
      res.status(500).json({ error: error.message || "Failed to summarize literature" });
    }
  });

interface OpenLibraryBookResult {
  totalPages: number;
  coverUrl: string;
  isEstimated: boolean;
  author?: string;
}

async function searchOpenLibraryDocs(query: string, timeoutMs = 7000): Promise<any[]> {
  const queryUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=title,author_name,cover_i,isbn,number_of_pages_median,number_of_pages`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(queryUrl, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "MadrasahPKOS/1.0 (https://madrasah.remix)"
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[OpenLibrary] Search returned status ${res.status} for query "${query}"`);
      return [];
    }

    const data = await res.json() as any;
    return data?.docs || [];
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[OpenLibrary] Search failed for query "${query}":`, err?.message || err);
    return [];
  }
}

function normalizeForMatch(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Skor 0-1 seberapa mirip dua judul/nama, berbasis kemiripan kata (bukan exact match),
// supaya "Filsafat Ilmu" tidak salah dicocokkan dengan "Filsafat Ilmu Pengetahuan Modern" karya lain.
function textSimilarity(query: string, candidate: string): number {
  const q = normalizeForMatch(query);
  const c = normalizeForMatch(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  const qWords = q.split(" ").filter(w => w.length > 1);
  if (qWords.length === 0) return 0;
  const cWords = new Set(c.split(" ").filter(w => w.length > 1));
  let overlap = 0;
  for (const w of qWords) if (cWords.has(w)) overlap++;
  const substringBonus = (c.includes(q) || q.includes(c)) ? 0.2 : 0;
  return Math.min(1, overlap / qWords.length + substringBonus);
}

async function fetchFromOpenLibrary(title: string, author?: string): Promise<OpenLibraryBookResult | null> {
  const cleanTitle = String(title || "").trim();
  const cleanAuthor = String(author || "").trim();

  if (!cleanTitle) return null;

  let bestCoverUrl = "";
  let bestTotalPages = 0;
  let bestAuthor = "";

  const MATCH_THRESHOLD = 0.5;

  const extractFromDocs = (docs: any[]) => {
    let bestScore = 0;
    let bestDoc: any = null;

    for (let i = 0; i < Math.min(docs.length, 10); i++) {
      const doc = docs[i];
      if (!doc || !doc.title) continue;

      let score = textSimilarity(cleanTitle, String(doc.title));
      if (cleanAuthor && Array.isArray(doc.author_name)) {
        const authorMatches = doc.author_name.some((a: string) => textSimilarity(cleanAuthor, String(a)) >= 0.5);
        if (authorMatches) score += 0.3;
      }

      if (score > bestScore) {
        bestScore = score;
        bestDoc = doc;
      }
    }

    // Hanya ambil data kalau ada satu dokumen yang cukup mirip — dan semua field
    // (penulis, cover, halaman) diambil dari dokumen YANG SAMA, bukan dicampur.
    if (!bestDoc || bestScore < MATCH_THRESHOLD) return;

    if (!bestAuthor && Array.isArray(bestDoc.author_name) && bestDoc.author_name.length > 0 && bestDoc.author_name[0]) {
      bestAuthor = String(bestDoc.author_name[0]).trim();
    }

    if (!bestCoverUrl) {
      if (bestDoc.cover_i) {
        bestCoverUrl = `https://covers.openlibrary.org/b/id/${bestDoc.cover_i}-L.jpg`;
      } else if (Array.isArray(bestDoc.isbn) && bestDoc.isbn.length > 0 && bestDoc.isbn[0]) {
        bestCoverUrl = `https://covers.openlibrary.org/b/isbn/${bestDoc.isbn[0]}-L.jpg`;
      }
    }

    if (bestTotalPages === 0) {
      const rawPages = bestDoc.number_of_pages_median ?? bestDoc.number_of_pages ?? 0;
      if (typeof rawPages === "number") {
        bestTotalPages = Math.max(0, Math.round(rawPages));
      } else if (typeof rawPages === "string") {
        bestTotalPages = Math.max(0, parseInt(rawPages, 10) || 0);
      }
    }
  };

  // Step A: Search with title + author if author is provided
  if (cleanAuthor) {
    const combinedDocs = await searchOpenLibraryDocs(`${cleanTitle} ${cleanAuthor}`);
    extractFromDocs(combinedDocs);
  }

  // Step B: If cover or pages not found yet, search with title alone
  if (!bestCoverUrl || bestTotalPages === 0) {
    const titleDocs = await searchOpenLibraryDocs(cleanTitle);
    extractFromDocs(titleDocs);
  }

  if (bestCoverUrl || bestTotalPages > 0 || bestAuthor) {
    return {
      totalPages: bestTotalPages,
      coverUrl: bestCoverUrl,
      author: bestAuthor || undefined,
      isEstimated: false
    };
  }

  return null;
}

async function fetchFromGoogleBooks(title: string, author?: string): Promise<OpenLibraryBookResult | null> {
  const cleanTitle = String(title || "").trim();
  const cleanAuthor = String(author || "").trim();

  if (!cleanTitle) return null;

  let query = cleanTitle;
  if (cleanAuthor) {
    query += `+inauthor:${cleanAuthor}`;
  }

  const queryUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(queryUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[GoogleBooks] Search returned status ${res.status} for query "${query}"`);
      return null;
    }

    const data = await res.json() as any;
    if (data.items && data.items.length > 0) {
      let bestScore = 0;
      let bestItem: any = null;

      for (const item of data.items) {
        const vol = item.volumeInfo;
        if (!vol || !vol.title) continue;

        let score = textSimilarity(cleanTitle, String(vol.title));
        if (cleanAuthor && Array.isArray(vol.authors)) {
          const authorMatches = vol.authors.some((a: string) => textSimilarity(cleanAuthor, String(a)) >= 0.5);
          if (authorMatches) score += 0.3;
        }

        if (score > bestScore) {
          bestScore = score;
          bestItem = item;
        }
      }

      // Semua field diambil dari SATU buku yang paling mirip judulnya, bukan dicampur
      // dari beberapa buku berbeda di hasil pencarian.
      if (bestItem && bestScore >= 0.5) {
        const vol = bestItem.volumeInfo;
        const bestAuthor = (vol.authors && Array.isArray(vol.authors) && vol.authors.length > 0)
          ? String(vol.authors[0]).trim() : "";
        const bestTotalPages = (typeof vol.pageCount === "number" && vol.pageCount > 0)
          ? Math.round(vol.pageCount) : 0;
        let bestCoverUrl = "";
        if (vol.imageLinks && vol.imageLinks.thumbnail) {
          let thumb = String(vol.imageLinks.thumbnail).replace("http:", "https:");
          thumb = thumb.replace("&edge=curl", "");
          bestCoverUrl = thumb;
        }

        if (bestTotalPages > 0 || bestCoverUrl || bestAuthor) {
          return {
            totalPages: bestTotalPages,
            coverUrl: bestCoverUrl,
            author: bestAuthor || undefined,
            isEstimated: false
          };
        }
      }
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[GoogleBooks] Search failed for query "${query}":`, err?.message || err);
  }

  return null;
}

  apiRouter.post("/ai/book-info", async (req, res) => {
    // Enable chunked streaming for real-time NDJSON logs
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendLog = (message: string) => {
      res.write(JSON.stringify({ type: "log", message }) + "\n");
    };

    const sendResult = (data: any) => {
      res.write(JSON.stringify({ type: "result", data }) + "\n");
      res.end();
    };

    const sendError = (error: string) => {
      res.write(JSON.stringify({ type: "error", error }) + "\n");
      res.end();
    };

    try {
      const { title, author } = req.body;
      const cleanTitle = String(title || "").trim();
      const cleanAuthor = String(author || "").trim();

      if (!cleanTitle) {
        return sendError("Judul buku wajib diisi");
      }

      const cacheKey = getCacheKey("book-info", { title: cleanTitle, author: cleanAuthor });
      
      const cached = aiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Cache Hit] /api/ai/book-info`);
        sendLog("Menemukan data di dalam cache memori...");
        return sendResult(cached.data);
      }

      sendLog("Menghubungi server katalog Open Library...");
      let openLibResult = await fetchFromOpenLibrary(cleanTitle, cleanAuthor);
      
      if (!openLibResult || !openLibResult.coverUrl || openLibResult.totalPages === 0 || !openLibResult.author) {
        sendLog("Data Open Library belum lengkap. Beralih mencari via Google Books...");
        const googleResult = await fetchFromGoogleBooks(cleanTitle, cleanAuthor);
        if (googleResult) {
          if (!openLibResult) openLibResult = googleResult;
          else {
            openLibResult.coverUrl = openLibResult.coverUrl || googleResult.coverUrl;
            openLibResult.totalPages = openLibResult.totalPages || googleResult.totalPages;
            openLibResult.author = openLibResult.author || googleResult.author;
          }
        }
      }

      if (!openLibResult || openLibResult.totalPages === 0 || !openLibResult.author) {
        sendLog("Data literatur masih rumpang. Memicu Mesin AI untuk estimasi & analisis...");
        
        const systemInstruction = `
        You are the Madrasah Bibliographic Metadata Estimation Engine.
        We need to complete the metadata for a published work titled "${cleanTitle}".
        Provide an objective estimated page count, author name (if known), and optional cover URL for this published work.
        
        Requirements:
        1. Provide a realistic estimated total page count based on typical published or academic editions.
        2. Provide the author's full name if known.
        3. If you know a valid Open Library ISBN or Cover ID, you may provide "https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg" or "https://covers.openlibrary.org/b/id/{cover_id}-L.jpg".
        4. If no verified ISBN or Cover ID is known, return an empty string "" instead of guessing invalid URLs.
        
        Respond ONLY with a raw JSON object matching the schema:
        {"totalPages": 320, "coverUrl": "", "author": "Author Name"}
        `;

        const schema = {
          type: Type.OBJECT,
          properties: {
            totalPages: { type: Type.INTEGER },
            coverUrl: { type: Type.STRING },
            author: { type: Type.STRING }
          },
          required: ["totalPages", "coverUrl"]
        };

        try {
          const text = await executeAIRequest({
            systemInstruction,
            userPrompt: `Title: ${cleanTitle}\nAuthor: ${cleanAuthor || openLibResult?.author || "Unknown"}`,
            jsonMode: true,
            responseSchema: schema,
            temperature: 0.0,
            maxTokens: 250,
            purpose: "book-info"
          });

          sendLog("Berhasil menganalisis respons AI. Menyusun ulang data hibrida...");
          const parsed = cleanAndParseJson(text, { totalPages: 0, coverUrl: "", author: "" });
          
          let rawPages = parsed.totalPages ?? parsed.total_pages ?? parsed.pages ?? parsed.pageCount ?? 0;
          let aiTotalPages = typeof rawPages === 'number' ? Math.round(rawPages) : parseInt(String(rawPages), 10) || 0;
          if (aiTotalPages < 0) aiTotalPages = 0;

          let aiCoverUrl = typeof parsed.coverUrl === 'string' 
            ? parsed.coverUrl 
            : (parsed.cover_url || parsed.cover || parsed.image_url || parsed.imageUrl || "");

          if (typeof aiCoverUrl === 'string') {
            aiCoverUrl = aiCoverUrl.trim();
            if (!aiCoverUrl.startsWith("http://") && !aiCoverUrl.startsWith("https://")) {
              aiCoverUrl = "";
            }
          } else {
            aiCoverUrl = "";
          }

          let aiAuthor = typeof parsed.author === 'string' ? parsed.author.trim() : "";

          if (!openLibResult) {
            openLibResult = {
              totalPages: aiTotalPages,
              coverUrl: aiCoverUrl,
              author: aiAuthor || undefined,
              isEstimated: true
            };
          } else {
            openLibResult.totalPages = openLibResult.totalPages || aiTotalPages;
            openLibResult.coverUrl = openLibResult.coverUrl || aiCoverUrl;
            openLibResult.author = openLibResult.author || aiAuthor;
            openLibResult.isEstimated = true;
          }
        } catch (aiErr: any) {
          console.warn("[AI Fallback] Failed but continuing with partial API data:", aiErr?.message || aiErr);
          sendLog("Peringatan: Analisis AI terganggu. Melanjutkan dengan data yang ada...");
        }
      }

      if (openLibResult) {
        sendLog("Metadata berhasil dirangkai utuh.");
        console.log(`[Final Result] Metadata assembled for "${cleanTitle}":`, openLibResult);
        aiCache.set(cacheKey, { timestamp: Date.now(), data: openLibResult });
        return sendResult(openLibResult);
      }

      return sendError("Gagal menemukan informasi buku dari semua sumber.");
    } catch (error: any) {
      console.error("AI Book Info Error:", error);
      return sendError(error.message || "Failed to fetch book info");
    }
  });

  // Third-party publishing webhook proxy
  apiRouter.post("/publishing/webhook", async (req, res) => {
    try {
      const { targetUrl, secret, payload } = req.body;
      if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).json({ error: "Target Webhook URL wajib disertakan." });
      }

      // Basic URL security validation
      try {
        const parsedUrl = new URL(targetUrl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          return res.status(400).json({ error: "Protokol URL tidak valid (harus http atau https)." });
        }
      } catch {
        return res.status(400).json({ error: "Format Webhook URL tidak valid." });
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "Madrasah-PKOS-Publishing-Agent/1.0",
      };

      if (secret && typeof secret === 'string' && secret.trim()) {
        headers["Authorization"] = `Bearer ${secret.trim()}`;
        headers["X-Webhook-Secret"] = secret.trim();
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 sec timeout

      try {
        const response = await fetch(targetUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload || {}),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        let responseText = "";
        try {
          responseText = await response.text();
        } catch {
          responseText = "";
        }

        let responseJson: any = null;
        try {
          responseJson = JSON.parse(responseText);
        } catch {
          responseJson = null;
        }

        if (!response.ok) {
          return res.status(response.status).json({
            error: `Penerbitan gagal. Endpoint eksternal mengembalikan status ${response.status} ${response.statusText}`,
            details: responseJson || responseText.substring(0, 300),
          });
        }

        return res.json({
          success: true,
          status: response.status,
          statusText: response.statusText,
          data: responseJson || responseText.substring(0, 300) || "OK",
        });
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          return res.status(504).json({ error: "Koneksi ke endpoint webhook melebihi batas waktu (timeout 15 detik)." });
        }
        return res.status(502).json({ error: `Gagal menghubungi endpoint webhook: ${fetchErr.message || fetchErr}` });
      }
    } catch (err: any) {
      console.error("[Publishing Webhook Error]:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

// Mount apiRouter on both /api (standard relative calls) and / (serverless rewrites)
app.use("/api", apiRouter);
app.use(apiRouter);

// Global error handler for API routes to prevent HTML error responses
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[API Error]", err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

export default app;
export { app };
