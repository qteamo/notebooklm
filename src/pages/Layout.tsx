import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from 'lucide-react'
import SidebarComp from '../components/Sidebar'
import MobileSidebar from '../components/MobileSidebar'
import MobileTabs from '../components/MobileTabs'
import { useUIStore } from '../stores'
import { useI18n } from '../i18n'

export default function Layout() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const { t } = useI18n()
  const location = useLocation()

  return (
    <div className="h-dvh w-dvw bg-slate-950 overflow-hidden">
      {/* ======================== DESKTOP ======================== */}
      <div className="hidden lg:flex flex-col h-full w-full overflow-hidden">
        <div className="flex h-full w-full overflow-hidden">
          <div className={`transition-all duration-300 shrink-0 ${sidebarOpen ? 'w-72' : 'w-0'} overflow-hidden`}>
            <SidebarComp />
          </div>
          <main className="flex-1 overflow-hidden flex flex-col">
            <Outlet />
          </main>
        </div>
      </div>

      {/* ======================== MOBILE ======================== */}
      <div className="lg:hidden h-full w-full">
        {/* Content area - leaves room for bottom tabs on KB pages */}
        <div className="h-full overflow-hidden" style={location.pathname.startsWith('/kb/') ? { paddingBottom: '3.5rem' } : undefined}>
          <Outlet />
        </div>
        {/* Fixed bottom tabs - only on KB pages */}
        {location.pathname.startsWith('/kb/') && (
          <div className="fixed bottom-0 inset-x-0 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <MobileTabs />
          </div>
        )}
      </div>
    </div>
  )
}
