import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, Save, Trash2, Plus, LayoutList, CheckCircle2, Circle, Edit2, Calendar, Target, Clock, Inbox, PlayCircle, Network, Brain, Book, FileText, ArrowUpRight } from "lucide-react";
import { useProjectsStore } from "../../store/projectsStore";
import { useKnowledgeStore } from "../../store/knowledgeStore";
import { useNotesStore } from "../../store/notesStore";
import { useLibraryStore } from "../../store/libraryStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog";
import { ProjectStatus, TaskStatus } from "../../types";
import { cn } from "../../utils/cn";
import { scanTextForEntities, autoLinkSingleEntity } from "../../utils/autoLinker";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const projects = useProjectsStore(state => state.projects);
  const tasks = useProjectsStore(state => state.tasks);
  const relations = useKnowledgeStore(state => state.relations);
  const concepts = useKnowledgeStore(state => state.concepts);
  const notes = useNotesStore(state => state.notes);
  const books = useLibraryStore(state => state.books);
  
  const updateProject = useProjectsStore(state => state.updateProject);
  const deleteProject = useProjectsStore(state => state.deleteProject);
  
  const addTask = useProjectsStore(state => state.addTask);
  const updateTaskStatus = useProjectsStore(state => state.updateTaskStatus);
  const updateTaskTitle = useProjectsStore(state => state.updateTaskTitle);
  const deleteTask = useProjectsStore(state => state.deleteTask);
  
  const project = projects.find(p => p.id === id);
  const projectTasks = tasks.filter(t => t.projectId === id).sort((a, b) => a.order - b.order);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState<ProjectStatus>('planned');
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");

  // Connected relations for this project
  const projectRelations = useMemo(() => {
    if (!project) return [];
    return relations.filter(r => r.sourceNodeId === project.id || r.targetNodeId === project.id);
  }, [relations, project?.id]);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 py-24">
        <Target className="w-12 h-12 text-gray-300" />
        <h2 className="text-xl font-medium text-gray-900">Proyek tidak ditemukan</h2>
        <Button variant="outline" onClick={() => navigate("/projects")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Proyek
        </Button>
      </div>
    );
  }

  const doneTasks = projectTasks.filter(t => t.status === 'done').length;
  const inProgressTasks = projectTasks.filter(t => t.status === 'in-progress').length;
  const todoTasks = projectTasks.filter(t => t.status === 'todo').length;
  
  const totalTasks = projectTasks.length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const isOverdue = project.dueDate && project.dueDate < Date.now() && project.status !== 'completed';

  const handleSaveProject = () => {
    if (editTitle.trim()) {
      updateProject(project.id, { 
        title: editTitle, 
        description: editDescription,
        status: editStatus,
        dueDate: editDueDate ? new Date(editDueDate).getTime() : undefined
      });

      // Auto-link entities mentioned in project details
      try {
        autoLinkSingleEntity(project.id, `${editTitle}\n${editDescription}`, 'project', editTitle);
      } catch (err) {
        console.warn('Auto-link error:', err);
      }

      setIsEditing(false);
    }
  };

  const startEditing = () => {
    setEditTitle(project.title);
    setEditDescription(project.description);
    setEditStatus(project.status);
    
    if (project.dueDate) {
      const date = new Date(project.dueDate);
      const tzOffset = date.getTimezoneOffset() * 60000;
      setEditDueDate(new Date(date.getTime() - tzOffset).toISOString().split('T')[0]);
    } else {
      setEditDueDate("");
    }
    
    setIsEditing(true);
  };

  const handleDelete = () => {
    deleteProject(project.id);
    navigate("/projects");
  };

  const handleAddTask = (e: any) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    addTask({
      projectId: project.id,
      title: newTaskTitle,
      status: 'todo',
      order: projectTasks.length
    });
    
    setNewTaskTitle("");
    setIsAddTaskOpen(false);
  };

  const startEditingTask = (task: any) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
  };

  const saveEditedTask = () => {
    if (editingTaskId && editTaskTitle.trim()) {
      updateTaskTitle(editingTaskId, editTaskTitle);
    }
    setEditingTaskId(null);
  };

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
  
  const getTaskStatusLabel = (status: TaskStatus) => {
    switch (status) {
      case 'todo': return 'To Do';
      case 'in-progress': return 'In Progress';
      case 'done': return 'Done';
    }
  }

  const getTaskStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'todo': return 'text-gray-600 bg-gray-100 border-gray-200';
      case 'in-progress': return 'text-gray-800 bg-gray-100 border-gray-200';
      case 'done': return 'text-gray-800 bg-gray-100 border-gray-200 line-through opacity-70';
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col gap-6 pb-2">
        <Button variant="ghost" className="gap-2 -ml-3 text-gray-500 hover:text-gray-900 self-start" onClick={() => navigate("/projects")}>
           <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Kembali ke Proyek</span>
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1 space-y-4">
             <div className="flex flex-wrap items-center gap-3">
               <span className={cn("inline-flex items-center text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md border", getStatusColor(project.status))}>
                 {getStatusLabel(project.status)}
               </span>
               {project.dueDate && (
                 <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-md border", isOverdue ? 'text-gray-800 bg-gray-50 border-gray-200' : 'text-gray-600 bg-gray-50 border-gray-200')}>
                   <Calendar className="w-3.5 h-3.5" /> 
                   {isOverdue ? 'Tenggat Terlewat: ' : 'Tenggat: '}
                   {new Date(project.dueDate).toLocaleDateString()}
                 </span>
               )}
             </div>
             <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight">{project.title}</h1>
             <p className="text-lg text-gray-600 leading-relaxed max-w-3xl whitespace-pre-wrap">{project.description || "Tidak ada deskripsi rinci untuk proyek ini."}</p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
             <Button variant="outline" size="sm" className="gap-2" onClick={startEditing}>
               <Edit2 className="w-4 h-4" /> Edit Proyek
             </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Progress & Stats */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 border border-gray-200 rounded-2xl bg-white space-y-5 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 bg-gray-500 h-full"></div>
             
             <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <Target className="w-4 h-4 text-gray-400" />
                  Progres Proyek
                </span>
                <span className="font-bold text-xl text-gray-900">{progressPct}%</span>
             </div>
             
             <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-900 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
             </div>
             
             <div className="grid grid-cols-3 gap-2 text-center pt-2">
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="block text-xl font-bold text-gray-900">{doneTasks}</span>
                  <span className="text-[10px] text-gray-500 uppercase font-medium tracking-wider">Selesai</span>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="block text-xl font-bold text-gray-800">{inProgressTasks}</span>
                  <span className="text-[10px] text-gray-500 uppercase font-medium tracking-wider">Proses</span>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="block text-xl font-bold text-gray-900">{todoTasks}</span>
                  <span className="text-[10px] text-gray-500 uppercase font-medium tracking-wider">To Do</span>
                </div>
             </div>
          </div>
          
          <div className="p-6 border border-gray-200 rounded-2xl bg-white space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Network className="w-4 h-4 text-gray-700"/> Relasi Pengetahuan ({projectRelations.length})
              </h3>
              <button 
                onClick={() => navigate('/knowledge')}
                className="text-xs text-gray-500 hover:text-gray-900 font-medium flex items-center gap-0.5"
              >
                Graf <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            
            {projectRelations.length > 0 ? (
              <div className="space-y-2.5">
                {projectRelations.map(rel => {
                  const targetId = rel.sourceNodeId === project.id ? rel.targetNodeId : rel.sourceNodeId;
                  const concept = concepts.find(c => c.id === targetId);
                  const note = notes.find(n => n.id === targetId);
                  const book = books.find(b => b.id === targetId);
                  
                  const label = concept?.name || note?.title || book?.title || 'Entitas Terhubung';
                  const type = concept ? 'concept' : note ? 'note' : book ? 'book' : 'other';

                  return (
                    <div 
                      key={rel.id}
                      onClick={() => {
                        if (note) navigate(`/notes/${note.id}`);
                        else if (book) navigate(`/library/${book.id}`);
                        else navigate('/knowledge');
                      }}
                      className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-300 transition-all cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        {type === 'concept' ? <Brain className="w-3.5 h-3.5 text-gray-600 shrink-0" /> :
                         type === 'book' ? <Book className="w-3.5 h-3.5 text-gray-600 shrink-0" /> :
                         <FileText className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
                        <span className="font-medium text-gray-900 truncate">{label}</span>
                      </div>
                      <span className="text-[10px] font-mono uppercase text-gray-400 shrink-0 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                        {rel.relationType}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Belum ada relasi terhubung. Disebutkan di catatan atau gunakan nama konsep pada deskripsi proyek.</p>
            )}
          </div>

          <div className="p-6 border border-gray-200 rounded-2xl bg-white space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400"/> Riwayat & Waktu
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                <span className="text-gray-500">Dibuat pada</span>
                <span className="font-medium text-gray-900">{new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                <span className="text-gray-500">Terakhir Diperbarui</span>
                <span className="font-medium text-gray-900">{new Date(project.updatedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Total Tugas</span>
                <span className="font-medium text-gray-900">{totalTasks}</span>
              </div>
            </div>
            
            <div className="pt-4 mt-4 border-t border-gray-100">
               <Button variant="ghost" className="w-full text-gray-900 hover:text-gray-800 hover:bg-gray-50 gap-2" onClick={() => setIsDeleteDialogOpen(true)}>
                 <Trash2 className="w-4 h-4" /> Hapus Proyek
               </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Tasks List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 border border-gray-200 rounded-2xl bg-white shadow-sm space-y-6">
             <div className="flex items-center justify-between pb-4 border-b border-gray-100">
               <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                 Daftar Tugas
               </h3>
               <Button size="sm" onClick={() => setIsAddTaskOpen(true)} className="text-xs h-8 gap-2">
                 <Plus className="w-3.5 h-3.5" /> Tambah Tugas
               </Button>
             </div>
             
             {projectTasks.length > 0 ? (
               <div className="space-y-3">
                 {projectTasks.map(task => (
                   <div key={task.id} className={cn("p-4 border rounded-xl flex items-start gap-4 transition-all group", task.status === 'done' ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm')}>
                     
                     <button 
                       onClick={() => updateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
                       className={cn("mt-0.5 shrink-0 transition-colors", task.status === 'done' ? 'text-gray-500' : 'text-gray-300 hover:text-gray-500')}
                     >
                       {task.status === 'done' ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                     </button>
                     
                     <div className="flex-1 min-w-0">
                       {editingTaskId === task.id ? (
                         <div className="flex items-center gap-2">
                           <input
                             autoFocus
                             type="text"
                             value={editTaskTitle}
                             onChange={(e) => setEditTaskTitle(e.target.value)}
                             onBlur={saveEditedTask}
                             onKeyDown={(e) => e.key === 'Enter' && saveEditedTask()}
                             className="flex-1 px-2 py-1 text-sm border-b-2 border-gray-500 outline-none bg-gray-50/50"
                           />
                         </div>
                       ) : (
                         <div className="flex items-center justify-between gap-4">
                           <h4 className={cn("font-medium text-sm transition-colors", task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900')}>
                             {task.title}
                           </h4>
                           
                           <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <select
                               value={task.status}
                               onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                               className={cn("text-xs font-semibold px-2 py-1 rounded border outline-none cursor-pointer", getTaskStatusColor(task.status))}
                             >
                               <option value="todo">To Do</option>
                               <option value="in-progress">In Progress</option>
                               <option value="done">Done</option>
                             </select>
                             
                             <button onClick={() => startEditingTask(task)} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors">
                               <Edit2 className="w-4 h-4" />
                             </button>
                             <button onClick={() => {
                               if(window.confirm('Hapus tugas ini?')) deleteTask(task.id);
                             }} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors">
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </div>
                         </div>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="p-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 flex flex-col items-center text-center">
                 <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center mb-4">
                   <LayoutList className="w-6 h-6 text-gray-400" />
                 </div>
                 <h4 className="text-sm font-semibold text-gray-900 mb-1">Belum ada tugas</h4>
                 <p className="text-sm text-gray-500 max-w-sm mb-6">Pecah proyek ini menjadi tugas-tugas kecil yang dapat ditindaklanjuti untuk mulai melacak progres Anda.</p>
                 <Button size="sm" onClick={() => setIsAddTaskOpen(true)} className="gap-2 bg-white text-gray-900 border border-gray-200 hover:bg-gray-50">
                   <Plus className="w-3.5 h-3.5" /> Tambah Tugas Pertama
                 </Button>
               </div>
             )}
          </div>
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogHeader>
          <DialogTitle>Edit Detail Proyek</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Judul Proyek <span className="text-gray-500">*</span></label>
            <input 
              type="text" 
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent" 
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Deskripsi / Tujuan</label>
            <textarea 
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="flex min-h-[100px] w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent resize-none" 
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Tenggat Waktu (Opsional)</label>
              <input 
                type="date" 
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <select 
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as ProjectStatus)}
                className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent"
              >
                <option value="planned">Direncanakan</option>
                <option value="active">Aktif</option>
                <option value="review">Evaluasi</option>
                <option value="completed">Selesai</option>
                <option value="archived">Diarsipkan</option>
              </select>
            </div>
          </div>
        </DialogContent>
        <DialogFooter className="pt-4 border-t border-gray-100">
          <Button variant="ghost" onClick={() => setIsEditing(false)}>Batal</Button>
          <Button onClick={handleSaveProject} disabled={!editTitle.trim()}>Simpan Perubahan</Button>
        </DialogFooter>
      </Dialog>
      
      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogHeader>
          <DialogTitle>Tambah Tugas Baru</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleAddTask}>
          <DialogContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Nama Tugas <span className="text-gray-500">*</span></label>
              <input 
                autoFocus
                type="text" 
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-transparent" 
                placeholder="Contoh: Riset arsitektur backend..."
                required
              />
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsAddTaskOpen(false)}>Batal</Button>
            <Button type="submit" disabled={!newTaskTitle.trim()}>Tambah Tugas</Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogHeader>
          <DialogTitle>Hapus Proyek</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-gray-600">Apakah Anda yakin ingin menghapus proyek "{project.title}"? Semua tugas di dalamnya juga akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.</p>
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>Batal</Button>
          <Button variant="destructive" onClick={handleDelete} className="bg-gray-900 hover:bg-gray-800 text-white">Hapus Proyek</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
