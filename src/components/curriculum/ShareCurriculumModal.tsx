import React, { useState } from 'react';
import { Share2, Copy, Download, Check, FileText, BookOpen, Layers } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { LearningPath, Phase, Competency, Book } from '../../types';
import { useLibraryStore } from '../../store/libraryStore';
import { useToastStore } from '../../store/toastStore';
import { saveAs } from 'file-saver';

interface ShareCurriculumModalProps {
  isOpen: boolean;
  onClose: () => void;
  path: LearningPath;
  phases: Phase[];
  competencies: Competency[];
  books: Book[];
}

export function ShareCurriculumModal({
  isOpen,
  onClose,
  path,
  phases,
  competencies,
  books,
}: ShareCurriculumModalProps) {
  const [copiedType, setCopiedType] = useState<'md' | 'json' | null>(null);
  const addToast = useToastStore((state) => state.addToast);
  const authors = useLibraryStore((state) => state.authors);
  const categories = useLibraryStore((state) => state.categories);

  const getAuthorName = (authorId: string | null) => {
    if (!authorId) return 'Anonim';
    return authors.find((a) => a.id === authorId)?.name || 'Anonim';
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Umum';
    return categories.find((c) => c.id === categoryId)?.name || 'Umum';
  };

  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

  // Ambil buku yang terkait dengan kompetensi dalam kurikulum ini
  const associatedBookIds = new Set<string>();
  competencies.forEach((c) => {
    c.bookIds?.forEach((bId) => associatedBookIds.add(bId));
  });
  const referencedBooks = books.filter((b) => associatedBookIds.has(b.id));

  // 1. Format JSON Silabus Portabel
  const buildCurriculumJson = () => {
    return {
      _madrasah_curriculum: true,
      version: 1,
      exportedAt: new Date().toISOString(),
      path: {
        title: path.title,
        description: path.description || '',
      },
      phases: sortedPhases.map((phase) => {
        const phaseComps = competencies
          .filter((c) => c.phaseId === phase.id)
          .sort((a, b) => a.order - b.order);

        return {
          title: phase.title,
          order: phase.order,
          competencies: phaseComps.map((comp) => {
            const compBooks = books
              .filter((b) => comp.bookIds?.includes(b.id))
              .map((b) => ({
                title: b.title,
                author: getAuthorName(b.authorId),
                category: getCategoryName(b.categoryId),
              }));
            return {
              title: comp.title,
              order: comp.order,
              books: compBooks,
            };
          }),
        };
      }),
      recommendedBooks: referencedBooks.map((b) => ({
        title: b.title,
        author: getAuthorName(b.authorId),
        category: getCategoryName(b.categoryId),
      })),
    };
  };

  // 2. Format Markdown Silabus Rapi
  const buildCurriculumMarkdown = () => {
    let md = `# Silabus Belajar: ${path.title}\n\n`;
    if (path.description) {
      md += `> ${path.description}\n\n`;
    }
    md += `*Diekspor dari Madrasah — Personal Knowledge OS pada ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}*\n\n`;
    md += `---\n\n`;

    sortedPhases.forEach((phase, pIdx) => {
      md += `## Fase ${pIdx + 1}: ${phase.title}\n\n`;
      const phaseComps = competencies
        .filter((c) => c.phaseId === phase.id)
        .sort((a, b) => a.order - b.order);

      if (phaseComps.length === 0) {
        md += `*(Belum ada target kompetensi di fase ini)*\n\n`;
      } else {
        phaseComps.forEach((comp) => {
          md += `- [ ] **${comp.title}**\n`;
          const compBooks = books.filter((b) => comp.bookIds?.includes(b.id));
          if (compBooks.length > 0) {
            compBooks.forEach((b) => {
              md += `  - 📖 Rujukan: *${b.title}* (${getAuthorName(b.authorId)})\n`;
            });
          }
        });
        md += `\n`;
      }
    });

    if (referencedBooks.length > 0) {
      md += `## Daftar Rujukan Pustaka\n\n`;
      referencedBooks.forEach((b) => {
        md += `- **${b.title}** — ${getAuthorName(b.authorId)} (${getCategoryName(b.categoryId)})\n`;
      });
      md += `\n`;
    }

    return md;
  };

  const handleCopyMarkdown = async () => {
    try {
      const md = buildCurriculumMarkdown();
      await navigator.clipboard.writeText(md);
      setCopiedType('md');
      addToast({ type: 'success', message: 'Silabus format Markdown disalin ke clipboard.' });
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      addToast({ type: 'error', message: 'Gagal menyalin ke clipboard.' });
    }
  };

  const handleCopyJson = async () => {
    try {
      const json = JSON.stringify(buildCurriculumJson(), null, 2);
      await navigator.clipboard.writeText(json);
      setCopiedType('json');
      addToast({ type: 'success', message: 'Payload JSON silabus disalin ke clipboard.' });
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      addToast({ type: 'error', message: 'Gagal menyalin ke clipboard.' });
    }
  };

  const handleDownloadJson = () => {
    try {
      const json = JSON.stringify(buildCurriculumJson(), null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const filename = `${path.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-silabus.json`;
      saveAs(blob, filename);
      addToast({ type: 'success', message: `Berkas silabus ${filename} berhasil diunduh.` });
    } catch {
      addToast({ type: 'error', message: 'Gagal mengunduh berkas silabus.' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} maxWidthClass="max-w-xl">
      <DialogHeader>
        <DialogTitle className="text-gray-900 flex items-center gap-2 font-display">
          <Share2 className="w-5 h-5 text-gray-500" />
          Bagikan Silabus Belajar &amp; Pustaka
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-5 py-4">
        {/* Ringkasan Kurikulum */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-500 font-mono">
            <span>KURIKULUM KOLABORATIF</span>
            <span>{sortedPhases.length} FASE · {competencies.length} KOMPETENSI</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-base">{path.title}</h3>
            {path.description && (
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{path.description}</p>
            )}
          </div>
          {referencedBooks.length > 0 && (
            <div className="pt-2 border-t border-gray-200 flex items-center gap-2 text-xs text-gray-600 font-mono">
              <BookOpen className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span>{referencedBooks.length} buku rujukan pustaka tertaut</span>
            </div>
          )}
        </div>

        {/* Opsi Berbagi & Ekspor */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">
            Pilihan Format Berbagi
          </h4>

          <div className="grid grid-cols-1 gap-2.5">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="w-full text-left p-3.5 rounded-xl border border-gray-200 hover:border-gray-900 bg-white hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-500 group-hover:text-gray-900" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Salin Format Markdown</div>
                  <div className="text-xs text-gray-500">
                    Siap diposting di forum, catatan belajar, atau dibagikan ke teman pembelajar.
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md flex items-center gap-1 shrink-0">
                {copiedType === 'md' ? <Check className="w-3.5 h-3.5 text-gray-900" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedType === 'md' ? 'Tersalin' : 'Salin'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleDownloadJson}
              className="w-full text-left p-3.5 rounded-xl border border-gray-200 hover:border-gray-900 bg-white hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-gray-500 group-hover:text-gray-900" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Unduh Berkas Silabus (.json)</div>
                  <div className="text-xs text-gray-500">
                    Format portabel Madrasah yang dapat diimpor langsung oleh pengguna lain.
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md flex items-center gap-1 shrink-0">
                <Download className="w-3.5 h-3.5" />
                Unduh
              </span>
            </button>

            <button
              type="button"
              onClick={handleCopyJson}
              className="w-full text-left p-3.5 rounded-xl border border-gray-200 hover:border-gray-900 bg-white hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-gray-500 group-hover:text-gray-900" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Salin Struktur JSON</div>
                  <div className="text-xs text-gray-500">
                    Salin teks data mentah untuk dibagikan via chat atau pesan instan.
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md flex items-center gap-1 shrink-0">
                {copiedType === 'json' ? <Check className="w-3.5 h-3.5 text-gray-900" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedType === 'json' ? 'Tersalin' : 'Salin'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
          Tutup
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
