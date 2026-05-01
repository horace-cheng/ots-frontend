'use client'
import clsx from 'clsx'

interface PaginationProps {
  total: number
  pageSize: number
  currentPage: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  theme?: 'light' | 'dark'
}

export function Pagination({ 
  total, 
  pageSize, 
  currentPage, 
  onPageChange,
  onPageSizeChange,
  theme = 'dark'
}: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  
  // Generate page numbers to show
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages, start + maxVisible - 1)
  
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }

  for (let i = start; i <= end; i++) pages.push(i)

  const isDark = theme === 'dark'
  
  const baseBtn = clsx(
    "p-2 rounded-lg border transition-all disabled:opacity-30 disabled:hover:bg-transparent",
    isDark 
      ? "border-white/10 text-mist hover:text-paper hover:bg-white/5" 
      : "border-ink/10 text-mist hover:text-ink hover:bg-ink/5"
  )

  const pageBtn = (p: number) => clsx(
    "w-8 h-8 rounded-lg text-sm font-medium transition-all",
    p === currentPage 
      ? "bg-gold text-white shadow-lg shadow-gold/20" 
      : isDark 
        ? "text-mist hover:text-paper hover:bg-white/5"
        : "text-mist hover:text-ink hover:bg-ink/5"
  )

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
      {/* Page Size Selector */}
      <div className="flex items-center gap-2">
        <span className={clsx("text-xs font-medium", isDark ? "text-mist" : "text-mist")}>
          每頁顯示
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          className={clsx(
            "text-xs rounded border bg-transparent px-2 py-1 outline-none transition-all",
            isDark 
              ? "border-white/10 text-paper focus:border-gold/50" 
              : "border-ink/10 text-ink focus:border-gold/50"
          )}
        >
          {[10, 20, 50, 100].map(sz => (
            <option key={sz} value={sz} className={isDark ? "bg-ink text-paper" : "bg-paper text-ink"}>
              {sz}
            </option>
          ))}
        </select>
      </div>

      {/* Page Navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={baseBtn}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {start > 1 && (
            <>
              <button onClick={() => onPageChange(1)} className={pageBtn(1)}>1</button>
              {start > 2 && <span className="text-mist/30">...</span>}
            </>
          )}

          {pages.map(p => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={pageBtn(p)}
            >
              {p}
            </button>
          ))}

          {end < totalPages && (
            <>
              {end < totalPages - 1 && <span className="text-mist/30">...</span>}
              <button onClick={() => onPageChange(totalPages)} className={pageBtn(totalPages)}>{totalPages}</button>
            </>
          )}

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={baseBtn}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
