import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  Book,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Flame,
  FolderPlus,
  PenTool,
  Plus,
  Search,
  X,
} from "lucide-react";
import { BookMetadataFields } from "../../components/library/BookMetadataFields";
import { Button } from "../../components/ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/Dialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { MetadataRow } from "../../components/ui/MetadataRow";
import { PageHeader } from "../../components/ui/PageHeader";
import { useLibraryStore } from "../../store/libraryStore";
import { useToastStore } from "../../store/toastStore";
import { BookStatus } from "../../types";
import { findDuplicateBook, resolveInitialBookProgress } from "../../utils/bookMetadata";
import { cn } from "../../utils/cn";

const ADD_STATUS_OPTIONS: Array<{ value: BookStatus; label: string }> = [
  { value: "wishlist", label: "Daftar Ingin" },
  { value: "owned", label: "Dimiliki" },
  { value: "reading", label: "Sedang Dibaca" },
  { value: "finished", label: "Selesai" },
  { value: "summarized", label: "Dirangkum" },
];

export function LibraryPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [isbn, setIsbn] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [isEstimatedPages, setIsEstimatedPages] = useState(false);
  const [status, setStatus] = useState<BookStatus>("owned");
  const [initialProgress, setInitialProgress] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<BookStatus | "all">("all");

  const books = useLibraryStore((state) => state.books);
  const authors = useLibraryStore((state) => state.authors);
  const categories = useLibraryStore((state) => state.categories);
  const addBook = useLibraryStore((state) => state.addBook);
  const addAuthor = useLibraryStore((state) => state.addAuthor);
  const addCategory = useLibraryStore((state) => state.addCategory);
  const addReadingLog = useLibraryStore((state) => state.addReadingLog);

  const authorNamesList = useMemo(() => authors.map((a) => a.name), [authors]);

  const duplicateBook = useMemo(() => {
    if (!isAddOpen) return null;
    return findDuplicateBook(books, authors, { title, authorName, isbn });
  }, [isAddOpen, books, authors, title, authorName, isbn]);

  const resetAddForm = () => {
    setTitle("");
    setAuthorName("");
    setIsbn("");
    setTotalPages("");
    setCoverUrl("");
    setIsEstimatedPages(false);
    setStatus("owned");
    setInitialProgress("");
    setSelectedCategoryId("");
    setIsCreatingCategory(false);
    setNewCategoryName("");
  };

  const handleQuickCreateCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setSelectedCategoryId(existing.id);
    } else {
      const id = addCategory(trimmed);
      setSelectedCategoryId(id);
    }
    setNewCategoryName("");
    setIsCreatingCategory(false);
  };

  const saveMaterial = (openAfterSave: boolean) => {
    if (!title.trim()) return;

    let authorId: string | null = null;
    if (authorName.trim()) {
      const existingAuthor = authors.find(
        (a) => a.name.toLowerCase() === authorName.trim().toLowerCase()
      );
      authorId = existingAuthor ? existingAuthor.id : addAuthor(authorName.trim());
    }

    let resolvedCategoryId: string | null = selectedCategoryId || null;
    if (isCreatingCategory && newCategoryName.trim()) {
      const existingCat = categories.find(
        (c) => c.name.toLowerCase() === newCategoryName.trim().toLowerCase()
      );
      resolvedCategoryId = existingCat ? existingCat.id : addCategory(newCategoryName.trim());
    }

    const parsedPages = totalPages ? parseInt(totalPages, 10) : NaN;
    const validTotalPages = !isNaN(parsedPages) && parsedPages > 0 ? parsedPages : undefined;
    const computedProgress = resolveInitialBookProgress(status, initialProgress, validTotalPages);

    const createdBookId = addBook({
      title: title.trim(),
      authorId,
      categoryId: resolvedCategoryId,
      isbn: isbn.trim() || undefined,
      status,
      progress: computedProgress,
      totalPages: validTotalPages,
      coverImage: coverUrl.trim() || undefined,
      isEstimatedPages: validTotalPages && isEstimatedPages ? true : undefined,
    });

    if (computedProgress > 0 && status === "reading") {
      addReadingLog({
        bookId: createdBookId,
        date: Date.now(),
        pagesRead: computedProgress,
        startPage: 0,
        endPage: computedProgress,
        notes: "Progres awal saat menambahkan materi",
      });
    }

    addToast({ type: "success", message: `"${title.trim()}" berhasil ditambahkan ke Pustaka.` });
    resetAddForm();
    setIsAddOpen(false);

    if (openAfterSave) {
      navigate(`/library/${createdBookId}`);
    }
  };

  const handleAddBookSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const shouldOpen = submitter?.dataset?.action === "save-and-open";
    saveMaterial(shouldOpen);
  };

  const getAuthorName = (authorId: string | null) => {
    if (!authorId) return "Penulis Tidak Diketahui";
    return authors.find((a) => a.id === authorId)?.name || "Penulis Tidak Diketahui";
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId)?.name || null;
  };

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const matchesSearch =
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getAuthorName(book.authorId).toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTab = activeTab === "all" || book.status === activeTab;

      return matchesSearch && matchesTab;
    });
  }, [books, searchQuery, activeTab, authors]);

  const tabs: { id: BookStatus | "all"; label: string; icon: any }[] = [
    { id: "all", label: "Semua", icon: Book },
    { id: "reading", label: "Sedang Dibaca", icon: BookOpen },
    { id: "owned", label: "Dimiliki", icon: Bookmark },
    { id: "wishlist", label: "Daftar Ingin", icon: Flame },
    { id: "finished", label: "Selesai", icon: CheckCircle2 },
    { id: "summarized", label: "Dirangkum", icon: PenTool },
  ];

  const getStatusLabel = (bookStatus: BookStatus) => {
    switch (bookStatus) {
      case "reading":
        return "Sedang Dibaca";
      case "finished":
        return "Selesai";
      case "wishlist":
        return "Daftar Ingin";
      case "summarized":
        return "Dirangkum";
      case "connected":
        return "Terhubung";
      case "applied":
        return "Diterapkan";
      case "published":
        return "Dipublikasikan";
      default:
        return "Dimiliki";
    }
  };

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
          {tabs.map((tab) => (
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
              <tab.icon
                className={cn(
                  "w-3.5 h-3.5 shrink-0",
                  activeTab === tab.id ? "text-gray-300" : "text-gray-400"
                )}
              />
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
            {filteredBooks.map((book) => {
              const progressPct =
                book.totalPages && book.totalPages > 0
                  ? Math.min(100, Math.round((book.progress / book.totalPages) * 100))
                  : 0;
              const categoryName = getCategoryName(book.categoryId);

              return (
                <div
                  key={book.id}
                  onClick={() => navigate(`/library/${book.id}`)}
                  className="group flex flex-col gap-2.5 cursor-pointer"
                >
                  <div className="aspect-[2/3] w-full bg-gray-100 rounded-2xl border border-gray-200 flex flex-col items-center justify-center text-center transition-all group-hover:border-gray-300 group-hover:shadow-sm relative overflow-hidden">
                    {book.coverImage && (
                      <img
                        src={book.coverImage}
                        alt={book.title}
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 z-10"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    <div className="p-3 flex flex-col items-center justify-center h-full z-0">
                      <Book className="w-8 h-8 text-gray-300 mb-2" />
                      <span className="text-xs font-semibold text-gray-600 line-clamp-2">
                        {book.title}
                      </span>
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
                        categoryName,
                        book.totalPages && book.totalPages > 0 ? `${progressPct}%` : null,
                        book.totalPages && book.totalPages > 0 && book.isEstimatedPages
                          ? "perkiraan"
                          : null,
                      ]}
                    />
                    {book.totalPages && book.totalPages > 0 ? (
                      <div className="pt-1">
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gray-900 rounded-full transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
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
        <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleAddBookSubmit}>
          <DialogContent className="space-y-4">
            {duplicateBook && (
              <div className="p-3 rounded-xl border border-gray-300 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-gray-700 flex items-start sm:items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-gray-900 shrink-0 mt-0.5 sm:mt-0" />
                  <span>
                    Materi serupa <strong>"{duplicateBook.title}"</strong> sudah ada di Pustaka.
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    navigate(`/library/${duplicateBook.id}`);
                  }}
                  className="text-xs font-semibold text-gray-900 underline hover:no-underline inline-flex items-center gap-1 min-h-[36px] shrink-0 cursor-pointer"
                >
                  <span>Buka yang ada</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

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
              existingAuthorNames={authorNamesList}
              resetTrigger={isAddOpen}
            />

            {/* Reading Context Section */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700 block">Status Bacaan</span>
                <div className="flex flex-wrap gap-1.5">
                  {ADD_STATUS_OPTIONS.map((opt) => {
                    const active = status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setStatus(opt.value)}
                        aria-pressed={active}
                        className={cn(
                          "min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap cursor-pointer border",
                          active
                            ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                            : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {status === "reading" && (
                <div className="space-y-1.5">
                  <label htmlFor="add-book-initial-progress" className="text-sm font-medium text-gray-700">
                    Halaman Saat Ini <span className="text-xs font-normal text-gray-400">(Opsional)</span>
                  </label>
                  <input
                    id="add-book-initial-progress"
                    type="number"
                    min="0"
                    max={totalPages && parseInt(totalPages, 10) > 0 ? parseInt(totalPages, 10) : undefined}
                    value={initialProgress}
                    onChange={(e) => setInitialProgress(e.target.value)}
                    placeholder="Contoh: 42"
                    className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-gray-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="add-book-category" className="text-sm font-medium text-gray-700">
                    Kategori <span className="text-xs font-normal text-gray-400">(Opsional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory((prev) => !prev)}
                    className="text-xs font-medium text-gray-600 hover:text-gray-900 inline-flex items-center gap-1 min-h-[36px] px-1 cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>{isCreatingCategory ? "Pilih dari daftar" : "Kategori baru"}</span>
                  </button>
                </div>

                {isCreatingCategory ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleQuickCreateCategory();
                        }
                      }}
                      placeholder="Contoh: Filsafat, Sejarah, Psikologi"
                      className="flex h-11 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleQuickCreateCategory}
                      disabled={!newCategoryName.trim()}
                      className="min-h-[44px] shrink-0"
                    >
                      Tambah
                    </Button>
                  </div>
                ) : (
                  <select
                    id="add-book-category"
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-1 text-sm text-gray-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
                  >
                    <option value="">Tanpa Kategori</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </DialogContent>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetAddForm();
                setIsAddOpen(false);
              }}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Batal
            </Button>
            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                type="submit"
                variant="outline"
                data-action="save"
                className="w-full sm:w-auto min-h-[44px] bg-white"
                disabled={!title.trim()}
              >
                Simpan
              </Button>
              <Button
                type="submit"
                data-action="save-and-open"
                className="w-full sm:w-auto min-h-[44px] whitespace-nowrap"
                disabled={!title.trim()}
              >
                Simpan & Buka
              </Button>
            </div>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
