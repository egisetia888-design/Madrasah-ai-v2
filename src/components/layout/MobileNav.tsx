import { useState, useEffect } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { LayoutDashboard, Library, PenTool, Map, Briefcase, FileText, Network, Menu, X, Brain, BarChart2, Settings, Command, Zap, BrainCircuit, Clock, Keyboard, LogOut, Info } from "lucide-react"
import { cn } from "../../utils/cn"
import { useUIStore } from "../../store/uiStore"
import { useAuthStore } from "../../store/authStore"
import { useNotesStore } from "../../store/notesStore"
import { useWritingStore } from "../../store/writingStore"
import { PWAInstallButton } from "../PWAInstallButton"
import { GlobalSyncBadge } from "../ui/GlobalSyncBadge"

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

const mainNavItems = [
  workspaceItems[0], // Beranda
  workspaceItems[1], // Pustaka
  workspaceItems[2], // Catatan
  workspaceItems[3], // Konsep
]

export function MobileNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const setSearchOpen = useUIStore(state => state.setSearchOpen)
  const setQuickAddOpen = useUIStore(state => state.setQuickAddOpen)
  const setShortcutGuideOpen = useUIStore(state => state.setShortcutGuideOpen)
  const setAboutOpen = useUIStore(state => state.setAboutOpen)

  const notes = useNotesStore(state => state.notes)
  const drafts = useWritingStore(state => state.drafts)

  const recentItems = [
    ...notes.slice(0, 3).map(n => ({ id: n.id, title: n.title, type: 'note' as const, date: n.updatedAt })),
    ...drafts.slice(0, 3).map(d => ({ id: d.id, title: d.title, type: 'writing' as const, date: d.updatedAt }))
  ].sort((a, b) => b.date - a.date).slice(0, 4)

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200 z-50 pb-safe shadow-sm">
        <div className="flex items-center justify-around px-2 py-1.5">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all min-w-[64px] min-h-[44px]",
                  isActive
                    ? "text-gray-900"
                    : "text-gray-400 hover:text-gray-900"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  <span className={cn("text-[10px] font-medium tracking-tight", isActive && "font-semibold")}>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all min-w-[64px] min-h-[44px] cursor-pointer",
              menuOpen
                ? "text-gray-900"
                : "text-gray-400 hover:text-gray-900"
            )}
            aria-label={menuOpen ? "Tutup Menu" : "Buka Menu Lengkap"}
          >
            {menuOpen ? <X className="w-5 h-5" strokeWidth={2.5} /> : <Menu className="w-5 h-5" strokeWidth={2} />}
            <span className={cn("text-[10px] font-medium tracking-tight", menuOpen && "font-semibold")}>Menu</span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-gray-50/98 backdrop-blur-xl pt-4 pb-24 px-4 overflow-y-auto animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="max-w-md mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-lg font-display">M</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight font-display">Madrasah</h2>
                    <GlobalSyncBadge compact />
                  </div>
                  <p className="text-xs text-gray-500">Personal Knowledge OS</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setMenuOpen(false)
                    setQuickAddOpen(true)
                  }} 
                  className="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center bg-gray-900 text-white rounded-xl shadow-xs active:scale-95 transition-transform"
                  title="Tangkapan Kilat"
                  aria-label="Tangkapan Kilat"
                >
                  <Zap className="w-4 h-4 fill-currentColor" />
                </button>
                <button 
                  onClick={() => {
                    setMenuOpen(false)
                    setSearchOpen(true)
                  }} 
                  className="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center bg-white border border-gray-200 rounded-xl text-gray-700 shadow-xs active:scale-95 transition-transform"
                  title="Pencarian Cepat (Command Palette)"
                  aria-label="Pencarian Cepat"
                >
                  <Command className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
                  aria-label="Tutup Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Semua Modul Workspace */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50/75 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Semua Modul</span>
                <span className="text-xs text-gray-400 font-mono">{workspaceItems.length} modul</span>
              </div>
              <div className="divide-y divide-gray-50">
                {workspaceItems.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3.5 px-4 py-3 min-h-[48px] transition-colors",
                        isActive
                          ? "bg-gray-50 text-gray-900"
                          : "hover:bg-gray-50 text-gray-700 active:bg-gray-100"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                          isActive ? "bg-gray-900 text-white shadow-xs" : "bg-gray-100 text-gray-600"
                        )}>
                          <item.icon className="w-4 h-4" strokeWidth={2} />
                        </div>
                        <span className={cn("text-sm font-medium", isActive ? "text-gray-900 font-semibold" : "text-gray-700")}>
                          {item.name}
                        </span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>

            {/* Terkini (Recent Items) */}
            {recentItems.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50/75 border-b border-gray-100 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Terkini</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {recentItems.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => {
                        setMenuOpen(false)
                        navigate(item.type === 'note' ? `/notes/${item.id}` : `/writing/${item.id}`)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-left hover:bg-gray-50 transition-colors group"
                    >
                      <div className="w-2 h-2 rounded-full bg-gray-400 shrink-0 group-hover:bg-gray-900 transition-colors" />
                      <span className="text-sm font-medium text-gray-700 truncate group-hover:text-gray-900">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-gray-400 uppercase font-mono ml-auto shrink-0">
                        {item.type === 'note' ? 'Catatan' : 'Tulisan'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sistem & Pengaturan */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50/75 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Sistem</span>
                <PWAInstallButton />
              </div>
              <div className="divide-y divide-gray-50">
                <NavLink
                  to="/analytics"
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3.5 px-4 py-3 min-h-[48px] transition-colors",
                      isActive ? "bg-gray-50 text-gray-900" : "hover:bg-gray-50 text-gray-700"
                    )
                  }
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                    <BarChart2 className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Analitik & Aktivitas</span>
                </NavLink>

                <NavLink
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3.5 px-4 py-3 min-h-[48px] transition-colors",
                      isActive ? "bg-gray-50 text-gray-900" : "hover:bg-gray-50 text-gray-700"
                    )
                  }
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                    <Settings className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Pengaturan Workspace</span>
                </NavLink>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    setShortcutGuideOpen(true)
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3 min-h-[48px] text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                    <Keyboard className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div className="flex items-center justify-between flex-1">
                    <span className="text-sm font-medium text-gray-700">Bantuan Pintasan & Panduan</span>
                    <span className="text-[11px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">?</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    setAboutOpen(true)
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3 min-h-[48px] text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                    <Info className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Tentang Madrasah</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    useAuthStore.getState().logout()
                    navigate("/login")
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3 min-h-[48px] text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                    <LogOut className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Keluar (Logout)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
