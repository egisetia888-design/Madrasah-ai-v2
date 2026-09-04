import express from "express";
import path from "path";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// In-memory cache for AI responses
const aiCache = new Map<string, { timestamp: number, data: any }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function getCacheKey(endpoint: string, body: any) {
  return `${endpoint}:${JSON.stringify(body)}`;
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
      // Find outermost JSON object or array
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      const firstBracket = cleanText.indexOf('[');
      const lastBracket = cleanText.lastIndexOf(']');

      let candidate = "";
      if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        candidate = cleanText.substring(firstBrace, lastBrace + 1);
      } else if (firstBracket !== -1 && lastBracket !== -1) {
        candidate = cleanText.substring(firstBracket, lastBracket + 1);
      }

      if (candidate) {
        // Fix trailing commas if any (e.g. [1, 2, ])
        const sanitized = candidate
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        return JSON.parse(sanitized);
      }
      throw directErr;
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
          'User-Agent': 'aistudio-build',
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
        // Calculate remaining time for the whole request, reserve 2 seconds for fallback processing
        const remainingTime = timeoutMs - (Date.now() - startTime);
        if (remainingTime < 5000) break; // Not enough time left

        // Allow up to 90% of the remaining time, but cap at 55 seconds to prevent extremely long hangs
        // Minimum 15 seconds.
        const modelTimeout = Math.max(15000, Math.min(55000, remainingTime * 0.9));
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
          console.warn(`[AI Provider: HCNSEC] Model ${model} failed:`, err?.message || err);
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
        "google/gemini-3.8-flash",
        "google/gemini-2.5-flash"
      );
      const uniqueOrModels = [...new Set(orCandidateModels)];

      const messages = [
        { role: "system", content: options.systemInstruction },
        { role: "user", content: options.userPrompt }
      ];

      for (const model of uniqueOrModels) {
        const remainingTime = timeoutMs - (Date.now() - startTime);
        if (remainingTime < 5000) break; // Not enough time left

        const modelTimeout = Math.max(12000, Math.min(50000, remainingTime * 0.9));
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
        if (options.jsonMode) {
          config.responseMimeType = "application/json";
          if (options.responseSchema) {
            config.responseSchema = options.responseSchema;
          }
        }
        if (options.tools) {
          config.tools = options.tools;
        }

        const geminiModels = [process.env.GEMINI_MODEL, "gemini-3.8-flash", "gemini-3.6-flash"].filter(Boolean) as string[];
        for (const geminiModel of geminiModels) {
          try {
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
              }
              console.log(`[AI Provider: Gemini SDK] Served (${purpose}) via ${geminiModel}`);
              return response.text;
            }
          } catch (modelErr: any) {
            console.warn(`[AI Provider: Gemini SDK] Model ${geminiModel} failed:`, modelErr?.message || modelErr);
            if (modelErr?.message?.includes('429') || modelErr?.message?.includes('RESOURCE_EXHAUSTED')) {
              throw modelErr;
            }
          }
        }
      } catch (err: any) {
        console.warn("[AI Provider: Gemini SDK] Last-resort fallback failed:", err?.message || err);
        if (err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
          throw new Error("Kuota AI pada semua penyedia telah habis (Rate Limit 429). Silakan tunggu beberapa saat.");
        }
        throw new Error(`AI Provider Error: ${err?.message || err}`);
      }
    }

    throw new Error("Layanan AI mandiri (HCNSEC / OpenRouter) tidak dapat dihubungi dan tidak ada cadangan aktif. Periksa konfigurasi di Settings > Secrets.");
  })();

  const timeoutPromise = new Promise<string>((_, reject) => {
    setTimeout(() => reject(new Error("Permintaan AI melebihi batas waktu maksimal. Silakan coba lagi.")), timeoutMs);
  });

  return Promise.race([aiPromise, timeoutPromise]);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust proxy for rate limiter to work correctly behind reverse proxy
  app.set("trust proxy", 1);

  // Set up rate limiting
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

  app.use(express.json());
  app.use("/api/", apiLimiter);
  app.use("/api/ai/", aiLimiter);

  // Logging middleware for audit trail
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      console.log(`[API Audit] ${new Date().toISOString()} | ${req.method} ${req.path} | IP: ${req.ip}`);
    }
    next();
  });

  // AI Routes
  app.post("/api/ai/zettelkasten", async (req, res) => {
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

  app.post("/api/ai/suggest-tags", async (req, res) => {
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

  app.post("/api/ai/generate-flashcards", async (req, res) => {
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
        timeoutMs: 80000,
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

  app.post("/api/ai/grade-flashcard", async (req, res) => {
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

  app.post("/api/ai/generate-syllabus", async (req, res) => {
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
      1. Title and comprehensive description in Indonesian.
      2. Exactly 3 to 4 sequential pedagogical phases:
         - Phase 1: Fondasi Konseptual & Terminologi Inti
         - Phase 2: Metode, Praktik, & Analisis Inti
         - Phase 3: Implementasi Kritis, Studi Kasus, & Sintesis
         - (Optional) Phase 4: Penguasaan Mandiri & Penerapan Lanjut
      3. Each phase must contain 3 to 5 concrete competencies featuring measurable operational verbs.
 
      Provide all responses in Indonesian.
 
      Respond ONLY with a raw JSON object matching the schema:
      {
        "title": "Judul Jalur Belajar",
        "description": "Deskripsi singkat tujuan kurikulum",
        "phases": [
          {
            "title": "Fase 1: Judul",
            "description": "Deskripsi fase",
            "order": 1,
            "competencies": [
              { "title": "Kompetensi 1", "description": "Deskripsi kompetensi capaian terukur" }
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
        maxTokens: 1600,
        timeoutMs: 90000,
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

  app.post("/api/ai/summarize-literature", async (req, res) => {
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

async function fetchFromOpenLibrary(title: string, author?: string): Promise<OpenLibraryBookResult | null> {
  const cleanTitle = String(title || "").trim();
  const cleanAuthor = String(author || "").trim();

  if (!cleanTitle) return null;

  let bestCoverUrl = "";
  let bestTotalPages = 0;
  let bestAuthor = "";

  const extractFromDocs = (docs: any[]) => {
    for (let i = 0; i < Math.min(docs.length, 10); i++) {
      const doc = docs[i];
      if (!doc) continue;

      if (!bestAuthor && Array.isArray(doc.author_name) && doc.author_name.length > 0 && doc.author_name[0]) {
        bestAuthor = String(doc.author_name[0]).trim();
      }

      if (!bestCoverUrl) {
        if (doc.cover_i) {
          bestCoverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        } else if (Array.isArray(doc.isbn) && doc.isbn.length > 0 && doc.isbn[0]) {
          bestCoverUrl = `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
        }
      }

      if (bestTotalPages === 0) {
        const rawPages = doc.number_of_pages_median ?? doc.number_of_pages ?? 0;
        if (typeof rawPages === "number") {
          bestTotalPages = Math.max(0, Math.round(rawPages));
        } else if (typeof rawPages === "string") {
          bestTotalPages = Math.max(0, parseInt(rawPages, 10) || 0);
        }
      }

      if (bestCoverUrl && bestTotalPages > 0) {
        break;
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

  if (bestCoverUrl || bestTotalPages > 0) {
    return {
      totalPages: bestTotalPages,
      coverUrl: bestCoverUrl,
      author: bestAuthor || undefined,
      isEstimated: false
    };
  }

  return null;
}

  app.post("/api/ai/book-info", async (req, res) => {
    try {
      const { title, author } = req.body;
      const cleanTitle = String(title || "").trim();
      const cleanAuthor = String(author || "").trim();

      if (!cleanTitle) {
        return res.status(400).json({ error: "Judul buku wajib diisi" });
      }

      const cacheKey = getCacheKey("book-info", { title: cleanTitle, author: cleanAuthor });
      
      const cached = aiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Cache Hit] /api/ai/book-info`);
        return res.json(cached.data);
      }

      // Step 1: Direct OpenLibrary API lookup
      const openLibResult = await fetchFromOpenLibrary(cleanTitle, cleanAuthor);
      if (openLibResult) {
        console.log(`[OpenLibrary Hit] Metadata found for "${cleanTitle}":`, openLibResult);
        aiCache.set(cacheKey, { timestamp: Date.now(), data: openLibResult });
        return res.json(openLibResult);
      }

      console.log(`[OpenLibrary Miss] Docs empty for "${cleanTitle}". Proceeding to AI fallback.`);
      
      // Step 2: Fallback to AI estimation
      const systemInstruction = `
      You are the Madrasah Bibliographic Metadata Estimation Engine.
      The Open Library API returned no direct records for "${cleanTitle}".
      Provide an objective estimated page count and optional cover URL for this published work.
      
      Requirements:
      1. Provide a realistic estimated total page count based on typical published or academic editions.
      2. If you know a valid Open Library ISBN or Cover ID, you may provide "https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg" or "https://covers.openlibrary.org/b/id/{cover_id}-L.jpg".
      3. If no verified ISBN or Cover ID is known, return an empty string "" instead of guessing invalid URLs.
      
      Respond ONLY with a raw JSON object matching the schema:
      {"totalPages": 320, "coverUrl": ""}
      `;

      const schema = {
        type: Type.OBJECT,
        properties: {
          totalPages: { type: Type.INTEGER },
          coverUrl: { type: Type.STRING }
        },
        required: ["totalPages", "coverUrl"]
      };

      const text = await executeAIRequest({
        systemInstruction,
        userPrompt: `Title: ${cleanTitle}\nAuthor: ${cleanAuthor || "Unknown"}`,
        jsonMode: true,
        responseSchema: schema,
        temperature: 0.0,
        maxTokens: 250,
        purpose: "book-info"
      });

      const parsed = cleanAndParseJson(text, { totalPages: 0, coverUrl: "" });
      
      let rawPages = parsed.totalPages ?? parsed.total_pages ?? parsed.pages ?? parsed.pageCount ?? 0;
      let totalPages = typeof rawPages === 'number' ? Math.round(rawPages) : parseInt(String(rawPages), 10) || 0;
      if (totalPages < 0) totalPages = 0;

      let coverUrl = typeof parsed.coverUrl === 'string' 
        ? parsed.coverUrl 
        : (parsed.cover_url || parsed.cover || parsed.image_url || parsed.imageUrl || "");

      if (typeof coverUrl === 'string') {
        coverUrl = coverUrl.trim();
        if (!coverUrl.startsWith("http://") && !coverUrl.startsWith("https://")) {
          coverUrl = "";
        }
      } else {
        coverUrl = "";
      }

      const resultData = { totalPages, coverUrl, isEstimated: true };
      
      aiCache.set(cacheKey, { timestamp: Date.now(), data: resultData });
      res.json(resultData);
    } catch (error: any) {
      console.error("AI Book Info Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch book info" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const viteModuleName = "vite";
    const { createServer: createViteServer } = await import(viteModuleName);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
