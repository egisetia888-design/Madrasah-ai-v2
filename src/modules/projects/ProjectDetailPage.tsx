import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, Trash2, Plus, LayoutList, CheckCircle2, Circle, Edit2, Target, Clock, Network, Brain, Book, FileText, ArrowUpRight } from "lucide-react";
import { useProjectsStore } from "../../store/projectsStore";
import { useKnowledgeStore } from "../../store/knowledgeStore";
import { useNotesStore } from "../../store/notesStore";
import { useLibraryStore } from "../../store/libraryStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { MetadataRow } from "../../components/ui/MetadataRow";
import { EmptyState } from "../../components/ui/EmptyState";
import { ProjectStatus, TaskStatus } from "../../types";
import { cn } from "../../utils/cn";
import { autoLinkSingleEntity } from "../../utils/autoLinker";

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
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; title: string } | null>(null);
  
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
      <div className="flex flex-col items-center justify-center h-full space-y-4 py-24 text-center">
        <Target className="w-12 h-12 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 font-display">Proyek tidak ditemukan</h2>
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
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col gap-5 pb-2">
        <Button variant="ghost" className="gap-2 -ml-3 text-gray-500 hover:text-gray-900 self-start" onClick={() => navigate("/projects")}>
           <ArrowLeft className="w-4 h-4" /> <span>Kembali ke Proyek</span>
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1 space-y-3 min-w-0">
             <MetadataRow
               items={[
                 <span className="font-semibold text-gray-900">{getStatusLabel(project.status)}</span>,
                 project.dueDate
                   ? `${isOverdue ? 'Tenggat Terlewat' : 'Tenggat'}: ${new Date(project.dueDate).toLocaleDateString('id-ID')}`
                   : false,
                 `${totalTasks} tugas`,
               ]}
             />
             <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-gray-900 font-display leading-tight">{project.title}</h1>
             <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-3xl whitespace-pre-wrap">{project.description || "Tidak ada deskripsi rinci untuk proyek ini."}</p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
             <Button variant="outline" size="sm" className="gap-2" onClick={startEditing}>
               <Edit2 className="w-4 h-4" /> Edit Proyek
             </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Left Column: Progress & Stats */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 border border-gray-200 rounded-2xl bg-white space-y-5 shadow-sm relative overflow-hidden">
             <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 font-mono uppercase tracking-wider flex items-center gap-2">
                  <Target className="w-4 h-4 text-gray-400" />
                  Progres Proyek
                </span>
                <span className="font-bold text-xl text-gray-900 font-mono tabular-nums">{progressPct}%</span>
             </div>
             
             <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-900 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
             </div>
             
             <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="block text-xl font-bold text-gray-900 font-display tabular-nums">{doneTasks}</span>
                  <span className="text-[11px] text-gray-500 font-mono">Selesai</span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="block text-xl font-bold text-gray-800 font-display tabular-nums">{inProgressTasks}</span>
                  <span className="text-[11px] text-gray-500 font-mono">Proses</span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="block text-xl font-bold text-gray-900 font-display tabular-nums">{todoTasks}</span>
                  <span className="text-[11px] text-gray-500 font-mono">Rencana</span>
                </div>
             </div>
          </div>
          
          <div className="p-6 border border-gray-200 rounded-2xl bg-white space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-700 font-mono uppercase tracking-wider flex items-center gap-2">
                <Network className="w-4 h-4 text-gray-500"/> Relasi Pengetahuan ({projectRelations.length})
              </h3>
              <button 
                onClick={() => navigate('/graph')}
                className="text-xs text-gray-500 hover:text-gray-900 font-medium flex items-center gap-0.5 py-1 px-2 -mr-2 rounded-lg"
              >
                Graf <ArrowUpRight className="w-3.5 h-3.5" />
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
                        else navigate('/graph');
                      }}
                      className="p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-300 transition-all cursor-pointer flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {type === 'concept' ? <Brain className="w-3.5 h-3.5 text-gray-600 shrink-0" /> :
                         type === 'book' ? <Book className="w-3.5 h-3.5 text-gray-600 shrink-0" /> :
                         <FileText className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
                        <span className="font-medium text-gray-900 truncate">{label}</span>
                      </div>
                      <span className="text-[11px] font-mono text-gray-500 shrink-0">
                        · {rel.relationType}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Belum ada relasi terhubung. Sebutkan nama catatan atau konsep pada deskripsi proyek.</p>
            )}
          </div>

          <div className="p-6 border border-gray-200 rounded-2xl bg-white space-y-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-700 font-mono uppercase tracking-wider mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400"/> Riwayat &amp; Waktu
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                <span className="text-gray-500">Dibuat pada</span>
                <span className="font-medium text-gray-900 font-mono tabular-nums">{new Date(project.createdAt).toLocaleDateString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                <span className="text-gray-500">Terakhir Diperbarui</span>
                <span className="font-medium text-gray-900 font-mono tabular-nums">{new Date(project.updatedAt).toLocaleDateString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Total Tugas</span>
                <span className="font-medium text-gray-900 font-mono tabular-nums">{totalTasks}</span>
              </div>
            </div>
            
            <div className="pt-4 mt-4 border-t border-gray-100">
               <Button variant="ghost" className="w-full text-gray-700 hover:text-gray-900 hover:bg-gray-100 gap-2" onClick={() => setIsDeleteDialogOpen(true)}>
                 <Trash2 className="w-4 h-4" /> Hapus Proyek
               </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Tasks List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-5 sm:p-6 border border-gray-200 rounded-2xl bg-white shadow-sm space-y-6">
             <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
               <h3 className="text-lg font-bold text-gray-900 font-display">
                 Daftar Tugas
               </h3>
               <Button size="sm" onClick={() => setIsAddTaskOpen(true)} className="gap-1.5">
                 <Plus className="w-3.5 h-3.5" /> Tambah Tugas
               </Button>
             </div>
             
             {projectTasks.length > 0 ? (
               <div className="space-y-3">
                 {projectTasks.map(task => (
                   <div key={task.id} className={cn("p-3.5 sm:p-4 border rounded-2xl flex items-start gap-3 transition-all group", task.status === 'done' ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm')}>
                     
                     <button 
                       type="button"
                       onClick={() => updateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
                       aria-label={task.status === 'done' ? 'Tandai belum selesai' : 'Tandai selesai'}
                       className={cn("min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center sm:mt-0.5 shrink-0 transition-colors -ml-1.5 sm:ml-0", task.status === 'done' ? 'text-gray-600' : 'text-gray-300 hover:text-gray-600')}
                     >
                       {task.status === 'done' ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                     </button>
                     
                     <div className="flex-1 min-w-0">
                       {editingTaskId === task.id ? (
                         <div className="flex items-center gap-2 py-1">
                           <input
                             autoFocus
                             type="text"
                             value={editTaskTitle}
                             onChange={(e) => setEditTaskTitle(e.target.value)}
                             onBlur={saveEditedTask}
                             onKeyDown={(e) => e.key === 'Enter' && saveEditedTask()}
                             className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
                           />
                         </div>
                       ) : (
                         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                           <h4 className={cn("font-medium text-sm pt-2.5 sm:pt-0 transition-colors", task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900')}>
                             {task.title}
                           </h4>
                           
                           <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                             <select
                               value={task.status}
                               onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                               className={cn("text-xs font-medium px-2.5 h-10 sm:h-8 rounded-xl border border-gray-200 bg-white outline-none cursor-pointer", task.status === 'done' ? 'text-gray-500' : 'text-gray-800')}
                             >
                               <option value="todo">Akan Dikerjakan</option>
                               <option value="in-progress">Dikerjakan</option>
                               <option value="done">Selesai</option>
                             </select>
                             
                             <button
                               type="button"
                               onClick={() => startEditingTask(task)}
                               aria-label="Edit nama tugas"
                               className="min-h-[40px] min-w-[40px] sm:min-h-[32px] sm:min-w-[32px] flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                             >
                               <Edit2 className="w-4 h-4" />
                             </button>
                             <button
                               type="button"
                               onClick={() => setTaskToDelete({ id: task.id, title: task.title })}
                               aria-label="Hapus tugas"
                               className="min-h-[40px] min-w-[40px] sm:min-h-[32px] sm:min-w-[32px] flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                             >
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
               <EmptyState
                 compact
                 icon={LayoutList}
                 title="Belum ada tugas"
                 description="Pecah proyek ini menjadi tugas-tugas kecil yang dapat ditindaklanjuti untuk mulai melacak progres Anda."
                 action={
                   <Button size="sm" onClick={() => setIsAddTaskOpen(true)} className="gap-2">
                     <Plus className="w-3.5 h-3.5" /> Tambah Tugas Pertama
                   </Button>
                 }
               />
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
              className="flex h-11 md:h-9 w-full rounded-xl border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 focus-visible:border-gray-900" 
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Deskripsi / Tujuan</label>
            <textarea 
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="flex min-h-[100px] w-full rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 focus-visible:border-gray-900 resize-none" 
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Tenggat Waktu (Opsional)</label>
              <input 
                type="date" 
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="flex h-11 md:h-9 w-full rounded-xl border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 focus-visible:border-gray-900" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <select 
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as ProjectStatus)}
                className="flex h-11 md:h-9 w-full rounded-xl border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 focus-visible:border-gray-900"
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
        <DialogFooter>
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
                className="flex h-11 md:h-9 w-full rounded-xl border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 focus-visible:border-gray-900" 
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

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Hapus Proyek"
        description={`Apakah Anda yakin ingin menghapus proyek "${project.title}"? Semua tugas di dalamnya juga akan ikut terhapus.`}
        confirmLabel="Hapus Proyek"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={Boolean(taskToDelete)}
        onOpenChange={(open) => {
          if (!open) setTaskToDelete(null);
        }}
        title="Hapus Tugas"
        description={`Apakah Anda yakin ingin menghapus tugas "${taskToDelete?.title || ''}"?`}
        confirmLabel="Hapus Tugas"
        onConfirm={() => {
          if (taskToDelete) {
            deleteTask(taskToDelete.id);
            setTaskToDelete(null);
          }
        }}
      />
    </div>
  );
}
