'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { logout } from '@/lib/firebase'
import clsx from 'clsx'

const NAV = [
  { href: '/admin',          label: '總覽',    icon: '◈' },
  { href: '/admin/orders',   label: '訂單管理', icon: '◉' },
  { href: '/admin/qa-flags', label: 'QA 審閱', icon: '◎' },
  { href: '/admin/payments', label: '付款確認', icon: '◆' },
  { href: '/admin/literary', label: 'Literary 指派', icon: '◇' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user && pathname !== '/admin/login') {
      router.push('/admin/login')
    }
  }, [user, loading, pathname, router])

  if (pathname === '/admin/login') return <>{children}</>
  if (loading || !user) return (
    <div className="min-h-screen bg-ink flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-ink text-paper flex">
      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-56 bg-ink/95 border-r border-white/10 flex flex-col transition-transform duration-200',
        'md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <span className="font-display font-bold text-base">
            木典 <span className="text-gold">Admin</span>
          </span>
          <button className="md:hidden text-mist" onClick={() => setOpen(false)}>✕</button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                pathname === n.href
                  ? 'bg-gold/20 text-gold font-medium'
                  : 'text-paper/60 hover:bg-white/5 hover:text-paper'
              )}>
              <span className="text-lg leading-none">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-mist truncate mb-2">{user.email}</p>
          <button onClick={() => { logout(); router.push('/admin/login') }}
            className="text-xs text-mist hover:text-coral transition-colors">
            登出
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 md:ml-56 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/90 backdrop-blur px-4 md:px-6 h-12 flex items-center">
          <button className="md:hidden mr-3 text-mist" onClick={() => setOpen(true)}>
            ☰
          </button>
          <p className="text-xs text-mist">
            {NAV.find(n => n.href === pathname)?.label ?? 'Admin Dashboard'}
          </p>
        </header>
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
