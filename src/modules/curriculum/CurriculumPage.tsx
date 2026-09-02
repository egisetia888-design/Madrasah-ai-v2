import { fetchWithAuth } from '../../lib/api';
import { SyncStatusIndicator } from '../../components/ui/SyncStatusIndicator';
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../../components/ui/Button"
import { Plus, Search, Map, Milestone, MoreVertical, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog"
import { useCurriculumStore } from "../../store/curriculumStore"
import { useToastStore } from "../../store/toastStore"

export function CurriculumPage() {
  const navigate = useNavigate()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  
  const [isAiOpen, setIsAiOpen] = useState(false)
  const [topic, setTopic] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  const paths = useCurriculumStore(state => state.paths)
  const phases = useCurriculumStore(state => state.phases)
  const competencies = useCurriculumStore(state => state.competencies)
  const addPath = useCurriculumStore(state => state.addPath)
  const addPhase = useCurriculumStore(state => state.addPhase)
  const addCompetency = useCurriculumStore(state => state.addCompetency)
  const addToast = useToastStore(state => state.addToast)
  const updateToast = useToastStore(state => state.updateToast)
  const [searchQuery, setSearchQuery] = useState("")

  const filteredPaths = paths.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())));

  const handleAddPath = (e: any) => {
    e.preventDefault()
    if (!title) return
    
    addPath({
      title,
      description,
    })

    setTitle("")
    setDescription("")
    setIsAddOpen(false)
  }

  const handleGenerateAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    
    setIsGenerating(true);
    const toastId = addToast({ type: 'loading', message: 'AI sedang menyusun silabus...' });
    
    try {
      const res = await fetchWithAuth("/api/ai/generate-syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.title && data.phases && data.phases.length > 0) {
        const pathId = crypto.randomUUID();
        
        addPath({
          id: pathId,
          title: data.title,
          description: data.description,
        });

        data.phases.forEach((phaseData: any) => {
          const phaseId = crypto.randomUUID();
          addPhase({
            id: phaseId,
            pathId,
            title: phaseData.title,
            order: phaseData.order,
          });

          if (phaseData.competencies) {
            phaseData.competencies.forEach((comp: any) => {
              addCompetency({
                phaseId,
                title: comp.title,
                status: 'not-started',
                order: comp.order || 0,
                bookIds: [],
                outputIds: []
              });
            });
          }
        });
        
        updateToast(toastId, { type: 'success', message: 'Silabus berhasil dibuat!' });
        setTopic("");
        setIsAiOpen(false);
        navigate(`/curriculum/${pathId}`);
      } else {
        updateToast(toastId, { type: 'error', message: data.error || "Gagal merancang silabus dengan AI." });
      }
    } catch (err: any) {
      console.error(err);
      updateToast(toastId, { type: 'error', message: "Gagal menghubungkan ke layanan AI." });
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full min-w-0 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-display">Kurikulum</h1>
          <p className="text-gray-500 mt-1 text-xs sm:text-sm">Kelola peta jalan belajar dan progres Anda.</p>
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" className="gap-2 h-11 sm:h-9" onClick={() => setIsAiOpen(true)}>
            <Sparkles className="w-4 h-4 text-gray-700" />
            <span>AI Planner</span>
          </Button>
          <Button className="gap-2 h-11 sm:h-9" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>Kurikulum Baru</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 h-11 w-full max-w-full sm:max-w-md focus-within:ring-2 focus-within:ring-gray-900 transition-all">
         <Search className="w-4 h-4 text-gray-400 shrink-0" />
         <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kurikulum belajar..." 
            className="bg-transparent border-none outline-none text-sm w-full text-gray-900 placeholder:text-gray-400"
         />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {paths.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/30">
             <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
               <Milestone className="w-6 h-6" />
             </div>
             <h3 className="text-sm font-medium text-gray-900">Belum ada kurikulum</h3>
             <p className="text-sm text-gray-500 mt-1 mb-4 max-w-sm">
               Buat kurikulum untuk menyusun perjalanan belajar Anda ke dalam fase dan kompetensi.
             </p>
             <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsAddOpen(true)}>
               <Plus className="w-3.5 h-3.5" />
               Buat Kurikulum
             </Button>
          </div>
        ) : filteredPaths.length === 0 ? (
           <div className="text-center py-12 text-gray-500">Tidak ada kurikulum yang cocok dengan pencarian.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPaths.map(path => {
              const pathPhases = phases.filter(ph => ph.pathId === path.id);
              const pathComps = competencies.filter(c => pathPhases.some(ph => ph.id === c.phaseId));
              const doneComps = pathComps.filter(c => c.status === 'done').length;
              const totalComps = pathComps.length;
              const progressPct = totalComps > 0 ? Math.round((doneComps / totalComps) * 100) : 0;
              
              return (
                <div key={path.id} onClick={() => navigate(`/curriculum/${path.id}`)} className="group border border-gray-200 rounded-xl bg-white p-5 hover:shadow-sm transition-shadow cursor-pointer flex flex-col h-40 relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full">
                     <div className="h-full bg-gray-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 line-clamp-1 flex-1 pr-2">{path.title}</h3>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-900 shrink-0">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 flex-1 mb-4">{path.description || "Tidak ada deskripsi"}</p>
                  <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-4 border-t border-gray-50">
                    <span>{new Date(path.updatedAt).toLocaleDateString()}</span>
                    <span className="font-medium text-gray-500">{progressPct}% Selesai</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogHeader>
          <DialogTitle>Kurikulum Baru</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleAddPath}>
          <DialogContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Judul <span className="text-gray-500">*</span></label>
              <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                type="text" 
                className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50/30 focus:bg-white px-3.5 py-2 text-base md:text-sm shadow-sm transition-all outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 placeholder:text-gray-400" 
                placeholder="Contoh: Dasar-dasar Ilmu Komputer"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Deskripsi</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="flex min-h-[100px] w-full rounded-xl border border-gray-200 bg-gray-50/30 focus:bg-white px-3.5 py-2.5 text-base md:text-sm shadow-sm transition-all outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 placeholder:text-gray-400 resize-none" 
                placeholder="Apa tujuan dari kurikulum ini?"
              />
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="w-full sm:w-auto hover:bg-gray-100/80">
              Batal
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={!title.trim()}>
              Buat Kurikulum
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={isAiOpen} onOpenChange={setIsAiOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-gray-900 animate-pulse" />
            AI Syllabus Planner
          </DialogTitle>
        </DialogHeader>
        <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleGenerateAi}>
          <DialogContent className="space-y-5">
            <p className="text-sm text-gray-600 leading-relaxed">
              Ketikkan topik atau skill yang ingin Anda kuasai. AI akan membuatkan jalur belajar lengkap dari pemula hingga mahir untuk Anda.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Topik Pembelajaran <span className="text-gray-500">*</span></label>
              <input 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                type="text" 
                className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50/30 focus:bg-white px-3.5 py-2 text-base md:text-sm shadow-sm transition-all outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 placeholder:text-gray-400" 
                placeholder="Misal: Sejarah Filsafat Barat, atau Pemrograman Golang"
                required
              />
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsAiOpen(false)} className="w-full sm:w-auto text-gray-500 hover:text-gray-900 hover:bg-gray-100/80">
              Batal
            </Button>
            <Button type="submit" className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white shadow-sm" disabled={!topic.trim() || isGenerating}>
              {isGenerating ? "Menyusun Silabus..." : "Buat Silabus"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
