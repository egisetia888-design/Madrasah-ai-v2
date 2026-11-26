import { useEffect, useId, useState, type KeyboardEvent } from "react";
import {
  AlertCircle,
  Book,
  Check,
  Eraser,
  Globe,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { fetchWithAuth } from "../../lib/api";
import { fetchGoogleBooksFromBrowser } from "../../lib/bookCatalog";
import { useToastStore } from "../../store/toastStore";
import { BookCandidate, BookInfoResponse, EditionLanguagePreference } from "../../types";
import { deduplicateAndRankCandidates, formatLanguageLabel } from "../../utils/bookMetadata";
import { cn } from "../../utils/cn";
import { Button } from "../ui/Button";
import { MetadataRow } from "../ui/MetadataRow";

interface BookMetadataFieldsProps {
  title: string;
  onTitleChange: (value: string) => void;
  authorName: string;
  onAuthorNameChange: (value: string) => void;
  isbn: string;
  onIsbnChange: (value: string) => void;
  totalPages: string;
  onTotalPagesChange: (value: string) => void;
  coverUrl: string;
  onCoverUrlChange: (value: string) => void;
  isEstimatedPages: boolean;
  onIsEstimatedPagesChange: (value: boolean) => void;
  existingAuthorNames?: string[];
  resetTrigger?: boolean | string;
}

type CoverLoadStatus = "idle" | "loading" | "loaded" | "error";

const LANGUAGE_OPTIONS: Array<{ value: EditionLanguagePreference; label: string }> = [
  { value: "all", label: "Semua Edisi" },
  { value: "id", label: "Indonesia" },
  { value: "original", label: "Inggris / Asli" },
];

async function fetchServerCatalogFromApi(
  payload: {
    title: string;
    author: string;
    isbn: string;
    languagePref: EditionLanguagePreference;
    forceRefresh: boolean;
  },
  onLog: (msg: string) => void
): Promise<BookCandidate[]> {
  const res = await fetchWithAuth("/api/ai/book-info", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errMsg = "Gagal mencari di Open Library & Digital Archive.";
    try {
      const parsed = JSON.parse(await res.text());
      errMsg = typeof parsed?.error === "string" ? parsed.error : parsed?.error?.message || errMsg;
    } catch {
      // ignore non-JSON error
    }
    throw new Error(errMsg);
  }

  if (!res.body) return [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalData: BookInfoResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "log" && parsed.message) {
          onLog(parsed.message);
        } else if (parsed.type === "result") {
          finalData = parsed.data as BookInfoResponse;
        } else if (parsed.type === "error") {
          throw new Error(
            typeof parsed.error === "string"
              ? parsed.error
              : parsed.error?.message || "Gagal mencari di katalog buku."
          );
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Gagal")) {
          throw err;
        }
      }
    }
  }

  return Array.isArray(finalData?.candidates) ? finalData.candidates : [];
}

export function BookMetadataFields({
  title,
  onTitleChange,
  authorName,
  onAuthorNameChange,
  isbn,
  onIsbnChange,
  totalPages,
  onTotalPagesChange,
  coverUrl,
  onCoverUrlChange,
  isEstimatedPages,
  onIsEstimatedPagesChange,
  existingAuthorNames = [],
  resetTrigger,
}: BookMetadataFieldsProps) {
  const uid = useId();
  const addToast = useToastStore((state) => state.addToast);
  const updateToast = useToastStore((state) => state.updateToast);

  const [languagePref, setLanguagePref] = useState<EditionLanguagePreference>("all");
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [candidates, setCandidates] = useState<BookCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [coverStatus, setCoverStatus] = useState<CoverLoadStatus>("idle");

  // Reset transient search state whenever modal opens/closes or target entity changes
  useEffect(() => {
    setHasSearched(false);
    setStatusMessage("");
    setCandidates([]);
    setSelectedCandidateId(null);
    setLanguagePref("all");
  }, [resetTrigger]);

  // Track preview image load state whenever coverUrl changes
  useEffect(() => {
    const trimmed = coverUrl.trim();
    if (!trimmed) {
      setCoverStatus("idle");
      return;
    }
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setCoverStatus("error");
      return;
    }
    setCoverStatus("loading");
  }, [coverUrl]);

  const canSearch = Boolean(title.trim() || isbn.trim());
  const hasAutofillData = Boolean(
    totalPages.trim() || coverUrl.trim() || isEstimatedPages || candidates.length > 0 || hasSearched
  );

  const applyCandidate = (candidate: BookCandidate) => {
    setSelectedCandidateId(candidate.id);
    if (candidate.title) {
      onTitleChange(candidate.title);
    }
    if (candidate.author) {
      onAuthorNameChange(candidate.author);
    }
    if (candidate.isbn) {
      onIsbnChange(candidate.isbn);
    }

    const validPages = candidate.totalPages > 0 ? String(candidate.totalPages) : "";
    const validCover = candidate.coverUrl || "";
    onTotalPagesChange(validPages);
    onCoverUrlChange(validCover);
    onIsEstimatedPagesChange(false);

    if (!validPages && !validCover) {
      addToast({
        type: "info",
        message: "Edisi dipilih. Halaman dan sampul belum tercatat di katalog — silakan isi manual.",
      });
    } else if (!validPages) {
      addToast({
        type: "info",
        message: "Edisi diterapkan. Total halaman belum tercatat di katalog sehingga dibiarkan kosong.",
      });
    } else if (!validCover) {
      addToast({
        type: "info",
        message: "Edisi diterapkan. Sampul resmi belum tersedia di katalog sehingga dibiarkan kosong.",
      });
    } else {
      addToast({
        type: "success",
        message: `Edisi "${candidate.title}" (${candidate.source}) diterapkan.`,
      });
    }
  };

  const handleClearAutofill = () => {
    onTotalPagesChange("");
    onCoverUrlChange("");
    onIsEstimatedPagesChange(false);
    setCandidates([]);
    setSelectedCandidateId(null);
    setHasSearched(false);
    setStatusMessage("");
  };

  const handleSearchMetadata = async (forceRefresh = false) => {
    if (!canSearch || isFetchingInfo) {
      if (!canSearch) {
        addToast({ type: "info", message: "Masukkan judul buku atau ISBN terlebih dahulu." });
      }
      return;
    }

    const cleanTitle = title.trim();
    const cleanAuthor = authorName.trim();
    const cleanIsbn = isbn.trim();

    setIsFetchingInfo(true);
    setStatusMessage("Mencari di Google Books, Open Library, dan Digital Archive...");
    const toastId = addToast({ type: "loading", message: "Mencari katalog edisi terverifikasi..." });

    try {
      const [gbSettled, serverSettled] = await Promise.allSettled([
        fetchGoogleBooksFromBrowser(cleanTitle, cleanAuthor, cleanIsbn, languagePref),
        fetchServerCatalogFromApi(
          {
            title: cleanTitle,
            author: cleanAuthor,
            isbn: cleanIsbn,
            languagePref,
            forceRefresh,
          },
          (msg) => setStatusMessage(msg)
        ),
      ]);

      const gbCandidates = gbSettled.status === "fulfilled" ? gbSettled.value.candidates : [];
      const gbRateLimited = gbSettled.status === "fulfilled" ? gbSettled.value.rateLimited : false;
      const serverCandidates = serverSettled.status === "fulfilled" ? serverSettled.value : [];

      const merged = deduplicateAndRankCandidates(
        [...gbCandidates, ...serverCandidates],
        languagePref,
        8
      );

      setHasSearched(true);
      setCandidates(merged);
      setSelectedCandidateId(null);

      if (merged.length === 0) {
        const emptyMsg = gbRateLimited
          ? "Batas kuota Google Books browser tercapai dan tidak ditemukan edisi cocok di Open Library / Digital Archive. Silakan isi kolom secara manual."
          : "Tidak ditemukan edisi terverifikasi yang cocok. Kolom dibiarkan kosong agar tidak terisi data keliru — periksa ejaan atau isi secara manual.";
        setStatusMessage(emptyMsg);
        updateToast(toastId, { type: "info", message: emptyMsg });
      } else {
        const msg = `Ditemukan ${merged.length} kandidat edisi terverifikasi. Pilih edisi yang sesuai di bawah.`;
        setStatusMessage(msg);
        updateToast(toastId, { type: "success", message: msg });
      }
    } catch (error) {
      console.error("Metadata fetch failed:", error);
      const errMsg = "Gagal menghubungi katalog buku. Silakan periksa koneksi atau isi secara manual.";
      setStatusMessage(errMsg);
      updateToast(toastId, { type: "error", message: errMsg });
    } finally {
      setIsFetchingInfo(false);
    }
  };

  // Trigger catalog search instead of prematurely submitting an incomplete parent <form>
  const handleLookupInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSearch) {
      e.preventDefault();
      handleSearchMetadata(false);
    }
  };

  const titleInputId = `${uid}-title`;
  const authorInputId = `${uid}-author`;
  const authorListId = `${uid}-author-list`;
  const isbnInputId = `${uid}-isbn`;
  const pagesInputId = `${uid}-pages`;
  const coverInputId = `${uid}-cover`;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={titleInputId} className="text-sm font-medium text-gray-700">
          Judul Buku <span className="text-gray-500">*</span>
        </label>
        <input
          id={titleInputId}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={handleLookupInputKeyDown}
          type="text"
          className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
          placeholder="Contoh: Atomic Habits (Enter untuk cari)"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor={authorInputId} className="text-sm font-medium text-gray-700">
            Penulis
          </label>
          <input
            id={authorInputId}
            list={existingAuthorNames.length > 0 ? authorListId : undefined}
            value={authorName}
            onChange={(e) => onAuthorNameChange(e.target.value)}
            onKeyDown={handleLookupInputKeyDown}
            type="text"
            className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
            placeholder="Contoh: James Clear"
          />
          {existingAuthorNames.length > 0 && (
            <datalist id={authorListId}>
              {existingAuthorNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={isbnInputId} className="text-sm font-medium text-gray-700">
            ISBN <span className="text-xs font-normal text-gray-400">(Opsional, lebih presisi)</span>
          </label>
          <input
            id={isbnInputId}
            value={isbn}
            onChange={(e) => onIsbnChange(e.target.value)}
            onKeyDown={handleLookupInputKeyDown}
            type="text"
            inputMode="numeric"
            className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-gray-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
            placeholder="Contoh: 9780735211292"
          />
        </div>
      </div>

      {/* Autofill Actions & Language Preference Bar */}
      <div className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50/70 space-y-3">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-gray-600 inline-flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-gray-400" />
            Preferensi Bahasa Edisi
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = languagePref === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLanguagePref(opt.value)}
                  disabled={isFetchingInfo}
                  aria-pressed={active}
                  className={cn(
                    "min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap cursor-pointer border",
                    active
                      ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSearchMetadata(hasSearched)}
            disabled={!canSearch || isFetchingInfo}
            className="gap-2 bg-white flex-1 sm:flex-initial min-h-[44px]"
          >
            {isFetchingInfo ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : hasSearched ? (
              <RefreshCw className="w-4 h-4" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>{isFetchingInfo ? "Mencari..." : hasSearched ? "Cari Ulang" : "Cari Katalog Buku"}</span>
          </Button>

          {hasAutofillData && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClearAutofill}
              disabled={isFetchingInfo}
              className="gap-2 text-gray-600 hover:text-gray-900 min-h-[44px]"
            >
              <Eraser className="w-4 h-4" />
              <span>Bersihkan Data</span>
            </Button>
          )}
        </div>

        {statusMessage ? (
          <p className="text-xs text-gray-600 font-mono leading-relaxed flex items-start gap-2">
            {isFetchingInfo && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5 text-gray-500" />}
            <span>{statusMessage}</span>
          </p>
        ) : (
          <p className="text-xs text-gray-500 leading-relaxed">
            Mengambil data edisi faktual dari Open Library, Digital Archive, dan Google Books. Kolom tetap kosong jika belum tercatat di katalog.
          </p>
        )}

        {/* Candidate Picker (Always manual selection) */}
        {candidates.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 font-display">
                Pilih Edisi Secara Manual ({candidates.length})
              </span>
              <button
                type="button"
                onClick={() => setCandidates([])}
                className="text-xs text-gray-500 hover:text-gray-900 min-h-[44px] px-2 inline-flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Tutup daftar
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {candidates.map((candidate) => {
                const isSelected = selectedCandidateId === candidate.id;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => applyCandidate(candidate)}
                    aria-pressed={isSelected}
                    className={cn(
                      "w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-3 min-h-[68px] cursor-pointer",
                      isSelected
                        ? "border-gray-900 bg-white shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-400"
                    )}
                  >
                    <div className="w-10 h-14 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0 relative flex items-center justify-center">
                      {candidate.coverUrl ? (
                        <img
                          src={candidate.coverUrl}
                          alt={candidate.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover relative z-10"
                          onLoad={(e) => {
                            if (
                              e.currentTarget.naturalWidth <= 1 ||
                              e.currentTarget.naturalHeight <= 1
                            ) {
                              e.currentTarget.style.display = "none";
                            }
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null}
                      <Book className="w-4 h-4 text-gray-300 absolute z-0" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="text-sm font-semibold text-gray-900 font-display line-clamp-1">
                        {candidate.title}
                      </div>
                      <MetadataRow
                        items={[
                          candidate.author || "Penulis tidak diketahui",
                          candidate.totalPages > 0 ? `${candidate.totalPages} hal` : "Hal. belum tercatat",
                          formatLanguageLabel(candidate.language),
                          candidate.publisher || null,
                          candidate.publishedYear || null,
                          candidate.isbn ? `ISBN ${candidate.isbn}` : null,
                          candidate.source,
                        ]}
                      />
                    </div>

                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "bg-gray-900 border-gray-900 text-white"
                          : "border-gray-200 text-transparent"
                      )}
                      aria-hidden="true"
                    >
                      <Check className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pages & Cover Live Preview */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-start">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={pagesInputId} className="text-sm font-medium text-gray-700">
              Total Halaman
            </label>
            <input
              id={pagesInputId}
              value={totalPages}
              onChange={(e) => {
                onTotalPagesChange(e.target.value);
                onIsEstimatedPagesChange(false);
              }}
              type="number"
              min="1"
              className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-gray-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
              placeholder="Contoh: 320"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={coverInputId} className="text-sm font-medium text-gray-700">
              URL Sampul Buku (Opsional)
            </label>
            <input
              id={coverInputId}
              value={coverUrl}
              onChange={(e) => onCoverUrlChange(e.target.value)}
              type="url"
              className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
              placeholder="https://..."
            />
            {coverStatus === "error" && coverUrl.trim() && (
              <div className="flex items-center justify-between gap-2 pt-1 text-xs text-gray-700">
                <span className="flex items-center gap-1.5 font-mono">
                  <AlertCircle className="w-3.5 h-3.5 text-gray-900 shrink-0" />
                  Gambar sampul kosong (1×1), rusak, atau URL tidak valid.
                </span>
                <button
                  type="button"
                  onClick={() => onCoverUrlChange("")}
                  className="text-xs font-medium text-gray-900 underline hover:no-underline shrink-0 min-h-[44px] px-1 cursor-pointer"
                >
                  Hapus URL
                </button>
              </div>
            )}
            {coverStatus === "loaded" && (
              <p className="text-xs text-gray-500 font-mono">Pratinjau sampul valid dan siap disimpan.</p>
            )}
          </div>
        </div>

        {/* Cover Preview Box */}
        <div className="space-y-1.5 sm:pt-6">
          <span className="text-xs font-mono text-gray-500 block sm:hidden">Pratinjau Sampul</span>
          <div className="w-24 aspect-[2/3] rounded-xl border border-gray-200 bg-gray-100 overflow-hidden relative flex flex-col items-center justify-center text-center mx-auto sm:mx-0">
            {coverUrl.trim() && coverStatus !== "error" ? (
              <img
                key={coverUrl.trim()}
                src={coverUrl.trim()}
                alt={title.trim() || "Pratinjau sampul buku"}
                referrerPolicy="no-referrer"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth <= 1 || img.naturalHeight <= 1) {
                    setCoverStatus("error");
                  } else {
                    setCoverStatus("loaded");
                  }
                }}
                onError={() => setCoverStatus("error")}
                className={cn(
                  "absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-200",
                  coverStatus === "loaded" ? "opacity-100" : "opacity-0"
                )}
              />
            ) : null}

            <div className="p-2 flex flex-col items-center justify-center text-gray-400 z-0">
              {coverStatus === "loading" ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              ) : coverStatus === "error" ? (
                <>
                  <AlertCircle className="w-5 h-5 text-gray-500 mb-1" />
                  <span className="text-[10px] font-mono text-gray-500">Rusak</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-5 h-5 text-gray-300 mb-1" />
                  <span className="text-[10px] font-mono text-gray-400">Sampul</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
