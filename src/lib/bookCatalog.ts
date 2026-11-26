import type { BookCandidate, EditionLanguagePreference } from "../types";
import {
  MIN_AUTHOR_SCORE,
  MIN_TITLE_SCORE,
  computeAuthorMatchScore,
  computeTitleMatchScore,
  normalizeIsbn,
  normalizeLanguageCode,
  pickPreferredIsbn,
  sanitizeCoverUrl,
} from "../utils/bookMetadata";

export interface BrowserCatalogResult {
  candidates: BookCandidate[];
  rateLimited: boolean;
  error?: string;
}

interface RawGoogleBooksFetch {
  items: any[];
  rateLimited: boolean;
  error?: string;
}

async function fetchGoogleBooksVolumes(
  queryUrl: string,
  timeoutMs = 7000
): Promise<RawGoogleBooksFetch> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(queryUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.status === 429) {
      return { items: [], rateLimited: true, error: "Batas permintaan Google Books browser tercapai." };
    }
    if (!res.ok) {
      return { items: [], rateLimited: false, error: `Google Books merespons status ${res.status}.` };
    }

    const data = (await res.json()) as { items?: any[] };
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      rateLimited: false,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isAbort = err?.name === "AbortError";
    return {
      items: [],
      rateLimited: false,
      error: isAbort ? "Waktu pencarian Google Books habis." : "Gagal terhubung ke Google Books.",
    };
  }
}

function mapGoogleBooksItems(
  items: any[],
  queryTitle: string,
  queryAuthor: string,
  queryIsbn: string
): BookCandidate[] {
  const results: BookCandidate[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const vol = item?.volumeInfo;
    if (!vol?.title) continue;

    const identifiers: unknown[] = Array.isArray(vol.industryIdentifiers)
      ? vol.industryIdentifiers.map((idObj: any) => idObj?.identifier)
      : [];
    const preferredIsbn = pickPreferredIsbn(identifiers, queryIsbn);
    const exactIsbnHit = Boolean(
      queryIsbn && identifiers.some((x) => normalizeIsbn(x) === queryIsbn)
    );

    const candidateTitle = String(vol.title).trim();
    const titleScore = queryTitle ? computeTitleMatchScore(queryTitle, candidateTitle) : 1;
    const candidateAuthors: string[] = Array.isArray(vol.authors)
      ? vol.authors.map((a: any) => String(a || "").trim()).filter(Boolean)
      : [];
    const authorScore = queryAuthor ? computeAuthorMatchScore(queryAuthor, candidateAuthors) : 0;

    if (!exactIsbnHit) {
      if (queryTitle && titleScore < MIN_TITLE_SCORE) continue;
      if (queryAuthor && authorScore < MIN_AUTHOR_SCORE) continue;
    }

    const totalPages =
      typeof vol.pageCount === "number" && vol.pageCount > 0
        ? Math.round(vol.pageCount)
        : 0;
    const coverUrl = sanitizeCoverUrl(
      vol.imageLinks?.thumbnail || vol.imageLinks?.smallThumbnail || ""
    );

    // Require at least one concrete factual field beyond title/author
    if (totalPages === 0 && !coverUrl && !preferredIsbn) continue;

    const yearMatch = String(vol.publishedDate || "").match(/\d{4}/);
    const matchScore = exactIsbnHit ? 2.0 : titleScore + authorScore * 0.45;

    results.push({
      id: `gb-${item.id || preferredIsbn || i}`,
      title: candidateTitle,
      author: candidateAuthors[0] || undefined,
      isbn: preferredIsbn || undefined,
      totalPages,
      coverUrl,
      publisher: vol.publisher ? String(vol.publisher).trim() : undefined,
      publishedYear: yearMatch ? yearMatch[0] : undefined,
      language: normalizeLanguageCode(vol.language),
      source: "Google Books",
      isEstimated: false,
      matchScore,
    });
  }

  return results;
}

export async function fetchGoogleBooksFromBrowser(
  title: string,
  author: string,
  isbn: string,
  languagePref: EditionLanguagePreference = "all"
): Promise<BrowserCatalogResult> {
  const cleanTitle = title.trim();
  const cleanAuthor = author.trim();
  const cleanIsbn = normalizeIsbn(isbn);

  if (!cleanTitle && !cleanIsbn) {
    return { candidates: [], rateLimited: false };
  }

  const base = "https://www.googleapis.com/books/v1/volumes";
  const allItems: any[] = [];
  let rateLimited = false;
  let lastError: string | undefined;

  if (cleanIsbn) {
    const res = await fetchGoogleBooksVolumes(
      `${base}?q=isbn:${encodeURIComponent(cleanIsbn)}&maxResults=10&printType=books`
    );
    allItems.push(...res.items);
    rateLimited = res.rateLimited;
    lastError = res.error;
  }

  if (allItems.length === 0 && cleanTitle && !rateLimited) {
    const parts: string[] = [`intitle:${encodeURIComponent(`"${cleanTitle}"`)}`];
    if (cleanAuthor) {
      parts.push(`inauthor:${encodeURIComponent(`"${cleanAuthor}"`)}`);
    }
    const langParam = languagePref === "id" ? "&langRestrict=id" : "";
    const first = await fetchGoogleBooksVolumes(
      `${base}?q=${parts.join("+")}&maxResults=12&printType=books${langParam}`
    );
    allItems.push(...first.items);
    rateLimited = first.rateLimited;
    lastError = first.error;

    // Fallback without langRestrict or strict quotes if zero strict hits
    if (allItems.length === 0 && !rateLimited) {
      const relaxedParts: string[] = [`intitle:${encodeURIComponent(cleanTitle)}`];
      if (cleanAuthor) {
        relaxedParts.push(`inauthor:${encodeURIComponent(cleanAuthor)}`);
      }
      const second = await fetchGoogleBooksVolumes(
        `${base}?q=${relaxedParts.join("+")}&maxResults=12&printType=books`
      );
      allItems.push(...second.items);
      rateLimited = rateLimited || second.rateLimited;
      lastError = second.error || lastError;
    }
  }

  const mapped = mapGoogleBooksItems(allItems, cleanTitle, cleanAuthor, cleanIsbn);
  return {
    candidates: mapped,
    rateLimited,
    error: mapped.length === 0 ? lastError : undefined,
  };
}
