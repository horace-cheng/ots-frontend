'use client'
import { useEffect, useState } from 'react'
import { adminListUsers, adminUpdateUser, UserAccount } from '@/lib/api'
import dayjs from 'dayjs'

export default function AdminUsersPage() {
  const [users,   setUsers]   = useState<UserAccount[]>([])
  const [busy,    setBusy]    = useState(true)
  const [error,   setError]   = useState('')
  const [tick,    setTick]    = useState(0)
  const [working, setWorking] = useState<string | null>(null)

  useEffect(() => {
    setBusy(true)
    setError('')
    adminListUsers()
      .then(d => setUsers(d.users))
      .catch(e => setError(e.message))
      .finally(() => setBusy(false))
  }, [tick])

  async function toggle(u: UserAccount, field: 'disabled' | 'is_admin' | 'is_editor') {
    setWorking(u.id + field)
    try {
      const payload = field === 'disabled'
        ? { disabled: !u.disabled }
        : field === 'is_admin'
          ? { is_admin: !u.is_admin }
          : { is_editor: !u.is_editor }
      await adminUpdateUser(u.id, payload)
      setUsers(prev => prev.map(x =>
        x.id === u.id
          ? field === 'disabled'
            ? { ...x, disabled: !x.disabled }
            : field === 'is_admin'
              ? { ...x, is_admin: !x.is_admin, admin_role: !x.is_admin ? 'admin' : undefined }
              : { ...x, is_editor: !x.is_editor }
          : x
      ))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '操作失敗')
    } finally { setWorking(null) }
  }

  return (
    <div className="space-y-6 fade-up">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-paper">帳號管理</h1>
        <button onClick={() => setTick(t => t + 1)} disabled={busy}
          className="p-1.5 rounded-lg border border-white/10 text-mist hover:text-paper hover:border-white/30 disabled:opacity-40 transition-colors">
          <svg className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

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
              <tr className="border-b border-white/10 bg-white/5 text-xs text-mist">
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">類型</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">建立時間</th>
                <th className="text-center px-4 py-3 font-medium">Admin</th>
                <th className="text-center px-4 py-3 font-medium">Editor</th>
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
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      u.disabled
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
                        disabled={working !== null}
                        className="text-xs px-2.5 py-1 rounded border border-white/10 text-mist hover:text-paper hover:border-white/30 disabled:opacity-40 transition-colors whitespace-nowrap">
                        {working === u.id + 'is_admin' ? '…' : u.is_admin ? '撤銷 Admin' : '設為 Admin'}
                      </button>
                      <button
                        onClick={() => toggle(u, 'is_editor')}
                        disabled={working !== null}
                        className="text-xs px-2.5 py-1 rounded border border-white/10 text-mist hover:text-paper hover:border-white/30 disabled:opacity-40 transition-colors whitespace-nowrap">
                        {working === u.id + 'is_editor' ? '…' : u.is_editor ? '撤銷 Editor' : '設為 Editor'}
                      </button>
                      <button
                        onClick={() => toggle(u, 'disabled')}
                        disabled={working !== null}
                        className={`text-xs px-2.5 py-1 rounded border disabled:opacity-40 transition-colors whitespace-nowrap ${
                          u.disabled
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
    </div>
  )
}
