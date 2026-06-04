'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  TranslationVersion, VersionDiff, DiffSegment,
  adminListVersions, adminSaveVersion, adminRestoreVersion, adminDiffVersions, adminDiffLive,
  ltListVersions, ltDiffVersions,
} from '@/lib/api'

interface Props {
  orderId: string
  /** 'admin' = full CRUD, 'editor'/'proofreader' = read-only */
  mode?: 'admin' | 'editor' | 'proofreader'
  /** Compact mode: collapsed by default, for editor/proofreader pages */
  compact?: boolean
  /** Label for "compare current edits" — shown only in compact mode */
  currentLabel?: string
  onRefresh?: () => void
}

export default function VersionHistoryPanel({ orderId, mode = 'admin', compact, currentLabel, onRefresh }: Props) {
  const [open, setOpen] = useState(!compact)
  const [versions, setVersions] = useState<TranslationVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [diff, setDiff] = useState<VersionDiff | null>(null)
  const [diffTitle, setDiffTitle] = useState('')
  const [showDiff, setShowDiff] = useState(false)
  const [saveLabel, setSaveLabel] = useState('')
  const [showSave, setShowSave] = useState(false)

  const fetchVersions = useCallback(async () => {
    setLoading(true)
    try {
      const data = mode === 'admin'
        ? await adminListVersions(orderId)
        : await ltListVersions(orderId)
      setVersions(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [orderId, mode])

  useEffect(() => {
    if (open) fetchVersions()
  }, [open, fetchVersions])

  const handleSave = async () => {
    if (!saveLabel.trim()) return
    setBusy(true)
    try {
      await adminSaveVersion(orderId, saveLabel.trim() || undefined)
      setShowSave(false)
      setSaveLabel('')
      await fetchVersions()
      onRefresh?.()
    } catch { /* ignore */ }
    setBusy(false)
  }

  const handleRestore = async (vid: string) => {
    if (!confirm('確定還原到此版本？目前的譯文將被覆蓋。')) return
    setBusy(true)
    try {
      await adminRestoreVersion(orderId, vid)
      await fetchVersions()
      onRefresh?.()
    } catch { /* ignore */ }
    setBusy(false)
  }

  const handleDiff = async (vid: string, label: string, against?: string) => {
    setBusy(true)
    try {
      const data = mode === 'admin'
        ? against
          ? await adminDiffVersions(orderId, vid, against)
          : await adminDiffVersions(orderId, vid)
        : against
          ? await ltDiffVersions(orderId, vid, against)
          : await ltDiffVersions(orderId, vid)
      setDiff(data)
      setDiffTitle(label)
      setShowDiff(true)
    } catch { /* ignore */ }
    setBusy(false)
  }

  const handleCompareCurrent = async (vid: string, label: string) => {
    setBusy(true)
    try {
      const data = mode === 'admin'
        ? await adminDiffVersions(orderId, vid)
        : await ltDiffVersions(orderId, vid)
      setDiff(data)
      setDiffTitle(`${label} vs 目前編輯`)
      setShowDiff(true)
    } catch { /* ignore */ }
    setBusy(false)
  }

  const sourceLabel = (s: string) => ({
    nmt: 'AI 翻譯',
    editor: '編輯',
    proofreader: '校對',
    admin: '管理員',
    manual: '手動儲存',
    pre_retranslate: '重新翻譯前',
    restored: '還原',
  }[s] || s)

  return (
    <>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full text-left"
        >
          <h3 className="font-semibold text-paper">版本歷史</h3>
          <span className="text-sm text-paper/60">{open ? '收起' : `${versions.length || 0} 個版本`}</span>
        </button>

        {open && (
          <div className="mt-3 space-y-2">
            {mode === 'admin' && (
              <button
                onClick={() => setShowSave(true)}
                className="w-full py-1.5 px-3 rounded-lg bg-gold text-ink text-sm font-medium hover:scale-[1.02] transition"
              >
                + 手動儲存版本
              </button>
            )}

            {loading && <div className="text-sm text-paper/40">載入中...</div>}

            {!loading && versions.length === 0 && (
              <div className="text-sm text-paper/40">尚無版本記錄</div>
            )}

            {versions.map((v) => (
              <div key={v.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-white/5 border border-white/5 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-paper">v{v.version}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-paper/70">{sourceLabel(v.source)}</span>
                    {v.created_by_email && (
                      <span className="text-xs text-paper/40 truncate">{v.created_by_email}</span>
                    )}
                  </div>
                  {v.label && <div className="text-xs text-paper/50 mt-0.5">{v.label}</div>}
                  <div className="text-xs text-paper/40 mt-0.5">
                    {new Date(v.created_at).toLocaleString('zh-TW')}
                    {v.segment_count != null && ` · ${v.segment_count} 段落`}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {mode === 'admin' && (
                    <>
                      <button
                        onClick={() => handleRestore(v.id)}
                        className="px-2 py-1 rounded text-xs bg-gold/20 text-gold hover:bg-gold/30 transition"
                      >
                        還原
                      </button>
                      <button
                        onClick={() => handleCompareCurrent(v.id, `v${v.version}`)}
                        className="px-2 py-1 rounded text-xs bg-white/10 text-paper/70 hover:bg-white/20 transition"
                      >
                        比較
                      </button>
                    </>
                  )}
                  {(mode === 'editor' || mode === 'proofreader') && (
                    <button
                      onClick={() => handleCompareCurrent(v.id, `v${v.version}`)}
                      className="px-2 py-1 rounded text-xs bg-white/10 text-paper/70 hover:bg-white/20 transition"
                    >
                      比較當前
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save modal */}
      {showSave && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowSave(false)}>
          <div className="bg-ink rounded-xl border border-white/10 p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-paper mb-3">儲存版本</h3>
            <input
              value={saveLabel}
              onChange={e => setSaveLabel(e.target.value)}
              placeholder="版本標籤（選填）"
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-paper text-sm placeholder:text-paper/30 mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSave(false)} className="px-3 py-1.5 rounded-lg text-sm text-paper/60 hover:text-paper">取消</button>
              <button onClick={handleSave} disabled={busy} className="px-3 py-1.5 rounded-lg bg-gold text-ink text-sm font-medium hover:scale-[1.02] transition">
                儲存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff modal */}
      {showDiff && diff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowDiff(false)}>
          <div className="bg-ink rounded-xl border border-white/10 p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-paper">{diffTitle}</h3>
              <button onClick={() => setShowDiff(false)} className="text-paper/40 hover:text-paper text-xl">&times;</button>
            </div>

            {diff.changed.length === 0 && diff.added.length === 0 && diff.removed.length === 0 && (
              <div className="text-sm text-paper/50">無差異</div>
            )}

            {diff.changed.map((s, i) => (
              <div key={`c-${i}`} className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="text-xs text-paper/40 mb-1">段落 {s.index + 1}</div>
                <div className="text-xs text-paper/50 mb-2">{s.source}</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 rounded bg-white/5">
                    <div className="text-xs text-red-400 mb-0.5">舊</div>
                    {s.old}
                  </div>
                  <div className="p-2 rounded bg-white/5">
                    <div className="text-xs text-green-400 mb-0.5">新</div>
                    {s.new}
                  </div>
                </div>
              </div>
            ))}

            {diff.added.map((s, i) => (
              <div key={`a-${i}`} className="mb-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="text-xs text-paper/40 mb-1">段落 {s.index + 1}（新增）</div>
                <div className="text-xs text-paper/50 mb-1">{s.source}</div>
                <div className="text-sm text-green-300">{s.text}</div>
              </div>
            ))}

            {diff.removed.map((s, i) => (
              <div key={`r-${i}`} className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-xs text-paper/40 mb-1">段落 {s.index + 1}（刪除）</div>
                <div className="text-xs text-paper/50 mb-1">{s.source}</div>
                <div className="text-sm text-red-300 line-through">{s.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
