'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminListOrders, Order } from '@/lib/api'
import { StatusBadge, TrackBadge, LangLabel } from '@/components/ui/status-badge'
import { Pagination } from '@/components/ui/pagination'
import dayjs from 'dayjs'

export default function QaReviewListPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [total,  setTotal]  = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    setPage(1)
  }, [pageSize])

  useEffect(() => {
    setBusy(true)
    adminListOrders({
      status: 'qa_review',
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then(d => { setOrders(d.orders); setTotal(d.total) })
      .finally(() => setBusy(false))
  }, [page, pageSize])

  return (
    <div className="space-y-4 fade-up">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-paper">待審閱訂單</h1>
        <span className="text-xs text-mist">共 {total} 筆</span>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              {['訂單', '標題', '軌道', '語言', '金額', '建立時間', '操作'].map(h => (
                <th key={h} className="text-left text-xs text-mist px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {busy ? (
              Array(3).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(7).fill(0).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-white/10 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-mist py-12 text-sm">無待審閱訂單</td></tr>
            ) : orders.map(o => (
              <tr key={o.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-mist">{o.id.slice(-8).toUpperCase()}</td>
                <td className="px-4 py-3 text-sm text-paper max-w-[300px] truncate">{o.title || '—'}</td>
                <td className="px-4 py-3"><TrackBadge track={o.track_type} /></td>
                <td className="px-4 py-3 text-xs text-mist whitespace-nowrap">
                  <LangLabel code={o.source_lang} /> → <LangLabel code={o.target_lang} />
                </td>
                <td className="px-4 py-3 text-xs font-medium text-paper">NT${o.price_ntd.toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-mist">{dayjs(o.created_at).format('MM/DD HH:mm')}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${o.id}/review`}
                    className="px-3 py-1 rounded bg-gold text-white text-xs font-bold hover:bg-gold-light transition-colors">
                    開始審閱
                  </Link>
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
