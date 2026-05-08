'use client'
import { useEffect, useState, ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { getOrder, getDownloadUrl, cancelOrder, updateOrder, Order } from '@/lib/api'
import { PortalHeader } from '@/components/portal/header'
import { StatusBadge, TrackBadge, LangLabel } from '@/components/ui/status-badge'
import dayjs from 'dayjs'

const STEPS = [
  { key: 'pending_payment', label: '等待付款' },
  { key: 'paid',            label: '付款確認' },
  { key: 'processing',      label: '翻譯進行中' },
  { key: 'qa_review',       label: 'QA 審閱' },
  { key: 'editor_verify',   label: '編輯審閱' },
  { key: 'delivered',       label: '翻譯完成' },
]

const LT_STEPS = [
  { key: 'awaiting_quote',  label: '等待報價' },
  { key: 'quoted',          label: '已報價' },
  { key: 'pending_payment', label: '等待付款' },
  { key: 'paid',            label: '付款確認' },
  { key: 'processing',      label: '翻譯進行中' },
  { key: 'qa_review',       label: 'QA 審閱' },
  { key: 'editor_verify',   label: '編輯審閱' },
  { key: 'delivered',       label: '翻譯完成' },
]

function ProgressBar({ status, steps }: { status: string; steps?: typeof STEPS }) {
  const s = steps || STEPS
  const idx = s.findIndex(s => s.key === status)
  const current = idx === -1 ? 0 : idx

  return (
    <div className="relative py-4">
      {/* line */}
      <div className="absolute top-[2.15rem] left-0 right-0 h-0.5 bg-ink/10" />
      <div
        className="absolute top-[2.15rem] left-0 h-0.5 bg-gold transition-all duration-700"
        style={{ width: `${(current / (s.length - 1)) * 100}%` }}
      />
      <div className="relative flex justify-between">
        {s.map((step, i) => (
          <div key={step.key} className="flex flex-col items-center gap-1 w-16">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 transition-all ${
              i < current  ? 'bg-gold border-gold' :
              i === current ? 'bg-white border-gold ring-2 ring-gold/30' :
              'bg-white border-ink/20'
            }`}>
              {i < current && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`text-center text-[10px] leading-tight ${i <= current ? 'text-ink' : 'text-mist'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, loading } = useAuth()
  const router = useRouter()

  const [order,        setOrder]        = useState<Order | null>(null)
  const [downloadUrl,  setDownloadUrl]  = useState('')
  const [busy,         setBusy]         = useState(true)
  const [cancelling,   setCancelling]   = useState(false)
  const [error,        setError]        = useState('')
  const [tick,         setTick]         = useState(0)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitle,    setEditTitle]    = useState('')
  const [savingTitle,  setSavingTitle]  = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user || !id) return
    setBusy(true)
    setError('')
    getOrder(id).then(o => {
      setOrder(o)
      if (o.status === 'delivered') {
        getDownloadUrl(id).then(r => setDownloadUrl(r.signed_url)).catch(() => {})
      }
    }).catch(() => setError('找不到此訂單')).finally(() => setBusy(false))
  }, [user, id, tick])

  async function handleCancel() {
    if (!confirm('確定要取消訂單？')) return
    setCancelling(true)
    try {
      await cancelOrder(id)
      setOrder(o => o ? { ...o, status: 'cancelled' } : o)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '取消失敗')
    } finally { setCancelling(false) }
  }

  async function handleSaveTitle() {
    const trimmed = editTitle.trim()
    if (trimmed === (order?.title || '').trim()) {
      setEditingTitle(false)
      return
    }
    setSavingTitle(true)
    try {
      const updated = await updateOrder(id, { title: trimmed || undefined })
      setOrder(updated)
      setEditingTitle(false)
    } catch (e: any) {
      alert(e.message || '更新標題失敗')
    } finally {
      setSavingTitle(false)
    }
  }

  if (loading || busy) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
    </div>
  )

  if (error || !order) return (
    <div className="min-h-screen bg-paper bg-paper-texture">
      <PortalHeader />
      <div className="mx-auto max-w-xl px-4 pt-20 text-center">
        <p className="text-mist mb-4">{error || '找不到此訂單'}</p>
        <Link href="/orders" className="btn-ghost text-sm">返回訂單列表</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper bg-paper-texture">
      <PortalHeader />
      <div className="mx-auto max-w-2xl px-4 pt-10 pb-16 fade-up">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <Link href="/orders" className="text-xs text-mist hover:text-gold transition-colors">
              ← 我的訂單
            </Link>
            {editingTitle ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  maxLength={50}
                  autoFocus
                  className="font-display text-2xl font-bold text-ink bg-white border border-ink/20 rounded-lg px-3 py-1 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 w-80"
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                />
                <button onClick={handleSaveTitle} disabled={savingTitle}
                  className="px-3 py-1.5 rounded-lg bg-gold text-sm font-bold text-night hover:bg-gold-light transition-all disabled:opacity-40">
                  {savingTitle ? '儲存中…' : '儲存'}
                </button>
                <button onClick={() => setEditingTitle(false)}
                  className="px-3 py-1.5 rounded-lg border border-ink/20 text-sm text-mist hover:text-ink transition-all">
                  取消
                </button>
              </div>
            ) : (
              <h1 className="font-display text-2xl font-bold text-ink mt-1 group flex items-center gap-2">
                {order.title || '訂單詳情'}
                {!['delivered', 'cancelled'].includes(order.status) && (
                  <button onClick={() => { setEditTitle(order.title || ''); setEditingTitle(true) }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-ink/5 text-mist hover:text-ink transition-all">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </h1>
            )}
            <p className="text-xs text-mist font-mono mt-0.5">{order.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTick(t => t + 1)} disabled={busy}
              className="p-2 rounded-lg border border-ink/20 text-mist hover:text-ink hover:border-ink/40 disabled:opacity-40 transition-colors">
              <svg className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <StatusBadge status={order.status} />
          </div>
        </div>

        {/* Progress */}
        {order.status !== 'cancelled' && (
          <div className="card mb-4">
            <ProgressBar status={order.status} steps={order.track_type === 'literary' ? LT_STEPS : STEPS} />
          </div>
        )}

        {/* Delivered CTA */}
        {order.status === 'delivered' && downloadUrl && (
          <div className="card bg-green-50 border-green-200 mb-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-800 text-sm">翻譯已完成！</p>
              <p className="text-xs text-green-600">下載連結有效 1 小時</p>
            </div>
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="btn-primary bg-green-700 text-sm py-2">
              下載譯文
            </a>
          </div>
        )}

        {/* Payment Info for pending */}
        {order.status === 'pending_payment' && (
          <div className="card bg-amber-50 border-amber-200 mb-4">
            <p className="font-semibold text-amber-800 text-sm mb-2">請完成付款</p>
            <p className="text-xs text-amber-700">玉山銀行（808）信義分行</p>
            <p className="text-xs text-amber-700">匯款金額：NT${order.price_ntd.toLocaleString()}</p>
            <p className="text-xs text-amber-700 mt-1">備註欄請填：{order.id.slice(-8).toUpperCase()}</p>
            <p className="text-xs text-amber-500 mt-2">確認收款後將於 1 個工作天內回覆並開始翻譯</p>
          </div>
        )}

        {/* Awaiting Quote */}
        {order.status === 'awaiting_quote' && order.track_type === 'literary' && (
          <div className="card bg-purple-50 border-purple-200 mb-4">
            <p className="font-semibold text-purple-800 text-sm mb-2">等待報價中</p>
            <p className="text-xs text-purple-700">您的稿件正在審核中，管理員將根據字數與內容複雜度提供報價。</p>
            <p className="text-xs text-purple-500 mt-2">預估 1-2 個工作天內完成報價</p>
          </div>
        )}

        {/* Quoted — waiting for customer to pay */}
        {order.status === 'quoted' && order.track_type === 'literary' && (
          <div className="card bg-amber-50 border-amber-200 mb-4">
            <p className="font-semibold text-amber-800 text-sm mb-2">報價已出，請完成付款</p>
            <p className="text-lg font-bold text-amber-900">NT${order.quoted_price?.toLocaleString() ?? order.price_ntd.toLocaleString()}</p>
            <p className="text-xs text-amber-700 mt-2">玉山銀行（808）信義分行</p>
            <p className="text-xs text-amber-700">匯款金額：NT${order.quoted_price?.toLocaleString() ?? order.price_ntd.toLocaleString()}</p>
            <p className="text-xs text-amber-700 mt-1">備註欄請填：{order.id.slice(-8).toUpperCase()}</p>
            {order.quoted_at && (
              <p className="text-xs text-amber-500 mt-2">報價時間：{dayjs(order.quoted_at).format('YYYY/MM/DD HH:mm')}</p>
            )}
            <p className="text-xs text-amber-500">確認收款後將於 1 個工作天內開始翻譯</p>
          </div>
        )}

        {/* Order info */}
        <div className="card space-y-3">
          {[
            ['翻譯軌道', <TrackBadge key="t" track={order.track_type} />],
            ['語言方向', <span key="l" className="text-sm"><LangLabel code={order.source_lang} /> → <LangLabel code={order.target_lang} /></span>],
            ['字數',     <span key="w" className="text-sm">{order.word_count.toLocaleString()} 字</span>],
            ...(order.track_type === 'literary' && order.reference_price ? [
              ['參考金額', <span key="rp" className="text-sm text-mist">NT${order.reference_price.toLocaleString()}</span>]
            ] as [string, ReactNode][] : []),
            ['金額',     <span key="p" className="text-sm font-semibold">NT${(order.quoted_price || order.price_ntd).toLocaleString()}</span>],
            ['付款狀態', <span key="ps" className="text-sm">{order.payment_status === 'paid' ? '已付款' : '待付款'}</span>],
            ['建立時間', <span key="c" className="text-sm">{dayjs(order.created_at).format('YYYY/MM/DD HH:mm')}</span>],
            ...(order.deadline_at ? [['截止時間', <span key="d" className="text-sm">{dayjs(order.deadline_at).format('YYYY/MM/DD HH:mm')}</span>]] : []),
            ...(order.delivered_at ? [['交付時間', <span key="da" className="text-sm text-green-700">{dayjs(order.delivered_at).format('YYYY/MM/DD HH:mm')}</span>]] : []),
            ...(order.invoice_no ? [['發票號碼', <span key="inv" className="text-sm font-mono">{order.invoice_no}</span>]] : []),
            ...(order.notes ? [['備註', <span key="n" className="text-sm text-mist">{order.notes}</span>]] : []),
          ].map(([label, value], i) => (
            <div key={i} className="flex items-center justify-between py-1 border-b border-ink/5 last:border-0">
              <span className="text-xs text-mist w-24 shrink-0">{label}</span>
              {value}
            </div>
          ))}
        </div>

        {/* Cancel */}
        {['pending_payment', 'awaiting_quote', 'quoted'].includes(order.status) && (
          <div className="mt-4 text-center">
            <button onClick={handleCancel} disabled={cancelling}
              className="text-xs text-coral hover:underline disabled:opacity-40">
              {cancelling ? '取消中…' : '取消此訂單'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
