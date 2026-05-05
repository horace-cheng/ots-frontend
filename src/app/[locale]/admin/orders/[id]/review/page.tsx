'use client'
import { useEffect, useState } from 'react'
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

  useEffect(() => {
    setBusy(true)
    Promise.all([
      adminGetOrder(id),
      adminGetSegments(id),
    ]).then(([o, s]) => {
      setOrder(o)
      setSegments(s.segments)
    }).catch(e => setError(e.message)).finally(() => setBusy(false))
  }, [id])

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
        onSegmentsChange={(updated) => setSegments(updated)}
        onOpenOriginal={order.gcs_upload_path ? () => setShowOriginal(true) : undefined}
        onSaveDraft={async () => {
          await adminUpdateSegments(id, segments.map(s => ({
            index: s.index,
            translated: s.translated,
            comments: s.comments,
          })))
        }}
        onSubmit={async () => {
          await adminMarkQaDone(id)
          alert('審閱完成，訂單已交付')
          router.push(`/admin/orders/${id}`)
        }}
      />

      <OriginalContentViewer
        open={showOriginal}
        onClose={() => setShowOriginal(false)}
        fetchContent={() => adminGetOriginalContent(id)}
      />
    </>
  )
}
