import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../../components/ui/Button"
import { PageHeader } from "../../components/ui/PageHeader"
import { EmptyState } from "../../components/ui/EmptyState"
import { MetadataRow } from "../../components/ui/MetadataRow"
import { Plus, PenLine, LayoutGrid, List, Network } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog"
import { useWritingStore } from "../../store/writingStore"
import { useKnowledgeStore } from "../../store/knowledgeStore"
import { WritingStatus } from "../../types"
import { cn } from "../../utils/cn"
import { autoLinkSingleEntity } from "../../utils/autoLinker"

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
    const wordCount = draft.content.split(/\s+/).filter((w: string) => w.length > 0).length;

    return (
      <div key={draft.id} onClick={() => navigate(`/writing/${draft.id}`)} className="group border border-gray-200 rounded-2xl bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer flex flex-col min-h-[9.5rem]">
        <div className="flex items-start gap-2 mb-1.5 min-w-0">
          {draft.icon && (
            (() => {
              const Icon = (LucideIcons as any)[draft.icon] || LucideIcons.FileText;
              return <Icon className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />;
            })()
          )}
          <h3 className="font-semibold text-gray-900 line-clamp-2 leading-snug font-display">{draft.title}</h3>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2 flex-1 font-serif mt-1 leading-relaxed">{draft.content || "Mulai menulis..."}</p>
        <div className="mt-auto pt-3 border-t border-gray-100">
          <MetadataRow
            items={[
              new Date(draft.updatedAt).toLocaleDateString('id-ID'),
              `${wordCount} kata`,
              relCount > 0 && (
                <span className="inline-flex items-center gap-1 text-gray-700">
                  <Network className="w-3 h-3" /> {relCount} relasi
                </span>
              ),
            ]}
          />
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
      <PageHeader
        title="Alur Menulis"
        description="Kelola siklus hidup karya intelektual Anda dari ide hingga publikasi."
        className="shrink-0"
        actions={
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <div className="flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={cn(
                  "min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-2 flex items-center justify-center rounded-lg transition-all cursor-pointer",
                  viewMode === 'board' ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-700'
                )}
                title="Tampilan Papan"
                aria-label="Tampilan Papan"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  "min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-2 flex items-center justify-center rounded-lg transition-all cursor-pointer",
                  viewMode === 'list' ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-700'
                )}
                title="Tampilan Daftar"
                aria-label="Tampilan Daftar"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button className="gap-2 shrink-0 flex-1 sm:flex-initial" onClick={() => setIsAddOpen(true)}>
              <Plus className="w-4 h-4" />
              <span>Ide Baru</span>
            </Button>
          </div>
        }
      />

      {viewMode === 'list' && (
        <div className="flex items-center gap-1.5 overflow-x-auto w-full no-scrollbar py-1 scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-gray-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveStageFilter('all')}
            className={cn(
              "px-3.5 min-h-[44px] sm:min-h-0 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer",
              activeStageFilter === 'all'
                ? "bg-gray-900 text-white shadow-sm font-semibold"
                : "bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            Semua (<span className="font-mono tabular-nums">{drafts.length}</span>)
          </button>
          {WRITING_PIPELINE.map(stage => {
            const count = drafts.filter(d => (d.status as string) === stage.id || (stage.id === 'draft' && !WRITING_PIPELINE.map(p=>p.id).includes(d.status as WritingStatus))).length;
            return (
              <button
                type="button"
                key={stage.id}
                onClick={() => setActiveStageFilter(stage.id)}
                className={cn(
                  "px-3.5 min-h-[44px] sm:min-h-0 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer",
                  activeStageFilter === stage.id
                    ? "bg-gray-900 text-white shadow-sm font-semibold"
                    : "bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
              >
                {stage.label} (<span className="font-mono tabular-nums">{count}</span>)
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 w-full min-w-0">
        {drafts.length === 0 ? (
          <EmptyState
            icon={PenLine}
            title="Alur menulis masih kosong"
            description="Tangkap satu ide atau tesis awal untuk mulai mengembangkannya menjadi tulisan utuh."
            action={
              <Button className="gap-2" onClick={() => setIsAddOpen(true)}>
                <Plus className="w-4 h-4" />
                Ide Baru
              </Button>
            }
          />
        ) : viewMode === 'board' ? (
          <div className="flex gap-4 overflow-x-auto w-full no-scrollbar pb-4 min-h-[400px] snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
            {WRITING_PIPELINE.map(stage => {
              const stageDrafts = drafts.filter(d => (d.status as string) === stage.id || (stage.id === 'draft' && !WRITING_PIPELINE.map(p=>p.id).includes(d.status as WritingStatus)))
              return (
                <div key={stage.id} className="w-[82vw] sm:w-72 shrink-0 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-xs snap-center">
                  <div className="p-3.5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10 rounded-t-2xl">
                    <h3 className="font-bold text-xs text-gray-900 uppercase tracking-wider font-mono">{stage.label}</h3>
                    <span className="text-xs font-semibold text-gray-500 font-mono tabular-nums">{stageDrafts.length}</span>
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
