'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loginWithEmail, loginWithGoogle } from '@/lib/firebase'
import { PortalHeader } from '@/components/portal/header'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [busy,     setBusy]     = useState(false)

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      await loginWithEmail(email, password)
      router.push('/')
    } catch {
      setError('Email 或密碼錯誤，請重試')
    } finally { setBusy(false) }
  }

  async function handleGoogle() {
    setError(''); setBusy(true)
    try {
      await loginWithGoogle()
      router.push('/')
    } catch {
      setError('Google 登入失敗，請重試')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-paper bg-paper-texture">
      <PortalHeader />
      <div className="mx-auto max-w-sm px-4 pt-20 pb-16 fade-up">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-ink mb-2">登入</h1>
          <p className="text-sm text-mist">木典翻譯服務平台</p>
        </div>

        <div className="card space-y-4">
          <form onSubmit={handleEmail} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Email</label>
              <input type="email" required placeholder="you@example.com"
                className="field" value={email}
                onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">密碼</label>
              <input type="password" required placeholder="••••••••"
                className="field" value={password}
                onChange={e => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-xs text-coral">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full py-2.5">
              {busy ? '登入中…' : '登入'}
            </button>
          </form>

          <div className="relative">
            <hr className="ink-rule" />
            <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-white px-2 text-xs text-mist">或</span>
          </div>

          <button onClick={handleGoogle} disabled={busy}
            className="btn-ghost w-full py-2.5 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google 登入
          </button>
        </div>

        <p className="text-center text-xs text-mist mt-6">
          尚未有帳號？請聯繫{' '}
          <a href="mailto:service@ots.tw" className="text-gold hover:underline">service@ots.tw</a>
        </p>
        <p className="text-center text-xs text-mist mt-2">
          <Link href="/admin/login" className="hover:text-gold transition-colors">後台管理員入口</Link>
        </p>
      </div>
    </div>
  )
}
