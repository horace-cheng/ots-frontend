'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ltGetOrder, ltGetSegments, ltUpdateSegments, ltCompleteAssignment, ltRejectAssignment,
  ltGetOriginalContent, ltListSupportFiles, ltGetSupportFileContent,
  getSamplePackage, updateSamplePackage,
  Order, QASegment, QAFlag, SupportFile, SamplePackage,
} from '@/lib/api'
import { StatusBadge, LangLabel } from '@/components/ui/status-badge'
import { Pagination } from '@/components/ui/pagination'
import { AutoResizeTextarea } from '@/components/auto-resize-textarea'
import { SearchBar } from '@/components/search-bar'
import OriginalContentViewer from '@/components/original-content-viewer'
import VersionHistoryPanel from '@/components/version-history-panel'

export default function LtProofreadPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [order,    setOrder]    = useState<Order | null>(null)
  const [segments, setSegments] = useState<QASegment[]>([])
  const [saving,   setSaving]   = useState(false)
  const [busy,     setBusy]     = useState(true)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')
  const [rejectError, setRejectError] = useState('')
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
  const [total,       setTotal]       = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize,    setPageSize]    = useState(50)
  const [dirtyIndices, setDirtyIndices] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ index: number; source: string }[]>([])
  const [crossPageTotal, setCrossPageTotal] = useState(0)
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  const [totalMustFix,   setTotalMustFix]   = useState(0)
  const [mustFixIndices, setMustFixIndices] = useState<number[]>([])
  const [currentMustFixIdx, setCurrentMustFixIdx] = useState(-1)
  const [allFlags,       setAllFlags]       = useState<QAFlag[]>([])
  const [showQaResult,   setShowQaResult]   = useState(false)
  const [showVersions,   setShowVersions]   = useState(false)

  const fetchSegments = useCallback(async (page: number, size: number) => {
    const s = await ltGetSegments(id, 'proofreader', { limit: size, offset: (page - 1) * size })
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
      ltGetOrder(id, 'proofreader'),
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
      index:                s.index,
      translated:           s.translated,
      proofreader_comments: s.proofreader_comments,
    })), [segments, dirtyIndices])

  const saveCurrentPage = useCallback(async () => {
    const payload = getDirtyPayload()
    if (payload.length === 0) return
    await ltUpdateSegments(id, 'proofreader', payload)
  }, [id, getDirtyPayload])

  const handleCommentChange = (index: number, value: string) => {
    setSegments(prev => prev.map(s => s.index === index ? { ...s, proofreader_comments: value } : s))
    setDirtyIndices(prev => new Set(prev).add(index))
  }

  const handleSearchChange = (q: string) => {
    setSearchQuery(q)
    setShowQaResult(false)
    if (q) {
      ltGetSegments(id, 'proofreader', { limit: 200, offset: 0, q, search_all: true }).then(s => {
        setSearchResults(s.segments.map(seg => ({ index: seg.index, source: seg.source })))
        setCrossPageTotal(s.total)
      }).catch(() => {})
    } else {
      setSearchResults([])
      setCrossPageTotal(0)
    }
  }

  const navigateToMustFix = async (direction: 'prev' | 'next') => {
    if (mustFixIndices.length === 0) return

    const newIdx = direction === 'next'
      ? Math.min(currentMustFixIdx + 1, mustFixIndices.length - 1)
      : Math.max(currentMustFixIdx - 1, 0)
    if (newIdx === currentMustFixIdx) return

    const target = mustFixIndices[newIdx]
    setCurrentMustFixIdx(newIdx)

    const targetPage = Math.floor(target / pageSize) + 1
    if (targetPage !== currentPage) {
      await handlePageChange(targetPage)
    }
    setShowQaResult(false)
    setHighlightedIndex(target)
    setTimeout(() => setHighlightedIndex(null), 2600)
    setTimeout(() => {
      const el = document.getElementById(`segment-${target}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
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

  const handleSelectResult = async (paragraphIndex: number) => {
    setShowQaResult(false)
    const targetPage = Math.floor(paragraphIndex / pageSize) + 1
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
      await ltUpdateSegments(id, 'proofreader', segments.map(s => ({
        index:           s.index,
        translated:      s.translated,
        proofreader_comments: s.proofreader_comments,
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
    if (!confirm('確定完成校對工作？')) return
    setSaving(true)
    try {
      await ltUpdateSegments(id, 'proofreader', segments.map(s => ({
        index:           s.index,
        translated:      s.translated,
        proofreader_comments: s.proofreader_comments,
      })))
      setDirtyIndices(new Set())
      await ltCompleteAssignment(id, 'proofreader')
      alert('校對工作已完成，訂單將進入交付階段')
      router.push('/editor/orders')
    } catch (e: any) {
      alert(e.message || '提交失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleReject = async () => {
    if (!rejectNotes.trim()) {
      setRejectError('請填寫退回原因')
      return
    }
    if (rejectNotes.length > 2000) {
      setRejectError('退回原因不能超過 2000 字')
      return
    }
    setSaving(true)
    try {
      await ltUpdateSegments(id, 'proofreader', segments.map(s => ({
        index:           s.index,
        translated:      s.translated,
        proofreader_comments: s.proofreader_comments,
      })))
      setDirtyIndices(new Set())
      await ltRejectAssignment(id, 'proofreader', rejectNotes)
      alert('已退回修改，編輯將重新處理')
      router.push('/editor/orders')
    } catch (e: any) {
      alert(e.message || '退回失敗')
    } finally {
      setSaving(false)
      setShowRejectModal(false)
    }
  }

  if (busy) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  )

  if (!order) return null

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-6 bg-night">
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
              Literary Track — 校對
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
          <button onClick={() => setShowVersions(true)}
            className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-mist hover:text-paper hover:bg-white/5 transition-all">
            版本歷史
          </button>
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
          <button onClick={() => setShowRejectModal(true)} disabled={saving}
            className="px-4 py-2 rounded-lg border border-coral/30 text-sm font-medium text-coral hover:bg-coral/10 transition-all">
            退回修改
          </button>
          <button onClick={handleComplete} disabled={saving}
            className="px-6 py-2 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/20">
            完成校對
          </button>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowRejectModal(false); setRejectError('') }}>
          <div className="w-full max-w-md bg-night border border-white/10 rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-paper">退回修改</h3>
            <p className="text-sm text-mist">請填寫退回原因，編輯將根據意見重新修改。</p>
            <textarea
              value={rejectNotes}
              onChange={e => { setRejectNotes(e.target.value); setRejectError('') }}
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-paper leading-relaxed resize-none focus:outline-none focus:border-coral/50"
              placeholder="說明需要修改的地方..."
            />
            {rejectError && <p className="text-xs text-coral">{rejectError}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowRejectModal(false); setRejectError('') }}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm text-mist hover:text-paper transition-all">
                取消
              </button>
              <button onClick={handleReject} disabled={saving}
                className="px-5 py-2 rounded-lg bg-coral text-sm font-bold text-white hover:bg-coral-light transition-all">
                {saving ? '處理中...' : '確認退回'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Must-fix Navigation */}
      {totalMustFix > 0 && (
        <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-coral/10 border border-coral/20">
          <span
            className={`text-sm font-bold transition-colors ${
              mustFixIndices.some(i => Math.floor(i / pageSize) + 1 === currentPage)
                ? 'text-amber-300'
                : 'text-coral'
            }`}
          >
            {totalMustFix} 個待修
          </span>
          <span className="text-xs text-mist">
            （第 {mustFixIndices.map(i => Math.floor(i / pageSize) + 1).filter((v, k, a) => a.indexOf(v) === k).map((page, idx, arr) => (
              <span key={page} className={page === currentPage ? 'text-amber-300 font-semibold' : ''}>
                {page}{idx < arr.length - 1 ? '、' : ''}
              </span>
            ))} 頁）
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

      {/* Proofreader Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="max-w-[1400px] mx-auto p-6 space-y-4">
          <div className="sticky top-0 z-10 bg-night/90 backdrop-blur-sm rounded-xl pb-3 mb-2">
            <SearchBar value={searchQuery} onChange={handleSearchChange} onSelectResult={handleSelectResult} results={searchResults} totalMatches={searchQuery ? crossPageTotal : undefined} theme="amber" />
          </div>
          {segments.map((seg) => {
            const unresolvedFlags = (seg.flags || []).filter(f => !f.resolved)
            const hasMustFix = unresolvedFlags.some(f => f.flag_level === 'must_fix')
            const isUntranslated = unresolvedFlags.some(f => f.flag_type === 'untranslated')

            return (
            <div id={`segment-${seg.index}`} key={seg.index} className="group grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{
              transition: 'box-shadow 2.5s ease-out, background 2.5s ease-out',
              ...(seg.index === highlightedIndex ? { boxShadow: 'inset 0 0 0 2px rgba(184,133,42,0.5), 0 0 20px rgba(184,133,42,0.2)', background: 'rgba(184,133,42,0.05)', borderRadius: '0.75rem' } : {}),
            }}>
              {/* Left: Source + NMT */}
              <div className={`space-y-2`}>
                <div className={`rounded-xl border p-4 transition-colors ${isUntranslated ? 'border-coral/40 bg-coral/[0.04]' : 'border-white/5 bg-white/[0.02]'}`}>
                  <div className="text-[10px] font-mono select-none flex items-center gap-2 mb-2">
                    <span className={isUntranslated ? 'text-coral/70' : 'text-mist/30'}>#{seg.index + 1}</span>
                    <span className="text-mist/20">原文</span>
                  </div>
                  <div className="text-sm text-mist leading-relaxed whitespace-pre-wrap">{seg.source}</div>
                </div>
                {seg.raw && (
                  <details className="group rounded-xl border border-white/5 bg-indigo-500/[0.03]">
                    <summary className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-mono text-mist/50 hover:text-mist cursor-pointer select-none list-none transition-colors">
                      <svg className="w-3 h-3 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      NMT 機器翻譯
                    </summary>
                    <div className="px-4 pb-3 text-sm text-mist/70 leading-relaxed whitespace-pre-wrap italic">
                      {seg.raw}
                    </div>
                  </details>
                )}
              </div>
              {/* Right: Editor's translation + Editor comments + Proofreader comments */}
              <div className="space-y-2">
                <div className={`rounded-xl border p-4 transition-colors ${isUntranslated ? 'border-coral/30 bg-coral/[0.03]' : 'border-emerald-500/10 bg-emerald-500/[0.03]'}`}>
                  <div className="text-[10px] font-mono text-mist/30 mb-2">編輯譯文</div>
                  <div className="text-sm text-paper leading-relaxed whitespace-pre-wrap">{seg.translated}</div>
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

                {seg.editor_comments && (
                  <div className="rounded-xl border border-blue-500/10 bg-blue-500/[0.03] p-3">
                    <div className="text-[10px] font-mono text-mist/30 mb-1">編輯備註</div>
                    <div className="text-xs text-blue-300/80 leading-relaxed whitespace-pre-wrap">{seg.editor_comments}</div>
                  </div>
                )}
                <AutoResizeTextarea
                  value={seg.proofreader_comments || ''}
                  onChange={e => handleCommentChange(seg.index, e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-xs leading-relaxed resize-none focus:outline-none no-scrollbar transition-all ${hasMustFix ? 'bg-coral/5 border-coral/30 focus:border-coral/50 placeholder-coral/30 text-coral-300' : 'bg-amber-500/5 border-amber-500/20 text-amber-300 focus:border-amber-500/50 placeholder-amber-500/30'}`}
                  placeholder={hasMustFix ? '請填寫修正說明（必填）' : '校對意見...'}
                />
              </div>
            </div>
            )
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-x border-white/10 bg-night/80 backdrop-blur-md px-6">
        <div className="max-w-[1400px] mx-auto">
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

      {/* Version History Drawer */}
      {showVersions && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowVersions(false)} />
          <div className="relative w-full max-w-md bg-[#111122] border-l-2 border-gold/40 shadow-2xl shadow-gold/5 overflow-auto">
            <div className="sticky top-0 bg-[#111122]/95 backdrop-blur-md border-b border-gold/20 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 rounded bg-gold" />
                <h2 className="text-lg font-bold text-white">版本歷史</h2>
              </div>
              <button onClick={() => setShowVersions(false)}
                className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <VersionHistoryPanel orderId={id} mode="proofreader" compact={false} />
            </div>
          </div>
        </div>
      )}

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

      {/* ── Sample Package Modal ── */}
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
                {/* Book Fact Sheet — read-only */}
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
                        <div className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-paper">
                          {(pkgDraft.book_fact_sheet as any)?.[origKey] || ''}
                        </div>
                        <div className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-paper">
                          {(pkgDraft.book_fact_sheet as any)?.[tgtKey] || ''}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="mt-2">
                    <label className="text-[10px] text-mist/60">字數</label>
                    <div className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-paper">
                      {(pkgDraft.book_fact_sheet as any)?.word_count || ''}
                    </div>
                  </div>
                </div>

                {/* Synopsis — read-only */}
                <div>
                  <label className="text-xs font-bold text-mist uppercase tracking-wider">故事大綱</label>
                  <div className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-paper leading-relaxed whitespace-pre-wrap">
                    {pkgDraft.synopsis || ''}
                  </div>
                </div>

                {/* Translator Bio — read-only */}
                <div>
                  <label className="text-xs font-bold text-mist uppercase tracking-wider">譯者簡介</label>
                  <div className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-paper leading-relaxed whitespace-pre-wrap">
                    {pkgDraft.translator_bio || ''}
                  </div>
                </div>

                {/* Market Analysis — read-only */}
                <div>
                  <label className="text-xs font-bold text-mist uppercase tracking-wider">市場分析</label>
                  <div className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-paper leading-relaxed whitespace-pre-wrap">
                    {pkgDraft.market_analysis || ''}
                  </div>
                </div>

                {/* Notes — editable */}
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
                    setPkgSaving(true)
                    try {
                      await updateSamplePackage(id, {
                        notes: pkgDraft.notes,
                      })
                      const updated = await getSamplePackage(id)
                      setSamplePkg(updated)
                      setPkgDraft({ ...updated })
                      alert('備註已儲存')
                    } catch (e: any) { alert(e.message || '儲存失敗') }
                    finally { setPkgSaving(false) }
                  }} disabled={pkgSaving}
                    className="px-5 py-2 rounded-lg bg-purple-600 text-sm font-bold text-white hover:bg-purple-500 transition-all">
                    {pkgSaving ? '儲存中...' : '儲存備註'}
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
