import type { Author, Book, BookCandidate, BookStatus, EditionLanguagePreference } from "../types";

export const MIN_TITLE_SCORE = 0.52;
export const MIN_AUTHOR_SCORE = 0.6;

const DERIVATIVE_BOOK_TERMS = [
  "daily calendar",
  "calendar",
  "collection set",
  "boxed set",
  "box set",
  "2 books set",
  "3 books set",
  "book set",
  "study guide",
  "key takeaways",
  "analysis of",
  "coloring book",
  "guide to",
  "for teens",
  "for kids",
  "workbook",
  "summary",
  "companion",
  "ringkasan",
  "intisari",
  "flashcards",
  "journal",
  "notebook",
  "trivia",
  "quiz",
  "unofficial",
];

const ARCHIVE_ARTICLE_OR_SPAM_PATTERNS = [
  /\b(ijels|journal of|issn|proceedings of|conference on|dissertation|thesis|skripsi|tesis|makalah|artikel|volume \d+|issue \d+|vol\.\s*\d+)\b/i,
  /\b(z[\s-]?lib(?:\.org)?|zlib|annas?-archive|pdfdrive|oceanofpdf|dokumen\.pub|kupdf)\b/i,
  /^(diexsis|deiksis|analisis|kajian|resepsi|pengaruh|tinjauan|perbandingan)\s+(in|on|of|dalam|terhadap|novel|buku)\b/i,
];

const LANGUAGE_MAP: Record<string, string> = {
  id: "id",
  in: "id",
  ind: "id",
  indonesian: "id",
  en: "en",
  eng: "en",
  english: "en",
  ar: "ar",
  ara: "ar",
  arabic: "ar",
  ms: "ms",
  may: "ms",
  msa: "ms",
  malay: "ms",
  fr: "fr",
  fre: "fr",
  fra: "fr",
  de: "de",
  ger: "de",
  deu: "de",
  es: "es",
  spa: "es",
  nl: "nl",
  dut: "nl",
  nld: "nl",
  ja: "ja",
  jpn: "ja",
  zh: "zh",
  chi: "zh",
  zho: "zh",
};

const LANGUAGE_LABELS: Record<string, string> = {
  id: "Indonesia",
  en: "Inggris",
  ar: "Arab",
  ms: "Melayu",
  fr: "Prancis",
  de: "Jerman",
  es: "Spanyol",
  nl: "Belanda",
  ja: "Jepang",
  zh: "Mandarin",
};

export function normalizeIsbn(raw: unknown): string {
  return String(raw || "")
    .replace(/[^0-9Xx]/g, "")
    .toUpperCase()
    .slice(0, 13);
}

export function normalizeForMatch(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeLanguageCode(raw: unknown): string | undefined {
  if (!raw) return undefined;
  let code = String(raw).trim().toLowerCase();
  if (!code) return undefined;
  if (code.includes("/")) {
    code = code.split("/").filter(Boolean).pop() || "";
  }
  if (code.includes("-")) {
    code = code.split("-")[0] || "";
  }
  if (!code) return undefined;
  return LANGUAGE_MAP[code] || (code.length <= 3 ? code : undefined);
}

export function formatLanguageLabel(code?: string): string | null {
  if (!code) return null;
  const norm = normalizeLanguageCode(code);
  if (!norm) return null;
  return LANGUAGE_LABELS[norm] || norm.toUpperCase();
}

export function isDerivativeTitle(queryTitle: string, candidateTitle: string): boolean {
  const q = normalizeForMatch(queryTitle);
  const c = normalizeForMatch(candidateTitle);
  if (!c) return false;

  for (const term of DERIVATIVE_BOOK_TERMS) {
    if (q.includes(term)) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(c)) {
      return true;
    }
  }
  return false;
}

export function isRejectedArchiveEntry(
  identifier: string,
  candidateTitle: string,
  queryTitle: string
): boolean {
  if (isDerivativeTitle(queryTitle, candidateTitle)) return true;
  const qNorm = normalizeForMatch(queryTitle);
  const combined = `${identifier} ${candidateTitle}`;
  for (const pattern of ARCHIVE_ARTICLE_OR_SPAM_PATTERNS) {
    if (pattern.test(combined) && !pattern.test(qNorm)) {
      return true;
    }
  }
  return false;
}

export function computeTitleMatchScore(queryTitle: string, candidateTitle: string): number {
  const q = normalizeForMatch(queryTitle);
  const c = normalizeForMatch(candidateTitle);
  if (!q || !c) return 0;
  if (isDerivativeTitle(queryTitle, candidateTitle)) return 0;
  if (q === c) return 1;

  const rawC = String(candidateTitle || "").toLowerCase().trim();
  const isStandardSubtitle =
    rawC.startsWith(`${q}:`) ||
    rawC.startsWith(`${q} -`) ||
    rawC.startsWith(`${q} (`);

  const qWords = q.split(" ").filter((w) => w.length > 1);
  const cWords = c.split(" ").filter((w) => w.length > 1);

  if (isStandardSubtitle) {
    if (qWords.length > 0 && qWords.length <= 4 && cWords.length >= 22) {
      return 0.55;
    }
    return 0.92;
  }

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

  // Suppress bloated SEO clone titles when user gave a concise title
  if (qWords.length <= 4 && cWords.length >= Math.max(18, qWords.length * 4 + 8)) {
    score -= 0.4;
  }

  return Math.max(0, Math.min(0.99, score));
}

export function computeAuthorMatchScore(queryAuthor: string, candidateAuthors: string[]): number {
  const q = normalizeForMatch(queryAuthor);
  if (!q) return 0;
  if (!candidateAuthors || candidateAuthors.length === 0) return -0.25;

  const qWords = q.split(" ").filter((w) => w.length > 1);
  let best = 0;

  for (const rawCandidate of candidateAuthors) {
    const c = normalizeForMatch(rawCandidate);
    if (!c) continue;
    if (c === q) return 1;
    if (c.includes(q) || q.includes(c)) {
      best = Math.max(best, 0.92);
      continue;
    }

    const cWords = c.split(" ").filter((w) => w.length > 1);
    const cSet = new Set(cWords);
    if (qWords.length > 0 && cSet.size > 0) {
      let overlap = 0;
      for (const w of qWords) {
        if (cSet.has(w)) overlap++;
      }

      // Reject first-name clashes like "John Clear" vs "James Clear"
      const allQueryTokensMatched = overlap === qWords.length;
      if (
        !allQueryTokensMatched &&
        qWords.length >= 2 &&
        cWords.length >= 2 &&
        qWords[0] !== cWords[0]
      ) {
        continue;
      }

      const ratio = overlap / Math.max(qWords.length, Math.min(cWords.length, qWords.length + 1));
      best = Math.max(best, ratio);
    }
  }

  return best;
}

export function pickPreferredIsbn(isbns: unknown[], queryIsbn: string): string {
  if (!Array.isArray(isbns)) return "";
  const cleaned = isbns
    .map((x) => normalizeIsbn(x))
    .filter((x) => x.length === 10 || x.length === 13);
  if (cleaned.length === 0) return "";
  if (queryIsbn && cleaned.includes(queryIsbn)) return queryIsbn;
  return cleaned.find((x) => x.length === 13) || cleaned[0] || "";
}

export function sanitizeCoverUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== "string") return "";
  let url = rawUrl.trim();
  if (!url) return "";
  if (url.startsWith("http://")) {
    url = "https://" + url.slice(7);
  }
  if (!url.startsWith("https://")) return "";
  url = url.replace(/[&?]edge=curl/gi, (match) => (match.startsWith("?") ? "?" : ""));
  url = url.replace(/\?&/, "?").replace(/\?$/, "");
  return url;
}

export function computeLanguageBonus(
  candidateLang: string | undefined,
  languagePref: EditionLanguagePreference
): number {
  const norm = normalizeLanguageCode(candidateLang);
  if (languagePref === "id") {
    if (norm === "id") return 0.45;
    if (norm === "ms") return 0.1;
    if (norm) return -0.15;
    return -0.05;
  }
  if (languagePref === "original") {
    if (norm === "en") return 0.25;
    if (norm && norm !== "id") return 0.12;
    if (norm === "id") return -0.1;
    return 0;
  }
  return 0;
}

export function buildArchiveSearchQuery(
  title: string,
  author: string,
  isbn: string
): string {
  const escapeLucene = (s: string) =>
    s.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, " ").replace(/\s+/g, " ").trim();

  const clauses: string[] = [];
  if (isbn) {
    clauses.push(`isbn:"${normalizeIsbn(isbn)}"`);
  } else {
    const cleanTitle = escapeLucene(title);
    if (cleanTitle) {
      clauses.push(`title:(${cleanTitle})`);
    }
    const cleanAuthor = escapeLucene(author);
    if (cleanAuthor) {
      clauses.push(`creator:(${cleanAuthor})`);
    }
  }
  if (clauses.length === 0) return "";
  clauses.push("mediatype:(texts)");
  return clauses.join(" AND ");
}

export function deduplicateAndRankCandidates(
  list: BookCandidate[],
  languagePref: EditionLanguagePreference = "all",
  limit = 6
): BookCandidate[] {
  const scored = list.map((item) => {
    const baseScore = typeof item.matchScore === "number" ? item.matchScore : 0.7;
    const langBonus = computeLanguageBonus(item.language, languagePref);
    const dataBonus = (item.totalPages > 0 ? 0.16 : 0) + (item.coverUrl ? 0.14 : 0);
    return {
      ...item,
      language: normalizeLanguageCode(item.language) || item.language,
      isEstimated: false,
      matchScore: baseScore + langBonus + dataBonus,
    };
  });

  scored.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  const unique: BookCandidate[] = [];
  for (const item of scored) {
    const normTitle = normalizeForMatch(item.title);
    const normAuthor = normalizeForMatch(item.author || "");
    const existingIdx = unique.findIndex((u) => {
      if (item.isbn && u.isbn && item.isbn === u.isbn) return true;
      return (
        normalizeForMatch(u.title) === normTitle &&
        normalizeForMatch(u.author || "") === normAuthor &&
        u.totalPages === item.totalPages &&
        (u.language || "") === (item.language || "")
      );
    });

    if (existingIdx === -1) {
      unique.push(item);
    } else {
      const current = unique[existingIdx];
      unique[existingIdx] = {
        ...current,
        totalPages: current.totalPages || item.totalPages,
        coverUrl: current.coverUrl || item.coverUrl,
        isbn: current.isbn || item.isbn,
        publisher: current.publisher || item.publisher,
        publishedYear: current.publishedYear || item.publishedYear,
        language: current.language || item.language,
      };
    }

    if (unique.length >= limit) break;
  }

  return unique;
}

export function findDuplicateBook(
  books: Book[],
  authors: Author[],
  query: { title: string; authorName?: string; isbn?: string }
): Book | null {
  const cleanIsbn = normalizeIsbn(query.isbn);
  const normTitle = normalizeForMatch(query.title);
  const normAuthor = normalizeForMatch(query.authorName || "");

  if (cleanIsbn.length >= 10) {
    const isbnMatch = books.find((b) => b.isbn && normalizeIsbn(b.isbn) === cleanIsbn);
    if (isbnMatch) return isbnMatch;
  }

  if (!normTitle || normTitle.length < 2) return null;

  for (const book of books) {
    if (normalizeForMatch(book.title) !== normTitle) continue;
    if (!normAuthor) return book;
    const bookAuthor = authors.find((a) => a.id === book.authorId)?.name || "";
    if (!bookAuthor || computeAuthorMatchScore(normAuthor, [bookAuthor]) >= MIN_AUTHOR_SCORE) {
      return book;
    }
  }

  return null;
}

export function resolveInitialBookProgress(
  status: BookStatus,
  rawProgress: string,
  parsedTotalPages?: number
): number {
  const validTotal =
    typeof parsedTotalPages === "number" && parsedTotalPages > 0
      ? Math.round(parsedTotalPages)
      : 0;

  if (status === "finished" && validTotal > 0) {
    return validTotal;
  }

  if (status === "reading") {
    const parsed = parseInt(rawProgress, 10);
    if (isNaN(parsed) || parsed <= 0) return 0;
    return validTotal > 0 ? Math.min(parsed, validTotal) : parsed;
  }

  return 0;
}
