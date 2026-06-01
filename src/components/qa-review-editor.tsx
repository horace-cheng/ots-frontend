'use client'
import { useState } from 'react'
import Link from 'next/link'
import { QASegment, Order, QAFlag } from '@/lib/api'
import { StatusBadge, LangLabel } from '@/components/ui/status-badge'
import { Pagination } from '@/components/ui/pagination'
import { AutoResizeTextarea } from '@/components/auto-resize-textarea'
import { SearchBar } from '@/components/search-bar'

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
  // pagination
  total?: number
  pageSize?: number
  currentPage?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  // must_fix navigation
  totalMustFix?: number
  mustFixIndices?: number[]
  onMustFixNavigate?: (direction: 'prev' | 'next') => void
  // all flags for QA result panel
  allFlags?: QAFlag[]
  // search
  searchQuery?: string
  onSearchChange?: (q: string) => void
  searchResults?: { index: number; source: string }[]
  searchTotal?: number
  highlightedIndex?: number | null
  onSelectResult?: (index: number) => void
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
  total,
  pageSize = 50,
  currentPage = 1,
  onPageChange,
  onPageSizeChange,
  totalMustFix = 0,
  mustFixIndices = [],
  onMustFixNavigate,
  allFlags = [],
  searchQuery = '',
  onSearchChange,
  searchResults,
  searchTotal,
  highlightedIndex,
  onSelectResult,
}: QaReviewEditorProps) {
  const [saving, setSaving] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showQaResult, setShowQaResult] = useState(false)

  const handleSegmentChange = (index: number, field: 'translated' | 'comments', value: string) => {
    onSegmentsChange(
      segments.map(s => s.index === index ? { ...s, [field]: value } : s)
    )
  }

  const jumpToSegment = (paragraphIndex: number) => {
    const targetPage = Math.floor(paragraphIndex / pageSize) + 1
    setShowQaResult(false)
    onPageChange?.(targetPage)
    requestAnimationFrame(() => {
      const el = document.getElementById(`segment-${paragraphIndex}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
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
              {total != null
                ?                 `第 ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} 段，共 ${total} 個段落`
                : `共 ${segments.length} 個段落`}
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
          <button onClick={() => setShowQaResult(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${totalMustFix > 0 ? 'bg-coral/10 border-coral/30 text-coral' : 'border-white/10 text-mist hover:text-paper hover:bg-white/5'}`}>
            QA 結果{totalMustFix > 0 && ` (${totalMustFix})`}
          </button>
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

      {/* Must-fix Navigation */}
      {totalMustFix > 0 && onMustFixNavigate && (
        <div className="shrink-0 mx-6 mt-4 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-coral/10 border border-coral/20">
          <span className="text-sm font-bold text-coral">{totalMustFix} 個待修正段落</span>
          <span className="text-xs text-mist">
            （第 {mustFixIndices.map(i => Math.floor(i / pageSize) + 1).filter((v, k, a) => a.indexOf(v) === k).join('、')} 頁）
          </span>
          <div className="flex-1" />
          <button onClick={() => onMustFixNavigate('prev')}
            className="px-3 py-1.5 rounded-lg border border-coral/30 text-xs font-medium text-coral hover:bg-coral/10 transition-all">
            上一處修正
          </button>
          <button onClick={() => onMustFixNavigate('next')}
            className="px-3 py-1.5 rounded-lg bg-coral text-xs font-bold text-white hover:bg-coral-light hover:scale-105 transition-all">
            下一處修正
          </button>
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="max-w-[1400px] mx-auto p-6 space-y-4">
          {onSearchChange && (
            <div className="sticky top-0 z-10 bg-night/90 backdrop-blur-sm rounded-xl pb-3 mb-2">
              <SearchBar value={searchQuery} onChange={onSearchChange} onSelectResult={onSelectResult} results={searchResults} totalMatches={searchQuery ? searchTotal : undefined} theme={accent === 'purple' ? 'purple' : 'gold'} />
            </div>
          )}
          {segments.map((seg, i) => (
            <div id={`segment-${seg.index}`} key={seg.index} className="group grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{
              animationDelay: `${i * 30}ms`,
              transition: 'box-shadow 2.5s ease-out, background 2.5s ease-out',
              ...(seg.index === highlightedIndex ? { boxShadow: 'inset 0 0 0 2px rgba(184,133,42,0.5), 0 0 20px rgba(184,133,42,0.2)', background: 'rgba(184,133,42,0.05)', borderRadius: '0.75rem' } : {}),
            }}>
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
                  <AutoResizeTextarea
                    value={seg.translated}
                    onChange={(e) => handleSegmentChange(seg.index, 'translated', e.target.value)}
                    readOnly={isReadOnly}
                    placeholder="輸入譯文..."
                    className="w-full bg-transparent text-sm text-paper leading-relaxed resize-none focus:outline-none placeholder:text-mist/30 no-scrollbar"
                  />
                  
                  {/* QA Flags Overlay */}
                  {seg.flags.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                      {seg.flags.map(f => {
                        const flagLabel =
                          f.flag_type === 'missing_segment' ? '漏譯' :
                          f.flag_type === 'untranslated' ? '未翻譯' :
                          f.flag_type === 'partial_untranslated' ? '部分未翻譯' :
                          f.flag_type === 'missing_translation' ? '漏譯' :
                          f.flag_type === 'segment_count_mismatch' ? '段落數不符' :
                          f.flag_type === 'number_inconsistency' ? '數字不一致' :
                          f.flag_type === 'length_ratio' ? '長度比例異常' :
                          f.flag_type === 'semantic_drift' ? '語意漂移' :
                          f.flag_type === 'terminology_mismatch' ? '術語不一致' :
                          f.flag_type === 'readability_low' ? '可讀性低' :
                          f.flag_type;
                        return (
                        <div key={f.id} className="flex items-start gap-2 text-xs">
                          <span className={`shrink-0 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter ${
                            f.flag_level === 'must_fix' ? 'bg-coral text-white' : 'bg-amber-400 text-night'
                          }`}>
                            {flagLabel}
                          </span>
                          <span className="text-mist">{f.flag_level === 'must_fix' ? '必須修正' : '建議審閱'}</span>
                        </div>
                        );
                      })}
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
                <AutoResizeTextarea
                  value={seg.comments || ''}
                  onChange={(e) => handleSegmentChange(seg.index, 'comments', e.target.value)}
                  readOnly={isReadOnly}
                  placeholder={seg.flags.length > 0 ? "添加審閱備註（必填）" : "添加備註（選填）"}
                  className={`px-3 py-2 rounded-lg bg-white/5 border text-xs transition-all placeholder:text-mist/20 resize-none no-scrollbar ${
                    seg.flags.length > 0 && !seg.comments?.trim() 
                      ? 'border-coral/40 focus:border-coral focus:ring-1 focus:ring-coral/20' 
                      : 'border-white/5 focus:text-paper focus:border-gold/30 focus:outline-none'
                  }`}
                />
              </div>
            </div>
          ))}

          {/* Pagination */}
          {total != null && total > 0 && onPageChange && (
            <Pagination
              total={total}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              theme="dark"
            />
          )}
        </div>
      </div>

      {/* QA Result Drawer */}
      {showQaResult && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowQaResult(false)} />
          <div className="relative w-full max-w-lg bg-[#111122] border-l-2 border-coral/40 shadow-2xl shadow-coral/5 overflow-auto">
            <div className="sticky top-0 bg-[#111122]/95 backdrop-blur-md border-b border-coral/20 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 rounded bg-coral" />
                <h2 className="text-lg font-bold text-white">QA 結果</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-white/50">{allFlags.length} 個標記</span>
                <button onClick={() => setShowQaResult(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-3">
              {allFlags.length === 0 && (
                <p className="text-sm text-white/40 text-center py-8">無 QA 標記</p>
              )}
              {allFlags
                .slice()
                .sort((a, b) => {
                  if (a.flag_level !== b.flag_level) return a.flag_level === 'must_fix' ? -1 : 1
                  return a.paragraph_index - b.paragraph_index
                })
                .map((flag) => {
                  const flagLabel =
                    flag.flag_type === 'missing_segment' ? '漏譯' :
                    flag.flag_type === 'untranslated' ? '未翻譯' :
                    flag.flag_type === 'partial_untranslated' ? '部分未翻譯' :
                    flag.flag_type === 'missing_translation' ? '漏譯' :
                    flag.flag_type === 'segment_count_mismatch' ? '段落數不符' :
                    flag.flag_type === 'number_inconsistency' ? '數字不一致' :
                    flag.flag_type === 'length_ratio' ? '長度比例異常' :
                    flag.flag_type === 'semantic_drift' ? '語意漂移' :
                    flag.flag_type === 'terminology_mismatch' ? '術語不一致' :
                    flag.flag_type === 'readability_low' ? '可讀性低' : flag.flag_type;
                  return (
                    <div key={flag.id} className={`rounded-xl border-2 p-4 transition-colors ${
                      flag.resolved
                        ? 'border-green-500/30 bg-green-500/10'
                        : flag.flag_level === 'must_fix'
                        ? 'border-coral/40 bg-coral/10 shadow-[0_0_12px_rgba(255,107,107,0.08)]'
                        : 'border-amber-500/30 bg-amber-500/10'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-white/60 bg-white/5 px-1.5 py-0.5 rounded">#{flag.paragraph_index + 1}</span>
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                            flag.flag_level === 'must_fix' ? 'bg-coral text-white' : 'bg-amber-400 text-black'
                          }`}>{flagLabel}</span>
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                            flag.resolved ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/60'
                          }`}>
                            {flag.resolved ? '已處理' : flag.flag_level === 'must_fix' ? '待修正' : '待審閱'}
                          </span>
                        </div>
                        <button
                          onClick={() => jumpToSegment(flag.paragraph_index)}
                          className="shrink-0 px-3 py-1 rounded-lg border border-coral/30 text-[11px] font-bold text-coral hover:bg-coral/20 hover:border-coral/60 transition-all">
                          跳至段落
                        </button>
                      </div>
                      {flag.source_segment && (
                        <p className="mt-2 text-xs text-white/50 line-clamp-2">{flag.source_segment}</p>
                      )}
                      {flag.translated_segment && (
                        <p className="mt-1 text-xs text-white/30 line-clamp-2">{flag.translated_segment}</p>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
