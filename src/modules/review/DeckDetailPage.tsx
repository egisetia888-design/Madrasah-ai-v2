import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, Plus, Play, Trash2, RotateCcw, Layers } from "lucide-react";
import { useReviewStore } from "../../store/reviewStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { MetadataRow } from "../../components/ui/MetadataRow";
import { EmptyState } from "../../components/ui/EmptyState";

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
      <div className="flex flex-col items-center justify-center h-full space-y-4 py-20 text-center">
        <h2 className="text-xl font-semibold text-gray-900 font-display">Dek tidak ditemukan</h2>
        <Button variant="outline" onClick={() => navigate("/review")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Ulasan
        </Button>
      </div>
    );
  }

  const handleAddCard = (e: any) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    
    addFlashcard({
      front: front.trim(),
      back: back.trim(),
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
          <span>Kembali</span>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="gap-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100" onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Hapus Dek</span>
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-display">{deck.name}</h1>
        {deck.description && (
          <p className="text-gray-600 text-sm sm:text-base leading-relaxed">{deck.description}</p>
        )}
        <MetadataRow
          items={[
            <span className="inline-flex items-center gap-1.5 font-semibold text-gray-900">
              <RotateCcw className="w-3.5 h-3.5" /> {dueCards.length} jatuh tempo
            </span>,
            `${deckCards.length} total kartu`,
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
        <h2 className="text-lg font-semibold text-gray-900 font-display">Daftar Flashcard</h2>
        {deckCards.length === 0 ? (
          <EmptyState
            compact
            icon={Layers}
            title="Belum ada kartu di dek ini"
            description="Tambahkan beberapa kartu pertanyaan dan jawaban untuk mulai berlatih."
            action={
              <Button variant="outline" size="sm" onClick={() => setIsAddCardOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Tambah Kartu Pertama
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {deckCards.map(card => (
              <div key={card.id} className="border border-gray-200 rounded-2xl bg-white p-5 hover:shadow-sm transition-shadow flex flex-col gap-4">
                <div>
                  <h4 className="text-[11px] font-semibold text-gray-400 font-mono uppercase tracking-wider mb-1">Depan</h4>
                  <p className="text-gray-900 font-medium text-sm sm:text-base">{card.front}</p>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <h4 className="text-[11px] font-semibold text-gray-400 font-mono uppercase tracking-wider mb-1">Belakang</h4>
                  <p className="text-gray-600 text-sm leading-relaxed">{card.back}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
        <DialogHeader>
          <DialogTitle>Flashcard Baru</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleAddCard}>
          <DialogContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Depan <span className="text-gray-500">*</span></label>
              <textarea 
                value={front}
                onChange={(e) => setFront(e.target.value)}
                className="flex min-h-[80px] w-full rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-base md:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 focus-visible:border-gray-900 resize-none" 
                placeholder="Pertanyaan atau konsep..."
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Belakang <span className="text-gray-500">*</span></label>
              <textarea 
                value={back}
                onChange={(e) => setBack(e.target.value)}
                className="flex min-h-[80px] w-full rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-base md:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 focus-visible:border-gray-900 resize-none" 
                placeholder="Jawaban atau penjelasan..."
                required
              />
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsAddCardOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!front.trim() || !back.trim()}>
              Tambah Kartu
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Hapus Dek"
        description={`Apakah Anda yakin ingin menghapus "${deck.name}"? Semua ${deckCards.length} kartu di dalamnya akan dihapus secara permanen.`}
        confirmLabel="Hapus Dek"
        onConfirm={handleDeleteDeck}
      />
    </div>
  );
}
