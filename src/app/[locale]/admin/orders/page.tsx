'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminListOrders, Order } from '@/lib/api'
import { StatusBadge, TrackBadge, LangLabel } from '@/components/ui/status-badge'
import { Pagination } from '@/components/ui/pagination'
import dayjs from 'dayjs'

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState('')
  const [track, setTrack] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [busy, setBusy] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setPage(1)
  }, [filter, track, pageSize])

  useEffect(() => {
    setBusy(true)
    adminListOrders({
      ...(filter ? { status: filter } : {}),
      ...(track ? { track_type: track } : {}),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }).then(d => { setOrders(d.orders); setTotal(d.total) })
      .finally(() => setBusy(false))
  }, [filter, track, page, pageSize, tick])

  const STATUS_FILTERS = [
    { v: '', l: '全部' },
    { v: 'pending_payment', l: '待付款' },
    { v: 'paid', l: '已付款' },
    { v: 'processing', l: '翻譯中' },
    { v: 'qa_review', l: 'QA 審閱' },
    { v: 'delivered', l: '已交付' },
  ]

  return (
    <div className="space-y-4 fade-up">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-paper">訂單管理</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-mist">共 {total} 筆</span>
          <button onClick={() => setTick(t => t + 1)} disabled={busy}
            className="p-1.5 rounded-lg border border-white/10 text-mist hover:text-paper hover:border-white/30 disabled:opacity-40 transition-colors">
            <svg className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`px-3 py-1 rounded-full text-xs border transition-all ${filter === f.v ? 'bg-gold border-gold text-white' : 'border-white/20 text-mist hover:border-white/40'
              }`}>
            {f.l}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {['', 'fast', 'literary'].map((t, i) => (
            <button key={t} onClick={() => setTrack(t)}
              className={`px-3 py-1 rounded-full text-xs border transition-all ${track === t ? 'bg-white/20 border-white/40 text-paper' : 'border-white/10 text-mist hover:border-white/20'
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
              {['訂單', '標題', '軌道', '語言', '金額', '狀態', '建立時間', '操作'].map(h => (
                <th key={h} className="text-left text-sm text-mist px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {busy ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(8).fill(0).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-white/10 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-mist py-12 text-sm">無訂單</td></tr>
            ) : orders.map(o => (
              <tr key={o.id} className="hover:bg-white/5 transition-colors">
                 <td className="px-4 py-3 font-mono text-sm text-mist">{o.id.slice(-8).toUpperCase()}</td>
                <td className="px-4 py-3 text-sm text-paper max-w-[200px] truncate">{o.title || '—'}</td>
                <td className="px-4 py-3"><TrackBadge track={o.track_type} /></td>
                <td className="px-4 py-3 text-sm text-mist whitespace-nowrap">
                  <LangLabel code={o.source_lang} /> → <LangLabel code={o.target_lang} />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-paper">NT${o.price_ntd.toLocaleString()}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 text-sm text-mist">{dayjs(o.created_at).format('MM/DD HH:mm')}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/orders/${o.id}`}
                      className="text-sm px-2 py-0.5 rounded border border-white/10 text-mist hover:text-paper hover:border-white/30 transition-colors">
                      詳情
                    </Link>
                    {(o.status === 'qa_review' || o.status === 'delivered') && (
                      <Link href={`/admin/orders/${o.id}/review`}
                        className="text-sm text-paper bg-gold/20 px-2 py-0.5 rounded hover:bg-gold/30 transition-colors">
                        QA 審閱
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        total={total}
        pageSize={pageSize}
        currentPage={page}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        theme="dark"
      />
    </div>
  )
}
