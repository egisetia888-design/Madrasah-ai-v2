import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../../components/ui/Button"
import { PageHeader } from "../../components/ui/PageHeader"
import { EmptyState } from "../../components/ui/EmptyState"
import { MetadataRow } from "../../components/ui/MetadataRow"
import { Plus, Search, Book, BookOpen, CheckCircle2, Bookmark, Flame, PenTool, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog"
import { BookMetadataFields } from "../../components/library/BookMetadataFields"
import { useLibraryStore } from "../../store/libraryStore"
import { BookStatus } from "../../types"
import { cn } from "../../utils/cn"

export function LibraryPage() {
  const navigate = useNavigate()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [authorName, setAuthorName] = useState("")
  const [isbn, setIsbn] = useState("")
  const [totalPages, setTotalPages] = useState("")
  const [coverUrl, setCoverUrl] = useState("")
  const [isEstimatedPages, setIsEstimatedPages] = useState(false)
  const [status, setStatus] = useState<BookStatus>('owned')

  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<BookStatus | 'all'>('all')

  const books = useLibraryStore((state) => state.books)
  const authors = useLibraryStore((state) => state.authors)
  const addBook = useLibraryStore((state) => state.addBook)
  const addAuthor = useLibraryStore((state) => state.addAuthor)

  const resetAddForm = () => {
    setTitle("")
    setAuthorName("")
    setIsbn("")
    setTotalPages("")
    setCoverUrl("")
    setIsEstimatedPages(false)
    setStatus('owned')
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

    const parsedPages = totalPages ? parseInt(totalPages, 10) : NaN;

    addBook({
      title: title.trim(),
      authorId,
      categoryId: null,
      isbn: isbn.trim() || undefined,
      status,
      progress: 0,
      totalPages: !isNaN(parsedPages) && parsedPages > 0 ? parsedPages : undefined,
      coverImage: coverUrl.trim() || undefined,
      isEstimatedPages: !isNaN(parsedPages) && parsedPages > 0 && isEstimatedPages ? true : undefined
    })

    resetAddForm()
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
    { id: 'owned', label: 'Dimiliki', icon: Bookmark },
    { id: 'wishlist', label: 'Daftar Ingin', icon: Flame },
    { id: 'finished', label: 'Selesai', icon: CheckCircle2 },
    { id: 'summarized', label: 'Dirangkum', icon: PenTool },
  ];

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full min-w-0 pb-12">
      <PageHeader
        title="Pustaka"
        description="Kelola koleksi buku, artikel, dan referensi Anda untuk membangun basis pengetahuan terhubung."
        actions={
          <Button className="w-full sm:w-auto gap-2" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>Tambah Materi</span>
          </Button>
        }
      />

      <div className="space-y-3 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl pl-3 pr-1 h-11 w-full focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-transparent transition-all">
           <Search className="w-4 h-4 text-gray-400 shrink-0" />
           <input
               type="text"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               placeholder="Cari judul buku, penulis..."
               className="bg-transparent border-none outline-none text-sm w-full text-gray-900 placeholder:text-gray-400"
           />
           {searchQuery && (
             <button
               type="button"
               onClick={() => setSearchQuery("")}
               aria-label="Hapus pencarian"
               className="text-gray-400 hover:text-gray-700 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-2 flex items-center justify-center cursor-pointer"
             >
               <X className="w-4 h-4" />
             </button>
           )}
        </div>

        {/* Horizontal Mobile-Optimized Scrollable Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full no-scrollbar py-1 scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0">
          {tabs.map(tab => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 min-h-[44px] sm:min-h-0 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer",
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
          <EmptyState
            icon={Book}
            title="Pustaka Anda masih kosong"
            description="Tambahkan buku atau materi bacaan untuk mulai merangkum dan menautkan gagasan."
            action={
              <Button onClick={() => setIsAddOpen(true)} className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Tambah Buku Pertama
              </Button>
            }
          />
        ) : filteredBooks.length === 0 ? (
          <EmptyState
            compact
            icon={Search}
            title="Materi tidak ditemukan"
            description="Tidak ada materi yang sesuai dengan kata kunci atau filter status saat ini."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {filteredBooks.map(book => {
              const progressPct = book.totalPages && book.totalPages > 0
                ? Math.min(100, Math.round((book.progress / book.totalPages) * 100))
                : 0;

              return (
                <div key={book.id} onClick={() => navigate(`/library/${book.id}`)} className="group flex flex-col gap-2.5 cursor-pointer">
                  <div className="aspect-[2/3] w-full bg-gray-100 rounded-2xl border border-gray-200 flex flex-col items-center justify-center text-center transition-all group-hover:border-gray-300 group-hover:shadow-sm relative overflow-hidden">
                    {book.coverImage && (
                      <img
                        src={book.coverImage}
                        alt={book.title}
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 z-10"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <div className="p-3 flex flex-col items-center justify-center h-full z-0">
                      <Book className="w-8 h-8 text-gray-300 mb-2" />
                      <span className="text-xs font-semibold text-gray-600 line-clamp-2">{book.title}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-xs sm:text-sm text-gray-900 line-clamp-1 group-hover:text-gray-600 transition-colors font-display">
                      {book.title}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-1">
                      {getAuthorName(book.authorId)}
                    </p>
                    <MetadataRow
                      items={[
                        getStatusLabel(book.status),
                        book.totalPages && book.totalPages > 0 ? `${progressPct}%` : null,
                        book.totalPages && book.totalPages > 0 && book.isEstimatedPages ? 'perkiraan' : null,
                      ]}
                    />
                    {book.totalPages && book.totalPages > 0 ? (
                      <div className="pt-1">
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) resetAddForm();
        }}
        maxWidthClass="max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>Tambah Materi Baru</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleAddBook}>
          <DialogContent className="space-y-4">
            <BookMetadataFields
              title={title}
              onTitleChange={setTitle}
              authorName={authorName}
              onAuthorNameChange={setAuthorName}
              isbn={isbn}
              onIsbnChange={setIsbn}
              totalPages={totalPages}
              onTotalPagesChange={setTotalPages}
              coverUrl={coverUrl}
              onCoverUrlChange={setCoverUrl}
              isEstimatedPages={isEstimatedPages}
              onIsEstimatedPagesChange={setIsEstimatedPages}
              resetTrigger={isAddOpen}
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookStatus)}
                className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-1 text-sm text-gray-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
              >
                <option value="wishlist">Daftar Ingin</option>
                <option value="owned">Dimiliki</option>
                <option value="reading">Sedang Dibaca</option>
                <option value="finished">Selesai</option>
                <option value="summarized">Dirangkum</option>
              </select>
            </div>
          </DialogContent>
          <DialogFooter className="pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetAddForm();
                setIsAddOpen(false);
              }}
              className="w-full sm:w-auto mb-2 sm:mb-0"
            >
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
