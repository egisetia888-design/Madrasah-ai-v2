import { SyncStatusIndicator } from '../../components/ui/SyncStatusIndicator';
import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../../components/ui/Button"
import { Plus, Search, Briefcase, MoreVertical, LayoutList, Calendar, CheckCircle2, Clock, Inbox, PlayCircle, Filter, Network } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog"
import { useProjectsStore } from "../../store/projectsStore"
import { useKnowledgeStore } from "../../store/knowledgeStore"
import { ProjectStatus } from "../../types"
import { cn } from "../../utils/cn"
import { scanTextForEntities, autoLinkSingleEntity } from "../../utils/autoLinker"

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

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case 'active': return 'text-gray-900 bg-gray-100 border-gray-300';
      case 'completed': return 'text-gray-900 bg-gray-100 border-gray-300';
      case 'planned': return 'text-gray-700 bg-gray-50 border-gray-200';
      case 'review': return 'text-gray-800 bg-gray-100 border-gray-200';
      case 'archived': return 'text-gray-500 bg-gray-50 border-gray-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  }

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-display">Proyek</h1>
          <p className="text-gray-500 mt-1 text-xs sm:text-sm max-w-xl leading-relaxed">
            Kelola inisiatif pembelajaran Anda, capai tujuan, dan atur tugas-tugas kompleks dalam satu tempat.
          </p>
        </div>
        <Button className="w-full sm:w-auto gap-2 shrink-0 h-11 sm:h-9" onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Proyek Baru</span>
        </Button>
      </div>

      <div className="space-y-3 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 h-11 w-full focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-transparent transition-all"> 
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
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer",
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
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
             <div className="w-16 h-16 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-6 text-gray-400 border border-gray-100">
               <Briefcase className="w-8 h-8" />
             </div>
             <h3 className="text-lg font-semibold text-gray-900">Belum ada proyek aktif</h3>
             <p className="text-sm text-gray-500 mt-2 mb-6 max-w-sm leading-relaxed">
               Mulai inisiatif baru untuk memecah tujuan besar Anda menjadi tugas yang dapat ditindaklanjuti.
             </p>
             <Button onClick={() => setIsAddOpen(true)} className="gap-2">
               <Plus className="w-4 h-4" />
               Buat Proyek Pertama
             </Button>
          </div>
        ) : filteredProjects.length === 0 ? (
           <div className="text-center py-16 text-gray-500">
             Tidak ada proyek yang sesuai dengan pencarian atau filter saat ini.
           </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProjects.map(project => {
              const projectTasks = tasks.filter(t => t.projectId === project.id);
              const doneTasks = projectTasks.filter(t => t.status === 'done').length;
              const totalTasks = projectTasks.length;
              const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
              
              const isOverdue = project.dueDate && project.dueDate < Date.now() && project.status !== 'completed';
              
              return (
                <div key={project.id} onClick={() => navigate(`/projects/${project.id}`)} className="group border border-gray-200 rounded-2xl bg-white p-6 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer flex flex-col relative overflow-hidden">
                  {(project.status === 'active' || progressPct > 0) && (
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-100 z-10">
                      <div className={cn("h-full transition-all duration-500", project.status === 'completed' ? 'bg-gray-500' : 'bg-gray-500')} style={{ width: `${progressPct}%` }} />
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between mb-4 mt-2">
                    <span className={cn("inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border", getStatusColor(project.status))}>
                      {getStatusLabel(project.status)}
                    </span>
                    <button className="text-gray-400 hover:text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2 group-hover:text-gray-900 transition-colors line-clamp-2">{project.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-3 flex-1 mb-6 leading-relaxed">{project.description || "Tidak ada deskripsi."}</p>
                  
                  <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                      <span className="flex items-center gap-1.5">
                        <LayoutList className="w-3.5 h-3.5 text-gray-400" /> {doneTasks}/{totalTasks} Tugas Selesai
                      </span>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const relCount = relations.filter(r => r.sourceNodeId === project.id || r.targetNodeId === project.id).length;
                          if (relCount === 0) return null;
                          return (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                              <Network className="w-2.5 h-2.5" /> {relCount}
                            </span>
                          );
                        })()}
                        <span>{progressPct}%</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-400 font-medium pt-1">
                      {project.dueDate ? (
                        <span className={cn("flex items-center gap-1.5", isOverdue ? 'text-gray-900' : 'text-gray-500')}>
                          <Calendar className="w-3.5 h-3.5" /> 
                          {isOverdue ? 'Terlewat: ' : 'Tenggat: '}
                          {new Date(project.dueDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-gray-400">
                          <Calendar className="w-3.5 h-3.5 opacity-50" /> Tanpa tenggat
                        </span>
                      )}
                      <span className="text-[10px] uppercase tracking-wider">Diperbarui {new Date(project.updatedAt).toLocaleDateString()}</span>
                    </div>
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
