import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, Plus, Play, Trash2, Edit2, RotateCcw } from "lucide-react";
import { useReviewStore } from "../../store/reviewStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog";

export function DeckDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const decks = useReviewStore(state => state.decks);
  const flashcards = useReviewStore(state => state.flashcards);
  const deleteDeck = useReviewStore(state => state.deleteDeck);
  const addFlashcard = useReviewStore(state => state.addFlashcard);
  
  const deck = decks.find(d => d.id === id);
  const deckCards = flashcards.filter(f => f.deckId === id);
  const dueCards = deckCards.filter(f => f.dueDate <= Date.now());
  
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    if (!deck) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <h2 className="text-xl font-medium text-gray-900">Dek tidak ditemukan</h2>
        <Button variant="outline" onClick={() => navigate("/review")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Ulasan
        </Button>
      </div>
    );
  }

  const handleAddCard = (e: any) => {
    e.preventDefault();
    if (!front || !back) return;
    
    addFlashcard({
      front,
      back,
      deckId: deck.id,
      noteId: deck.noteId,
      conceptId: deck.conceptId
    });

    setFront("");
    setBack("");
    setIsAddCardOpen(false);
  };

  const handleDeleteDeck = () => {
    deleteDeck(deck.id);
    navigate("/review");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <Button variant="ghost" className="gap-2 -ml-3 text-gray-500 hover:text-gray-900" onClick={() => navigate("/review")}>
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="gap-2 text-gray-900 hover:text-gray-800 hover:bg-gray-50" onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Hapus Dek</span>
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{deck.name}</h1>
        {deck.description && (
          <p className="text-gray-600">{deck.description}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-1.5 font-medium text-gray-900 bg-gray-50 px-2 py-1 rounded">
            <RotateCcw className="w-4 h-4" />
            {dueCards.length} Jatuh Tempo
          </div>
          <span>{deckCards.length} Total Kartu</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button className="gap-2 bg-gray-900 text-white hover:bg-gray-800" disabled={dueCards.length === 0} onClick={() => navigate(`/review/${deck.id}/session`)}>
          <Play className="w-4 h-4 fill-current" />
          Mulai Ulasan
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => setIsAddCardOpen(true)}>
          <Plus className="w-4 h-4" />
          Tambah Kartu
        </Button>
      </div>

      <div className="space-y-4 mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Kartu Flash</h2>
        {deckCards.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
            Belum ada kartu di dek ini. Tambahkan beberapa kartu untuk mulai belajar.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {deckCards.map(card => (
              <div key={card.id} className="border border-gray-200 rounded-xl bg-white p-5 hover:shadow-sm transition-shadow flex flex-col gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Depan</h4>
                  <p className="text-gray-900 font-medium">{card.front}</p>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Belakang</h4>
                  <p className="text-gray-600">{card.back}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
        <DialogHeader>
          <DialogTitle>Kartu Flash Baru</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleAddCard}>
          <DialogContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Depan <span className="text-gray-500">*</span></label>
              <textarea 
                value={front}
                onChange={(e) => setFront(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 text-base md:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 resize-none" 
                placeholder="Pertanyaan atau konsep..."
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Belakang <span className="text-gray-500">*</span></label>
              <textarea 
                value={back}
                onChange={(e) => setBack(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 text-base md:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 resize-none" 
                placeholder="Jawaban atau penjelasan..."
                required
              />
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsAddCardOpen(false)} className="w-full sm:w-auto mb-2 sm:mb-0">
              Batal
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={!front.trim() || !back.trim()}>
              Tambah Kartu
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogHeader>
          <DialogTitle>Hapus Dek</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-gray-600">Apakah Anda yakin ingin menghapus "{deck.name}"? Semua {deckCards.length} kartu flash di dalamnya akan dihapus secara permanen.</p>
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>Batal</Button>
          <Button variant="destructive" onClick={handleDeleteDeck} className="bg-gray-900 hover:bg-gray-800 text-white">Hapus Dek</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
