import React, { useEffect, useState, useCallback } from 'react';
import {
  Database,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  PlayCircle,
  FileText,
  BrainCircuit,
  RefreshCw,
  Layers,
  HardDrive,
  ShieldCheck,
  Globe,
  Key,
  Send,
  FolderCheck,
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/Dialog';
import { GlobalSyncBadge } from '../../components/ui/GlobalSyncBadge';
import { useTourStore } from '../../store/tourStore';
import { useNotesStore } from '../../store/notesStore';
import { useLibraryStore } from '../../store/libraryStore';
import { useWritingStore } from '../../store/writingStore';
import { usePublishingStore } from '../../store/publishingStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import {
  BackupSummary,
  LocalStorageDiagnostics,
  clearAllLocalStorageData,
  exportUnifiedBackup,
  getLocalStorageDiagnostics,
  importUnifiedBackup,
  requestPersistentStorage,
  validateAndPreviewBackup,
} from '../../store/indexedDbStorage';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useSemanticSearchStore } from '../../lib/semanticSearch';
import {
  migrateNotesToFragments,
  auditAiRelationsWithSummary,
} from '../../utils/dataMigration';
import {
  computeAiRelationBackfillPlan,
  computeNoteMigrationPlan,
  computeSemanticCoverage,
} from '../../utils/dataMigrationLogic';

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function SettingsPage() {
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [mdExportStatus, setMdExportStatus] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  const [aiBackfillStatus, setAiBackfillStatus] = useState<string | null>(null);
  const [indexStatus, setIndexStatus] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);

  const notes = useNotesStore((state) => state.notes);
  const drafts = useWritingStore((state) => state.drafts);
  const sourceFragments = useKnowledgeStore((state) => state.sourceFragments);
  const concepts = useKnowledgeStore((state) => state.concepts);
  const relations = useKnowledgeStore((state) => state.relations);
  const semanticModelError = useSemanticSearchStore((state) => state.modelError);

  const semanticCoverage = React.useMemo(
    () => computeSemanticCoverage(notes, drafts),
    [notes, drafts]
  );
  const migrationPlan = React.useMemo(
    () => computeNoteMigrationPlan(notes, sourceFragments, relations),
    [notes, sourceFragments, relations]
  );
  const aiAuditMetrics = React.useMemo(
    () => computeAiRelationBackfillPlan(relations),
    [relations]
  );

  const startTour = useTourStore((state) => state.startTour);
  const addToast = useToastStore((state) => state.addToast);

  const workspaceName = useAuthStore((state) => state.workspaceName);
  const setWorkspaceName = useAuthStore((state) => state.setWorkspaceName);
  const [workspaceInput, setWorkspaceInput] = useState(workspaceName);

  const [diagnostics, setDiagnostics] = useState<LocalStorageDiagnostics | null>(null);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(true);
  const [isRequestingPersist, setIsRequestingPersist] = useState(false);

  const [pendingImportJson, setPendingImportJson] = useState<string | null>(null);
  const [pendingImportSummary, setPendingImportSummary] = useState<BackupSummary | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  const refreshDiagnostics = useCallback(async () => {
    setIsLoadingDiagnostics(true);
    try {
      const stats = await getLocalStorageDiagnostics();
      setDiagnostics(stats);
    } catch (err) {
      console.error('Gagal membaca diagnostik penyimpanan lokal:', err);
    } finally {
      setIsLoadingDiagnostics(false);
    }
  }, []);

  useEffect(() => {
    refreshDiagnostics();
  }, [refreshDiagnostics]);

  const handleSaveWorkspaceName = () => {
    setWorkspaceName(workspaceInput);
    addToast({ type: 'success', message: 'Nama ruang kerja lokal berhasil diperbarui.' });
  };

  const handleEnablePersistentStorage = async () => {
    setIsRequestingPersist(true);
    try {
      const result = await requestPersistentStorage();
      if (!result.supported) {
        addToast({ type: 'info', message: 'Peramban ini tidak mendukung API Persistent Storage.' });
      } else if (result.persisted) {
        addToast({ type: 'success', message: 'Penyimpanan permanen aktif — data terlindungi dari pembersihan otomatis peramban.' });
      } else {
        addToast({ type: 'info', message: 'Izin penyimpanan permanen belum diberikan oleh peramban. Pastikan aplikasi dipasang sebagai PWA.' });
      }
      await refreshDiagnostics();
    } finally {
      setIsRequestingPersist(false);
    }
  };

  const handleMigration = () => {
    try {
      const count = migrateNotesToFragments();
      if (count > 0) {
        setMigrationStatus(`Berhasil memigrasi ${count} catatan ke format SourceFragment baru.`);
      } else {
        setMigrationStatus('Tidak ada catatan yang perlu dimigrasi (sudah mutakhir).');
      }
      refreshDiagnostics();
      setTimeout(() => setMigrationStatus(null), 5000);
    } catch (err) {
      console.error(err);
      setMigrationStatus('Terjadi kesalahan saat memigrasi data.');
    }
  };

  const handleAiRelationBackfill = () => {
    try {
      const summary = auditAiRelationsWithSummary();
      if (summary.normalizedCount > 0) {
        setAiBackfillStatus(
          `Menormalkan ${summary.normalizedCount} relasi AI (${summary.pendingAiReviewCount} perlu verifikasi, ${summary.userConfirmedAiCount} terkonfirmasi).`
        );
      } else if (summary.totalAiRelations === 0) {
        setAiBackfillStatus("Belum ada relasi buatan AI — seluruh koneksi berstatus manual.");
      } else {
        setAiBackfillStatus(
          `Audit selesai: ${summary.pendingAiReviewCount} perlu verifikasi, ${summary.userConfirmedAiCount} terkonfirmasi pengguna.`
        );
      }
      setTimeout(() => setAiBackfillStatus(null), 6000);
    } catch (err) {
      console.error(err);
      setAiBackfillStatus('Terjadi kesalahan saat memeriksa relasi AI.');
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kesalahan jaringan';
      setTestWebhookStatus(`Gagal: ${msg}`);
      addToast({ type: 'error', message: msg });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleReindex = async () => {
    setIsIndexing(true);
    setIndexStatus({ type: 'info', text: 'Menyiapkan model vektor lokal...' });
    try {
      const notesStore = useNotesStore.getState();
      const writingStore = useWritingStore.getState();
      const coverage = computeSemanticCoverage(notesStore.notes, writingStore.drafts);

      if (coverage.totalItems === 0) {
        setIndexStatus({ type: 'info', text: 'Belum ada catatan atau draf untuk diindeks.' });
        setTimeout(() => setIndexStatus(null), 4000);
        return;
      }

      const hasUnindexed =
        coverage.unindexedNoteIds.length + coverage.unindexedDraftIds.length > 0;
      const targetNoteIds = hasUnindexed ? coverage.unindexedNoteIds : coverage.allNoteIds;
      const targetDraftIds = hasUnindexed ? coverage.unindexedDraftIds : coverage.allDraftIds;
      const total = targetNoteIds.length + targetDraftIds.length;

      let processed = 0;
      let succeeded = 0;
      let failed = 0;

      for (const noteId of targetNoteIds) {
        setIndexStatus({
          type: 'info',
          text: `Mengindeks Catatan (${processed + 1}/${total})...`,
        });
        const ok = await notesStore.indexNote(noteId);
        if (ok) succeeded++;
        else failed++;
        processed++;
      }

      for (const draftId of targetDraftIds) {
        setIndexStatus({
          type: 'info',
          text: `Mengindeks Draf (${processed + 1}/${total})...`,
        });
        const ok = await writingStore.indexDraft(draftId);
        if (ok) succeeded++;
        else failed++;
        processed++;
      }

      const loadError = useSemanticSearchStore.getState().modelError;
      if (succeeded === 0 && (failed > 0 || loadError)) {
        setIndexStatus({
          type: 'error',
          text: loadError || 'Gagal memuat model atau menyusun vektor untuk seluruh item.',
        });
      } else if (failed > 0) {
        setIndexStatus({
          type: 'info',
          text: `${succeeded} entitas terindeks, ${failed} dilewati (teks kosong atau gagal).`,
        });
      } else {
        setIndexStatus({
          type: 'success',
          text: hasUnindexed
            ? `Berhasil mengindeks ${succeeded} entitas baru.`
            : `Indeks semantik diperbarui (${succeeded} entitas).`,
        });
        setTimeout(() => setIndexStatus(null), 4000);
      }
    } catch (error) {
      console.error('Indexing failed:', error);
      setIndexStatus({
        type: 'error',
        text: 'Gagal memperbarui indeks semantik lokal.',
      });
    } finally {
      setIsIndexing(false);
    }
  };

  const handleExport = async () => {
    try {
      setExportStatus('Menyiapkan cadangan terpadu...');
      const exportPayload = await exportUnifiedBackup();
      const totalCount = Object.values(exportPayload.summary).reduce((sum, val) => sum + val, 0);

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      saveAs(blob, `madrasah-backup-${new Date().toISOString().split('T')[0]}.json`);

      setExportStatus(`Ekspor berhasil (${totalCount} entitas).`);
      addToast({ type: 'success', message: `Backup JSON terpadu berhasil diunduh (${totalCount} entitas).` });
      setTimeout(() => setExportStatus(null), 4000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus('Gagal mengekspor data.');
      addToast({ type: 'error', message: 'Gagal membuat cadangan JSON.' });
      setTimeout(() => setExportStatus(null), 4000);
    }
  };

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = String(event.target?.result || '');
        const summary = validateAndPreviewBackup(json);
        setPendingImportJson(json);
        setPendingImportSummary(summary);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Format JSON tidak valid.';
        setImportStatus(`Gagal: ${msg}`);
        addToast({ type: 'error', message: msg });
        setTimeout(() => setImportStatus(null), 4000);
      }
    };
    reader.readAsText(file);
  };

  const confirmImportBackup = async () => {
    if (!pendingImportJson) return;
    setIsImporting(true);
    try {
      setImportStatus('Memulihkan data ke IndexedDB...');
      const summary = await importUnifiedBackup(pendingImportJson);
      setPendingImportJson(null);
      setPendingImportSummary(null);
      setImportStatus(`Berhasil memulihkan ${summary.totalEntities} entitas! Memuat ulang...`);
      addToast({ type: 'success', message: `Pemulihan selesai (${summary.totalEntities} entitas). Memuat ulang aplikasi...` });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memulihkan cadangan JSON.';
      setImportStatus(`Gagal: ${msg}`);
      addToast({ type: 'error', message: msg });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportMarkdown = async () => {
    try {
      setMdExportStatus('Menyiapkan ZIP Markdown...');
      const zip = new JSZip();

      const notesFolder = zip.folder('Catatan');
      const notes = useNotesStore.getState().notes;
      const allTags = useNotesStore.getState().tags;
      const folders = useNotesStore.getState().folders;
      const books = useLibraryStore.getState().books;

      notes.forEach((note) => {
        const noteFolder = note.folderId
          ? folders.find((f) => f.id === note.folderId)?.name || 'Uncategorized'
          : 'Uncategorized';
        const noteTags = note.tags.map((tid) => allTags.find((t) => t.id === tid)?.name || tid).join(', ');
        const sourceBook = note.sourceId ? books.find((b) => b.id === note.sourceId)?.title : 'None';

        let mdContent = `---\n`;
        mdContent += `title: ${note.title}\n`;
        mdContent += `type: ${note.type}\n`;
        mdContent += `status: ${note.status}\n`;
        mdContent += `folder: ${noteFolder}\n`;
        mdContent += `tags: [${noteTags}]\n`;
        if (note.sourceId) mdContent += `source: ${sourceBook}\n`;
        mdContent += `date_created: ${new Date(note.createdAt).toISOString()}\n`;
        mdContent += `date_updated: ${new Date(note.updatedAt).toISOString()}\n`;
        mdContent += `---\n\n`;
        mdContent += `# ${note.title}\n\n`;

        if (note.rawQuote) {
          mdContent += `## Kutipan Mentah\n`;
          mdContent += `> ${note.rawQuote.split('\n').join('\n> ')}\n\n`;
          if (note.referenceCitation) {
            mdContent += `**Sumber:** ${note.referenceCitation}\n\n`;
          }
        }

        if (note.content) {
          mdContent += `## Konten\n`;
          mdContent += `${note.content}\n`;
        }

        notesFolder?.file(`${noteFolder}/${note.title.replace(/[^a-zA-Z0-9]/gi, '_').toLowerCase()}.md`, mdContent);
      });

      const writingFolder = zip.folder('Tulisan');
      const drafts = useWritingStore.getState().drafts;
      drafts.forEach((draft) => {
        let mdContent = `---\n`;
        mdContent += `title: ${draft.title}\n`;
        mdContent += `status: ${draft.status}\n`;
        mdContent += `date_created: ${new Date(draft.createdAt).toISOString()}\n`;
        mdContent += `date_updated: ${new Date(draft.updatedAt).toISOString()}\n`;
        mdContent += `---\n\n`;
        mdContent += `# ${draft.title}\n\n`;
        mdContent += `${draft.content}\n`;

        writingFolder?.file(`${draft.title.replace(/[^a-zA-Z0-9]/gi, '_').toLowerCase()}.md`, mdContent);
      });

      const booksFolder = zip.folder('Pustaka');
      books.forEach((book) => {
        let mdContent = `---\n`;
        mdContent += `title: ${book.title}\n`;
        mdContent += `status: ${book.status}\n`;
        mdContent += `progress: ${book.progress}%\n`;
        mdContent += `date_created: ${new Date(book.createdAt).toISOString()}\n`;
        mdContent += `date_updated: ${new Date(book.updatedAt).toISOString()}\n`;
        mdContent += `---\n\n`;
        mdContent += `# ${book.title}\n`;

        booksFolder?.file(`${book.title.replace(/[^a-zA-Z0-9]/gi, '_').toLowerCase()}.md`, mdContent);
      });

      setMdExportStatus('Mengunduh ZIP...');
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `madrasah-markdown-export-${new Date().toISOString().split('T')[0]}.zip`);

      setMdExportStatus('Ekspor Markdown berhasil!');
      setTimeout(() => setMdExportStatus(null), 3000);
    } catch (error) {
      console.error('MD Export failed:', error);
      setMdExportStatus('Gagal mengekspor Markdown.');
      setTimeout(() => setMdExportStatus(null), 3000);
    }
  };

  const confirmClearData = async () => {
    try {
      await clearAllLocalStorageData();
      window.location.reload();
    } catch (error) {
      console.error('Clear failed:', error);
      addToast({ type: 'error', message: 'Gagal menghapus seluruh data lokal.' });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-4xl pb-12">
      <PageHeader
        title="Pengaturan"
        description="Kelola ruang kerja lokal, kesehatan penyimpanan IndexedDB, dan cadangan portabel Anda."
      />

      <div className="space-y-6">
        {/* Status & Manajemen Penyimpanan Lokal */}
        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900 font-display">Penyimpanan Lokal &amp; Ruang Kerja</h2>
            </div>
            <div className="flex items-center gap-2">
              <GlobalSyncBadge />
              <button
                type="button"
                onClick={refreshDiagnostics}
                disabled={isLoadingDiagnostics}
                title="Segarkan statistik penyimpanan"
                aria-label="Segarkan statistik penyimpanan"
                className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiagnostics ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <p className="text-sm text-gray-600 leading-relaxed">
              Seluruh basis pengetahuan Anda tersimpan secara mandiri di dalam <strong>IndexedDB</strong> peramban perangkat ini—langsung siap pakai tanpa akun cloud maupun kunci konfigurasi eksternal.
            </p>

            {/* Identitas Ruang Kerja Lokal */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1.5">
                  Nama Ruang Kerja Lokal
                </label>
                <input
                  type="text"
                  value={workspaceInput}
                  onChange={(e) => setWorkspaceInput(e.target.value)}
                  placeholder="Ruang Belajar Pribadi"
                  className="w-full h-11 md:h-9 text-sm bg-white border border-gray-200 rounded-xl px-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>
              <Button
                type="button"
                onClick={handleSaveWorkspaceName}
                variant="outline"
                className="h-11 md:h-9 px-4 rounded-xl border-gray-200 text-gray-900 hover:bg-gray-50 shrink-0"
              >
                Simpan Nama
              </Button>
            </div>

            {/* Diagnostik Storage & Kuota */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-500 mb-1">Mesin Penyimpanan</p>
                <p className="text-sm font-semibold text-gray-900 font-mono">
                  {diagnostics ? diagnostics.driver : 'Memuat...'}
                </p>
                <p className="text-[11px] text-gray-500 mt-1 font-mono tabular-nums">
                  {diagnostics ? `${diagnostics.totalEntities} entitas tersimpan` : '—'}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-500 mb-1">Ukuran Data &amp; Kuota</p>
                <p className="text-sm font-semibold text-gray-900 font-mono tabular-nums">
                  {diagnostics ? formatBytes(diagnostics.estimatedBytes) : '—'}
                </p>
                <p className="text-[11px] text-gray-500 mt-1 font-mono tabular-nums">
                  {diagnostics?.quotaBytes ? `Kuota: ${formatBytes(diagnostics.quotaBytes)}` : 'Kuota adaptif peramban'}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Ketahanan Penyimpanan</p>
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-gray-700" />
                    <span>
                      {diagnostics?.isPersisted === true
                        ? 'Permanen Aktif'
                        : diagnostics?.isPersisted === false
                          ? 'Standar Peramban'
                          : 'Terisolasi Lokal'}
                    </span>
                  </p>
                </div>
                {diagnostics?.isPersisted === false && (
                  <button
                    type="button"
                    onClick={handleEnablePersistentStorage}
                    disabled={isRequestingPersist}
                    className="mt-2 text-left text-xs font-medium text-gray-700 underline underline-offset-4 hover:text-gray-900 disabled:opacity-50"
                  >
                    {isRequestingPersist ? 'Meminta izin...' : 'Aktifkan proteksi permanen'}
                  </button>
                )}
              </div>
            </div>

            {diagnostics && (
              <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 font-mono tabular-nums">
                <span>Catatan: {diagnostics.breakdown.notes}</span>
                <span aria-hidden="true">·</span>
                <span>Buku: {diagnostics.breakdown.books}</span>
                <span aria-hidden="true">·</span>
                <span>Draf: {diagnostics.breakdown.drafts}</span>
                <span aria-hidden="true">·</span>
                <span>Konsep: {diagnostics.breakdown.concepts}</span>
                <span aria-hidden="true">·</span>
                <span>Proyek: {diagnostics.breakdown.projects}</span>
                <span aria-hidden="true">·</span>
                <span>Kurikulum: {diagnostics.breakdown.paths}</span>
                <span aria-hidden="true">·</span>
                <span>Flashcard: {diagnostics.breakdown.flashcards}</span>
                <span aria-hidden="true">·</span>
                <span>Relasi: {diagnostics.breakdown.relations}</span>
              </div>
            )}
          </div>
        </section>

        {/* Portabilitas & Evakuasi Data Universal */}
        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-medium text-gray-900 font-display">
              Backup Terpadu &amp; Portabilitas Data
            </h2>
          </div>
          <div className="p-6 space-y-6">
            <p className="text-sm text-gray-600 leading-relaxed">
              Ekspor seluruh delapan basis data modul di <strong>IndexedDB</strong> beserta preferensi lokal ke dalam satu berkas cadangan JSON terpadu, atau unduh arsip tulisan dalam format ZIP Markdown kapan saja.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="font-medium text-gray-900 text-sm mb-1">Cadangkan Data (JSON)</h3>
                  <p className="text-xs text-gray-500">
                    Unduh seluruh catatan, buku, graf, proyek, kurikulum, dan kartu review dalam 1 berkas JSON.
                  </p>
                </div>
                <div>
                  <Button
                    type="button"
                    onClick={handleExport}
                    className="w-full gap-2 h-11 md:h-9 rounded-xl bg-gray-900 hover:bg-gray-800 text-white"
                  >
                    <Download className="w-4 h-4" />
                    Ekspor Backup JSON
                  </Button>
                  {exportStatus && (
                    <p className="text-xs mt-2 text-gray-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {exportStatus}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="font-medium text-gray-900 text-sm mb-1">Evakuasi Markdown (ZIP)</h3>
                  <p className="text-xs text-gray-500">
                    Ekspor seluruh catatan, tulisan, dan daftar pustaka menjadi arsip berkas Markdown portabel.
                  </p>
                </div>
                <div>
                  <Button
                    type="button"
                    onClick={handleExportMarkdown}
                    variant="outline"
                    className="w-full gap-2 h-11 md:h-9 rounded-xl border-gray-200 text-gray-900 hover:bg-gray-100"
                  >
                    <FileText className="w-4 h-4" />
                    Ekspor ZIP Markdown
                  </Button>
                  {mdExportStatus && (
                    <p className="text-xs mt-2 text-gray-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {mdExportStatus}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="font-medium text-gray-900 text-sm mb-1">Pulihkan Data (Impor)</h3>
                  <p className="text-xs text-gray-500">
                    Unggah berkas JSON backup Madrasah untuk memeriksa ringkasan lalu memulihkan data lokal.
                  </p>
                </div>
                <div>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleImportFileSelect}
                      aria-label="Pilih berkas JSON backup Madrasah"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2 h-11 md:h-9 rounded-xl border-gray-200 text-gray-900 hover:bg-gray-100 pointer-events-none"
                    >
                      <Upload className="w-4 h-4" />
                      Pilih File JSON
                    </Button>
                  </div>
                  {importStatus && (
                    <p className="text-xs mt-2 text-gray-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {importStatus}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium text-gray-900 flex items-center gap-1.5 text-sm">
                    <AlertTriangle className="w-4 h-4 text-gray-700" /> Zona Bahaya
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-md">
                    Menghapus seluruh data akan mengosongkan seluruh object store IndexedDB serta preferensi lokal secara permanen.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto shrink-0 h-11 md:h-9 rounded-xl text-gray-900 border-gray-200 hover:bg-gray-100"
                  onClick={() => setIsClearDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Hapus Semua Data
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Bantuan & Tur Interaktif */}
        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-medium text-gray-900 font-display">Bantuan &amp; Tur Interaktif</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Ingin memahami kembali cara menggunakan Madrasah dan setiap fiturnya? Anda dapat menjalankan ulang tur interaktif.
            </p>
            <Button type="button" onClick={startTour} variant="outline" className="gap-2 h-11 md:h-9 rounded-xl">
              <PlayCircle className="w-4 h-4" />
              Mulai Tur Panduan
            </Button>
          </div>
        </section>

        {/* AI & Pencarian Semantik Lokal */}
        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-medium text-gray-900 font-display">AI &amp; Pencarian Semantik (Lokal)</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1 space-y-2.5">
                <p className="text-sm text-gray-600">
                  Aplikasi ini menggunakan model vektor <strong>Transformers.js</strong> yang berjalan langsung di peramban Anda untuk pencarian berbasis makna tanpa mengirim catatan ke server.
                </p>
                <p className="text-xs text-gray-500">
                  Catatan dan draf baru diindeks otomatis di peramban. Jika Anda baru memulihkan cadangan JSON atau menyunting luring, jalankan pengindeksan ulang di sini.
                </p>
                <p className="text-xs font-mono text-gray-600 tabular-nums">
                  Cakupan indeks: {semanticCoverage.indexedItems}/{semanticCoverage.totalItems} entitas ({semanticCoverage.indexedNotes}/{semanticCoverage.totalNotes} catatan · {semanticCoverage.indexedDrafts}/{semanticCoverage.totalDrafts} draf)
                </p>
                {semanticModelError && !indexStatus && (
                  <p className="text-xs font-mono text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                    {semanticModelError}
                  </p>
                )}
              </div>
              <div className="w-full md:w-auto shrink-0 space-y-2">
                <Button
                  type="button"
                  onClick={handleReindex}
                  disabled={isIndexing}
                  variant="outline"
                  className="w-full gap-2 h-11 md:h-9 rounded-xl text-gray-900 border-gray-200 hover:bg-gray-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isIndexing ? 'animate-spin' : ''}`} />
                  {isIndexing ? 'Sedang Mengindeks...' : 'Indeks Ulang Data'}
                </Button>
                {indexStatus && (
                  <p className="text-[11px] text-gray-900 flex items-start gap-1.5 justify-center md:justify-start max-w-xs">
                    {indexStatus.type === 'error' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-gray-700 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
                    )}
                    <span>{indexStatus.text}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Pembaruan Arsitektur Data (V2) & Audit Ta'dib */}
        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-medium text-gray-900 font-display">Pembaruan Arsitektur Data (V2) &amp; Kaidah Ta&apos;dib</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1 space-y-2.5">
                <p className="text-sm text-gray-600">
                  Madrasah mendukung <strong>SourceFragment</strong> dan abstraksi <strong>Konsep</strong> yang berdiri sendiri. Migrasi ini memisahkan kutipan mentah dari catatan lama menjadi fragmen mandiri tanpa menghapus catatan aslinya.
                </p>
                <p className="text-xs text-gray-500">
                  Proses ini memperkuat penelusuran rujukan (<em>provenance</em>) agar kutipan dapat dipakai ulang lintas tulisan.
                </p>
                <p className="text-xs font-mono text-gray-600 tabular-nums">
                  Status V2: {migrationPlan.migratedCount} catatan lama menunggu migrasi · {sourceFragments.length} fragmen sumber · {concepts.length} konsep
                </p>
              </div>
              <div className="w-full md:w-auto shrink-0 space-y-2">
                <Button
                  type="button"
                  onClick={handleMigration}
                  variant="outline"
                  className="w-full gap-2 h-11 md:h-9 rounded-xl text-gray-900 border-gray-200 hover:bg-gray-50"
                >
                  <Layers className="w-4 h-4" />
                  Migrasi Data Catatan Lama
                </Button>
                {migrationStatus && (
                  <p className="text-[11px] text-gray-900 flex items-start gap-1.5 justify-center md:justify-start max-w-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
                    <span>{migrationStatus}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1 space-y-2">
                <h3 className="text-sm font-medium text-gray-900">Audit &amp; Backfill Relasi AI (Kaidah Ta&apos;dib)</h3>
                <p className="text-sm text-gray-600">
                  Memeriksa dan menormalkan seluruh relasi graf yang dibuat oleh AI. Menjamin tidak ada relasi buatan AI yang berstatus terverifikasi sebelum ada konfirmasi eksplisit dari Anda.
                </p>
                <p className="text-xs text-gray-500">
                  Relasi yang belum ditinjau ditandai dengan <span className="font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">AI · perlu verifikasi</span> pada Graf dan Catatan.
                </p>
                <p className="text-xs font-mono text-gray-600 tabular-nums">
                  Status relasi: {aiAuditMetrics.pendingAiReviewCount} perlu verifikasi · {aiAuditMetrics.userConfirmedAiCount} AI dikonfirmasi · {aiAuditMetrics.manualCount} manual
                </p>
              </div>
              <div className="w-full md:w-auto shrink-0 space-y-2">
                <Button
                  type="button"
                  onClick={handleAiRelationBackfill}
                  variant="outline"
                  className="w-full gap-2 h-11 md:h-9 rounded-xl text-gray-900 border-gray-200 hover:bg-gray-50"
                >
                  <BrainCircuit className="w-4 h-4" />
                  Audit Relasi AI
                </Button>
                {aiBackfillStatus && (
                  <p className="text-[11px] text-gray-900 flex items-start gap-1.5 justify-center md:justify-start max-w-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
                    <span>{aiBackfillStatus}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Penerbitan Pihak Ketiga & Webhook */}
        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900 font-display">Penerbitan Pihak Ketiga &amp; Webhook</h2>
            </div>
            <span className="text-xs font-mono text-gray-500">
              Ekosistem Penerbitan
            </span>
          </div>
          <div className="p-6 space-y-6">
            <p className="text-sm text-gray-600 leading-relaxed">
              Integrasikan Studio Menulis Madrasah dengan platform publikasi mandiri Anda (Ghost, Medium, Static Site Generator, atau server webhook personal).
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
                  className="w-full h-11 md:h-10 text-sm bg-white border border-gray-200 rounded-xl px-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900"
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
                    className="w-full h-11 md:h-10 text-sm font-mono bg-white border border-gray-200 rounded-xl pl-9 pr-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                  <Globe className="w-4 h-4 text-gray-400 absolute left-3 top-3.5 md:top-3" />
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
                    className="w-full h-11 md:h-10 text-sm font-mono bg-white border border-gray-200 rounded-xl pl-9 pr-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                  <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3.5 md:top-3" />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="button"
                  onClick={handleSavePublishing}
                  className="gap-2 bg-gray-900 text-white hover:bg-gray-800 h-11 md:h-9 rounded-xl"
                >
                  <Send className="w-4 h-4" />
                  Simpan Konfigurasi
                </Button>
                <Button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={isTestingWebhook}
                  variant="outline"
                  className="gap-2 text-gray-900 border-gray-200 hover:bg-gray-50 h-11 md:h-9 rounded-xl"
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
      </div>

      {/* Dialog Konfirmasi Pratinjau Impor Backup */}
      <Dialog
        open={Boolean(pendingImportSummary)}
        onOpenChange={(open) => {
          if (!open && !isImporting) {
            setPendingImportJson(null);
            setPendingImportSummary(null);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <FolderCheck className="w-5 h-5 text-gray-800" />
            Konfirmasi Pemulihan Backup JSON
          </DialogTitle>
        </DialogHeader>
        <DialogContent>
          {pendingImportSummary && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Berkas cadangan tervalidasi. Memulihkan data ini akan menimpa penyimpanan lokal pada modul yang tercakup di dalam berkas:
              </p>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2 text-xs font-mono text-gray-700 tabular-nums">
                <div className="flex justify-between">
                  <span className="text-gray-500">Format Backup</span>
                  <span>Versi {pendingImportSummary.version} ({pendingImportSummary.storeCount} store)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tanggal Ekspor</span>
                  <span>{new Date(pendingImportSummary.timestamp).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Entitas</span>
                  <span className="font-semibold text-gray-900">{pendingImportSummary.totalEntities} item</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 font-mono tabular-nums">
                Catatan: {pendingImportSummary.breakdown.notes} · Buku: {pendingImportSummary.breakdown.books} · Draf: {pendingImportSummary.breakdown.drafts} · Konsep: {pendingImportSummary.breakdown.concepts} · Flashcard: {pendingImportSummary.breakdown.flashcards}
              </p>
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={isImporting}
            onClick={() => {
              setPendingImportJson(null);
              setPendingImportSummary(null);
            }}
            className="h-11 md:h-9 rounded-xl"
          >
            Batal
          </Button>
          <Button
            type="button"
            disabled={isImporting}
            onClick={confirmImportBackup}
            className="h-11 md:h-9 rounded-xl bg-gray-900 hover:bg-gray-800 text-white"
          >
            {isImporting ? 'Memulihkan...' : 'Pulihkan Data Sekarang'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog Konfirmasi Hapus Semua Data */}
      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 font-display">
            <AlertTriangle className="w-5 h-5 text-gray-800" /> Hapus Semua Data Lokal
          </DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-sm text-gray-600">
            Apakah Anda yakin ingin menghapus <strong>SEMUA</strong> data lokal (Catatan, Pustaka, Proyek, Kurikulum, Graf, Flashcard, dan Preferensi)? Tindakan ini <strong>tidak dapat dibatalkan</strong>.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Pastikan Anda telah mengunduh berkas Backup JSON terlebih dahulu sebelum melanjutkan.
          </p>
        </DialogContent>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsClearDialogOpen(false)}
            className="h-11 md:h-9 rounded-xl"
          >
            Batal
          </Button>
          <Button
            type="button"
            className="h-11 md:h-9 rounded-xl bg-gray-900 hover:bg-gray-800 text-white"
            onClick={confirmClearData}
          >
            Ya, Hapus Permanen
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
