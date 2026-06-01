'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  adminGetOrder, adminGetSegments, adminGetOriginalContent, adminUpdateSegments, adminMarkQaDone,
  Order, QASegment,
} from '@/lib/api'
import QaReviewEditor from '@/components/qa-review-editor'
import OriginalContentViewer from '@/components/original-content-viewer'

export default function QaReviewEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [order,    setOrder]    = useState<Order | null>(null)
  const [segments, setSegments] = useState<QASegment[]>([])
  const [busy,     setBusy]     = useState(true)
  const [error,    setError]    = useState('')
  const [showOriginal, setShowOriginal] = useState(false)

  // Pagination state
  const [total,       setTotal]       = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize,    setPageSize]    = useState(50)
  const [dirtyIndices, setDirtyIndices] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ index: number; source: string }[]>([])
  const [crossPageTotal, setCrossPageTotal] = useState(0)
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)

  const fetchSegments = useCallback(async (page: number, size: number) => {
    const s = await adminGetSegments(id, { limit: size, offset: (page - 1) * size })
    setSegments(s.segments)
    setTotal(s.total)
    setDirtyIndices(new Set())
  }, [id])

  useEffect(() => {
    setBusy(true)
    Promise.all([
      adminGetOrder(id),
      fetchSegments(1, pageSize),
    ]).then(([o]) => {
      setOrder(o)
    }).catch(e => setError(e.message)).finally(() => setBusy(false))
  }, [id, pageSize, fetchSegments])

  const getDirtyPayload = useCallback(() =>
    segments.filter(s => dirtyIndices.has(s.index)).map(s => ({
      index: s.index,
      translated: s.translated,
      comments: s.comments,
    })), [segments, dirtyIndices])

  const saveCurrentPage = useCallback(async () => {
    const payload = getDirtyPayload()
    if (payload.length === 0) return
    await adminUpdateSegments(id, payload)
  }, [id, getDirtyPayload])

  const handleSegmentsChange = (updated: QASegment[]) => {
    const newDirty = new Set(dirtyIndices)
    for (let i = 0; i < updated.length; i++) {
      const old = segments.find(s => s.index === updated[i].index)
      if (!old || old.translated !== updated[i].translated || old.comments !== updated[i].comments) {
        newDirty.add(updated[i].index)
      }
    }
    setDirtyIndices(newDirty)
    setSegments(updated)
  }

  const handleSearchChange = (q: string) => {
    setSearchQuery(q)
    if (q) {
      adminGetSegments(id, { limit: 200, offset: 0, q, search_all: true }).then(s => {
        setSearchResults(s.segments.map(seg => ({ index: seg.index, source: seg.source })))
        setCrossPageTotal(s.total)
      }).catch(() => {})
    } else {
      setSearchResults([])
      setCrossPageTotal(0)
    }
  }

  const handleSelectResult = async (paragraphIndex: number) => {
    const targetPage = Math.floor(paragraphIndex / pageSize) + 1
    if (targetPage !== currentPage) {
      await handlePageChange(targetPage)
    }
    setHighlightedIndex(paragraphIndex)
    setTimeout(() => setHighlightedIndex(null), 2600)
    setTimeout(() => {
      const el = document.getElementById(`segment-${paragraphIndex}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  const handlePageChange = async (page: number) => {
    await saveCurrentPage()
    setCurrentPage(page)
    await fetchSegments(page, pageSize)
  }

  const handlePageSizeChange = async (size: number) => {
    await saveCurrentPage()
    setPageSize(size)
    setCurrentPage(1)
    await fetchSegments(1, size)
  }

  if (busy) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
    </div>
  )

  if (error || !order) return (
    <div className="p-8 text-coral">{error || '訂單加載失敗'}</div>
  )

  return (
    <>
      <QaReviewEditor
        order={order}
        segments={segments}
        backHref={`/admin/orders/${id}`}
        isReadOnly={order.status === 'delivered'}
        accent="gold"
        onSegmentsChange={handleSegmentsChange}
        onOpenOriginal={order.gcs_upload_path ? () => setShowOriginal(true) : undefined}
        onSaveDraft={async () => {
          await adminUpdateSegments(id, segments.map(s => ({
            index: s.index,
            translated: s.translated,
            comments: s.comments,
          })))
          setDirtyIndices(new Set())
        }}
        onSubmit={async () => {
          await adminUpdateSegments(id, segments.map(s => ({
            index: s.index,
            translated: s.translated,
            comments: s.comments,
          })))
          setDirtyIndices(new Set())
          await adminMarkQaDone(id)
          alert('審閱完成，訂單已交付')
          router.push(`/admin/orders/${id}`)
        }}
        total={total}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchResults={searchResults}
        searchTotal={crossPageTotal}
        highlightedIndex={highlightedIndex}
        onSelectResult={handleSelectResult}
      />

      <OriginalContentViewer
        open={showOriginal}
        onClose={() => setShowOriginal(false)}
        fetchContent={() => adminGetOriginalContent(id)}
      />
    </>
  )
}
