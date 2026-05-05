'use client'
import { useEffect, useState } from 'react'
import { editorListTeam, UserAccount } from '@/lib/api'

export default function EditorTeamPage() {
  const [qas, setQas] = useState<UserAccount[]>([])
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    setBusy(true)
    editorListTeam()
      .then(d => setQas(d.users))
      .finally(() => setBusy(false))
  }, [])

  return (
    <div className="space-y-6 fade-up">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-paper">我的 QA 團隊</h1>
        <span className="text-xs text-mist">共 {qas.length} 位</span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {busy ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-24 bg-white/5 border border-white/10 rounded-xl animate-pulse" />
          ))
        ) : qas.length === 0 ? (
          <p className="text-sm text-mist col-span-full py-12 text-center border border-dashed border-white/10 rounded-xl">
            目前尚無合作的 QA。您可以在儀表板發送邀請。
          </p>
        ) : qas.map(qa => (
          <div key={qa.id} className="p-4 bg-white/5 border border-white/10 rounded-xl hover:border-gold/30 transition-colors">
            <p className="text-sm font-medium text-paper">{qa.email}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {qa.languages?.map((l, i) => (
                <span key={i} className="text-[10px] bg-white/10 text-mist px-1.5 py-0.5 rounded">
                  {l.source_lang}→{l.target_lang}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
