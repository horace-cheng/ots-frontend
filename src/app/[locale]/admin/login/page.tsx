'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginWithEmail } from '@/lib/firebase'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [busy,     setBusy]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      await loginWithEmail(email, password)
      router.push('/admin')
    } catch {
      setError('帳號或密碼錯誤')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-display text-2xl font-bold text-paper">
            木典 <span className="text-gold">Admin</span>
          </p>
          <p className="text-xs text-mist mt-1">後台管理系統</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div>
            <label className="block text-xs text-mist mb-1">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-md bg-white/10 border border-white/10 text-paper text-sm px-3 py-2
                         placeholder:text-mist focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-mist mb-1">密碼</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full rounded-md bg-white/10 border border-white/10 text-paper text-sm px-3 py-2
                         placeholder:text-mist focus:border-gold focus:outline-none" />
          </div>
          {error && <p className="text-xs text-coral">{error}</p>}
          <button type="submit" disabled={busy}
            className="w-full py-2.5 rounded-md bg-gold text-white text-sm font-medium hover:bg-gold-dark disabled:opacity-40 transition-colors">
            {busy ? '登入中…' : '登入'}
          </button>
        </form>
      </div>
    </div>
  )
}
