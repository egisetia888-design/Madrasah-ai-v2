import React, { useState } from 'react';
import { FileDown, Printer, BookOpen, Check, Copy, Settings2, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Draft } from '../../types';
import { useToastStore } from '../../store/toastStore';
import { saveAs } from 'file-saver';

interface ExportLiteraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft: Draft;
  currentTitle: string;
  currentContent: string;
}

export function ExportLiteraryModal({
  isOpen,
  onClose,
  draft,
  currentTitle,
  currentContent,
}: ExportLiteraryModalProps) {
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif');
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'options'>('preview');

  const addToast = useToastStore((state) => state.addToast);

  const displayTitle = currentTitle.trim() || draft.title.trim() || 'Tanpa Judul';
  const wordCount = currentContent.split(/\s+/).filter((w) => w.length > 0).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  // 1. Ekspor Naskah Bersih ke Print Window (Untuk Simpan PDF / Cetak Tipografis)
  const handlePrintCleanPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast({
        type: 'error',
        message: 'Gagal membuka jendela cetak. Pastikan pop-up diizinkan di peramban Anda.',
      });
      return;
    }

    const fontStyle =
      fontFamily === 'serif'
        ? "font-family: Georgia, Cambria, 'Times New Roman', Times, serif;"
        : "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;";

    const fontSizeStyle = fontSize === 'large' ? 'font-size: 18px; line-height: 1.8;' : 'font-size: 16px; line-height: 1.75;';

    const safeTitle = displayTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const formattedParagraphs = currentContent
      .split(/\n\n+/)
      .map((p) => `<p>${p.replace(/\n/g, '<br/>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
      .join('');

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle} — Edisi Cetak</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 2.5cm 2cm 2.5cm 2cm;
      @bottom-right {
        content: counter(page);
      }
    }
    body {
      color: #111827;
      background: #ffffff;
      ${fontStyle}
      ${fontSizeStyle}
      max-width: 700px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    .header {
      margin-bottom: 2.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #e5e7eb;
    }
    h1 {
      font-size: 2.25rem;
      line-height: 1.25;
      font-weight: 700;
      letter-spacing: -0.025em;
      margin: 0 0 0.75rem 0;
      color: #111827;
    }
    .meta {
      font-size: 0.875rem;
      color: #6b7280;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .content p {
      margin-bottom: 1.25rem;
      text-align: justify;
      hyphens: auto;
    }
    .footer {
      margin-top: 3.5rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e7eb;
      font-size: 0.75rem;
      color: #9ca3af;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      text-align: center;
    }
    @media print {
      body {
        max-width: 100%;
        padding: 0;
      }
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${safeTitle}</h1>
    ${
      includeMetadata
        ? `<div class="meta">
        <span>Karya Literer · Madrasah</span>
        <span>•</span>
        <span>${wordCount} kata (${readingTime} menit baca)</span>
        <span>•</span>
        <span>${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</span>
      </div>`
        : ''
    }
  </div>

  <div class="content">
    ${formattedParagraphs}
  </div>

  <div class="footer">
    Dicetak dari Madrasah — Personal Knowledge Operating System
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 300);
    });
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    onClose();
  };

  // 2. Ekspor E-Book Mandiri (Standalone HTML untuk Pembaca Luring / E-Reader)
  const handleDownloadStandaloneHtml = () => {
    try {
      const safeTitle = displayTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const formattedParagraphs = currentContent
        .split(/\n\n+/)
        .map((p) => `<p>${p.replace(/\n/g, '<br/>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
        .join('');

      const fontStyle =
        fontFamily === 'serif'
          ? "font-family: Georgia, Cambria, 'Times New Roman', serif;"
          : "font-family: system-ui, -apple-system, sans-serif;";

      const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    :root {
      --bg: #fafafa;
      --card: #ffffff;
      --text: #171717;
      --meta: #737373;
      --border: #e5e5e5;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #121212;
        --card: #1e1e1e;
        --text: #ededed;
        --meta: #a3a3a3;
        --border: #2e2e2e;
      }
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      ${fontStyle}
      font-size: 17px;
      line-height: 1.8;
      margin: 0;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
    }
    article {
      max-width: 680px;
      width: 100%;
      background: var(--card);
      padding: 48px;
      border-radius: 16px;
      border: 1px solid var(--border);
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    @media (max-width: 640px) {
      article {
        padding: 24px 20px;
      }
    }
    h1 {
      font-size: 2rem;
      line-height: 1.3;
      margin: 0 0 16px 0;
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 700;
    }
    .meta {
      font-size: 13px;
      color: var(--meta);
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
      font-family: system-ui, -apple-system, sans-serif;
    }
    p {
      margin: 0 0 20px 0;
      text-align: justify;
    }
    footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--meta);
      text-align: center;
      font-family: system-ui, -apple-system, sans-serif;
    }
  </style>
</head>
<body>
  <article>
    <header>
      <h1>${safeTitle}</h1>
      <div class="meta">
        ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })} · ${wordCount} kata (${readingTime} menit baca)
      </div>
    </header>
    <section>
      ${formattedParagraphs}
    </section>
    <footer>
      Diterbitkan via Madrasah — Personal Knowledge OS
    </footer>
  </article>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const filename = `${displayTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'naskah'}-edisi-literer.html`;

      saveAs(blob, filename);
      addToast({
        type: 'success',
        message: `E-book literer "${filename}" berhasil diunduh.`,
      });
      onClose();
    } catch (err) {
      console.error(err);
      addToast({
        type: 'error',
        message: 'Gagal mengunduh berkas e-book.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} maxWidthClass="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="text-gray-900 flex items-center gap-2 font-display">
          <BookOpen className="w-5 h-5 text-gray-500" />
          Ekspor Literer &amp; Tipografi Naskah
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* Tab Navigasi Sederhana */}
        <div className="flex border-b border-gray-200 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 px-3 border-b-2 font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'preview'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Pratinjau Tipografi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('options')}
            className={`pb-2.5 px-3 border-b-2 font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'options'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Opsi Tata Letak
          </button>
        </div>

        {activeTab === 'preview' ? (
          /* Pratinjau Buku */
          <div className="bg-white border border-gray-200 rounded-xl p-6 max-h-[360px] overflow-y-auto shadow-inner">
            <h2 className="text-xl font-bold text-gray-900 mb-2 font-display">{displayTitle}</h2>
            {includeMetadata && (
              <div className="text-xs text-gray-500 font-mono mb-4 pb-3 border-b border-gray-100 flex items-center gap-2">
                <span>Karya Literer</span>
                <span>•</span>
                <span>{wordCount} kata</span>
                <span>•</span>
                <span>{readingTime} menit baca</span>
              </div>
            )}
            <div
              className={`text-gray-800 space-y-3 ${
                fontFamily === 'serif' ? 'font-serif' : 'font-sans'
              } ${fontSize === 'large' ? 'text-base leading-relaxed' : 'text-sm leading-relaxed'}`}
            >
              {currentContent ? (
                currentContent
                  .split(/\n\n+/)
                  .slice(0, 4)
                  .map((p, idx) => <p key={idx}>{p}</p>)
              ) : (
                <p className="text-gray-400 italic">Belum ada konten tulisan di naskah ini.</p>
              )}
              {currentContent.split(/\n\n+/).length > 4 && (
                <p className="text-xs text-gray-400 font-mono italic pt-2">
                  ... dan {currentContent.split(/\n\n+/).length - 4} paragraf berikutnya
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Opsi Tata Letak Tipografi */
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono block mb-1.5">
                  Keluarga Huruf (Font)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFontFamily('serif')}
                    className={`py-2 px-3 text-xs rounded-xl border font-serif flex items-center justify-center gap-1.5 cursor-pointer ${
                      fontFamily === 'serif'
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Serif Klasik
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontFamily('sans')}
                    className={`py-2 px-3 text-xs rounded-xl border font-sans flex items-center justify-center gap-1.5 cursor-pointer ${
                      fontFamily === 'sans'
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Sans Modern
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono block mb-1.5">
                  Ukuran Huruf
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFontSize('normal')}
                    className={`py-2 px-3 text-xs rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer ${
                      fontSize === 'normal'
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Standar (16px)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSize('large')}
                    className={`py-2 px-3 text-xs rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer ${
                      fontSize === 'large'
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Besar (18px)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="includeMeta"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <label htmlFor="includeMeta" className="text-xs text-gray-600 cursor-pointer">
                Sertakan tajuk metadata (jumlah kata, estimasi waktu baca, tanggal pembuatan).
              </label>
            </div>
          </div>
        )}

        {/* Format Pilihan Unduh / Cetak */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handlePrintCleanPdf}
            className="p-3.5 rounded-xl border border-gray-200 hover:border-gray-900 bg-white hover:bg-gray-50 text-left transition-colors flex items-start gap-3 group cursor-pointer"
          >
            <Printer className="w-5 h-5 text-gray-500 group-hover:text-gray-900 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-gray-900">Cetak / Simpan PDF Literer</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                Membuka tata letak cetak bersih format buku tanpa elemen antarmuka aplikasi.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleDownloadStandaloneHtml}
            className="p-3.5 rounded-xl border border-gray-200 hover:border-gray-900 bg-white hover:bg-gray-50 text-left transition-colors flex items-start gap-3 group cursor-pointer"
          >
            <FileDown className="w-5 h-5 text-gray-500 group-hover:text-gray-900 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-gray-900">Unduh E-Book Standalone (.html)</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                Berkas mandiri portabel yang dapat dibaca luring di browser atau perangkat e-reader.
              </div>
            </div>
          </button>
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
