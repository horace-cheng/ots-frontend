'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  editorListOrders, createInvitation, editorAssignQa, adminListEligibleUsers, 
  Order, UserAccount, getMe
} from '@/lib/api'
import { StatusBadge, TrackBadge, LangLabel } from '@/components/ui/status-badge'
import { Pagination } from '@/components/ui/pagination'
import dayjs from 'dayjs'

export default function EditorOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [total,  setTotal]  = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [busy, setBusy] = useState(true)
  const [tick, setTick] = useState(0)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState('')
  const [isEditor, setIsEditor] = useState(false)
  const [isQa, setIsQa] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [pageSize])

  useEffect(() => {
    getMe().then(me => {
      setIsEditor(me.is_editor || me.is_admin)
      setIsQa(me.is_qa && !me.is_editor && !me.is_admin)
    }).catch(() => {})
    setBusy(true)
    editorListOrders({
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then(d => { setOrders(d.orders); setTotal(d.total) })
      .finally(() => setBusy(false))
  }, [page, pageSize, tick])

  const [eligibleQAs, setEligibleQAs] = useState<Record<string, UserAccount[]>>({})

  const fetchEligibleQAs = async (orderId: string) => {
    if (eligibleQAs[orderId]) return
    try {
      const res = await adminListEligibleUsers(orderId)
      setEligibleQAs(prev => ({ ...prev, [orderId]: res.users.filter(u => u.is_qa) }))
    } catch (e) {}
  }

  const handleAssignQA = async (orderId: string, qaId: string) => {
    setAssigning(orderId)
    try {
      await editorAssignQa(orderId, qaId || null)
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, qa_id: qaId || undefined } : o))
    } catch (e: any) {
      alert(e.message)
    } finally {
      setAssigning(null)
    }
  }

  const handleInviteQA = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    setInviting(true)
    try {
      const res = await createInvitation({ email: inviteEmail, role: 'qa' })
      const link = `${window.location.origin}/invite/${res.token}`
      setInviteResult(link)
      setInviteEmail('')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="space-y-4 fade-up">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-paper">待審閱訂單</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-mist">共 {total} 筆</span>
          <button onClick={() => setTick(t => t + 1)} disabled={busy}
            className="p-1.5 rounded-lg border border-white/10 text-mist hover:text-paper hover:border-white/30 disabled:opacity-40 transition-colors">
            <svg className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {isEditor && (
            <button onClick={() => {
              if (inviteEmail) {
                handleInviteQA({ preventDefault: () => {} } as React.FormEvent)
              } else {
                const email = prompt('QA Email:')
                if (email) { setInviteEmail(email) }
              }
            }} disabled={inviting}
              className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              邀請 QA
            </button>
          )}
        </div>
      </div>

      {inviteResult && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-col gap-2">
          <p className="text-sm font-bold text-emerald-400">QA 邀請連結已產生:</p>
          <div className="flex gap-2">
            <input 
              readOnly 
              value={inviteResult} 
              className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-1.5 text-sm font-mono"
            />
            <button 
              onClick={() => { navigator.clipboard.writeText(inviteResult); alert('已複製') }}
              className="px-3 py-1.5 text-sm text-gold underline whitespace-nowrap"
            >
              複製
            </button>
            <button onClick={() => setInviteResult('')} className="px-3 py-1.5 text-sm text-mist underline">關閉</button>
          </div>
        </div>
      )}

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
              <tr><td colSpan={8} className="text-center text-mist py-12 text-sm">無指派訂單</td></tr>
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
                    {isEditor && (
                      <select
                        value={o.qa_id || ''}
                        onFocus={() => fetchEligibleQAs(o.id)}
                        onChange={e => handleAssignQA(o.id, e.target.value)}
                        disabled={assigning === o.id}
                        className="rounded bg-white/10 border border-white/10 text-paper text-sm px-2 py-1 focus:outline-none focus:border-emerald-400"
                      >
                        <option value="">指派 QA</option>
                        {(eligibleQAs[o.id] || []).map(q => (
                          <option key={q.id} value={q.id}>{q.email || q.id.slice(-8)}</option>
                        ))}
                      </select>
                    )}
                    
                    <Link href={isQa ? `/editor/orders/${o.id}/review` : `/editor/orders/${o.id}/verify`}
                      className="text-sm text-paper bg-gold/20 px-2 py-0.5 rounded hover:bg-gold/30 transition-colors">
                      審閱
                    </Link>
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
