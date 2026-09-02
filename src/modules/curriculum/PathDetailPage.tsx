import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, Plus, MoreVertical, BookOpen, PenTool, Brain, Target, CheckCircle2, ChevronRight, Circle, Trash2, Edit2, Save, Network, ArrowUpRight } from "lucide-react";
import { useCurriculumStore } from "../../store/curriculumStore";
import { useLibraryStore } from "../../store/libraryStore";
import { useWritingStore } from "../../store/writingStore";
import { useKnowledgeStore } from "../../store/knowledgeStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog";
import { scanTextForEntities, autoLinkSingleEntity } from "../../utils/autoLinker";

export function PathDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const paths = useCurriculumStore(state => state.paths);
  const path = paths.find(p => p.id === id);
  
  // Example state for UI visualization, this would eventually connect to the store deeper
  const phases = useCurriculumStore(state => state.phases).filter(p => p.pathId === id).sort((a,b) => a.order - b.order);
  const competencies = useCurriculumStore(state => state.competencies);
  
  const addPhase = useCurriculumStore(state => state.addPhase);
  const addCompetency = useCurriculumStore(state => state.addCompetency);
  const updateCompetency = useCurriculumStore(state => state.updateCompetency);
  const deletePath = useCurriculumStore(state => state.deletePath);
  const updatePath = useCurriculumStore(state => state.updatePath);
  const deletePhase = useCurriculumStore(state => state.deletePhase);
  const deleteCompetency = useCurriculumStore(state => state.deleteCompetency);

  const books = useLibraryStore(state => state.books);
  const drafts = useWritingStore(state => state.drafts);

  const [isAddPhaseOpen, setIsAddPhaseOpen] = useState(false);
  const [newPhaseTitle, setNewPhaseTitle] = useState("");
  
  const [isAddCompOpen, setIsAddCompOpen] = useState(false);
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);
  const [newCompTitle, setNewCompTitle] = useState("");

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [isManageCompOpen, setIsManageCompOpen] = useState(false);
  const [activeCompForManage, setActiveCompForManage] = useState<string | null>(null);
  const [manageSelectedBook, setManageSelectedBook] = useState("");
  const [manageSelectedOutput, setManageSelectedOutput] = useState("");

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  if (!path) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <h2 className="text-xl font-medium text-gray-900">Kurikulum tidak ditemukan</h2>
        <Button variant="outline" onClick={() => navigate("/curriculum")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Kurikulum
        </Button>
      </div>
    );
  }

  const handleAddPhase = (e: any) => {
    e.preventDefault();
    if (!newPhaseTitle.trim()) return;
    if (addPhase) {
      addPhase({ pathId: path.id, title: newPhaseTitle, order: phases.length });
    }
    setNewPhaseTitle("");
    setIsAddPhaseOpen(false);
  };

  const handleAddCompetency = (e: any) => {
    e.preventDefault();
    if (!newCompTitle.trim() || !activePhaseId) return;
    if (addCompetency) {
      const phaseComps = competencies.filter(c => c.phaseId === activePhaseId);
      const newCompId = crypto.randomUUID();
      addCompetency({ 
        id: newCompId,
        phaseId: activePhaseId, 
        title: newCompTitle, 
        order: phaseComps.length,
        status: 'not-started',
        bookIds: [],
        outputIds: []
      } as any);

      // Auto-link entities mentioned in competency title
      try {
        autoLinkSingleEntity(
          newCompId,
          newCompTitle,
          'concept',
          newCompTitle
        );
      } catch (err) {
        console.warn('Competency auto-link error:', err);
      }
    }
    setNewCompTitle("");
    setIsAddCompOpen(false);
  };

  const openAddCompetency = (phaseId: string) => {
    setActivePhaseId(phaseId);
    setIsAddCompOpen(true);
  };

  // Calculate global progress
  const pathComps = competencies.filter(c => phases.some(p => p.id === c.phaseId));
  const completedComps = pathComps.filter(c => c.status === 'done').length;
  const progressPercent = pathComps.length > 0 ? Math.round((completedComps / pathComps.length) * 100) : 0;

  const handleDeletePath = () => {
    if (path) {
      deletePath(path.id);
      navigate("/curriculum");
    }
  }

  const handleSaveEdit = () => {
    if (path && editTitle.trim()) {
      updatePath(path.id, { title: editTitle, description: editDesc });
      setIsEditingTitle(false);
    }
  }

  const startEditing = () => {
    if (path) {
      setEditTitle(path.title);
      setEditDesc(path.description);
      setIsEditingTitle(true);
    }
  }

  const openManageCompetency = (compId: string) => {
    setActiveCompForManage(compId);
    setIsManageCompOpen(true);
    setManageSelectedBook("");
    setManageSelectedOutput("");
  }

  const handleAddBookToComp = (compId: string) => {
    if (!manageSelectedBook) return;
    const comp = competencies.find(c => c.id === compId);
    if (comp && !comp.bookIds.includes(manageSelectedBook)) {
      updateCompetency(compId, { bookIds: [...comp.bookIds, manageSelectedBook] });
    }
    setManageSelectedBook("");
  }

  const handleRemoveBookFromComp = (compId: string, bookId: string) => {
    const comp = competencies.find(c => c.id === compId);
    if (comp) {
      updateCompetency(compId, { bookIds: comp.bookIds.filter(id => id !== bookId) });
    }
  }

  const handleAddOutputToComp = (compId: string) => {
    if (!manageSelectedOutput) return;
    const comp = competencies.find(c => c.id === compId);
    if (comp && !comp.outputIds.includes(manageSelectedOutput)) {
      updateCompetency(compId, { outputIds: [...comp.outputIds, manageSelectedOutput] });
    }
    setManageSelectedOutput("");
  }

  const handleRemoveOutputFromComp = (compId: string, outputId: string) => {
    const comp = competencies.find(c => c.id === compId);
    if (comp) {
      updateCompetency(compId, { outputIds: comp.outputIds.filter(id => id !== outputId) });
    }
  }

  const getBookTitle = (id: string) => books.find(b => b.id === id)?.title || "Unknown Book";
  const getDraftTitle = (id: string) => drafts.find(d => d.id === id)?.title || "Unknown Output";

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div className="flex-1 w-full">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" className="gap-2 -ml-3 text-gray-500 hover:text-gray-900" onClick={() => navigate("/curriculum")}>
              <ArrowLeft className="w-4 h-4" /> Kembali
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="gap-2 text-gray-900 hover:text-gray-800 hover:bg-gray-50" onClick={() => setIsDeleteDialogOpen(true)}>
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Hapus</span>
              </Button>
            </div>
          </div>
          
          {isEditingTitle ? (
            <div className="space-y-4 max-w-2xl mt-4">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-3xl font-bold tracking-tight text-gray-900 bg-transparent border-b border-gray-300 outline-none w-full placeholder:text-gray-300 focus:ring-0 focus:border-gray-900 p-0"
                placeholder="Judul Kurikulum"
              />
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full min-h-[60px] text-base text-gray-600 bg-transparent border border-gray-300 rounded-md outline-none resize-none placeholder:text-gray-300 focus:ring-1 focus:ring-gray-900 p-2"
                placeholder="Deskripsi kurikulum..."
              />
              <div className="flex items-center gap-2">
                <Button onClick={handleSaveEdit} className="gap-2">
                  <Save className="w-4 h-4" /> Simpan
                </Button>
                <Button variant="ghost" onClick={() => setIsEditingTitle(false)}>Batal</Button>
              </div>
            </div>
          ) : (
            <div className="group relative pr-8 max-w-2xl mt-4">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">{path.title}</h1>
              <p className="text-gray-500 mt-1">{path.description}</p>
              <button onClick={startEditing} className="absolute right-0 top-0 p-2 text-gray-400 hover:text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-1 shrink-0 bg-gray-50 p-4 rounded-xl border border-gray-100">
           <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Progres Keseluruhan</span>
           <div className="flex items-center gap-3 w-full sm:w-48">
              <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gray-900 rounded-full" style={{ width: `${progressPercent}%` }}></div>
              </div>
              <span className="font-bold text-lg text-gray-900">{progressPercent}%</span>
           </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Peta Kurikulum</h2>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsAddPhaseOpen(true)}>
            <Plus className="w-4 h-4" /> Tambah Fase
          </Button>
        </div>

        {phases.length === 0 ? (
           <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl bg-gray-50 text-gray-500">
             <p>Belum ada fase yang ditentukan. Bagi kurikulum ini menjadi beberapa fase.</p>
           </div>
        ) : (
          <div className="space-y-12">
            {phases.map((phase, idx) => {
              const phaseCompetencies = competencies.filter(c => c.phaseId === phase.id).sort((a,b) => a.order - b.order);
              return (
                <div key={phase.id} className="relative">
                  {idx !== phases.length - 1 && (
                    <div className="absolute left-[1.1rem] top-10 bottom-[-3rem] w-px bg-gray-200 z-0 hidden md:block"></div>
                  )}
                  
                  <div className="flex items-start gap-4 relative z-10">
                    <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm shrink-0 border-4 border-white hidden md:flex">
                      {idx + 1}
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between bg-white px-4 py-3 border border-gray-200 rounded-xl shadow-sm">
                        <h3 className="font-semibold text-lg text-gray-900 flex items-center gap-2">
                          Fase {idx + 1}: {phase.title}
                          <button onClick={() => {
                            if (window.confirm("Yakin ingin menghapus fase ini beserta kompetensinya?")) {
                              deletePhase(phase.id);
                            }
                          }} className="text-gray-400 hover:text-gray-500 transition-colors p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => openAddCompetency(phase.id)} className="h-8">
                          <Plus className="w-4 h-4 mr-1" /> Kompetensi
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-0 md:pl-2">
                         {phaseCompetencies.length === 0 ? (
                           <div className="md:col-span-2 text-sm text-gray-400 py-4 px-4 italic border border-dashed border-gray-100 rounded-lg">
                             No competencies defined for this phase.
                           </div>
                         ) : (
                           phaseCompetencies.map(comp => (
                             <div key={comp.id} className="border border-gray-200 rounded-xl bg-white p-4 hover:border-gray-200 transition-colors flex flex-col h-full shadow-sm">
                               <div className="flex items-start gap-3 relative group/comp">
                                 <button onClick={() => {
                                   if (window.confirm("Yakin ingin menghapus kompetensi ini?")) {
                                     deleteCompetency(comp.id);
                                   }
                                 }} className="absolute -right-2 -top-2 opacity-0 group-hover/comp:opacity-100 p-1.5 text-gray-400 hover:text-gray-500 hover:bg-gray-50 rounded transition-all">
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                                 <div className="flex-1">
                                   <div className="flex items-start justify-between pr-6">
                                     <h4 className={`font-medium ${comp.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{comp.title}</h4>
                                     <select 
                                       value={comp.status}
                                       onChange={(e) => updateCompetency(comp.id, { status: e.target.value as any })}
                                       className={`text-xs font-medium rounded-md px-2 py-1 border outline-none ${
                                          comp.status === 'done' ? 'bg-gray-50 text-gray-800 border-gray-200' :
                                          comp.status === 'in-progress' ? 'bg-gray-50 text-gray-800 border-gray-200' :
                                          'bg-gray-50 text-gray-700 border-gray-200'
                                       }`}
                                     >
                                       <option value="not-started">Belum Mulai</option>
                                       <option value="in-progress">Proses</option>
                                       <option value="done">Selesai</option>
                                     </select>
                                   </div>
                                   
                                   {/* Entity Linkages */}
                                   <div className="mt-4 pt-4 border-t border-gray-100">
                                     <div className="flex flex-wrap items-center gap-2 mb-3">
                                       <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                         <BookOpen className="w-3 h-3" /> {comp.bookIds.length} Buku
                                       </span>
                                       <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                         <PenTool className="w-3 h-3" /> {comp.outputIds.length} Hasil
                                       </span>
                                       <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                         <Target className="w-3 h-3" /> Asesmen: {comp.assessmentStatus || 'Tidak ada'}
                                       </span>
                                       <Button variant="ghost" size="sm" onClick={() => openManageCompetency(comp.id)} className="h-6 text-[10px] px-2 ml-auto">
                                          Kelola
                                       </Button>
                                     </div>
                                     {comp.bookIds.length > 0 && (
                                       <div className="flex flex-wrap gap-1 mb-2">
                                         {comp.bookIds.map(bid => (
                                            <span key={bid} className="inline-flex items-center text-[10px] text-gray-800 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded truncate max-w-[150px]">
                                              <BookOpen className="w-3 h-3 mr-1 shrink-0" /> {getBookTitle(bid)}
                                            </span>
                                         ))}
                                       </div>
                                     )}
                                     {comp.outputIds.length > 0 && (
                                       <div className="flex flex-wrap gap-1">
                                         {comp.outputIds.map(oid => (
                                            <span key={oid} className="inline-flex items-center text-[10px] text-gray-800 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded truncate max-w-[150px]">
                                              <PenTool className="w-3 h-3 mr-1 shrink-0" /> {getDraftTitle(oid)}
                                            </span>
                                         ))}
                                       </div>
                                     )}
                                   </div>
                                 </div>
                               </div>
                             </div>
                           ))
                         )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Phase Dialog */}
      <Dialog open={isAddPhaseOpen} onOpenChange={setIsAddPhaseOpen}>
        <DialogHeader>
          <DialogTitle>Tambah Fase Baru</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleAddPhase}>
          <DialogContent>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Judul Fase</label>
              <input 
                value={newPhaseTitle}
                onChange={(e) => setNewPhaseTitle(e.target.value)}
                type="text" 
                className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950" 
                placeholder="Contoh: Dasar Inti"
                required
              />
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsAddPhaseOpen(false)}>Batal</Button>
            <Button type="submit" disabled={!newPhaseTitle.trim()}>Tambah Fase</Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Add Competency Dialog */}
      <Dialog open={isAddCompOpen} onOpenChange={setIsAddCompOpen}>
        <DialogHeader>
          <DialogTitle>Tambah Kompetensi</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleAddCompetency}>
          <DialogContent>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Pernyataan Kompetensi</label>
              <textarea 
                value={newCompTitle}
                onChange={(e) => setNewCompTitle(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 resize-none" 
                placeholder="Contoh: Mampu membuat desain figma"
                required
              />
              <p className="text-xs text-gray-500">Progres diukur dengan menguasai kompetensi ini, bukan hanya membaca buku.</p>
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsAddCompOpen(false)}>Batal</Button>
            <Button type="submit" disabled={!newCompTitle.trim()}>Tambah Kompetensi</Button>
          </DialogFooter>
        </form>
      </Dialog>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogHeader>
          <DialogTitle>Hapus Kurikulum</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-gray-600">Apakah Anda yakin ingin menghapus kurikulum "{path.title}"? Semua fase dan kompetensi di dalamnya akan terhapus. Tindakan ini tidak dapat dibatalkan.</p>
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>Batal</Button>
          <Button variant="destructive" onClick={handleDeletePath} className="bg-gray-900 hover:bg-gray-800 text-white">Hapus Kurikulum</Button>
        </DialogFooter>
      </Dialog>

      {/* Manage Competency Dialog */}
      <Dialog open={isManageCompOpen} onOpenChange={setIsManageCompOpen}>
        <DialogHeader>
          <DialogTitle>Kelola Kompetensi</DialogTitle>
        </DialogHeader>
        <DialogContent className="">
          {activeCompForManage && competencies.find(c => c.id === activeCompForManage) && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">{competencies.find(c => c.id === activeCompForManage)?.title}</h4>
                <p className="text-xs text-gray-500">Tautkan buku dan hasil tulisan untuk membuktikan bahwa Anda telah menguasai kompetensi ini.</p>
              </div>

              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
                  <BookOpen className="w-4 h-4 text-gray-400" /> Buku Terkait
                </h5>
                <div className="flex flex-col gap-2">
                  {competencies.find(c => c.id === activeCompForManage)?.bookIds.map(bid => (
                    <div key={bid} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded border border-gray-200">
                      <span className="text-sm text-gray-700 truncate">{getBookTitle(bid)}</span>
                      <button onClick={() => handleRemoveBookFromComp(activeCompForManage, bid)} className="text-gray-500 hover:bg-gray-50 p-1 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {competencies.find(c => c.id === activeCompForManage)?.bookIds.length === 0 && (
                    <p className="text-xs text-gray-400 italic">Belum ada buku tertaut.</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <select 
                      value={manageSelectedBook}
                      onChange={(e) => setManageSelectedBook(e.target.value)}
                      className="flex-1 rounded-md border border-gray-200 text-sm px-2 py-1 outline-none focus:ring-1 focus:ring-gray-900"
                    >
                      <option value="">-- Pilih Buku --</option>
                      {books.map(b => (
                        <option key={b.id} value={b.id}>{b.title}</option>
                      ))}
                    </select>
                    <Button type="button" size="sm" onClick={() => handleAddBookToComp(activeCompForManage)} disabled={!manageSelectedBook}>
                      Tambah
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
                  <PenTool className="w-4 h-4 text-gray-400" /> Hasil Tulisan (Output)
                </h5>
                <div className="flex flex-col gap-2">
                  {competencies.find(c => c.id === activeCompForManage)?.outputIds.map(oid => (
                    <div key={oid} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded border border-gray-200">
                      <span className="text-sm text-gray-700 truncate">{getDraftTitle(oid)}</span>
                      <button onClick={() => handleRemoveOutputFromComp(activeCompForManage, oid)} className="text-gray-500 hover:bg-gray-50 p-1 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {competencies.find(c => c.id === activeCompForManage)?.outputIds.length === 0 && (
                    <p className="text-xs text-gray-400 italic">Belum ada hasil tulisan tertaut.</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <select 
                      value={manageSelectedOutput}
                      onChange={(e) => setManageSelectedOutput(e.target.value)}
                      className="flex-1 rounded-md border border-gray-200 text-sm px-2 py-1 outline-none focus:ring-1 focus:ring-gray-900"
                    >
                      <option value="">-- Pilih Hasil Tulisan --</option>
                      {drafts.map(d => (
                        <option key={d.id} value={d.id}>{d.title}</option>
                      ))}
                    </select>
                    <Button type="button" size="sm" onClick={() => handleAddOutputToComp(activeCompForManage)} disabled={!manageSelectedOutput}>
                      Tambah
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsManageCompOpen(false)}>Selesai</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
