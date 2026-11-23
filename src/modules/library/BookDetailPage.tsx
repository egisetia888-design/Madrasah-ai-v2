import { useState, useMemo } from "react";
import { fetchWithAuth, prepareContentExcerpt } from "../../lib/api";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, BookOpen, Clock, PenTool, Brain, Trash2, Edit2, Save, Image as ImageIcon, Book, CheckCircle2, Bookmark, Flame, Plus, X, Sparkles, Loader2, Network, ArrowUpRight, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { MetadataRow } from "../../components/ui/MetadataRow";
import { EmptyState } from "../../components/ui/EmptyState";
import { BookMetadataFields } from "../../components/library/BookMetadataFields";
import { useLibraryStore } from "../../store/libraryStore";
import { useNotesStore } from "../../store/notesStore";
import { useReviewStore } from "../../store/reviewStore";
import { useKnowledgeStore } from "../../store/knowledgeStore";
import { BookStatus } from "../../types";
import { cn } from "../../utils/cn";
import { useToastStore } from "../../store/toastStore";
import { autoLinkSingleEntity, createExplicitRelation } from "../../utils/autoLinker";

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const books = useLibraryStore(state => state.books);
  const authors = useLibraryStore(state => state.authors);
  const updateBook = useLibraryStore(state => state.updateBook);
  const deleteBook = useLibraryStore(state => state.deleteBook);
  const addAuthor = useLibraryStore(state => state.addAuthor);
  const readingLogs = useLibraryStore(state => state.readingLogs || []);
  const addReadingLog = useLibraryStore(state => state.addReadingLog);
  const deleteReadingLog = useLibraryStore(state => state.deleteReadingLog);
  
  const notes = useNotesStore(state => state.notes);
  const addNote = useNotesStore(state => state.addNote);
  const flashcards = useReviewStore(state => state.flashcards);
  const relations = useKnowledgeStore(state => state.relations);
  const concepts = useKnowledgeStore(state => state.concepts);
  
  const addToast = useToastStore(state => state.addToast);
  const updateToast = useToastStore(state => state.updateToast);
  
  const book = books.find(b => b.id === id);

  const bookReadingLogs = useMemo(() => {
    return readingLogs
      .filter(log => log.bookId === id)
      .sort((a, b) => b.date - a.date);
  }, [readingLogs, id]);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [logToDeleteId, setLogToDeleteId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [editTitle, setEditTitle] = useState("");
  const [editAuthorName, setEditAuthorName] = useState("");
  const [editIsbn, setEditIsbn] = useState("");
  const [editCoverUrl, setEditCoverUrl] = useState("");
  const [editTotalPages, setEditTotalPages] = useState("");
  const [editIsEstimatedPages, setEditIsEstimatedPages] = useState(false);
  
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [updateProgress, setUpdateProgress] = useState("");
  
  const [quickNoteTitle, setQuickNoteTitle] = useState("");
  const [quickNoteContent, setQuickNoteContent] = useState("");
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  // AI Literature Summary states
  const [isSummarizeOpen, setIsSummarizeOpen] = useState(false);
  const [summaryInputText, setSummaryInputText] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState<{ mainProblem?: string; methodology?: string; conclusion?: string } | null>(null);

  // Connected relations for this book
  const bookRelations = useMemo(() => {
    if (!book) return [];
    return relations.filter(r => r.sourceNodeId === book.id || r.targetNodeId === book.id);
  }, [relations, book?.id]);

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 py-24 text-center">
        <Book className="w-12 h-12 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 font-display">Buku tidak ditemukan</h2>
        <Button variant="outline" onClick={() => navigate("/library")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Pustaka
        </Button>
      </div>
    );
  }

  const author = authors.find(a => a.id === book.authorId);
  const progressPct = book.totalPages && book.totalPages > 0 ? Math.min(100, Math.round((book.progress / book.totalPages) * 100)) : 0;
  
  const bookNotes = notes.filter(n => n.sourceId === book.id);
  const noteIds = bookNotes.map(n => n.id);
  const bookFlashcards = flashcards.filter(f => f.noteId && noteIds.includes(f.noteId));


  const handleDelete = () => {
    if (book) {
      deleteBook(book.id);
      navigate("/library");
    }
  };

  const handleCreateNote = () => {
    if (book) {
      const noteId = addNote({
        title: `Catatan: ${book.title}`,
        content: '',
        folderId: null,
        tags: [],
        sourceId: book.id,
        type: 'knowledge',
        status: 'unprocessed'
      });
      navigate(`/notes/${noteId}`);
    }
  };

  const handleSaveQuickNote = () => {
    if (book) {
      const contentText = quickNoteContent.trim();
      const firstLine = quickNoteTitle.trim() || contentText.split('\n')[0]?.replace(/^[#>*\-\s]+/, '') || `Catatan Pustaka: ${book.title}`;
      const finalTitle = firstLine.length > 50 ? `${firstLine.substring(0, 48)}...` : firstLine;

      if (!quickNoteTitle.trim() && !contentText) return;

      const noteId = addNote({
        title: finalTitle,
        content: contentText || quickNoteTitle.trim(),
        folderId: null,
        tags: [book.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30), 'literatur'],
        sourceId: book.id,
        type: 'literature',
        status: 'unprocessed'
      });

      // Auto-link book and note
      createExplicitRelation(
        book.id,
        noteId,
        'references',
        `Catatan literatur untuk buku "${book.title}"`
      );

      // Auto-link entities mentioned in quick note
      try {
        autoLinkSingleEntity(
          noteId,
          `${finalTitle}\n${contentText}\n${book.title}`,
          'note',
          finalTitle
        );
      } catch (err) {
        console.warn('Auto-link error:', err);
      }

      setQuickNoteTitle("");
      setQuickNoteContent("");
      setIsQuickAdding(false);
      addToast({ type: 'success', message: 'Catatan literatur tersimpan & tertaut ke buku!' });
    }
  };

  const handleSaveEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (book && editTitle.trim()) {
      let authorId = book.authorId;
      if (editAuthorName.trim()) {
        const existingAuthor = authors.find(a => a.name.toLowerCase() === editAuthorName.trim().toLowerCase());
        if (existingAuthor) {
          authorId = existingAuthor.id;
        } else {
          authorId = addAuthor(editAuthorName.trim());
        }
      } else {
        authorId = null;
      }

      const parsedPages = editTotalPages ? parseInt(editTotalPages, 10) : NaN;

      updateBook(book.id, { 
        title: editTitle.trim(),
        authorId,
        isbn: editIsbn.trim() || undefined,
        coverImage: editCoverUrl.trim() || undefined,
        totalPages: !isNaN(parsedPages) && parsedPages > 0 ? parsedPages : undefined,
        isEstimatedPages: !isNaN(parsedPages) && parsedPages > 0 && editIsEstimatedPages ? true : undefined,
      });
      setIsEditing(false);
    }
  };

  const startEditing = () => {
    if (book) {
      setEditTitle(book.title);
      setEditAuthorName(author ? author.name : "");
      setEditIsbn(book.isbn || "");
      setEditCoverUrl(book.coverImage || "");
      setEditTotalPages(book.totalPages ? book.totalPages.toString() : "");
      setEditIsEstimatedPages(Boolean(book.isEstimatedPages));
      setIsEditing(true);
    }
  };
  
  const handleUpdateProgress = (e: any) => {
    e.preventDefault();
    if (!book) return;
    const newProgress = parseInt(updateProgress);
    if (!isNaN(newProgress) && newProgress >= 0) {
      const oldProgress = book.progress || 0;
      const pagesDiff = newProgress - oldProgress;

      updateBook(book.id, { 
        progress: newProgress,
        status: book.totalPages && newProgress >= book.totalPages ? 'finished' : book.status === 'finished' ? 'reading' : book.status
      });

      if (pagesDiff > 0) {
        addReadingLog({
          bookId: book.id,
          date: Date.now(),
          pagesRead: pagesDiff,
          startPage: oldProgress,
          endPage: newProgress,
        });
        addToast({ type: 'success', message: `+${pagesDiff} halaman dicatat dalam riwayat baca!` });
      }

      setIsProgressOpen(false);
    }
  };
  
  const handleUpdateStatus = (newStatus: BookStatus) => {
    updateBook(book.id, { status: newStatus });
  };

  const getStatusIcon = (status: BookStatus) => {
    switch (status) {
      case 'reading': return <BookOpen className="w-4 h-4" />;
      case 'finished': return <CheckCircle2 className="w-4 h-4" />;
      case 'wishlist': return <Flame className="w-4 h-4" />;
      case 'summarized': return <PenTool className="w-4 h-4" />;
      default: return <Bookmark className="w-4 h-4" />;
    }
  }

  const getStatusLabel = (status: BookStatus) => {
    switch (status) {
      case 'reading': return 'Sedang Dibaca';
      case 'finished': return 'Selesai';
      case 'wishlist': return 'Daftar Ingin';
      case 'summarized': return 'Dirangkum';
      case 'connected': return 'Terhubung';
      case 'applied': return 'Diterapkan';
      case 'published': return 'Dipublikasikan';
      default: return 'Dimiliki';
    }
  }

  const handleSummarizeLiterature = async () => {
    const textToSummarize = summaryInputText.trim() || `${book.title} oleh ${author?.name || 'Penulis'}\n\nCatatan:\n` + bookNotes.map(n => `${n.title}: ${n.content}`).join('\n\n');
    if (!textToSummarize.trim()) {
      addToast({ type: 'info', message: 'Masukkan teks atau tambahkan catatan literatur terlebih dahulu untuk dirangkum.' });
      return;
    }

    setIsSummarizing(true);
    setSummaryResult(null);
    const toastId = addToast({ type: 'loading', message: 'AI sedang merangkum literatur...' });

    try {
      const res = await fetchWithAuth("/api/ai/summarize-literature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: prepareContentExcerpt(textToSummarize, 4800) })
      });
      const data = await res.json();
      if (res.ok && data) {
        setSummaryResult(data);
        updateToast(toastId, { type: 'success', message: 'Rangkuman literatur selesai!' });
      } else {
        updateToast(toastId, { type: 'error', message: data.error || "Gagal merangkum literatur." });
      }
    } catch (err: any) {
      console.error("Summarize failed:", err);
      updateToast(toastId, { type: 'error', message: "Terjadi kesalahan saat menghubungkan ke layanan AI." });
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSaveSummaryAsNote = () => {
    if (!summaryResult) return;
    const contentText = `### Masalah Utama\n${summaryResult.mainProblem || '-'}\n\n### Metodologi\n${summaryResult.methodology || '-'}\n\n### Kesimpulan\n${summaryResult.conclusion || '-'}`;
    const noteId = addNote({
      title: `Ringkasan Literatur: ${book.title}`,
      content: contentText,
      folderId: null,
      tags: ['rangkuman', 'literatur', book.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)],
      sourceId: book.id,
      type: 'literature',
      status: 'processed'
    });

    try {
      createExplicitRelation(book.id, noteId, 'references', `Rangkuman AI untuk buku "${book.title}"`);
      autoLinkSingleEntity(noteId, `Ringkasan Literatur: ${book.title}\n${contentText}`, 'note', `Ringkasan Literatur: ${book.title}`);
    } catch (err) {
      console.warn('Auto link failed:', err);
    }

    addToast({ type: 'success', message: 'Catatan rangkuman literatur berhasil disimpan!' });
    setIsSummarizeOpen(false);
    setSummaryResult(null);
    setSummaryInputText("");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-2">
         <div className="flex-1 flex gap-6">
            <div className="w-32 h-48 shrink-0 bg-gray-100 rounded-2xl border border-gray-200 overflow-hidden shadow-sm hidden sm:block relative">
              {book.coverImage && (
                <img 
                  src={book.coverImage} 
                  alt={book.title} 
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover z-10" 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center h-full text-gray-400 bg-gray-100 z-0">
                <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-[10px] font-medium uppercase tracking-wider font-mono">Sampul</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-20 pointer-events-none"></div>
            </div>
            
            <div className="flex-1 flex flex-col justify-center min-w-0">
              <Button variant="ghost" className="gap-2 -ml-3 text-gray-500 hover:text-gray-900 self-start mb-2" onClick={() => navigate("/library")}>
                 <ArrowLeft className="w-4 h-4" /> <span>Kembali</span>
              </Button>
               
               <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-gray-900 font-display leading-tight mb-1.5">{book.title}</h1>
               <p className="text-base sm:text-lg text-gray-600 font-medium mb-4">{author ? author.name : "Penulis Tidak Diketahui"}</p>
               
               <div className="flex flex-wrap items-center gap-3">
                 <div className="inline-flex flex-wrap items-center rounded-xl border border-gray-200 bg-white shadow-sm p-1 gap-1">
                   {(['wishlist', 'owned', 'reading', 'finished', 'summarized'] as BookStatus[]).map(s => (
                     <button
                       key={s}
                       onClick={() => handleUpdateStatus(s)}
                       title={getStatusLabel(s)}
                       className={cn(
                         "flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-all min-h-[40px] sm:min-h-0",
                         book.status === s 
                           ? "bg-gray-900 text-white shadow-sm" 
                           : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                       )}
                     >
                       {getStatusIcon(s)}
                       <span className={cn(book.status === s ? "inline" : "hidden md:inline")}>{getStatusLabel(s)}</span>
                     </button>
                   ))}
                 </div>
                 
                 <Button variant="outline" size="sm" className="gap-2" onClick={startEditing}>
                   <Edit2 className="w-4 h-4" />
                   <span>Edit Detail</span>
                 </Button>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Left Column: Core Book Info & Reading */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 border border-gray-200 rounded-2xl bg-white space-y-5 shadow-sm relative overflow-hidden">
             <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 font-mono uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-gray-400" />
                  Progres Membaca
                </span>
                <span className="font-bold text-xl text-gray-900 font-mono tabular-nums">{progressPct}%</span>
             </div>
             
             <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-900 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
             </div>
             
             <MetadataRow
               items={[
                 `${book.progress} hal dibaca`,
                 `${book.totalPages || '?'} total hal`,
                 book.isbn ? `ISBN ${book.isbn}` : false,
                 book.isEstimatedPages ? 'perkiraan' : false,
               ]}
             />
             
             <div className="flex gap-2 pt-1">
               <Button className="w-full gap-2" onClick={() => {
                 setUpdateProgress(book.progress.toString());
                 setIsProgressOpen(true);
               }}>
                 <Edit2 className="w-3.5 h-3.5" /> Catat Progres Membaca
               </Button>
             </div>
          </div>

          <div className="p-6 border border-gray-200 rounded-2xl bg-white space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-700 font-mono uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500"/> Riwayat Sesi Baca ({bookReadingLogs.length})
              </h3>
            </div>

            {bookReadingLogs.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {bookReadingLogs.slice(0, 8).map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <MetadataRow
                        items={[
                          <span className="font-semibold text-gray-900">+{log.pagesRead} hal</span>,
                          `hal. ${log.startPage} → ${log.endPage}`,
                        ]}
                      />
                      <p className="text-[11px] text-gray-400 font-mono tabular-nums mt-1">
                        {new Date(log.date).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLogToDeleteId(log.id)}
                      title="Hapus catatan sesi ini"
                      className="text-gray-400 hover:text-gray-900 min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] flex items-center justify-center rounded-lg hover:bg-gray-200/50 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {bookReadingLogs.length > 8 && (
                  <p className="text-[11px] text-gray-400 text-center pt-1 font-mono">
                    Menampilkan 8 sesi terbaru dari {bookReadingLogs.length} sesi
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">
                Belum ada riwayat sesi. Setiap penambahan halaman membaca akan tercatat otomatis di sini.
              </p>
            )}
          </div>
          
          <div className="p-6 border border-gray-200 rounded-2xl bg-white space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-700 font-mono uppercase tracking-wider flex items-center gap-2">
                <Network className="w-4 h-4 text-gray-500"/> Relasi Pengetahuan ({bookRelations.length})
              </h3>
              <button 
                onClick={() => navigate('/graph')}
                className="text-xs text-gray-500 hover:text-gray-900 font-medium flex items-center gap-0.5 py-1 px-2 -mr-2 rounded-lg"
              >
                Graf <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {bookRelations.length > 0 ? (
              <div className="space-y-2.5">
                {bookRelations.map(rel => {
                  const targetId = rel.sourceNodeId === book.id ? rel.targetNodeId : rel.sourceNodeId;
                  const concept = concepts.find(c => c.id === targetId);
                  const note = notes.find(n => n.id === targetId);
                  
                  const label = concept?.name || note?.title || 'Entitas Terhubung';
                  const type = concept ? 'concept' : note ? 'note' : 'other';

                  return (
                    <div 
                      key={rel.id}
                      onClick={() => {
                        if (note) navigate(`/notes/${note.id}`);
                        else navigate('/graph');
                      }}
                      className="p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-300 transition-all cursor-pointer flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {type === 'concept' ? <Brain className="w-3.5 h-3.5 text-gray-600 shrink-0" /> :
                         <FileText className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
                        <span className="font-medium text-gray-900 truncate">{label}</span>
                      </div>
                      <span className="text-[11px] font-mono text-gray-500 shrink-0">
                        · {rel.relationType}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Belum ada konsep terhubung. Buat catatan atau tautkan konsep di Graf Pengetahuan.</p>
            )}
          </div>

          <div className="p-6 border border-gray-200 rounded-2xl bg-white space-y-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-700 font-mono uppercase tracking-wider mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400"/> Riwayat &amp; Waktu
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                <span className="text-gray-500">Ditambahkan</span>
                <span className="font-medium text-gray-900 font-mono tabular-nums">{new Date(book.createdAt).toLocaleDateString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Terakhir Diperbarui</span>
                <span className="font-medium text-gray-900 font-mono tabular-nums">{new Date(book.updatedAt).toLocaleDateString('id-ID')}</span>
              </div>
            </div>
            
            <div className="pt-4 mt-4 border-t border-gray-100">
               <Button variant="ghost" className="w-full text-gray-700 hover:text-gray-900 hover:bg-gray-100 gap-2" onClick={() => setIsDeleteDialogOpen(true)}>
                 <Trash2 className="w-4 h-4" /> Hapus Materi
               </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Knowledge Hub */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 sm:p-6 border border-gray-200 rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center text-center gap-1.5">
              <span className="text-3xl sm:text-4xl font-bold text-gray-900 font-display tabular-nums">{bookNotes.length}</span>
              <span className="text-xs font-medium text-gray-500 font-mono flex items-center gap-1.5"><PenTool className="w-3.5 h-3.5 text-gray-500"/> Catatan Literatur</span>
            </div>
            <div className="p-5 sm:p-6 border border-gray-200 rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center text-center gap-1.5">
              <span className="text-3xl sm:text-4xl font-bold text-gray-900 font-display tabular-nums">{bookFlashcards.length}</span>
              <span className="text-xs font-medium text-gray-500 font-mono flex items-center gap-1.5"><Brain className="w-3.5 h-3.5 text-gray-500"/> Kartu Ulasan</span>
            </div>
          </div>
          
          <div className="p-5 sm:p-6 border border-gray-200 rounded-2xl bg-white shadow-sm space-y-6">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
               <h3 className="text-lg font-bold text-gray-900 font-display">
                 Catatan Literatur Tertaut
               </h3>
               <div className="flex flex-wrap items-center gap-2">
                 <Button variant="outline" size="sm" onClick={() => setIsSummarizeOpen(true)} className="gap-1.5 text-gray-800 bg-gray-50 hover:bg-gray-100 border-gray-200">
                   <Sparkles className="w-3.5 h-3.5 text-gray-900" /> Ringkas AI
                 </Button>
                 <Button variant="outline" size="sm" onClick={() => setIsQuickAdding(!isQuickAdding)} className={cn("gap-1.5", isQuickAdding && "bg-gray-100")}>
                   {isQuickAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {isQuickAdding ? "Batal" : "Tambah Cepat"}
                 </Button>
                 <Button variant="outline" size="sm" onClick={handleCreateNote} className="gap-1.5">
                   <Plus className="w-3.5 h-3.5" /> Catatan Penuh
                 </Button>
               </div>
             </div>
             
             {isQuickAdding && (
               <div className="p-4 border border-gray-200 bg-gray-50/50 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                 <input 
                   type="text" 
                   value={quickNoteTitle}
                   onChange={(e) => setQuickNoteTitle(e.target.value)}
                   placeholder="Judul Ide / Catatan Cepat..."
                   className="w-full h-11 md:h-9 bg-white border border-gray-200 rounded-xl px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
                   autoFocus
                 />
                 <textarea 
                   value={quickNoteContent}
                   onChange={(e) => setQuickNoteContent(e.target.value)}
                   placeholder="Isi catatan (opsional)..."
                   className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 resize-none min-h-[80px]"
                 />
                 <div className="flex justify-end">
                   <Button size="sm" onClick={handleSaveQuickNote} disabled={!quickNoteTitle.trim()} className="bg-gray-900 hover:bg-gray-800 text-white">
                     Simpan Catatan
                   </Button>
                 </div>
               </div>
             )}

             {bookNotes.length > 0 ? (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {bookNotes.map(note => (
                   <div key={note.id} onClick={() => navigate(`/notes/${note.id}`)} className="p-5 border border-gray-200 rounded-2xl bg-gray-50/50 hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group flex flex-col">
                     <h4 className="font-semibold text-sm text-gray-900 font-display mb-2 line-clamp-2">{note.title}</h4>
                     <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed flex-1">{note.content}</p>
                     <MetadataRow
                       className="mt-4 pt-3 border-t border-gray-100"
                       items={[
                         new Date(note.createdAt).toLocaleDateString('id-ID'),
                         note.status === 'processed' ? 'Terproses' : 'Mentah',
                       ]}
                     />
                   </div>
                 ))}
               </div>
             ) : (
               <EmptyState
                 compact
                 icon={PenTool}
                 title="Belum ada catatan literatur"
                 description="Ubah materi yang Anda baca menjadi pengetahuan yang bisa digunakan dengan menulis catatan literatur."
                 action={
                   <Button variant="outline" size="sm" onClick={() => setIsQuickAdding(true)} className="gap-2 bg-white">
                     <Plus className="w-3.5 h-3.5" /> Mulai Menulis Cepat
                   </Button>
                 }
               />
             )}
          </div>
          
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing} maxWidthClass="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Detail Buku</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleSaveEdit}>
          <DialogContent className="space-y-4">
            <BookMetadataFields
              title={editTitle}
              onTitleChange={setEditTitle}
              authorName={editAuthorName}
              onAuthorNameChange={setEditAuthorName}
              isbn={editIsbn}
              onIsbnChange={setEditIsbn}
              totalPages={editTotalPages}
              onTotalPagesChange={setEditTotalPages}
              coverUrl={editCoverUrl}
              onCoverUrlChange={setEditCoverUrl}
              isEstimatedPages={editIsEstimatedPages}
              onIsEstimatedPagesChange={setEditIsEstimatedPages}
              resetTrigger={isEditing ? book.id : "closed"}
            />
          </DialogContent>
          <DialogFooter className="pt-4 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="w-full sm:w-auto mb-2 sm:mb-0">
              Batal
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={!editTitle.trim()}>
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
      
      <Dialog open={isProgressOpen} onOpenChange={setIsProgressOpen}>
        <DialogHeader>
          <DialogTitle>Catat Progres Membaca</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleUpdateProgress}>
          <DialogContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Saat ini Anda di halaman berapa?</label>
              <input 
                type="number" 
                min="0"
                max={book.totalPages || undefined}
                value={updateProgress}
                onChange={(e) => setUpdateProgress(e.target.value)}
                className="flex h-11 md:h-9 w-full rounded-xl border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 focus-visible:border-gray-900" 
                required
              />
              {book.totalPages && (
                <p className="text-xs text-gray-500 font-mono">Dari total {book.totalPages} halaman.</p>
              )}
              {updateProgress !== "" && !isNaN(parseInt(updateProgress)) && (
                <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                  {parseInt(updateProgress) > (book.progress || 0) ? (
                    <p className="text-gray-900 font-medium">
                      +<span className="font-mono font-semibold">{parseInt(updateProgress) - (book.progress || 0)}</span> halaman akan otomatis dicatat ke riwayat sesi baca.
                    </p>
                  ) : parseInt(updateProgress) < (book.progress || 0) ? (
                    <p className="text-gray-500">
                      Koreksi mundur ({parseInt(updateProgress)} hal) tidak akan dicatat sebagai sesi membaca baru.
                    </p>
                  ) : (
                    <p className="text-gray-500">Halaman sama dengan posisi baca saat ini ({book.progress} hal).</p>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsProgressOpen(false)}>Batal</Button>
            <Button type="submit">Simpan Progres</Button>
          </DialogFooter>
        </form>
      </Dialog>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Hapus Materi"
        description={`Apakah Anda yakin ingin menghapus materi "${book.title}"? Catatan yang terhubung tetap tersimpan tanpa tautan buku ini.`}
        confirmLabel="Hapus Materi"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={Boolean(logToDeleteId)}
        onOpenChange={(open) => {
          if (!open) setLogToDeleteId(null);
        }}
        title="Hapus Catatan Sesi Baca"
        description="Apakah Anda yakin ingin menghapus catatan sesi membaca ini dari riwayat?"
        confirmLabel="Hapus Sesi"
        onConfirm={() => {
          if (logToDeleteId) {
            deleteReadingLog(logToDeleteId);
            setLogToDeleteId(null);
          }
        }}
      />

      <Dialog open={isSummarizeOpen} onOpenChange={setIsSummarizeOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-gray-900" /> Ringkas Literatur dengan AI
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <p className="text-sm text-gray-600">
            AI akan menganalisis teks buku/sari catatan dan mengekstrak <strong className="text-gray-900">Masalah Utama</strong>, <strong className="text-gray-900">Metodologi</strong>, dan <strong className="text-gray-900">Kesimpulan</strong>.
          </p>
          
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Teks Abstrak / Kutipan / Catatan (Biarkan kosong untuk menggunakan kumpulan catatan buku)
            </label>
            <textarea
              value={summaryInputText}
              onChange={(e) => setSummaryInputText(e.target.value)}
              placeholder={`Opsional: Tempel ekstrak teks dari buku "${book.title}"...`}
              className="w-full h-28 p-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            />
          </div>

          {summaryResult && (
            <div className="p-4 border border-gray-200 bg-gray-50 rounded-xl space-y-3 text-sm">
              <div>
                <span className="font-semibold text-gray-900 block text-xs uppercase tracking-wider mb-1">1. Masalah Utama</span>
                <p className="text-gray-700 leading-relaxed">{summaryResult.mainProblem || "-"}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-900 block text-xs uppercase tracking-wider mb-1">2. Metodologi</span>
                <p className="text-gray-700 leading-relaxed">{summaryResult.methodology || "-"}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-900 block text-xs uppercase tracking-wider mb-1">3. Kesimpulan</span>
                <p className="text-gray-700 leading-relaxed">{summaryResult.conclusion || "-"}</p>
              </div>
              <p className="text-[11px] text-gray-500 font-mono pt-2 border-t border-gray-200">
                Hasil AI — periksa ke sumber sebelum dijadikan pegangan.
              </p>
            </div>
          )}
        </DialogContent>
        <DialogFooter className="gap-2 sm:gap-0">
          {summaryResult ? (
            <>
              <Button variant="outline" onClick={() => setSummaryResult(null)}>Proses Ulang</Button>
              <Button onClick={handleSaveSummaryAsNote} className="bg-gray-900 hover:bg-gray-800 text-white gap-2">
                <Save className="w-4 h-4" /> Simpan sebagai Catatan Literatur
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setIsSummarizeOpen(false)}>Batal</Button>
              <Button onClick={handleSummarizeLiterature} disabled={isSummarizing} className="bg-gray-900 hover:bg-gray-800 text-white gap-2">
                {isSummarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isSummarizing ? "Merangkum..." : "Mulai Merangkum"}
              </Button>
            </>
          )}
        </DialogFooter>
      </Dialog>
    </div>
  );
}
