'use client'
import { useEffect, useState } from 'react'
import { onApiLoading } from '@/lib/api'

export function ApiLoadingIndicator() {
  const [loading, setLoading] = useState(false)

  useEffect(() => onApiLoading(setLoading), [])

  if (!loading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 bg-ink/90 backdrop-blur-sm px-4 py-2 text-sm text-paper border-b border-gold/30 fade-down">
      <div className="spinner !w-3.5 !h-3.5 !border-white/20 !border-t-gold shrink-0" />
      Waiting for response…
    </div>
  )
}
