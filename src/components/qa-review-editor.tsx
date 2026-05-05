'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { QASegment, Order } from '@/lib/api'
import { StatusBadge, LangLabel } from '@/components/ui/status-badge'

interface QaReviewEditorProps {
  order: Order
  segments: QASegment[]
  backHref: string
  isReadOnly?: boolean
  accent?: 'gold' | 'purple'
  onSegmentsChange: (updated: QASegment[]) => void
  onSaveDraft: () => Promise<void>
  onSubmit: () => Promise<void>
  submitLabel?: string
  onOpenOriginal?: () => void
}

export default function QaReviewEditor({
  order,
  segments,
  backHref,
  isReadOnly = false,
  accent = 'gold',
  onSegmentsChange,
  onSaveDraft,
  onSubmit,
  submitLabel = '完成審閱並交付',
  onOpenOriginal,
}: QaReviewEditorProps) {
  const [saving, setSaving] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  const handleSegmentChange = (index: number, field: 'translated' | 'comments', value: string) => {
    onSegmentsChange(
      segments.map(s => s.index === index ? { ...s, [field]: value } : s)
    )
  }

  const handleSave = async (isDone = false) => {
    if (isDone) {
      const missingComment = segments.find(s => s.flags.length > 0 && !s.comments?.trim())
      if (missingComment) {
        alert(`第 ${missingComment.index + 1} 段有 QA 標記，必須填寫審閱備註才能完成。`)
        return
      }
      if (!confirm(submitLabel + '？')) return
    }

    setSaving(true)
    try {
      await onSaveDraft()
      if (isDone) {
        await onSubmit()
      } else {
        alert('已儲存草稿')
      }
    } catch (e: any) {
      alert(e.message || '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const accentBorder = accent === 'gold' ? 'focus-within:ring-gold/20 focus-within:border-gold/50' : 'focus-within:ring-purple-400/20 focus-within:border-purple-400/50'
  const accentFlagBorder = accent === 'gold' ? 'focus-within:border-gold/50' : 'focus-within:border-purple-400/50'
  const btnPrimary = accent === 'gold'
    ? 'bg-gold text-night hover:bg-gold-light shadow-gold/20'
    : 'bg-purple-600 text-white hover:bg-purple-500 shadow-purple-500/20'
  const hoverText = accent === 'gold' ? 'hover:text-gold' : 'hover:text-purple-400'

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] -m-6 bg-night">
      {/* Sticky Header */}
      <div className="z-20 bg-night/80 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href={backHref} className="p-2 rounded-full hover:bg-white/5 text-mist transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-paper flex items-center gap-2">
              QA 審閱編輯器
              <span className="text-xs font-mono text-mist bg-white/5 px-2 py-0.5 rounded uppercase tracking-tighter">
                {order.id.slice(-8)}
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
          {order.notes && (
            <button onClick={() => setShowNotes(!showNotes)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                showNotes
                  ? 'bg-gold/10 border-gold/30 text-gold'
                  : 'border-white/10 text-mist hover:text-paper hover:bg-white/5'
              }`}>
              備註
            </button>
          )}
          {onOpenOriginal && (
            <button onClick={onOpenOriginal}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-mist hover:text-paper hover:bg-white/5 transition-all">
              原始內容
            </button>
          )}
          <StatusBadge status={order.status} />
          {!isReadOnly && (
            <>
              <button onClick={() => handleSave(false)} disabled={saving}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm font-medium text-mist hover:text-paper hover:bg-white/5 transition-all">
                {saving ? '儲存中...' : '儲存草稿'}
              </button>
              <button onClick={() => handleSave(true)} disabled={saving}
                className={`px-6 py-2 rounded-lg text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-${btnPrimary}`}>
                {submitLabel}
              </button>
            </>
          )}
          {isReadOnly && (
            <div className="px-4 py-2 rounded-lg bg-green-500/10 text-green-400 text-sm border border-green-500/20">
              唯讀模式（訂單已交付）
            </div>
          )}
        </div>
      </div>

      {/* Notes Panel */}
      {showNotes && order.notes && (
        <div className="shrink-0 bg-amber-400/5 border-b border-amber-400/10 px-6 py-3">
          <p className="text-xs text-amber-400/60 uppercase font-bold mb-1">訂單備註</p>
          <p className="text-sm text-paper/80 whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="max-w-[1400px] mx-auto p-6 space-y-4">
          {segments.map((seg, i) => (
            <div key={seg.index} className="group grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${i * 30}ms` }}>
              {/* Left: Source */}
              <div className="relative rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-colors group-hover:border-white/10">
                <div className="absolute top-3 left-3 text-[10px] font-mono text-mist/30 select-none">
                  #{seg.index + 1}
                </div>
                <div className="mt-4 text-sm text-mist leading-relaxed whitespace-pre-wrap">
                  {seg.source}
                </div>
                {seg.editor_comments && (
                  <div className="mt-3 bg-purple-500/10 p-2 rounded border border-purple-500/20">
                    <p className="text-[10px] uppercase font-bold text-purple-400/60 mb-1">Editor 備註 (唯讀)</p>
                    <p className="text-sm text-paper/80">{seg.editor_comments}</p>
                  </div>
                )}
              </div>

              {/* Right: Translation */}
              <div className="flex flex-col gap-2">
                <div className={`relative rounded-xl border p-4 transition-all ${accentBorder} ${
                  seg.flags.some(f => f.flag_level === 'must_fix') 
                    ? 'border-coral/30 bg-coral/5 focus-within:border-coral' 
                    : `border-white/10 bg-white/5 ${accentFlagBorder}`
                }`}>
                  <textarea
                    value={seg.translated}
                    onChange={(e) => handleSegmentChange(seg.index, 'translated', e.target.value)}
                    readOnly={isReadOnly}
                    rows={Math.max(3, Math.ceil(seg.translated.length / 50))}
                    placeholder="輸入譯文..."
                    className="w-full bg-transparent text-sm text-paper leading-relaxed resize-none focus:outline-none placeholder:text-mist/30"
                  />
                  
                  {/* QA Flags Overlay */}
                  {seg.flags.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                      {seg.flags.map(f => (
                        <div key={f.id} className="flex items-start gap-2 text-xs">
                          <span className={`shrink-0 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter ${
                            f.flag_level === 'must_fix' ? 'bg-coral text-white' : 'bg-amber-400 text-night'
                          }`}>
                            {f.flag_type}
                          </span>
                          <span className="text-mist">{f.flag_level === 'must_fix' ? '必須修正' : '建議審閱'}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Raw LLM Reference */}
                  {seg.raw && seg.raw !== seg.translated && (
                    <details className="mt-3 group/raw">
                      <summary className={`text-[10px] text-mist/50 ${hoverText} cursor-pointer list-none flex items-center gap-1 transition-colors`}>
                        <svg className="w-3 h-3 group-open/raw:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        查看原始譯文 (LLM Raw)
                      </summary>
                      <div className="mt-2 text-[11px] text-mist/40 italic bg-white/[0.02] p-2 rounded border border-dashed border-white/5">
                        {seg.raw}
                      </div>
                    </details>
                  )}
                </div>

                {/* Segment Comments */}
                <textarea
                  value={seg.comments || ''}
                  onChange={(e) => handleSegmentChange(seg.index, 'comments', e.target.value)}
                  readOnly={isReadOnly}
                  rows={2}
                  placeholder={seg.flags.length > 0 ? "添加審閱備註（必填）" : "添加備註（選填）"}
                  className={`px-3 py-2 rounded-lg bg-white/5 border text-xs transition-all placeholder:text-mist/20 resize-none ${
                    seg.flags.length > 0 && !seg.comments?.trim() 
                      ? 'border-coral/40 focus:border-coral focus:ring-1 focus:ring-coral/20' 
                      : 'border-white/5 focus:text-paper focus:border-gold/30 focus:outline-none'
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
