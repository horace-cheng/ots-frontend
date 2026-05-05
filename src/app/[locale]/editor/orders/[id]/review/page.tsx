'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  editorGetOrder, editorGetSegments, editorUpdateSegments, editorSubmit,
  Order, QASegment, getMe
} from '@/lib/api'
import QaReviewEditor from '@/components/qa-review-editor'

export default function QaReviewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [order,    setOrder]    = useState<Order | null>(null)
  const [segments, setSegments] = useState<QASegment[]>([])
  const [busy,     setBusy]     = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    setBusy(true)
    getMe().then(user => {
      if (!user.is_qa) {
        router.replace(`/editor/orders/${id}/verify`)
        return null
      }
      return Promise.all([
        editorGetOrder(id),
        editorGetSegments(id),
      ]).then(([o, s]) => {
        setOrder(o)
        setSegments(s.segments)
      })
    }).catch(e => {
      if (e.message !== 'NEXT_REDIRECT') setError(e.message)
    }).finally(() => setBusy(false))
  }, [id, router])

  if (busy) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
    </div>
  )

  if (error || !order) return (
    <div className="p-8 text-coral">{error || '訂單加載失敗'}</div>
  )

  return (
    <QaReviewEditor
      order={order}
      segments={segments}
      backHref="/editor/orders"
      accent="gold"
      onSegmentsChange={(updated) => setSegments(updated)}
      onSaveDraft={async () => {
        await editorUpdateSegments(id, segments.map(s => ({
          index: s.index,
          translated: s.translated,
          comments: s.comments,
        })))
      }}
      onSubmit={async () => {
        await editorSubmit(id)
        alert('已提交給 Editor')
        router.push('/editor/orders')
      }}
      submitLabel="提交給 Editor"
    />
  )
}
