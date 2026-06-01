'use client'
import { useState, useEffect, useRef } from 'react'

interface SearchResult {
  index: number
  source: string
}

interface SearchBarProps {
  value: string
  onChange: (q: string) => void
  totalMatches?: number
  theme?: 'gold' | 'purple' | 'amber'
  results?: SearchResult[]
  onSelectResult?: (index: number) => void
}

export function SearchBar({ value, onChange, totalMatches, theme = 'gold', results, onSelectResult }: SearchBarProps) {
  const [local, setLocal] = useState(value)
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocal(value)
  }, [value])

  useEffect(() => {
    if (value && results && results.length > 0) {
      setOpen(true)
    } else {
      setOpen(false)
    }
  }, [value, results])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (v: string) => {
    setLocal(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(v), 300)
  }

  const accent = theme === 'purple' ? '#7c3aed' : theme === 'amber' ? '#d97706' : '#b8852a'

  const handleSelect = (index: number) => {
    setOpen(false)
    onSelectResult?.(index)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            type="text"
            value={local}
            onChange={e => handleChange(e.target.value)}
            placeholder="搜尋段落內容..."
            style={{
              width: '100%',
              padding: '0.35rem 0.75rem 0.35rem 2rem',
              fontSize: '0.75rem',
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${value ? accent : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8,
              color: '#e2e8f0',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.target.style.borderColor = accent; if (value && results && results.length > 0) setOpen(true) }}
            onBlur={e => { e.target.style.borderColor = value ? accent : 'rgba(255,255,255,0.1)' }}
          />
          {local && (
            <button
              type="button"
              onClick={() => { setLocal(''); setOpen(false); onChange('') }}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
                fontSize: '0.8rem', padding: '0.1rem 0.3rem', lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
        {totalMatches !== undefined && (
          <span style={{ fontSize: '0.7rem', color: value ? accent : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', fontWeight: value ? 600 : 400, cursor: value ? 'pointer' : 'default' }}
            onClick={() => { if (value && results && results.length > 0) setOpen(v => !v) }}>
            {value ? `${totalMatches} 段符合` : ''}
          </span>
        )}
      </div>

      {open && results && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          marginTop: 4, maxHeight: 320, overflowY: 'auto',
          background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {results.map((r, i) => (
            <button
              key={r.index}
              type="button"
              onClick={() => handleSelect(r.index)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '0.5rem 0.75rem', border: 'none', borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                background: 'transparent', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.75rem',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ color: accent, fontWeight: 700, marginRight: 6 }}>#{r.index + 1}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{r.source.slice(0, 80)}{r.source.length > 80 ? '…' : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
