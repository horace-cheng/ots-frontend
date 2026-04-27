'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminListOrders, adminListQaFlags } from '@/lib/api'

interface Stat { label: string; value: number | string; href: string; color: string }

export default function AdminPage() {
  const [stats, setStats] = useState<Stat[]>([])
  const [busy,  setBusy]  = useState(true)

  useEffect(() => {
    Promise.all([
      adminListOrders(),
      adminListOrders({ status: 'pending_payment' }),
      adminListOrders({ status: 'processing' }),
      adminListQaFlags({ flag_level: 'must_fix', resolved: false }),
    ]).then(([all, pending, processing, flags]) => {
      setStats([
        { label: '總訂單',    value: all.total,        href: '/admin/orders',   color: 'border-mist' },
        { label: '待付款',    value: pending.total,    href: '/admin/payments', color: 'border-amber-400' },
        { label: '翻譯中',    value: processing.total, href: '/admin/orders',   color: 'border-blue-400' },
        { label: 'Must Fix QA', value: flags.length,   href: '/admin/qa-flags', color: 'border-coral' },
      ])
    }).finally(() => setBusy(false))
  }, [])

  const LINKS = [
    { href: '/admin/orders',   title: '訂單管理',    desc: '查看與管理所有翻譯訂單',    icon: '◉' },
    { href: '/admin/qa-flags', title: 'QA 審閱',     desc: '處理 must_fix 標記段落',   icon: '◎' },
    { href: '/admin/payments', title: '付款確認',    desc: '確認客戶匯款、開立發票',    icon: '◆' },
    { href: '/admin/literary', title: 'Literary 指派', desc: '指派編輯與校對',          icon: '◇' },
  ]

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
            <span className="text-2xl text-gold leading-none mt-0.5">{l.icon}</span>
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
