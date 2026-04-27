'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { listOrders, Order } from '@/lib/api'
import { PortalHeader } from '@/components/portal/header'
import { StatusBadge, TrackBadge, LangLabel } from '@/components/ui/status-badge'
import dayjs from 'dayjs'

export default function OrdersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [total,  setTotal]  = useState(0)
  const [busy,   setBusy]   = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    setBusy(true)
    listOrders(filter ? { status: filter } : undefined)
      .then(d => { setOrders(d.orders); setTotal(d.total) })
      .finally(() => setBusy(false))
  }, [user, filter])

  const FILTERS = [
    { value: '', label: '全部' },
    { value: 'pending_payment', label: '待付款' },
    { value: 'processing',      label: '翻譯中' },
    { value: 'delivered',       label: '已交付' },
  ]

  if (loading) return null

  return (
    <div className="min-h-screen bg-paper bg-paper-texture">
      <PortalHeader />
      <div className="mx-auto max-w-4xl px-4 pt-10 pb-16 fade-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">我的訂單</h1>
            <p className="text-sm text-mist mt-0.5">共 {total} 筆</p>
          </div>
          <Link href="/" className="btn-gold py-2 text-xs">＋ 新增訂單</Link>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                filter === f.value
                  ? 'bg-ink text-paper border-ink'
                  : 'border-ink/20 text-ink/60 hover:border-ink/40'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {busy ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-mist mb-4">尚無訂單</p>
            <Link href="/" className="btn-gold py-2 text-sm">立即下單</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => (
              <Link key={o.id} href={`/orders/${o.id}`}
                className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <StatusBadge status={o.status} />
                    <TrackBadge track={o.track_type} />
                    <span className="text-xs text-mist">
                      <LangLabel code={o.source_lang} /> → <LangLabel code={o.target_lang} />
                    </span>
                  </div>
                  <p className="text-xs text-mist font-mono truncate">{o.id}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-ink">NT${o.price_ntd.toLocaleString()}</p>
                  <p className="text-xs text-mist">{dayjs(o.created_at).format('MM/DD HH:mm')}</p>
                </div>
                <svg className="w-4 h-4 text-mist shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
