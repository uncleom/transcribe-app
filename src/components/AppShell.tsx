import DesktopNav from './DesktopNav'
import BottomNav from './BottomNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen flex-col md:flex-row">
      <DesktopNav />
      <main className="flex flex-1 flex-col overflow-y-auto pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
