'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminListOrders, adminListQaFlags } from '@/lib/api'

function Icon({ path }: { path: string }) {
  return (
    <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

interface Stat { label: string; value: number | string; href: string; color: string }

const LINKS = [
  {
    href:  '/admin/orders',
    title: '訂單管理',
    desc:  '查看與管理所有翻譯訂單',
    icon:  <Icon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
  },
  {
    href:  '/admin/qa-review',
    title: 'QA 審閱',
    desc:  '處理 must_fix 標記段落',
    icon:  <Icon path="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
  },
  {
    href:  '/admin/payments',
    title: '付款確認',
    desc:  '確認客戶匯款、開立發票',
    icon:  <Icon path="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
  },
  {
    href:  '/admin/literary',
    title: 'Literary 指派',
    desc:  '指派編輯與校對',
    icon:  <Icon path="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
  },
  {
    href:  '/admin/users',
    title: '帳號管理',
    desc:  '管理使用者帳號與權限',
    icon:  <Icon path="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
  },
]

export default function AdminPage() {
  const [stats, setStats] = useState<Stat[]>([])
  const [busy,  setBusy]  = useState(true)

  useEffect(() => {
    Promise.all([
      adminListOrders(),
      adminListOrders({ status: 'pending_payment' }),
      adminListOrders({ status: 'processing' }),
      adminListOrders({ status: 'qa_review' }),
    ]).then(([all, pending, processing, qa_orders]) => {
      setStats([
        { label: '總訂單',      value: all.total,        href: '/admin/orders',   color: 'border-mist' },
        { label: '待付款',      value: pending.total,    href: '/admin/payments', color: 'border-amber-400' },
        { label: '翻譯中',      value: processing.total, href: '/admin/orders',   color: 'border-blue-400' },
        { label: 'QA 待審閱',   value: qa_orders.total,  href: '/admin/qa-review', color: 'border-coral' },
      ])
    }).finally(() => setBusy(false))
  }, [])

  return (
    <div className="space-y-6 fade-up">
      <h1 className="font-display text-xl font-bold text-paper">總覽</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {busy ? Array(4).fill(0).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse h-20" />
        )) : stats.map(s => (
          <Link key={s.label} href={s.href}
            className={`rounded-xl border-l-4 ${s.color} bg-white/5 hover:bg-white/10 p-4 transition-all`}>
            <p className="text-2xl font-bold text-paper">{s.value}</p>
            <p className="text-xs text-mist mt-0.5">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid sm:grid-cols-2 gap-3">
        {LINKS.map(l => (
          <Link key={l.href} href={l.href}
            className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-4 flex items-start gap-3 transition-all">
            <span className="text-gold mt-0.5">{l.icon}</span>
            <div>
              <p className="text-sm font-semibold text-paper">{l.title}</p>
              <p className="text-xs text-mist mt-0.5">{l.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
