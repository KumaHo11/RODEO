import type { Metadata } from 'next'
import AdminSidebar from './components/AdminSidebar'
import AdminHeader from './components/AdminHeader'

export const metadata: Metadata = {
  title: 'RODEO Admin Panel',
  description: 'Panel de control Super Admin — RODEO AgTech Platform',
  robots: 'noindex, nofollow',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        <AdminHeader />
        <main className="flex-1 p-5 lg:p-7 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
