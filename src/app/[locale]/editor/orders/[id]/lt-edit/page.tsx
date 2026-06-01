'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ltGetOrder, ltGetSegments, ltUpdateSegments, ltCompleteAssignment,
  ltGetOriginalContent, ltListSupportFiles, ltGetSupportFileContent,
  getSamplePackage, updateSamplePackage, editorGenerateSamplePackage,
  Order, QASegment, QAFlag, SupportFile, SamplePackage,
} from '@/lib/api'
import { StatusBadge, LangLabel } from '@/components/ui/status-badge'
import { Pagination } from '@/components/ui/pagination'
import { AutoResizeTextarea } from '@/components/auto-resize-textarea'
import { SearchBar } from '@/components/search-bar'
import OriginalContentViewer from '@/components/original-content-viewer'

export default function LtEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [order, setOrder] = useState<Order | null>(null)
  const [segments, setSegments] = useState<QASegment[]>([])
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(true)
  const [showOriginal, setShowOriginal] = useState(false)
  const [showSupportFiles, setShowSupportFiles] = useState(false)
  const [supportFiles, setSupportFiles] = useState<SupportFile[]>([])
  const [viewingSupportFile, setViewingSupportFile] = useState<{ orderId: string; fileId: string } | null>(null)
  const [showPackage, setShowPackage] = useState(false)
  const [samplePkg, setSamplePkg] = useState<SamplePackage | null>(null)
  const [pkgLoading, setPkgLoading] = useState(false)
  const [pkgSaving, setPkgSaving] = useState(false)
  const [pkgDraft, setPkgDraft] = useState<Partial<SamplePackage>>({})

  // Pagination state
  const [total,          setTotal]          = useState(0)
  const [currentPage,    setCurrentPage]    = useState(1)
  const [pageSize,       setPageSize]       = useState(50)
  const [dirtyIndices,   setDirtyIndices]   = useState<Set<number>>(new Set())
  const [totalMustFix,   setTotalMustFix]   = useState(0)
  const [mustFixIndices, setMustFixIndices] = useState<number[]>([])
  const [allFlags,       setAllFlags]       = useState<QAFlag[]>([])
  const [searchQuery,    setSearchQuery]    = useState('')

  const [showQaResult,   setShowQaResult]   = useState(false)
  const [searchResults, setSearchResults] = useState<{ index: number; source: string }[]>([])
  const [crossPageTotal, setCrossPageTotal] = useState(0)
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)

  const fetchSegments = useCallback(async (page: number, size: number) => {
    const s = await ltGetSegments(id, 'editor', { limit: size, offset: (page - 1) * size })
    setSegments(s.segments)
    setTotal(s.total)
    setTotalMustFix(s.total_must_fix)
    setMustFixIndices(s.must_fix_indices)
    setAllFlags(s.all_flags)
    setDirtyIndices(new Set())
  }, [id])

  useEffect(() => {
    setBusy(true)
    Promise.all([
      ltGetOrder(id, 'editor'),
      fetchSegments(1, pageSize),
    ]).then(([o]) => {
      setOrder(o)
    }).catch(e => {
      if (e.message === 'NEXT_REDIRECT') return
      alert(e.message || '訂單載入失敗')
      router.push('/editor/orders')
    }).finally(() => setBusy(false))
  }, [id, pageSize, fetchSegments])

  const getDirtyPayload = useCallback(() =>
    segments.filter(s => dirtyIndices.has(s.index)).map(s => ({
      index:           s.index,
      translated:      s.translated,
      editor_comments: s.editor_comments,
    })), [segments, dirtyIndices])

  const saveCurrentPage = useCallback(async () => {
    const payload = getDirtyPayload()
    if (payload.length === 0) return
    await ltUpdateSegments(id, 'editor', payload)
  }, [id, getDirtyPayload])

  const handleSegmentChange = (index: number, value: string) => {
    setSegments(prev => prev.map(s => s.index === index ? { ...s, translated: value } : s))
    setDirtyIndices(prev => new Set(prev).add(index))
  }

  const handleCommentChange = (index: number, value: string) => {
    setSegments(prev => prev.map(s => s.index === index ? { ...s, editor_comments: value } : s))
    setDirtyIndices(prev => new Set(prev).add(index))
  }

  const handleSearchChange = (q: string) => {
    setSearchQuery(q)
    if (q) {
      ltGetSegments(id, 'editor', { limit: 200, offset: 0, q, search_all: true }).then(s => {
        setSearchResults(s.segments.map(seg => ({ index: seg.index, source: seg.source })))
        setCrossPageTotal(s.total)
      }).catch(() => {})
    } else {
      setSearchResults([])
      setCrossPageTotal(0)
    }
  }

  const handleSelectResult = async (paragraphIndex: number) => {
    const targetPage = Math.floor(paragraphIndex / pageSize) + 1
    setShowQaResult(false)
    if (targetPage !== currentPage) {
      await handlePageChange(targetPage)
    }
    setHighlightedIndex(paragraphIndex)
    setTimeout(() => setHighlightedIndex(null), 2600)
    setTimeout(() => {
      const el = document.getElementById(`segment-${paragraphIndex}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  const handlePageChange = async (page: number) => {
    setSaving(true)
    try {
      await saveCurrentPage()
      setCurrentPage(page)
      await fetchSegments(page, pageSize)
    } catch (e: any) {
      alert(e.message || '切換頁面失敗')
    } finally {
      setSaving(false)
    }
  }

  const jumpToSegment = async (paragraphIndex: number) => {
    const targetPage = Math.floor(paragraphIndex / pageSize) + 1
    setShowQaResult(false)
    await handlePageChange(targetPage)
    setHighlightedIndex(paragraphIndex)
    setTimeout(() => setHighlightedIndex(null), 2600)
    setTimeout(() => {
      const el = document.getElementById(`segment-${paragraphIndex}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  const handlePageSizeChange = async (size: number) => {
    setSaving(true)
    try {
      await saveCurrentPage()
      setPageSize(size)
      setCurrentPage(1)
      await fetchSegments(1, size)
    } catch (e: any) {
      alert(e.message || '切換頁面失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      await ltUpdateSegments(id, 'editor', segments.map(s => ({
        index: s.index,
        translated: s.translated,
        editor_comments: s.editor_comments,
      })))
      setDirtyIndices(new Set())
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
      setDirtyIndices(new Set())
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

  const navigateToMustFix = async (direction: 'prev' | 'next') => {
    if (mustFixIndices.length === 0) return
    const firstVisible = (currentPage - 1) * pageSize
    const lastVisible  = firstVisible + segments.length - 1

    let target: number | null = null
    if (direction === 'next') {
      target = mustFixIndices.find(i => i > lastVisible) ?? null
    } else {
      const rev = [...mustFixIndices].reverse()
      target = rev.find(i => i < firstVisible) ?? null
    }
    if (target === null) return

    const targetPage = Math.floor(target / pageSize) + 1
    await handlePageChange(targetPage)
  }

  if (busy) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
    </div>
  )

  if (!order) return null

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
              第 {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} 段，共 {total} 個段落
              <span className="w-1 h-1 rounded-full bg-white/20" />
              {order.word_count?.toLocaleString()} 字
              {totalMustFix > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-coral font-bold">{totalMustFix} 個待修正</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          <button onClick={() => setShowOriginal(true)}
            className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-mist hover:text-paper hover:bg-white/5 transition-all">
            原始內容
          </button>
          <button onClick={() => setShowQaResult(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${totalMustFix > 0 ? 'bg-coral/10 border-coral/30 text-coral' : 'border-white/10 text-mist hover:text-paper hover:bg-white/5'}`}>
            QA 結果{totalMustFix > 0 && ` (${totalMustFix})`}
          </button>
          <button onClick={async () => {
            try {
              const res = await ltListSupportFiles(id)
              setSupportFiles(res.files)
              setShowSupportFiles(true)
            } catch { alert('讀取參考文件失敗') }
          }}
            className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-mist hover:text-paper hover:bg-white/5 transition-all">
            參考文件
          </button>
          {order.has_sample_package && (
            <button onClick={async () => {
              setPkgLoading(true); setShowPackage(true)
              try {
                const pkg = await getSamplePackage(id)
                setSamplePkg(pkg)
                setPkgDraft({ ...pkg })
              } catch { alert('讀取試譯提案包失敗') }
              finally { setPkgLoading(false) }
            }}
              className="px-3 py-1.5 rounded-lg border border-purple-500/30 text-xs font-medium text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-all">
              試譯提案包
            </button>
          )}
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

      {/* Must-fix Navigation */}
      {totalMustFix > 0 && (
        <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-coral/10 border border-coral/20">
          <span className="text-sm font-bold text-coral">{totalMustFix} 個待修正段落</span>
          <span className="text-xs text-mist">
            （第 {mustFixIndices.map(i => Math.floor(i / pageSize) + 1).filter((v, k, a) => a.indexOf(v) === k).join('、')} 頁）
          </span>
          <div className="flex-1" />
          <button onClick={() => navigateToMustFix('prev')}
            className="px-3 py-1.5 rounded-lg border border-coral/30 text-xs font-medium text-coral hover:bg-coral/10 transition-all">
            上一處修正
          </button>
          <button onClick={() => navigateToMustFix('next')}
            className="px-3 py-1.5 rounded-lg bg-coral text-xs font-bold text-white hover:bg-coral-light hover:scale-105 transition-all">
            下一處修正
          </button>
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="max-w-[1400px] mx-auto p-6 space-y-4">
          <div className="sticky top-0 z-10 bg-night/90 backdrop-blur-sm rounded-xl pb-3 mb-2">
            <SearchBar value={searchQuery} onChange={handleSearchChange} onSelectResult={handleSelectResult} results={searchResults} totalMatches={searchQuery ? crossPageTotal : undefined} theme="purple" />
          </div>
          {segments.map((seg) => {
            const unresolvedFlags = (seg.flags || []).filter(f => !f.resolved)
            const hasMustFix = unresolvedFlags.some(f => f.flag_level === 'must_fix')
            const isUntranslated = unresolvedFlags.some(f => f.flag_type === 'untranslated')

            return (
              <div id={`segment-${seg.index}`} key={seg.index} className={`group grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300`} style={{
                transition: 'box-shadow 2.5s ease-out, background 2.5s ease-out',
                ...(seg.index === highlightedIndex ? { boxShadow: 'inset 0 0 0 2px rgba(184,133,42,0.5), 0 0 20px rgba(184,133,42,0.2)', background: 'rgba(184,133,42,0.05)', borderRadius: '0.75rem' } : {}),
              }}>
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
                    <AutoResizeTextarea
                      value={seg.translated}
                      onChange={(e) => handleSegmentChange(seg.index, e.target.value)}
                      placeholder="修正譯文..."
                      className="w-full bg-transparent text-sm text-paper leading-relaxed resize-none focus:outline-none placeholder:text-mist/30 no-scrollbar"
                    />
                  </div>

                  {/* QA Flag indicators */}
                  {unresolvedFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {unresolvedFlags.map((flag) => (
                        <span key={flag.id} className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${flag.flag_level === 'must_fix' ? 'bg-coral/10 text-coral border border-coral/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                          {flag.flag_type === 'untranslated' ? '未翻譯' : flag.flag_type === 'missing_translation' ? '漏譯' : flag.flag_type === 'segment_count_mismatch' ? '段落數不符' : flag.flag_type === 'number_inconsistency' ? '數字不一致' : flag.flag_type}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Editor Comments */}
                <AutoResizeTextarea
                  value={seg.editor_comments || ''}
                  onChange={(e) => handleCommentChange(seg.index, e.target.value)}
                  placeholder={hasMustFix ? '請填寫修正說明（必填）' : '給校對的備註（選填）'}
                  className={`px-3 py-2 rounded-lg bg-white/5 border text-xs transition-all placeholder:text-mist/20 focus:text-paper focus:outline-none resize-none no-scrollbar ${hasMustFix ? 'border-coral/30 focus:border-coral/50' : 'border-white/10 focus:border-gold/30'}`}
                />
                </div>
              </div>
            )
          })}

          {/* Pagination */}
          <Pagination
            total={total}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            theme="dark"
          />
        </div>
      </div>

      <OriginalContentViewer
        open={showOriginal}
        onClose={() => setShowOriginal(false)}
        fetchContent={() => ltGetOriginalContent(id)}
      />

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

      {/* Support Files Modal */}
      {showSupportFiles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowSupportFiles(false)}>
          <div className="w-full max-w-lg max-h-[60vh] bg-night border border-white/10 rounded-2xl p-6 space-y-3 overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-paper">參考文件</h3>
              <button onClick={() => setShowSupportFiles(false)}
                className="p-1 rounded hover:bg-white/10 text-mist hover:text-paper transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {supportFiles.length === 0 ? (
              <p className="text-sm text-mist">尚無參考文件</p>
            ) : (
              supportFiles.map(f => (
                <button key={f.id} onClick={() => setViewingSupportFile({ orderId: id, fileId: f.id })}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10 transition-all text-left">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-paper truncate">{f.filename}</p>
                    <p className="text-[10px] text-mist">{f.file_role} · {(f.file_size / 1024).toFixed(1)} KB</p>
                  </div>
                  <svg className="w-4 h-4 text-mist shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <OriginalContentViewer
        open={viewingSupportFile !== null}
        onClose={() => setViewingSupportFile(null)}
        fetchContent={() => {
          if (!viewingSupportFile) throw new Error('No file selected')
          return ltGetSupportFileContent(viewingSupportFile.orderId, viewingSupportFile.fileId)
        }}
      />

      {/* Sample Package Modal */}
      {showPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowPackage(false)}>
          <div className="w-full max-w-2xl max-h-[80vh] bg-night border border-white/10 rounded-2xl p-6 space-y-4 overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-paper">試譯提案包</h3>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  samplePkg?.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  samplePkg?.status === 'generated' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-mist/10 text-mist border border-white/10'
                }`}>
                  {samplePkg?.status === 'completed' ? '已完成' : samplePkg?.status === 'generated' ? '已產生' : '草稿'}
                </span>
              </div>
              <button onClick={() => setShowPackage(false)}
                className="p-1 rounded hover:bg-white/10 text-mist hover:text-paper transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {pkgLoading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>
            ) : (
              <>
                {/* 2. Book Fact Sheet */}
                <div>
                  <label className="text-xs font-bold text-mist uppercase tracking-wider">書目資料表</label>
                  {([
                    ['title_original', 'title_target', '書名'],
                    ['author_original', 'author_target', '作者'],
                    ['publisher_original', 'publisher_target', '出版社'],
                    ['pub_date_original', 'pub_date_target', '出版日期'],
                    ['category_original', 'category_target', '類別'],
                    ['sales_original', 'sales_target', '銷售資訊'],
                  ] as const).map(([origKey, tgtKey, label]) => (
                    <div key={origKey} className="mt-2">
                      <label className="text-[10px] text-mist/60">{label}</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <input type="text" placeholder="原文"
                          value={(pkgDraft.book_fact_sheet as any)?.[origKey] || ''}
                          onChange={e => setPkgDraft(prev => ({
                            ...prev,
                            book_fact_sheet: { ...(prev.book_fact_sheet || {}), [origKey]: e.target.value }
                          }))}
                          className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-paper focus:outline-none focus:border-purple-500/50"
                        />
                        <input type="text" placeholder="譯文"
                          value={(pkgDraft.book_fact_sheet as any)?.[tgtKey] || ''}
                          onChange={e => setPkgDraft(prev => ({
                            ...prev,
                            book_fact_sheet: { ...(prev.book_fact_sheet || {}), [tgtKey]: e.target.value }
                          }))}
                          className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-paper focus:outline-none focus:border-purple-500/50"
                        />
                      </div>
                    </div>
                  ))}
                  <div className="mt-2">
                    <label className="text-[10px] text-mist/60">字數</label>
                    <input type="text"
                      value={(pkgDraft.book_fact_sheet as any)?.word_count || ''}
                      onChange={e => setPkgDraft(prev => ({
                        ...prev,
                        book_fact_sheet: { ...(prev.book_fact_sheet || {}), word_count: e.target.value }
                      }))}
                      className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-paper focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                </div>

                {/* 3. Synopsis */}
                <div>
                  <label className="text-xs font-bold text-mist uppercase tracking-wider">故事大綱</label>
                  <textarea
                    value={pkgDraft.synopsis || ''}
                    onChange={e => setPkgDraft(prev => ({ ...prev, synopsis: e.target.value }))}
                    rows={8}
                    className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-paper leading-relaxed resize-none focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                {/* 1. Translator Bio */}
                <div>
                  <label className="text-xs font-bold text-mist uppercase tracking-wider">譯者簡介</label>
                  <textarea
                    value={pkgDraft.translator_bio || ''}
                    onChange={e => setPkgDraft(prev => ({ ...prev, translator_bio: e.target.value }))}
                    rows={4}
                    className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-paper leading-relaxed resize-none focus:outline-none focus:border-purple-500/50"
                    placeholder="可從個人設定同步譯者簡介..."
                  />
                </div>

                {/* 5. Market Analysis */}
                <div>
                  <label className="text-xs font-bold text-mist uppercase tracking-wider">市場分析</label>
                  <textarea
                    value={pkgDraft.market_analysis || ''}
                    onChange={e => setPkgDraft(prev => ({ ...prev, market_analysis: e.target.value }))}
                    rows={4}
                    className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-paper leading-relaxed resize-none focus:outline-none focus:border-purple-500/50"
                    placeholder="同類作品比較、目標市場分析、推薦原因..."
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-bold text-mist uppercase tracking-wider">備註</label>
                  <textarea
                    value={pkgDraft.notes || ''}
                    onChange={e => setPkgDraft(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-mist leading-relaxed resize-none focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={async () => {
                    if (!confirm('重新產生將覆蓋已編輯的內容，確定繼續？')) return
                    setPkgSaving(true)
                    try {
                      const result = await editorGenerateSamplePackage(id)
                      setPkgDraft({
                        translator_bio: result.translator_bio,
                        book_fact_sheet: result.book_fact_sheet,
                        synopsis: result.synopsis,
                        market_analysis: result.market_analysis || '',
                        notes: pkgDraft.notes || '',
                      })
                      setSamplePkg(prev => prev ? { ...prev, ...result, status: 'generated' } : null)
                      alert('試譯提案包已重新產生')
                    } catch (e: any) { alert(e.message || '重新產生失敗') }
                    finally { setPkgSaving(false) }
                  }} disabled={pkgSaving}
                    className="px-4 py-2 rounded-lg border border-purple-500/30 text-sm text-purple-400 hover:bg-purple-500/10 transition-all">
                    {pkgSaving ? '產生中...' : '重新產生'}
                  </button>
                  <button onClick={async () => {
                    setPkgSaving(true)
                    try {
                      await updateSamplePackage(id, {
                        translator_bio: pkgDraft.translator_bio,
                        book_fact_sheet: pkgDraft.book_fact_sheet,
                        synopsis: pkgDraft.synopsis,
                        market_analysis: pkgDraft.market_analysis,
                        notes: pkgDraft.notes,
                      })
                      const updated = await getSamplePackage(id)
                      setSamplePkg(updated)
                      setPkgDraft({ ...updated })
                      alert('試譯提案包已儲存')
                    } catch (e: any) { alert(e.message || '儲存失敗') }
                    finally { setPkgSaving(false) }
                  }} disabled={pkgSaving}
                    className="px-5 py-2 rounded-lg bg-purple-600 text-sm font-bold text-white hover:bg-purple-500 transition-all">
                    {pkgSaving ? '儲存中...' : '儲存'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
