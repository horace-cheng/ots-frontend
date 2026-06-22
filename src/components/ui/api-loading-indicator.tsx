'use client'
import { useEffect, useState } from 'react'
import { onApiLoading } from '@/lib/api'

export function ApiLoadingIndicator() {
  const [loading, setLoading] = useState(false)

  useEffect(() => onApiLoading(setLoading), [])

  if (!loading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 bg-ink/95 backdrop-blur-md px-5 py-3 text-base text-paper border-b border-gold/50 shadow-lg shadow-ink/50 fade-down">
      <div className="spinner !w-4 !h-4 !border-white/20 !border-t-gold shrink-0" />
      <span>等待伺服器回應…</span>
    </div>
  )
}
