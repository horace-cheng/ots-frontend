'use client'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: '待付款', cls: 'badge-pending' },
  awaiting_quote:  { label: '待報價', cls: 'badge-pending bg-amber-50 text-amber-700 border-amber-200' },
  quoted:          { label: '已報價', cls: 'badge-paid bg-blue-50 text-blue-700 border-blue-200' },
  paid:            { label: '已付款', cls: 'badge-paid' },
  processing:      { label: '翻譯中', cls: 'badge-processing' },
  qa_review:       { label: 'QA 審閱', cls: 'badge-qa' },
  editor_verify:   { label: '編輯審閱', cls: 'badge-processing bg-purple-500/20 text-purple-400 border-purple-500/30' },
  delivered:       { label: '已交付', cls: 'badge-delivered' },
  cancelled:       { label: '已取消', cls: 'badge-cancelled' },
  revision_needed: { label: '需修改', cls: 'badge-pending bg-orange-50 text-orange-700 border-orange-200' },
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: 'badge-pending' }
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

const LANG_MAP: Record<string, string> = {
  'tai-lo':     '台語（台羅）',
  hakka:        '客語',
  indigenous:   '原住民族語',
  'zh-tw':      '繁體中文',
  en:           'English',
  ja:           '日本語',
  ko:           '한국어',
}

export function LangLabel({ code }: { code: string }) {
  return <>{LANG_MAP[code] ?? code}</>
}

const TRACK_MAP: Record<string, { label: string; cls: string }> = {
  fast:     { label: 'Fast Track',     cls: 'badge bg-blue-50 text-blue-700' },
  literary: { label: 'Literary Track', cls: 'badge bg-purple-50 text-purple-700' },
  gutenberg: { label: 'Gutenberg Track', cls: 'badge bg-emerald-50 text-emerald-700' },
}

export function TrackBadge({ track }: { track: string }) {
  const t = TRACK_MAP[track]
  if (t) return <span className={t.cls}>{t.label}</span>
  return <span className="badge bg-white/10 text-mist">{track || '—'}</span>
}
