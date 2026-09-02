import { SyncStatusIndicator } from '../../components/ui/SyncStatusIndicator';
import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../../components/ui/Button"
import { Plus, Search, Book, MoreVertical, BookOpen, CheckCircle2, Bookmark, Flame, PenTool, ExternalLink, Filter, Sparkles, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog"
import { useLibraryStore } from "../../store/libraryStore"
import { useToastStore } from "../../store/toastStore"
import { BookStatus } from "../../types"
import { cn } from "../../utils/cn"

export function LibraryPage() {
  const navigate = useNavigate()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [authorName, setAuthorName] = useState("")
  const [totalPages, setTotalPages] = useState("")
  const [coverUrl, setCoverUrl] = useState("")
  const [isEstimatedPages, setIsEstimatedPages] = useState(false)
  const [status, setStatus] = useState<BookStatus>('owned')
  const [isFetchingInfo, setIsFetchingInfo] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<BookStatus | 'all'>('all')

  const books = useLibraryStore((state) => state.books)
  const authors = useLibraryStore((state) => state.authors)
  const addBook = useLibraryStore((state) => state.addBook)
  const addAuthor = useLibraryStore((state) => state.addAuthor)
  const addToast = useToastStore(state => state.addToast)
  const updateToast = useToastStore(state => state.updateToast)

  const handleAutofill = async () => {
    if (!title.trim()) {
      addToast({ type: 'info', message: 'Masukkan judul buku terlebih dahulu.' });
      return;
    }

    setIsFetchingInfo(true);
    const toastId = addToast({ type: 'loading', message: 'Mencari metadata buku via Open Library...' });

    try {
      const res = await fetch("/api/ai/book-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), author: authorName.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.author && !authorName.trim()) {
          setAuthorName(data.author);
        }
        if (data.totalPages) {
          setTotalPages(String(data.totalPages));
          setIsEstimatedPages(Boolean(data.isEstimated));
        }
        if (data.coverUrl) setCoverUrl(data.coverUrl);

        if (!data.totalPages && !data.coverUrl) {
          updateToast(toastId, { type: 'info', message: 'Metadata buku belum ditemukan di katalog. Silakan isi secara manual.' });
        } else if (data.isEstimated) {
          updateToast(toastId, { type: 'info', message: 'Data Open Library tidak ditemukan. Informasi diperkirakan AI.' });
        } else {
          updateToast(toastId, { type: 'success', message: 'Informasi buku berhasil ditemukan dari Open Library.' });
        }
      } else {
        updateToast(toastId, { type: 'error', message: data.error || 'Gagal mencari info buku.' });
      }
    } catch (error) {
      console.error(error);
      updateToast(toastId, { type: 'error', message: 'Koneksi gagal saat mencari info buku.' });
    } finally {
      setIsFetchingInfo(false);
    }
  }

  const handleAddBook = (e: any) => {
    e.preventDefault()
    if (!title.trim()) return;

    let authorId = null;
    if (authorName.trim()) {
      const existingAuthor = authors.find(a => a.name.toLowerCase() === authorName.trim().toLowerCase());
      if (existingAuthor) {
        authorId = existingAuthor.id;
      } else {
        authorId = addAuthor(authorName.trim());
      }
    }

    addBook({
      title: title.trim(),
      authorId,
      categoryId: null,
      status,
      progress: 0,
      totalPages: totalPages ? parseInt(totalPages, 10) : undefined,
      coverImage: coverUrl.trim() || undefined,
      isEstimatedPages: totalPages && isEstimatedPages ? true : undefined
    })

    setTitle("")
    setAuthorName("")
    setTotalPages("")
    setCoverUrl("")
    setIsEstimatedPages(false)
    setStatus('owned')
    setIsAddOpen(false)
  }

  const getAuthorName = (authorId: string | null) => {
    if (!authorId) return "Penulis Tidak Diketahui"
    return authors.find(a => a.id === authorId)?.name || "Penulis Tidak Diketahui"
  }

  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      const matchesSearch =
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getAuthorName(book.authorId).toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTab = activeTab === 'all' || book.status === activeTab;

      return matchesSearch && matchesTab;
    });
  }, [books, searchQuery, activeTab, authors]);

  const tabs: { id: BookStatus | 'all', label: string, icon: any }[] = [
    { id: 'all', label: 'Semua', icon: Book },
    { id: 'reading', label: 'Sedang Dibaca', icon: BookOpen },
    { id: 'owned', label: 'Milik Saya', icon: Bookmark },
    { id: 'wishlist', label: 'Wishlist', icon: Flame },
    { id: 'finished', label: 'Selesai', icon: CheckCircle2 },
    { id: 'summarized', label: 'Dirangkum', icon: PenTool },
  ];

  const getStatusColor = (status: BookStatus) => {
    switch (status) {
      case 'reading': return 'text-gray-900 bg-gray-100 border-gray-300';
      case 'finished': return 'text-gray-900 bg-gray-100 border-gray-300';
      case 'wishlist': return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'summarized': return 'text-gray-900 bg-gray-100 border-gray-300';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full min-w-0 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-display">Pustaka</h1>
          <p className="text-gray-500 mt-1 text-xs sm:text-sm max-w-xl leading-relaxed">
            Kelola koleksi buku, artikel, dan referensi Anda. Bangun basis pengetahuan dengan merangkum dan menghubungkan gagasan.
          </p>
        </div>
        <Button className="w-full sm:w-auto gap-2 shrink-0 h-11 sm:h-9" onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Tambah Materi</span>
        </Button>
      </div>

      <div className="space-y-3 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 h-11 w-full focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-transparent transition-all">
           <Search className="w-4 h-4 text-gray-400 shrink-0" />
           <input
               type="text"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               placeholder="Cari judul buku, penulis..."
               className="bg-transparent border-none outline-none text-sm w-full text-gray-900 placeholder:text-gray-400"
           />
           {searchQuery && (
             <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600 p-1">
               <X className="w-3.5 h-3.5" />
             </button>
           )}
        </div>

        {/* Horizontal Mobile-Optimized Scrollable Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full no-scrollbar py-1 scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer",
                activeTab === tab.id
                  ? "bg-gray-900 text-white shadow-sm font-semibold"
                  : "bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 active:bg-gray-100"
              )}
            >
              <tab.icon className={cn("w-3.5 h-3.5 shrink-0", activeTab === tab.id ? "text-gray-300" : "text-gray-400")} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 p-6">
             <div className="w-14 h-14 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-4 text-gray-400 border border-gray-100">
               <Book className="w-7 h-7" />
             </div>
             <h3 className="text-base font-semibold text-gray-900 font-display">Pustaka Anda masih kosong</h3>
             <p className="text-xs sm:text-sm text-gray-500 mt-1 mb-5 max-w-sm leading-relaxed">
               Tambahkan buku atau materi untuk mulai membangun Sistem Operasi Pengetahuan Pribadi Anda.
             </p>
             <Button onClick={() => setIsAddOpen(true)} className="gap-2 w-full sm:w-auto">
               <Plus className="w-4 h-4" />
               Tambah Buku Pertama
             </Button>
          </div>
        ) : filteredBooks.length === 0 ? (
           <div className="text-center py-16 text-gray-500 text-sm">
             Tidak ada materi yang sesuai dengan pencarian atau filter saat ini.
           </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-6">
            {filteredBooks.map(book => {
              const progressPct = book.totalPages && book.totalPages > 0
                ? Math.min(100, Math.round((book.progress / book.totalPages) * 100))
                : 0;

              return (
                <div key={book.id} onClick={() => navigate(`/library/${book.id}`)} className="group flex flex-col gap-2.5 cursor-pointer">
                  <div className="aspect-[2/3] w-full bg-gray-100 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-center transition-all group-hover:border-gray-300 group-hover:shadow-md relative overflow-hidden">
                    {book.coverImage && (
                      <img
                        src={book.coverImage}
                        alt={book.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 z-10"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <div className="p-3 flex flex-col items-center justify-center h-full z-0">
                      <Book className="w-8 h-8 text-gray-300 mb-2" />
                      <span className="text-xs font-semibold text-gray-600 line-clamp-2">{book.title}</span>
                    </div>
                    <div className="absolute top-2 left-2 z-20">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-sm text-gray-900 border border-gray-200 shadow-xs font-mono">
                        {getStatusLabel(book.status)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs sm:text-sm text-gray-900 line-clamp-1 group-hover:text-gray-600 transition-colors font-display">
                      {book.title}
                    </h3>
                    <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                      {getAuthorName(book.authorId)}
                    </p>
                    {book.totalPages && book.totalPages > 0 ? (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono shrink-0 flex items-center gap-1">
                          {progressPct}%
                          {book.isEstimatedPages && (
                            <span className="text-[8px] font-sans px-1 py-0.2 bg-gray-100 text-gray-500 rounded border border-gray-200">
                              perkiraan
                            </span>
                          )}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogHeader>
          <DialogTitle>Tambah Materi Baru</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleAddBook}>
          <DialogContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Judul Buku <span className="text-gray-500">*</span></label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                type="text"
                className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
                placeholder="Contoh: Atomic Habits"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Penulis</label>
                <input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  type="text"
                  className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
                  placeholder="Contoh: James Clear"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Total Halaman</label>
                    {isEstimatedPages && totalPages && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                        perkiraan
                      </span>
                    )}
                  </div>
                  {title.trim() && (
                    <button
                      type="button"
                      onClick={handleAutofill}
                      disabled={isFetchingInfo}
                      className="text-[10px] font-semibold flex items-center gap-1 text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="w-3 h-3" />
                      {isFetchingInfo ? 'Mencari...' : 'Autofill Data'}
                    </button>
                  )}
                </div>
                <input
                  value={totalPages}
                  onChange={(e) => {
                    setTotalPages(e.target.value);
                    if (!e.target.value) setIsEstimatedPages(false);
                  }}
                  type="number"
                  min="1"
                  className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
                  placeholder="Contoh: 320"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">URL Sampul Buku (Opsional)</label>
              <input
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                type="url"
                className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
                placeholder="https://example.com/cover.jpg"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookStatus)}
                className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
              >
                <option value="wishlist">Wishlist</option>
                <option value="owned">Milik Saya</option>
                <option value="reading">Sedang Dibaca</option>
                <option value="finished">Selesai</option>
                <option value="summarized">Dirangkum</option>
              </select>
            </div>

          </DialogContent>
          <DialogFooter className="pt-4 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="w-full sm:w-auto mb-2 sm:mb-0">
              Batal
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={!title.trim()}>
              Simpan Materi
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
