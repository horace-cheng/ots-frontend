'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

interface OriginalContentViewerProps {
  open: boolean
  onClose: () => void
  fetchContent: () => Promise<{ filename: string; content_type: string; text: string }>
}

export default function OriginalContentViewer({ open, onClose, fetchContent }: OriginalContentViewerProps) {
  const [content, setContent] = useState<string | null>(null)
  const [filename, setFilename] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [pos, setPos] = useState({ x: 80, y: 80 })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
    setDragging(true)
  }, [pos])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !dragging) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy })
  }, [dragging])

  const onPointerUp = useCallback(() => {
    dragRef.current = null
    setDragging(false)
  }, [])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setContent(null)
    setError('')
    setPos({ x: Math.max(40, window.innerWidth * 0.5 - 250), y: 80 })
    fetchContent()
      .then(r => {
        setFilename(r.filename)
        setContent(r.text)
      })
      .catch(e => setError(e.message || '讀取失敗'))
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Floating Window */}
      <div
        className="absolute w-[520px] h-[65vh] rounded-xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden pointer-events-auto select-none"
        style={{ left: pos.x, top: pos.y }}
      >
        {/* Title bar (drag handle) */}
        <div
          className="shrink-0 flex items-center justify-between px-4 py-2.5 cursor-grab active:cursor-grabbing bg-zinc-800 border-b border-white/10"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="flex items-center gap-3">
            {/* Close button */}
            <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-mist hover:text-paper transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-sm font-bold text-paper">原始內容</h2>
          </div>
          {filename && <p className="text-[10px] text-mist font-mono truncate max-w-[250px]">{filename}</p>}
        </div>

        {/* Body — solid light background for readability */}
        <div className="flex-1 overflow-auto bg-[#f5f0e8] px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-5 h-5 border-2 border-zinc-400 border-t-zinc-800 rounded-full animate-spin" />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {content !== null && !loading && (
            <pre className="text-[13px] text-zinc-900 whitespace-pre-wrap break-words leading-relaxed">{content}</pre>
          )}
        </div>
      </div>
    </div>
  )
}
