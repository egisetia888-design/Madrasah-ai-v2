import React, { useState } from 'react';
import { Database, Download, Upload, Trash2, AlertTriangle, CheckCircle2, PlayCircle, FileText, Search, BrainCircuit, RefreshCw, Layers, Cloud, CloudOff, User, LogIn, LogOut, AlertCircle, Globe, Key, Send } from 'lucide-react';
import localforage from 'localforage';
import { Button } from '../../components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/Dialog';
import { useTourStore } from '../../store/tourStore';
import { useNotesStore } from '../../store/notesStore';
import { useLibraryStore } from '../../store/libraryStore';
import { useWritingStore } from '../../store/writingStore';
import { usePublishingStore } from '../../store/publishingStore';
import { migrateNotesToFragments, backfillUnverifiedAiRelations } from '../../utils/dataMigration';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { isFirebaseConfigured } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { syncAllLocalToCloud } from '../../lib/firestoreSync';
import { useToastStore } from '../../store/toastStore';
import { GlobalSyncBadge } from '../../components/ui/GlobalSyncBadge';

export function SettingsPage() {
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [mdExportStatus, setMdExportStatus] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  const startTour = useTourStore(state => state.startTour);
  const [indexStatus, setIndexStatus] = useState<string | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);

  const user = useAuthStore(state => state.user);
  const isCloudAuthenticated = useAuthStore(state => state.isCloudAuthenticated);
  const isAuthLoading = useAuthStore(state => state.isAuthLoading);
  const loginWithGoogle = useAuthStore(state => state.loginWithGoogle);
  const logout = useAuthStore(state => state.logout);
  const addToast = useToastStore(state => state.addToast);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleCloudSync = async () => {
    if (!isFirebaseConfigured) {
      addToast({ type: 'error', message: 'Firebase belum dikonfigurasi di environment aplikasi.' });
      return;
    }
    if (!user) {
      addToast({ type: 'info', message: 'Silakan hubungkan akun Google terlebih dahulu untuk sinkronisasi cloud.' });
      return;
    }
    setIsSyncing(true);
    setCloudSyncStatus('Menyinkronkan data lokal ke cloud Firestore...');
    try {
      const result = await syncAllLocalToCloud();
      setCloudSyncStatus(`Berhasil menyinkronkan ${result.successCount} entitas ke cloud.`);
      addToast({ type: 'success', message: `Sinkronisasi selesai (${result.successCount} data diselaraskan).` });
      setTimeout(() => setCloudSyncStatus(null), 5000);
    } catch (err: any) {
      console.error(err);
      setCloudSyncStatus(err?.message || 'Gagal melakukan sinkronisasi cloud.');
      addToast({ type: 'error', message: 'Gagal melakukan sinkronisasi cloud.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAuthAction = async () => {
    if (user) {
      try {
        await logout();
        addToast({ type: 'info', message: 'Berhasil keluar dari akun Google.' });
      } catch (err: any) {
        addToast({ type: 'error', message: 'Gagal keluar dari akun.' });
      }
    } else {
      try {
        await loginWithGoogle();
        addToast({ type: 'success', message: 'Berhasil menghubungkan akun Google.' });
      } catch (err: any) {
        addToast({ type: 'error', message: err?.message || 'Gagal menghubungkan akun Google.' });
      }
    }
  };

  const handleMigration = () => {
    try {
      const count = migrateNotesToFragments();
      if (count > 0) {
        setMigrationStatus(`Berhasil memigrasi ${count} catatan ke format SourceFragment baru.`);
      } else {
        setMigrationStatus("Tidak ada catatan yang perlu dimigrasi (sudah up-to-date).");
      }
      setTimeout(() => setMigrationStatus(null), 5000);
    } catch (err) {
      console.error(err);
      setMigrationStatus("Terjadi kesalahan saat memigrasi data.");
    }
  };

  const [aiBackfillStatus, setAiBackfillStatus] = useState<string | null>(null);

  const handleAiRelationBackfill = () => {
    try {
      const count = backfillUnverifiedAiRelations();
      if (count > 0) {
        setAiBackfillStatus(`Berhasil menormalkan ${count} relasi AI ke status 'belum diverifikasi'.`);
      } else {
        setAiBackfillStatus("Semua relasi AI sudah mematuhi kaidah Ta'dib (tidak ada anomali).");
      }
      setTimeout(() => setAiBackfillStatus(null), 5000);
    } catch (err) {
      console.error(err);
      setAiBackfillStatus("Terjadi kesalahan saat memeriksa relasi AI.");
    }
  };

  const publishingSettings = usePublishingStore();
  const [webhookUrlInput, setWebhookUrlInput] = useState(publishingSettings.webhookUrl);
  const [webhookSecretInput, setWebhookSecretInput] = useState(publishingSettings.webhookSecret);
  const [serviceNameInput, setServiceNameInput] = useState(publishingSettings.serviceName);
  const [testWebhookStatus, setTestWebhookStatus] = useState<string | null>(null);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  const handleSavePublishing = () => {
    publishingSettings.setPublishingSettings({
      webhookUrl: webhookUrlInput.trim(),
      webhookSecret: webhookSecretInput.trim(),
      serviceName: serviceNameInput.trim(),
    });
    addToast({ type: 'success', message: 'Konfigurasi webhook penerbitan berhasil disimpan.' });
  };

  const handleTestWebhook = async () => {
    const cleanUrl = webhookUrlInput.trim();
    if (!cleanUrl) {
      addToast({ type: 'error', message: 'Masukkan target Webhook URL terlebih dahulu.' });
      return;
    }
    setIsTestingWebhook(true);
    setTestWebhookStatus('Mengirim sinyal uji (ping) ke endpoint...');
    try {
      const response = await fetch('/api/publishing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: cleanUrl,
          secret: webhookSecretInput.trim() || undefined,
          payload: {
            event: 'webhook.ping',
            source: 'Madrasah Personal Knowledge OS',
            timestamp: new Date().toISOString(),
            message: 'Uji konektivitas webhook Madrasah.',
          },
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setTestWebhookStatus(`Koneksi Berhasil! Respons: HTTP ${data.status} ${data.statusText || 'OK'}`);
        addToast({ type: 'success', message: `Uji webhook berhasil (HTTP ${data.status}).` });
      } else {
        setTestWebhookStatus(`Koneksi Gagal: ${data.error || 'Endpoint menolak koneksi'}`);
        addToast({ type: 'error', message: data.error || 'Gagal terhubung ke webhook.' });
      }
    } catch (err: any) {
      setTestWebhookStatus(`Gagal: ${err.message || 'Kesalahan jaringan'}`);
      addToast({ type: 'error', message: err.message || 'Kesalahan jaringan.' });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleReindex = async () => {
    setIsIndexing(true);
    setIndexStatus("Menyiapkan pemindai...");
    try {
      const notesStore = useNotesStore.getState();
      const writingStore = useWritingStore.getState();
      
      const unindexedNotes = notesStore.notes.filter(n => !n.embedding);
      const unindexedDrafts = writingStore.drafts.filter(d => !d.embedding);
      
      const total = unindexedNotes.length + unindexedDrafts.length;
      
      if (total === 0) {
        setIndexStatus("Semua data sudah terindeks semantik.");
        setTimeout(() => setIndexStatus(null), 3000);
        return;
      }
      
      let processed = 0;
      
      for (const note of unindexedNotes) {
        setIndexStatus(`Mengindeks Catatan (${processed + 1}/${total})...`);
        await notesStore.indexNote(note.id);
        processed++;
      }
      
      for (const draft of unindexedDrafts) {
        setIndexStatus(`Mengindeks Draf (${processed + 1}/${total})...`);
        await writingStore.indexDraft(draft.id);
        processed++;
      }
      
      setIndexStatus("Indeks semantik berhasil diperbarui!");
      setTimeout(() => setIndexStatus(null), 3000);
    } catch (error) {
      console.error("Indexing failed:", error);
      setIndexStatus("Gagal memperbarui indeks.");
    } finally {
      setIsIndexing(false);
    }
  };

  const handleExport = async () => {
    try {
      setExportStatus('Mengekspor data...');
      const keys = await localforage.keys();
      const rawData: Record<string, any> = {};
      
      for (const key of keys) {
        rawData[key] = await localforage.getItem(key);
      }
      
      const exportPayload = {
        _madrasah_backup: true,
        version: 1,
        timestamp: new Date().toISOString(),
        data: rawData
      };
      
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `madrasah-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setExportStatus('Ekspor berhasil!');
      setTimeout(() => setExportStatus(null), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus('Gagal mengekspor data.');
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setImportStatus('Mengimpor data...');
        const json = event.target?.result as string;
        const parsed = JSON.parse(json);
        
        let dataToImport = parsed;
        
        // Schema Validation and Versioning Strategy
        if (parsed && typeof parsed === 'object' && parsed._madrasah_backup) {
          if (parsed.version > 1) {
            throw new Error("Versi backup lebih baru dari versi aplikasi.");
          }
          dataToImport = parsed.data;
        } else {
          // Legacy format fallback: validate it looks like a store dump
          if (typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error("Format JSON tidak dikenali.");
          }
          dataToImport = parsed;
        }
        
        const keys = Object.keys(dataToImport || {});
        if (keys.length === 0) {
          throw new Error("File backup kosong atau tidak valid.");
        }
        
        for (const [key, value] of Object.entries(dataToImport)) {
          await localforage.setItem(key, value);
        }
        
        setImportStatus('Impor berhasil! Silakan muat ulang halaman.');
        setTimeout(() => {
            window.location.reload();
        }, 1500);
      } catch (error) {
        console.error('Import failed:', error);
        setImportStatus('Gagal mengimpor. Format tidak valid.');
        setTimeout(() => setImportStatus(null), 3000);
      }
    };
    reader.readAsText(file);
  };

  const handleExportMarkdown = async () => {
    try {
      setMdExportStatus("Menyiapkan ZIP Markdown...");
      const zip = new JSZip();

      const notesFolder = zip.folder("Catatan");
      const notes = useNotesStore.getState().notes;
      const allTags = useNotesStore.getState().tags;
      const folders = useNotesStore.getState().folders;
      const books = useLibraryStore.getState().books;

      notes.forEach(note => {
        const noteFolder = note.folderId ? folders.find(f => f.id === note.folderId)?.name || "Uncategorized" : "Uncategorized";
        const noteTags = note.tags.map(tid => allTags.find(t => t.id === tid)?.name || tid).join(", ");
        const sourceBook = note.sourceId ? books.find(b => b.id === note.sourceId)?.title : "None";

        let mdContent = `---
`;
        mdContent += `title: ${note.title}
`;
        mdContent += `type: ${note.type}
`;
        mdContent += `status: ${note.status}
`;
        mdContent += `folder: ${noteFolder}
`;
        mdContent += `tags: [${noteTags}]
`;
        if (note.sourceId) mdContent += `source: ${sourceBook}
`;
        mdContent += `date_created: ${new Date(note.createdAt).toISOString()}
`;
        mdContent += `date_updated: ${new Date(note.updatedAt).toISOString()}
`;
        mdContent += `---

`;
        mdContent += `# ${note.title}

`;

        if (note.rawQuote) {
          mdContent += `## Kutipan Mentah
`;
          mdContent += `> ${note.rawQuote.split("\n").join("\n> ")}

`;
          if (note.referenceCitation) {
             mdContent += `**Sumber:** ${note.referenceCitation}

`;
          }
        }

        if (note.content) {
          mdContent += `## Konten
`;
          mdContent += `${note.content}
`;
        }

        notesFolder?.file(`${noteFolder}/${note.title.replace(/[^a-zA-Z0-9]/gi, "_").toLowerCase()}.md`, mdContent);
      });

      const writingFolder = zip.folder("Tulisan");
      const drafts = useWritingStore.getState().drafts;
      drafts.forEach(draft => {
        let mdContent = `---
`;
        mdContent += `title: ${draft.title}
`;
        mdContent += `status: ${draft.status}
`;
        mdContent += `date_created: ${new Date(draft.createdAt).toISOString()}
`;
        mdContent += `date_updated: ${new Date(draft.updatedAt).toISOString()}
`;
        mdContent += `---

`;
        mdContent += `# ${draft.title}

`;
        mdContent += `${draft.content}
`;

        writingFolder?.file(`${draft.title.replace(/[^a-zA-Z0-9]/gi, "_").toLowerCase()}.md`, mdContent);
      });

      const booksFolder = zip.folder("Pustaka");
      books.forEach(book => {
        let mdContent = `---
`;
        mdContent += `title: ${book.title}
`;
        mdContent += `status: ${book.status}
`;
        mdContent += `progress: ${book.progress}%
`;
        mdContent += `date_created: ${new Date(book.createdAt).toISOString()}
`;
        mdContent += `date_updated: ${new Date(book.updatedAt).toISOString()}
`;
        mdContent += `---

`;
        mdContent += `# ${book.title}
`;

        booksFolder?.file(`${book.title.replace(/[^a-zA-Z0-9]/gi, "_").toLowerCase()}.md`, mdContent);
      });

      setMdExportStatus("Mengunduh ZIP...");
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `madrasah-markdown-export-${new Date().toISOString().split("T")[0]}.zip`);

      setMdExportStatus("Ekspor Markdown berhasil!");
      setTimeout(() => setMdExportStatus(null), 3000);
    } catch (error) {
      console.error("MD Export failed:", error);
      setMdExportStatus("Gagal mengekspor Markdown.");
      setTimeout(() => setMdExportStatus(null), 3000);
    }
  };

  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  const confirmClearData = async () => {
      try {
        await localforage.clear();
        window.location.reload();
      } catch (error) {
        console.error("Clear failed:", error);
        alert("Gagal menghapus data.");
      }
  };

  const handleClearData = () => {
    setIsClearDialogOpen(true);
  };


  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Pengaturan</h1>
        <p className="text-gray-500 mt-1 text-sm">Kelola penyimpanan data dan preferensi aplikasi Anda.</p>
      </div>

      <div className="space-y-6">
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900">Bantuan & Tur Interaktif</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Ingin memahami kembali cara menggunakan Madrasah dan setiap fiturnya? Anda dapat menjalankan ulang tur interaktif.
            </p>
            <Button onClick={startTour} variant="outline" className="gap-2">
              <PlayCircle className="w-4 h-4" />
              Mulai Tur Panduan
            </Button>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900">Pembaruan Arsitektur Data (V2)</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-4">
                  Sistem Madrasah kini mendukung <strong>SourceFragment</strong> dan abstraksi <strong>Konsep</strong> yang berdiri sendiri (Arsitektur V2). Eksekusi migrasi ini akan memisahkan <em>Kutipan Mentah</em> (Raw Quotes) di dalam catatan lama Anda menjadi SourceFragment mandiri tanpa menghapus data aslinya.
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Proses ini memastikan kutipan lama Anda dapat digunakan ulang (reusable) dan memperkuat penelusuran referensi (provenance) di masa depan.
                </p>
              </div>
              <div className="w-full md:w-auto shrink-0 space-y-2">
                <Button 
                  onClick={handleMigration} 
                  variant="outline" 
                  className="w-full gap-2 text-gray-900 border-gray-200 hover:bg-gray-50"
                >
                  <Layers className="w-4 h-4" />
                  Migrasi Data Catatan Lama
                </Button>
                {migrationStatus && (
                  <p className="text-[10px] text-gray-900 flex items-center gap-1 justify-center md:justify-start">
                    <CheckCircle2 className="w-3 h-3 text-gray-500" /> {migrationStatus}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900">AI & Pencarian Semantik (Lokal)</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-4">
                  Aplikasi ini menggunakan model kecerdasan buatan <strong>Transformers.js</strong> yang berjalan sepenuhnya di browser Anda. Ini memungkinkan pencarian berdasarkan makna (semantik) tanpa mengirim data Anda ke server.
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Catatan yang baru dibuat akan diindeks secara otomatis. Jika Anda mengimpor data lama, Anda mungkin perlu melakukan pengindeksan ulang manual.
                </p>
              </div>
              <div className="w-full md:w-auto shrink-0 space-y-2">
                <Button 
                  onClick={handleReindex} 
                  disabled={isIndexing}
                  variant="outline" 
                  className="w-full gap-2 text-gray-900 border-gray-200 hover:bg-gray-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isIndexing ? 'animate-spin' : ''}`} />
                  {isIndexing ? "Sedang Mengindeks..." : "Indeks Ulang Data"}
                </Button>
                {indexStatus && (
                  <p className="text-[10px] text-gray-900 flex items-center gap-1 justify-center md:justify-start">
                    <CheckCircle2 className="w-3 h-3 text-gray-500" /> {indexStatus}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900">Pembaruan Arsitektur Data (V2)</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-4">
                  Sistem Madrasah kini mendukung <strong>SourceFragment</strong> dan abstraksi <strong>Konsep</strong> yang berdiri sendiri (Arsitektur V2). Eksekusi migrasi ini akan memisahkan <em>Kutipan Mentah</em> (Raw Quotes) di dalam catatan lama Anda menjadi SourceFragment mandiri tanpa menghapus data aslinya.
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Proses ini memastikan kutipan lama Anda dapat digunakan ulang (reusable) dan memperkuat penelusuran referensi (provenance) di masa depan.
                </p>
              </div>
              <div className="w-full md:w-auto shrink-0 space-y-2">
                <Button 
                  onClick={handleMigration} 
                  variant="outline" 
                  className="w-full gap-2 text-gray-900 border-gray-200 hover:bg-gray-50"
                >
                  <Layers className="w-4 h-4" />
                  Migrasi Data Catatan Lama
                </Button>
                {migrationStatus && (
                  <p className="text-[10px] text-gray-900 flex items-center gap-1 justify-center md:justify-start">
                    <CheckCircle2 className="w-3 h-3 text-gray-500" /> {migrationStatus}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 mb-1">Audit &amp; Backfill Relasi AI (Kaidah Ta'dib)</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Memeriksa dan menormalkan seluruh relasi graf yang dibuat oleh AI. Menjamin tidak ada relasi buatan AI yang berstatus <em>terverifikasi sistem</em> sebelum ada konfirmasi eksplisit dari Anda.
                </p>
                <p className="text-xs text-gray-500">
                  Relasi yang belum ditinjau akan ditandai dengan lencana <span className="font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">AI · belum diverifikasi</span> pada visualisasi Graf dan Catatan.
                </p>
              </div>
              <div className="w-full md:w-auto shrink-0 space-y-2">
                <Button 
                  onClick={handleAiRelationBackfill} 
                  variant="outline" 
                  className="w-full gap-2 text-gray-900 border-gray-200 hover:bg-gray-50"
                >
                  <BrainCircuit className="w-4 h-4" />
                  Audit Relasi AI
                </Button>
                {aiBackfillStatus && (
                  <p className="text-[10px] text-gray-900 flex items-center gap-1 justify-center md:justify-start">
                    <CheckCircle2 className="w-3 h-3 text-gray-500" /> {aiBackfillStatus}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900 font-display">Sinkronisasi Cloud &amp; Multi-Perangkat (Firestore)</h2>
            </div>
            <div className="flex items-center gap-2">
              <GlobalSyncBadge />
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-medium ${isFirebaseConfigured ? 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-500'}`}>
                {isFirebaseConfigured ? 'Firebase Aktif' : 'Firebase Offline'}
              </span>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <p className="text-sm text-gray-600 leading-relaxed">
              Madrasah beroperasi dengan filosofi <strong>Local-First</strong> (IndexedDB) di mana seluruh data Anda tetap berada di perangkat lokal. Lapisan sinkronisasi Firestore bersifat opsional untuk menyelaraskan catatan, konsep, dan progres belajar Anda ke perangkat lain melalui akun Google yang terverifikasi.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <h3 className="font-medium text-gray-900 text-sm">Status Akun Cloud</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    {user ? (
                      <span className="text-gray-800 font-mono text-[11px] block truncate">
                        Terhubung: {user.email || user.displayName || user.uid}
                      </span>
                    ) : (
                      'Belum ada akun cloud yang terhubung. Data tersimpan di browser ini secara lokal.'
                    )}
                  </p>
                </div>
                <div>
                  <Button
                    onClick={handleAuthAction}
                    disabled={isAuthLoading || !isFirebaseConfigured}
                    variant="outline"
                    className="w-full gap-2 text-gray-900 border-gray-200 hover:bg-gray-100 h-11 md:h-9"
                  >
                    {user ? (
                      <>
                        <LogOut className="w-4 h-4 text-gray-600" />
                        Putuskan Akun
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 text-gray-600" />
                        Hubungkan Akun Google
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <RefreshCw className={`w-4 h-4 text-gray-500 ${isSyncing ? 'animate-spin' : ''}`} />
                    <h3 className="font-medium text-gray-900 text-sm">Sinkronisasi Menyeluruh</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Kirimkan seluruh data lokal (catatan, draf, flashcard, konsep) ke Firestore dengan protokol Optimistic Concurrency Control (OCC).
                  </p>
                </div>
                <div>
                  <Button
                    onClick={handleCloudSync}
                    disabled={isSyncing || !user || !isFirebaseConfigured}
                    variant="outline"
                    className="w-full gap-2 text-gray-900 border-gray-200 hover:bg-gray-100 h-11 md:h-9"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
                  </Button>
                </div>
              </div>
            </div>

            {cloudSyncStatus && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gray-900 shrink-0" />
                <span>{cloudSyncStatus}</span>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900 font-display">Penerbitan Pihak Ketiga &amp; Webhook</h2>
            </div>
            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
              Fase 3 Ekosistem
            </span>
          </div>
          <div className="p-6 space-y-6">
            <p className="text-sm text-gray-600 leading-relaxed">
              Integrasikan Studio Menulis Madrasah dengan platform publikasi mandiri Anda (seperti Ghost, Medium, Static Site Generator via GitHub Actions, atau server webhook personal). Saat Anda memicu publikasi pada draf tulisan, payload artikel terstruktur akan dikirim secara aman via HTTP POST.
            </p>

            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
                  Nama Platform / Sasaran
                </label>
                <input
                  type="text"
                  value={serviceNameInput}
                  onChange={(e) => setServiceNameInput(e.target.value)}
                  placeholder="Contoh: Blog Pribadi Ghost, Hugo Webhook, Medium API"
                  className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
                  Target Webhook URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={webhookUrlInput}
                    onChange={(e) => setWebhookUrlInput(e.target.value)}
                    placeholder="https://your-domain.com/api/webhooks/publish"
                    className="w-full text-sm font-mono bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                  <Globe className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
                  Secret Key / Bearer Token <span className="text-gray-400 font-normal">(Opsional)</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={webhookSecretInput}
                    onChange={(e) => setWebhookSecretInput(e.target.value)}
                    placeholder="Token otorisasi rahasia jika diperlukan oleh endpoint"
                    className="w-full text-sm font-mono bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                  <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  onClick={handleSavePublishing}
                  className="gap-2 bg-gray-900 text-white hover:bg-gray-800 min-h-[44px] md:min-h-[36px]"
                >
                  <Send className="w-4 h-4" />
                  Simpan Konfigurasi
                </Button>
                <Button
                  onClick={handleTestWebhook}
                  disabled={isTestingWebhook}
                  variant="outline"
                  className="gap-2 text-gray-900 border-gray-200 hover:bg-gray-50 min-h-[44px] md:min-h-[36px]"
                >
                  <RefreshCw className={`w-4 h-4 ${isTestingWebhook ? 'animate-spin' : ''}`} />
                  {isTestingWebhook ? 'Menguji...' : 'Uji Koneksi (Test Webhook)'}
                </Button>
              </div>

              {testWebhookStatus && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-gray-600 shrink-0" />
                  <span>{testWebhookStatus}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900">Portabilitas & Evakuasi Data Universal (IndexedDB)</h2>
          </div>
          <div className="p-6 space-y-6">
            <p className="text-sm text-gray-600">
              Semua data Anda (catatan, proyek, riset, dll.) disimpan secara aman di dalam peramban ini menggunakan teknologi <strong>IndexedDB</strong>. Data ini tidak dikirim ke server mana pun. Anda memiliki kendali penuh atas data Anda.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                <h3 className="font-medium text-gray-900 mb-1">Cadangkan Data (Ekspor)</h3>
                <p className="text-xs text-gray-500 mb-4 h-8">
                  Unduh semua data Anda sebagai file JSON untuk disimpan dengan aman.
                </p>
                <Button onClick={handleExport} className="w-full gap-2">
                  <Download className="w-4 h-4" />
                  Ekspor Backup
                </Button>
                {exportStatus && (
                  <p className="text-xs mt-2 text-gray-900 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {exportStatus}
                  </p>
                )}
              </div>
              <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                <h3 className="font-medium text-gray-900 mb-1">Evakuasi Markdown</h3>
                <p className="text-xs text-gray-500 mb-4 h-8">
                  Ekspor catatan ke dalam format ZIP berisi file Markdown.
                </p>
                <Button onClick={handleExportMarkdown} className="w-full gap-2 bg-gray-900 hover:bg-gray-800 text-white">
                  <FileText className="w-4 h-4" />
                  Ekspor Markdown
                </Button>
                {mdExportStatus && (
                  <p className="text-xs mt-2 text-gray-900 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {mdExportStatus}
                  </p>
                )}
              </div>


              <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                <h3 className="font-medium text-gray-900 mb-1">Pulihkan Data (Impor)</h3>
                <p className="text-xs text-gray-500 mb-4 h-8">
                  Unggah file JSON backup sebelumnya. Data yang ada akan ditimpa.
                </p>
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".json"
                    onChange={handleImport}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Button variant="outline" className="w-full gap-2 pointer-events-none">
                    <Upload className="w-4 h-4" />
                    Pilih File JSON
                  </Button>
                </div>
                {importStatus && (
                  <p className={`text-xs mt-2 flex items-center gap-1 ${importStatus.includes('Gagal') ? 'text-gray-900' : 'text-gray-900'}`}>
                    <CheckCircle2 className="w-3 h-3" /> {importStatus}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-gray-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Zona Bahaya
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 max-w-md">
                    Menghapus seluruh data akan menghilangkan semua catatan, proyek, dan pengaturan secara permanen. Pastikan Anda telah melakukan ekspor data sebelumnya.
                  </p>
                </div>
                <Button variant="outline" className="w-full sm:w-auto shrink-0 text-gray-900 border-gray-200 hover:bg-gray-50 hover:text-gray-800 hover:border-gray-300" onClick={handleClearData}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Hapus Semua Data
                </Button>
              </div>
            </div>
          </div>
        </section>
      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" /> Hapus Semua Data
          </DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-gray-600">
            Apakah Anda yakin ingin menghapus <strong>SEMUA</strong> data (Catatan, Pustaka, Proyek, dll)? Tindakan ini <strong>tidak dapat dibatalkan</strong>.
          </p>
          <p className="text-gray-600 mt-2">
            Pastikan Anda telah melakukan ekspor data (Backup) terlebih dahulu sebelum melanjutkan.
          </p>
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setIsClearDialogOpen(false)}>Batal</Button>
          <Button type="button" variant="destructive" className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmClearData}>Ya, Hapus Permanen</Button>
        </DialogFooter>
      </Dialog>

      </div>
    </div>
  );
}
