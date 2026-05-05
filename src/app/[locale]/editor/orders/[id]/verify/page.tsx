'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  editorGetOrder, editorGetSegments, editorUpdateSegments, editorSubmit, editorReturn,
  Order, QASegment, UserProfile, getMe
} from '@/lib/api'
import { StatusBadge, LangLabel } from '@/components/ui/status-badge'

export default function EditorVerifyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [order,    setOrder]    = useState<Order | null>(null)
  const [segments, setSegments] = useState<QASegment[]>([])
  const [me,       setMe]       = useState<UserProfile | null>(null)
  const [busy,     setBusy]     = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    setBusy(true)
    Promise.all([
      editorGetOrder(id),
      editorGetSegments(id),
      getMe(),
    ]).then(([o, s, user]) => {
      setOrder(o)
      setSegments(s.segments)
      setMe(user)
    }).catch(e => setError(e.message)).finally(() => setBusy(false))
  }, [id])

  const handleSegmentChange = (index: number, field: 'translated' | 'editor_comments', value: string) => {
    setSegments(prev => prev.map(s => s.index === index ? { ...s, [field]: value } : s))
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      await editorUpdateSegments(id, segments.map(s => ({
        index:           s.index,
        translated:      s.translated,
        editor_comments: s.editor_comments,
      })))
      alert('已儲存草稿')
    } catch (e: any) {
      alert(e.message || '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    const isQA = me?.is_qa && !me?.is_editor && !me?.is_admin
    const msg = isQA ? '確定完成審閱並提交給 Editor？' : '確定完成審閱並提交交付？'
    if (!confirm(msg)) return
    setSaving(true)
    try {
      await editorUpdateSegments(id, segments.map(s => ({
        index:           s.index,
        translated:      s.translated,
        editor_comments: s.editor_comments,
      })))
      await editorSubmit(id)
      alert(isQA ? '已提交給 Editor' : '審閱完成，訂單已交付')
      router.push('/editor/orders')
    } catch (e: any) {
      alert(e.message || '提交失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleReturnToQa = async () => {
    if (!confirm('確定將此訂單退回 QA 審閱？')) return
    setSaving(true)
    try {
      await editorUpdateSegments(id, segments.map(s => ({
        index:           s.index,
        translated:      s.translated,
        editor_comments: s.editor_comments,
      })))
      await editorReturn(id)
      alert('已退回 QA 審閱')
      router.push('/editor/orders')
    } catch (e: any) {
      alert(e.message || '操作失敗')
    } finally {
      setSaving(false)
    }
  }

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
              {me?.is_qa && !me?.is_editor ? 'QA 審閱編輯器' : 'Editor 審閱編輯器'}
              <span className="text-xs font-mono text-mist bg-white/5 px-2 py-0.5 rounded uppercase tracking-tighter">
                {id.slice(-8)}
              </span>
            </h1>
            <p className="text-xs text-mist flex items-center gap-2 mt-0.5">
              <LangLabel code={order.source_lang} /> → <LangLabel code={order.target_lang} />
              <span className="w-1 h-1 rounded-full bg-white/20" />
              共 {segments.length} 個段落
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          <button onClick={handleSaveDraft} disabled={saving}
            className="px-4 py-2 rounded-lg border border-white/10 text-sm font-medium text-mist hover:text-paper hover:bg-white/5 transition-all">
            {saving ? '處理中...' : '儲存草稿'}
          </button>
          {(!me?.is_qa || me?.is_editor || me?.is_admin) && (
            <button onClick={handleReturnToQa} disabled={saving}
              className="px-4 py-2 rounded-lg border border-coral/30 text-sm font-medium text-coral hover:bg-coral/5 transition-all">
              退回 QA
            </button>
          )}
          <button onClick={handleSubmit} disabled={saving}
            className="px-6 py-2 rounded-lg bg-gold text-sm font-bold text-night hover:bg-gold-light hover:scale-105 active:scale-95 transition-all shadow-lg shadow-gold/20">
            {me?.is_qa && !me?.is_editor && !me?.is_admin ? '提交給 Editor' : '完成並交付'}
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="max-w-[1400px] mx-auto p-6 space-y-4">
          {segments.map((seg, i) => (
            <div key={seg.index} className="group grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Left: Source */}
              <div className="relative rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-colors group-hover:border-white/10">
                <div className="absolute top-3 left-3 text-[10px] font-mono text-mist/30 select-none">
                  #{seg.index + 1}
                </div>
                <div className="mt-4 text-sm text-mist leading-relaxed whitespace-pre-wrap">
                  {seg.source}
                </div>
                {seg.comments && (
                  <div className="mt-3 bg-gold/10 p-2 rounded border border-gold/20">
                    <p className="text-[10px] uppercase font-bold text-gold/60 mb-1">QA 指示</p>
                    <p className="text-[11px] text-paper/80">{seg.comments}</p>
                  </div>
                )}
                {/* QA Flags Overlay */}
                {seg.flags.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                    <p className="text-[10px] uppercase font-bold text-coral/60 mb-1">QA 標記參考</p>
                    {seg.flags.map(f => (
                      <div key={f.id} className="bg-white/5 p-2 rounded border border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1 rounded text-[9px] font-bold ${
                            f.flag_level === 'must_fix' ? 'bg-coral text-white' : 'bg-amber-400 text-night'
                          }`}>{f.flag_level}</span>
                          <span className="text-[10px] text-mist">{f.flag_type}</span>
                        </div>
                        {f.reviewer_note && <p className="text-[11px] text-gold italic">"{f.reviewer_note}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Editor Input */}
              <div className="flex flex-col gap-2">
                <div className="relative rounded-xl border border-white/10 bg-white/5 p-4 transition-all focus-within:ring-2 focus-within:ring-gold/20 focus-within:border-gold/50">
                  <textarea
                    value={seg.translated}
                    onChange={(e) => handleSegmentChange(seg.index, 'translated', e.target.value)}
                    rows={Math.max(3, Math.ceil(seg.translated.length / 50))}
                    placeholder="修正譯文..."
                    className="w-full bg-transparent text-sm text-paper leading-relaxed resize-none focus:outline-none placeholder:text-mist/30"
                  />
                  
                  {/* Raw LLM Reference */}
                  {seg.raw && seg.raw !== seg.translated && (
                    <details className="mt-3 group/raw">
                      <summary className="text-[10px] text-mist/50 hover:text-gold cursor-pointer list-none flex items-center gap-1 transition-colors">
                        <svg className="w-3 h-3 group-open/raw:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        原始譯文
                      </summary>
                      <div className="mt-2 text-[11px] text-mist/40 italic bg-white/[0.02] p-2 rounded border border-dashed border-white/5">
                        {seg.raw}
                      </div>
                    </details>
                  )}
                </div>

                {/* Editor Comments */}
                <textarea
                  value={seg.editor_comments || ''}
                  onChange={(e) => handleSegmentChange(seg.index, 'editor_comments', e.target.value)}
                  rows={2}
                  placeholder="給 QA 的回饋或修改備註（選填）"
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs transition-all placeholder:text-mist/20 focus:text-paper focus:border-gold/30 focus:outline-none resize-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
