import { useEffect } from "react"
import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { MobileNav } from "./MobileNav"
import { CommandPalette } from "./CommandPalette"
import { OnboardingTour } from "./OnboardingTour"
import { QuickAddDialog } from "./QuickAddDialog"
import { HijriClock } from "./HijriClock"
import { ShortcutGuide } from "./ShortcutGuide"
import { AboutDialog } from "./AboutDialog"
import { Search } from "lucide-react"
import { useUIStore } from "../../store/uiStore"
import { Toaster } from "../ui/Toaster"
import { OfflineIndicator } from "../OfflineIndicator"

export function MainLayout() {
  const searchOpen = useUIStore(state => state.searchOpen)
  const setSearchOpen = useUIStore(state => state.setSearchOpen)
  const shortcutGuideOpen = useUIStore(state => state.shortcutGuideOpen)
  const setShortcutGuideOpen = useUIStore(state => state.setShortcutGuideOpen)
  const setQuickAddOpen = useUIStore(state => state.setQuickAddOpen)
  const setAboutOpen = useUIStore(state => state.setAboutOpen)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Cmd+K
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen(!searchOpen)
      }

      // Cmd+Shift+I for Quick Add
      if (e.key === "I" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        setQuickAddOpen(true)
      }
      
      // Shift + ? (which is e.key === "?")
      if (e.key === "?" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault()
        setShortcutGuideOpen(!shortcutGuideOpen)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [searchOpen, setSearchOpen, shortcutGuideOpen, setShortcutGuideOpen, setQuickAddOpen])

  return (
    <div className="flex min-h-screen bg-gray-50/50 text-gray-900 font-sans flex-col md:flex-row w-full overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 w-full min-w-0 overflow-y-auto overflow-x-hidden pb-20 md:pb-0 flex flex-col">
        {/* Mobile Header */}
        <div className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 px-3.5 py-2 flex items-center justify-between gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="flex items-center gap-2.5 cursor-pointer group shrink-0 min-h-[44px] pr-2 text-left"
          >
            <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center shadow-sm group-active:scale-95 transition-transform">
              <span className="text-white font-bold text-sm font-display">M</span>
            </div>
            <span className="font-semibold text-base tracking-tight font-display text-gray-900">Madrasah</span>
          </button>
          <div className="flex items-center gap-1.5 min-w-0 shrink">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-gray-900 active:bg-gray-100 rounded-xl shrink-0 transition-colors"
              aria-label="Cari cepat"
            >
              <Search className="w-4 h-4" />
            </button>
            <HijriClock mobileCompact={true} />
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-gray-100 px-6 lg:px-8 py-3 items-center justify-end">
          <HijriClock />
        </div>

        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 min-w-0 flex-1">
          <Outlet />
        </div>
      </main>
      <MobileNav />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <OnboardingTour />
      <QuickAddDialog />
      <ShortcutGuide />
      <AboutDialog />
      <Toaster />
      <OfflineIndicator />
    </div>
  )
}
