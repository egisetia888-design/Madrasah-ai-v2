import { useNavigate } from "react-router-dom"
import { Button } from "../../../components/ui/Button"
import { EmptyState } from "../../../components/ui/EmptyState"
import { MetadataRow } from "../../../components/ui/MetadataRow"
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

function getNoteCategoryLabel(type: Note['type']) {
  if (type === 'fleeting' || type === 'personal') return 'Mentah';
  if (type === 'literature' || type === 'knowledge' || type === 'research') return 'Literatur';
  if (type === 'permanent' || type === 'writing' || type === 'project') return 'Permanen';
  return 'Catatan';
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
    <div className="flex-1 min-w-0 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base sm:text-lg font-medium text-gray-900 font-display tabular-nums">
          {filteredNotes.length} Catatan ditemukan
        </h2>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn(
              "min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-1.5 flex items-center justify-center rounded-lg transition-colors cursor-pointer",
              viewMode === 'grid' ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-900"
            )}
            title="Tampilan Kisi"
            aria-label="Tampilan Kisi"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              "min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-1.5 flex items-center justify-center rounded-lg transition-colors cursor-pointer",
              viewMode === 'list' ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-900"
            )}
            title="Tampilan Daftar"
            aria-label="Tampilan Daftar"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filteredNotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Belum ada catatan"
          description="Tuliskan ide, kutipan, atau riset Anda untuk mulai membangun basis pengetahuan terhubung."
          action={
            <Button onClick={() => setIsAddOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Buat Catatan Pertama
            </Button>
          }
        />
      ) : (
        <div className={cn(
          "grid gap-4",
          viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
        )}>
          {filteredNotes.map(note => {
            const folder = folders.find(f => f.id === note.folderId);
            const noteTags = note.tags.map(id => allTags.find(t => t.id === id)).filter(Boolean);
            const relCount = storedRelations.filter(r => r.sourceNodeId === note.id || r.targetNodeId === note.id).length;

            return (
              <div
                key={note.id}
                onClick={() => navigate(`/notes/${note.id}`)}
                className={cn(
                  "group border border-gray-200 rounded-2xl bg-white hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer flex flex-col",
                  viewMode === 'grid' ? "min-h-[15.5rem] p-5" : "p-4 sm:p-5"
                )}
              >
                <div className="mb-3">
                  <div className="flex items-start gap-2 mb-1.5">
                    {note.icon && (
                      (() => {
                        const Icon = (LucideIcons as any)[note.icon] || LucideIcons.FileText;
                        return <Icon className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />;
                      })()
                    )}
                    <h3 className="font-bold text-gray-900 line-clamp-2 leading-snug font-display">
                      {note.title}
                    </h3>
                  </div>

                  <MetadataRow
                    items={[
                      getNoteCategoryLabel(note.type),
                      folder && (
                        <span className="inline-flex items-center gap-1 text-gray-500">
                          <FolderIcon className="w-3 h-3 shrink-0" />
                          <span className="truncate">{folder.name}</span>
                        </span>
                      ),
                    ]}
                  />
                </div>

                <p className={cn(
                  "text-sm text-gray-600 flex-1 leading-relaxed",
                  viewMode === 'grid' ? "line-clamp-4 mb-4" : "line-clamp-2 sm:line-clamp-3 mb-4"
                )}>
                  {note.content || "Belum ada isi catatan."}
                </p>

                <div className="flex flex-col gap-2 mt-auto pt-3.5 border-t border-gray-100">
                  {noteTags.length > 0 && (
                    <div className="text-xs font-mono text-gray-500 truncate">
                      {noteTags.slice(0, 3).map(tag => `#${tag!.name}`).join(' · ')}
                      {noteTags.length > 3 ? ` · +${noteTags.length - 3}` : ''}
                    </div>
                  )}

                  <MetadataRow
                    items={[
                      <span className={note.status === 'processed' ? "text-gray-900 font-medium" : "text-gray-400"}>
                        {note.status === 'processed' ? 'Terproses' : 'Belum diproses'}
                      </span>,
                      relCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-gray-700">
                          <Network className="w-3 h-3" />
                          {relCount} relasi
                        </span>
                      ),
                      new Date(note.updatedAt).toLocaleDateString('id-ID'),
                    ]}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

