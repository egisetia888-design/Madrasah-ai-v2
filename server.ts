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
    // Strip markdown code fences if present
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
    console.error("JSON Parsing Error on AI output:", text.substring(0, 150) + "...");
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
  const timeoutMs = options.timeoutMs || 60000;
  
  const aiPromise = (async () => {
    // 1. Check for custom / HCNSEC or OpenAI-compatible Base URL & Key configuration
    const hcnsecApiKey = process.env.HCNSEC_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    const hcnsecBaseUrl = process.env.HCNSEC_BASE_URL || process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || process.env.BASE_URL;
    const hcnsecModel = process.env.HCNSEC_MODEL || process.env.AI_MODEL || "google/gemini-3.8-flash";

    if (hcnsecApiKey || hcnsecBaseUrl) {
      const apiKey = (hcnsecApiKey || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || "").trim();
      const endpoint = formatAIEndpoint(hcnsecBaseUrl);

      const messages = [
        { role: "system", content: options.systemInstruction },
        { role: "user", content: options.userPrompt }
      ];

      const body: any = {
        model: hcnsecModel,
        messages,
        max_tokens: options.maxTokens || 1500
      };

      if (options.jsonMode) {
        body.response_format = { type: "json_object" };
      }

      const hcnsecTimeout = Math.min(timeoutMs, 6000);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), hcnsecTimeout);

      try {
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

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HCNSEC / AI Provider error (${response.status}): ${errText}`);
        }

        const data = await response.json() as any;
        return data.choices?.[0]?.message?.content || "";
      } catch (err: any) {
        clearTimeout(timer);
        console.warn("[AI Provider] HCNSEC call failed, checking fallbacks:", err?.message || err);
        // If user configured HCNSEC explicitly, surface meaningful error if fallbacks are disabled
        if (hcnsecApiKey && !process.env.OPENROUTER_API_KEY && !process.env.GEMINI_API_KEY) {
          throw new Error(`HCNSEC Provider Error: ${err?.message || err}`);
        }
      }
    }

    // 2. OpenRouter provider (if OPENROUTER_API_KEY is configured)
    if (process.env.OPENROUTER_API_KEY) {
      const messages = [
        { role: "system", content: options.systemInstruction },
        { role: "user", content: options.userPrompt }
      ];

      const body: any = {
        model: process.env.OPENROUTER_MODEL || "google/gemini-3.8-flash",
        messages,
        max_tokens: options.maxTokens || 1500
      };

      if (options.jsonMode) {
        body.response_format = { type: "json_object" };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs - 2000);

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
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
          return data.choices?.[0]?.message?.content || "";
        }
        const errText = await response.text();
        console.warn(`[AI Provider] OpenRouter returned ${response.status}: ${errText}`);
      } catch (err: any) {
        clearTimeout(timer);
        console.warn("[AI Provider] OpenRouter request failed:", err?.message || err);
      }
    }

    // 3. Google GenAI SDK fallback (if GEMINI_API_KEY is configured)
    const gemini = getGeminiClient();
    if (gemini) {
      try {
        const config: any = {
          systemInstruction: options.systemInstruction,
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

        const geminiModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
        const response = await gemini.models.generateContent({
          model: geminiModel,
          contents: options.userPrompt,
          config
        });

        if (response.text) {
          return response.text;
        }
      } catch (err: any) {
        console.warn("[AI Provider] Gemini API request failed:", err?.message || err);
        if (err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
          throw new Error("Kuota AI Anda telah habis (Rate Limit 429). Silakan gunakan kunci API baru atau tunggu beberapa saat.");
        }
        throw new Error(`AI Provider Error: ${err?.message || err}`);
      }
    }

    throw new Error("Layanan AI belum dikonfigurasi. Silakan pastikan HCNSEC_API_KEY, OPENROUTER_API_KEY, atau GEMINI_API_KEY tersedia di Settings > Secrets.");
  })();

  const timeoutPromise = new Promise<string>((_, reject) => {
    setTimeout(() => reject(new Error("Permintaan AI melebihi batas waktu (timeout). Silakan coba lagi.")), timeoutMs);
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
      You are a Smart PKOS (Personal Knowledge Operating System) Assistant for Madrasah.
      Your job is to analyze the user's semantic knowledge base and help them:
      1. Trace provenance: Understand how concepts are formed from source fragments and notes.
      2. Find semantic relationships (supports, contradicts, expands) between different knowledge blocks.
      3. Suggest new ideas or identify gaps based on the graph.
      
      User's Context:
      Notes: ${JSON.stringify(sanitizedNotes)}
      Concepts: ${JSON.stringify(sanitizedConcepts)}
      Source Fragments: ${JSON.stringify(sanitizedFragments)}
      Relations: ${JSON.stringify(relations.slice(0, 10))}
      
      Respond directly and helpfully in Indonesian. Format your response cleanly using Markdown. Use citations/provenance where possible.
      `;

      const text = await executeAIRequest({
        systemInstruction,
        userPrompt: String(prompt || '').slice(0, 2000)
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
      You are a Knowledge Taxonomy Assistant. Analyze a new knowledge snippet from the user and:
      1. Suggest 3-5 relevant abstract concepts or tags (short keywords in Indonesian or English).
      2. Suggest 1 most relevant Lucide-react icon name (e.g., 'Brain', 'Book', 'Database', 'FileText', 'Sparkles', 'Layers', 'Code', 'PenTool').
      3. Suggest 1-3 connections to existing notes (return exact titles).
      
      Context references:
      Existing Notes: ${JSON.stringify(sanitizedNotes)}
      Existing Concepts: ${JSON.stringify(sanitizedConcepts)}
      
      Respond ONLY with a raw JSON object matching the schema:
      {"tags": ["tag1", "tag2"], "icon": "Brain", "connections": ["Note Title"]}
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
        responseSchema: schema
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
      You are an expert at creating Spaced Repetition Flashcards. Your job is to analyze the provided note content and extract 5-10 crucial Question & Answer pairs in Indonesian.
      Focus on core concepts, important facts, and principles.
      
      Respond ONLY with a raw JSON object with the "flashcards" array:
      {"flashcards": [{"front": "Pertanyaan...", "back": "Jawaban..."}]}
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
        responseSchema: schema
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
      You are an intelligent Grading Assistant for spaced repetition.
      Evaluate the user's answer based on conceptual understanding, NOT exact word matching.
      If the user's answer demonstrates they understand the core concept of the correct answer, grade it as correct.
      If it's partially correct, give them a lower quality score (e.g., 2 or 3) and explain what they missed.
      If it's completely wrong, grade it as incorrect (quality 0 or 1).
      
      Quality Scale (0-5 integer):
      0: Complete blackout / completely wrong.
      1: Incorrect, but remembered something related.
      2: Incorrect, but it seemed easy to recall the right answer after seeing it.
      3: Correct, but with significant difficulty or partial completeness.
      4: Correct, after some hesitation.
      5: Perfect, fluent recall.
 
      Respond ONLY with a raw JSON object matching the schema:
      {"isCorrect": true, "quality": 4, "feedback": "Penjelasan singkat evaluasi dalam Bahasa Indonesia."}
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
        responseSchema: schema
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
      You are an expert AI Syllabus Planner and Curriculum Designer.
      The user will provide a topic or skill they want to master (e.g., "Dasar-dasar Machine Learning", "Sejarah Filsafat Barat").
      Your job is to generate a structured learning path for this topic, starting from beginner to advanced.
 
      You must break the topic down into 3 to 5 logical 'Phases' (Fase Belajar).
      For each Phase, provide 3 to 6 'Competencies' (Kompetensi/Tugas) that the user needs to achieve.
 
      Provide all responses in Indonesian.
 
      Respond ONLY with a raw JSON object matching the schema:
      {
        "title": "Judul Jalur Belajar",
        "description": "Deskripsi singkat",
        "phases": [
          {
            "title": "Fase 1: Judul",
            "description": "Deskripsi fase",
            "order": 1,
            "competencies": [
              { "title": "Kompetensi 1", "description": "Deskripsi kompetensi" }
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
        responseSchema: schema
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
      You are an expert academic assistant for literature reviews.
      The user will provide the abstract, notes, or full text of an academic paper or book chapter.
      Your task is to summarize the material into exactly 3 key sections in Indonesian:
      1. Masalah Utama (The Main Problem / Core Challenge)
      2. Metodologi (The Methodology / Approach / Argument Structure)
      3. Kesimpulan (The Key Conclusion / Takeaway)
 
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
        responseSchema: schema
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
      You are a smart library metadata assistant acting as a fallback for Madrasah PKOS.
      The Open Library API returned no direct records for "${cleanTitle}".
      Your task is to provide an ESTIMATED total page count and optional cover URL for this book.
      
      CRITICAL INSTRUCTIONS:
      1. Since this is an AI estimate and not an official verified record, provide a realistic estimated total page count.
      2. If you know a valid Open Library ISBN or Cover ID, you may construct "https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg" or "https://covers.openlibrary.org/b/id/{cover_id}-L.jpg".
      3. If you cannot confidently determine the ISBN or Cover ID, return an empty string "" instead of guessing invalid URLs.
      4. Note that results from this pathway will be flagged as an estimate ("isEstimated: true").
      
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
        maxTokens: 500
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
