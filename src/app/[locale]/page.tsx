'use client'
import { useState, useEffect } from 'react'
import { useRouter, Link } from '@/i18n/routing'
import { PortalHeader } from '@/components/portal/header'
import { useAuth } from '@/lib/auth-context'
import { createOrder, getUploadUrl, uploadFile, confirmUpload, getMe,
  getSupportUploadUrl, confirmSupportUpload, generateSamplePackage, ApiError, getLanguages, LanguageConfig } from '@/lib/api'
import { useTranslations } from 'next-intl'
import { extractTextAndCountWords } from '@/lib/file-extractor'

interface SupportFile {
  file: File
  role: 'reference' | 'glossary' | 'style_guide' | 'background' | 'other'
}

export default function HomePage() {
  const MAX_FILE_SIZE = 2 * 1024 * 1024
  const MAX_ORDER_SIZE = 18 * 1024 * 1024

  const { user, loading } = useAuth()
  const router = useRouter()
  const t = useTranslations('Home')
  const [userRoles, setUserRoles] = useState<{ is_admin: boolean; is_editor: boolean; is_qa: boolean } | null>(null)
  const [pendingActivation, setPendingActivation] = useState(false)

  useEffect(() => {
    if (user) {
      getMe()
        .then(me => setUserRoles({ is_admin: me.is_admin, is_editor: me.is_editor, is_qa: me.is_qa }))
        .catch((e: unknown) => {
          if (e instanceof ApiError && e.status === 403) {
            setPendingActivation(true)
          }
        })
    } else {
      setUserRoles(null)
      setPendingActivation(false)
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
  const [supportFiles, setSupportFiles] = useState<SupportFile[]>([])
  const [samplePackage, setSamplePackage] = useState(false)

  const isLT = form.track_type === 'literary'
  const prevTrack = form.track_type

  const set = (k: string, v: string) => {
    if (k === 'track_type' && v !== prevTrack) {
      setWordCount(0)
      setFile(null)
      setSupportFiles([])
      setSamplePackage(false)
    }
    setForm(f => ({ ...f, [k]: v }))
  }

  const [activeLangs, setActiveLangs] = useState<LanguageConfig[]>([])

  useEffect(() => {
    getLanguages().then(res => {
      setActiveLangs(res.languages)
      if (res.languages.length > 0) {
        const sources = res.languages.filter(l => l.direction === 'source' || l.direction === 'both')
        const targets = res.languages.filter(l => l.direction === 'target' || l.direction === 'both')
        setForm(f => ({
          ...f,
          source_lang: sources.some(s => s.code === f.source_lang) ? f.source_lang : (sources[0]?.code || 'tai-lo'),
          target_lang: targets.some(t => t.code === f.target_lang) ? f.target_lang : (targets[0]?.code || 'en'),
        }))
      }
    }).catch(console.error)
  }, [])

  const sourceOptions = activeLangs.filter(l => l.direction === 'source' || l.direction === 'both')
  const targetOptions = activeLangs.filter(l => l.direction === 'target' || l.direction === 'both')

  const targetMultiplier = activeLangs.find(l => l.code === form.target_lang)?.price_multiplier || 1.0

  const estimatedPrice = !isLT && wordCount > 0
    ? Math.max(
        Math.round(wordCount * 2 * targetMultiplier),
        2000
      )
    : 0

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null
    setFile(f)
    if (!f) { setWordCount(0); return }
    if (f.size > MAX_FILE_SIZE) {
      setError(`檔案超過 ${MAX_FILE_SIZE / (1024 * 1024)} MB 上限（${(f.size / (1024 * 1024)).toFixed(1)} MB）`)
      setFile(null)
      setWordCount(0)
      e.target.value = ''
      return
    }
    setError('')
    const wc = await extractTextAndCountWords(f)
    if (isLT) {
      if (wc >= 200000) {
        setError('字數超過 200,000 字上限，請聯繫客服了解更多資訊。')
        setFile(null)
        setWordCount(0)
        e.target.value = ''
        return
      }
    } else {
      if (wc >= 5000) {
        setError(`Fast Track 字數上限為 5,000 字（您的文件約 ${wc.toLocaleString()} 字），建議選擇 Literary Track 或拆分文件。`)
        setFile(null)
        setWordCount(0)
        e.target.value = ''
        return
      }
    }
    setWordCount(wc)
  }

  async function handleSupportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    const newFiles: SupportFile[] = []
    for (const f of Array.from(files)) {
        if (f.size > MAX_FILE_SIZE) {
            setError(`檔案 ${f.name} 超過 ${MAX_FILE_SIZE / (1024 * 1024)} MB 上限（${(f.size / (1024 * 1024)).toFixed(1)} MB）`)
            continue
        }
        newFiles.push({ file: f, role: 'reference' })
    }
    if (newFiles.length > 0) setError('')
    setSupportFiles(prev => [...prev, ...newFiles])
    e.target.value = ''
  }

  function removeSupportFile(index: number) {
    setSupportFiles(prev => prev.filter((_, i) => i !== index))
  }

  function updateSupportFileRole(index: number, role: SupportFile['role']) {
    setSupportFiles(prev => prev.map((sf, i) => i === index ? { ...sf, role } : sf))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { router.push('/login'); return }
    if (!file) { setError('請選擇要上傳的文件'); return }
    if (samplePackage && supportFiles.length === 0) { setError('請上傳至少一份參考文件以產生試譯包'); return }

    const totalSize = file.size + supportFiles.reduce((s, sf) => s + sf.file.size, 0)
    if (totalSize > MAX_ORDER_SIZE) {
      setError(`所有檔案總和超過 ${MAX_ORDER_SIZE / (1024 * 1024)} MB 上限（${(totalSize / (1024 * 1024)).toFixed(1)} MB）`)
      return
    }

    if (isLT && wordCount >= 200000) {
      setError('字數超過 200,000 字上限，請聯繫客服了解更多資訊。')
      return
    }
    if (!isLT && wordCount >= 5000) {
      setError(`Fast Track 字數上限為 5,000 字，建議選擇 Literary Track 或拆分文件。`)
      return
    }

    setError(''); setBusy(true)
    try {
      const order = await createOrder({ ...form, title: form.title.trim() || undefined, word_count: wordCount || 1, sample_package: samplePackage })
      setOrderId(order.order_id); setPrice(order.price_ntd); setStep('upload')

      // Upload main file
      const { signed_url, gcs_path } = await getUploadUrl({
        order_id: order.order_id, filename: file.name, content_type: file.type || 'text/plain', file_size: file.size,
      })
      await uploadFile(signed_url, file, setProgress)
      await confirmUpload(order.order_id, gcs_path)

      // Upload support files (LT only)
      if (isLT && supportFiles.length > 0) {
        for (let i = 0; i < supportFiles.length; i++) {
          const sf = supportFiles[i]
          const { signed_url: sfUrl, gcs_path: sfPath } = await getSupportUploadUrl(
            order.order_id, sf.file.name, sf.file.type || 'text/plain'
          )
          await uploadFile(sfUrl, sf.file)
          await confirmSupportUpload(order.order_id, {
            filename: sf.file.name,
            content_type: sf.file.type || 'text/plain',
            file_size: sf.file.size,
            gcs_path: sfPath,
            file_role: sf.role,
          })
        }
      }

      // Auto-generate sample package if opted in
      if (samplePackage) {
        try {
          await generateSamplePackage(order.order_id)
        } catch {
          // Non-fatal: generation will be available in editor
        }
      }

      setStep('confirm')
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        setError('您的帳號尚未啟用，請等待管理員審核後再建立訂單。')
        setPendingActivation(true)
      } else {
        setError(err instanceof Error ? err.message : '發生錯誤，請稍後再試')
      }
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
                { id: 'literary', name: 'Literary Track', sub: '文學精譯', desc: '詩集・小說・劇本，母語文學編輯全程參與，可附參考文件', rate: '報價制' },
              ].map(track => (
                <div key={track.id} onClick={() => set('track_type', track.id)} style={{
                  background: form.track_type === track.id ? 'white' : 'rgba(255,255,255,0.5)',
                  border: `2px solid ${form.track_type === track.id ? (track.id === 'literary' ? '#7c3aed' : 'var(--gold)') : 'rgba(26,26,46,0.1)'}`,
                  borderRadius: 12, padding: '1rem', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{track.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--mist)', marginLeft: '0.5rem' }}>{track.sub}</span>
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${form.track_type === track.id ? (track.id === 'literary' ? '#7c3aed' : 'var(--gold)') : '#d1d5db'}`, background: form.track_type === track.id ? (track.id === 'literary' ? '#7c3aed' : 'var(--gold)') : 'white', flexShrink: 0 }} />
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5, marginBottom: '0.4rem' }}>{track.desc}</p>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: track.id === 'literary' ? '#7c3aed' : 'var(--gold)' }}>{track.rate}</p>
                </div>
              ))}
            </div>

            {/* Track-specific info callout */}
            {isLT && (
              <div style={{ marginTop: '0.75rem', background: '#f5f3ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '0.75rem' }}>
                <p style={{ fontSize: '0.78rem', color: '#6d28d9', fontWeight: 600, marginBottom: '0.3rem' }}>Literary Track 流程</p>
                <ol style={{ fontSize: '0.72rem', color: '#7c3aed', lineHeight: 1.8, margin: 0, paddingLeft: '1.2rem' }}>
                  <li>送出訂單與檔案</li>
                  <li>管理員審閱並提供報價</li>
                  <li>您確認報價並付款</li>
                  <li>編輯與校對開始翻譯</li>
                </ol>
              </div>
            )}
            {!isLT && (
              <div style={{ marginTop: '0.75rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '0.75rem' }}>
                <p style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 600, marginBottom: '0.3rem' }}>Fast Track 流程</p>
                <ol style={{ fontSize: '0.72rem', color: '#78350f', lineHeight: 1.8, margin: 0, paddingLeft: '1.2rem' }}>
                  <li>送出訂單，線上付款</li>
                  <li>AI 翻譯 + QA 審閱</li>
                  <li>48 小時內交付</li>
                </ol>
              </div>
            )}
          </div>

          {/* Pending activation */}
          {user && pendingActivation ? (
            <div className="card" style={{ textAlign: 'center', borderTop: '3px solid var(--gold)' }}>
              <div style={{ width: 48, height: 48, background: '#fef3c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              </div>
              <h2 className="font-display" style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>帳號尚未啟用</h2>
              <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.7, marginBottom: '1rem' }}>
                您的帳號正在等待管理員啟用。<br />
                啟用後即可開始建立翻譯訂單。<br />
                若有疑問請聯繫管理員。
              </p>
              <Link href="/orders" className="btn btn-outline" style={{ fontSize: '0.8rem' }}>查看我的訂單</Link>
            </div>
          ) : step === 'confirm' ? (
            <div className="card fade-up" style={{ textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>訂單已建立</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--mist)', marginBottom: '0.25rem' }}>訂單編號：<code>{orderId.slice(-8).toUpperCase()}</code></p>
              {isLT ? (
                <div style={{ background: '#f5f3ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '1rem', textAlign: 'left', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6d28d9', marginBottom: '0.4rem' }}>報價處理中</p>
                  <p style={{ fontSize: '0.75rem', color: '#7c3aed', lineHeight: 1.7 }}>
                    Literary Track 訂單需由管理員審閱後提供報價。<br />
                    請至「我的訂單」查看狀態，報價後即可付款。
                  </p>
                </div>
              ) : (
                <>
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
                </>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <Link href={`/orders/${orderId}`} className="btn btn-primary">查看訂單</Link>
                <Link href="/orders" className="btn btn-outline">我的訂單</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card" style={{ borderTop: `3px solid ${isLT ? '#7c3aed' : 'var(--gold)'}` }}>
              <p style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isLT ? (
                  <>
                    <span style={{ background: '#7c3aed', color: 'white', fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: 6 }}>LT</span>
                    文學翻譯訂單
                  </>
                ) : (
                  <>
                    <span style={{ background: 'var(--gold)', color: 'white', fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: 6 }}>FT</span>
                    快速翻譯訂單
                  </>
                )}
              </p>

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
                    {sourceOptions.length > 0 ? sourceOptions.map(o => <option key={o.code} value={o.code}>{o.label_zh}</option>) : <option>載入中...</option>}
                  </select>
                </div>
                <div>
                  <label className="field-label">目標語言</label>
                  <select className="field" value={form.target_lang} onChange={e => set('target_lang', e.target.value)}>
                    {targetOptions.length > 0 ? targetOptions.map(o => <option key={o.code} value={o.code}>{o.label_zh}</option>) : <option>載入中...</option>}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label className="field-label">上傳原文檔案</label>
                <p style={{ fontSize: '0.7rem', color: isLT ? '#7c3aed' : '#b5882a', marginBottom: '0.3rem' }}>
                  {isLT ? '字數上限 200,000 字，超過請聯繫客服' : '字數上限 5,000 字'}
                </p>
                <input type="file"             accept=".txt,.docx,.pdf,.html,.md" onChange={handleFileChange}
                  style={{ display: 'block', width: '100%', fontSize: '0.8rem', color: '#64748b', cursor: 'pointer', padding: '0.375rem 0' }} />
                {file && (
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--mist)' }}>{file.name} ({Math.round(file.size / 1024)} KB)</span>
                    {wordCount > 0 && <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isLT ? '#7c3aed' : 'var(--gold)' }}>≈ {wordCount.toLocaleString()} 字</span>}
                  </div>
                )}
              </div>

              {isLT && wordCount > 0 && (
                <div style={{ background: '#f5f3ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', color: '#6d28d9', fontWeight: 600 }}>字數已計算</span>
                    <span style={{ fontSize: '0.8rem', color: '#7c3aed' }}>{wordCount.toLocaleString()} 字</span>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: '#8b5cf6', marginTop: '0.2rem' }}>報價將在管理員審閱後提供</p>
                </div>
              )}

              {!isLT && estimatedPrice > 0 && (
                <div style={{ background: 'rgba(184,133,42,0.07)', border: '1px solid rgba(184,133,42,0.2)', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>預估報價</span>
                    <span style={{ fontWeight: 700, color: 'var(--ink)' }}>NT${estimatedPrice.toLocaleString()}</span>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>{wordCount.toLocaleString()} 字・依實際報價為準</p>
                </div>
              )}

              {/* LT Support Files */}
              {isLT && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <label className="field-label">
                    參考文件{samplePackage ? '（必填）' : '（選填）'}
                  </label>
                  <p style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.4rem' }}>
                    {samplePackage
                      ? '試譯包需要至少一份參考文件。上傳詞彙表、風格指南、背景資料等。'
                      : '可上傳詞彙表、風格指南、背景資料等，幫助提升翻譯品質'}
                  </p>
                   <input type="file" multiple accept=".txt,.docx,.pdf,.xlsx,.csv,.html,.md" onChange={handleSupportFileChange}
                    style={{ display: 'block', width: '100%', fontSize: '0.8rem', color: '#64748b', cursor: 'pointer', padding: '0.375rem 0' }} />
                  {supportFiles.length > 0 && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {supportFiles.map((sf, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f5f3ff', borderRadius: 6, padding: '0.4rem 0.5rem' }}>
                          <span style={{ fontSize: '0.72rem', color: '#7c3aed', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sf.file.name} ({Math.round(sf.file.size / 1024)} KB)
                          </span>
                          <select
                            value={sf.role}
                            onChange={e => updateSupportFileRole(i, e.target.value as SupportFile['role'])}
                            style={{ fontSize: '0.65rem', border: '1px solid #e9d5ff', borderRadius: 4, padding: '0.2rem', color: '#6d28d9', background: 'white' }}
                          >
                            <option value="reference">參考</option>
                            <option value="glossary">詞彙表</option>
                            <option value="style_guide">風格指南</option>
                            <option value="background">背景資料</option>
                            <option value="other">其他</option>
                          </select>
                          <button type="button" onClick={() => removeSupportFile(i)} style={{ fontSize: '0.7rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem 0.3rem' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sample Package checkbox */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={samplePackage}
                      onChange={e => setSamplePackage(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#7c3aed' }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#6d28d9', fontWeight: 600 }}>
                      需要試譯提案包（Sample Translation Package）
                    </span>
                  </label>
                  {samplePackage && (
                    <p style={{ fontSize: '0.7rem', color: '#7c3aed', marginTop: '0.3rem', lineHeight: 1.5 }}>
                      系統將從參考文件提取內容，自動產生書目資料表與故事大綱（Gemini 生成），
                      編輯與校對人員可在審閱頁面編輯所有內容。交付後可下載完整試譯包。
                    </p>
                  )}
                </div>
              )}

              <div style={{ marginBottom: '0.75rem' }}>
                <label className="field-label">訂單標題（選填）</label>
                <input type="text" maxLength={50} placeholder={isLT ? '例：台語 → English 文學翻譯' : '不填則自動產生，例：台語 → English 快速翻譯'}
                  className="field" value={form.title}
                  onChange={e => set('title', e.target.value)} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="field-label">備注（選填）</label>
                <textarea rows={2} placeholder={isLT ? '文體風格偏好、目标讀者、術語建議…' : '術語偏好、特殊要求…'} className="field" style={{ resize: 'none' }}
                  value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>

              {error && <p style={{ fontSize: '0.8rem', color: 'var(--coral)', marginBottom: '0.75rem' }}>{error}</p>}

              {user ? (
                <button type="submit" disabled={busy} className="btn btn-gold" style={{ width: '100%', padding: '0.7rem', background: isLT ? '#7c3aed' : undefined }}>
                  {busy ? '處理中…' : (isLT ? '送出訂單（等待報價）' : '送出訂單')}
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
