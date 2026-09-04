import { useState, useEffect, useRef } from "react"
import { Sparkles, FileText, BookOpen, Layers, Folder as FolderIcon, Tag as TagIcon, Check, Zap } from "lucide-react"
import { Button } from "../../../components/ui/Button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../../components/ui/Dialog"
import { NoteType, Folder, Tag } from "../../../types"
import { cn } from "../../../utils/cn"

interface DetectedEntity {
  id: string
  label: string
  type: string
}

interface AddNoteDialogProps {
  isAddOpen: boolean
  setIsAddOpen: (open: boolean) => void
  handleAddNote: (e: React.FormEvent) => void
  title: string
  setTitle: (val: string) => void
  content: string
  setContent: (val: string) => void
  rawQuote: string
  setRawQuote: (val: string) => void
  referenceCitation: string
  setReferenceCitation: (val: string) => void
  noteType: NoteType
  setNoteType: (type: NoteType) => void
  selectedFolder: string | null
  setSelectedFolder: (folderId: string | null) => void
  folders: Folder[]
  tagInput: string
  setTagInput: (val: string) => void
  liveDetectedEntities: DetectedEntity[]
  handleSuggest: () => Promise<void> | void
  isSuggesting: boolean
  suggestedTags: string[]
  selectedTags: string[]
  toggleTag: (tagName: string) => void
  allTags: Tag[]
}

export function AddNoteDialog({
  isAddOpen,
  setIsAddOpen,
  handleAddNote,
  title,
  setTitle,
  content,
  setContent,
  rawQuote,
  setRawQuote,
  referenceCitation,
  setReferenceCitation,
  noteType,
  setNoteType,
  selectedFolder,
  setSelectedFolder,
  folders,
  tagInput,
  setTagInput,
  liveDetectedEntities,
  handleSuggest,
  isSuggesting,
  suggestedTags,
  selectedTags,
  toggleTag,
  allTags
}: AddNoteDialogProps) {
  const contentInputRef = useRef<HTMLTextAreaElement | null>(null)
  const [showMetadata, setShowMetadata] = useState(false)

  // Focus textarea when modal opens
  useEffect(() => {
    if (isAddOpen) {
      setTimeout(() => {
        contentInputRef.current?.focus()
      }, 100)
    }
  }, [isAddOpen])

  // Intelligent auto-detection of note type based on input patterns
  useEffect(() => {
    const trimmed = content.trim()
    if (!trimmed) return

    // If starts with quote or markdown blockquote, auto-suggest literature
    if (trimmed.startsWith('>') || trimmed.startsWith('"') || trimmed.includes('— ') || rawQuote.trim()) {
      if (noteType === 'fleeting') {
        setNoteType('literature')
      }
    }
  }, [content, rawQuote, noteType, setNoteType])

  // Derive suggested auto title from line 1 of content if user hasn't typed a title
  const derivedTitle = title.trim() || (() => {
    const firstLine = content.trim().split('\n').map(l => l.replace(/^[#>*\-\s]+/, '').trim()).find(Boolean)
    if (!firstLine) return ""
    return firstLine.length > 50 ? `${firstLine.substring(0, 48)}...` : firstLine
  })()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd+Enter or Ctrl+Enter submits
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleAddNote(e as any)
    }
  }

  return (
    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
      <DialogHeader>
        <div className="flex items-center justify-between">
          <DialogTitle className="font-display text-gray-900 text-lg flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs">
              <Zap className="w-3.5 h-3.5" />
            </div>
            Catatan Baru
          </DialogTitle>
          <span className="text-[11px] text-gray-400 font-mono hidden sm:inline-block">
            Tekan <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 border border-gray-200">⌘+Enter</kbd> untuk simpan
          </span>
        </div>
      </DialogHeader>

      <form onSubmit={handleAddNote} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <DialogContent className="space-y-4 max-h-[75vh] overflow-y-auto">
          {/* 3-Pillar Note Type Selector */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
            {[
              {
                id: 'fleeting' as NoteType,
                label: 'Tangkapan Mentah',
                sub: 'Inbox / Ide Kilat',
                icon: FileText
              },
              {
                id: 'literature' as NoteType,
                label: 'Catatan Pustaka',
                sub: 'Kutipan & Sumber',
                icon: BookOpen
              },
              {
                id: 'permanent' as NoteType,
                label: 'Gagasan Permanen',
                sub: 'Konsep Atomik Mandiri',
                icon: Layers
              }
            ].map(typeItem => {
              const Icon = typeItem.icon
              const isSelected = noteType === typeItem.id
              return (
                <button
                  type="button"
                  key={typeItem.id}
                  onClick={() => setNoteType(typeItem.id)}
                  className={cn(
                    "flex-1 py-2 px-2.5 rounded-lg text-left transition-all border cursor-pointer",
                    isSelected
                      ? "bg-white text-gray-900 shadow-xs border-gray-200 font-semibold"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-white/50"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon className={cn("w-3.5 h-3.5", isSelected ? "text-gray-900" : "text-gray-400")} />
                    <span className="text-xs">{typeItem.label}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 hidden sm:block truncate">{typeItem.sub}</p>
                </button>
              )
            })}
          </div>

          {/* Title Field (Optional - with auto-derived preview) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-gray-700">Judul Catatan</label>
              {!title.trim() && derivedTitle && (
                <span className="text-gray-400 text-[11px] italic">
                  Otomatis: &ldquo;{derivedTitle}&rdquo;
                </span>
              )}
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              type="text"
              className="flex h-10 w-full rounded-xl border border-gray-200 bg-white px-3 py-1 text-sm font-medium shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-900 placeholder:text-gray-400"
              placeholder={derivedTitle ? `Misal: ${derivedTitle}` : "Tulis judul atau biarkan terisi otomatis..."}
            />
          </div>

          {/* Main Unified Markdown Canvas */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <label className="font-medium text-gray-700">Isi Catatan & Pemikiran</label>
              <span className="text-[11px] font-mono text-gray-400">
                Mendukung Markdown, &gt; kutipan, &amp; [[WikiLinks]]
              </span>
            </div>
            <textarea
              ref={contentInputRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={7}
              className="flex w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-900 resize-none placeholder:text-gray-400 leading-relaxed font-normal"
              placeholder={
                noteType === 'literature'
                  ? `> Tuliskan kutipan literatur di sini...\n\n— Sumber rujukan (buku, artikel, hlm 12)\n\nRefleksi pemikiran Anda mengenai kutipan di atas...`
                  : noteType === 'permanent'
                  ? `Rumuskan satu tesis atau pemahaman mandiri di sini.\n\nHubungkan dengan konsep lain menggunakan format [[Nama Catatan]]...`
                  : `Tuliskan ide kilat, rangkuman, atau pemikiran mentah... (tersimpan ke Inbox)`
              }
            />
          </div>

          {/* Live Auto-Link Entity Detection Bar */}
          {liveDetectedEntities.length > 0 && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                  <Sparkles className="w-3.5 h-3.5 text-gray-700" />
                  <span>Entitas & Relasi Terdeteksi Otomatis ({liveDetectedEntities.length})</span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">Tertaut saat disimpan</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {liveDetectedEntities.map(ent => (
                  <span
                    key={ent.id}
                    className="px-2 py-0.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-800 flex items-center gap-1.5 shadow-2xs"
                  >
                    <span className="text-[10px] uppercase font-bold text-gray-400 font-mono">[{ent.type}]</span>
                    <span className="font-medium">{ent.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Collapsible Metadata Bar: Folder, Tags, AI Auto-Tag */}
          <div className="pt-2 border-t border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowMetadata(!showMetadata)}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <TagIcon className="w-3.5 h-3.5" />
                <span>{showMetadata ? 'Sembunyikan Opsi Folder & Tag' : 'Atur Folder & Tag (Opsional)'}</span>
              </button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSuggest}
                disabled={isSuggesting || !content.trim()}
                className="h-7 text-xs gap-1.5 bg-white text-gray-700 hover:bg-gray-50 border-gray-200 rounded-lg"
              >
                <Sparkles className="w-3 h-3 text-gray-700" />
                {isSuggesting ? "Menganalisis..." : "Saran Tag Otomatis"}
              </Button>
            </div>

            {showMetadata && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 animate-in fade-in duration-150">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <FolderIcon className="w-3 h-3" /> Folder
                  </label>
                  <select
                    value={selectedFolder || ""}
                    onChange={(e) => setSelectedFolder(e.target.value || null)}
                    className="flex h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-900"
                  >
                    <option value="">Tanpa Folder (Root)</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <TagIcon className="w-3 h-3" /> Tag Tambahan
                  </label>
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    type="text"
                    className="flex h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-900"
                    placeholder="tag1, tag2..."
                  />
                </div>
              </div>
            )}

            {/* AI Suggested Tags Display */}
            {suggestedTags.length > 0 && (
              <div className="space-y-1.5 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Saran Tag AI (Klik untuk aktifkan):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedTags.map(tag => {
                    const tagId = allTags.find(t => t.name.toLowerCase() === tag.toLowerCase())?.id || tag
                    const isSelected = selectedTags.includes(tagId)
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "px-2 py-0.5 text-xs font-medium rounded-md transition-colors border cursor-pointer flex items-center gap-1",
                          isSelected
                            ? "bg-gray-900 border-gray-900 text-white"
                            : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        #{tag}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[10px] text-gray-500 font-mono pt-1">
                  Hasil AI — periksa ke sumber sebelum dijadikan pegangan.
                </p>
              </div>
            )}
          </div>
        </DialogContent>

        <DialogFooter className="pt-3 border-t border-gray-100 flex items-center justify-between sm:justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddOpen(false)}>
            Batal
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!content.trim() && !title.trim()}
            className="gap-1.5 font-medium"
          >
            Simpan Catatan
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
