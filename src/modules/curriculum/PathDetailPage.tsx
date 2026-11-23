import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, Plus, BookOpen, PenTool, Target, Trash2, Edit2, Save, FileText, Share2 } from "lucide-react";
import { useCurriculumStore } from "../../store/curriculumStore";
import { useLibraryStore } from "../../store/libraryStore";
import { useWritingStore } from "../../store/writingStore";
import { useNotesStore } from "../../store/notesStore";
import { useToastStore } from "../../store/toastStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { MetadataRow } from "../../components/ui/MetadataRow";
import { EmptyState } from "../../components/ui/EmptyState";
import { autoLinkSingleEntity, createExplicitRelation } from "../../utils/autoLinker";
import { ShareCurriculumModal } from "../../components/curriculum/ShareCurriculumModal";

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
  const addNote = useNotesStore(state => state.addNote);
  const addToast = useToastStore(state => state.addToast);

  const [isAddPhaseOpen, setIsAddPhaseOpen] = useState(false);
  const [newPhaseTitle, setNewPhaseTitle] = useState("");
  
  const [isAddCompOpen, setIsAddCompOpen] = useState(false);
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);
  const [newCompTitle, setNewCompTitle] = useState("");

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [phaseToDelete, setPhaseToDelete] = useState<{ id: string; title: string } | null>(null);
  const [compToDelete, setCompToDelete] = useState<{ id: string; title: string } | null>(null);
  
  const [isManageCompOpen, setIsManageCompOpen] = useState(false);
  const [activeCompForManage, setActiveCompForManage] = useState<string | null>(null);
  const [manageSelectedBook, setManageSelectedBook] = useState("");
  const [manageSelectedOutput, setManageSelectedOutput] = useState("");

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  if (!path) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 py-20 text-center">
        <h2 className="text-xl font-semibold text-gray-900 font-display">Kurikulum tidak ditemukan</h2>
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

  const handleAddStudyNote = (comp: any) => {
    const noteTitle = `Catatan: ${comp.title}`;
    const noteId = addNote({
      title: noteTitle,
      content: `Refleksi & pemahaman terkait kompetensi **${comp.title}** pada alur "${path?.title || 'Kurikulum'}":\n\n- `,
      type: 'permanent',
      status: 'unprocessed',
      folderId: null,
      tags: ['kurikulum', comp.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 25)]
    });

    try {
      createExplicitRelation(comp.id, noteId, 'applies', `Catatan belajar untuk kompetensi "${comp.title}"`);
      autoLinkSingleEntity(noteId, `${noteTitle}\n${comp.title}\n${path?.title || ''}`, 'note', noteTitle);
    } catch (err) {
      console.warn('Auto link note error:', err);
    }

    addToast({ type: 'success', message: 'Catatan belajar dibuat & ditautkan ke kompetensi!' });
    navigate(`/notes/${noteId}`);
  };

  const getBookTitle = (id: string) => books.find(b => b.id === id)?.title || "Buku Tidak Ditemukan";
  const getDraftTitle = (id: string) => drafts.find(d => d.id === id)?.title || "Tulisan Tidak Ditemukan";

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div className="flex-1 w-full min-w-0">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" className="gap-2 -ml-3 text-gray-500 hover:text-gray-900" onClick={() => navigate("/curriculum")}>
              <ArrowLeft className="w-4 h-4" /> Kembali
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="gap-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100" onClick={() => setIsDeleteDialogOpen(true)}>
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
                className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-display bg-transparent border-b border-gray-300 outline-none w-full placeholder:text-gray-300 focus:ring-0 focus:border-gray-900 pb-1"
                placeholder="Judul Kurikulum"
              />
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full min-h-[72px] text-sm sm:text-base text-gray-600 bg-white border border-gray-200 rounded-xl outline-none resize-none placeholder:text-gray-300 focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 p-3"
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
            <div className="group relative pr-12 max-w-2xl mt-4">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-display">{path.title}</h1>
              <p className="text-gray-500 mt-1.5 text-sm sm:text-base leading-relaxed">{path.description}</p>
              <button
                type="button"
                onClick={startEditing}
                aria-label="Edit judul dan deskripsi kurikulum"
                className="absolute right-0 top-0 min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        <div className="flex flex-col sm:items-end gap-2 shrink-0 bg-gray-50 p-4 rounded-2xl border border-gray-200">
           <span className="text-xs font-medium text-gray-500 font-mono uppercase tracking-wider">Progres Keseluruhan</span>
           <div className="flex items-center gap-3 w-full sm:w-48">
              <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gray-900 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
              </div>
              <span className="font-bold text-lg text-gray-900 font-mono tabular-nums">{progressPercent}%</span>
           </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-gray-900 font-display">Peta Kurikulum</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-gray-700 border-gray-200 hover:bg-gray-50"
              onClick={() => setIsShareModalOpen(true)}
            >
              <Share2 className="w-4 h-4 text-gray-500" />
              <span>Bagikan Silabus</span>
            </Button>
            <Button size="sm" className="gap-2 bg-gray-900 text-white hover:bg-gray-800" onClick={() => setIsAddPhaseOpen(true)}>
              <Plus className="w-4 h-4" /> Tambah Fase
            </Button>
          </div>
        </div>

        {phases.length === 0 ? (
           <EmptyState
             compact
             icon={Target}
             title="Belum ada fase kurikulum"
             description="Bagi kurikulum ini menjadi beberapa fase belajar agar kompetensi mudah dipantau."
             action={
               <Button size="sm" onClick={() => setIsAddPhaseOpen(true)} className="gap-2">
                 <Plus className="w-4 h-4" /> Tambah Fase Pertama
               </Button>
             }
           />
        ) : (
          <div className="space-y-10">
            {phases.map((phase, idx) => {
              const phaseCompetencies = competencies.filter(c => c.phaseId === phase.id).sort((a,b) => a.order - b.order);
              return (
                <div key={phase.id} className="relative">
                  {idx !== phases.length - 1 && (
                    <div className="absolute left-[1.1rem] top-10 bottom-[-2.5rem] w-px bg-gray-200 z-0 hidden md:block"></div>
                  )}
                  
                  <div className="flex items-start gap-4 relative z-10">
                    <div className="w-9 h-9 rounded-xl bg-gray-900 text-white items-center justify-center font-bold font-mono tabular-nums text-sm shrink-0 border-4 border-white hidden md:flex">
                      {idx + 1}
                    </div>
                    
                    <div className="flex-1 space-y-4 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-3 border border-gray-200 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-semibold text-base sm:text-lg text-gray-900 font-display truncate">
                            Fase {idx + 1}: {phase.title}
                          </h3>
                          <button
                            type="button"
                            onClick={() => setPhaseToDelete({ id: phase.id, title: phase.title })}
                            aria-label={`Hapus fase ${phase.title}`}
                            className="text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors min-h-[40px] min-w-[40px] md:min-h-[32px] md:min-w-[32px] flex items-center justify-center rounded-xl shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => openAddCompetency(phase.id)}>
                          <Plus className="w-4 h-4 mr-1" /> Kompetensi
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-0 md:pl-2">
                         {phaseCompetencies.length === 0 ? (
                           <div className="md:col-span-2 text-sm text-gray-400 py-5 px-4 text-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                             Belum ada kompetensi pada fase ini.
                           </div>
                         ) : (
                           phaseCompetencies.map(comp => (
                             <div key={comp.id} className="border border-gray-200 rounded-2xl bg-white p-4 sm:p-5 hover:border-gray-300 transition-colors flex flex-col h-full shadow-sm">
                               <div className="flex items-start gap-3 relative group/comp">
                                 <div className="flex-1 min-w-0">
                                   <div className="flex flex-wrap items-start justify-between gap-2">
                                     <h4 className={`font-medium font-display text-sm sm:text-base flex-1 min-w-0 ${comp.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{comp.title}</h4>
                                     <div className="flex items-center gap-1 shrink-0">
                                       <select 
                                         value={comp.status}
                                         onChange={(e) => updateCompetency(comp.id, { status: e.target.value as any })}
                                         className="text-xs font-medium rounded-xl px-2.5 h-10 md:h-8 border border-gray-200 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-gray-900/10"
                                       >
                                         <option value="not-started">Belum Mulai</option>
                                         <option value="in-progress">Proses</option>
                                         <option value="done">Selesai</option>
                                       </select>
                                       <button
                                         type="button"
                                         onClick={() => setCompToDelete({ id: comp.id, title: comp.title })}
                                         aria-label={`Hapus kompetensi ${comp.title}`}
                                         className="opacity-100 md:opacity-0 md:group-hover/comp:opacity-100 min-h-[40px] min-w-[40px] md:min-h-[32px] md:min-w-[32px] flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                                       >
                                         <Trash2 className="w-4 h-4" />
                                       </button>
                                     </div>
                                   </div>
                                   
                                   {/* Entity Linkages */}
                                   <div className="mt-4 pt-3 border-t border-gray-100 space-y-2.5">
                                     <div className="flex flex-wrap items-center justify-between gap-2">
                                       <MetadataRow
                                         items={[
                                           `${comp.bookIds.length} buku`,
                                           `${comp.outputIds.length} tulisan`,
                                           `Asesmen: ${comp.assessmentStatus || 'Belum'}`,
                                         ]}
                                       />
                                       <div className="flex items-center gap-1 ml-auto">
                                         <Button variant="ghost" size="sm" onClick={() => handleAddStudyNote(comp)} className="text-xs px-2.5 text-gray-700 hover:text-gray-900">
                                           <FileText className="w-3.5 h-3.5 mr-1" /> Catat
                                         </Button>
                                         <Button variant="ghost" size="sm" onClick={() => openManageCompetency(comp.id)} className="text-xs px-2.5">
                                           Kelola
                                         </Button>
                                       </div>
                                     </div>
                                     {(comp.bookIds.length > 0 || comp.outputIds.length > 0) && (
                                       <div className="flex flex-wrap gap-1.5 text-xs text-gray-600 font-mono">
                                         {comp.bookIds.map(bid => (
                                            <span key={bid} className="inline-flex items-center gap-1 truncate max-w-[180px] text-gray-700">
                                              <BookOpen className="w-3 h-3 shrink-0 text-gray-400" /> {getBookTitle(bid)}
                                            </span>
                                         ))}
                                         {comp.outputIds.map(oid => (
                                            <span key={oid} className="inline-flex items-center gap-1 truncate max-w-[180px] text-gray-700">
                                              <PenTool className="w-3 h-3 shrink-0 text-gray-400" /> {getDraftTitle(oid)}
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
                className="flex h-11 md:h-9 w-full rounded-xl border border-gray-200 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 focus-visible:border-gray-900" 
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
                className="flex min-h-[80px] w-full rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 focus-visible:border-gray-900 resize-none" 
                placeholder="Contoh: Mampu menyusun ringkasan metodologis bab pertama"
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

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Hapus Kurikulum"
        description={`Apakah Anda yakin ingin menghapus kurikulum "${path.title}"? Semua fase dan kompetensi di dalamnya akan terhapus.`}
        confirmLabel="Hapus Kurikulum"
        onConfirm={handleDeletePath}
      />

      <ConfirmDialog
        open={Boolean(phaseToDelete)}
        onOpenChange={(open) => {
          if (!open) setPhaseToDelete(null);
        }}
        title="Hapus Fase"
        description={`Apakah Anda yakin ingin menghapus fase "${phaseToDelete?.title || ''}" beserta seluruh kompetensinya?`}
        confirmLabel="Hapus Fase"
        onConfirm={() => {
          if (phaseToDelete) {
            deletePhase(phaseToDelete.id);
            setPhaseToDelete(null);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(compToDelete)}
        onOpenChange={(open) => {
          if (!open) setCompToDelete(null);
        }}
        title="Hapus Kompetensi"
        description={`Apakah Anda yakin ingin menghapus kompetensi "${compToDelete?.title || ''}"?`}
        confirmLabel="Hapus Kompetensi"
        onConfirm={() => {
          if (compToDelete) {
            deleteCompetency(compToDelete.id);
            setCompToDelete(null);
          }
        }}
      />

      {/* Manage Competency Dialog */}
      <Dialog open={isManageCompOpen} onOpenChange={setIsManageCompOpen}>
        <DialogHeader>
          <DialogTitle>Kelola Kompetensi</DialogTitle>
        </DialogHeader>
        <DialogContent>
          {activeCompForManage && competencies.find(c => c.id === activeCompForManage) && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <h4 className="font-semibold text-gray-900 font-display">{competencies.find(c => c.id === activeCompForManage)?.title}</h4>
                <p className="text-xs text-gray-500">Tautkan buku dan hasil tulisan untuk membuktikan bahwa Anda telah menguasai kompetensi ini.</p>
              </div>

              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
                  <BookOpen className="w-4 h-4 text-gray-400" /> Buku Terkait
                </h5>
                <div className="flex flex-col gap-2">
                  {competencies.find(c => c.id === activeCompForManage)?.bookIds.map(bid => (
                    <div key={bid} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                      <span className="text-sm text-gray-700 truncate">{getBookTitle(bid)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBookFromComp(activeCompForManage, bid)}
                        aria-label="Hapus buku terkait"
                        className="text-gray-400 hover:text-gray-900 hover:bg-gray-200/50 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {competencies.find(c => c.id === activeCompForManage)?.bookIds.length === 0 && (
                    <p className="text-xs text-gray-400 italic">Belum ada buku tertaut.</p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2 mt-2">
                    <select 
                      value={manageSelectedBook}
                      onChange={(e) => setManageSelectedBook(e.target.value)}
                      className="flex-1 h-11 md:h-9 rounded-xl border border-gray-200 bg-white text-sm px-3 outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
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
                    <div key={oid} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                      <span className="text-sm text-gray-700 truncate">{getDraftTitle(oid)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOutputFromComp(activeCompForManage, oid)}
                        aria-label="Hapus tulisan terkait"
                        className="text-gray-400 hover:text-gray-900 hover:bg-gray-200/50 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {competencies.find(c => c.id === activeCompForManage)?.outputIds.length === 0 && (
                    <p className="text-xs text-gray-400 italic">Belum ada hasil tulisan tertaut.</p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2 mt-2">
                    <select 
                      value={manageSelectedOutput}
                      onChange={(e) => setManageSelectedOutput(e.target.value)}
                      className="flex-1 h-11 md:h-9 rounded-xl border border-gray-200 bg-white text-sm px-3 outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
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

      <ShareCurriculumModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        path={path}
        phases={phases}
        competencies={competencies.filter((c) => phases.some((p) => p.id === c.phaseId))}
        books={books}
      />
    </div>
  );
}
