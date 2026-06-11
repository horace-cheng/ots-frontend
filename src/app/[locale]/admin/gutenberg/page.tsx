'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetchGutenbergBook, adminStartGutenbergTranslation, GutenbergBookInfo } from '@/lib/api'

export default function GutenbergPage() {
  const router = useRouter()
  const [bookId, setBookId] = useState('')
  const [bookInfo, setBookInfo] = useState<GutenbergBookInfo | null>(null)
  const [fetching, setFetching] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  async function handleFetch() {
    const id = parseInt(bookId, 10)
    if (!id || id <= 0) { setError('請輸入有效的 Gutenberg Book ID'); return }
    setError('')
    setBookInfo(null)
    setFetching(true)
    try {
      const info = await adminFetchGutenbergBook(id)
      setBookInfo(info)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '查詢失敗')
    } finally {
      setFetching(false)
    }
  }

  async function handleStart() {
    if (!bookInfo) return
    if (!confirm(`確認開始翻譯《${bookInfo.title}》？\n\n這會建立一個新訂單並啟動 Gutenberg 翻譯流程，預計需要 30-60 分鐘。`)) return
    setStarting(true)
    setError('')
    try {
      const result = await adminStartGutenbergTranslation(bookInfo.book_id)
      alert(`翻譯流程已啟動！\n\n訂單 ID: ${result.order_id}\n\n即將跳轉到訂單詳情頁面...`)
      router.push(`/admin/orders/${result.order_id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '啟動翻譯失敗')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="space-y-6 fade-up max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-paper">Gutenberg 書籍翻譯</h1>
        <p className="text-sm text-mist mt-1">
          從 Project Gutenberg 選擇一本英文書籍，自動翻譯成繁體中文，產生三個版本：標準版、青少年版、台羅拼音標註版
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div>
          <label className="text-sm text-mist block mb-2">Gutenberg Book ID</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={bookId}
              onChange={e => setBookId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFetch()}
              placeholder="例：1342 (Pride and Prejudice)"
              min="1"
              className="flex-1 rounded-md bg-white/10 border border-white/10 text-paper text-sm px-3 py-2.5
                         placeholder:text-mist focus:border-purple-400 focus:outline-none"
            />
            <button
              onClick={handleFetch}
              disabled={fetching || !bookId}
              className="px-5 py-2.5 rounded-md bg-purple-600 text-white text-sm font-medium
                         hover:bg-purple-700 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {fetching ? '查詢中…' : '查詢書籍資訊'}
            </button>
          </div>
          <p className="text-xs text-mist mt-2">
            前往 <a href="https://www.gutenberg.org/" target="_blank" rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 underline">gutenberg.org</a> 找書，
            網址末段數字即為 Book ID
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-coral/30 bg-coral/5 px-3 py-2.5 text-sm text-coral">
            {error}
          </div>
        )}
      </div>

      {bookInfo && (
        <div className="rounded-xl border border-purple-400/20 bg-purple-400/5 p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-purple-400">{bookInfo.title}</h2>
            <p className="text-sm text-mist mt-1">作者：{bookInfo.authors.join(', ')}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-mist">語言</p>
              <p className="text-base text-paper font-medium mt-0.5">{bookInfo.language.toUpperCase()}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-mist">字數</p>
              <p className="text-base text-paper font-medium mt-0.5">{bookInfo.word_count.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-mist">章節</p>
              <p className="text-base text-paper font-medium mt-0.5">{bookInfo.num_chapters}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-mist">翻譯批次</p>
              <p className="text-base text-paper font-medium mt-0.5">{bookInfo.num_chunks}</p>
            </div>
          </div>

          <div className="rounded-lg bg-white/5 p-3 space-y-1">
            <p className="text-xs text-mist">翻譯流程</p>
            <ol className="text-sm text-paper space-y-1 list-decimal list-inside">
              <li>下載原文 → 自動切塊</li>
              <li>生成術語表（確保全書一致性）</li>
              <li>批次翻譯 → 標準版</li>
              <li>改寫 → 青少年版（國小 5-6 年級可讀）</li>
              <li>台羅拼音標註 → 台羅版</li>
              <li>合併 → 交付 TXT/HTML 檔案</li>
            </ol>
          </div>

          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full px-5 py-3 rounded-md bg-purple-600 text-white text-base font-bold
                       hover:bg-purple-700 disabled:opacity-40 transition-all shadow-lg shadow-purple-500/20"
          >
            {starting ? '啟動中…' : '開始翻譯並建立訂單'}
          </button>
        </div>
      )}
    </div>
  )
}
