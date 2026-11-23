import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

dotenv.config();

// Process-level safety net for unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  console.warn('[Process Warning] Handled late unhandled promise rejection:', reason?.message || reason);
});

// =============================================================================
// Bounded LRU Cache (TTL 2 hours, max 500 entries) with SHA-256 Key Hashing
// =============================================================================
const CACHE_TTL = 1000 * 60 * 60 * 2; // 2 hours
const MAX_CACHE_ENTRIES = 500;

class BoundedAICache {
  private store = new Map<string, { timestamp: number; data: any }>();

  get(key: string): any | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp >= CACHE_TTL) {
      this.store.delete(key);
      return null;
    }
    // Refresh LRU recency
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.data;
  }

  set(key: string, data: any): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, { timestamp: Date.now(), data });
  }
}

const aiCache = new BoundedAICache();

function getCacheKey(endpoint: string, payload: unknown): string {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 24);
  return `${endpoint}:${hash}`;
}

// =============================================================================
// Token-Saving Text Compression & Relevance Pruning Utilities
// =============================================================================
function compactText(input: unknown, maxChars: number): string {
  const normalized = String(input ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, maxChars).trimEnd() + "…";
}

function headTailExcerpt(input: unknown, maxChars: number): string {
  const normalized = String(input ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (normalized.length <= maxChars) return normalized;
  const headLen = Math.floor(maxChars * 0.65);
  const tailLen = Math.max(0, maxChars - headLen - 7);
  return `${normalized.slice(0, headLen).trimEnd()}\n[...]\n${normalized.slice(normalized.length - tailLen).trimStart()}`;
}

const STOPWORDS = new Set([
  "yang", "dan", "atau", "dari", "pada", "untuk", "dengan", "dalam", "adalah",
  "ini", "itu", "apa", "bagaimana", "mengapa", "jelaskan", "tentang", "antara",
  "the", "and", "for", "with", "that", "this", "from", "what", "how", "why"
]);

function extractQueryKeywords(prompt: string): string[] {
  return [...new Set(
    prompt
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  )].slice(0, 16);
}

function scoreKeywordMatch(keywords: string[], ...fields: unknown[]): number {
  if (keywords.length === 0) return 0;
  let score = 0;
  fields.forEach((field, idx) => {
    const text = String(field ?? "").toLowerCase();
    if (!text) return;
    const weight = idx === 0 ? 3 : 1; // Title/name weighted 3x
    for (const kw of keywords) {
      if (text.includes(kw)) score += weight;
    }
  });
  return score;
}

function selectRelevantZettelkastenContext(
  prompt: string,
  notes: any[],
  concepts: any[],
  fragments: any[],
  relations: any[]
) {
  const keywords = extractQueryKeywords(prompt);

  const safeNotes = Array.isArray(notes) ? notes : [];
  const rankedNotes = safeNotes
    .map((n, index) => ({
      n,
      score: scoreKeywordMatch(keywords, n?.title, n?.content),
      recency: Number(n?.updatedAt || n?.createdAt || 0),
      index,
    }))
    .sort((a, b) => b.score - a.score || b.recency - a.recency || a.index - b.index)
    .slice(0, 6)
    .map(({ n }) => ({
      id: String(n?.id || ""),
      t: compactText(n?.title, 80),
      c: compactText(n?.content, 350),
    }));

  const safeConcepts = Array.isArray(concepts) ? concepts : [];
  const rankedConcepts = safeConcepts
    .map((c, index) => ({
      c,
      score: scoreKeywordMatch(keywords, c?.name, c?.definition),
      index,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 6)
    .map(({ c }) => ({
      id: String(c?.id || ""),
      n: compactText(c?.name, 60),
      d: compactText(c?.definition, 180),
    }));

  const safeFragments = Array.isArray(fragments) ? fragments : [];
  const rankedFragments = safeFragments
    .map((f, index) => ({
      f,
      score: scoreKeywordMatch(keywords, f?.quote, f?.context),
      index,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 5)
    .map(({ f }) => ({
      q: compactText(f?.quote, 220),
      ctx: compactText(f?.context, 100),
    }));

  const selectedIds = new Set([
    ...rankedNotes.map((n) => n.id),
    ...rankedConcepts.map((c) => c.id),
  ].filter(Boolean));

  const safeRelations = Array.isArray(relations) ? relations : [];
  const rankedRelations = safeRelations
    .filter((r) => selectedIds.has(String(r?.sourceNodeId || "")) || selectedIds.has(String(r?.targetNodeId || "")))
    .concat(safeRelations)
    .filter((r, idx, arr) => arr.indexOf(r) === idx)
    .slice(0, 8)
    .map((r) => ({
      s: String(r?.sourceNodeId || ""),
      t: String(r?.targetNodeId || ""),
      type: compactText(r?.relationType || r?.type, 30),
    }));

  return {
    notes: rankedNotes,
    concepts: rankedConcepts,
    fragments: rankedFragments,
    relations: rankedRelations,
  };
}

// =============================================================================
// JSON Recovery Utilities
// =============================================================================
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
  if (inString) {
    repaired += '"';
  }

  repaired = repaired.trim();
  repaired = repaired.replace(/,\s*$/, '');
  repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*$/, '');
  repaired = repaired.replace(/,\s*"[^"]*"\s*$/, '');

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
    cleanText = cleanText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```[a-zA-Z0-9_-]*\n?/, "");
      if (cleanText.endsWith("```")) {
        cleanText = cleanText.slice(0, -3);
      }
    }
    cleanText = cleanText.trim();

    try {
      return JSON.parse(cleanText);
    } catch (directErr) {
      const firstBrace = cleanText.indexOf('{');
      const firstBracket = cleanText.indexOf('[');
      let candidate = cleanText;
      if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        candidate = cleanText.substring(firstBrace);
      } else if (firstBracket !== -1) {
        candidate = cleanText.substring(firstBracket);
      }

      try {
        const repaired = repairTruncatedJson(candidate);
        const sanitized = repaired
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        return JSON.parse(sanitized);
      } catch {
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
  } catch {
    if (fallback !== null) {
      console.error("JSON Parsing Error on AI output:", text.substring(0, 150) + "...");
    }
    return fallback;
  }
}

// =============================================================================
// Pure Google Gemini (@google/genai) Hybrid Engine
// =============================================================================
const GEMINI_LITE_MODEL = "gemini-3.1-flash-lite";
const GEMINI_SYNTHESIS_MODEL = "gemini-4-hydrogen";

const DEPRECATED_MODELS = new Set([
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.0-pro",
  "gemini-2.0-flash-thinking",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
]);

let loggedLegacyModelOverride = false;

function normalizeModelName(model: string): string {
  return model.trim().replace(/^models\//i, "");
}

function isLegacyOrUnsupportedModel(model: string): boolean {
  const lower = normalizeModelName(model).toLowerCase();
  if (!lower) return true;
  if (DEPRECATED_MODELS.has(lower)) return true;
  if (/^gemini-(1|2)(\.|$|-)/i.test(lower)) return true;
  return false;
}

let genAIClient: GoogleGenAI | null = null;
let cachedApiKey = "";

function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi. Periksa pengaturan di Settings > Secrets.");
  }
  if (!genAIClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

type AIModelTier = "lite" | "synthesis";

interface AICallOptions {
  systemInstruction: string;
  userPrompt: string;
  jsonMode?: boolean;
  responseSchema?: any;
  timeoutMs?: number;
  modelTier: AIModelTier;
  purpose: string;
}

function resolveCandidateModels(tier: AIModelTier): string[] {
  const rawOverride = normalizeModelName(process.env.GEMINI_MODEL || "");
  const primary = tier === "lite" ? GEMINI_LITE_MODEL : GEMINI_SYNTHESIS_MODEL;
  const secondary = tier === "lite" ? GEMINI_SYNTHESIS_MODEL : GEMINI_LITE_MODEL;

  const models: string[] = [];
  if (rawOverride) {
    if (isLegacyOrUnsupportedModel(rawOverride)) {
      if (!loggedLegacyModelOverride) {
        loggedLegacyModelOverride = true;
        console.info(`[Google Gemini] Abaikan GEMINI_MODEL usang "${rawOverride}", gunakan model resmi ${primary}.`);
      }
    } else {
      models.push(rawOverride);
    }
  }
  if (!models.includes(primary)) models.push(primary);
  if (!models.includes(secondary)) models.push(secondary);
  return models;
}

function getThinkingConfigForModel(model: string) {
  const lower = model.toLowerCase();
  if (lower.includes("flash-lite")) {
    return { thinkingLevel: ThinkingLevel.MINIMAL };
  }
  if (lower.startsWith("gemini-4") || lower.startsWith("gemini-3")) {
    return { thinkingLevel: ThinkingLevel.LOW };
  }
  return undefined;
}

function isQuotaError(err: any): boolean {
  const msg = String(err?.message || err || "");
  return err?.status === 429 || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
}

function isTimeoutOrAbortError(err: any): boolean {
  const msg = String(err?.message || err || "");
  return (
    err?.name === "AbortError" ||
    /abort|timed?\s*out|timeout|ETIMEDOUT/i.test(msg)
  );
}

function isTransientError(err: any): boolean {
  const msg = String(err?.message || err || "");
  return (
    err?.status === 503 ||
    err?.status === 500 ||
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    /ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(msg)
  );
}

function isAuthError(err: any): boolean {
  const msg = String(err?.message || err || "");
  return (
    err?.status === 401 ||
    err?.status === 403 ||
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("API_KEY_INVALID") ||
    msg.includes("API key not valid")
  );
}

async function executeAIRequest(options: AICallOptions): Promise<string> {
  const timeoutMs = options.timeoutMs || 45000;
  const gemini = getGeminiClient();
  const candidateModels = resolveCandidateModels(options.modelTier);
  const startedAt = Date.now();
  let activeController: AbortController | null = null;

  const aiPromise = (async () => {
    let lastError: any = null;

    for (let i = 0; i < candidateModels.length; i++) {
      const model = candidateModels[i];
      const thinkingConfig = getThinkingConfigForModel(model);
      const hasFallbackModel = i < candidateModels.length - 1;

      // Exponential backoff for transient 503/network spikes (max 2 attempts per model)
      for (let attempt = 0; attempt < 2; attempt++) {
        const elapsedMs = Date.now() - startedAt;
        const remainingMs = timeoutMs - elapsedMs;
        if (remainingMs <= 1000) {
          throw new Error("Permintaan AI melebihi batas waktu maksimal. Silakan coba lagi.");
        }

        const attemptTimeoutMs = hasFallbackModel
          ? Math.min(20000, Math.max(7000, Math.floor(remainingMs * 0.55)))
          : Math.max(2000, remainingMs - 400);

        const controller = new AbortController();
        activeController = controller;
        const attemptTimer = setTimeout(() => controller.abort(), attemptTimeoutMs);

        try {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 700 * attempt));
          }

          const config: any = {
            systemInstruction: options.systemInstruction,
            abortSignal: controller.signal,
          };
          if (thinkingConfig) {
            config.thinkingConfig = thinkingConfig;
          }
          if (options.jsonMode) {
            config.responseMimeType = "application/json";
            if (options.responseSchema) {
              config.responseSchema = options.responseSchema;
            }
          }

          const response = await gemini.models.generateContent({
            model,
            contents: options.userPrompt,
            config,
          });
          clearTimeout(attemptTimer);

          const text = response.text;
          if (!text || !text.trim()) {
            throw new Error("Respons AI kosong.");
          }

          if (options.jsonMode) {
            const parsed = cleanAndParseJson(text, null);
            if (parsed === null) {
              throw new Error("Format JSON dari model tidak valid.");
            }
            console.log(`[Google Gemini] Served (${options.purpose}) via ${model}`);
            return JSON.stringify(parsed);
          }

          console.log(`[Google Gemini] Served (${options.purpose}) via ${model}`);
          return text;
        } catch (err: any) {
          clearTimeout(attemptTimer);
          const timedOutAttempt = controller.signal.aborted || isTimeoutOrAbortError(err);
          lastError = timedOutAttempt
            ? Object.assign(new Error(`Permintaan ke ${model} melebihi batas waktu (${Math.round(attemptTimeoutMs / 1000)}d).`), { name: "AbortError" })
            : err;
          console.warn(`[Google Gemini] ${model} (attempt ${attempt + 1}) failed for ${options.purpose}:`, lastError?.message || lastError);

          if (isAuthError(err)) {
            throw new Error("Kunci API Google Gemini tidak valid atau ditolak. Periksa GEMINI_API_KEY di Settings > Secrets.");
          }

          // On timeout for this model, skip retrying the same slow model and immediately fail over to the next candidate model
          if (timedOutAttempt) {
            break;
          }

          if (isTransientError(err) && attempt === 0) {
            continue;
          }
          break;
        }
      }

      if (
        lastError &&
        !isTimeoutOrAbortError(lastError) &&
        !isQuotaError(lastError) &&
        !isTransientError(lastError) &&
        !String(lastError?.message || "").includes("404") &&
        !String(lastError?.message || "").includes("NOT_FOUND") &&
        !String(lastError?.message || "").includes("JSON")
      ) {
        break;
      }
    }

    if (lastError) {
      if (isTimeoutOrAbortError(lastError)) {
        throw new Error("Permintaan AI melebihi batas waktu maksimal. Silakan coba lagi.");
      }
      if (isQuotaError(lastError)) {
        throw new Error("Kuota Google Gemini API sedang mencapai batas (Rate Limit 429). Silakan tunggu beberapa saat atau periksa kuota di Settings > Secrets.");
      }
      if (isTransientError(lastError)) {
        throw new Error("Layanan Google Gemini sedang mengalami lonjakan beban (503). Silakan coba sesaat lagi.");
      }
      throw new Error(`Google Gemini Error: ${lastError?.message || lastError}`);
    }

    throw new Error("Gagal memproses permintaan Google Gemini.");
  })();

  let isSettled = false;
  let timeoutTimer: any = null;

  const timeoutPromise = new Promise<string>((_, reject) => {
    timeoutTimer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        activeController?.abort();
        reject(new Error("Permintaan AI melebihi batas waktu maksimal. Silakan coba lagi."));
      }
    }, timeoutMs);
  });

  aiPromise.catch((err) => {
    if (isSettled) {
      console.debug("[Google Gemini] Late background error absorbed:", err?.message || err);
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

// AI Routes (100% Google Gemini Hybrid Architecture)
  apiRouter.post("/ai/zettelkasten", async (req, res) => {
    try {
      const { prompt, notes = [], concepts = [], fragments = [], relations = [] } = req.body;
      const cleanPrompt = compactText(prompt, 1200);
      if (!cleanPrompt) {
        return res.status(400).json({ error: "Pertanyaan tidak boleh kosong." });
      }

      const ctx = selectRelevantZettelkastenContext(cleanPrompt, notes, concepts, fragments, relations);
      const cacheKey = getCacheKey("zettelkasten", { prompt: cleanPrompt.toLowerCase(), ctx });

      const cached = aiCache.get(cacheKey);
      if (cached) {
        console.log(`[Cache Hit] /api/ai/zettelkasten`);
        return res.json(cached);
      }

      const systemInstruction = `Mesin Sintesis Pengetahuan Madrasah (prinsip ta'dib).
Tugas:
1. Sintesis konsep berbasis catatan, konsep, dan kutipan yang diberikan.
2. Identifikasi relasi atau kontradiksi antar gagasan.
3. Tunjukkan celah logis atau arah pendalaman.
Aturan:
- Bahasa Indonesia Markdown ringkas dan analitis (maksimal ~350 kata, tanpa basa-basi).
- Kutip judul catatan/sumber persis bila merujuk.
Konteks: ${JSON.stringify(ctx)}`;

      const text = await executeAIRequest({
        systemInstruction,
        userPrompt: cleanPrompt,
        modelTier: "synthesis",
        purpose: "zettelkasten"
      });

      const resultData = { result: text };
      aiCache.set(cacheKey, resultData);
      res.json(resultData);
    } catch (error: any) {
      console.error("AI Assistant Error:", error);
      res.status(500).json({ error: error.message || "Failed to process AI request" });
    }
  });

  apiRouter.post("/ai/suggest-tags", async (req, res) => {
    try {
      const { content, notes = [], concepts = [] } = req.body;
      const sanitizedContent = headTailExcerpt(content, 2200);
      if (!sanitizedContent) {
        return res.status(400).json({ error: "Konten tidak boleh kosong." });
      }

      const noteTitles = Array.isArray(notes)
        ? notes.slice(0, 15).map((n: any) => compactText(n?.title, 60)).filter(Boolean)
        : [];
      const conceptNames = Array.isArray(concepts)
        ? concepts.slice(0, 12).map((c: any) => compactText(c?.name, 40)).filter(Boolean)
        : [];

      const cacheKey = getCacheKey("suggest-tags", { content: sanitizedContent, noteTitles, conceptNames });

      const cached = aiCache.get(cacheKey);
      if (cached) {
        console.log(`[Cache Hit] /api/ai/suggest-tags`);
        return res.json(cached);
      }

      const systemInstruction = `Ekstraktor Taksonomi Madrasah. Hasilkan JSON ketat:
1. tags: 3-5 kata kunci huruf kecil tanpa '#' dan tanpa spasi dalam satu tag.
2. icon: pilih 1 dari ['Brain','BookOpen','Bookmark','FileText','Lightbulb','Layers','Sparkles','Compass','Search','Archive','Code','PenTool','Scale','Shield','Target','Folder','GraduationCap'].
3. connections: 0-3 judul persis dari daftar Catatan jika relevan secara langsung.
Catatan: ${JSON.stringify(noteTitles)}
Konsep: ${JSON.stringify(conceptNames)}`;

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
        userPrompt: sanitizedContent,
        jsonMode: true,
        responseSchema: schema,
        modelTier: "lite",
        purpose: "suggest-tags"
      });

      const parsed = cleanAndParseJson(text, { tags: [], icon: "FileText", connections: [] });
      const rawTags = Array.isArray(parsed.tags) ? parsed.tags : [];
      const tags = rawTags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 5);

      let icon = typeof parsed.icon === 'string' ? parsed.icon.replace(/[^a-zA-Z]/g, '') : 'FileText';
      if (!icon) icon = 'FileText';

      const rawConns = Array.isArray(parsed.connections) ? parsed.connections : [];
      const connections = rawConns.map((c: any) => String(c).trim()).filter(Boolean).slice(0, 3);

      const resultData = { tags, icon, connections };
      aiCache.set(cacheKey, resultData);
      res.json(resultData);
    } catch (error: any) {
      console.error("AI Suggestion Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate suggestions" });
    }
  });

  apiRouter.post("/ai/generate-flashcards", async (req, res) => {
    try {
      const { content } = req.body;
      const sanitizedContent = headTailExcerpt(content, 4500);
      if (!sanitizedContent) {
        return res.status(400).json({ error: "Konten catatan tidak boleh kosong." });
      }

      const cacheKey = getCacheKey("generate-flashcards", { content: sanitizedContent });

      const cached = aiCache.get(cacheKey);
      if (cached) {
        console.log(`[Cache Hit] /api/ai/generate-flashcards`);
        return res.json(cached);
      }

      const systemInstruction = `Mesin Flashcard Spaced Repetition Madrasah (Prinsip Minimum Information SuperMemo).
Buat 5-7 pasang Q&A active recall berbahasa Indonesia dalam JSON:
- 1 konsep atomik per kartu.
- front: pertanyaan singkat, spesifik, fokus pada prinsip/definisi/mekanisme.
- back: jawaban padat dan faktual (1-2 kalimat).`;

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
        userPrompt: sanitizedContent,
        jsonMode: true,
        responseSchema: schema,
        timeoutMs: 48000,
        modelTier: "synthesis",
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
      aiCache.set(cacheKey, resultData);
      res.json(resultData);
    } catch (error: any) {
      console.error("AI Flashcard Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate flashcards" });
    }
  });

  apiRouter.post("/ai/grade-flashcard", async (req, res) => {
    try {
      const { question, correctAnswer, userAnswer } = req.body;
      const cleanQuestion = compactText(question, 500);
      const cleanCorrect = compactText(correctAnswer, 800);
      const cleanUser = compactText(userAnswer, 800);

      const cacheKey = getCacheKey("grade-flashcard", {
        q: cleanQuestion,
        a: cleanCorrect,
        u: cleanUser.toLowerCase(),
      });

      const cached = aiCache.get(cacheKey);
      if (cached) {
        console.log(`[Cache Hit] /api/ai/grade-flashcard`);
        return res.json(cached);
      }

      const systemInstruction = `Penilai Semantik SuperMemo-2 (SM-2). Nilai kesetaraan makna (bukan kesamaan literal).
Skala quality (0-5): 5=sempurna, 4=tepat kurang minor, 3=parsial paham inti, 2=salah tapi ada pengenalan istilah, 1=salah total, 0=kosong/tidak relevan.
feedback: 1-2 kalimat objektif berbahasa Indonesia (tanpa basa-basi).`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          isCorrect: { type: Type.BOOLEAN },
          quality: { type: Type.INTEGER },
          feedback: { type: Type.STRING }
        },
        required: ["isCorrect", "quality", "feedback"]
      };

      const text = await executeAIRequest({
        systemInstruction,
        userPrompt: `Q: ${cleanQuestion}\nKunci: ${cleanCorrect}\nJawaban: ${cleanUser}`,
        jsonMode: true,
        responseSchema: schema,
        modelTier: "lite",
        purpose: "grade-flashcard"
      });

      const parsed = cleanAndParseJson(text, { isCorrect: false, quality: 1, feedback: "Jawaban perlu diperdalam lagi." });

      const rawQuality = parsed.quality ?? parsed.score ?? parsed.rating ?? (parsed.isCorrect ? 4 : 1);
      let quality = typeof rawQuality === 'number' ? Math.round(rawQuality) : parseInt(String(rawQuality), 10);
      if (isNaN(quality)) quality = (parsed.isCorrect || parsed.correct) ? 4 : 1;
      quality = Math.max(0, Math.min(5, quality));

      const isCorrect = typeof parsed.isCorrect === 'boolean'
        ? parsed.isCorrect
        : (typeof parsed.correct === 'boolean' ? parsed.correct : quality >= 3);
      const feedback = String(parsed.feedback || parsed.explanation || parsed.ulasan || (isCorrect ? 'Jawaban Anda tepat.' : 'Jawaban belum tepat.')).trim();

      const resultData = { isCorrect, quality, feedback };
      aiCache.set(cacheKey, resultData);
      res.json(resultData);
    } catch (error: any) {
      console.error("AI Grading Error:", error);
      res.status(500).json({ error: error.message || "Failed to grade answer" });
    }
  });

  apiRouter.post("/ai/generate-syllabus", async (req, res) => {
    try {
      const { topic } = req.body;
      const cleanTopic = compactText(topic, 300);
      if (!cleanTopic) {
        return res.status(400).json({ error: "Topik kurikulum wajib diisi." });
      }

      const cacheKey = getCacheKey("generate-syllabus", { topic: cleanTopic.toLowerCase() });

      const cached = aiCache.get(cacheKey);
      if (cached) {
        console.log(`[Cache Hit] /api/ai/generate-syllabus`);
        return res.json(cached);
      }

      const systemInstruction = `Perancang Kurikulum Madrasah (Taksonomi Bloom) berbahasa Indonesia.
Kembalikan HANYA objek JSON valid berbentuk:
{
  "title": "Judul kurikulum singkat",
  "description": "Deskripsi 1 kalimat",
  "phases": [
    {
      "title": "Nama fase",
      "description": "Ringkasan fase 1 kalimat",
      "order": 1,
      "competencies": [
        { "title": "Nama kompetensi", "description": "Deskripsi padat maks 12 kata" }
      ]
    }
  ]
}
Aturan:
- Tepat 3 fase berurutan (1: Fondasi, 2: Metode & Praktik, 3: Sintesis Terapan).
- Tiap fase berisi 3-4 kompetensi terukur dan ringkas.`;

      const text = await executeAIRequest({
        systemInstruction,
        userPrompt: `Topik: ${cleanTopic}`,
        jsonMode: true,
        timeoutMs: 45000,
        modelTier: "synthesis",
        purpose: "generate-syllabus"
      });

      const parsed = cleanAndParseJson(text, { title: cleanTopic, description: "Silabus pembelajaran komprehensif.", phases: [] });

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
      }).filter((p: any) => Boolean(p.title) && p.competencies.length > 0);

      if (phases.length === 0) {
        throw new Error("Format silabus dari AI tidak lengkap. Silakan coba lagi.");
      }

      const resultData = {
        title: String(parsed.title || parsed.name || cleanTopic).trim(),
        description: String(parsed.description || parsed.deskripsi || `Panduan belajar untuk ${cleanTopic}`).trim(),
        phases
      };

      aiCache.set(cacheKey, resultData);
      res.json(resultData);
    } catch (error: any) {
      console.error("AI Syllabus Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate syllabus" });
    }
  });

  apiRouter.post("/ai/summarize-literature", async (req, res) => {
    try {
      const { content } = req.body;
      const sanitizedContent = headTailExcerpt(content, 4500);
      if (!sanitizedContent) {
        return res.status(400).json({ error: "Konten literatur tidak boleh kosong." });
      }

      const cacheKey = getCacheKey("summarize-literature", { content: sanitizedContent });

      const cached = aiCache.get(cacheKey);
      if (cached) {
        console.log(`[Cache Hit] /api/ai/summarize-literature`);
        return res.json(cached);
      }

      const systemInstruction = `Mesin Telaah Literatur Madrasah. Sarikan isi bacaan menjadi 3 pilar berbahasa Indonesia (2-3 kalimat padat per pilar) dalam JSON:
1. mainProblem: masalah/pertanyaan sentral.
2. methodology: kerangka/metode argumen.
3. conclusion: tesis inti & implikasi.`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          mainProblem: { type: Type.STRING },
          methodology: { type: Type.STRING },
          conclusion: { type: Type.STRING }
        },
        required: ["mainProblem", "methodology", "conclusion"]
      };

      const text = await executeAIRequest({
        systemInstruction,
        userPrompt: sanitizedContent,
        jsonMode: true,
        responseSchema: schema,
        modelTier: "lite",
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

      aiCache.set(cacheKey, resultData);
      res.json(resultData);
    } catch (error: any) {
      console.error("AI Literature Summarizer Error:", error);
      res.status(500).json({ error: error.message || "Failed to summarize literature" });
    }
  });

interface BookCandidate {
  id: string;
  title: string;
  author?: string;
  isbn?: string;
  totalPages: number;
  coverUrl: string;
  publisher?: string;
  publishedYear?: string;
  source: "Open Library" | "Google Books" | "Penelusuran AI";
  isEstimated: boolean;
  matchScore: number;
}

function normalizeIsbn(raw: unknown): string {
  return String(raw || "")
    .replace(/[^0-9Xx]/g, "")
    .toUpperCase()
    .slice(0, 13);
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

const DERIVATIVE_BOOK_TERMS = [
  "summary",
  "workbook",
  "study guide",
  "key takeaways",
  "companion",
  "analysis of",
  "ringkasan",
  "intisari",
  "for teens",
  "for kids",
  "coloring book",
  "trivia",
];

function computeTitleMatchScore(queryTitle: string, candidateTitle: string): number {
  const q = normalizeForMatch(queryTitle);
  const c = normalizeForMatch(candidateTitle);
  if (!q || !c) return 0;
  if (q === c) return 1;

  // Subtitle match e.g. "Atomic Habits" vs "Atomic Habits: An Easy & Proven Way..."
  const rawC = String(candidateTitle || "").toLowerCase().trim();
  if (rawC.startsWith(`${q}:`) || rawC.startsWith(`${q} -`) || rawC.startsWith(`${q} (`)) {
    return 0.92;
  }

  const qWords = q.split(" ").filter((w) => w.length > 1);
  const cWords = c.split(" ").filter((w) => w.length > 1);
  if (qWords.length === 0 || cWords.length === 0) {
    return c.includes(q) ? 0.7 : 0;
  }

  const qSet = new Set(qWords);
  const cSet = new Set(cWords);
  let overlap = 0;
  for (const w of qSet) {
    if (cSet.has(w)) overlap++;
  }

  const queryCoverage = overlap / qSet.size;
  const jaccard = overlap / (qSet.size + cSet.size - overlap);
  let score = queryCoverage * 0.6 + jaccard * 0.4;

  // Penalize derivative/abridged books unless the user explicitly searched for those terms
  const hasDerivativePenalty = DERIVATIVE_BOOK_TERMS.some(
    (term) => c.includes(term) && !q.includes(term)
  );
  if (hasDerivativePenalty) {
    score -= 0.55;
  }

  return Math.max(0, Math.min(0.99, score));
}

function computeAuthorMatchScore(queryAuthor: string, candidateAuthors: string[]): number {
  const q = normalizeForMatch(queryAuthor);
  if (!q) return 0;
  if (!candidateAuthors || candidateAuthors.length === 0) return -0.15;

  const qWords = q.split(" ").filter((w) => w.length > 1);
  let best = 0;

  for (const rawCandidate of candidateAuthors) {
    const c = normalizeForMatch(rawCandidate);
    if (!c) continue;
    if (c === q) return 1;
    if (c.includes(q) || q.includes(c)) {
      best = Math.max(best, 0.9);
      continue;
    }
    const cSet = new Set(c.split(" ").filter((w) => w.length > 1));
    if (qWords.length > 0 && cSet.size > 0) {
      let overlap = 0;
      for (const w of qWords) {
        if (cSet.has(w)) overlap++;
      }
      best = Math.max(best, overlap / qWords.length);
    }
  }

  return best;
}

function pickPreferredIsbn(isbns: unknown[], queryIsbn: string): string {
  if (!Array.isArray(isbns)) return "";
  const cleaned = isbns
    .map((x) => normalizeIsbn(x))
    .filter((x) => x.length === 10 || x.length === 13);
  if (cleaned.length === 0) return "";
  if (queryIsbn && cleaned.includes(queryIsbn)) return queryIsbn;
  return cleaned.find((x) => x.length === 13) || cleaned[0] || "";
}

function sanitizeCoverUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== "string") return "";
  let url = rawUrl.trim();
  if (!url) return "";
  if (url.startsWith("http://")) {
    url = "https://" + url.slice(7);
  }
  if (!url.startsWith("https://")) return "";
  url = url.replace("&edge=curl", "");
  return url;
}

async function fetchOpenLibrarySearch(params: URLSearchParams, timeoutMs = 6500): Promise<any[]> {
  params.set("fields", "key,title,author_name,cover_i,isbn,number_of_pages_median,number_of_pages,publisher,first_publish_year");
  params.set("limit", "12");
  const queryUrl = `https://openlibrary.org/search.json?${params.toString()}`;
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
    if (!res.ok) return [];
    const data = await res.json() as any;
    return Array.isArray(data?.docs) ? data.docs : [];
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[OpenLibrary] Search failed:`, err?.message || err);
    return [];
  }
}

async function fetchOpenLibraryJson(urlPath: string, timeoutMs = 4500): Promise<any | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://openlibrary.org${urlPath}`, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "MadrasahPKOS/1.0 (https://madrasah.remix)"
      }
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

async function enrichOpenLibraryCandidate(
  candidate: BookCandidate,
  workKey: string,
  queryIsbn: string
): Promise<BookCandidate> {
  if (candidate.totalPages > 0 && candidate.coverUrl) return candidate;

  // Try direct ISBN edition first if available
  const lookupIsbn = queryIsbn || candidate.isbn;
  if (lookupIsbn) {
    const ed = await fetchOpenLibraryJson(`/isbn/${encodeURIComponent(lookupIsbn)}.json`);
    if (ed) {
      const pages = typeof ed.number_of_pages === "number" && ed.number_of_pages > 0
        ? Math.round(ed.number_of_pages)
        : candidate.totalPages;
      const coverId = Array.isArray(ed.covers) ? ed.covers.find((c: any) => typeof c === "number" && c > 0) : null;
      const coverUrl = candidate.coverUrl || (coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false` : "");
      return {
        ...candidate,
        totalPages: pages,
        coverUrl,
        publisher: candidate.publisher || (Array.isArray(ed.publishers) && ed.publishers[0] ? String(ed.publishers[0]) : undefined),
        publishedYear: candidate.publishedYear || (String(ed.publish_date || "").match(/\d{4}/)?.[0] || undefined),
      };
    }
  }

  // Try work editions list to recover page count & cover
  if (workKey && workKey.startsWith("/works/")) {
    const edList = await fetchOpenLibraryJson(`${workKey}/editions.json?limit=6`);
    const entries: any[] = Array.isArray(edList?.entries) ? edList.entries : [];
    for (const entry of entries) {
      const pages = typeof entry?.number_of_pages === "number" && entry.number_of_pages > 0
        ? Math.round(entry.number_of_pages)
        : 0;
      const coverId = Array.isArray(entry?.covers) ? entry.covers.find((c: any) => typeof c === "number" && c > 0) : null;
      const entryIsbn = pickPreferredIsbn([...(entry?.isbn_13 || []), ...(entry?.isbn_10 || [])], queryIsbn);
      if (pages > 0 || coverId) {
        return {
          ...candidate,
          totalPages: candidate.totalPages || pages,
          coverUrl: candidate.coverUrl || (coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false` : ""),
          isbn: candidate.isbn || (entryIsbn || undefined),
          publisher: candidate.publisher || (Array.isArray(entry?.publishers) && entry.publishers[0] ? String(entry.publishers[0]) : undefined),
          publishedYear: candidate.publishedYear || (String(entry?.publish_date || "").match(/\d{4}/)?.[0] || undefined),
        };
      }
    }
  }

  return candidate;
}

async function fetchCandidatesFromOpenLibrary(
  title: string,
  author: string,
  isbn: string
): Promise<BookCandidate[]> {
  let docs: any[] = [];

  if (isbn) {
    const p = new URLSearchParams({ isbn });
    docs = await fetchOpenLibrarySearch(p);
  }

  if (docs.length === 0 && title) {
    const p = new URLSearchParams({ title });
    if (author) p.set("author", author);
    docs = await fetchOpenLibrarySearch(p);
  }

  if (docs.length === 0 && title) {
    const q = author ? `${title} ${author}` : title;
    const p = new URLSearchParams({ q });
    docs = await fetchOpenLibrarySearch(p);
  }

  const matched: Array<{ candidate: BookCandidate; workKey: string }> = [];
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    if (!doc?.title) continue;

    const docIsbns = Array.isArray(doc.isbn) ? doc.isbn : [];
    const preferredIsbn = pickPreferredIsbn(docIsbns, isbn);
    const exactIsbnHit = Boolean(isbn && docIsbns.some((x: any) => normalizeIsbn(x) === isbn));

    const titleScore = title ? computeTitleMatchScore(title, String(doc.title)) : 1;
    const candidateAuthors: string[] = Array.isArray(doc.author_name)
      ? doc.author_name.map((a: any) => String(a || "").trim()).filter(Boolean)
      : [];
    const authorScore = author ? computeAuthorMatchScore(author, candidateAuthors) : 0;

    if (!exactIsbnHit) {
      if (title && titleScore < 0.48) continue;
      if (author && authorScore < 0.35) continue;
    }

    const rawPages = doc.number_of_pages_median ?? doc.number_of_pages ?? 0;
    const totalPages = typeof rawPages === "number"
      ? Math.max(0, Math.round(rawPages))
      : Math.max(0, parseInt(String(rawPages), 10) || 0);

    let coverUrl = "";
    if (doc.cover_i) {
      coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false`;
    } else if (preferredIsbn) {
      coverUrl = `https://covers.openlibrary.org/b/isbn/${preferredIsbn}-L.jpg?default=false`;
    }

    const completenessBonus = (totalPages > 0 ? 0.14 : 0) + (coverUrl ? 0.12 : 0);
    const matchScore = (exactIsbnHit ? 2.0 : titleScore + authorScore * 0.45) + completenessBonus;

    matched.push({
      workKey: String(doc.key || ""),
      candidate: {
        id: `ol-${doc.key || preferredIsbn || i}`,
        title: String(doc.title).trim(),
        author: candidateAuthors[0] || undefined,
        isbn: preferredIsbn || undefined,
        totalPages,
        coverUrl,
        publisher: Array.isArray(doc.publisher) && doc.publisher[0] ? String(doc.publisher[0]).trim() : undefined,
        publishedYear: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
        source: "Open Library",
        isEstimated: false,
        matchScore,
      },
    });
  }

  matched.sort((a, b) => b.candidate.matchScore - a.candidate.matchScore);
  const topSubset = matched.slice(0, 5);
  return Promise.all(
    topSubset.map((entry, idx) =>
      idx < 2 && entry.candidate.totalPages === 0
        ? enrichOpenLibraryCandidate(entry.candidate, entry.workKey, isbn)
        : Promise.resolve(entry.candidate)
    )
  );
}

async function fetchGoogleBooksRaw(rawQuery: string, timeoutMs = 6500): Promise<any[]> {
  const queryUrl = `https://www.googleapis.com/books/v1/volumes?q=${rawQuery}&maxResults=10&printType=books`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(queryUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data = await res.json() as any;
    return Array.isArray(data?.items) ? data.items : [];
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[GoogleBooks] Search failed:`, err?.message || err);
    return [];
  }
}

async function fetchCandidatesFromGoogleBooks(
  title: string,
  author: string,
  isbn: string
): Promise<BookCandidate[]> {
  let items: any[] = [];

  if (isbn) {
    items = await fetchGoogleBooksRaw(`isbn:${encodeURIComponent(isbn)}`);
  }

  if (items.length === 0 && title) {
    const parts: string[] = [`intitle:${encodeURIComponent(`"${title}"`)}`];
    if (author) parts.push(`inauthor:${encodeURIComponent(`"${author}"`)}`);
    items = await fetchGoogleBooksRaw(parts.join("+"));
  }

  if (items.length === 0 && title) {
    const parts: string[] = [`intitle:${encodeURIComponent(title)}`];
    if (author) parts.push(`inauthor:${encodeURIComponent(author)}`);
    items = await fetchGoogleBooksRaw(parts.join("+"));
  }

  const results: BookCandidate[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const vol = item?.volumeInfo;
    if (!vol?.title) continue;

    const identifiers = Array.isArray(vol.industryIdentifiers)
      ? vol.industryIdentifiers.map((idObj: any) => idObj?.identifier)
      : [];
    const preferredIsbn = pickPreferredIsbn(identifiers, isbn);
    const exactIsbnHit = Boolean(isbn && identifiers.some((x: any) => normalizeIsbn(x) === isbn));

    const titleScore = title ? computeTitleMatchScore(title, String(vol.title)) : 1;
    const candidateAuthors: string[] = Array.isArray(vol.authors)
      ? vol.authors.map((a: any) => String(a || "").trim()).filter(Boolean)
      : [];
    const authorScore = author ? computeAuthorMatchScore(author, candidateAuthors) : 0;

    if (!exactIsbnHit) {
      if (title && titleScore < 0.48) continue;
      if (author && authorScore < 0.35) continue;
    }

    const totalPages = typeof vol.pageCount === "number" && vol.pageCount > 0
      ? Math.round(vol.pageCount)
      : 0;
    const coverUrl = sanitizeCoverUrl(vol.imageLinks?.thumbnail || vol.imageLinks?.smallThumbnail || "");
    const yearMatch = String(vol.publishedDate || "").match(/\d{4}/);
    const completenessBonus = (totalPages > 0 ? 0.16 : 0) + (coverUrl ? 0.14 : 0);
    const matchScore = (exactIsbnHit ? 2.05 : titleScore + authorScore * 0.45) + completenessBonus;

    results.push({
      id: `gb-${item.id || preferredIsbn || i}`,
      title: String(vol.title).trim(),
      author: candidateAuthors[0] || undefined,
      isbn: preferredIsbn || undefined,
      totalPages,
      coverUrl,
      publisher: vol.publisher ? String(vol.publisher).trim() : undefined,
      publishedYear: yearMatch ? yearMatch[0] : undefined,
      source: "Google Books",
      isEstimated: false,
      matchScore,
    });
  }

  return results;
}

let groundingQuotaCooldownUntil = 0;

function parseAiBookCandidates(
  rawJsonText: string,
  fallbackTitle: string,
  fallbackAuthor: string,
  fallbackIsbn: string
): BookCandidate[] {
  const parsed = cleanAndParseJson(rawJsonText, { candidates: [] });
  const rawList = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  const candidates: BookCandidate[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const c = rawList[i];
    if (!c || typeof c !== "object") continue;
    const cTitle = String(c.title || fallbackTitle || "").trim();
    if (!cTitle) continue;

    const cAuthor = typeof c.author === "string" ? c.author.trim() : "";
    const cIsbn = normalizeIsbn(c.isbn);
    const rawPages = c.totalPages ?? c.pageCount ?? 0;
    const totalPages = typeof rawPages === "number"
      ? Math.max(0, Math.round(rawPages))
      : Math.max(0, parseInt(String(rawPages), 10) || 0);
    const coverUrl = sanitizeCoverUrl(c.coverUrl);

    if (fallbackAuthor && cAuthor && computeAuthorMatchScore(fallbackAuthor, [cAuthor]) < 0.35) {
      continue;
    }

    candidates.push({
      id: `ai-${i}-${cIsbn || Date.now()}`,
      title: cTitle,
      author: cAuthor || (fallbackAuthor || undefined),
      isbn: cIsbn || (fallbackIsbn || undefined),
      totalPages,
      coverUrl,
      publisher: typeof c.publisher === "string" ? c.publisher.trim() || undefined : undefined,
      publishedYear: typeof c.publishedYear === "string" ? c.publishedYear.trim() || undefined : undefined,
      source: "Penelusuran AI",
      isEstimated: true,
      matchScore: 0.75 + (totalPages > 0 ? 0.15 : 0),
    });
  }

  return candidates.slice(0, 3);
}

async function fetchCandidatesViaGroundedAI(
  title: string,
  author: string,
  isbn: string
): Promise<BookCandidate[]> {
  const gemini = getGeminiClient();
  const queryParts = [
    title ? `Judul: "${title}"` : "",
    author ? `Penulis: "${author}"` : "",
    isbn ? `ISBN: "${isbn}"` : "",
  ].filter(Boolean).join("\n");

  const prompt = `Cari informasi bibliografi resmi yang paling akurat dari buku berikut:
${queryParts}

Kembalikan HANYA JSON valid berbentuk:
{
  "candidates": [
    {
      "title": "Judul resmi buku",
      "author": "Nama lengkap penulis",
      "isbn": "ISBN-13 atau ISBN-10 jika ditemukan, atau kosong",
      "totalPages": 0,
      "publisher": "Nama penerbit jika diketahui",
      "publishedYear": "YYYY jika diketahui",
      "coverUrl": ""
    }
  ]
}

Aturan ketat:
1. Prioritaskan edisi asli atau cetakan utama yang persis sesuai judul, penulis, dan ISBN dari pengguna. Jangan mengembalikan buku ringkasan/summary pihak ketiga kecuali memang diminta.
2. totalPages harus berupa bilangan bulat halaman cetakan sebenarnya (isi 0 jika tidak diketahui pasti, jangan mengarang).
3. coverUrl isi HANYA jika menemukan URL gambar sampul HTTPS langsung yang valid dari Open Library atau Google Books; jika ragu, isi "".
4. Kembalikan maksimal 3 kandidat teratas yang paling relevan.`;

  // 1. Try Google Search Grounding ONCE if not currently in quota cooldown
  if (Date.now() >= groundingQuotaCooldownUntil) {
    try {
      const response = await gemini.models.generateContent({
        model: GEMINI_SYNTHESIS_MODEL,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [{ googleSearch: {} }],
        },
      });
      const candidates = parseAiBookCandidates(response.text || "", title, author, isbn);
      if (candidates.length > 0) {
        console.log(`[Google Gemini] Grounded book-info served via ${GEMINI_SYNTHESIS_MODEL}`);
        return candidates;
      }
    } catch (err: any) {
      if (isAuthError(err)) {
        throw new Error("Kunci API Google Gemini tidak valid atau ditolak. Periksa GEMINI_API_KEY di Settings > Secrets.");
      }
      if (isQuotaError(err)) {
        // Search Grounding has strict free-tier limits; cool down and fall back to standard lite generateContent
        groundingQuotaCooldownUntil = Date.now() + 10 * 60 * 1000;
        console.info("[Google Gemini] Kuota Google Search Grounding tercapai, beralih ke mode bibliografi standar.");
      } else {
        console.info("[Google Gemini] Grounded book-info dilewati:", err?.message || err);
      }
    }
  }

  // 2. Fallback to standard lite generateContent (without googleSearch tool)
  const schema = {
    type: Type.OBJECT,
    properties: {
      candidates: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            author: { type: Type.STRING },
            isbn: { type: Type.STRING },
            totalPages: { type: Type.INTEGER },
            publisher: { type: Type.STRING },
            publishedYear: { type: Type.STRING },
            coverUrl: { type: Type.STRING },
          },
          required: ["title", "totalPages", "coverUrl"],
        },
      },
    },
    required: ["candidates"],
  };

  const text = await executeAIRequest({
    systemInstruction: "Mesin Referensi Bibliografi Madrasah. Berikan data edisi buku terakurat sesuai input pengguna tanpa mengarang sampul.",
    userPrompt: prompt,
    jsonMode: true,
    responseSchema: schema,
    modelTier: "lite",
    purpose: "book-info-fallback",
  });

  return parseAiBookCandidates(text, title, author, isbn);
}

function deduplicateAndRankCandidates(list: BookCandidate[]): BookCandidate[] {
  const sorted = [...list].sort((a, b) => b.matchScore - a.matchScore);
  const unique: BookCandidate[] = [];

  for (const item of sorted) {
    const normTitle = normalizeForMatch(item.title);
    const normAuthor = normalizeForMatch(item.author || "");
    const existingIdx = unique.findIndex((u) => {
      if (item.isbn && u.isbn && item.isbn === u.isbn) return true;
      return (
        normalizeForMatch(u.title) === normTitle &&
        normalizeForMatch(u.author || "") === normAuthor &&
        u.totalPages === item.totalPages
      );
    });

    if (existingIdx === -1) {
      unique.push(item);
    } else {
      // Enrich missing cover/pages/isbn on the existing higher-ranked candidate if same edition
      const current = unique[existingIdx];
      unique[existingIdx] = {
        ...current,
        totalPages: current.totalPages || item.totalPages,
        coverUrl: current.coverUrl || item.coverUrl,
        isbn: current.isbn || item.isbn,
        publisher: current.publisher || item.publisher,
        publishedYear: current.publishedYear || item.publishedYear,
      };
    }

    if (unique.length >= 5) break;
  }

  return unique;
}

  apiRouter.post("/ai/book-info", async (req, res) => {
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
      const { title, author, isbn, forceRefresh } = req.body;
      const cleanTitle = String(title || "").trim();
      const cleanAuthor = String(author || "").trim();
      const cleanIsbn = normalizeIsbn(isbn);

      if (!cleanTitle && !cleanIsbn) {
        return sendError("Judul buku atau ISBN wajib diisi untuk pencarian metadata.");
      }

      const cacheKey = getCacheKey("book-info-v2", {
        title: cleanTitle.toLowerCase(),
        author: cleanAuthor.toLowerCase(),
        isbn: cleanIsbn,
      });

      if (!forceRefresh) {
        const cached = aiCache.get(cacheKey);
        if (cached) {
          console.log(`[Cache Hit] /api/ai/book-info`);
          sendLog("Memuat kandidat edisi dari cache...");
          return sendResult(cached);
        }
      }

      sendLog(
        cleanIsbn
          ? `Mencocokkan ISBN ${cleanIsbn} di Open Library dan Google Books...`
          : "Mencari edisi presisi di katalog Open Library dan Google Books..."
      );

      const [olCandidates, gbCandidates] = await Promise.all([
        fetchCandidatesFromOpenLibrary(cleanTitle, cleanAuthor, cleanIsbn),
        fetchCandidatesFromGoogleBooks(cleanTitle, cleanAuthor, cleanIsbn),
      ]);

      let mergedCandidates = deduplicateAndRankCandidates([...gbCandidates, ...olCandidates]);

      const hasCompletePageCandidate = mergedCandidates.some((c) => c.totalPages > 0);
      if (mergedCandidates.length === 0 || !hasCompletePageCandidate) {
        sendLog("Katalog publik belum lengkap. Mencari pelengkap metadata via Google Gemini...");
        try {
          const aiCandidates = await fetchCandidatesViaGroundedAI(cleanTitle, cleanAuthor, cleanIsbn);
          if (aiCandidates.length > 0) {
            mergedCandidates = deduplicateAndRankCandidates([
              ...mergedCandidates,
              ...aiCandidates,
            ]);
          }
        } catch (aiErr: any) {
          console.info("[Book-Info AI Fallback]", aiErr?.message || aiErr);
          if (mergedCandidates.length === 0) {
            return sendError(aiErr?.message || "Kuota Google Gemini sedang penuh atau pencarian metadata gagal.");
          }
          sendLog("Kuota AI sedang terbatas. Menampilkan kandidat dari katalog publik yang ditemukan...");
        }
      }

      const top = mergedCandidates[0];
      const payload = {
        candidates: mergedCandidates.slice(0, 5),
        title: top?.title || cleanTitle,
        author: top?.author || cleanAuthor || undefined,
        isbn: top?.isbn || cleanIsbn || undefined,
        totalPages: top?.totalPages || 0,
        coverUrl: top?.coverUrl || "",
        isEstimated: Boolean(top?.isEstimated),
      };

      if (mergedCandidates.length > 0) {
        aiCache.set(cacheKey, payload);
        sendLog(`Menemukan ${mergedCandidates.length} kandidat edisi yang cocok.`);
      } else {
        sendLog("Tidak ditemukan edisi yang cocok persis di katalog maupun web.");
      }

      return sendResult(payload);
    } catch (error: any) {
      console.error("AI Book Info Error:", error);
      return sendError(error.message || "Gagal mengambil metadata buku");
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
