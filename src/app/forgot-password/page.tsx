'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { resetPassword } from '@/lib/firebase'
import { PortalHeader } from '@/components/portal/header'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [error,    setError]    = useState('')
  const [message,  setMessage]  = useState('')
  const [busy,     setBusy]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setMessage(''); setBusy(true)
    try {
      await resetPassword(email)
      setMessage('密碼重設信件已寄出，請檢查您的信箱。')
    } catch (err: any) {
      console.error("Firebase auth error:", err)
      if (err.code === 'auth/user-not-found') {
        setError('找不到此帳號，請確認信箱是否已經註冊。')
      } else if (err.code === 'auth/invalid-email') {
        setError('信箱格式不正確。')
      } else {
        setError(`無法送出重設信件：${err.message || '未知錯誤'}`)
      }
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-paper bg-paper-texture">
      <PortalHeader />
      <div className="mx-auto max-w-sm px-4 pt-20 pb-16 fade-up">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-ink mb-2">忘記密碼</h1>
          <p className="text-sm text-mist">請輸入您的註冊信箱，我們將寄送密碼重設連結給您。</p>
        </div>

        <div className="card space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Email</label>
              <input type="email" required placeholder="you@example.com"
                className="field" value={email}
                onChange={e => setEmail(e.target.value)} />
            </div>
            {error && <p className="text-xs text-coral">{error}</p>}
            {message && <p className="text-xs text-moss">{message}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full py-2.5">
              {busy ? '送出中…' : '送出重設信件'}
            </button>
          </form>

          <div className="text-center mt-4">
            <Link href="/login" className="text-xs text-mist hover:text-gold transition-colors">
              返回登入
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
