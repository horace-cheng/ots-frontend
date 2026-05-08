'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ltGetOrder, ltGetSegments, ltUpdateSegments, ltCompleteAssignment,
  Order, QASegment
} from '@/lib/api'
import { StatusBadge, LangLabel } from '@/components/ui/status-badge'

export default function LtEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [order, setOrder] = useState<Order | null>(null)
  const [segments, setSegments] = useState<QASegment[]>([])
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setBusy(true)
    Promise.all([
      ltGetOrder(id, 'editor'),
      ltGetSegments(id, 'editor'),
    ]).then(([o, s]) => {
      setOrder(o)
      setSegments(s.segments)
    }).catch(e => {
      if (e.message !== 'NEXT_REDIRECT') setError(e.message)
    }).finally(() => setBusy(false))
  }, [id])

  const handleSegmentChange = (index: number, value: string) => {
    setSegments(prev => prev.map(s => s.index === index ? { ...s, translated: value } : s))
  }

  const handleCommentChange = (index: number, value: string) => {
    setSegments(prev => prev.map(s => s.index === index ? { ...s, editor_comments: value } : s))
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      await ltUpdateSegments(id, 'editor', segments.map(s => ({
        index: s.index,
        translated: s.translated,
        editor_comments: s.editor_comments,
      })))
      alert('已儲存草稿')
    } catch (e: any) {
      alert(e.message || '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    const isRevision = order?.status === 'revision_needed'
    if (!confirm(isRevision ? '確定重新提交？將再次交由校對審閱。' : '確定完成編輯工作？完成後將交由校對處理。')) return
    setSaving(true)
    try {
      await ltUpdateSegments(id, 'editor', segments.map(s => ({
        index: s.index,
        translated: s.translated,
        editor_comments: s.editor_comments,
      })))
      await ltCompleteAssignment(id, 'editor')
      alert(isRevision ? '已重新提交，訂單將再次進入校對階段' : '編輯工作已完成，訂單將進入校對階段')
      router.push('/editor/orders')
    } catch (e: any) {
      if (e.message?.includes('unresolved must-fix')) {
        alert('有未解決的 QA 問題必須先處理。請查看標記的段落並修正後再提交。')
      } else {
        alert(e.message || '提交失敗')
      }
    } finally {
      setSaving(false)
    }
  }

  const mustFixCount = segments.reduce((count, s) =>
    count + (s.flags?.filter(f => f.flag_level === 'must_fix' && !f.resolved).length || 0), 0)

  if (busy) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
    </div>
  )

  if (error || !order) return (
    <div className="p-8 text-coral">{error || '訂單加載失敗'}</div>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] -m-6 bg-night">
      {/* Sticky Header */}
      <div className="z-20 bg-night/80 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/editor/orders" className="p-2 rounded-full hover:bg-white/5 text-mist transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-paper flex items-center gap-2">
              Literary Track — 編輯
              <span className="text-xs font-mono text-mist bg-white/5 px-2 py-0.5 rounded uppercase tracking-tighter">
                {id.slice(-8)}
              </span>
            </h1>
            <p className="text-xs text-mist flex items-center gap-2 mt-0.5">
              <LangLabel code={order.source_lang} /> → <LangLabel code={order.target_lang} />
              <span className="w-1 h-1 rounded-full bg-white/20" />
              共 {segments.length} 個段落
              <span className="w-1 h-1 rounded-full bg-white/20" />
              {order.word_count?.toLocaleString()} 字
              {mustFixCount > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-coral font-bold">{mustFixCount} 個待修正</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          <button onClick={handleSaveDraft} disabled={saving}
            className="px-4 py-2 rounded-lg border border-white/10 text-sm font-medium text-mist hover:text-paper hover:bg-white/5 transition-all">
            {saving ? '處理中...' : '儲存草稿'}
          </button>
          <button onClick={handleComplete} disabled={saving}
            className="px-6 py-2 rounded-lg bg-gold text-sm font-bold text-night hover:bg-gold-light hover:scale-105 active:scale-95 transition-all shadow-lg shadow-gold/20">
            {order.status === 'revision_needed' ? '重新提交' : '完成編輯'}
          </button>
        </div>
      </div>

      {/* Revision Notes */}
      {order.status === 'revision_needed' && order.proofreader_notes && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <p className="text-sm font-bold text-orange-400 mb-2">校對退回修改</p>
          <p className="text-sm text-paper/80 whitespace-pre-wrap">{order.proofreader_notes}</p>
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="max-w-[1400px] mx-auto p-6 space-y-4">
          {segments.map((seg) => {
            const unresolvedFlags = (seg.flags || []).filter(f => !f.resolved)
            const hasMustFix = unresolvedFlags.some(f => f.flag_level === 'must_fix')
            const isUntranslated = unresolvedFlags.some(f => f.flag_type === 'untranslated')

            return (
              <div key={seg.index} className={`group grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                {/* Left: Source */}
                <div className={`relative rounded-xl border p-4 transition-colors ${isUntranslated ? 'border-coral/40 bg-coral/[0.04]' : 'border-white/5 bg-white/[0.02]'} group-hover:${isUntranslated ? 'border-coral/60' : 'border-white/10'}`}>
                  <div className="absolute top-3 left-3 text-[10px] font-mono select-none">
                    <span className={isUntranslated ? 'text-coral/70' : 'text-mist/30'}>#{seg.index + 1}</span>
                  </div>
                  <div className="mt-4 text-sm text-mist leading-relaxed whitespace-pre-wrap">
                    {seg.source}
                  </div>
                  {seg.raw && seg.raw !== seg.translated && (
                    <details className="mt-3 group/raw">
                      <summary className="text-[10px] text-mist/50 hover:text-gold cursor-pointer list-none flex items-center gap-1 transition-colors">
                        <svg className="w-3 h-3 group-open/raw:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        NMT 原始譯文
                      </summary>
                      <div className="mt-2 text-sm text-mist/50 italic bg-white/[0.02] p-2 rounded border border-dashed border-white/5">
                        {seg.raw}
                      </div>
                    </details>
                  )}

                  {/* Proofreader Comments (read-only) */}
                  {seg.proofreader_comments && (
                    <div className="mt-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                      <p className="text-[10px] uppercase font-bold text-emerald-400/60 mb-1">校對備註</p>
                      <p className="text-xs text-paper/70 whitespace-pre-wrap">{seg.proofreader_comments}</p>
                    </div>
                  )}
                </div>

                {/* Right: Editor Input */}
                <div className="flex flex-col gap-2">
                  <div className={`relative rounded-xl border p-4 transition-all focus-within:ring-2 focus-within:ring-gold/20 focus-within:border-gold/50 ${isUntranslated ? 'border-coral/30 bg-coral/[0.03]' : 'border-white/10 bg-white/5'}`}>
                    <textarea
                      value={seg.translated}
                      onChange={(e) => handleSegmentChange(seg.index, e.target.value)}
                      rows={Math.max(3, Math.ceil(seg.translated.length / 50))}
                      placeholder="修正譯文..."
                      className="w-full bg-transparent text-sm text-paper leading-relaxed resize-none focus:outline-none placeholder:text-mist/30"
                    />
                  </div>

                  {/* QA Flag indicators */}
                  {unresolvedFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {unresolvedFlags.map((flag) => (
                        <span key={flag.id} className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${flag.flag_level === 'must_fix' ? 'bg-coral/10 text-coral border border-coral/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                          {flag.flag_type === 'untranslated' ? '未翻譯' : flag.flag_type === 'missing_translation' ? '漏譯' : flag.flag_type}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Editor Comments */}
                <textarea
                  value={seg.editor_comments || ''}
                  onChange={(e) => handleCommentChange(seg.index, e.target.value)}
                  rows={2}
                  placeholder={hasMustFix ? '請填寫修正說明（必填）' : '給校對的備註（選填）'}
                  className={`px-3 py-2 rounded-lg bg-white/5 border text-xs transition-all placeholder:text-mist/20 focus:text-paper focus:outline-none resize-none ${hasMustFix ? 'border-coral/30 focus:border-coral/50' : 'border-white/10 focus:border-gold/30'}`}
                />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
