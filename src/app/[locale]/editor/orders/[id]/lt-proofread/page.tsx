'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ltGetOrder, ltGetSegments, ltUpdateSegments, ltCompleteAssignment, ltRejectAssignment,
  ltGetOriginalContent, ltListSupportFiles, ltGetSupportFileContent,
  getSamplePackage, updateSamplePackage,
  Order, QASegment, SupportFile, SamplePackage,
} from '@/lib/api'
import { StatusBadge, LangLabel } from '@/components/ui/status-badge'
import OriginalContentViewer from '@/components/original-content-viewer'

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

  useEffect(() => {
    setBusy(true)
    Promise.all([
      ltGetOrder(id, 'proofreader'),
      ltGetSegments(id, 'proofreader'),
    ]).then(([o, s]) => {
      setOrder(o)
      setSegments(s.segments)
    }).catch(e => {
      if (e.message === 'NEXT_REDIRECT') return
      alert(e.message || '訂單載入失敗')
      router.push('/editor/orders')
    }).finally(() => setBusy(false))
  }, [id])

  const handleCommentChange = (index: number, value: string) => {
    setSegments(prev => prev.map(s => s.index === index ? { ...s, proofreader_comments: value } : s))
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      await ltUpdateSegments(id, 'proofreader', segments.map(s => ({
        index:           s.index,
        translated:      s.translated,
        proofreader_comments: s.proofreader_comments,
      })))
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
              Literary Track — 校對
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
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          <button onClick={() => setShowOriginal(true)}
            className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-mist hover:text-paper hover:bg-white/5 transition-all">
            原始內容
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

      {/* Proofreader Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="max-w-[1400px] mx-auto p-6 space-y-4">
          {segments.map((seg) => (
            <div key={seg.index} className="group grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Left: Source + NMT */}
              <div className="space-y-2">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="text-[10px] font-mono text-mist/30 select-none flex items-center gap-2 mb-2">
                    <span>#{seg.index + 1}</span>
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
                <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-4">
                  <div className="text-[10px] font-mono text-mist/30 mb-2">編輯譯文</div>
                  <div className="text-sm text-paper leading-relaxed whitespace-pre-wrap">{seg.translated}</div>
                </div>
                {seg.editor_comments && (
                  <div className="rounded-xl border border-blue-500/10 bg-blue-500/[0.03] p-3">
                    <div className="text-[10px] font-mono text-mist/30 mb-1">編輯備註</div>
                    <div className="text-xs text-blue-300/80 leading-relaxed whitespace-pre-wrap">{seg.editor_comments}</div>
                  </div>
                )}
                <textarea
                  value={seg.proofreader_comments || ''}
                  onChange={e => handleCommentChange(seg.index, e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300 leading-relaxed resize-none focus:outline-none focus:border-amber-500/50 placeholder-amber-500/30"
                  placeholder="校對意見..."
                />
              </div>
            </div>
          ))}
        </div>
      </div>

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
