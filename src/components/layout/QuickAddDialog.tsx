import { useState, useEffect, useRef } from "react"
import { X, Zap, FileText, CheckCircle2, PenTool, Quote, Calendar, Flag, FolderPlus, Sparkles, ArrowRight } from "lucide-react"
import { useUIStore } from "../../store/uiStore"
import { useNotesStore } from "../../store/notesStore"
import { useProjectsStore } from "../../store/projectsStore"
import { useWritingStore } from "../../store/writingStore"
import { useLibraryStore } from "../../store/libraryStore"
import { useToastStore } from "../../store/toastStore"
import { Dialog, DialogContent } from "../ui/Dialog"
import { Button } from "../ui/Button"
import { cn } from "../../utils/cn"
import { autoLinkSingleEntity } from "../../utils/autoLinker"

type QuickAddTab = 'note' | 'task' | 'idea' | 'quote'

interface TabConfig {
  id: QuickAddTab;
  label: string;
  icon: typeof FileText;
  placeholder: string;
}

const TABS: TabConfig[] = [
  { id: 'note', label: 'Catatan', icon: FileText, placeholder: 'Tulis ide, rangkuman, atau catatan kilat...' },
  { id: 'task', label: 'Tugas', icon: CheckCircle2, placeholder: 'Apa yang perlu diselesaikan hari ini?' },
  { id: 'idea', label: 'Ide Tulisan', icon: PenTool, placeholder: 'Gagasan atau topik tulisan baru...' },
  { id: 'quote', label: 'Kutipan', icon: Quote, placeholder: 'Kutipan hikmah atau kalimat penting dari buku...' },
]

export function QuickAddDialog() {
  const open = useUIStore(state => state.quickAddOpen)
  const setOpen = useUIStore(state => state.setQuickAddOpen)
  
  const addNote = useNotesStore(state => state.addNote)
  const addTask = useProjectsStore(state => state.addTask)
  const projects = useProjectsStore(state => state.projects)
  const addDraft = useWritingStore(state => state.addDraft)
  const books = useLibraryStore(state => state.books)
  const authors = useLibraryStore(state => state.authors)
  const addToast = useToastStore(state => state.addToast)

  const [activeTab, setActiveTab] = useState<QuickAddTab>('note')
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  
  // Task specific state
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [taskPriority, setTaskPriority] = useState<'normal' | 'high'>('normal')
  const [taskDueDate, setTaskDueDate] = useState<'today' | 'tomorrow' | 'none'>('none')

  // Quote specific state
  const [quoteSource, setQuoteSource] = useState("")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const primaryInputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)

  // Reset or focus on open
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        primaryInputRef.current?.focus()
      }, 80)
    } else {
      setContent("")
      setTitle("")
      setSelectedProjectId("")
      setTaskPriority('normal')
      setTaskDueDate('none')
      setQuoteSource("")
      setIsSubmitting(false)
    }
  }, [open, activeTab])

  // Global shortcut: Ctrl+Shift+I or Cmd+Shift+I
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'i' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        setOpen(true)
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [setOpen])

  const calculateDueDate = () => {
    if (taskDueDate === 'today') {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    }
    if (taskDueDate === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    }
    return undefined;
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    if (activeTab === 'note') {
      if (!content.trim()) return;
      setIsSubmitting(true);
      
      const lines = content.trim().split('\n');
      let noteTitle = title.trim() || lines[0].substring(0, 48);
      if (noteTitle.length === 48) noteTitle += "...";
      
      const noteId = addNote({
        title: noteTitle || "Tangkapan Kilat",
        content: content.trim(),
        type: 'knowledge',
        status: 'unprocessed',
        folderId: null,
        tags: ['inbox'],
      });

      try {
        autoLinkSingleEntity(noteId, `${noteTitle}\n${content}`, 'note', noteTitle);
      } catch (err) {
        console.warn('Auto link note error:', err);
      }

      addToast({ type: 'success', message: 'Catatan tersimpan di Kotak Masuk!' });
      setOpen(false);
    } else if (activeTab === 'task') {
      const taskText = content.trim() || title.trim();
      if (!taskText) return;
      setIsSubmitting(true);

      addTask({
        projectId: selectedProjectId || (projects[0]?.id ?? 'inbox'),
        title: taskText,
        status: 'todo',
        order: 0,
        priority: taskPriority,
        dueDate: calculateDueDate(),
      } as any);

      addToast({ type: 'success', message: 'Tugas baru berhasil ditambahkan!' });
      setOpen(false);
    } else if (activeTab === 'idea') {
      const ideaTitle = title.trim() || content.trim().split('\n')[0].substring(0, 40) || "Ide Tulisan";
      if (!ideaTitle && !content.trim()) return;
      setIsSubmitting(true);

      const draftId = addDraft({
        title: ideaTitle,
        content: content.trim(),
        status: 'idea',
      });

      try {
        autoLinkSingleEntity(draftId, `${ideaTitle}\n${content}`, 'writing', ideaTitle);
      } catch (err) {
        console.warn('Auto link draft error:', err);
      }

      addToast({ type: 'success', message: 'Ide tulisan disimpan ke Studio Menulis!' });
      setOpen(false);
    } else if (activeTab === 'quote') {
      if (!content.trim()) return;
      setIsSubmitting(true);

      const formattedContent = `> "${content.trim()}"\n\n— **${quoteSource.trim() || 'Sumber Tidak Disebutkan'}**`;
      const quoteTitle = title.trim() || `Kutipan: ${quoteSource.trim() || content.trim().substring(0, 30)}...`;

      const noteId = addNote({
        title: quoteTitle,
        content: formattedContent,
        type: 'knowledge',
        status: 'unprocessed',
        folderId: null,
        tags: ['kutipan', 'literatur'],
      });

      try {
        autoLinkSingleEntity(noteId, `${quoteTitle}\n${formattedContent}`, 'note', quoteTitle);
      } catch (err) {
        console.warn('Auto link quote error:', err);
      }

      addToast({ type: 'success', message: 'Kutipan literatur tersimpan!' });
      setOpen(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const isFormValid = () => {
    if (activeTab === 'note') return content.trim().length > 0;
    if (activeTab === 'task') return content.trim().length > 0 || title.trim().length > 0;
    if (activeTab === 'idea') return title.trim().length > 0 || content.trim().length > 0;
    if (activeTab === 'quote') return content.trim().length > 0;
    return false;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 overflow-hidden bg-white rounded-2xl sm:rounded-2xl border border-gray-200 shadow-2xl flex flex-col max-h-[88dvh] w-full max-w-lg mx-auto">
        {/* Header */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 bg-gray-50 border-b border-gray-200 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center shadow-xs">
                <Zap className="w-3.5 h-3.5 fill-current" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 font-display">Tangkapan Kilat</h3>
                <p className="text-[11px] text-gray-500 hidden sm:block">Tangkap pemikiran sebelum hilang dari ingatan</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-mono hidden sm:inline-block bg-white px-2 py-0.5 rounded border border-gray-200">
                Cmd+Enter ↵
              </span>
              <button 
                onClick={() => setOpen(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-200/60 transition-colors"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Horizontal Scrollable Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-200/70 rounded-xl overflow-x-auto no-scrollbar">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                  }}
                  className={cn(
                    "flex-1 min-w-[80px] sm:min-w-0 h-9 sm:h-8.5 px-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all whitespace-nowrap select-none",
                    isActive
                      ? "bg-white text-gray-900 font-semibold shadow-xs border border-gray-200/60"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/40"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-gray-900" : "text-gray-500")} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-3.5">
          {/* Note Tab */}
          {activeTab === 'note' && (
            <div className="space-y-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Judul Catatan (Opsional)"
                className="w-full text-sm font-semibold text-gray-900 placeholder:text-gray-400 bg-transparent border-b border-gray-100 pb-2 focus:outline-none focus:border-gray-300"
              />
              <textarea
                ref={primaryInputRef as any}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tulis ide, kutipan, atau tugas apa pun yang terlintas... (tersimpan ke Kotak Masuk)"
                rows={5}
                className="w-full resize-none border-0 outline-none focus:outline-none focus:ring-0 p-0 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 bg-transparent leading-relaxed"
              />
              <div className="flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-gray-100 font-mono">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-gray-400" /> Otomatis ditautkan ke Otak Kedua
                </span>
                <span>{content.length} karakter</span>
              </div>
            </div>
          )}

          {/* Task Tab */}
          {activeTab === 'task' && (
            <div className="space-y-3.5">
              <textarea
                ref={primaryInputRef as any}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Apa tugas yang perlu dituntaskan?"
                rows={3}
                className="w-full resize-none border-0 outline-none focus:outline-none focus:ring-0 p-0 text-sm sm:text-base font-medium text-gray-900 placeholder:text-gray-400 bg-transparent leading-relaxed"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-gray-100">
                {/* Project Selector */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1 font-mono">
                    Proyek Tujuan
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg text-xs bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:border-gray-400"
                  >
                    <option value="">(Inbox / Tugas Mandiri)</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                {/* Priority & Due Date */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1 font-mono">
                      Prioritas
                    </label>
                    <button
                      type="button"
                      onClick={() => setTaskPriority(prev => prev === 'normal' ? 'high' : 'normal')}
                      className={cn(
                        "w-full h-9 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all",
                        taskPriority === 'high'
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                      )}
                    >
                      <Flag className="w-3 h-3" />
                      {taskPriority === 'high' ? 'Tinggi' : 'Normal'}
                    </button>
                  </div>

                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1 font-mono">
                      Target Waktu
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setTaskDueDate(prev => {
                          if (prev === 'none') return 'today';
                          if (prev === 'today') return 'tomorrow';
                          return 'none';
                        });
                      }}
                      className={cn(
                        "w-full h-9 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 border transition-all",
                        taskDueDate !== 'none'
                          ? "bg-gray-100 text-gray-900 border-gray-300 font-semibold"
                          : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                      )}
                    >
                      <Calendar className="w-3 h-3" />
                      {taskDueDate === 'today' ? 'Hari ini' : taskDueDate === 'tomorrow' ? 'Besok' : 'Tanpa batas'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Idea Tab */}
          {activeTab === 'idea' && (
            <div className="space-y-3">
              <input
                ref={primaryInputRef as any}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Judul / Topik Ide Tulisan..."
                className="w-full text-base font-bold text-gray-900 placeholder:text-gray-400 bg-transparent border-b border-gray-200 pb-2 focus:outline-none focus:border-gray-400 font-display"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tuliskan kerangka, premis, atau poin-poin utama yang ingin dikembangkan di Studio Menulis..."
                rows={4}
                className="w-full resize-none border-0 outline-none focus:outline-none focus:ring-0 p-0 text-sm text-gray-900 placeholder:text-gray-400 bg-transparent leading-relaxed"
              />
              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 flex items-center justify-between">
                <span className="font-mono text-[11px]">Tahap Pipeline: <strong>Ide (Idea)</strong></span>
                <span className="text-[11px] text-gray-400">Siap dieksekusi di Studio Menulis</span>
              </div>
            </div>
          )}

          {/* Quote Tab */}
          {activeTab === 'quote' && (
            <div className="space-y-3">
              <textarea
                ref={primaryInputRef as any}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='"Tuliskan kutipan atau mutiara hikmah di sini..."'
                rows={4}
                className="w-full resize-none border-0 outline-none focus:outline-none focus:ring-0 p-0 text-sm sm:text-base font-serif italic text-gray-900 placeholder:text-gray-400 bg-transparent leading-relaxed"
              />
              
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <input
                  type="text"
                  value={quoteSource}
                  onChange={(e) => setQuoteSource(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Penulis / Judul Buku Rujukan (mis: Ibnu Khaldun - Muqaddimah)"
                  className="w-full h-9 px-3 rounded-lg text-xs bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 font-medium"
                />
                
                {books.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    <span className="text-[10px] font-mono text-gray-400 shrink-0">Pustaka:</span>
                    {books.slice(0, 3).map(b => {
                      const authorObj = authors.find(a => a.id === b.authorId);
                      const authorLabel = authorObj ? ` (${authorObj.name})` : '';
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setQuoteSource(`${b.title}${authorLabel}`)}
                          className="px-2 py-0.5 rounded text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 shrink-0 truncate max-w-[140px] border border-gray-200"
                        >
                          {b.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="hidden sm:inline-flex px-3.5 py-2 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Batal
          </button>
          
          <Button 
            onClick={() => handleSubmit()} 
            disabled={!isFormValid() || isSubmitting} 
            className="w-full sm:w-auto h-11 sm:h-9 px-5 text-sm font-semibold rounded-xl bg-gray-900 hover:bg-gray-800 text-white shadow-sm flex items-center justify-center gap-2"
          >
            <span>
              {activeTab === 'note' && 'Simpan ke Kotak Masuk'}
              {activeTab === 'task' && 'Tambah Tugas Baru'}
              {activeTab === 'idea' && 'Simpan Ide Tulisan'}
              {activeTab === 'quote' && 'Simpan Kutipan Literatur'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

