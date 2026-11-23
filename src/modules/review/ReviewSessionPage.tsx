import { fetchWithAuth } from '../../lib/api';
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, CheckCircle2, BrainCircuit, Loader2 } from "lucide-react";
import { useReviewStore } from "../../store/reviewStore";
import { MarkdownRenderer } from "../../components/ui/MarkdownRenderer";
import { useToastStore } from "../../store/toastStore";

export function ReviewSessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const decks = useReviewStore(state => state.decks);
  const flashcards = useReviewStore(state => state.flashcards);
  const reviewFlashcard = useReviewStore(state => state.reviewFlashcard);
  const addToast = useToastStore(state => state.addToast);
  const updateToast = useToastStore(state => state.updateToast);
  
  const deck = decks.find(d => d.id === id);
  const allDueCards = flashcards.filter(f => f.deckId === id && f.dueDate <= Date.now());
  
  const [dueCards, setDueCards] = useState(allDueCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [completed, setCompleted] = useState(dueCards.length === 0);
  
  const [userAnswer, setUserAnswer] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{isCorrect: boolean, quality: number, feedback: string} | null>(null);

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

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-12rem)] space-y-6 max-w-md mx-auto text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-center text-gray-700 mb-1">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-display">Selesai!</h2>
        <p className="text-gray-500 text-sm sm:text-base leading-relaxed">Anda telah mengulas semua kartu yang jatuh tempo di {deck.name} hari ini. Kembali lagi besok.</p>
        <Button className="mt-2 w-full" onClick={() => navigate(`/review/${deck.id}`)}>
          Kembali ke Dek
        </Button>
      </div>
    );
  }

  const currentCard = dueCards[currentIndex];

  const handleReview = (quality: number) => {
    // quality: 0 (Again), 3 (Hard), 4 (Good), 5 (Easy)
    reviewFlashcard(currentCard.id, quality);
    
    // Move to next card
    if (currentIndex < dueCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
      setUserAnswer("");
      setEvaluationResult(null);
    } else {
      setCompleted(true);
    }
  };
  
  const handleEvaluate = async () => {
    if (!userAnswer.trim()) return;
    setIsEvaluating(true);
    setEvaluationResult(null);
    setShowAnswer(true); // show the real answer too
    const toastId = addToast({ type: 'loading', message: 'AI sedang mengevaluasi jawaban Anda...' });
    
    try {
      const res = await fetchWithAuth("/api/ai/grade-flashcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: currentCard.front, 
          correctAnswer: currentCard.back, 
          userAnswer 
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEvaluationResult(data);
        updateToast(toastId, { type: 'success', message: 'Evaluasi selesai.' });
      } else {
        setEvaluationResult({
          isCorrect: false,
          quality: 2,
          feedback: data.error || "Gagal menghubungkan ke AI Penilai. Silakan nilai sendiri secara manual."
        });
        updateToast(toastId, { type: 'error', message: data.error || 'Gagal mengevaluasi jawaban.' });
      }
    } catch (err: any) {
      console.error(err);
      setEvaluationResult({
        isCorrect: false,
        quality: 2,
        feedback: "Koneksi ke AI terputus. Silakan pilih nilai evaluasi manual di bawah ini."
      });
      updateToast(toastId, { type: 'error', message: 'Koneksi ke layanan AI terputus.' });
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 max-w-3xl mx-auto min-h-[calc(100dvh-11rem)] flex flex-col pb-6">
      <div className="flex items-center justify-between shrink-0">
        <Button variant="ghost" className="gap-2 -ml-3 text-gray-500 hover:text-gray-900" onClick={() => navigate(`/review/${deck.id}`)}>
          <ArrowLeft className="w-4 h-4" />
          Akhiri Sesi
        </Button>
        <div className="text-sm font-medium text-gray-500 font-mono tabular-nums">
          {currentIndex + 1} / {dueCards.length}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative">
        <div className="w-full border border-gray-200 rounded-2xl bg-white shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 sm:p-10 flex items-center justify-center text-center text-lg sm:text-2xl font-medium text-gray-900 font-display min-h-[180px]">
            {currentCard.front}
          </div>
          
          {showAnswer ? (
            <div className="p-6 sm:p-10 flex flex-col items-center justify-center text-center text-base sm:text-xl text-gray-700 bg-gray-50 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <span className="text-xs font-medium text-gray-400 font-mono uppercase tracking-wider mb-3">Jawaban Sebenarnya</span>
              <MarkdownRenderer>{currentCard.back}</MarkdownRenderer>
              
              {evaluationResult && (
                <div className="mt-6 p-4 rounded-xl text-left text-sm w-full border bg-white border-gray-200 text-gray-900">
                  <div className="flex items-center gap-2 mb-2">
                    <BrainCircuit className="w-4 h-4" />
                    <span className="font-semibold font-display">Penilaian AI (Kualitas: <span className="font-mono tabular-nums">{evaluationResult.quality}/5</span>)</span>
                  </div>
                  <p className="text-gray-700 leading-relaxed">{evaluationResult.feedback}</p>
                  <p className="text-[11px] text-gray-500 font-mono mt-2 pt-2 border-t border-gray-100">
                    Hasil AI — periksa ke sumber sebelum dijadikan pegangan.
                  </p>
                </div>
              )}
              {isEvaluating && (
                <div className="mt-6 p-4 rounded-xl text-left text-sm w-full border bg-white border-gray-200 text-gray-900 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI sedang menilai jawaban Anda...</span>
                </div>
              )}
            </div>
          ) : (
             <div className="p-4 sm:p-6 bg-gray-50 border-t border-gray-100 flex flex-col items-center gap-4">
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 resize-none"
                  rows={3}
                  placeholder="Ketik jawaban Anda di sini untuk dinilai AI (Opsional)..."
                />
                <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => setShowAnswer(true)}>
                    Lihat Jawaban
                  </Button>
                  <Button className="flex-1 gap-2 bg-gray-900 hover:bg-gray-800 text-white" onClick={handleEvaluate} disabled={!userAnswer.trim() || isEvaluating}>
                    <BrainCircuit className="w-4 h-4" />
                    Nilai dengan AI
                  </Button>
                </div>
             </div>
          )}
        </div>
      </div>

      {showAnswer && !isEvaluating && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0 animate-in slide-in-from-bottom-2 duration-300">
          <Button variant="outline" className="min-h-[64px] py-2 flex flex-col gap-0.5 px-2 border-gray-200 hover:bg-gray-100 hover:text-gray-900" onClick={() => handleReview(0)}>
            <span className="font-semibold text-sm">Ulangi</span>
            <span className="text-[11px] text-gray-400 font-mono">1m</span>
          </Button>
          <Button variant="outline" className="min-h-[64px] py-2 flex flex-col gap-0.5 px-2 border-gray-200 hover:bg-gray-100 hover:text-gray-900" onClick={() => handleReview(3)}>
            <span className="font-semibold text-sm">Sulit</span>
            <span className="text-[11px] text-gray-400 font-mono">1h</span>
          </Button>
          <Button variant="outline" className="min-h-[64px] py-2 flex flex-col gap-0.5 px-2 border-gray-200 hover:bg-gray-100 hover:text-gray-900" onClick={() => handleReview(4)}>
            <span className="font-semibold text-sm">Sedang</span>
            <span className="text-[11px] text-gray-400 font-mono">3h</span>
          </Button>
          <Button variant="outline" className="min-h-[64px] py-2 flex flex-col gap-0.5 px-2 border-gray-200 hover:bg-gray-100 hover:text-gray-900" onClick={() => handleReview(5)}>
            <span className="font-semibold text-sm">Mudah</span>
            <span className="text-[11px] text-gray-400 font-mono">4h</span>
          </Button>
        </div>
      )}
    </div>
  );
}
