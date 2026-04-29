'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { registerWithEmail } from '@/lib/firebase'
import { PortalHeader } from '@/components/portal/header'

export default function RegisterPage() {
  const router = useRouter()
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [error,     setError]     = useState('')
  const [busy,      setBusy]      = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('兩次輸入的密碼不一致'); return }
    if (password.length < 6)  { setError('密碼至少需 6 個字元'); return }
    setError(''); setBusy(true)
    try {
      await registerWithEmail(email, password)
      router.push('/')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('email-already-in-use')) {
        setError('此 Email 已被註冊，請直接登入')
      } else if (msg.includes('invalid-email')) {
        setError('Email 格式不正確')
      } else {
        setError('註冊失敗，請稍後再試')
      }
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-paper bg-paper-texture">
      <PortalHeader />
      <div className="mx-auto max-w-sm px-4 pt-20 pb-16 fade-up">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-ink mb-2">建立帳號</h1>
          <p className="text-sm text-mist">木典翻譯服務平台</p>
        </div>

        <div className="card space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Email</label>
              <input type="email" required placeholder="you@example.com"
                className="field" value={email}
                onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">密碼</label>
              <input type="password" required placeholder="至少 6 個字元"
                className="field" value={password}
                onChange={e => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">確認密碼</label>
              <input type="password" required placeholder="再次輸入密碼"
                className="field" value={confirm}
                onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && <p className="text-xs text-coral">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full py-2.5">
              {busy ? '建立中…' : '建立帳號'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-mist mt-6">
          已有帳號？{' '}
          <Link href="/login" className="text-gold hover:underline">登入</Link>
        </p>
      </div>
    </div>
  )
}
