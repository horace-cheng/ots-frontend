'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  adminGetOrder, adminGetDownloadUrl, confirmPayment, markDelivered, adminListQaFlags,
  adminUpdateOrderStatus, adminListUsers, adminAssignEditor,
  Order, QAFlag, QAResult, UserAccount
} from '@/lib/api'
import { StatusBadge, TrackBadge, LangLabel } from '@/components/ui/status-badge'
import dayjs from 'dayjs'

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 75 ? 'text-green-400' : score >= 55 ? 'text-amber-400' : 'text-coral'
  return <span className={`font-bold ${cls}`}>{score.toFixed(1)}</span>
}

function QAScorePanel({ qa }: { qa: QAResult }) {
  const layers = [
    {
      label: '結構驗證',
      pass:  qa.layer1_structure?.pass,
      detail: qa.layer1_structure
        ? `長度比例 ${qa.layer1_structure.overall_ratio.toFixed(2)}，${qa.layer1_structure.flags} 個標記`
        : null,
    },
    {
      label: '語意保留',
      pass:  qa.layer2_semantic?.pass,
      detail: qa.layer2_semantic
        ? <>平均分 <ScoreBadge score={qa.layer2_semantic.avg_score} />，抽樣 {qa.layer2_semantic.sampled} 段</>
        : null,
    },
    {
      label: '術語一致性',
      pass:  qa.layer3_terminology?.pass,
      detail: qa.layer3_terminology
        ? `${qa.layer3_terminology.terms_checked} 個術語，${qa.layer3_terminology.flags} 個標記`
        : null,
    },
    {
      label: 'LLM 可讀性',
      pass:  qa.layer4_llm_judge?.pass,
      detail: qa.layer4_llm_judge
        ? <>平均分 <ScoreBadge score={qa.layer4_llm_judge.score} />，{qa.layer4_llm_judge.flags} 個標記</>
        : null,
    },
  ]

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <h2 className="text-base font-semibold text-paper">QA 評分</h2>
      <div className="grid sm:grid-cols-2 gap-2">
        {layers.map(l => (
          <div key={l.label} className="rounded-lg bg-white/5 px-3 py-2.5 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${l.pass ? 'bg-green-400' : 'bg-coral'}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-paper">{l.label}</p>
              {l.detail && <p className="text-xs text-mist mt-0.5">{l.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [order,       setOrder]       = useState<(Order & { qa_result?: QAResult }) | null>(null)
  const [qaFlags,     setQaFlags]     = useState<QAFlag[]>([])
  const [busy,        setBusy]        = useState(true)
  const [error,       setError]       = useState('')
  const [tick,        setTick]        = useState(0)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [editors,     setEditors]     = useState<UserAccount[]>([])
  const [assigning,   setAssigning]   = useState(false)

  async function handleUpdateStatus(newStatus: string) {
    if (!confirm(`確定將訂單狀態改為 ${newStatus}？`)) return
    try {
      await adminUpdateOrderStatus(id, newStatus)
      setTick(t => t + 1)
    } catch (e: any) {
      alert(e.message)
    }
  }

  // confirm payment
  const [payAmount,   setPayAmount]   = useState('')
  const [payNote,     setPayNote]     = useState('')
  const [payBusy,     setPayBusy]     = useState(false)

  // mark delivered
  const [gcsPath,     setGcsPath]     = useState('')
  const [deliverBusy, setDeliverBusy] = useState(false)

  useEffect(() => {
    setBusy(true)
    setError('')
    setDownloadUrl('')
    Promise.all([
      adminGetOrder(id),
      adminListQaFlags({ order_id: id }),
    ]).then(([o, flags]) => {
      setOrder(o)
      setGcsPath(o.gcs_output_path ?? '')
      setQaFlags(flags.flags)
      if (o.gcs_output_path) {
        adminGetDownloadUrl(id).then(r => setDownloadUrl(r.signed_url)).catch(() => {})
      }
    }).catch(e => setError(e.message)).finally(() => setBusy(false))

    // 獨立獲取 Editor 列表用於指派
    adminListUsers().then(d => {
      setEditors(d.users.filter(u => u.is_editor))
    }).catch(() => {})
  }, [id, tick])


  async function handleAssignEditor(editorId: string) {
    setAssigning(true)
    try {
      await adminAssignEditor(id, editorId || null)
      setOrder(o => o ? { ...o, editor_id: editorId || undefined } : o)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setAssigning(false)
    }
  }

  async function handleConfirmPayment() {
    const amount = Number(payAmount)
    if (!amount) { alert('請輸入金額'); return }
    setPayBusy(true)
    try {
      await confirmPayment(id, amount, payNote || undefined)
      setOrder(o => o ? { ...o, status: 'paid', payment_status: 'paid' } : o)
      setPayAmount(''); setPayNote('')
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '確認付款失敗')
    } finally { setPayBusy(false) }
  }

  async function handleDeliver() {
    if (!gcsPath.trim()) { alert('請輸入 GCS 路徑'); return }
    if (!confirm('確定標記此訂單為已交付？')) return
    setDeliverBusy(true)
    try {
      await markDelivered(id, gcsPath.trim())
      setOrder(o => o ? { ...o, status: 'delivered', gcs_output_path: gcsPath.trim() } : o)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '交付失敗')
    } finally { setDeliverBusy(false) }
  }

  if (busy) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
    </div>
  )

  if (error || !order) return (
    <div className="space-y-4 fade-up">
      <Link href="/admin/orders" className="text-sm text-mist hover:text-gold">← 訂單列表</Link>
      <p className="text-coral text-base">{error || '找不到此訂單'}</p>
    </div>
  )

  const rows: [string, React.ReactNode][] = [
    ['訂單 ID',   <span key="id" className="text-xs font-mono text-mist">{order.id}</span>],
    ['標題',      <span key="ti" className="text-base">{order.title || '—'}</span>],
    ['軌道',      <TrackBadge key="tr" track={order.track_type} />],
    ['語言',      <span key="l" className="text-base"><LangLabel code={order.source_lang} /> → <LangLabel code={order.target_lang} /></span>],
    ['字數',      <span key="w" className="text-base">{order.word_count.toLocaleString()}</span>],
    ['金額',      <span key="p" className="text-base font-semibold">NT${order.price_ntd.toLocaleString()}</span>],
    ['付款狀態',  <span key="ps" className="text-base">{order.payment_status === 'paid' ? '已付款' : '待付款'}</span>],
    ['建立時間',  <span key="c" className="text-base">{dayjs(order.created_at).format('YYYY/MM/DD HH:mm')}</span>],
    ...(order.deadline_at  ? [['截止時間', <span key="d"  className="text-base">{dayjs(order.deadline_at).format('YYYY/MM/DD HH:mm')}</span>]] as [string, React.ReactNode][] : []),
    ...(order.delivered_at ? [['交付時間', <span key="da" className="text-base text-green-400">{dayjs(order.delivered_at).format('YYYY/MM/DD HH:mm')}</span>]] as [string, React.ReactNode][] : []),
    ...(order.invoice_no   ? [['發票號碼', <span key="inv" className="text-base font-mono">{order.invoice_no}</span>]] as [string, React.ReactNode][] : []),
    ...(order.notes        ? [['備註',     <span key="n"  className="text-base text-mist">{order.notes}</span>]] as [string, React.ReactNode][] : []),
    ...(order.gcs_output_path ? [['輸出路徑', <span key="gcs" className="text-xs font-mono text-mist break-all">{order.gcs_output_path}</span>]] as [string, React.ReactNode][] : []),
    ['指派 Editor', (
      <div key="ed" className="flex items-center gap-2">
        <select
          value={order.editor_id || ''}
          onChange={e => handleAssignEditor(e.target.value)}
          disabled={assigning}
          className="rounded bg-white/10 border border-white/10 text-paper text-xs px-2 py-1 focus:outline-none focus:border-gold"
        >
          <option value="">未指派</option>
          {editors.map(e => (
            <option key={e.id} value={e.id}>{e.email || e.id.slice(-8)}</option>
          ))}
        </select>
        {assigning && <div className="w-3 h-3 border border-gold/30 border-t-gold rounded-full animate-spin" />}
      </div>
    )],
  ]

  return (
    <div className="space-y-6 fade-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/orders" className="text-sm text-mist hover:text-gold transition-colors">
            ← 訂單列表
          </Link>
          <h1 className="font-display text-2xl font-bold text-paper mt-1">訂單詳情</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTick(t => t + 1)} disabled={busy}
            className="p-1.5 rounded-lg border border-white/10 text-mist hover:text-paper hover:border-white/30 disabled:opacity-40 transition-colors">
            <svg className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <StatusBadge status={order.status} />
        </div>
      </div>

      {/* QA Review Action */}
      <div className="flex gap-3">
        {order.status === 'qa_review' && (
          <Link href={`/admin/orders/${order.id}/review`}
            className="flex-1 px-4 py-3 rounded-xl bg-gold text-white font-bold text-center hover:bg-gold/90 transition-all shadow-lg shadow-gold/20">
            進入 QA 審閱編輯器
          </Link>
        )}
        {order.status === 'delivered' && (
          <button onClick={() => handleUpdateStatus('qa_review')}
            className="flex-1 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-mist text-sm hover:text-paper hover:bg-white/10 transition-all">
            重啟 QA 審閱 (由已交付改回)
          </button>
        )}
      </div>

      {/* Translated result */}
      {downloadUrl && (
        <div className="rounded-xl border border-green-400/20 bg-green-400/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-green-400">譯文檔案</p>
            <p className="text-sm text-mist mt-0.5">連結有效 1 小時</p>
          </div>
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 rounded-md bg-green-700 text-white text-sm font-medium hover:bg-green-800 transition-colors">
            開啟譯文
          </a>
        </div>
      )}

      {/* QA Score */}
      {order.qa_result && <QAScorePanel qa={order.qa_result} />}

      {/* Order info */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
        {rows.map(([label, value], i) => (
          <div key={i} className="flex items-start justify-between py-1.5 border-b border-white/5 last:border-0 gap-4">
            <span className="text-sm text-mist w-24 shrink-0">{label}</span>
            <div className="text-right">{value}</div>
          </div>
        ))}
      </div>

      {/* Confirm payment */}
      {order.status === 'pending_payment' && (
        <div className="rounded-xl border border-amber-400/20 bg-white/5 p-4 space-y-3">
          <h2 className="text-base font-semibold text-amber-400">確認付款</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-mist block mb-1">收款金額 (NT$)</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                placeholder={String(order.price_ntd)}
                className="w-full rounded-md bg-white/10 border border-white/10 text-paper text-sm px-3 py-2
                           placeholder:text-mist focus:border-gold focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-mist block mb-1">備註（選填）</label>
              <input type="text" value={payNote} onChange={e => setPayNote(e.target.value)}
                placeholder="付款備註"
                className="w-full rounded-md bg-white/10 border border-white/10 text-paper text-sm px-3 py-2
                           placeholder:text-mist focus:border-gold focus:outline-none" />
            </div>
          </div>
          <button onClick={handleConfirmPayment} disabled={payBusy}
            className="px-4 py-2 rounded-md bg-amber-500 text-white text-sm font-medium
                       hover:bg-amber-600 disabled:opacity-40 transition-colors">
            {payBusy ? '處理中…' : '確認付款並觸發翻譯'}
          </button>
        </div>
      )}

      {/* Mark delivered */}
      {['paid', 'processing', 'qa_review'].includes(order.status) && (
        <div className="rounded-xl border border-green-400/20 bg-white/5 p-4 space-y-3">
          <h2 className="text-base font-semibold text-green-400">標記交付</h2>
          <div>
            <label className="text-sm text-mist block mb-1">GCS 輸出路徑</label>
            <input type="text" value={gcsPath} onChange={e => setGcsPath(e.target.value)}
              placeholder="gs://ots-translation-outputs-dev/orders/…/translation.html"
              className="w-full rounded-md bg-white/10 border border-white/10 text-paper text-sm px-3 py-2
                         placeholder:text-mist focus:border-gold focus:outline-none font-mono" />
          </div>
          <button onClick={handleDeliver} disabled={deliverBusy}
            className="px-4 py-2 rounded-md bg-green-700 text-white text-sm font-medium
                       hover:bg-green-800 disabled:opacity-40 transition-colors">
            {deliverBusy ? '處理中…' : '標記已交付'}
          </button>
        </div>
      )}

      {/* QA Flags */}
      {qaFlags.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-paper">QA 標記（{qaFlags.length}）</h2>
          {qaFlags.map(f => (
            <div key={f.id} className={`rounded-lg border p-4 space-y-2 ${
              f.flag_level === 'must_fix' ? 'border-coral/30 bg-coral/5' : 'border-white/10 bg-white/5'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  f.flag_level === 'must_fix' ? 'bg-coral/20 text-coral' : 'bg-amber-400/20 text-amber-400'
                }`}>{f.flag_level}</span>
                <span className="text-sm text-mist">{f.flag_type}</span>
                {f.resolved && <span className="text-sm text-green-400 ml-auto">已解決</span>}
              </div>
              {f.source_segment && <p className="text-sm text-mist whitespace-pre-wrap break-words">原文：{f.source_segment}</p>}
              {f.translated_segment && <p className="text-sm text-paper whitespace-pre-wrap break-words">譯文：{f.translated_segment}</p>}
              {f.reviewer_note && <p className="text-sm text-gold">審閱：{f.reviewer_note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
