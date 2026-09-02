import { useState, useMemo, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Play, BookOpen, Map, Brain, FileText, PenTool, Briefcase, Plus, Book, ChevronRight, Activity, Sparkles, Command, Link as LinkIcon, Clock } from "lucide-react"
import { useLibraryStore } from "../../store/libraryStore"
import { useNotesStore } from "../../store/notesStore"
import { useCurriculumStore } from "../../store/curriculumStore"
import { useReviewStore } from "../../store/reviewStore"
import { useWritingStore } from "../../store/writingStore"
import { useProjectsStore } from "../../store/projectsStore"
import { useKnowledgeStore } from "../../store/knowledgeStore"
import { useUIStore } from "../../store/uiStore"
import { Button } from "../../components/ui/Button"
import { cn } from "../../utils/cn"

export function DashboardPage() {
  const navigate = useNavigate()
  
  const setSearchOpen = useUIStore(state => state.setSearchOpen)
  
  const books = useLibraryStore(state => state.books)
  const authors = useLibraryStore(state => state.authors)
  const notes = useNotesStore(state => state.notes)
  const paths = useCurriculumStore(state => state.paths)
  const competencies = useCurriculumStore(state => state.competencies)
  const phases = useCurriculumStore(state => state.phases)
  const flashcards = useReviewStore(state => state.flashcards)
  const drafts = useWritingStore(state => state.drafts)
  const projects = useProjectsStore(state => state.projects)
  const concepts = useKnowledgeStore(state => state.concepts)
  const relations = useKnowledgeStore(state => state.relations)
  
  const currentlyReading = books.filter(b => b.status === 'reading')
  const activePaths = paths
  const dueCards = flashcards.filter(f => f.dueDate <= Date.now())
  const activeDrafts = drafts.filter(d => d.status === 'draft').sort((a,b) => b.updatedAt - a.updatedAt).slice(0, 2)
  const activeProjects = [...projects].sort((a, b) => b.createdAt - a.createdAt).slice(0, 2)

  // Titik yang belum terhubung (0-1 relasi)
  const unconnectedStats = useMemo(() => {
    let unconnectedNotes = 0;
    let unconnectedConcepts = 0;

    notes.forEach(note => {
      const relCount = relations.filter(r => r.sourceNodeId === note.id || r.targetNodeId === note.id).length;
      if (relCount <= 1) unconnectedNotes++;
    });

    concepts.forEach(concept => {
      const relCount = relations.filter(r => r.sourceNodeId === concept.id || r.targetNodeId === concept.id).length;
      if (relCount <= 1) unconnectedConcepts++;
    });

    return { notes: unconnectedNotes, concepts: unconnectedConcepts, total: unconnectedNotes + unconnectedConcepts };
  }, [notes, concepts, relations]);

  // Resurfacing Mingguan
  const resurfacedNotes = useMemo(() => {
    const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const oldProcessedNotes = notes.filter(n => n.status === 'processed' && (now - n.updatedAt) > FOURTEEN_DAYS);
    
    const weekNumber = Math.floor(now / (7 * 24 * 60 * 60 * 1000));
    
    if (oldProcessedNotes.length > 0) {
       const sorted = [...oldProcessedNotes].sort((a,b) => a.id.localeCompare(b.id));
       const startIndex = weekNumber % sorted.length;
       return [
         sorted[startIndex],
         sorted[(startIndex + 1) % sorted.length],
       ].slice(0, Math.min(2, sorted.length));
    }
    
    return [];
  }, [notes]);

  // Calculate overall learning progress
  const totalCompetencies = competencies.length;
  const doneCompetencies = competencies.filter(c => c.status === 'done').length;
  const globalProgress = totalCompetencies > 0 ? Math.round((doneCompetencies / totalCompetencies) * 100) : 0;

  const { greeting, quote } = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreeting = "malam";
    let quotes: string[] = [];

    if (hour >= 3 && hour < 11) {
      timeGreeting = "pagi";
      quotes = [
        "Mari mulai lembaran baru dengan semangat.",
        "Pagi yang cerah untuk ide-ide cemerlang.",
        "Fokuskan pikiran untuk menyerap ilmu baru hari ini."
      ];
    } else if (hour >= 11 && hour < 15) {
      timeGreeting = "siang";
      quotes = [
        "Tetap produktif dan jaga fokus Anda.",
        "Istirahat sejenak, lalu lanjutkan pekerjaan besar Anda.",
        "Sedikit demi sedikit, pemahaman semakin dalam."
      ];
    } else if (hour >= 15 && hour < 18) {
      timeGreeting = "sore";
      quotes = [
        "Waktu yang tepat untuk mereview apa yang telah dipelajari.",
        "Akhiri hari dengan menyempurnakan catatan Anda.",
        "Tetap semangat menyelesaikan target hari ini."
      ];
    } else {
      timeGreeting = "malam";
      quotes = [
        "Waktunya refleksi dan merencanakan esok hari.",
        "Tenangkan pikiran, susun ulang ide-ide Anda.",
        "Malam yang tenang untuk membaca dan mendalami konsep."
      ];
    }
    
    const quoteIndex = new Date().getDate() % quotes.length;

    return {
      greeting: `Assalamualaikum, selamat ${timeGreeting}`,
      quote: quotes[quoteIndex]
    };
  }, []);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-24">
      {/* Hero / Mission Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-display">{greeting}</h1>
          <p className="text-gray-500 mt-1 text-base">{quote}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button onClick={() => setSearchOpen(true)} variant="outline" className="gap-2 shrink-0 bg-white shadow-sm border-gray-200 hidden sm:flex">
            <Command className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Palette (Cmd+K)</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Column: Action-Oriented */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Lanjutkan Aktivitas (Resume) */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 text-gray-900 font-display">
              <Activity className="w-5 h-5 text-gray-500" /> Prioritas Teratas
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Reading Priority */}
              {currentlyReading.length > 0 ? (
                <div onClick={() => navigate(`/library/${currentlyReading[0].id}`)} className="p-5 border border-gray-200 rounded-2xl bg-white hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between min-h-[160px]">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      <BookOpen className="w-3.5 h-3.5" /> Sedang Membaca
                    </div>
                    <h3 className="font-semibold text-gray-900 text-base line-clamp-2 group-hover:text-gray-900 transition-colors">{currentlyReading[0].title}</h3>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">Lanjutkan</span>
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-50 transition-colors">
                      <Play className="w-3.5 h-3.5 fill-current text-gray-900 ml-0.5" />
                    </div>
                  </div>
                </div>
              ) : (
                <div onClick={() => navigate('/library')} className="p-5 border border-dashed border-gray-200 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all cursor-pointer flex flex-col justify-center items-center text-center min-h-[160px]">
                   <BookOpen className="w-6 h-6 text-gray-400 mb-2" />
                   <p className="text-sm font-medium text-gray-600">Pilih buku untuk dibaca</p>
                </div>
              )}

              {/* Spaced Repetition Priority */}
              <div onClick={() => navigate('/review')} className={cn(
                "p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between min-h-[160px] group",
                dueCards.length > 0 ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md" : "bg-white border border-gray-200 hover:border-gray-300"
              )}>
                <div>
                  <div className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-3", dueCards.length > 0 ? "text-gray-400" : "text-gray-500")}>
                    <Brain className="w-3.5 h-3.5" /> Tugas Review
                  </div>
                  <h3 className={cn("font-bold text-2xl tracking-tight", dueCards.length > 0 ? "text-white" : "text-gray-900")}>
                    {dueCards.length} <span className="text-lg font-medium opacity-80">Kartu</span>
                  </h3>
                  <p className={cn("text-sm mt-1", dueCards.length > 0 ? "text-gray-300" : "text-gray-500")}>
                    {dueCards.length > 0 ? "Menunggu untuk direview hari ini." : "Semua kartu sudah direview."}
                  </p>
                </div>
                {dueCards.length > 0 && (
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-white">Mulai Sesi</span>
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Active Work (Writing & Projects) */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight text-gray-900 font-display">Ruang Produksi</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><PenTool className="w-4 h-4 text-gray-400" /> Draf Tulisan</h3>
                  <button onClick={() => navigate('/writing')} className="text-xs font-medium text-gray-900 hover:text-gray-800">Lihat Semua</button>
                </div>
                <div className="space-y-3">
                  {activeDrafts.length > 0 ? activeDrafts.map(draft => (
                    <div key={draft.id} onClick={() => navigate(`/writing/${draft.id}`)} className="group cursor-pointer">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-gray-900 transition-colors truncate">{draft.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{draft.content || "Belum ada konten..."}</p>
                    </div>
                  )) : <p className="text-sm text-gray-500 italic">Tidak ada draf tulisan.</p>}
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Briefcase className="w-4 h-4 text-gray-400" /> Proyek Aktif</h3>
                  <button onClick={() => navigate('/projects')} className="text-xs font-medium text-gray-900 hover:text-gray-800">Lihat Semua</button>
                </div>
                <div className="space-y-3">
                  {activeProjects.length > 0 ? activeProjects.map(project => (
                    <div key={project.id} onClick={() => navigate(`/projects/${project.id}`)} className="group cursor-pointer">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-gray-900 transition-colors truncate">{project.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{project.description || "Proyek aktif..."}</p>
                    </div>
                  )) : <p className="text-sm text-gray-500 italic">Tidak ada proyek aktif.</p>}
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* Sidebar Column: Context & Insights */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Refleksi Pasif (Fondasi PRD 11) */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight text-gray-900 font-display flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-gray-500" /> Refleksi Pasif
            </h2>

            {/* Belum Terhubung (Unconnected Entites) */}
            {(unconnectedStats.total > 0) && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm group hover:border-gray-300 transition-all cursor-pointer" onClick={() => navigate('/graph')}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-gray-400" /> Belum Terhubung
                  </h3>
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {unconnectedStats.total}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Ada <span className="font-bold text-gray-900">{unconnectedStats.notes} catatan</span> dan <span className="font-bold text-gray-900">{unconnectedStats.concepts} konsep</span> yang memiliki kurang dari 2 relasi.
                </p>
                <div className="flex items-center text-xs font-medium text-gray-900 group-hover:text-gray-600">
                  Lihat Graf Pengetahuan <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            )}

            {/* Resurfacing Mingguan */}
            {resurfacedNotes.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <h3 className="font-semibold text-gray-900">Resurfacing Mingguan</h3>
                </div>
                <div className="space-y-3">
                  {resurfacedNotes.map(note => (
                    <div key={note.id} onClick={() => navigate(`/notes/${note.id}`)} className="group cursor-pointer block p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-gray-900 transition-colors line-clamp-1">{note.title}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {note.content.substring(0, 100)}...
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Insights & Context */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-gray-900" />
              <h2 className="text-lg font-bold text-gray-900 font-display">AI Copilot</h2>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              Anda memiliki <span className="font-bold text-gray-800">{notes.filter(n => n.status === 'unprocessed').length} catatan baru</span> di Inbox yang belum diproses. Ingin saya bantu mengekstrak flashcard atau menyarankan koneksi ke catatan lain?
            </p>
            <Button onClick={() => navigate('/notes')} className="w-full mt-4 bg-gray-900 hover:bg-gray-800 text-white shadow-sm">
              Proses Inbox
            </Button>
          </div>

          {/* Curriculum Progress */}
          <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900 font-display flex items-center gap-2">
                <Map className="w-4 h-4 text-gray-400" /> Kurikulum
              </h2>
            </div>
            <div className="mb-4">
              <div className="flex items-end justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Progres Keseluruhan</span>
                <span className="text-xl font-bold text-gray-900">{globalProgress}%</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-900 rounded-full transition-all duration-500" style={{ width: `${globalProgress}%` }} />
              </div>
            </div>
            
            <div className="space-y-3 mt-5">
              {activePaths.slice(0, 3).map(path => {
                const pathPhases = phases.filter(ph => ph.pathId === path.id);
                const pathComps = competencies.filter(c => pathPhases.some(ph => ph.id === c.phaseId));
                const doneComps = pathComps.filter(c => c.status === 'done').length;
                const totalComps = pathComps.length;
                const pct = totalComps > 0 ? Math.round((doneComps / totalComps) * 100) : 0;
                
                return (
                  <div key={path.id} className="flex flex-col gap-1.5 cursor-pointer group" onClick={() => navigate('/curriculum')}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900 transition-colors truncate pr-2">{path.title}</span>
                      <span className="text-xs font-semibold text-gray-500">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
             <div onClick={() => navigate('/notes')} className="p-4 bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-gray-300 transition-colors">
               <span className="text-2xl font-bold text-gray-900 font-mono">{notes.length}</span>
               <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mt-1">Catatan</span>
             </div>
             <div onClick={() => navigate('/library')} className="p-4 bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-gray-300 transition-colors">
               <span className="text-2xl font-bold text-gray-900 font-mono">{books.length}</span>
               <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mt-1">Buku</span>
             </div>
          </div>

        </div>
      </div>
    </div>
  )
}

