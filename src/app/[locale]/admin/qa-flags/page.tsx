'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminListQaFlags, resolveQaFlag, QAFlag } from '@/lib/api'
import dayjs from 'dayjs'

export default function QAFlagsPage() {
  const [flags,  setFlags]  = useState<QAFlag[]>([])
  const [level,  setLevel]  = useState('must_fix')
  const [busy,   setBusy]   = useState(true)
  const [notes,  setNotes]  = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  function load() {
    setBusy(true)
    adminListQaFlags({ flag_level: level || undefined, resolved: false })
      .then(setFlags).finally(() => setBusy(false))
  }

  useEffect(load, [level])

  async function resolve(id: string) {
    const note = notes[id]
    if (!note?.trim()) { alert('請填寫審閱備注'); return }
    setSaving(s => ({ ...s, [id]: true }))
    try {
      await resolveQaFlag(id, note)
      setFlags(f => f.filter(flag => flag.id !== id))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '標記失敗')
    } finally {
      setSaving(s => ({ ...s, [id]: false }))
    }
  }

  const FLAG_COLORS: Record<string, string> = {
    must_fix: 'border-coral bg-coral/5',
    review:   'border-amber-400 bg-amber-400/5',
    pass:     'border-green-400 bg-green-400/5',
  }

  const FLAG_TYPE_LABELS: Record<string, string> = {
    missing_segment:       '漏譯',
    length_ratio:          '長度比例異常',
    semantic_drift:        '語意漂移',
    terminology_mismatch:  '術語不一致',
    readability_low:       '可讀性低',
  }

  return (
    <div className="space-y-4 fade-up">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-paper">QA 審閱</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-mist">{flags.length} 筆待處理</span>
          <button onClick={load} disabled={busy}
            className="p-1.5 rounded-lg border border-white/10 text-mist hover:text-paper hover:border-white/30 disabled:opacity-40 transition-colors">
            <svg className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Level filter */}
      <div className="flex gap-2">
        {[
          { v: 'must_fix', l: 'Must Fix', cls: 'text-coral border-coral' },
          { v: 'review',   l: 'Review',   cls: 'text-amber-400 border-amber-400' },
          { v: '',         l: '全部',     cls: 'text-mist border-mist' },
        ].map(f => (
          <button key={f.v} onClick={() => setLevel(f.v)}
            className={`px-3 py-1 rounded-full text-xs border transition-all ${
              level === f.v ? `${f.cls} bg-white/10` : 'border-white/10 text-mist hover:border-white/20'
            }`}>
            {f.l}
          </button>
        ))}
      </div>

      {busy ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      ) : flags.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <p className="text-mist text-sm">✓ 無待處理項目</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map(f => (
            <div key={f.id}
              className={`rounded-xl border-l-4 ${FLAG_COLORS[f.flag_level] ?? 'border-mist'} bg-white/5 p-4 space-y-3`}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold uppercase ${f.flag_level === 'must_fix' ? 'text-coral' : 'text-amber-400'}`}>
                    {f.flag_level}
                  </span>
                  <span className="text-xs text-mist border border-white/10 px-2 py-0.5 rounded">
                    {FLAG_TYPE_LABELS[f.flag_type] ?? f.flag_type}
                  </span>
                  <span className="text-xs text-mist">段落 {f.paragraph_index + 1}</span>
                  <Link href={`/admin/orders/${f.order_id}`}
                    className="text-xs text-gold/70 hover:text-gold font-mono transition-colors">
                    #{f.order_id.slice(-8).toUpperCase()}
                  </Link>
                </div>
                <span className="text-xs text-mist">{dayjs(f.flagged_at).format('MM/DD HH:mm')}</span>
              </div>

              {f.source_segment && (
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-xs text-mist mb-1">原文</p>
                  <p className="text-sm text-paper/80 leading-relaxed whitespace-pre-wrap break-words">{f.source_segment}</p>
                </div>
              )}
              {f.translated_segment && f.translated_segment !== f.source_segment ? (
                <div className="rounded-lg bg-gold/5 border border-gold/10 p-3">
                  <p className="text-xs text-mist mb-1">譯文</p>
                  <p className="text-sm text-paper/80 leading-relaxed whitespace-pre-wrap break-words">{f.translated_segment}</p>
                </div>
              ) : (
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <p className="text-xs text-coral">譯文未取得（翻譯解析失敗）</p>
                </div>
              )}

              <div className="flex gap-2 items-end">
                <textarea
                  rows={2}
                  placeholder="審閱備注（必填）"
                  value={notes[f.id] ?? ''}
                  onChange={e => setNotes(n => ({ ...n, [f.id]: e.target.value }))}
                  className="flex-1 rounded-md bg-white/10 border border-white/10 text-paper text-xs px-3 py-2
                             placeholder:text-mist focus:border-gold focus:outline-none resize-none"
                />
                <button
                  onClick={() => resolve(f.id)}
                  disabled={saving[f.id]}
                  className="shrink-0 px-4 py-2 rounded-md bg-gold text-white text-xs font-medium
                             hover:bg-gold-dark disabled:opacity-40 transition-colors">
                  {saving[f.id] ? '…' : '標記完成'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
