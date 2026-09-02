import { fetchWithAuth } from '../../lib/api';
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, CheckCircle2, BrainCircuit } from "lucide-react";
import { useReviewStore } from "../../store/reviewStore";
import Markdown from "react-markdown";
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
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <h2 className="text-xl font-medium text-gray-900">Deck tidak ditemukan</h2>
        <Button variant="outline" onClick={() => navigate("/review")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Review
        </Button>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] space-y-6 max-w-md mx-auto text-center animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-500 mb-2">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Selesai!</h2>
        <p className="text-gray-500">Anda telah mereview semua kartu yang jatuh tempo di {deck.name} hari ini. Kembali lagi besok.</p>
        <Button className="mt-4 w-full" onClick={() => navigate(`/review/${deck.id}`)}>
          Kembali ke Deck
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
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500 max-w-3xl mx-auto h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <Button variant="ghost" className="gap-2 -ml-3 text-gray-500 hover:text-gray-900" onClick={() => navigate(`/review/${deck.id}`)}>
          <ArrowLeft className="w-4 h-4" />
          Akhiri Sesi
        </Button>
        <div className="text-sm font-medium text-gray-500">
          {currentIndex + 1} / {dueCards.length}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative">
        <div className="w-full max-h-full border border-gray-200 rounded-2xl bg-white shadow-sm flex flex-col overflow-y-auto">
          <div className="p-8 md:p-12 flex items-center justify-center text-center text-xl md:text-2xl font-medium text-gray-900 min-h-[200px]">
            {currentCard.front}
          </div>
          
          {showAnswer ? (
            <div className="p-8 md:p-12 flex flex-col items-center justify-center text-center text-lg md:text-xl text-gray-700 bg-gray-50 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <span className="text-sm font-medium text-gray-400 mb-2">Jawaban Sebenarnya:</span>
              <Markdown>{currentCard.back}</Markdown>
              
              {evaluationResult && (
                <div className={`mt-6 p-4 rounded-xl text-left text-sm w-full border ${evaluationResult.isCorrect ? 'bg-gray-50 border-gray-200 text-gray-900' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <BrainCircuit className="w-4 h-4" />
                    <span className="font-semibold">Penilaian AI (Kualitas: {evaluationResult.quality}/5)</span>
                  </div>
                  <p>{evaluationResult.feedback}</p>
                </div>
              )}
              {isEvaluating && (
                <div className="mt-6 p-4 rounded-xl text-left text-sm w-full border bg-gray-50 border-gray-200 text-gray-900 flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 animate-pulse" />
                  <span>AI sedang menilai jawaban Anda...</span>
                </div>
              )}
            </div>
          ) : (
             <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col items-center gap-4">
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500 resize-none"
                  rows={3}
                  placeholder="Ketik jawaban Anda di sini untuk dinilai AI (Opsional)..."
                />
                <div className="flex gap-2 w-full max-w-md">
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => setShowAnswer(true)}>
                    Lihat Jawaban
                  </Button>
                  <Button className="flex-1 gap-2 bg-gray-900 hover:bg-gray-800" onClick={handleEvaluate} disabled={!userAnswer.trim() || isEvaluating}>
                    <BrainCircuit className="w-4 h-4" />
                    Nilai dengan AI
                  </Button>
                </div>
             </div>
          )}
        </div>
      </div>

      {showAnswer && !isEvaluating && (
        <div className="grid grid-cols-4 gap-2 shrink-0 animate-in slide-in-from-bottom-2 duration-300">
          <Button variant="outline" className="h-16 flex flex-col gap-1 px-1 border-gray-200 hover:bg-gray-100 hover:text-gray-900" onClick={() => handleReview(0)}>
            <span className="font-semibold text-sm md:text-base">Ulangi</span>
            <span className="text-[10px] md:text-xs text-gray-400 font-normal">1m</span>
          </Button>
          <Button variant="outline" className="h-16 flex flex-col gap-1 px-1 border-gray-200 hover:bg-gray-100 hover:text-gray-900" onClick={() => handleReview(3)}>
            <span className="font-semibold text-sm md:text-base">Sulit</span>
            <span className="text-[10px] md:text-xs text-gray-400 font-normal">1h</span>
          </Button>
          <Button variant="outline" className="h-16 flex flex-col gap-1 px-1 border-gray-200 hover:bg-gray-100 hover:text-gray-900" onClick={() => handleReview(4)}>
            <span className="font-semibold text-sm md:text-base">Sedang</span>
            <span className="text-[10px] md:text-xs text-gray-400 font-normal">3h</span>
          </Button>
          <Button variant="outline" className="h-16 flex flex-col gap-1 px-1 border-gray-200 hover:bg-gray-100 hover:text-gray-900" onClick={() => handleReview(5)}>
            <span className="font-semibold text-sm md:text-base">Mudah</span>
            <span className="text-[10px] md:text-xs text-gray-400 font-normal">4h</span>
          </Button>
        </div>
      )}
    </div>
  );
}
