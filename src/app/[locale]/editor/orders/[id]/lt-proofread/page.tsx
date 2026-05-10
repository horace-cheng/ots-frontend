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

  const handleSegmentChange = (index: number, value: string) => {
    setSegments(prev => prev.map(s => s.index === index ? { ...s, translated: value } : s))
  }

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
          <button onClick={() => { setShowRejectModal(true); setRejectNotes(''); setRejectError('') }} disabled={saving}
            className="px-6 py-2 rounded-lg border border-coral/50 text-sm font-bold text-coral hover:bg-coral/10 hover:scale-105 active:scale-95 transition-all">
            退回修改
          </button>
          <button onClick={handleComplete} disabled={saving}
            className="px-6 py-2 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/20">
            完成校對
          </button>
        </div>
      </div>

      {/* Proofreader Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="max-w-[1400px] mx-auto p-6 space-y-4">
          {segments.map((seg) => {
            const allFlags = seg.flags || []
            const hasMustFix = allFlags.some(f => f.flag_level === 'must_fix' && !f.resolved)
            const isUntranslated = allFlags.some(f => f.flag_type === 'untranslated' && !f.resolved)

            return (
            <div key={seg.index} className={`group grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ${hasMustFix ? 'ring-1 ring-coral/30 rounded-xl' : ''}`}>
              {/* Left: Source + Editor's version */}
              <div className={`relative rounded-xl border p-4 transition-colors ${isUntranslated ? 'border-coral/40 bg-coral/[0.04]' : 'border-white/5 bg-white/[0.02]'} group-hover:${isUntranslated ? 'border-coral/60' : 'border-white/10'}`}>
                <div className="absolute top-3 left-3 text-[10px] font-mono select-none flex items-center gap-1.5">
                  <span className={isUntranslated ? 'text-coral/70' : 'text-mist/30'}>#{seg.index + 1}</span>
                  {isUntranslated && <span className="text-[9px] font-bold text-coral bg-coral/10 px-1.5 py-0.5 rounded uppercase tracking-tighter">未翻譯</span>}
                </div>
                <div className="mt-4 text-sm text-mist leading-relaxed whitespace-pre-wrap">
                  {seg.source}
                </div>
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-[10px] uppercase font-bold text-gold/60 mb-1">編輯譯文</p>
                  <div className="text-sm text-paper/80 leading-relaxed whitespace-pre-wrap">
                    {seg.translated || '—'}
                  </div>
                </div>
                {seg.raw && seg.raw !== seg.translated && (
                  <details className="mt-3 group/raw">
                    <summary className="text-[10px] text-mist/50 hover:text-emerald-400 cursor-pointer list-none flex items-center gap-1 transition-colors">
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

                {/* Editor Comments (read-only) */}
                {seg.editor_comments && (
                  <div className="mt-3 p-3 rounded-lg bg-gold/5 border border-gold/10">
                    <p className="text-[10px] uppercase font-bold text-gold/60 mb-1">編輯備註</p>
                    <p className="text-xs text-paper/70 whitespace-pre-wrap">{seg.editor_comments}</p>
                  </div>
                )}
              </div>

              {/* Right: Proofreader corrections */}
              <div className="flex flex-col gap-2">
                <div className={`relative rounded-xl border p-4 transition-all focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500/50 ${isUntranslated ? 'border-coral/30 bg-coral/[0.03]' : 'border-emerald-500/20 bg-emerald-500/[0.03]'}`}>
                  <textarea
                    value={seg.translated}
                    onChange={(e) => handleSegmentChange(seg.index, e.target.value)}
                    rows={Math.max(3, Math.ceil(seg.translated.length / 50))}
                    placeholder="修正譯文..."
                    className="w-full bg-transparent text-sm text-paper leading-relaxed resize-none focus:outline-none placeholder:text-mist/30"
                  />
                </div>

                {/* QA Flag indicators */}
                {allFlags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {allFlags.map((flag) => (
                      <span key={flag.id} className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${flag.resolved ? 'bg-white/5 text-mist/40 border border-white/10 line-through' : flag.flag_level === 'must_fix' ? 'bg-coral/10 text-coral border border-coral/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {flag.flag_type === 'untranslated' ? '未翻譯' : flag.flag_type === 'missing_translation' ? '漏譯' : flag.flag_type}
                        {flag.resolved && ' ✓'}
                      </span>
                    ))}
                  </div>
                )}

                {/* Proofreader Comments */}
                <textarea
                  value={seg.proofreader_comments || ''}
                  onChange={(e) => handleCommentChange(seg.index, e.target.value)}
                  rows={2}
                  placeholder="校對備註（選填）"
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs transition-all placeholder:text-mist/20 focus:text-paper focus:border-emerald-500/30 focus:outline-none resize-none"
                />
              </div>
            </div>
          )})}
        </div>
      </div>

      <OriginalContentViewer
        open={showOriginal}
        onClose={() => setShowOriginal(false)}
        fetchContent={() => ltGetOriginalContent(id)}
      />

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

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-night border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-paper">退回修改</h3>
            <p className="text-sm text-mist">請填寫退回原因，編輯將根據您的意見重新修改譯文。</p>
            <textarea
              value={rejectNotes}
              onChange={(e) => { setRejectNotes(e.target.value); setRejectError('') }}
              rows={6}
              maxLength={2000}
              placeholder="請詳細說明需要修改的部分..."
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-paper focus:border-coral/50 focus:outline-none resize-none placeholder:text-mist/30"
            />
            <div className="flex items-center justify-between">
              <span className={`text-xs ${rejectNotes.length > 1800 ? 'text-coral' : 'text-mist'}`}>
                {rejectNotes.length} / 2000
              </span>
              {rejectError && <span className="text-xs text-coral">{rejectError}</span>}
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm text-mist hover:text-paper transition-all">
                取消
              </button>
              <button onClick={handleReject} disabled={saving}
                className="px-6 py-2 rounded-lg bg-coral text-sm font-bold text-white hover:bg-coral/90 transition-all">
                {saving ? '處理中...' : '確認退回'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <div>
                  <label className="text-xs font-bold text-mist uppercase tracking-wider">書目資料表</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      ['title', '書名'], ['author', '作者'], ['publisher', '出版社'],
                      ['pub_date', '出版日期'], ['word_count', '字數'], ['category', '類別'], ['sales', '銷售資訊'],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <label className="text-[10px] text-mist/60">{label}</label>
                        <input type="text"
                          value={(pkgDraft.book_fact_sheet as any)?.[key] || ''}
                          onChange={e => setPkgDraft(prev => ({
                            ...prev,
                            book_fact_sheet: { ...(prev.book_fact_sheet || {}), [key]: e.target.value }
                          }))}
                          className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-paper focus:outline-none focus:border-purple-500/50"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-mist uppercase tracking-wider">故事大綱</label>
                  <textarea
                    value={pkgDraft.synopsis || ''}
                    onChange={e => setPkgDraft(prev => ({ ...prev, synopsis: e.target.value }))}
                    rows={8}
                    className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-paper leading-relaxed resize-none focus:outline-none focus:border-purple-500/50"
                  />
                </div>

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
