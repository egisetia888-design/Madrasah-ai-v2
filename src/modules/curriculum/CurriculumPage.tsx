import { fetchWithAuth } from '../../lib/api';
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../../components/ui/Button"
import { PageHeader } from "../../components/ui/PageHeader"
import { EmptyState } from "../../components/ui/EmptyState"
import { MetadataRow } from "../../components/ui/MetadataRow"
import { Plus, Search, Milestone, Sparkles, Upload } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog"
import { useCurriculumStore } from "../../store/curriculumStore"
import { useToastStore } from "../../store/toastStore"
import { ImportCurriculumModal } from "../../components/curriculum/ImportCurriculumModal"

export function CurriculumPage() {
  const navigate = useNavigate()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
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
      
      const data = await res.json().catch(() => ({ error: res.statusText || "Respon server tidak valid." }));
      
      if (res.ok && data?.title && Array.isArray(data?.phases) && data.phases.length > 0) {
        const pathId = crypto.randomUUID();
        
        addPath({
          id: pathId,
          title: data.title,
          description: data.description || `Panduan belajar untuk ${topic}`,
        });

        data.phases.forEach((phaseData: any) => {
          const phaseId = crypto.randomUUID();
          addPhase({
            id: phaseId,
            pathId,
            title: phaseData.title,
            order: phaseData.order || 1,
          });

          if (Array.isArray(phaseData.competencies)) {
            phaseData.competencies.forEach((comp: any, cIdx: number) => {
              addCompetency({
                phaseId,
                title: comp.title,
                status: 'not-started',
                order: comp.order || cIdx + 1,
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
        updateToast(toastId, { type: 'error', message: data?.error || "Gagal merancang silabus dengan AI. Silakan coba lagi." });
      }
    } catch (err: any) {
      console.error("AI Syllabus Generation Error:", err);
      updateToast(toastId, { type: 'error', message: err?.message || "Gagal menghubungkan ke layanan AI." });
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full min-w-0 pb-12">
      <PageHeader
        title="Kurikulum"
        description="Kelola peta jalan belajar, fase penguasaan, dan kompetensi Anda."
        actions={
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" className="gap-2 border-gray-200 text-gray-700 hover:bg-gray-50" onClick={() => setIsImportOpen(true)}>
              <Upload className="w-4 h-4 text-gray-500" />
              <span>Impor Silabus</span>
            </Button>
            <Button variant="outline" className="gap-2 border-gray-200 text-gray-700 hover:bg-gray-50" onClick={() => setIsAiOpen(true)}>
              <Sparkles className="w-4 h-4 text-gray-700" />
              <span>AI Planner</span>
            </Button>
            <Button className="gap-2 bg-gray-900 text-white hover:bg-gray-800" onClick={() => setIsAddOpen(true)}>
              <Plus className="w-4 h-4" />
              <span>Kurikulum Baru</span>
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 h-11 w-full max-w-full sm:max-w-md focus-within:ring-2 focus-within:ring-gray-900 transition-all">
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
          <EmptyState
            icon={Milestone}
            title="Belum ada kurikulum"
            description="Buat kurikulum untuk menyusun perjalanan belajar Anda ke dalam fase dan kompetensi terukur."
            action={
              <Button className="gap-2" onClick={() => setIsAddOpen(true)}>
                <Plus className="w-4 h-4" />
                Buat Kurikulum
              </Button>
            }
          />
        ) : filteredPaths.length === 0 ? (
          <EmptyState
            compact
            icon={Search}
            title="Kurikulum tidak ditemukan"
            description="Tidak ada kurikulum yang sesuai dengan kata kunci pencarian Anda."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPaths.map(path => {
              const pathPhases = phases.filter(ph => ph.pathId === path.id);
              const pathComps = competencies.filter(c => pathPhases.some(ph => ph.id === c.phaseId));
              const doneComps = pathComps.filter(c => c.status === 'done').length;
              const totalComps = pathComps.length;
              const progressPct = totalComps > 0 ? Math.round((doneComps / totalComps) * 100) : 0;
              
              return (
                <div key={path.id} onClick={() => navigate(`/curriculum/${path.id}`)} className="group border border-gray-200 rounded-2xl bg-white p-5 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer flex flex-col min-h-[10.5rem] relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full">
                     <div className="h-full bg-gray-900 transition-all duration-500" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="mb-2">
                    <h3 className="font-semibold text-gray-900 line-clamp-1 font-display">{path.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 flex-1 mb-4 leading-relaxed">{path.description || "Belum ada deskripsi."}</p>
                  <div className="mt-auto pt-3 border-t border-gray-100">
                    <MetadataRow
                      items={[
                        `${doneComps}/${totalComps} kompetensi`,
                        `${progressPct}% selesai`,
                        new Date(path.updatedAt).toLocaleDateString('id-ID'),
                      ]}
                    />
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
            <Sparkles className="w-5 h-5 text-gray-900" />
            Perencana Silabus AI
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
            <p className="text-[11px] text-gray-500 font-mono">
              Hasil AI — periksa ke sumber sebelum dijadikan pegangan.
            </p>
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

      <ImportCurriculumModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />
    </div>
  )
}
