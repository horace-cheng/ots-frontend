'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { logout } from '@/lib/firebase'
import clsx from 'clsx'
import { getMe } from '@/lib/api'

function Icon({ path, path2 }: { path: string; path2?: string }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      {path2 && <path strokeLinecap="round" strokeLinejoin="round" d={path2} />}
    </svg>
  )
}

const NAV = [
  {
    href: '/admin',
    label: '總覽',
    icon: <Icon path="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  },
  {
    href: '/admin/orders',
    label: '訂單管理',
    icon: <Icon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
  },
  {
    href: '/admin/qa-review',
    label: 'QA 審閱',
    icon: <Icon path="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
  },
  {
    href: '/admin/payments',
    label: '付款確認',
    icon: <Icon path="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
  },
  {
    href: '/admin/users',
    label: '帳號管理',
    icon: <Icon path="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
  },
  {
    href: '/admin/languages',
    label: '語言設定',
    icon: <Icon path="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 15h4.498m-4.498 0L15 11l2.249 4m-4.498 0L11 21" />,
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [open, setOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== '/admin/login') {
        router.push('/admin/login')
      } else if (user && pathname !== '/admin/login') {
        getMe().then(me => {
          if (!me.is_admin) {
            alert('您沒有 Admin 權限')
            router.push('/')
          } else {
            setChecking(false)
          }
        }).catch(() => {
          router.push('/admin/login')
        })
      } else {
        setChecking(false)
      }
    }
  }, [user, loading, pathname, router])

  if (pathname === '/admin/login') return <>{children}</>
  if (loading || checking || !user) return (
    <div className="min-h-screen bg-ink flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-ink text-paper flex">
      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 bg-ink/95 border-r border-white/10 flex flex-col transition-all duration-200',
        sidebarOpen ? 'w-56' : 'w-16',
        'md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        <div className={clsx(
          'flex items-center border-b border-white/10 h-12',
          sidebarOpen ? 'justify-between px-5' : 'justify-center px-2'
        )}>
          {sidebarOpen ? (
            <>
              <span className="font-display font-bold text-base">
                木典 <span className="text-gold">Admin</span>
              </span>
              <div className="flex items-center gap-1">
                <button className="md:hidden text-mist hover:text-paper transition-colors" onClick={() => setOpen(false)} title="關閉選單">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button className="hidden md:block text-mist hover:text-paper transition-colors" onClick={() => setSidebarOpen(false)} title="收合側欄">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <button className="text-mist hover:text-paper transition-colors" onClick={() => setSidebarOpen(true)} title="展開側欄">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        <nav className={clsx('flex-1 py-4 space-y-1', sidebarOpen ? 'px-3' : 'px-1.5')}>
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center rounded-lg text-sm transition-all',
                sidebarOpen ? 'gap-3 px-3 py-2' : 'justify-center px-1 py-3',
                pathname === n.href
                    ? 'bg-gold/20 text-gold font-medium'
                    : 'text-paper/60 hover:bg-white/5 hover:text-paper'
              )}>
              {n.icon}
              {sidebarOpen && n.label}
            </Link>
          ))}
        </nav>

        <div className={clsx('border-t border-white/10', sidebarOpen ? 'p-4' : 'p-2 flex flex-col items-center')}>
          {sidebarOpen ? (
            <>
              <p className="text-xs text-mist truncate mb-2">{user.email}</p>
              <button onClick={() => { logout(); router.push('/admin/login') }}
                className="text-xs text-mist hover:text-coral transition-colors">
                登出
              </button>
            </>
          ) : (
            <button onClick={() => { logout(); router.push('/admin/login') }}
              className="text-mist hover:text-coral transition-colors p-1" title="登出">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main content */}
      <div className={clsx('flex-1 flex flex-col min-h-screen transition-all duration-200', sidebarOpen ? 'md:ml-56' : 'md:ml-16')}>
        <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/90 backdrop-blur px-4 md:px-6 h-12 flex items-center gap-3">
          <button className="md:hidden text-mist" onClick={() => setOpen(true)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button className="hidden md:block text-mist hover:text-paper transition-colors" onClick={() => setSidebarOpen(o => !o)} title="切換側欄">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d={sidebarOpen ? "M11 19l-7-7 7-7m8 14l-7-7 7-7" : "M13 5l7 7-7 7M5 5l7 7-7 7"} />
            </svg>
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
