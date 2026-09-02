import { useNavigate } from "react-router-dom"
import { Button } from "../../../components/ui/Button"
import { LayoutGrid, List, FileText, Plus, Folder as FolderIcon, Network } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { Note, Folder, Tag, Relation } from "../../../types"
import { cn } from "../../../utils/cn"

interface NotesGridProps {
  filteredNotes: Note[]
  folders: Folder[]
  allTags: Tag[]
  storedRelations: Relation[]
  viewMode: 'grid' | 'list'
  setViewMode: (mode: 'grid' | 'list') => void
  setIsAddOpen: (open: boolean) => void
}

export function NotesGrid({
  filteredNotes,
  folders,
  allTags,
  storedRelations,
  viewMode,
  setViewMode,
  setIsAddOpen
}: NotesGridProps) {
  const navigate = useNavigate()

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900 font-display">
          {filteredNotes.length} Catatan ditemukan
        </h2>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-2xs">
          <button
            onClick={() => setViewMode('grid')}
            className={cn("p-1.5 rounded-lg transition-colors cursor-pointer", viewMode === 'grid' ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-900")}
            title="Tampilan Grid"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn("p-1.5 rounded-lg transition-colors cursor-pointer", viewMode === 'list' ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-900")}
            title="Tampilan List"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-white">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 text-gray-400 shadow-sm border border-gray-100">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 font-display">Belum ada catatan</h3>
          <p className="text-sm text-gray-500 mt-2 mb-6 max-w-sm">
            Tuliskan ide, pemikiran, atau riset Anda untuk mulai membangun otak kedua Anda.
          </p>
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Buat Catatan Pertama
          </Button>
        </div>
      ) : (
        <div className={cn(
          "grid gap-4",
          viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
        )}>
          {filteredNotes.map(note => {
            const folder = folders.find(f => f.id === note.folderId);
            const noteTags = note.tags.map(id => allTags.find(t => t.id === id)).filter(Boolean);

            return (
              <div
                key={note.id}
                onClick={() => navigate(`/notes/${note.id}`)}
                className={cn(
                  "group border border-gray-200 rounded-2xl bg-white hover:border-gray-300 hover:shadow-md transition-all cursor-pointer flex flex-col relative overflow-hidden",
                  viewMode === 'grid' ? "h-64 p-5" : "p-4 sm:p-5"
                )}
              >
                {note.status === 'processed' && (
                  <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden pointer-events-none">
                    <div className="absolute top-3 -right-6 w-24 bg-gray-500 text-white text-[10px] font-bold uppercase tracking-widest text-center py-1 rotate-45 font-mono">
                      Processed
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between mb-3 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {note.icon && (
                        (() => {
                          const Icon = (LucideIcons as any)[note.icon] || LucideIcons.FileText;
                          return <Icon className="w-4 h-4 text-gray-500 shrink-0" />;
                        })()
                      )}
                      <h3 className="font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-gray-900 transition-colors font-display">
                        {note.title}
                      </h3>
                    </div>
                    {folder && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                        <FolderIcon className="w-3 h-3" /> {folder.name}
                      </div>
                    )}
                  </div>
                </div>

                <p className={cn(
                  "text-sm text-gray-600 flex-1 leading-relaxed",
                  viewMode === 'grid' ? "line-clamp-4 mb-4" : "line-clamp-2 sm:line-clamp-3 mb-4"
                )}>
                  {note.content || "Tidak ada konten."}
                </p>

                <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-gray-50">
                  {noteTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {noteTags.slice(0, 3).map(tag => (
                        <span key={tag!.id} className="text-[10px] font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          #{tag!.name}
                        </span>
                      ))}
                      {noteTags.length > 3 && (
                        <span className="text-[10px] font-medium px-2 py-0.5 bg-gray-50 text-gray-400 rounded">
                          +{noteTags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("w-2 h-2 rounded-full", note.status === 'processed' ? "bg-gray-500" : "bg-gray-300")} />
                      {note.status === 'processed' ? 'Sudah Diproses' : 'Belum Diproses'}
                    </span>

                    {(() => {
                      const relCount = storedRelations.filter(r => r.sourceNodeId === note.id || r.targetNodeId === note.id).length;
                      if (relCount === 0) return (
                        <span className="font-mono">{new Date(note.updatedAt).toLocaleDateString()}</span>
                      );
                      return (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-[11px] text-gray-700 font-semibold bg-gray-100 px-2 py-0.5 rounded-md font-mono">
                            <Network className="w-3 h-3 text-gray-900" />
                            {relCount} relasi
                          </span>
                          <span className="font-mono">{new Date(note.updatedAt).toLocaleDateString()}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
