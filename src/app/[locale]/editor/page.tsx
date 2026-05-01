'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EditorHomePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/editor/orders')
  }, [router])

  return (
    <div className="flex items-center justify-center py-20 text-mist">
      Redirecting to Editor Dashboard...
    </div>
  )
}
