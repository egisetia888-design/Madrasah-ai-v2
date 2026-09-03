import { useState, useEffect, useRef, useMemo } from "react"
import { X, Zap, FileText, CheckCircle2, PenTool, Quote, Sparkles, FolderPlus, Flag, Calendar } from "lucide-react"
import { useUIStore } from "../../store/uiStore"
import { useNotesStore } from "../../store/notesStore"
import { useProjectsStore } from "../../store/projectsStore"
import { useWritingStore } from "../../store/writingStore"
import { useToastStore } from "../../store/toastStore"
import { Dialog, DialogContent } from "../ui/Dialog"
import { Button } from "../ui/Button"
import { cn } from "../../utils/cn"
import { autoLinkSingleEntity, scanTextForEntities } from "../../utils/autoLinker"

type CaptureType = 'note' | 'task' | 'idea' | 'quote'

export function QuickAddDialog() {
  const open = useUIStore(state => state.quickAddOpen)
  const setOpen = useUIStore(state => state.setQuickAddOpen)
  
  const addNote = useNotesStore(state => state.addNote)
  const addTask = useProjectsStore(state => state.addTask)
  const projects = useProjectsStore(state => state.projects)
  const addDraft = useWritingStore(state => state.addDraft)
  const addToast = useToastStore(state => state.addToast)

  const [content, setContent] = useState("")
  const [manualTypeOverride, setManualTypeOverride] = useState<CaptureType | null>(null)
  
  // Contextual controls
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [taskPriority, setTaskPriority] = useState<'normal' | 'high'>('normal')
  const [taskDueDate, setTaskDueDate] = useState<'today' | 'tomorrow' | 'none'>('none')
  const [quoteSource, setQuoteSource] = useState("")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const primaryInputRef = useRef<HTMLTextAreaElement | null>(null)

  // Intelligent Automatic Classification
  const detectedType = useMemo<CaptureType>(() => {
    if (manualTypeOverride) return manualTypeOverride

    const trimmed = content.trim()
    if (!trimmed) return 'note'

    // Task triggers: "- [ ]", "[ ]", "todo:", "tugas:"
    if (
      trimmed.startsWith('- [ ]') ||
      trimmed.startsWith('[ ]') ||
      /^(todo|tugas|task):/i.test(trimmed)
    ) {
      return 'task'
    }

    // Quote / Literature triggers: starts with ">", quote marks, or has attribution "— "
    if (
      trimmed.startsWith('>') ||
      trimmed.startsWith('"') ||
      trimmed.startsWith('“') ||
      trimmed.includes('— ') ||
      /^(kutipan|quote|ref):/i.test(trimmed)
    ) {
      return 'quote'
    }

    // Idea / Writing triggers: starts with "# ", "draft:", "ide:"
    if (
      trimmed.startsWith('# ') ||
      /^(draft|ide|tulisan|artikel):/i.test(trimmed)
    ) {
      return 'idea'
    }

    return 'note'
  }, [content, manualTypeOverride])

  // Live entity scan for feedback
  const detectedEntities = useMemo(() => {
    if (!content.trim() || content.length < 3) return []
    return scanTextForEntities(content)
  }, [content])

  // Focus on open & reset
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        primaryInputRef.current?.focus()
      }, 80)
    } else {
      setContent("")
      setManualTypeOverride(null)
      setSelectedProjectId("")
      setTaskPriority('normal')
      setTaskDueDate('none')
      setQuoteSource("")
      setIsSubmitting(false)
    }
  }, [open])

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
      const d = new Date()
      d.setHours(23, 59, 59, 999)
      return d.getTime()
    }
    if (taskDueDate === 'tomorrow') {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(23, 59, 59, 999)
      return d.getTime()
    }
    return undefined
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isSubmitting || !content.trim()) return

    setIsSubmitting(true)
    const rawText = content.trim()

    try {
      if (detectedType === 'task') {
        // Clean prefixes for task
        const cleanedTitle = rawText
          .replace(/^(- \[[ x]\]|\[[ x]\]|(todo|tugas|task):)\s*/i, '')
          .trim() || rawText

        addTask({
          projectId: selectedProjectId || (projects[0]?.id ?? 'inbox'),
          title: cleanedTitle,
          status: 'todo',
          order: 0,
          priority: taskPriority,
          dueDate: calculateDueDate(),
        } as any)

        addToast({ type: 'success', message: 'Tugas baru berhasil ditambahkan!' })
        setOpen(false)
      } else if (detectedType === 'quote') {
        const lines = rawText.split('\n')
        const firstLine = lines[0].replace(/^[>"\s]+/, '').replace(/["\s]+$/, '')
        const derivedTitle = `Kutipan: ${firstLine.substring(0, 40)}${firstLine.length > 40 ? '...' : ''}`

        let finalQuoteContent = rawText
        if (quoteSource.trim() && !rawText.includes('— ')) {
          finalQuoteContent = `${rawText}\n\n— **${quoteSource.trim()}**`
        }

        const noteId = addNote({
          title: derivedTitle,
          content: finalQuoteContent,
          type: 'literature',
          status: 'unprocessed',
          folderId: null,
          tags: ['kutipan', 'literatur'],
        })

        try {
          autoLinkSingleEntity(noteId, `${derivedTitle}\n${finalQuoteContent}`, 'note', derivedTitle)
        } catch (err) {
          console.warn('Auto link quote error:', err)
        }

        addToast({ type: 'success', message: 'Catatan literatur tersimpan!' })
        setOpen(false)
      } else if (detectedType === 'idea') {
        const lines = rawText.split('\n')
        const firstLine = lines[0].replace(/^#+\s*/, '').replace(/^(draft|ide|tulisan|artikel):\s*/i, '').trim()
        const ideaTitle = firstLine.substring(0, 48) || "Ide Tulisan Baru"

        const draftId = addDraft({
          title: ideaTitle,
          content: rawText,
          status: 'idea',
        })

        try {
          autoLinkSingleEntity(draftId, `${ideaTitle}\n${rawText}`, 'writing', ideaTitle)
        } catch (err) {
          console.warn('Auto link draft error:', err)
        }

        addToast({ type: 'success', message: 'Ide tulisan tersimpan di Studio Menulis!' })
        setOpen(false)
      } else {
        // Standard Fleeting Note (Inbox capture)
        const lines = rawText.split('\n').map(l => l.replace(/^[#>*\-\s]+/, '').trim()).filter(Boolean)
        const noteTitle = lines.length > 0 ? (lines[0].length > 48 ? `${lines[0].substring(0, 48)}...` : lines[0]) : "Tangkapan Kilat"

        const noteId = addNote({
          title: noteTitle,
          content: rawText,
          type: 'fleeting',
          status: 'unprocessed',
          folderId: null,
          tags: ['inbox', 'fleeting'],
        })

        try {
          autoLinkSingleEntity(noteId, `${noteTitle}\n${rawText}`, 'note', noteTitle)
        } catch (err) {
          console.warn('Auto link note error:', err)
        }

        addToast({ type: 'success', message: 'Catatan tersimpan di Kotak Masuk (Otak Kedua)!' })
        setOpen(false)
      }
    } catch (err) {
      console.error(err)
      addToast({ type: 'error', message: 'Terjadi kesalahan saat menyimpan tangkapan.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Type metadata helper
  const TYPE_CONFIG = {
    note: { label: 'Catatan Mentah', desc: 'Otak Kedua (Inbox)', icon: FileText },
    task: { label: 'Tugas Proyek', desc: 'Rencana Kerja', icon: CheckCircle2 },
    quote: { label: 'Kutipan / Literatur', desc: 'Catatan Pustaka', icon: Quote },
    idea: { label: 'Ide Tulisan', desc: 'Studio Menulis', icon: PenTool }
  }

  const currentConfig = TYPE_CONFIG[detectedType]
  const CurrentIcon = currentConfig.icon

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-2xl flex flex-col max-h-[88dvh] w-full max-w-lg mx-auto">
        {/* Clean Header with Auto-Classification Badge */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-3.5 bg-gray-50 border-b border-gray-200 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center shadow-xs">
                <Zap className="w-3.5 h-3.5 fill-current" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 font-display">Tangkapan Kilat</h3>
                <p className="text-[11px] text-gray-500">Ketik apa pun, sistem otomatis mengklasifikasikan</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-mono hidden sm:inline-block bg-white px-2 py-0.5 rounded border border-gray-200">
                ⌘+Enter ↵
              </span>
              <button 
                onClick={() => setOpen(false)} 
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-200/60 transition-colors"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Real-time Classification & Override Bar */}
          <div className="mt-3 flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-gray-200/80 shadow-2xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 font-mono">Format:</span>
              <div className="inline-flex items-center gap-1 text-xs font-semibold text-gray-900">
                <CurrentIcon className="w-3.5 h-3.5 text-gray-700" />
                <span>{currentConfig.label}</span>
              </div>
              <span className="text-[11px] text-gray-400 font-normal hidden sm:inline">
                ({manualTypeOverride ? 'manual' : 'otomatis'})
              </span>
            </div>

            {/* Quick Type Override Pills */}
            <div className="flex items-center gap-1">
              {(['note', 'task', 'quote', 'idea'] as CaptureType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setManualTypeOverride(t === detectedType && manualTypeOverride ? null : t)}
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors cursor-pointer",
                    detectedType === t
                      ? "bg-gray-900 text-white font-semibold"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                  )}
                  title={`Ubah ke ${TYPE_CONFIG[t].label}`}
                >
                  {t === 'note' ? 'Catatan' : t === 'task' ? 'Tugas' : t === 'quote' ? 'Kutipan' : 'Ide'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Unified Input Canvas */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-3">
          <textarea
            ref={primaryInputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={5}
            placeholder={
              detectedType === 'task'
                ? "Ketik tugas yang perlu diselesaikan..."
                : detectedType === 'quote'
                ? "> Kutipan penting atau hikmah...\n\n— Nama Penulis / Buku"
                : detectedType === 'idea'
                ? "# Judul Gagasan\nUraikan ide tulisan baru di sini..."
                : "Tuliskan ide kilat, catatan cepat, atau tugas (- [ ])..."
            }
            className="w-full resize-none border-0 outline-none focus:outline-none focus:ring-0 p-0 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 bg-transparent leading-relaxed"
          />

          {/* Contextual Options based on Detected Type */}
          {detectedType === 'task' && (
            <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200">
                <FolderPlus className="w-3.5 h-3.5 text-gray-500" />
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="bg-transparent text-xs font-medium text-gray-700 outline-none cursor-pointer"
                >
                  <option value="">Proyek Utama</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200">
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                <select
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value as any)}
                  className="bg-transparent text-xs font-medium text-gray-700 outline-none cursor-pointer"
                >
                  <option value="none">Tanpa Tenggat</option>
                  <option value="today">Hari Ini</option>
                  <option value="tomorrow">Besok</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200">
                <Flag className="w-3.5 h-3.5 text-gray-500" />
                <button
                  type="button"
                  onClick={() => setTaskPriority(taskPriority === 'normal' ? 'high' : 'normal')}
                  className={cn(
                    "text-xs font-medium cursor-pointer transition-colors",
                    taskPriority === 'high' ? "text-gray-900 font-bold" : "text-gray-600"
                  )}
                >
                  {taskPriority === 'high' ? 'Prioritas Tinggi' : 'Prioritas Normal'}
                </button>
              </div>
            </div>
          )}

          {detectedType === 'quote' && !content.includes('— ') && (
            <div className="pt-2 border-t border-gray-100">
              <input
                type="text"
                value={quoteSource}
                onChange={(e) => setQuoteSource(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Rujukan sumber (misal: Al-Ghazali, Ihya Ulumuddin hlm 45)..."
                className="w-full text-xs font-medium text-gray-800 placeholder:text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-gray-400"
              />
            </div>
          )}

          {/* Live Detected Entities Preview */}
          {detectedEntities.length > 0 && (
            <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[10px] text-gray-400 shrink-0 flex items-center gap-1 font-mono">
                <Sparkles className="w-3 h-3 text-gray-500" /> Auto-link:
              </span>
              {detectedEntities.slice(0, 3).map(ent => (
                <span
                  key={ent.id}
                  className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 border border-gray-200 text-gray-700 rounded shrink-0"
                >
                  {ent.label}
                </span>
              ))}
              {detectedEntities.length > 3 && (
                <span className="text-[10px] text-gray-400 shrink-0">
                  +{detectedEntities.length - 3} lainnya
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-gray-400 font-mono">
            {content.length} karakter &middot; Zettelkasten terpadu
          </span>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-8 text-xs text-gray-600 hover:text-gray-900"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={() => handleSubmit()}
              disabled={!content.trim() || isSubmitting}
              className="h-8 text-xs gap-1.5 bg-gray-900 text-white hover:bg-gray-800"
            >
              <Zap className="w-3 h-3 fill-current" />
              <span>Simpan Cepat</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
