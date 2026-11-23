import { useEffect, useState } from "react";
import {
  AlertCircle,
  Book,
  Check,
  Eraser,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { fetchWithAuth } from "../../lib/api";
import { useToastStore } from "../../store/toastStore";
import { BookCandidate, BookInfoResponse } from "../../types";
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
  resetTrigger?: boolean | string;
}

type CoverLoadStatus = "idle" | "loading" | "loaded" | "error";

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
  resetTrigger,
}: BookMetadataFieldsProps) {
  const addToast = useToastStore((state) => state.addToast);
  const updateToast = useToastStore((state) => state.updateToast);

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
    if (candidate.totalPages > 0) {
      onTotalPagesChange(String(candidate.totalPages));
      onIsEstimatedPagesChange(Boolean(candidate.isEstimated));
    } else {
      onTotalPagesChange("");
      onIsEstimatedPagesChange(false);
    }
    onCoverUrlChange(candidate.coverUrl || "");
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
    if (!canSearch) {
      addToast({ type: "info", message: "Masukkan judul buku atau ISBN terlebih dahulu." });
      return;
    }

    setIsFetchingInfo(true);
    setStatusMessage("Memulai pencarian metadata buku...");
    const toastId = addToast({ type: "loading", message: "Mencari metadata edisi buku..." });

    try {
      const res = await fetchWithAuth("/api/ai/book-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/x-ndjson",
        },
        body: JSON.stringify({
          title: title.trim(),
          author: authorName.trim(),
          isbn: isbn.trim(),
          forceRefresh,
        }),
      });

      if (!res.ok) {
        let errMsg = "Gagal mencari metadata buku.";
        try {
          const text = await res.text();
          const parsedErr = JSON.parse(text).error;
          errMsg = typeof parsedErr === "string" ? parsedErr : parsedErr?.message || errMsg;
        } catch {
          // ignore JSON parse failure
        }
        setStatusMessage(errMsg);
        updateToast(toastId, { type: "error", message: errMsg });
        return;
      }

      if (!res.body) throw new Error("Respons server kosong.");
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
            if (parsed.type === "log") {
              setStatusMessage(parsed.message);
              updateToast(toastId, { type: "loading", message: parsed.message });
            } else if (parsed.type === "result") {
              finalData = parsed.data as BookInfoResponse;
            } else if (parsed.type === "error") {
              const errText =
                typeof parsed.error === "string"
                  ? parsed.error
                  : parsed.error?.message || "Gagal mencari metadata buku.";
              setStatusMessage(errText);
              updateToast(toastId, { type: "error", message: errText });
              return;
            }
          } catch {
            // ignore partial stream chunk
          }
        }
      }

      setHasSearched(true);

      if (finalData) {
        const foundCandidates = Array.isArray(finalData.candidates) ? finalData.candidates : [];
        setCandidates(foundCandidates);
        setSelectedCandidateId(null);

        if (foundCandidates.length === 0) {
          const emptyMsg = "Tidak ditemukan edisi yang cocok persis. Silakan periksa ejaan judul/ISBN atau isi secara manual.";
          setStatusMessage(emptyMsg);
          updateToast(toastId, { type: "info", message: emptyMsg });
        } else {
          // Pre-select candidate if only 1 exact match or let user pick clearly from 3-5
          const msg =
            foundCandidates.length === 1
              ? "1 edisi ditemukan dan langsung diterapkan. Periksa kembali sebelum menyimpan."
              : `${foundCandidates.length} kandidat edisi ditemukan. Pilih edisi yang paling sesuai.`;
          setStatusMessage(msg);
          if (foundCandidates.length === 1) {
            applyCandidate(foundCandidates[0]);
          }
          updateToast(toastId, {
            type: foundCandidates[0]?.isEstimated ? "info" : "success",
            message: msg,
          });
        }
      }
    } catch (error) {
      console.error("Metadata fetch failed:", error);
      const errMsg = "Koneksi gagal saat mencari metadata buku.";
      setStatusMessage(errMsg);
      updateToast(toastId, { type: "error", message: errMsg });
    } finally {
      setIsFetchingInfo(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">
          Judul Buku <span className="text-gray-500">*</span>
        </label>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          type="text"
          className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
          placeholder="Contoh: Atomic Habits"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Penulis</label>
          <input
            value={authorName}
            onChange={(e) => onAuthorNameChange(e.target.value)}
            type="text"
            className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
            placeholder="Contoh: James Clear"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            ISBN <span className="text-xs font-normal text-gray-400">(Opsional, lebih presisi)</span>
          </label>
          <input
            value={isbn}
            onChange={(e) => onIsbnChange(e.target.value)}
            type="text"
            inputMode="numeric"
            className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-gray-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
            placeholder="Contoh: 9780735211292"
          />
        </div>
      </div>

      {/* Autofill Actions Bar */}
      <div className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50/70 space-y-3">
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
            <span>{isFetchingInfo ? "Mencari..." : hasSearched ? "Cari Ulang" : "Cari Metadata Otomatis"}</span>
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
            Pencarian memprioritaskan kesesuaian judul, penulis, dan ISBN dari katalog publik serta penelusuran web AI.
          </p>
        )}

        {/* Candidate Picker (3-5 Editions) */}
        {candidates.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 font-display">
                Pilih Edisi yang Sesuai ({candidates.length})
              </span>
              <button
                type="button"
                onClick={() => setCandidates([])}
                className="text-xs text-gray-500 hover:text-gray-900 min-h-[36px] px-2 inline-flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Tutup daftar
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {candidates.map((candidate) => {
                const isSelected = selectedCandidateId === candidate.id;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => applyCandidate(candidate)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-3 min-h-[64px] cursor-pointer",
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
            <label className="text-sm font-medium text-gray-700">Total Halaman</label>
            <input
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
            {isEstimatedPages && totalPages && (
              <p className="text-xs text-gray-500 font-mono">
                Diperoleh dari penelusuran AI — periksa ke buku fisik sebelum disimpan.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">URL Sampul Buku (Opsional)</label>
            <input
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
                  Gambar sampul gagal dimuat atau URL tidak valid.
                </span>
                <button
                  type="button"
                  onClick={() => onCoverUrlChange("")}
                  className="text-xs font-medium text-gray-900 underline hover:no-underline shrink-0 min-h-[36px] px-1 cursor-pointer"
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
                onLoad={() => setCoverStatus("loaded")}
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
