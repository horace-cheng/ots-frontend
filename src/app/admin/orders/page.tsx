'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminListOrders, Order } from '@/lib/api'
import { StatusBadge, TrackBadge, LangLabel } from '@/components/ui/status-badge'
import dayjs from 'dayjs'

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [total,  setTotal]  = useState(0)
  const [filter, setFilter] = useState('')
  const [track,  setTrack]  = useState('')
  const [busy,   setBusy]   = useState(true)

  useEffect(() => {
    setBusy(true)
    adminListOrders({
      ...(filter ? { status: filter } : {}),
      ...(track  ? { track_type: track } : {}),
    }).then(d => { setOrders(d.orders); setTotal(d.total) })
      .finally(() => setBusy(false))
  }, [filter, track])

  const STATUS_FILTERS = [
    { v: '', l: '全部' },
    { v: 'pending_payment', l: '待付款' },
    { v: 'paid',            l: '已付款' },
    { v: 'processing',      l: '翻譯中' },
    { v: 'qa_review',       l: 'QA 審閱' },
    { v: 'delivered',       l: '已交付' },
  ]

  return (
    <div className="space-y-4 fade-up">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-paper">訂單管理</h1>
        <span className="text-xs text-mist">共 {total} 筆</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`px-3 py-1 rounded-full text-xs border transition-all ${
              filter === f.v ? 'bg-gold border-gold text-white' : 'border-white/20 text-mist hover:border-white/40'
            }`}>
            {f.l}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {['', 'fast', 'literary'].map((t, i) => (
            <button key={t} onClick={() => setTrack(t)}
              className={`px-3 py-1 rounded-full text-xs border transition-all ${
                track === t ? 'bg-white/20 border-white/40 text-paper' : 'border-white/10 text-mist hover:border-white/20'
              }`}>
              {['全部', 'Fast', 'Literary'][i]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              {['訂單', '軌道', '語言', '金額', '狀態', '建立時間', '操作'].map(h => (
                <th key={h} className="text-left text-xs text-mist px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {busy ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(7).fill(0).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-white/10 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-mist py-12 text-sm">無訂單</td></tr>
            ) : orders.map(o => (
              <tr key={o.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-mist">{o.id.slice(-8).toUpperCase()}</td>
                <td className="px-4 py-3"><TrackBadge track={o.track_type} /></td>
                <td className="px-4 py-3 text-xs text-mist whitespace-nowrap">
                  <LangLabel code={o.source_lang} /> → <LangLabel code={o.target_lang} />
                </td>
                <td className="px-4 py-3 text-xs font-medium text-paper">NT${o.price_ntd.toLocaleString()}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 text-xs text-mist">{dayjs(o.created_at).format('MM/DD HH:mm')}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${o.id}`}
                    className="text-xs text-gold hover:underline">
                    詳情
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
