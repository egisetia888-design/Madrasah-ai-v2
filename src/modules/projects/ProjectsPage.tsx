import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../../components/ui/Button"
import { PageHeader } from "../../components/ui/PageHeader"
import { EmptyState } from "../../components/ui/EmptyState"
import { MetadataRow } from "../../components/ui/MetadataRow"
import { Plus, Search, Briefcase, LayoutList, Calendar, CheckCircle2, Clock, Inbox, PlayCircle, Network } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog"
import { useProjectsStore } from "../../store/projectsStore"
import { useKnowledgeStore } from "../../store/knowledgeStore"
import { ProjectStatus } from "../../types"
import { cn } from "../../utils/cn"
import { autoLinkSingleEntity } from "../../utils/autoLinker"

export function ProjectsPage() {
  const navigate = useNavigate()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [status, setStatus] = useState<ProjectStatus>('planned')
  
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<ProjectStatus | 'all'>('all')
  
  const projects = useProjectsStore(state => state.projects)
  const tasks = useProjectsStore(state => state.tasks)
  const addProject = useProjectsStore(state => state.addProject)
  const relations = useKnowledgeStore(state => state.relations)
  
  const handleAddProject = (e: any) => {
    e.preventDefault()
    if (!title) return
    
    const newProjectId = crypto.randomUUID();
    addProject({
      id: newProjectId,
      title,
      description,
      status,
      dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
    } as any)

    // Auto-link entities mentioned in project title & description
    try {
      autoLinkSingleEntity(newProjectId, `${title}\n${description}`, 'project', title);
    } catch (err) {
      console.warn('Project auto-linking error:', err);
    }
    
    setTitle("")
    setDescription("")
    setDueDate("")
    setStatus('planned')
    setIsAddOpen(false)
  }

  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const matchesSearch = 
        project.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesTab = activeTab === 'all' || project.status === activeTab;
      
      return matchesSearch && matchesTab;
    });
  }, [projects, searchQuery, activeTab]);

  const tabs: { id: ProjectStatus | 'all', label: string, icon: any }[] = [
    { id: 'all', label: 'Semua Proyek', icon: Briefcase },
    { id: 'planned', label: 'Direncanakan', icon: Inbox },
    { id: 'active', label: 'Aktif', icon: PlayCircle },
    { id: 'review', label: 'Evaluasi', icon: Clock },
    { id: 'completed', label: 'Selesai', icon: CheckCircle2 },
  ];

  const getStatusLabel = (status: ProjectStatus) => {
    switch (status) {
      case 'active': return 'Aktif';
      case 'completed': return 'Selesai';
      case 'planned': return 'Direncanakan';
      case 'review': return 'Evaluasi';
      case 'archived': return 'Diarsipkan';
      default: return 'Lainnya';
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full min-w-0 pb-12">
      <PageHeader
        title="Proyek"
        description="Kelola inisiatif pembelajaran, target pencapaian, dan daftar tugas dalam satu alur terstruktur."
        actions={
          <Button className="w-full sm:w-auto gap-2" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>Proyek Baru</span>
          </Button>
        }
      />

      <div className="space-y-3 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 h-11 w-full focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-transparent transition-all"> 
           <Search className="w-4 h-4 text-gray-400 shrink-0" />
           <input 
               type="text" 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               placeholder="Cari judul proyek, tujuan..." 
               className="bg-transparent border-none outline-none text-sm w-full text-gray-900 placeholder:text-gray-400"
           />
        </div>
        
        <div className="flex items-center gap-1.5 overflow-x-auto w-full no-scrollbar py-1 scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0">
          {tabs.map(tab => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 min-h-[44px] sm:min-h-0 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer",
                activeTab === tab.id 
                  ? "bg-gray-900 text-white shadow-sm font-semibold" 
                  : "bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 active:bg-gray-100"
              )}
            >
              <tab.icon className={cn("w-3.5 h-3.5 shrink-0", activeTab === tab.id ? "text-gray-300" : "text-gray-400")} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {projects.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Belum ada proyek aktif"
            description="Mulai inisiatif baru untuk memecah tujuan belajar besar menjadi tugas yang dapat ditindaklanjuti."
            action={
              <Button onClick={() => setIsAddOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Buat Proyek Pertama
              </Button>
            }
          />
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            compact
            icon={Search}
            title="Proyek tidak ditemukan"
            description="Tidak ada proyek yang sesuai dengan kata kunci atau filter status saat ini."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredProjects.map(project => {
              const projectTasks = tasks.filter(t => t.projectId === project.id);
              const doneTasks = projectTasks.filter(t => t.status === 'done').length;
              const totalTasks = projectTasks.length;
              const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
              const relCount = relations.filter(r => r.sourceNodeId === project.id || r.targetNodeId === project.id).length;
              const isOverdue = project.dueDate && project.dueDate < Date.now() && project.status !== 'completed';
              
              return (
                <div key={project.id} onClick={() => navigate(`/projects/${project.id}`)} className="group border border-gray-200 rounded-2xl bg-white p-5 hover:shadow-sm hover:border-gray-300 transition-all cursor-pointer flex flex-col relative overflow-hidden">
                  {(project.status === 'active' || progressPct > 0) && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 z-10">
                      <div className="h-full bg-gray-900 transition-all duration-500" style={{ width: `${progressPct}%` }} />
                    </div>
                  )}
                  
                  <div className="mb-3 mt-1 space-y-1">
                    <h3 className="text-base font-bold text-gray-900 leading-snug line-clamp-2 font-display">{project.title}</h3>
                    <MetadataRow
                      items={[
                        <span className={project.status === 'active' || project.status === 'completed' ? "text-gray-900 font-semibold" : "text-gray-500"}>
                          {getStatusLabel(project.status)}
                        </span>,
                        `${progressPct}%`,
                      ]}
                    />
                  </div>
                  
                  <p className="text-sm text-gray-600 line-clamp-3 flex-1 mb-5 leading-relaxed">{project.description || "Belum ada deskripsi."}</p>
                  
                  <div className="flex flex-col gap-2 mt-auto pt-3.5 border-t border-gray-100">
                    <MetadataRow
                      items={[
                        <span className="inline-flex items-center gap-1">
                          <LayoutList className="w-3 h-3" /> {doneTasks}/{totalTasks} tugas
                        </span>,
                        relCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-gray-700">
                            <Network className="w-3 h-3" /> {relCount} relasi
                          </span>
                        ),
                      ]}
                    />

                    <MetadataRow
                      items={[
                        project.dueDate ? (
                          <span className={cn("inline-flex items-center gap-1", isOverdue ? "text-gray-900 font-semibold" : "text-gray-500")}>
                            <Calendar className="w-3 h-3" />
                            {isOverdue ? 'Terlewat ' : 'Tenggat '}
                            {new Date(project.dueDate).toLocaleDateString('id-ID')}
                          </span>
                        ) : 'Tanpa tenggat',
                        `Diperbarui ${new Date(project.updatedAt).toLocaleDateString('id-ID')}`,
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogHeader>
          <DialogTitle>Mulai Proyek Baru</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleAddProject}>
          <DialogContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Judul Proyek <span className="text-gray-500">*</span></label>
              <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                type="text" 
                className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent" 
                placeholder="Contoh: Menguasai Kinerja React"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Deskripsi / Tujuan</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="flex min-h-[100px] w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent resize-none" 
                placeholder="Apa tujuan utama dari proyek ini? Apa hasil akhirnya?"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Tenggat Waktu (Opsional)</label>
                <input 
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  type="date" 
                  className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Status</label>
                <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
                >
                  <option value="planned">Direncanakan</option>
                  <option value="active">Aktif</option>
                  <option value="review">Evaluasi</option>
                  <option value="completed">Selesai</option>
                </select>
              </div>
            </div>
          </DialogContent>
          <DialogFooter className="pt-4 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="w-full sm:w-auto mb-2 sm:mb-0">
              Batal
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={!title.trim()}>
              Buat Proyek
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
