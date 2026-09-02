import { useEffect, useState } from 'react';
import { useTourStore } from '../../store/tourStore';
import { useUIStore } from '../../store/uiStore';
import { Dialog, DialogContent } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Brain, LayoutDashboard, Library, PenTool, Network, ChevronRight, Check, ArrowRight, BookOpen, Target, Sparkles, Plus } from 'lucide-react';
import { cn } from '../../utils/cn';

const steps = [
  {
    title: "Membangun Otak Kedua",
    description: "Madrasah bukan sekadar aplikasi catatan biasa, melainkan External Brain (Otak Kedua) Anda. Bebaskan pikiran Anda untuk mencipta, biarkan sistem yang mengingat.",
    highlights: ["Sistem Zettelkasten", "Spaced Repetition", "Knowledge Graph"],
    icon: Brain,
    color: "text-gray-900",
    bgColor: "bg-gray-100",
  },
  {
    title: "Pustaka & Kurikulum",
    description: "Kumpulkan buku, kitab, jurnal, dan artikel. Susun peta jalan belajar Anda secara terstruktur dengan fitur Kurikulum.",
    highlights: ["Manajemen Literatur", "Peta Jalan Belajar", "Tracking Progres"],
    icon: Library,
    color: "text-gray-900",
    bgColor: "bg-gray-100",
  },
  {
    title: "Menulis & Terhubung",
    description: "Catat Ide (Fakta, Riset, Proyek) lalu hubungkan semuanya. Graf Pengetahuan akan memvisualisasikan wawasan baru dari koneksi antar ide Anda.",
    highlights: ["Catatan Terstruktur", "Backlinking", "Visualisasi Relasi"],
    icon: Network,
    color: "text-gray-900",
    bgColor: "bg-gray-100",
  }
];

export function OnboardingTour() {
  const { isTourOpen, hasSeenTour, startTour, completeTour } = useTourStore();
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!hasSeenTour) {
      const timer = setTimeout(() => {
        startTour();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTour, startTour]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
      setCurrentStep(0);
    }
  };

  const handleStartWriting = () => {
    completeTour();
    setCurrentStep(0);
    setTimeout(() => {
    }, 300);
  }

  const StepIcon = steps[currentStep].icon;

  return (
    <Dialog open={isTourOpen} onOpenChange={(open) => {
      if (!open) {
        completeTour();
        setCurrentStep(0);
      }
    }} maxWidthClass="max-w-4xl">
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden md:min-h-[480px]">
        {/* Left Side: Illustration / Graphic Area */}
        <div className="w-full h-48 md:h-auto md:w-5/12 bg-gray-50 flex flex-col items-center justify-center p-4 md:p-10 border-b md:border-b-0 md:border-r border-gray-100 relative overflow-hidden shrink-0">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-30 pointer-events-none">
             <div className="absolute -top-10 -left-10 w-32 h-32 md:w-40 md:h-40 bg-gray-200 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
             <div className="absolute top-0 -right-10 w-32 h-32 md:w-40 md:h-40 bg-gray-200 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
             <div className="absolute -bottom-10 left-20 w-32 h-32 md:w-40 md:h-40 bg-gray-200 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className={cn("w-20 h-20 md:w-24 md:h-24 rounded-3xl flex items-center justify-center mb-6 md:mb-8 shadow-sm transition-all duration-500 scale-100", steps[currentStep].bgColor)}>
              <StepIcon className={cn("w-10 h-10 md:w-12 md:h-12", steps[currentStep].color)} />
            </div>
            
            {/* Abstract Wireframe Representation */}
            <div className="w-full max-w-[160px] md:max-w-[200px] space-y-2 md:space-y-3 opacity-80">
              <div className="h-2 w-3/4 bg-gray-200 rounded-full mx-auto" />
              <div className="h-2 w-full bg-gray-200 rounded-full" />
              <div className="h-2 w-5/6 bg-gray-200 rounded-full mx-auto" />
              
              <div className="flex justify-center gap-2 pt-3 md:pt-4">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white shadow-sm border border-gray-100 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-gray-400" />
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white shadow-sm border border-gray-100 flex items-center justify-center">
                  <Target className="w-4 h-4 text-gray-400" />
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white shadow-sm border border-gray-100 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Content & Actions */}
        <div className="md:w-7/12 flex flex-col p-6 md:p-12 bg-white shrink-0 md:overflow-y-auto">
          <div className="flex-1">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4 tracking-tight">
              {steps[currentStep].title}
            </h2>
            <p className="text-base md:text-lg text-gray-500 leading-relaxed mb-6 md:mb-8">
              {steps[currentStep].description}
            </p>

            <div className="space-y-3 mb-6 md:mb-8">
              {steps[currentStep].highlights.map((highlight, idx) => (
                <div key={idx} className="flex items-center gap-3 text-gray-700 font-medium">
                  <div className="w-5 h-5 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-gray-900" />
                  </div>
                  {highlight}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-gray-100">
            {/* Progress Dots */}
            <div className="flex items-center gap-2">
              {steps.map((_, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "h-2 rounded-full transition-all duration-300", 
                    idx === currentStep ? "w-8 bg-gray-900" : "w-2 bg-gray-200 cursor-pointer hover:bg-gray-300"
                  )}
                  onClick={() => setCurrentStep(idx)}
                />
              ))}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button 
                variant="ghost" 
                onClick={() => {
                  completeTour();
                  setCurrentStep(0);
                }}
                className="text-gray-500 hover:text-gray-900 hidden sm:flex"
              >
                Lewati
              </Button>
              {currentStep < steps.length - 1 ? (
                <Button onClick={handleNext} className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white gap-2 px-6">
                  Lanjut <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={handleStartWriting} className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white gap-2 px-6 shadow-sm">
                  <Plus className="w-4 h-4" /> Mulai Catatan Pertama
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
