import { NavLink, useNavigate } from "react-router-dom"
import { LayoutDashboard, Library, PenTool, Map, Settings, LogOut, Briefcase, FileText, Network, FlaskConical, Search, Brain, BarChart2, Star, Clock, Pin, Zap, Keyboard, BrainCircuit } from "lucide-react"
import { cn } from "../../utils/cn"
import { useUIStore } from "../../store/uiStore"
import { useAuthStore } from "../../store/authStore"
import { useNotesStore } from "../../store/notesStore"
import { useWritingStore } from "../../store/writingStore"

const workspaceItems = [
  { name: "Beranda", href: "/", icon: LayoutDashboard },
  { name: "Pustaka", href: "/library", icon: Library },
  { name: "Catatan", href: "/notes", icon: FileText },
  { name: "Konsep", href: "/concepts", icon: BrainCircuit },
  { name: "Graf Analisa", href: "/graph", icon: Network },
  { name: "Review", href: "/review", icon: Brain },
  { name: "Tulisan", href: "/writing", icon: PenTool },
  { name: "Proyek", href: "/projects", icon: Briefcase },
  { name: "Kurikulum", href: "/curriculum", icon: Map },
]

export function Sidebar() {
  const navigate = useNavigate();
  const setSearchOpen = useUIStore(state => state.setSearchOpen)
  const setAboutOpen = useUIStore(state => state.setAboutOpen)
  
  const notes = useNotesStore(state => state.notes)
  const drafts = useWritingStore(state => state.drafts)
  
  const recentItems = [
    ...notes.map(n => ({ id: n.id, title: n.title, type: 'note', updatedAt: n.updatedAt })),
    ...drafts.map(d => ({ id: d.id, title: d.title, type: 'draft', updatedAt: d.updatedAt }))
  ].sort((a,b) => b.updatedAt - a.updatedAt).slice(0, 3)

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen border-r border-gray-200 bg-[#fbfbfb] px-4 py-6 sticky top-0 font-sans">
      <div className="flex items-center justify-between px-2 mb-8 cursor-pointer group" onClick={() => setAboutOpen(true)}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <span className="text-white font-bold text-sm font-display">M</span>
          </div>
          <span className="font-semibold text-[17px] tracking-tight font-display text-gray-900">Madrasah</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setSearchOpen(true)} className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-gray-300 hover:text-gray-900 transition-all text-left">
          <Search className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">Ketik...</span>
          <kbd className="hidden xl:inline-flex items-center justify-center px-1.5 text-[10px] font-medium text-gray-400 border border-gray-200 bg-gray-50 rounded">⌘K</kbd>
        </button>
        <button onClick={() => useUIStore.getState().setQuickAddOpen(true)} className="flex shrink-0 items-center justify-center w-9 h-9 text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-gray-300 hover:text-gray-900 hover:bg-gray-50 transition-all" title="Tangkapan Kilat (Cmd+Shift+I)">
          <Zap className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-8 overflow-y-auto pr-2 no-scrollbar">
        
        {/* Workspace */}
        <div>
          <h4 className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Workspace</h4>
          <div className="space-y-0.5">
            {workspaceItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200",
                    isActive
                      ? "bg-gray-50 text-gray-800"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={cn("w-4 h-4", isActive ? "text-gray-900" : "text-gray-400")} />
                    {item.name}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Recent */}
        {recentItems.length > 0 && (
          <div>
            <h4 className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Terkini
            </h4>
            <div className="space-y-0.5">
              {recentItems.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => navigate(item.type === 'note' ? `/notes/${item.id}` : `/writing/${item.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors text-left"
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", item.type === 'note' ? 'bg-gray-400' : 'bg-gray-400')} />
                  <span className="truncate">{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="mt-6 pt-4 border-t border-gray-100 space-y-0.5">
        <button
          onClick={() => useUIStore.getState().setShortcutGuideOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors text-left"
        >
          <Keyboard className="w-4 h-4 text-gray-400" />
          Bantuan Pintasan
          <kbd className="ml-auto inline-flex items-center justify-center px-1 text-[10px] font-medium text-gray-400 border border-gray-200 bg-gray-50 rounded">?</kbd>
        </button>
        <NavLink
          to="/analytics"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
              isActive
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )
          }
        >
          <BarChart2 className="w-4 h-4 text-gray-400" />
          Analytics
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
              isActive
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )
          }
        >
          <Settings className="w-4 h-4 text-gray-400" />
          Pengaturan
        </NavLink>
        <button
          onClick={() => {
            useAuthStore.getState().logout();
            navigate("/login");
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors text-left"
        >
          <LogOut className="w-4 h-4 text-gray-400" />
          Keluar
        </button>
      </div>
    </aside>
  )
}
