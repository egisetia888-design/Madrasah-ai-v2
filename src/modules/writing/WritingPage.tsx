import { SyncStatusIndicator } from '../../components/ui/SyncStatusIndicator';
import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../../components/ui/Button"
import { Plus, PenLine, FileText, MoreVertical, LayoutGrid, List, Network, Sparkles } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog"
import { useWritingStore } from "../../store/writingStore"
import { useKnowledgeStore } from "../../store/knowledgeStore"
import { WritingStatus } from "../../types"
import { cn } from "../../utils/cn"
import { scanTextForEntities, autoLinkSingleEntity } from "../../utils/autoLinker"

const WRITING_PIPELINE: { id: WritingStatus; label: string }[] = [
  { id: 'idea', label: 'Ide' },
  { id: 'outline', label: 'Kerangka' },
  { id: 'draft', label: 'Draf' },
  { id: 'editing', label: 'Pengeditan' },
  { id: 'review', label: 'Ulasan' },
  { id: 'published', label: 'Diterbitkan' }
]

export function WritingPage() {
  const navigate = useNavigate()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
  
  const drafts = useWritingStore(state => state.drafts)
  const addDraft = useWritingStore(state => state.addDraft)
  const relations = useKnowledgeStore(state => state.relations)

  const handleAddDraft = (e: any) => {
    e.preventDefault()
    if (!title) return
    
    const id = addDraft({
      title,
      content,
      status: 'idea',
    })

    // Auto-link entities mentioned in title/content
    try {
      autoLinkSingleEntity(id, `${title}\n${content}`, 'writing', title);
    } catch (e) {
      console.warn('Auto-link error:', e);
    }

    // Index for semantic search
    useWritingStore.getState().indexDraft(id);

    setTitle("")
    setContent("")
    setIsAddOpen(false)
  }

  const renderCard = (draft: any) => {
    const relCount = relations.filter(r => r.sourceNodeId === draft.id || r.targetNodeId === draft.id).length;

    return (
      <div key={draft.id} onClick={() => navigate(`/writing/${draft.id}`)} className="group border border-gray-200 rounded-xl bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer flex flex-col h-40">
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex items-center gap-2 pr-2 min-w-0">
            {draft.icon && (
              (() => {
                const Icon = (LucideIcons as any)[draft.icon] || LucideIcons.FileText;
                return <Icon className="w-3.5 h-3.5 text-gray-500 shrink-0" />;
              })()
            )}
            <h3 className="font-medium text-gray-900 line-clamp-2 leading-snug">{draft.title}</h3>
          </div>
          <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-900 shrink-0">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2 flex-1 font-serif mt-1">{draft.content || "Mulai menulis..."}</p>
        <div className="flex items-center justify-between text-[10px] text-gray-400 mt-auto pt-3 border-t border-gray-50 uppercase tracking-wider font-semibold">
          <div className="flex items-center gap-2">
            <span>{new Date(draft.updatedAt).toLocaleDateString()}</span>
            <SyncStatusIndicator status={draft.syncStatus} />
            {relCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded text-[9px] font-mono lowercase">
                <Network className="w-2.5 h-2.5" /> {relCount} relasi
              </span>
            )}
          </div>
          <span>{draft.content.split(/\s+/).filter((w: string) => w.length > 0).length} kata</span>
        </div>
      </div>
    );
  }

  const [activeStageFilter, setActiveStageFilter] = useState<WritingStatus | 'all'>('all')

  const filteredDrafts = drafts.filter(d => {
    if (activeStageFilter === 'all') return true;
    return (d.status as string) === activeStageFilter || (activeStageFilter === 'draft' && !WRITING_PIPELINE.map(p=>p.id).includes(d.status as WritingStatus));
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col w-full min-w-0 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-display">Alur Menulis</h1>
          <p className="text-gray-500 mt-1 text-xs sm:text-sm">Kelola siklus hidup karya intelektual Anda.</p>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <div className="flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200">
            <button 
              onClick={() => setViewMode('board')} 
              className={`p-2 rounded-lg transition-all ${viewMode === 'board' ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
              title="Tampilan Papan"
            >
               <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
              title="Tampilan Daftar"
            >
               <List className="w-4 h-4" />
            </button>
          </div>
          <Button className="gap-2 shrink-0 h-11 sm:h-9 flex-1 sm:flex-initial" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>Ide Baru</span>
          </Button>
        </div>
      </div>

      {viewMode === 'list' && (
        <div className="flex items-center gap-1.5 overflow-x-auto w-full no-scrollbar py-1 scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-gray-200 pb-3">
          <button
            onClick={() => setActiveStageFilter('all')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer",
              activeStageFilter === 'all'
                ? "bg-gray-900 text-white shadow-sm font-semibold"
                : "bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            Semua ({drafts.length})
          </button>
          {WRITING_PIPELINE.map(stage => {
            const count = drafts.filter(d => (d.status as string) === stage.id || (stage.id === 'draft' && !WRITING_PIPELINE.map(p=>p.id).includes(d.status as WritingStatus))).length;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStageFilter(stage.id)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer",
                  activeStageFilter === stage.id
                    ? "bg-gray-900 text-white shadow-sm font-semibold"
                    : "bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
              >
                {stage.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 w-full min-w-0">
        {drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 h-full text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/30 p-6">
             <div className="w-12 h-12 bg-white shadow-sm rounded-2xl border border-gray-200 flex items-center justify-center mb-4 text-gray-400">
               <PenLine className="w-6 h-6" />
             </div>
             <h3 className="text-base font-semibold text-gray-900 font-display">Alur Anda kosong</h3>
             <p className="text-xs sm:text-sm text-gray-500 mt-1 mb-4 max-w-sm">
               Tangkap ide untuk memulai proses menulis.
             </p>
             <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsAddOpen(true)}>
               <Plus className="w-3.5 h-3.5" />
               Ide Baru
             </Button>
          </div>
        ) : viewMode === 'board' ? (
          <div className="flex gap-3.5 overflow-x-auto w-full no-scrollbar pb-4 min-h-[400px] snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
            {WRITING_PIPELINE.map(stage => {
              const stageDrafts = drafts.filter(d => (d.status as string) === stage.id || (stage.id === 'draft' && !WRITING_PIPELINE.map(p=>p.id).includes(d.status as WritingStatus)))
              return (
                <div key={stage.id} className="w-[82vw] sm:w-72 shrink-0 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-xs snap-center">
                  <div className="p-3.5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10 rounded-t-2xl">
                    <h3 className="font-bold text-xs text-gray-900 uppercase tracking-wider font-mono">{stage.label}</h3>
                    <span className="text-[11px] font-bold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full font-mono">{stageDrafts.length}</span>
                  </div>
                  <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5 max-h-[60vh]">
                    {stageDrafts.map(renderCard)}
                    {stageDrafts.length === 0 && (
                      <div className="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                        Tidak ada draf
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
             {filteredDrafts.map(renderCard)}
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogHeader>
          <DialogTitle>Tangkap Ide</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={handleAddDraft}>
          <DialogContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Judul <span className="text-gray-500">*</span></label>
              <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                type="text" 
                className="flex h-11 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950" 
                placeholder="Contoh: Filosofi Stoikisme"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Pemikiran Awal</label>
              <textarea 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex min-h-[120px] w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 resize-none font-serif" 
                placeholder="Hanya ide kasar..."
              />
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>Batal</Button>
            <Button type="submit" disabled={!title.trim()}>Simpan Ide</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
