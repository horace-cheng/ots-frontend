'use client'
import { useEffect, useState } from 'react'
import { adminListOrders, confirmPayment, Order } from '@/lib/api'
import { LangLabel, TrackBadge } from '@/components/ui/status-badge'
import dayjs from 'dayjs'

export default function AdminPaymentsPage() {
  const [orders,  setOrders]  = useState<Order[]>([])
  const [busy,    setBusy]    = useState(true)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [notes,   setNotes]   = useState<Record<string, string>>({})
  const [saving,  setSaving]  = useState<Record<string, boolean>>({})

  function load() {
    setBusy(true)
    adminListOrders({ status: 'pending_payment' })
      .then(d => setOrders(d.orders))
      .finally(() => setBusy(false))
  }

  useEffect(load, [])

  async function handleConfirm(order: Order) {
    const amt = parseInt(amounts[order.id] || String(order.price_ntd))
    if (!amt) { alert('請輸入確認金額'); return }
    setSaving(s => ({ ...s, [order.id]: true }))
    try {
      await confirmPayment(order.id, amt, notes[order.id])
      setOrders(os => os.filter(o => o.id !== order.id))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '確認失敗')
    } finally { setSaving(s => ({ ...s, [order.id]: false })) }
  }

  return (
    <div className="space-y-4 fade-up">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-paper">付款確認</h1>
        <span className="text-xs text-mist">{orders.length} 筆待確認</span>
      </div>

      <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-300">
        確認前請先核對銀行匯款記錄，確認金額與訂單一致後再按確認。
      </div>

      {busy ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <p className="text-mist text-sm">✓ 無待確認付款</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <div key={o.id} className="rounded-xl border border-amber-400/20 bg-white/5 p-4 space-y-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs font-mono text-mist">{o.id}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <TrackBadge track={o.track_type} />
                    <span className="text-xs text-mist">
                      <LangLabel code={o.source_lang} /> → <LangLabel code={o.target_lang} />
                    </span>
                    <span className="text-xs text-mist">{o.word_count.toLocaleString()} 字</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-paper">NT${o.price_ntd.toLocaleString()}</p>
                  <p className="text-xs text-mist">{dayjs(o.created_at).format('MM/DD HH:mm')}</p>
                </div>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-mist block mb-1">確認金額（NT$）</label>
                  <input type="number"
                    placeholder={String(o.price_ntd)}
                    value={amounts[o.id] ?? ''}
                    onChange={e => setAmounts(a => ({ ...a, [o.id]: e.target.value }))}
                    className="w-full rounded-md bg-white/10 border border-white/10 text-paper text-sm px-3 py-2
                               placeholder:text-mist focus:border-gold focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-mist block mb-1">備注（選填）</label>
                  <input type="text"
                    placeholder="匯款時間、銀行後4碼…"
                    value={notes[o.id] ?? ''}
                    onChange={e => setNotes(n => ({ ...n, [o.id]: e.target.value }))}
                    className="w-full rounded-md bg-white/10 border border-white/10 text-paper text-sm px-3 py-2
                               placeholder:text-mist focus:border-gold focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => handleConfirm(o)}
                  disabled={saving[o.id]}
                  className="shrink-0 px-5 py-2 rounded-md bg-gold text-white text-sm font-medium
                             hover:bg-gold-dark disabled:opacity-40 transition-colors">
                  {saving[o.id] ? '…' : '確認付款'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
