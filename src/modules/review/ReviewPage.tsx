import { SyncStatusIndicator } from '../../components/ui/SyncStatusIndicator';
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../../components/ui/Button"
import { Plus, Brain, Copy, CheckCircle2, RotateCcw } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog"
import { useReviewStore } from "../../store/reviewStore"
import { useNotesStore } from "../../store/notesStore"

export function ReviewPage() {
  const navigate = useNavigate()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [noteId, setNoteId] = useState("")
  
  const decks = useReviewStore(state => state.decks)
  const flashcards = useReviewStore(state => state.flashcards)
  const addDeck = useReviewStore(state => state.addDeck)

  const notes = useNotesStore(state => state.notes)

  const handleAddDeck = (e: any) => {
    e.preventDefault()
    if (!name) return
    
    addDeck({
      name,
      description,
      noteId: noteId || null
    })

    setName("")
    setDescription("")
    setNoteId("")
    setIsAddOpen(false)
  }

  const getDueCount = (deckId: string) => {
    return flashcards.filter(f => f.deckId === deckId && f.dueDate <= Date.now()).length;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full min-w-0 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-display">Ulasan</h1>
          <p className="text-gray-500 mt-1 text-xs sm:text-sm">Pengulangan berjarak dan kartu flash untuk retensi pengetahuan.</p>
        </div>
        <Button className="w-full sm:w-auto gap-2 shrink-0 h-11 sm:h-9" onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Dek Baru</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {decks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/30">
             <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
               <Brain className="w-6 h-6" />
             </div>
             <h3 className="text-sm font-medium text-gray-900">Tidak ada dek tersedia</h3>
             <p className="text-sm text-gray-500 mt-1 mb-4 max-w-sm">
               Buat dek kartu flash untuk mulai menghafal konsep dan temuan riset Anda.
             </p>
             <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsAddOpen(true)}>
               <Copy className="w-3.5 h-3.5" />
               Buat Dek
             </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {decks.map(deck => {
              const due = getDueCount(deck.id)
              const total = flashcards.filter(f => f.deckId === deck.id).length
              return (
                <div key={deck.id} onClick={() => navigate(`/review/${deck.id}`)} className="group border border-gray-200 rounded-xl bg-white p-5 hover:shadow-sm transition-shadow flex flex-col h-40 cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 line-clamp-1 flex-1 pr-2">{deck.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 flex-1 mb-4">{deck.description || "Tidak ada deskripsi"}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-900 bg-gray-50 px-2 py-1 rounded">
                        <RotateCcw className="w-3 h-3" />
                        {due} Jatuh Tempo
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                        <CheckCircle2 className="w-3 h-3" />
                        {total} Kartu
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs" disabled={due === 0}>
                      Ulas
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogHeader>
          <DialogTitle>Dek Baru</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleAddDeck}>
          <DialogContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Nama Dek <span className="text-gray-500">*</span></label>
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text" 
                className="flex h-11 md:h-9 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-base md:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950" 
                placeholder="Contoh: Pola Desain"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Deskripsi</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 text-base md:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 resize-none" 
                placeholder="Untuk apa kartu flash ini?"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Catatan Sumber (Wajib)</label>
              <select 
                value={noteId}
                onChange={(e) => setNoteId(e.target.value)}
                className="flex h-11 md:h-9 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-base md:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950" 
                required
              >
                <option value="" disabled>Pilih catatan sumber...</option>
                {notes.map(n => (
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="w-full sm:w-auto mb-2 sm:mb-0">
              Batal
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={!name.trim()}>
              Buat Dek
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
