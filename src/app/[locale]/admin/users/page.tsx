'use client'
import { useEffect, useState } from 'react'
import {
  adminListUsers, adminUpdateUser, createInvitation,
  adminUpdateUserLanguages, UserAccount
} from '@/lib/api'
import dayjs from 'dayjs'

const SUPPORTED_LANGS = [
  { v: 'zh-tw', l: '繁體中文' },
  { v: 'en', l: 'English' },
  { v: 'ja', l: '日本語' },
  { v: 'ko', l: '한국어' },
  { v: 'tai-lo', l: '台語（台羅）' },
  { v: 'hakka', l: '客語' },
  { v: 'indigenous', l: '原住民族語' },
]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserAccount[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [working, setWorking] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState('')

  // Language Edit Modal
  const [editingLangs, setEditingLangs] = useState<UserAccount | null>(null)
  const [newLangs, setNewLangs] = useState<{ source_lang: string; target_lang: string }[]>([])

  useEffect(() => {
    setBusy(true)
    setError('')
    adminListUsers()
      .then(d => setUsers(d.users))
      .catch(e => setError(e.message))
      .finally(() => setBusy(false))
  }, [tick])

  async function toggle(u: UserAccount, field: 'disabled' | 'is_admin' | 'is_editor' | 'is_qa') {
    setWorking(u.id + field)
    try {
      const payload: any = {}
      if (field === 'disabled') payload.disabled = !u.disabled
      if (field === 'is_admin') payload.is_admin = !u.is_admin
      if (field === 'is_editor') payload.is_editor = !u.is_editor
      if (field === 'is_qa') payload.is_qa = !u.is_qa

      await adminUpdateUser(u.id, payload)
      setUsers(prev => prev.map(x =>
        x.id === u.id
          ? { ...x, [field]: !((x as any)[field]) }
          : x
      ))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '操作失敗')
    } finally { setWorking(null) }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    setInviting(true)
    try {
      const res = await createInvitation({ email: inviteEmail, role: 'editor' })
      const link = `${window.location.origin}/invite/${res.token}`
      setInviteResult(link)
      setInviteEmail('')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setInviting(false)
    }
  }

  const handleSaveLangs = async () => {
    if (!editingLangs) return
    // Validate: each source→target pair must be unique
    const keys = newLangs.map(l => `${l.source_lang}→${l.target_lang}`)
    const hasDuplicates = keys.length !== new Set(keys).size
    if (hasDuplicates) {
      alert('語言對不能重複，請移除重複的來源→目標語言組合')
      return
    }
    // Validate: source and target cannot be the same
    const invalid = newLangs.some(l => l.source_lang === l.target_lang)
    if (invalid) {
      alert('來源語言與目標語言不能相同')
      return
    }
    setWorking(editingLangs.id + 'langs')
    try {
      await adminUpdateUserLanguages(editingLangs.id, newLangs)
      setUsers(prev => prev.map(u => u.id === editingLangs.id ? { ...u, languages: newLangs } : u))
      setEditingLangs(null)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setWorking(null)
    }
  }

  return (
    <div className="space-y-6 fade-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="font-display text-xl font-bold text-paper">帳號管理</h1>
        <div className="flex items-center gap-3">
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              placeholder="邀請 Editor (Email)"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs focus:border-gold outline-none"
              required
            />
            <button
              type="submit"
              disabled={inviting}
              className="px-3 py-1.5 bg-gold text-ink font-bold rounded-lg text-xs hover:bg-gold-light disabled:opacity-50"
            >
              發送邀請
            </button>
          </form>

          <button onClick={() => setTick(t => t + 1)} disabled={busy}
            className="p-1.5 rounded-lg border border-white/10 text-mist hover:text-paper hover:border-white/30 disabled:opacity-40 transition-colors">
            <svg className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {inviteResult && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-col gap-2">
          <p className="text-xs font-bold text-emerald-400">邀請連結已產生 (請手動傳送給對方):</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteResult}
              className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1 text-xs font-mono"
            />
            <button
              onClick={() => { navigator.clipboard.writeText(inviteResult); alert('已複製') }}
              className="text-xs text-gold underline whitespace-nowrap"
            >
              複製
            </button>
            <button onClick={() => setInviteResult('')} className="text-xs text-mist underline">關閉</button>
          </div>
        </div>
      )}

      {error && <p className="text-coral text-sm">{error}</p>}

      {busy ? (
        <div className="space-y-2">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-mist">尚無帳號</p>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-sm text-mist">
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">類型</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">建立時間</th>
                <th className="text-center px-4 py-3 font-medium">Admin</th>
                <th className="text-center px-4 py-3 font-medium">Editor</th>
                <th className="text-center px-4 py-3 font-medium">QA</th>
                <th className="text-left px-4 py-3 font-medium">語言能力</th>
                <th className="text-center px-4 py-3 font-medium">狀態</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(u => (
                <tr key={u.id} className={`transition-colors ${u.disabled ? 'opacity-50' : 'hover:bg-white/5'}`}>
                  <td className="px-4 py-3">
                    <p className="text-paper font-medium">{u.email || '—'}</p>
                    <p className="text-xs text-mist font-mono mt-0.5">{u.uid_firebase.slice(0, 12)}…</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-mist">{u.client_type}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-mist hidden lg:table-cell">
                    {dayjs(u.created_at).format('YYYY/MM/DD')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.is_admin ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-gold/20 text-gold font-medium">
                        {u.admin_role ?? 'admin'}
                      </span>
                    ) : (
                      <span className="text-xs text-mist">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.is_editor ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-400/20 text-purple-400 font-medium">
                        Editor
                      </span>
                    ) : (
                      <span className="text-xs text-mist">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.is_qa ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-400/20 text-emerald-400 font-medium">
                        QA
                      </span>
                    ) : (
                      <span className="text-xs text-mist">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                      {u.languages?.map((l, i) => (
                        <span key={i} className="text-xs bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-mist">
                          {l.source_lang}→{l.target_lang}
                        </span>
                      ))}
                      <button
                        onClick={() => { setEditingLangs(u); setNewLangs(u.languages || []) }}
                        disabled={u.disabled || working !== null}
                        className="text-sm px-2.5 py-1 rounded border border-white/10 text-mist hover:text-paper hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      >
                        {u.languages?.length ? '編輯' : '新增'}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${u.disabled
                        ? 'bg-coral/20 text-coral'
                        : 'bg-green-400/20 text-green-400'
                      }`}>
                      {u.disabled ? '已停用' : '正常'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => toggle(u, 'is_admin')}
                        disabled={u.disabled || working !== null}
                        className="text-sm px-2.5 py-1 rounded border border-white/10 text-mist hover:text-paper hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
                        {working === u.id + 'is_admin' ? '…' : u.is_admin ? '撤銷 Admin' : '設為 Admin'}
                      </button>
                      <button
                        onClick={() => toggle(u, 'is_editor')}
                        disabled={u.disabled || working !== null}
                        className="text-sm px-2.5 py-1 rounded border border-white/10 text-mist hover:text-paper hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
                        {working === u.id + 'is_editor' ? '…' : u.is_editor ? '撤銷 Editor' : '設為 Editor'}
                      </button>
                      <button
                        onClick={() => toggle(u, 'is_qa')}
                        disabled={u.disabled || working !== null}
                        className="text-sm px-2.5 py-1 rounded border border-white/10 text-mist hover:text-paper hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
                        {working === u.id + 'is_qa' ? '…' : u.is_qa ? '撤銷 QA' : '設為 QA'}
                      </button>
                      <button
                        onClick={() => toggle(u, 'disabled')}
                        disabled={working !== null}
                        className={`text-sm px-2.5 py-1 rounded border disabled:opacity-40 transition-colors whitespace-nowrap ${u.disabled
                            ? 'border-green-400/30 text-green-400 hover:bg-green-400/10'
                            : 'border-coral/30 text-coral hover:bg-coral/10'
                          }`}>
                        {working === u.id + 'disabled' ? '…' : u.disabled ? '啟用' : '停用'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-mist">共 {users.length} 個帳號</p>

      {/* Language Mapping Modal */}
      {editingLangs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-night border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-paper mb-4">編輯語言能力: {editingLangs.email}</h2>

            <div className="space-y-3 mb-6 max-h-[300px] overflow-auto pr-2">
              {newLangs.map((l, i) => (
                <div key={i} className={`flex items-center gap-2 ${l.source_lang && l.source_lang === l.target_lang ? 'ring-1 ring-coral/50 rounded-lg p-1' : ''}`}>
                  <select
                    value={l.source_lang}
                    onChange={e => {
                      const copy = [...newLangs]
                      copy[i].source_lang = e.target.value
                      // Clear target if it becomes the same as the new source
                      if (copy[i].target_lang === e.target.value) copy[i].target_lang = ''
                      setNewLangs(copy)
                    }}
                    className="flex-1 bg-zinc-900 border border-white/20 rounded px-2 py-2 text-sm text-white focus:border-gold outline-none cursor-pointer"
                  >
                    <option value="" disabled className="bg-zinc-900 text-zinc-500">來源語言</option>
                    {SUPPORTED_LANGS.map(opt => (
                      <option key={opt.v} value={opt.v} className="bg-zinc-900 text-white">{opt.l}</option>
                    ))}
                  </select>

                  <span className="text-mist">→</span>

                  <select
                    value={l.target_lang}
                    onChange={e => {
                      const copy = [...newLangs]
                      copy[i].target_lang = e.target.value
                      setNewLangs(copy)
                    }}
                    className={`flex-1 bg-zinc-900 border rounded px-2 py-2 text-sm text-white focus:border-gold outline-none cursor-pointer ${
                      l.source_lang && l.source_lang === l.target_lang
                        ? 'border-coral/60'
                        : 'border-white/20'
                    }`}
                  >
                    <option value="" disabled className="bg-zinc-900 text-zinc-500">目標語言</option>
                    {SUPPORTED_LANGS.filter(opt => opt.v !== l.source_lang).map(opt => (
                      <option key={opt.v} value={opt.v} className="bg-zinc-900 text-white">{opt.l}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => setNewLangs(prev => prev.filter((_, idx) => idx !== i))}
                    className="p-1.5 text-coral hover:bg-coral/10 rounded transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <button
                onClick={() => setNewLangs(prev => [...prev, { source_lang: '', target_lang: '' }])}
                className="w-full py-2 border border-dashed border-white/20 rounded-lg text-sm text-mist hover:text-paper hover:border-white/40 transition-colors"
              >
                + 新增語言對
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditingLangs(null)}
                className="flex-1 py-2 rounded-lg bg-white/5 text-sm text-mist hover:text-paper transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveLangs}
                disabled={working !== null}
                className="flex-1 py-2 rounded-lg bg-gold text-ink font-bold text-sm hover:bg-gold-light disabled:opacity-50 transition-colors"
              >
                {working === editingLangs.id + 'langs' ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
