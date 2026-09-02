import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, BookOpen, Clock, PenTool, Brain, Trash2, Edit2, Save, Image as ImageIcon, Book, CheckCircle2, Bookmark, Flame, Plus, X, Sparkles, Loader2, Network, ArrowUpRight, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog";
import { useLibraryStore } from "../../store/libraryStore";
import { useNotesStore } from "../../store/notesStore";
import { useReviewStore } from "../../store/reviewStore";
import { useKnowledgeStore } from "../../store/knowledgeStore";
import { BookStatus } from "../../types";
import { cn } from "../../utils/cn";
import { useToastStore } from "../../store/toastStore";
import { scanTextForEntities, autoLinkSingleEntity, createExplicitRelation } from "../../utils/autoLinker";

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const books = useLibraryStore(state => state.books);
  const authors = useLibraryStore(state => state.authors);
  const updateBook = useLibraryStore(state => state.updateBook);
  const deleteBook = useLibraryStore(state => state.deleteBook);
  const addAuthor = useLibraryStore(state => state.addAuthor);
  
  const notes = useNotesStore(state => state.notes);
  const addNote = useNotesStore(state => state.addNote);
  const flashcards = useReviewStore(state => state.flashcards);
  const relations = useKnowledgeStore(state => state.relations);
  const concepts = useKnowledgeStore(state => state.concepts);
  
  const addToast = useToastStore(state => state.addToast);
  const updateToast = useToastStore(state => state.updateToast);
  
  const book = books.find(b => b.id === id);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [editTitle, setEditTitle] = useState("");
  const [editAuthorName, setEditAuthorName] = useState("");
  const [editCoverUrl, setEditCoverUrl] = useState("");
  const [editTotalPages, setEditTotalPages] = useState("");
  
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

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 py-24">
        <Book className="w-12 h-12 text-gray-300" />
        <h2 className="text-xl font-medium text-gray-900">Buku tidak ditemukan</h2>
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

  // Connected relations for this book
  const bookRelations = useMemo(() => {
    if (!book) return [];
    return relations.filter(r => r.sourceNodeId === book.id || r.targetNodeId === book.id);
  }, [relations, book?.id]);

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
    if (book && quickNoteTitle.trim()) {
      const noteId = addNote({
        title: quickNoteTitle.trim(),
        content: quickNoteContent.trim(),
        folderId: null,
        tags: [],
        sourceId: book.id,
        type: 'knowledge',
        status: 'unprocessed'
      });

      // Auto-link book and note
      createExplicitRelation(
        book.id,
        noteId,
        'references',
        `Catatan cepat untuk buku "${book.title}"`
      );

      // Auto-link entities mentioned in quick note
      try {
        autoLinkSingleEntity(
          noteId,
          `${quickNoteTitle}\n${quickNoteContent}`,
          'note',
          quickNoteTitle.trim()
        );
      } catch (err) {
        console.warn('Auto-link error:', err);
      }

      setQuickNoteTitle("");
      setQuickNoteContent("");
      setIsQuickAdding(false);
    }
  };

  const handleSaveEdit = () => {
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

      updateBook(book.id, { 
        title: editTitle.trim(),
        authorId,
        coverImage: editCoverUrl.trim() || undefined,
        totalPages: editTotalPages ? parseInt(editTotalPages) : undefined
      });
      setIsEditing(false);
    }
  };

  const startEditing = () => {
    if (book) {
      setEditTitle(book.title);
      setEditAuthorName(author ? author.name : "");
      setEditCoverUrl(book.coverImage || "");
      setEditTotalPages(book.totalPages ? book.totalPages.toString() : "");
      setIsEditing(true);
    }
  };
  
  const handleUpdateProgress = (e: any) => {
    e.preventDefault();
    const newProgress = parseInt(updateProgress);
    if (!isNaN(newProgress) && newProgress >= 0) {
      updateBook(book.id, { 
        progress: newProgress,
        status: book.totalPages && newProgress >= book.totalPages ? 'finished' : book.status === 'finished' ? 'reading' : book.status
      });
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
      case 'wishlist': return 'Wishlist';
      case 'summarized': return 'Dirangkum';
      case 'connected': return 'Terhubung';
      case 'applied': return 'Diterapkan';
      case 'published': return 'Dipublikasikan';
      default: return 'Milik Saya';
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
      const res = await fetch("/api/ai/summarize-literature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: textToSummarize })
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
    addNote({
      title: `Ringkasan AI: ${book.title}`,
      content: contentText,
      folderId: null,
      tags: [],
      sourceId: book.id,
      type: 'research',
      status: 'processed'
    });
    addToast({ type: 'success', message: 'Catatan rangkuman berhasil disimpan!' });
    setIsSummarizeOpen(false);
    setSummaryResult(null);
    setSummaryInputText("");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-2">
         <div className="flex-1 flex gap-6">
            <div className="w-32 h-48 shrink-0 bg-gray-100 rounded-xl border border-gray-200 overflow-hidden shadow-sm hidden sm:block relative">
              {book.coverImage && (
                <img 
                  src={book.coverImage} 
                  alt={book.title} 
                  className="absolute inset-0 w-full h-full object-cover z-10" 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center h-full text-gray-400 bg-gray-100 z-0">
                <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-[10px] font-medium uppercase tracking-wider">Sampul</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-20 pointer-events-none"></div>
            </div>
            
            <div className="flex-1 flex flex-col justify-center">
              <Button variant="ghost" className="gap-2 -ml-3 text-gray-500 hover:text-gray-900 self-start mb-2" onClick={() => navigate("/library")}>
                 <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Kembali</span>
              </Button>
               
               <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight mb-2">{book.title}</h1>
               <p className="text-lg text-gray-600 font-medium mb-4">{author ? author.name : "Penulis Tidak Diketahui"}</p>
               
               <div className="flex flex-wrap items-center gap-3">
                 <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white shadow-sm p-1">
                   {(['wishlist', 'owned', 'reading', 'finished', 'summarized'] as BookStatus[]).map(s => (
                     <button
                       key={s}
                       onClick={() => handleUpdateStatus(s)}
                       className={cn(
                         "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                         book.status === s 
                           ? "bg-gray-900 text-white shadow-sm" 
                           : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                       )}
                     >
                       {getStatusIcon(s)}
                       <span className="hidden md:inline">{getStatusLabel(s)}</span>
                     </button>
                   ))}
                 </div>
                 
                 <Button variant="outline" size="sm" className="gap-2" onClick={startEditing}>
                   <Edit2 className="w-4 h-4" />
                   <span className="hidden sm:inline">Edit Detail</span>
                 </Button>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Core Book Info & Reading */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 border border-gray-200 rounded-2xl bg-white space-y-5 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 bg-gray-500 h-full"></div>
             
             <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-gray-400" />
                  Progres Membaca
                </span>
                <span className="font-bold text-xl text-gray-900">{progressPct}%</span>
             </div>
             
             <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-900 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
             </div>
             
             <div className="flex justify-between text-sm text-gray-500 font-medium">
                <span><strong className="text-gray-900">{book.progress}</strong> hal dibaca</span>
                <span className="flex items-center gap-1.5">
                  <strong className="text-gray-900">{book.totalPages || '?'}</strong> total hal
                  {book.isEstimatedPages && (
                    <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                      perkiraan
                    </span>
                  )}
                </span>
             </div>
             
             <div className="flex gap-2 pt-2">
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
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Network className="w-4 h-4 text-gray-700"/> Relasi Pengetahuan ({bookRelations.length})
              </h3>
              <button 
                onClick={() => navigate('/knowledge')}
                className="text-xs text-gray-500 hover:text-gray-900 font-medium flex items-center gap-0.5"
              >
                Graf <ArrowUpRight className="w-3 h-3" />
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
                        else navigate('/knowledge');
                      }}
                      className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-300 transition-all cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        {type === 'concept' ? <Brain className="w-3.5 h-3.5 text-gray-600 shrink-0" /> :
                         <FileText className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
                        <span className="font-medium text-gray-900 truncate">{label}</span>
                      </div>
                      <span className="text-[10px] font-mono uppercase text-gray-400 shrink-0 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                        {rel.relationType}
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
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400"/> Riwayat & Waktu
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                <span className="text-gray-500">Ditambahkan</span>
                <span className="font-medium text-gray-900">{new Date(book.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Terakhir Diperbarui</span>
                <span className="font-medium text-gray-900">{new Date(book.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
            
            <div className="pt-4 mt-4 border-t border-gray-100">
               <Button variant="ghost" className="w-full text-gray-900 hover:text-gray-800 hover:bg-gray-50 gap-2" onClick={() => setIsDeleteDialogOpen(true)}>
                 <Trash2 className="w-4 h-4" /> Hapus Materi
               </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Knowledge Hub */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 border border-gray-200 rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center text-center gap-2">
              <span className="text-4xl font-bold text-gray-900">{bookNotes.length}</span>
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><PenTool className="w-4 h-4 text-gray-500"/> Catatan Literatur</span>
            </div>
            <div className="p-6 border border-gray-200 rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center text-center gap-2">
              <span className="text-4xl font-bold text-gray-900">{bookFlashcards.length}</span>
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><Brain className="w-4 h-4 text-gray-500"/> Kartu Ulasan</span>
            </div>
          </div>
          
          <div className="p-6 border border-gray-200 rounded-2xl bg-white shadow-sm space-y-6">
             <div className="flex items-center justify-between pb-4 border-b border-gray-100">
               <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                 Catatan Literatur Tertaut
               </h3>
               <div className="flex items-center gap-2">
                 <Button variant="outline" size="sm" onClick={() => setIsSummarizeOpen(true)} className="text-xs h-8 gap-1.5 text-gray-800 bg-gray-50 hover:bg-gray-100 border-gray-200">
                   <Sparkles className="w-3.5 h-3.5 text-gray-900" /> Ringkas AI
                 </Button>
                 <Button variant="outline" size="sm" onClick={() => setIsQuickAdding(!isQuickAdding)} className={cn("text-xs h-8 gap-2", isQuickAdding && "bg-gray-100")}>
                   {isQuickAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {isQuickAdding ? "Batal" : "Tambah Cepat"}
                 </Button>
                 <Button variant="outline" size="sm" onClick={handleCreateNote} className="text-xs h-8 gap-2">
                   <Plus className="w-3.5 h-3.5" /> Catatan Penuh
                 </Button>
               </div>
             </div>
             
             {isQuickAdding && (
               <div className="p-4 border border-gray-200 bg-gray-50/50 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                 <input 
                   type="text" 
                   value={quickNoteTitle}
                   onChange={(e) => setQuickNoteTitle(e.target.value)}
                   placeholder="Judul Ide / Catatan Cepat..."
                   className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-500"
                   autoFocus
                 />
                 <textarea 
                   value={quickNoteContent}
                   onChange={(e) => setQuickNoteContent(e.target.value)}
                   placeholder="Isi catatan (opsional)..."
                   className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none min-h-[80px]"
                 />
                 <div className="flex justify-end">
                   <Button size="sm" onClick={handleSaveQuickNote} disabled={!quickNoteTitle.trim()} className="bg-gray-900 hover:bg-gray-800 text-white text-xs h-8">
                     Simpan Catatan
                   </Button>
                 </div>
               </div>
             )}

             {bookNotes.length > 0 ? (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {bookNotes.map(note => (
                   <div key={note.id} onClick={() => navigate(`/notes/${note.id}`)} className="p-5 border border-gray-200 rounded-xl bg-gray-50/50 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer group">
                     <h4 className="font-semibold text-sm text-gray-900 mb-2 group-hover:text-gray-900 transition-colors line-clamp-2">{note.title}</h4>
                     <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">{note.content}</p>
                     <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                       <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                       <span className={cn("px-2 py-0.5 rounded", note.status === 'processed' ? 'bg-gray-100 text-gray-800' : 'bg-gray-200 text-gray-600')}>{note.status === 'processed' ? 'Diproses' : 'Mentah'}</span>
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="p-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 flex flex-col items-center text-center">
                 <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center mb-4">
                   <PenTool className="w-6 h-6 text-gray-400" />
                 </div>
                 <h4 className="text-sm font-semibold text-gray-900 mb-1">Belum ada catatan literatur</h4>
                 <p className="text-sm text-gray-500 max-w-sm mb-4">Ubah materi yang Anda baca menjadi pengetahuan yang bisa digunakan dengan menulis catatan literatur.</p>
                 <Button variant="outline" size="sm" onClick={() => setIsQuickAdding(true)} className="gap-2 bg-white">
                   <Plus className="w-3.5 h-3.5" /> Mulai Menulis Cepat
                 </Button>
               </div>
             )}
          </div>
          
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogHeader>
          <DialogTitle>Edit Detail Buku</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Judul <span className="text-gray-500">*</span></label>
            <input 
              type="text" 
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent" 
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Penulis</label>
              <input 
                type="text" 
                value={editAuthorName}
                onChange={(e) => setEditAuthorName(e.target.value)}
                className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Total Halaman</label>
              <input 
                type="number"
                min="1"
                value={editTotalPages}
                onChange={(e) => setEditTotalPages(e.target.value)}
                className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent" 
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">URL Sampul (Opsional)</label>
            <input 
              type="url" 
              value={editCoverUrl}
              onChange={(e) => setEditCoverUrl(e.target.value)}
              className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent" 
              placeholder="https://..."
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsEditing(false)}>Batal</Button>
          <Button onClick={handleSaveEdit} disabled={!editTitle.trim()}>Simpan Perubahan</Button>
        </DialogFooter>
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
                className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent" 
                required
              />
              {book.totalPages && (
                <p className="text-xs text-gray-500">Dari total {book.totalPages} halaman.</p>
              )}
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsProgressOpen(false)}>Batal</Button>
            <Button type="submit">Simpan Progres</Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogHeader>
          <DialogTitle>Hapus Materi</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-gray-600">Apakah Anda yakin ingin menghapus materi "{book.title}"? Catatan yang berhubungan dengan buku ini tidak akan terhapus namun status keterkaitannya mungkin hilang. Tindakan ini tidak dapat dibatalkan.</p>
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>Batal</Button>
          <Button variant="destructive" onClick={handleDelete} className="bg-gray-900 hover:bg-gray-800 text-white">Hapus Materi</Button>
        </DialogFooter>
      </Dialog>

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
