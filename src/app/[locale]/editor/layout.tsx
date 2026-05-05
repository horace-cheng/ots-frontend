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

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(true)
  const [isEditor, setIsEditor] = useState(false)

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login')
      } else {
        getMe().then(me => {
          if (!me.is_editor && !me.is_qa && !me.is_admin) {
            alert('您沒有 Editor 或 QA 權限')
            router.push('/')
          } else {
            setIsEditor(me.is_editor || me.is_admin)
            setChecking(false)
          }
        }).catch(() => {
          router.push('/')
        })
      }
    }
  }, [user, loading, router])

  const NAV = [
    {
      href: '/editor/orders',
      label: '待審閱訂單',
      icon: <Icon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
    },
    ...(isEditor ? [{
      href: '/editor/team',
      label: '我的團隊',
      icon: <Icon path="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
    }] : []),
  ]

  if (loading || checking) return (
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
            木典 <span className="text-gold">Editor</span>
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
              {n.icon}
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-mist truncate mb-2">{user?.email}</p>
          <button onClick={() => { logout(); router.push('/login') }}
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
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <p className="text-xs text-mist">
            {NAV.find(n => n.href === pathname)?.label ?? 'Editor Dashboard'}
          </p>
        </header>
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
