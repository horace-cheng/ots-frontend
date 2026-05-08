'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { listAssignments, updateAssignment, Assignment } from '@/lib/api'
import dayjs from 'dayjs'

const STATUS_LABELS: Record<string, string> = {
  pending:       '待指派',
  editing:       '編輯中',
  editor_done:   '編輯完成',
  proofreading:  '校對中',
  proofread_done:'校對完成',
  delivered:     '已交付',
}

export default function LiteraryPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [busy,        setBusy]        = useState(true)
  const [editors,     setEditors]     = useState<Record<string, string>>({})
  const [proofreaders,setProofreaders]= useState<Record<string, string>>({})
  const [saving,      setSaving]      = useState<Record<string, boolean>>({})
  const [tick,        setTick]        = useState(0)

  useEffect(() => {
    setBusy(true)
    listAssignments().then(d => setAssignments(d.assignments)).finally(() => setBusy(false))
  }, [tick])

  async function handleAssign(orderId: string) {
    const editor_id      = editors[orderId]?.trim() || undefined
    const proofreader_id = proofreaders[orderId]?.trim() || undefined
    if (!editor_id && !proofreader_id) { alert('請填寫至少一個指派'); return }

    setSaving(s => ({ ...s, [orderId]: true }))
    try {
      const updated = await updateAssignment(orderId, { editor_id, proofreader_id })
      setAssignments(as => as.map(a => a.order_id === orderId ? updated : a))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '指派失敗')
    } finally { setSaving(s => ({ ...s, [orderId]: false })) }
  }

  return (
    <div className="space-y-4 fade-up">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-paper">Literary Track 指派</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-mist">{assignments.length} 筆</span>
          <button onClick={() => setTick(t => t + 1)} disabled={busy}
            className="p-1.5 rounded-lg border border-white/10 text-mist hover:text-paper hover:border-white/30 disabled:opacity-40 transition-colors">
            <svg className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {busy ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <p className="text-mist text-sm">無 Literary Track 訂單</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => (
            <div key={a.id} className="rounded-xl border border-purple-400/20 bg-white/5 p-4 space-y-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs font-mono text-mist">{a.order_id}</p>
                  <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full border ${
                    a.status === 'pending' ? 'border-amber-400 text-amber-400' : 'border-purple-400 text-purple-400'
                  }`}>
                    {STATUS_LABELS[a.status] ?? a.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/orders/${a.order_id}`}
                    className="text-xs text-gold hover:underline">
                    訂單詳情
                  </Link>
                  <p className="text-xs text-mist">{dayjs(a.assigned_at).format('MM/DD HH:mm')}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-mist block mb-1">
                    編輯 ID {a.editor_id && <span className="text-green-400 ml-1">✓ {a.editor_id.slice(-6)}</span>}
                  </label>
                  <input type="text"
                    placeholder="編輯 UUID 或 Email"
                    value={editors[a.order_id] ?? ''}
                    onChange={e => setEditors(d => ({ ...d, [a.order_id]: e.target.value }))}
                    className="w-full rounded-md bg-white/10 border border-white/10 text-paper text-xs px-3 py-2
                               placeholder:text-mist focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-mist block mb-1">
                    校對 ID {a.proofreader_id && <span className="text-green-400 ml-1">✓ {a.proofreader_id.slice(-6)}</span>}
                  </label>
                  <input type="text"
                    placeholder="校對 UUID 或 Email"
                    value={proofreaders[a.order_id] ?? ''}
                    onChange={e => setProofreaders(d => ({ ...d, [a.order_id]: e.target.value }))}
                    className="w-full rounded-md bg-white/10 border border-white/10 text-paper text-xs px-3 py-2
                               placeholder:text-mist focus:border-gold focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleAssign(a.order_id)}
                  disabled={saving[a.order_id]}
                  className="px-4 py-1.5 rounded-md bg-purple-600 text-white text-xs font-medium
                             hover:bg-purple-700 disabled:opacity-40 transition-colors">
                  {saving[a.order_id] ? '…' : '儲存指派'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
