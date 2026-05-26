'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { adminListLanguages, adminListSupportedLanguages, adminCreateLanguage, adminUpdateLanguage, adminDeleteLanguage, LanguageConfig, SupportedLanguage } from '@/lib/api'

const DIRECTION_LABELS: Record<string, string> = {
  source: '僅原文',
  target: '僅目標',
  both: '雙向',
}

function allowedDirections(supported: SupportedLanguage[], code: string): string[] {
  const sel = supported.find(s => s.code === code)
  if (!sel) return ['source', 'target', 'both']
  if (sel.default_direction === 'both') return ['source', 'target', 'both']
  return [sel.default_direction]
}

function GripIcon() {
  return (
    <svg className="w-4 h-4 text-mist" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="4" r="1.2" />
      <circle cx="11" cy="4" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="11" cy="12" r="1.2" />
    </svg>
  )
}

function SortableRow({ id, children }: { id: number | string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.25 : undefined,
  }
  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-white/5">
      <td className="p-3 cursor-grab active:cursor-grabbing text-center" {...attributes} {...listeners}>
        <GripIcon />
      </td>
      {children}
    </tr>
  )
}

export default function AdminLanguagesPage() {
  const [languages, setLanguages] = useState<LanguageConfig[]>([])
  const [supported, setSupported] = useState<SupportedLanguage[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  // Add new form state
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ code: '', direction: 'both', price_multiplier: 1.0 })

  async function loadData() {
    try {
      const [langs, supp] = await Promise.all([
        adminListLanguages(),
        adminListSupportedLanguages()
      ])
      setLanguages(langs.languages)
      setSupported(supp)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const availableToAdd = supported.filter(s => !languages.some(l => l.code === s.code))

  const nextSortOrder = languages.length === 0 ? 10 : Math.max(...languages.map(l => l.sort_order)) + 10

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.code) return
    setError('')
    try {
      await adminCreateLanguage({ ...addForm, sort_order: nextSortOrder })
      setShowAdd(false)
      setAddForm({ code: '', direction: 'both', price_multiplier: 1.0 })
      await loadData()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function toggleActive(id: number, current: boolean) {
    try {
      await adminUpdateLanguage(id, { is_active: !current })
      setLanguages(languages.map(l => l.id === id ? { ...l, is_active: !current } : l))
    } catch (e: any) {
      alert('Update failed: ' + e.message)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('確定刪除此語言設定？(若有訂單使用此語言將無法刪除)')) return
    try {
      await adminDeleteLanguage(id)
      setLanguages(languages.filter(l => l.id !== id))
    } catch (e: any) {
      alert('Delete failed: ' + e.message)
    }
  }

  async function updateField(id: number, field: string, value: any) {
    if (field === 'direction') {
      const lang = languages.find(l => l.id === id)
      const allowed = lang ? allowedDirections(supported, lang.code) : []
      if (!allowed.includes(value)) return
    }
    try {
      await adminUpdateLanguage(id, { [field]: value })
      setLanguages(languages.map(l => l.id === id ? { ...l, [field]: value } : l))
    } catch (e: any) {
      alert('Update failed: ' + e.message)
    }
  }

  const sorted = [...languages].sort((a, b) => a.sort_order - b.sort_order)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sorted.findIndex(l => l.id === active.id)
    const newIndex = sorted.findIndex(l => l.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...sorted]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)

    const updated = reordered.map((l, i) => ({ ...l, sort_order: (i + 1) * 10 }))
    setLanguages(updated)

    for (const l of updated) {
      try {
        await adminUpdateLanguage(l.id, { sort_order: l.sort_order })
      } catch (e: any) {
        console.error(`Failed to update sort_order for ${l.id}:`, e.message)
      }
    }
  }, [sorted])

  return (
    <div className="space-y-6 fade-up max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-paper">語言設定</h1>
          <p className="text-sm text-mist mt-1">管理訂單可選擇的原文與目標語言。拖曳 ≡ 可調整排序。</p>
        </div>
        <button className="btn btn-primary text-sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? '取消新增' : '+ 新增語言'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-coral/10 border border-coral/20 text-coral text-sm">
          {error}
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-xl bg-white/5 border border-white/10 p-4">
          <h3 className="font-semibold text-paper mb-3 text-sm">新增支援語言</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="field-label text-xs">語言</label>
              <select className="field-dark text-sm" value={addForm.code} 
                onChange={e => {
                  const sel = supported.find(s => s.code === e.target.value)
                  if (sel) {
                    setAddForm({ ...addForm, code: sel.code, direction: sel.default_direction })
                  }
                }} required>
                <option value="">-- 請選擇 --</option>
                {availableToAdd.map(s => (
                  <option key={s.code} value={s.code}>{s.label_zh} ({s.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label text-xs">方向</label>
              <select className="field-dark text-sm" value={addForm.code ? addForm.direction : ''} disabled={!addForm.code}
                onChange={e => setAddForm({ ...addForm, direction: e.target.value })}>
                {!addForm.code ? (
                  <option value="">請先選擇語言</option>
                ) : (
                  allowedDirections(supported, addForm.code).map(d => (
                    <option key={d} value={d}>{DIRECTION_LABELS[d]} ({d})</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="field-label text-xs">價格乘數</label>
              <input type="number" step="0.1" className="field-dark text-sm" value={addForm.price_multiplier} onChange={e => setAddForm({ ...addForm, price_multiplier: parseFloat(e.target.value)||1 })} />
            </div>
            <button type="submit" className="btn btn-gold text-sm h-[38px]">確認新增</button>
          </div>
        </form>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map(l => l.id)} strategy={verticalListSortingStrategy}>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="text-mist bg-white/5 border-b border-white/10 text-xs">
                <tr>
                  <th className="p-3 w-10" />
                  <th className="p-3 font-medium">語言代碼</th>
                  <th className="p-3 font-medium">顯示名稱</th>
                  <th className="p-3 font-medium">方向</th>
                  <th className="p-3 font-medium">價格乘數</th>
                  <th className="p-3 font-medium text-center">狀態</th>
                  <th className="p-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {busy ? (
                  <tr><td colSpan={7} className="p-4 text-center text-mist">載入中...</td></tr>
                ) : languages.length === 0 ? (
                  <tr><td colSpan={7} className="p-4 text-center text-mist">尚無設定</td></tr>
                ) : (
                  sorted.map(l => (
                    <SortableRow key={l.id} id={l.id}>
                      <td className="p-3 font-mono text-paper/80">{l.code}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <input type="text" defaultValue={l.label_zh}
                            onBlur={e => { const v = e.target.value.trim(); if (v && v !== l.label_zh) updateField(l.id, 'label_zh', v) }}
                            className="bg-transparent border border-white/20 rounded px-2 py-1 w-28 text-paper focus:border-gold outline-none text-sm" />
                          <input type="text" defaultValue={l.label_en}
                            onBlur={e => { const v = e.target.value.trim(); if (v && v !== l.label_en) updateField(l.id, 'label_en', v) }}
                            className="bg-transparent border border-white/20 rounded px-2 py-1 w-28 text-mist focus:border-gold outline-none text-xs" />
                        </div>
                      </td>
                      <td className="p-3">
                        <select defaultValue={l.direction}
                          onChange={e => { const v = e.target.value; if (v !== l.direction) updateField(l.id, 'direction', v) }}
                          className="bg-transparent border border-white/20 rounded px-2 py-1 text-paper/80 focus:border-gold outline-none text-sm">
                          {allowedDirections(supported, l.code).map(d => (
                            <option key={d} value={d} className="bg-ink text-paper">{DIRECTION_LABELS[d]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <input type="number" step="0.1" defaultValue={l.price_multiplier}
                          onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0 && v !== l.price_multiplier) updateField(l.id, 'price_multiplier', v) }}
                          className="bg-transparent border border-white/20 rounded px-2 py-1 w-20 text-paper focus:border-gold outline-none" />
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => toggleActive(l.id, l.is_active)}
                          className={`text-xs px-2 py-1 rounded-full ${l.is_active ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-mist'}`}>
                          {l.is_active ? '啟用中' : '停用'}
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleDelete(l.id)} className="text-xs text-coral hover:underline">
                          刪除
                        </button>
                      </td>
                    </SortableRow>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
