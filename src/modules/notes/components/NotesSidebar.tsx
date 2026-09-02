import { Search, Plus, FolderOpen, Folder as FolderIcon } from "lucide-react"
import { NoteType, Folder, Tag } from "../../../types"
import { cn } from "../../../utils/cn"

interface NotesSidebarProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  activeTab: 'all' | NoteType
  setActiveTab: (tab: 'all' | NoteType) => void
  folders: Folder[]
  activeFolderId: string | null
  setActiveFolderId: (id: string | null) => void
  setIsAddFolderOpen: (open: boolean) => void
  allTags: Tag[]
  activeTagId: string | null
  setActiveTagId: (id: string | null) => void
  mobileFiltersOpen: boolean
}

export function NotesSidebar({
  searchTerm,
  setSearchTerm,
  activeTab,
  setActiveTab,
  folders,
  activeFolderId,
  setActiveFolderId,
  setIsAddFolderOpen,
  allTags,
  activeTagId,
  setActiveTagId,
  mobileFiltersOpen
}: NotesSidebarProps) {
  return (
    <div className={cn(
      "lg:w-64 shrink-0 space-y-6",
      mobileFiltersOpen ? "block animate-in fade-in slide-in-from-top-2 duration-200" : "hidden lg:block"
    )}>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari catatan..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-1 focus:ring-gray-300 outline-none"
          />
        </div>

        <div className="space-y-1 mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Kategori</h3>
          {[
            { id: 'all', label: 'Semua Catatan' },
            { id: 'knowledge', label: 'Knowledge (Ilmu)' },
            { id: 'research', label: 'Research (Riset)' },
            { id: 'project', label: 'Project (Proyek)' },
            { id: 'writing', label: 'Writing (Tulisan)' },
            { id: 'personal', label: 'Personal (Jurnal)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "w-full text-left px-3 py-1.5 rounded-xl text-sm font-medium transition-colors cursor-pointer",
                activeTab === tab.id ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-1 mb-6">
          <div className="flex items-center justify-between px-2 mb-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Folder</h3>
            <button onClick={() => setIsAddFolderOpen(true)} className="text-gray-400 hover:text-gray-900 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => setActiveFolderId(null)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors cursor-pointer",
              activeFolderId === null ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <FolderOpen className="w-4 h-4" /> Semua Folder
          </button>
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => setActiveFolderId(folder.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors cursor-pointer",
                activeFolderId === folder.id ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <FolderIcon className="w-4 h-4" /> {folder.name}
            </button>
          ))}
        </div>

        {allTags.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Tags</h3>
            <div className="flex flex-wrap gap-1.5 px-2">
              <button
                onClick={() => setActiveTagId(null)}
                className={cn(
                  "px-2 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer",
                  activeTagId === null ? "bg-gray-900 text-white border-gray-900" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                )}
              >
                Semua
              </button>
              {allTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => setActiveTagId(tag.id)}
                  className={cn(
                    "px-2 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer",
                    activeTagId === tag.id ? "bg-gray-900 text-white border-gray-900" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                  )}
                >
                  #{tag.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
