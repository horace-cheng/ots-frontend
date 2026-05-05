'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { acceptInvitation, getMe } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'

export default function AcceptInvitePage() {
  const { token } = useParams() as { token: string }
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  const handleAccept = async () => {
    setStatus('loading')
    try {
      await acceptInvitation(token)
      setStatus('success')
      // Refresh user data if needed or just redirect
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (e: any) {
      setStatus('error')
      setError(e.message || '接受邀請失敗')
    }
  }

  if (authLoading) return <div className="py-20 text-center text-mist">載入中...</div>

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 px-6 text-center">
        <h1 className="text-2xl font-display font-bold mb-4">加入木典翻譯團隊</h1>
        <p className="text-mist mb-8">請先登入或註冊帳號以接受邀請。</p>
        <button 
          onClick={() => router.push(`/login?redirect=/invite/${token}`)}
          className="px-8 py-3 bg-gold text-ink font-bold rounded-full hover:bg-gold-light transition-colors"
        >
          登入 / 註冊
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto py-20 px-6 text-center">
      <h1 className="text-2xl font-display font-bold mb-4">接受邀請</h1>
      
      {status === 'idle' && (
        <>
          <p className="text-mist mb-8">您已受邀加入木典翻譯團隊。點擊下方按鈕以啟用您的權限。</p>
          <button 
            onClick={handleAccept}
            className="px-8 py-3 bg-gold text-ink font-bold rounded-full hover:bg-gold-light transition-colors"
          >
            接受並加入
          </button>
        </>
      )}

      {status === 'loading' && <p className="text-gold animate-pulse">處理中...</p>}

      {status === 'success' && (
        <div className="text-emerald-400">
          <p className="text-lg font-bold mb-2">接受成功！</p>
          <p className="text-sm opacity-80">正在為您導向首頁...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="text-coral">
          <p className="text-lg font-bold mb-2">發生錯誤</p>
          <p className="text-sm opacity-80 mb-6">{error}</p>
          <button 
            onClick={() => setStatus('idle')}
            className="text-sm text-gold underline"
          >
            再試一次
          </button>
        </div>
      )}
    </div>
  )
}
