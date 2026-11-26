import express from "express";
import crypto from "crypto";
import net from "net";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import type { BookCandidate, EditionLanguagePreference } from "../src/types";
import {
  MIN_AUTHOR_SCORE,
  MIN_TITLE_SCORE,
  buildArchiveSearchQuery,
  computeAuthorMatchScore,
  computeLanguageBonus,
  computeTitleMatchScore,
  deduplicateAndRankCandidates,
  isRejectedArchiveEntry,
  normalizeIsbn,
  normalizeLanguageCode,
  pickPreferredIsbn,
} from "../src/utils/bookMetadata";

dotenv.config();

// Disable Node Happy Eyeballs (250ms default attempt timeout stalls/drops connections to distant US hosts like Open Library)
if (typeof net.setDefaultAutoSelectFamily === "function") {
  net.setDefaultAutoSelectFamily(false);
}

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

const OPEN_LIBRARY_HEADERS = {
  Accept: "application/json",
  "User-Agent": "MadrasahPKOS/1.0 (https://madrasah.remix)",
};

interface OpenLibrarySearchResult {
  docs: any[];
  timedOut: boolean;
}

async function fetchOpenLibrarySearch(
  params: URLSearchParams,
  timeoutMs = 11000
): Promise<OpenLibrarySearchResult> {
  params.set("fields", "key,title,author_name,cover_i,language,first_publish_year");
  params.set("limit", "10");
  const queryUrl = `https://openlibrary.org/search.json?${params.toString()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(queryUrl, {
      signal: controller.signal,
      headers: OPEN_LIBRARY_HEADERS,
    });
    if (!res.ok) return { docs: [], timedOut: false };
    const data = (await res.json()) as any;
    return {
      docs: Array.isArray(data?.docs) ? data.docs : [],
      timedOut: false,
    };
  } catch (err: any) {
    const isAbort = err?.name === "AbortError" || controller.signal.aborted;
    if (isAbort) {
      console.info(`[OpenLibrary] Search timed out after ${timeoutMs}ms.`);
    } else {
      console.info(`[OpenLibrary] Search unavailable:`, err?.message || err);
    }
    return { docs: [], timedOut: isAbort };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchOpenLibraryJson(urlPath: string, timeoutMs = 8000): Promise<any | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://openlibrary.org${urlPath}`, {
      signal: controller.signal,
      headers: OPEN_LIBRARY_HEADERS,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractEditionLanguage(entry: any): string | undefined {
  if (!Array.isArray(entry?.languages) || entry.languages.length === 0) return undefined;
  const first = entry.languages[0];
  const raw = typeof first === "string" ? first : first?.key;
  return normalizeLanguageCode(raw);
}

function buildOpenLibraryEditionCandidate(
  entry: any,
  fallbackAuthors: string[],
  queryTitle: string,
  queryAuthor: string,
  queryIsbn: string,
  languagePref: EditionLanguagePreference,
  exactIsbnMatch = false
): BookCandidate | null {
  const editionTitle = String(entry?.title || "").trim();
  if (!editionTitle) return null;

  const titleScore = queryTitle ? computeTitleMatchScore(queryTitle, editionTitle) : 1;
  const authorScore = queryAuthor ? computeAuthorMatchScore(queryAuthor, fallbackAuthors) : 0;

  if (!exactIsbnMatch) {
    if (queryTitle && titleScore < MIN_TITLE_SCORE) return null;
    if (queryAuthor && authorScore < MIN_AUTHOR_SCORE) return null;
  }

  const editionIsbn = pickPreferredIsbn(
    [...(entry?.isbn_13 || []), ...(entry?.isbn_10 || [])],
    queryIsbn
  );
  const ocaid = typeof entry?.ocaid === "string" ? entry.ocaid.trim() : "";
  const totalPages =
    typeof entry?.number_of_pages === "number" && entry.number_of_pages > 0
      ? Math.round(entry.number_of_pages)
      : 0;

  const coverId = Array.isArray(entry?.covers)
    ? entry.covers.find((c: any) => typeof c === "number" && c > 0)
    : null;
  const coverUrl = coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`
    : ocaid
      ? `https://archive.org/services/img/${encodeURIComponent(ocaid)}`
      : editionIsbn
        ? `https://covers.openlibrary.org/b/isbn/${editionIsbn}-L.jpg?default=false`
        : "";

  // Require at least one factual attribute for this specific edition
  if (totalPages === 0 && !coverUrl && !editionIsbn) return null;

  const editionLang = extractEditionLanguage(entry);
  const yearMatch = String(entry?.publish_date || "").match(/\d{4}/);
  const publisher =
    Array.isArray(entry?.publishers) && entry.publishers[0]
      ? String(entry.publishers[0]).trim()
      : undefined;

  const baseScore =
    (exactIsbnMatch ? 2.0 : titleScore + authorScore * 0.45) +
    computeLanguageBonus(editionLang, languagePref);

  return {
    id: `ol-ed-${entry.key || editionIsbn || ocaid || editionTitle}`,
    title: editionTitle,
    author: fallbackAuthors[0] || undefined,
    isbn: editionIsbn || undefined,
    totalPages,
    coverUrl,
    publisher,
    publishedYear: yearMatch ? yearMatch[0] : undefined,
    language: editionLang,
    source: "Open Library",
    isEstimated: false,
    matchScore: baseScore,
  };
}

async function resolveIsbnAuthorNames(ed: any, fallbackSearchAuthors: string[]): Promise<string[]> {
  if (fallbackSearchAuthors.length > 0) return fallbackSearchAuthors;
  const authorRefs: any[] = Array.isArray(ed?.authors) ? ed.authors.slice(0, 2) : [];
  if (authorRefs.length === 0) return [];

  const loaded = await Promise.all(
    authorRefs.map(async (ref) => {
      const key = typeof ref === "string" ? ref : ref?.key;
      if (!key || !String(key).startsWith("/authors/")) return "";
      const authorDoc = await fetchOpenLibraryJson(`${key}.json`, 3500);
      return authorDoc?.name ? String(authorDoc.name).trim() : "";
    })
  );
  return loaded.filter(Boolean);
}

async function verifySingleCoverUrl(url: string, timeoutMs = 2500): Promise<boolean> {
  if (!url) return false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": OPEN_LIBRARY_HEADERS["User-Agent"],
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return false;
    const contentType = res.headers.get("content-type") || "";
    if (contentType && !contentType.toLowerCase().startsWith("image/")) {
      return false;
    }
    const contentLength = parseInt(res.headers.get("content-length") || "0", 10);
    if (contentLength > 0 && contentLength < 100) {
      return false;
    }
    return true;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}

async function verifyCandidateCovers(candidates: BookCandidate[]): Promise<BookCandidate[]> {
  const isVerifiableCover = (u: string) =>
    Boolean(u && (u.includes("covers.openlibrary.org") || u.includes("archive.org/services/img/")));

  const urlsToVerify = Array.from(
    new Set(candidates.map((c) => c.coverUrl).filter(isVerifiableCover))
  ).slice(0, 12);

  if (urlsToVerify.length === 0) return candidates;

  const verificationMap = new Map<string, boolean>();
  await Promise.all(
    urlsToVerify.map(async (url) => {
      const ok = await verifySingleCoverUrl(url);
      verificationMap.set(url, ok);
    })
  );

  return candidates.map((c) => {
    if (!isVerifiableCover(c.coverUrl)) return c;
    const verified = verificationMap.get(c.coverUrl);
    if (verified === false) {
      return { ...c, coverUrl: "" };
    }
    return c;
  });
}

async function fetchArchiveEntryPageCount(identifier: string, timeoutMs = 4500): Promise<number> {
  if (!identifier) return 0;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://archive.org/metadata/${encodeURIComponent(identifier)}/metadata`,
      { signal: controller.signal, headers: OPEN_LIBRARY_HEADERS }
    );
    if (!res.ok) return 0;
    const data = (await res.json()) as any;
    const rawPages = data?.result?.imagecount ?? data?.result?.pages ?? 0;
    const parsed = parseInt(String(rawPages), 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchDigitalArchiveQuery(
  luceneQuery: string,
  timeoutMs = 7500
): Promise<{ docs: any[]; timedOut: boolean }> {
  if (!luceneQuery) return { docs: [], timedOut: false };
  const params = new URLSearchParams({
    q: luceneQuery,
    rows: "12",
    output: "json",
  });
  for (const field of [
    "identifier",
    "title",
    "creator",
    "publisher",
    "year",
    "date",
    "language",
    "isbn",
    "imagecount",
    "collection",
  ]) {
    params.append("fl[]", field);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://archive.org/advancedsearch.php?${params.toString()}`, {
      signal: controller.signal,
      headers: OPEN_LIBRARY_HEADERS,
    });
    if (!res.ok) return { docs: [], timedOut: false };
    const data = (await res.json()) as any;
    const docs = Array.isArray(data?.response?.docs) ? data.response.docs : [];
    return { docs, timedOut: false };
  } catch (err: any) {
    const isAbort = err?.name === "AbortError" || controller.signal.aborted;
    console.info(`[DigitalArchive] Search skipped:`, isAbort ? "timeout" : err?.message || err);
    return { docs: [], timedOut: isAbort };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchCandidatesFromDigitalArchive(
  title: string,
  author: string,
  isbn: string,
  languagePref: EditionLanguagePreference
): Promise<{ candidates: BookCandidate[]; timedOut: boolean }> {
  const primaryQuery = buildArchiveSearchQuery(title, author, isbn);
  if (!primaryQuery) return { candidates: [], timedOut: false };

  const primaryRes = await fetchDigitalArchiveQuery(primaryQuery);
  let docs = primaryRes.docs;
  let timedOut = primaryRes.timedOut;

  // If author + title returned 0 results cleanly, retry title-only and enforce strict author score when creator exists
  if (docs.length === 0 && !timedOut && author && title && !isbn) {
    const titleOnlyQuery = buildArchiveSearchQuery(title, "", "");
    const fallbackRes = await fetchDigitalArchiveQuery(titleOnlyQuery);
    docs = fallbackRes.docs;
    timedOut = timedOut || fallbackRes.timedOut;
  }

  const candidates: BookCandidate[] = [];
  for (const doc of docs) {
    const identifier = String(doc?.identifier || "").trim();
    const docTitle = String(doc?.title || "").trim();
    if (!identifier || !docTitle) continue;
    if (isRejectedArchiveEntry(identifier, docTitle, title)) continue;

    const rawCreators = Array.isArray(doc.creator)
      ? doc.creator
      : doc.creator
        ? [doc.creator]
        : [];
    const creatorList: string[] = rawCreators.map((c: any) => String(c || "").trim()).filter(Boolean);

    const docIsbns = Array.isArray(doc.isbn) ? doc.isbn : doc.isbn ? [doc.isbn] : [];
    const preferredIsbn = pickPreferredIsbn(docIsbns, isbn);
    const exactIsbnHit = Boolean(isbn && docIsbns.some((x: any) => normalizeIsbn(x) === isbn));

    const titleScore = title ? computeTitleMatchScore(title, docTitle) : 1;
    const authorScore = author ? computeAuthorMatchScore(author, creatorList) : 0;

    if (!exactIsbnHit) {
      if (title && titleScore < MIN_TITLE_SCORE) continue;
      if (author && authorScore < MIN_AUTHOR_SCORE) continue;
    }

    const rawImageCount = parseInt(String(doc.imagecount || "0"), 10);
    const totalPages = !isNaN(rawImageCount) && rawImageCount > 0 ? rawImageCount : 0;

    const rawLang = Array.isArray(doc.language) ? doc.language[0] : doc.language;
    const editionLang = normalizeLanguageCode(rawLang);
    const yearMatch = String(doc.year || doc.date || "").match(/\d{4}/);
    const rawPublisher = Array.isArray(doc.publisher) ? doc.publisher[0] : doc.publisher;
    const publisher = rawPublisher ? String(rawPublisher).trim() : undefined;

    const collections: string[] = Array.isArray(doc.collection)
      ? doc.collection.map((c: any) => String(c).toLowerCase())
      : doc.collection
        ? [String(doc.collection).toLowerCase()]
        : [];
    const isCuratedBookCollection = collections.some(
      (c) =>
        c === "internetarchivebooks" ||
        c === "inlibrary" ||
        c === "printdisabled" ||
        c.startsWith("booksbylanguage")
    );

    const coverUrl = `https://archive.org/services/img/${encodeURIComponent(identifier)}`;
    const matchScore =
      (exactIsbnHit ? 1.98 : titleScore + authorScore * 0.45) +
      (isCuratedBookCollection ? 0.16 : 0) +
      computeLanguageBonus(editionLang, languagePref);

    candidates.push({
      id: `ia-${identifier}`,
      title: docTitle,
      author: creatorList[0] || undefined,
      isbn: preferredIsbn || undefined,
      totalPages,
      coverUrl,
      publisher,
      publishedYear: yearMatch ? yearMatch[0] : undefined,
      language: editionLang,
      source: "Digital Archive",
      isEstimated: false,
      matchScore,
    });
  }

  return { candidates, timedOut };
}

async function fetchCandidatesFromOpenLibrary(
  title: string,
  author: string,
  isbn: string,
  languagePref: EditionLanguagePreference
): Promise<{ candidates: BookCandidate[]; timedOut: boolean }> {
  const candidates: BookCandidate[] = [];
  let timedOut = false;

  // 1. Exact ISBN lookup directly via /isbn/{isbn}.json
  if (isbn) {
    const [ed, isbnSearchRes] = await Promise.all([
      fetchOpenLibraryJson(`/isbn/${encodeURIComponent(isbn)}.json`),
      fetchOpenLibrarySearch(new URLSearchParams({ isbn })),
    ]);
    timedOut = timedOut || isbnSearchRes.timedOut;

    const searchAuthors: string[] =
      Array.isArray(isbnSearchRes.docs?.[0]?.author_name)
        ? isbnSearchRes.docs[0].author_name.map((a: any) => String(a || "").trim()).filter(Boolean)
        : [];

    if (ed) {
      const resolvedAuthors = await resolveIsbnAuthorNames(ed, searchAuthors);
      const exactCandidate = buildOpenLibraryEditionCandidate(
        ed,
        resolvedAuthors,
        title,
        author,
        isbn,
        languagePref,
        true
      );
      if (exactCandidate) {
        if (exactCandidate.totalPages === 0 && typeof ed?.ocaid === "string" && ed.ocaid.trim()) {
          exactCandidate.totalPages = await fetchArchiveEntryPageCount(ed.ocaid.trim());
        }
        candidates.push(exactCandidate);
      }

      const workKey = Array.isArray(ed?.works) && ed.works[0]?.key ? String(ed.works[0].key) : "";
      if (workKey.startsWith("/works/")) {
        const edList = await fetchOpenLibraryJson(`${workKey}/editions.json?limit=25`);
        const entries: any[] = Array.isArray(edList?.entries) ? edList.entries : [];
        for (const entry of entries) {
          const sibling = buildOpenLibraryEditionCandidate(
            entry,
            resolvedAuthors,
            title || String(ed.title || ""),
            author,
            isbn,
            languagePref,
            false
          );
          if (sibling) candidates.push(sibling);
        }
      }
    }
  }

  // 2. Work -> Individual Editions lookup when title is given and ISBN yielded nothing or few hits
  if (candidates.length === 0 && title) {
    const primaryParams = new URLSearchParams({ title });
    if (author) primaryParams.set("author", author);
    const primaryRes = await fetchOpenLibrarySearch(primaryParams);
    let docs = primaryRes.docs;
    timedOut = timedOut || primaryRes.timedOut;

    if (docs.length === 0 && !primaryRes.timedOut) {
      const fallbackQuery = author ? `${title} ${author}` : title;
      const fallbackRes = await fetchOpenLibrarySearch(new URLSearchParams({ q: fallbackQuery }));
      docs = fallbackRes.docs;
      timedOut = timedOut || fallbackRes.timedOut;
    }

    const matchedWorks: Array<{ workKey: string; authors: string[]; score: number; doc: any }> = [];
    for (const doc of docs) {
      if (!doc?.title || !doc?.key || !String(doc.key).startsWith("/works/")) continue;

      const titleScore = computeTitleMatchScore(title, String(doc.title));
      const candidateAuthors: string[] = Array.isArray(doc.author_name)
        ? doc.author_name.map((a: any) => String(a || "").trim()).filter(Boolean)
        : [];
      const authorScore = author ? computeAuthorMatchScore(author, candidateAuthors) : 0;

      if (titleScore < MIN_TITLE_SCORE) continue;
      if (author && authorScore < MIN_AUTHOR_SCORE) continue;

      const workLangBonus =
        languagePref === "id" && Array.isArray(doc.language) && doc.language.includes("ind")
          ? 0.25
          : 0;

      matchedWorks.push({
        workKey: String(doc.key),
        authors: candidateAuthors,
        score: titleScore + authorScore * 0.45 + workLangBonus,
        doc,
      });
    }

    matchedWorks.sort((a, b) => b.score - a.score);
    const topWorks = matchedWorks.slice(0, 3);

    const workEditionsResults = await Promise.all(
      topWorks.map(async (work) => {
        const edList = await fetchOpenLibraryJson(`${work.workKey}/editions.json?limit=40`);
        return {
          work,
          entries: Array.isArray(edList?.entries) ? edList.entries : [],
        };
      })
    );

    const ocaidEnrichTargets: Array<{ candidate: BookCandidate; ocaid: string }> = [];

    for (const { work, entries } of workEditionsResults) {
      let workHadSpecificEdition = false;
      for (const entry of entries) {
        const cand = buildOpenLibraryEditionCandidate(
          entry,
          work.authors,
          title,
          author,
          isbn,
          languagePref,
          false
        );
        if (cand) {
          candidates.push(cand);
          workHadSpecificEdition = true;
          if (cand.totalPages === 0 && typeof entry?.ocaid === "string" && entry.ocaid.trim()) {
            ocaidEnrichTargets.push({ candidate: cand, ocaid: entry.ocaid.trim() });
          }
        }
      }

      if (!workHadSpecificEdition && work.doc?.cover_i) {
        candidates.push({
          id: `ol-work-${work.workKey}`,
          title: String(work.doc.title).trim(),
          author: work.authors[0] || undefined,
          totalPages: 0,
          coverUrl: `https://covers.openlibrary.org/b/id/${work.doc.cover_i}-L.jpg?default=false`,
          publishedYear: work.doc.first_publish_year
            ? String(work.doc.first_publish_year)
            : undefined,
          source: "Open Library",
          isEstimated: false,
          matchScore: work.score,
        });
      }
    }

    // Cross-enrich up to 3 Open Library editions lacking page counts from their Digital Archive ocaid
    if (ocaidEnrichTargets.length > 0) {
      await Promise.all(
        ocaidEnrichTargets.slice(0, 3).map(async ({ candidate, ocaid }) => {
          const pages = await fetchArchiveEntryPageCount(ocaid);
          if (pages > 0) candidate.totalPages = pages;
        })
      );
    }
  }

  return { candidates, timedOut };
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
      const { title, author, isbn, languagePref: rawPref, forceRefresh } = req.body;
      const cleanTitle = String(title || "").trim();
      const cleanAuthor = String(author || "").trim();
      const cleanIsbn = normalizeIsbn(isbn);
      const languagePref: EditionLanguagePreference =
        rawPref === "id" || rawPref === "original" ? rawPref : "all";

      if (!cleanTitle && !cleanIsbn) {
        return sendError("Judul buku atau ISBN wajib diisi untuk pencarian metadata.");
      }

      const cacheKey = getCacheKey("book-info-v4", {
        title: cleanTitle.toLowerCase(),
        author: cleanAuthor.toLowerCase(),
        isbn: cleanIsbn,
        languagePref,
      });

      if (!forceRefresh) {
        const cached = aiCache.get(cacheKey);
        if (cached) {
          console.log(`[Cache Hit] /api/ai/book-info`);
          sendLog("Memuat edisi Open Library & Digital Archive dari cache...");
          return sendResult(cached);
        }
      }

      sendLog(
        cleanIsbn
          ? `Memeriksa ISBN ${cleanIsbn} di Open Library dan Digital Archive...`
          : "Mencari edisi terverifikasi di Open Library & Digital Archive..."
      );

      const [olRes, archiveRes] = await Promise.all([
        fetchCandidatesFromOpenLibrary(cleanTitle, cleanAuthor, cleanIsbn, languagePref),
        fetchCandidatesFromDigitalArchive(cleanTitle, cleanAuthor, cleanIsbn, languagePref),
      ]);

      const mergedPreVerify = deduplicateAndRankCandidates(
        [...olRes.candidates, ...archiveRes.candidates],
        languagePref,
        10
      );
      const verifiedCovers = await verifyCandidateCovers(mergedPreVerify);
      const finalCandidates = deduplicateAndRankCandidates(verifiedCovers, languagePref, 8);

      const top = finalCandidates[0];
      const payload = {
        candidates: finalCandidates,
        title: top?.title || cleanTitle,
        author: top?.author || cleanAuthor || undefined,
        isbn: top?.isbn || cleanIsbn || undefined,
        totalPages: top?.totalPages || 0,
        coverUrl: top?.coverUrl || "",
        isEstimated: false,
      };

      if (finalCandidates.length > 0) {
        aiCache.set(cacheKey, payload);
        sendLog(
          `Menemukan ${finalCandidates.length} edisi terverifikasi dari Open Library & Digital Archive.`
        );
      } else if (olRes.timedOut && archiveRes.timedOut) {
        sendLog("Open Library & Digital Archive merespons lambat; menampilkan hasil Google Books yang tersedia.");
      } else {
        sendLog("Tidak ditemukan edisi terverifikasi yang cocok di Open Library & Digital Archive.");
      }

      return sendResult(payload);
    } catch (error: any) {
      console.error("Book Info Error:", error);
      return sendError(error.message || "Gagal mengambil metadata buku dari Open Library & Digital Archive");
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
