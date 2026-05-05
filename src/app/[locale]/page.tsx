'use client'
import { useState, useEffect } from 'react'
import { useRouter, Link } from '@/i18n/routing'
import { PortalHeader } from '@/components/portal/header'
import { useAuth } from '@/lib/auth-context'
import { createOrder, getUploadUrl, uploadFile, confirmUpload, getMe } from '@/lib/api'
import { useTranslations } from 'next-intl'
import { extractTextAndCountWords } from '@/lib/file-extractor'

const LANG_OPTIONS = [
  { value: 'tai-lo',     label: '台語（台羅拼音）' },
  { value: 'hakka',      label: '客語' },
  { value: 'indigenous', label: '原住民族語' },
  { value: 'zh-tw',      label: '繁體中文' },
]
const TARGET_LANG_OPTIONS = [
  { value: 'en',    label: 'English' },
  { value: 'ja',    label: '日本語' },
  { value: 'ko',    label: '한국어' },
  { value: 'zh-tw', label: '繁體中文' },
]

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const t = useTranslations('Home')
  const [userRoles, setUserRoles] = useState<{ is_admin: boolean; is_editor: boolean; is_qa: boolean } | null>(null)

  useEffect(() => {
    if (user) {
      getMe().then(me => setUserRoles({ is_admin: me.is_admin, is_editor: me.is_editor, is_qa: me.is_qa })).catch(() => {})
    } else {
      setUserRoles(null)
    }
  }, [user])
  const [form, setForm]     = useState({ track_type: 'fast', source_lang: 'tai-lo', target_lang: 'en', title: '', notes: '' })
  const [wordCount, setWordCount] = useState(0)
  const [file, setFile]     = useState<File | null>(null)
  const [step, setStep]     = useState<'form' | 'upload' | 'confirm'>('form')
  const [progress, setProgress] = useState(0)
  const [error, setError]   = useState('')
  const [busy, setBusy]     = useState(false)
  const [orderId, setOrderId] = useState('')
  const [price, setPrice]   = useState(0)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const estimatedPrice = wordCount > 0
    ? Math.max(
        Math.round(wordCount * (form.track_type === 'fast' ? 2 : 6) * (form.target_lang === 'ja' ? 1.2 : 1)),
        form.track_type === 'fast' ? 2000 : 20000
      )
    : 0

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null
    setFile(f)
    if (!f) { setWordCount(0); return }
    setWordCount(await extractTextAndCountWords(f))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { router.push('/login'); return }
    if (!file) { setError('請選擇要上傳的文件'); return }
    setError(''); setBusy(true)
    try {
      const order = await createOrder({ ...form, title: form.title.trim() || undefined, word_count: wordCount || 1 })
      setOrderId(order.order_id); setPrice(order.price_ntd); setStep('upload')
      const { signed_url, gcs_path } = await getUploadUrl({ order_id: order.order_id, filename: file.name, content_type: file.type || 'text/plain' })
      await uploadFile(signed_url, file, setProgress)
      await confirmUpload(order.order_id, gcs_path)
      setStep('confirm')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '發生錯誤，請稍後再試')
      setStep('form')
    } finally { setBusy(false) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <PortalHeader />

      {/* Hero */}
      <div style={{ padding: '3.5rem 1rem 2rem', textAlign: 'center' }} className="fade-up">
        <div className="page-container">
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.15em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '1rem' }}>Original Tale Studio</p>
          <h1 className="font-display" style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, marginBottom: '0.75rem' }}>
            {t('title')}<span style={{ color: 'var(--gold)' }}>{t('titleHighlight')}</span>
          </h1>
          <p style={{ color: 'var(--mist)', maxWidth: 480, margin: '0 auto 1.5rem', lineHeight: 1.7 }}>
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Role-based dashboard links */}
      {user && userRoles && (userRoles.is_admin || userRoles.is_editor || userRoles.is_qa) && (
        <div style={{ padding: '0 1rem' }}>
          <div className="page-container" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
            {userRoles.is_admin && (
              <Link href="/admin" className="btn btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
                管理後台
              </Link>
            )}
            {(userRoles.is_editor || userRoles.is_qa) && (
              <Link href="/editor" className="btn btn-outline" style={{ padding: '0.5rem 1.5rem', borderColor: 'var(--gold)', color: 'var(--gold)' }}>
                審閱後台
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Content grid */}
      <div style={{ padding: '0 1rem 4rem' }}>
        <div className="page-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>

          {/* Tracks */}
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>翻譯方案</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { id: 'fast',     name: 'Fast Track',    sub: '48 小時', desc: '學術文獻・新聞・商務文件，AI 輔助 + QA 審閱', rate: 'NT$2/字起' },
                { id: 'literary', name: 'Literary Track', sub: '文學精譯', desc: '詩集・小說・劇本，母語文學編輯全程參與',      rate: 'NT$6/字起' },
              ].map(t => (
                <div key={t.id} onClick={() => set('track_type', t.id)} style={{
                  background: form.track_type === t.id ? 'white' : 'rgba(255,255,255,0.5)',
                  border: `2px solid ${form.track_type === t.id ? 'var(--gold)' : 'rgba(26,26,46,0.1)'}`,
                  borderRadius: 12, padding: '1rem', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{t.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--mist)', marginLeft: '0.5rem' }}>{t.sub}</span>
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${form.track_type === t.id ? 'var(--gold)' : '#d1d5db'}`, background: form.track_type === t.id ? 'var(--gold)' : 'white', flexShrink: 0 }} />
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5, marginBottom: '0.4rem' }}>{t.desc}</p>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gold)' }}>{t.rate}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Form / Confirm */}
          {step === 'confirm' ? (
            <div className="card fade-up" style={{ textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>訂單已建立</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--mist)', marginBottom: '0.25rem' }}>訂單編號：<code>{orderId.slice(-8).toUpperCase()}</code></p>
              <p style={{ fontSize: '0.8rem', color: 'var(--mist)', marginBottom: '1.5rem' }}>金額：NT${price.toLocaleString()}</p>
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '1rem', textAlign: 'left', marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#92400e', marginBottom: '0.4rem' }}>付款資訊（銀行匯款）</p>
                <p style={{ fontSize: '0.75rem', color: '#78350f', lineHeight: 1.8 }}>
                  玉山銀行（808）信義分行<br />
                  戶名：木典股份有限公司<br />
                  金額：NT${price.toLocaleString()}<br />
                  備注：{orderId.slice(-8).toUpperCase()}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <Link href={`/orders/${orderId}`} className="btn btn-primary">查看訂單</Link>
                <Link href="/orders" className="btn btn-outline">我的訂單</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card">
              <p style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: '1rem' }}>建立翻譯訂單</p>

              {step === 'upload' && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.8rem', color: '#1e40af', marginBottom: '0.4rem' }}>上傳中… {progress}%</p>
                  <div style={{ height: 6, background: '#dbeafe', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#3b82f6', width: `${progress}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="field-label">原文語言</label>
                  <select className="field" value={form.source_lang} onChange={e => set('source_lang', e.target.value)}>
                    {LANG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">目標語言</label>
                  <select className="field" value={form.target_lang} onChange={e => set('target_lang', e.target.value)}>
                    {TARGET_LANG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label className="field-label">上傳原文檔案</label>
                <input type="file" accept=".txt,.docx,.pdf" onChange={handleFileChange}
                  style={{ display: 'block', width: '100%', fontSize: '0.8rem', color: '#64748b', cursor: 'pointer', padding: '0.375rem 0' }} />
                {file && (
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--mist)' }}>{file.name} ({Math.round(file.size / 1024)} KB)</span>
                    {wordCount > 0 && <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gold)' }}>≈ {wordCount.toLocaleString()} 字</span>}
                  </div>
                )}
              </div>

              {estimatedPrice > 0 && (
                <div style={{ background: 'rgba(184,133,42,0.07)', border: '1px solid rgba(184,133,42,0.2)', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>預估報價</span>
                    <span style={{ fontWeight: 700, color: 'var(--ink)' }}>NT${estimatedPrice.toLocaleString()}</span>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>{wordCount.toLocaleString()} 字・依實際報價為準</p>
                </div>
              )}

              <div style={{ marginBottom: '0.75rem' }}>
                <label className="field-label">訂單標題（選填）</label>
                <input type="text" maxLength={50} placeholder="不填則自動產生，例：台語 → English 快速翻譯"
                  className="field" value={form.title}
                  onChange={e => set('title', e.target.value)} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="field-label">備注（選填）</label>
                <textarea rows={2} placeholder="術語偏好、特殊要求…" className="field" style={{ resize: 'none' }}
                  value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>

              {error && <p style={{ fontSize: '0.8rem', color: 'var(--coral)', marginBottom: '0.75rem' }}>{error}</p>}

              {user ? (
                <button type="submit" disabled={busy} className="btn btn-gold" style={{ width: '100%', padding: '0.7rem' }}>
                  {busy ? '處理中…' : '送出訂單'}
                </button>
              ) : (
                <Link href="/login" className="btn btn-primary" style={{ width: '100%', padding: '0.7rem', textAlign: 'center' }}>
                  {t('loginToOrder')}
                </Link>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
