import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, BookOpen, Layers, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { useCurriculumStore } from '../../store/curriculumStore';
import { useLibraryStore } from '../../store/libraryStore';
import { useToastStore } from '../../store/toastStore';
import { useNavigate } from 'react-router-dom';

interface ImportCurriculumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedCurriculum {
  title: string;
  description: string;
  phases: {
    title: string;
    order?: number;
    competencies: {
      title: string;
      order?: number;
      books?: { title: string; author?: string; category?: string }[];
    }[];
  }[];
  recommendedBooks?: { title: string; author?: string; category?: string }[];
}

export function ImportCurriculumModal({ isOpen, onClose }: ImportCurriculumModalProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jsonText, setJsonText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedCurriculum | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [autoAddBooks, setAutoAddBooks] = useState(true);

  const addPath = useCurriculumStore((state) => state.addPath);
  const addPhase = useCurriculumStore((state) => state.addPhase);
  const addCompetency = useCurriculumStore((state) => state.addCompetency);
  const addBook = useLibraryStore((state) => state.addBook);
  const addAuthor = useLibraryStore((state) => state.addAuthor);
  const addCategory = useLibraryStore((state) => state.addCategory);
  const existingBooks = useLibraryStore((state) => state.books);
  const existingAuthors = useLibraryStore((state) => state.authors);
  const existingCategories = useLibraryStore((state) => state.categories);
  const addToast = useToastStore((state) => state.addToast);

  const validateAndSetData = (rawText: string) => {
    setJsonText(rawText);
    setParseError(null);

    if (!rawText.trim()) {
      setParsedData(null);
      return;
    }

    try {
      const json = JSON.parse(rawText);
      let title = '';
      let description = '';
      let phases: any[] = [];
      let recommendedBooks: any[] = [];

      // Mendukung format ekspor resmi Madrasah
      if (json._madrasah_curriculum && json.path) {
        title = json.path.title || '';
        description = json.path.description || '';
        phases = Array.isArray(json.phases) ? json.phases : [];
        recommendedBooks = Array.isArray(json.recommendedBooks) ? json.recommendedBooks : [];
      } else if (json.title && Array.isArray(json.phases)) {
        // Format alternatif/umum
        title = json.title;
        description = json.description || '';
        phases = json.phases;
        recommendedBooks = Array.isArray(json.recommendedBooks) ? json.recommendedBooks : [];
      } else {
        throw new Error('Format berkas tidak dikenali. Pastikan berkas memiliki properti title dan phases.');
      }

      if (!title.trim()) {
        throw new Error('Judul kurikulum tidak boleh kosong.');
      }

      const cleanPhases = phases.map((p, idx) => ({
        title: p.title || `Fase ${idx + 1}`,
        order: typeof p.order === 'number' ? p.order : idx,
        competencies: Array.isArray(p.competencies)
          ? p.competencies.map((c: any, cIdx: number) => ({
              title: typeof c === 'string' ? c : c.title || `Kompetensi ${cIdx + 1}`,
              order: typeof c?.order === 'number' ? c.order : cIdx,
              books: Array.isArray(c?.books) ? c.books : [],
            }))
          : [],
      }));

      setParsedData({
        title,
        description,
        phases: cleanPhases,
        recommendedBooks,
      });
    } catch (err: any) {
      setParsedData(null);
      setParseError(err?.message || 'Format JSON tidak valid.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      validateAndSetData(content);
    };
    reader.onerror = () => {
      setParseError('Gagal membaca berkas yang dipilih.');
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!parsedData) return;

    setIsImporting(true);
    try {
      const newPathId = crypto.randomUUID();

      // 1. Tambah Kurikulum Utama
      addPath({
        id: newPathId,
        title: parsedData.title,
        description: parsedData.description,
      });

      // Peta buku yang diimpor ke pustaka lokal
      const bookTitleToIdMap = new Map<string, string>();

      if (autoAddBooks && parsedData.recommendedBooks && parsedData.recommendedBooks.length > 0) {
        parsedData.recommendedBooks.forEach((recBook) => {
          const cleanTitle = recBook.title?.trim();
          if (!cleanTitle) return;

          // Cek apakah buku sudah ada di pustaka
          const existing = existingBooks.find(
            (b) => b.title.toLowerCase() === cleanTitle.toLowerCase()
          );

          if (existing) {
            bookTitleToIdMap.set(cleanTitle.toLowerCase(), existing.id);
          } else {
            let authorId: string | null = null;
            if (recBook.author?.trim()) {
              const existingAuthor = existingAuthors.find(
                (a) => a.name.toLowerCase() === recBook.author!.trim().toLowerCase()
              );
              authorId = existingAuthor ? existingAuthor.id : addAuthor(recBook.author.trim());
            }

            let categoryId: string | null = null;
            if (recBook.category?.trim()) {
              const existingCategory = existingCategories.find(
                (c) => c.name.toLowerCase() === recBook.category!.trim().toLowerCase()
              );
              categoryId = existingCategory ? existingCategory.id : addCategory(recBook.category.trim());
            }

            const newBookId = addBook({
              title: cleanTitle,
              authorId,
              categoryId,
              status: 'wishlist',
              progress: 0,
            });
            bookTitleToIdMap.set(cleanTitle.toLowerCase(), newBookId);
          }
        });
      }

      // 2. Tambah Setiap Fase & Kompetensinya
      parsedData.phases.forEach((phaseData, phaseIdx) => {
        const newPhaseId = crypto.randomUUID();
        addPhase({
          id: newPhaseId,
          pathId: newPathId,
          title: phaseData.title,
          order: phaseData.order ?? phaseIdx,
        });

        phaseData.competencies.forEach((compData, compIdx) => {
          const linkedBookIds: string[] = [];

          if (compData.books && compData.books.length > 0) {
            compData.books.forEach((b) => {
              const matchedId = bookTitleToIdMap.get(b.title?.trim().toLowerCase());
              if (matchedId) linkedBookIds.push(matchedId);
            });
          }

          addCompetency({
            id: crypto.randomUUID(),
            phaseId: newPhaseId,
            title: compData.title,
            order: compData.order ?? compIdx,
            status: 'not-started',
            bookIds: linkedBookIds,
            outputIds: [],
          } as any);
        });
      });

      addToast({
        type: 'success',
        message: `Silabus "${parsedData.title}" berhasil diimpor ke koleksi Anda.`,
      });

      onClose();
      navigate(`/curriculum/${newPathId}`);
    } catch (err: any) {
      console.error('Import error:', err);
      addToast({
        type: 'error',
        message: err?.message || 'Terjadi kesalahan saat mengimpor silabus.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const totalCompetencies = parsedData?.phases.reduce(
    (sum, p) => sum + p.competencies.length,
    0
  ) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose} maxWidthClass="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="text-gray-900 flex items-center gap-2 font-display">
          <Upload className="w-5 h-5 text-gray-500" />
          Impor Silabus Kolaboratif
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-5 py-4">
        <p className="text-sm text-gray-600">
          Impor silabus belajar dan daftar rujukan buku yang dibagikan oleh komunitas atau rekan pembelajar.
        </p>

        {/* File Picker & Paste Area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">
              Tempel Payload JSON atau Unggah Berkas
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 gap-1.5 text-xs text-gray-700 border-gray-200 hover:bg-gray-50"
            >
              <Upload className="w-3.5 h-3.5" />
              Pilih Berkas .json
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <textarea
            value={jsonText}
            onChange={(e) => validateAndSetData(e.target.value)}
            rows={5}
            placeholder='Tempelkan teks JSON silabus di sini (misal {"_madrasah_curriculum": true, ...})'
            className="w-full text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />

          {parseError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}
        </div>

        {/* Pratinjau Silabus Valid */}
        {parsedData && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs text-gray-500 font-mono">
              <span className="flex items-center gap-1.5 text-gray-900 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-gray-700" />
                FORMAT TERVERIFIKASI
              </span>
              <span>
                {parsedData.phases.length} FASE · {totalCompetencies} TARGET
              </span>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 text-base">{parsedData.title}</h3>
              {parsedData.description && (
                <p className="text-xs text-gray-600 mt-1">{parsedData.description}</p>
              )}
            </div>

            {parsedData.recommendedBooks && parsedData.recommendedBooks.length > 0 && (
              <div className="pt-3 border-t border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-700 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-gray-500" />
                    {parsedData.recommendedBooks.length} Buku Rujukan Termasuk
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="autoAddBooks"
                    checked={autoAddBooks}
                    onChange={(e) => setAutoAddBooks(e.target.checked)}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <label htmlFor="autoAddBooks" className="text-xs text-gray-600 cursor-pointer">
                    Tambahkan otomatis buku rekomendasi yang belum ada ke Pustaka saya (status: ingin dibaca).
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isImporting}>
          Batal
        </Button>
        <Button
          onClick={handleImport}
          disabled={!parsedData || isImporting}
          className="gap-2 bg-gray-900 text-white hover:bg-gray-800 min-h-[44px] md:min-h-[36px]"
        >
          <ArrowRight className="w-4 h-4" />
          {isImporting ? 'Mengimpor...' : 'Impor ke Kurikulum Saya'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
