import { useState, useEffect } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { LayoutDashboard, Library, PenTool, Map, Briefcase, FileText, Network, FlaskConical, Menu, X, Brain, BarChart2, Settings, Command, Zap, BrainCircuit } from "lucide-react"
import { cn } from "../../utils/cn"
import { useUIStore } from "../../store/uiStore"

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
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const setSearchOpen = useUIStore(state => state.setSearchOpen)

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-200 z-50 pb-safe">
        <div className="flex items-center justify-around px-2 py-2">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all min-w-[64px]",
                  isActive
                    ? "text-gray-900"
                    : "text-gray-400 hover:text-gray-900"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                  <span className={cn("text-[10px] font-medium tracking-tight", isActive && "font-semibold")}>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all min-w-[64px]",
              menuOpen
                ? "text-gray-900"
                : "text-gray-400 hover:text-gray-900"
            )}
          >
            {menuOpen ? <X className="w-6 h-6" strokeWidth={2.5} /> : <Menu className="w-6 h-6" strokeWidth={2} />}
            <span className={cn("text-[10px] font-medium tracking-tight", menuOpen && "font-semibold")}>Menu</span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-gray-50/95 backdrop-blur-md pt-16 pb-24 px-4 overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-8 px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-lg font-display">M</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight font-display">Madrasah</h2>
                  <p className="text-xs text-gray-500">Workspace</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setMenuOpen(false);
                    useUIStore.getState().setQuickAddOpen(true);
                  }} 
                  className="w-10 h-10 flex items-center justify-center bg-gray-900 text-white rounded-full shadow-sm"
                >
                  <Zap className="w-4 h-4" fill="currentColor" />
                </button>
                <button 
                  onClick={() => {
                    setMenuOpen(false);
                    setSearchOpen(true);
                  }} 
                  className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full text-gray-600 shadow-sm"
                >
                  <Command className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
              <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Semua Modul</span>
              </div>
              <div className="divide-y divide-gray-50">
                {workspaceItems.filter(i => !mainNavItems.includes(i)).map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-4 p-4 transition-colors",
                        isActive
                          ? "bg-gray-50/50"
                          : "hover:bg-gray-50 active:bg-gray-100"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                          isActive ? "bg-gray-100 text-gray-900" : "bg-gray-100 text-gray-500"
                        )}>
                          <item.icon className="w-5 h-5" strokeWidth={2} />
                        </div>
                        <span className={cn("text-base font-medium", isActive ? "text-gray-950" : "text-gray-700")}>{item.name}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Sistem</span>
              </div>
              <div className="divide-y divide-gray-50">
                <NavLink
                  to="/analytics"
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-4 p-4 transition-colors",
                      isActive ? "bg-gray-50/50" : "hover:bg-gray-50 active:bg-gray-100"
                    )
                  }
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center">
                    <BarChart2 className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <span className="text-base font-medium text-gray-700">Analitik</span>
                </NavLink>
                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-4 p-4 transition-colors",
                      isActive ? "bg-gray-50/50" : "hover:bg-gray-50 active:bg-gray-100"
                    )
                  }
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center">
                    <Settings className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <span className="text-base font-medium text-gray-700">Pengaturan</span>
                </NavLink>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
