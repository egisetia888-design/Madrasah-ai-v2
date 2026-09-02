import { Sparkles } from "lucide-react"
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
  return (
    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
      <DialogHeader>
        <DialogTitle className="font-display text-gray-900">Catatan Baru</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleAddNote} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <DialogContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Judul <span className="text-gray-500">*</span></label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              type="text"
              className="flex h-11 w-full rounded-xl border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
              placeholder="Contoh: Konsep Clean Architecture"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Tipe Catatan</label>
              <select
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as NoteType)}
                className="flex h-11 w-full rounded-xl border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
              >
                <option value="knowledge">Knowledge (Fakta, Ilmu)</option>
                <option value="project">Project (Status, Dokumentasi)</option>
                <option value="writing">Writing (Draft, Skrip)</option>
                <option value="personal">Personal (Refleksi, Pengalaman)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Folder</label>
              <select
                value={selectedFolder || ""}
                onChange={(e) => setSelectedFolder(e.target.value || null)}
                className="flex h-11 w-full rounded-xl border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
              >
                <option value="">Tanpa Folder</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-sm font-medium text-gray-700">Kutipan Mentah <span className="text-gray-400 font-normal">(Wajib jika salah satu diisi)</span></label>
                 <textarea
                   value={rawQuote}
                   onChange={(e) => setRawQuote(e.target.value)}
                   className="flex min-h-[100px] w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 resize-none"
                   placeholder="Kutipan langsung..."
                 />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-medium text-gray-700">Sumber Referensi <span className="text-gray-400 font-normal">(Wajib jika salah satu diisi)</span></label>
                 <textarea
                   value={referenceCitation}
                   onChange={(e) => setReferenceCitation(e.target.value)}
                   className="flex min-h-[100px] w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 resize-none"
                   placeholder="Buku, artikel, url..."
                 />
               </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Inferensi / Opini Sendiri</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex min-h-[150px] w-full rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 resize-none"
                placeholder="Tuliskan pemikiran Anda di sini..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Tag Manual (Pisahkan dengan koma)</label>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              type="text"
              className="flex h-11 w-full rounded-xl border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
              placeholder="Contoh: react, design pattern, frontend"
            />
          </div>

          {/* Live Auto-Link Entity Detection Box */}
          {liveDetectedEntities.length > 0 && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Relasi Terdeteksi Otomatis ({liveDetectedEntities.length})</span>
                </div>
                <span className="text-[10px] text-gray-500">Auto-link aktif saat disimpan</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {liveDetectedEntities.map(ent => (
                  <span
                    key={ent.id}
                    className="px-2 py-0.5 text-xs bg-white border border-gray-200 rounded-md text-gray-800 flex items-center gap-1.5 shadow-2xs"
                  >
                    <span className="text-[10px] uppercase font-bold text-gray-500 font-mono">[{ent.type}]</span>
                    <span className="font-medium">{ent.label}</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-200 text-gray-800">AI &middot; belum diverifikasi</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI Auto-tagging section */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Asisten AI</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSuggest}
                disabled={isSuggesting || !content.trim()}
                className="h-8 gap-2 bg-gray-50 text-gray-800 hover:bg-gray-100 border-gray-200 hover:border-gray-300 rounded-xl"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isSuggesting ? "Menganalisis..." : "Generate Saran Tag & Relasi"}
              </Button>
            </div>

            {suggestedTags.length > 0 && (
              <div className="space-y-2 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Saran Tag AI (Klik untuk memilih):</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedTags.map(tag => {
                    const tagId = allTags.find(t => t.name.toLowerCase() === tag.toLowerCase())?.id || tag;
                    return (
                      <span
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium rounded-lg cursor-pointer transition-colors border",
                          selectedTags.includes(tagId)
                            ? 'bg-gray-900 border-gray-900 text-white'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        )}
                      >
                        #{tag}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
        <DialogFooter className="pt-2 border-t border-gray-100">
          <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>Batal</Button>
          <Button type="submit" disabled={!title.trim()}>Simpan Catatan</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
