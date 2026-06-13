'use client'
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  adminGetVideoMaterials, adminSaveVideoMaterials,
  adminSceneTts, adminSceneImage, adminChapterAssemble,
  adminGenerateStoryboard,
  VideoMaterials, VideoChapter, VideoScene, ZH_CHAPTER_TITLES,
} from '@/lib/api'

type AssetState = 'idle' | 'loading' | 'done' | 'error'
type SceneAssets = Record<string, {
  audioUrl: string
  imageUrl: string
  audioState: AssetState
  imageState: AssetState
}>

const DEFAULT_VOICE = 'cmn-TW-vs2-F04'

interface SrtEntry {
  index: number
  start: number   // seconds
  end: number     // seconds
  text: string
}

function srtTimeToSec(t: string): number {
  const [h, m, s] = t.split(':')
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s.replace(',', '.'))
}

function secToSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).replace('.', ',')}`
}

function parseSrt(content: string): SrtEntry[] {
  const blocks = content.trim().split(/\n\n+/)
  return blocks.map(b => {
    const lines = b.trim().split('\n')
    const index = parseInt(lines[0])
    const [startStr, , endStr] = lines[1].split(' ')
    return {
      index,
      start: srtTimeToSec(startStr),
      end: srtTimeToSec(endStr),
      text: lines.slice(2).join('\n'),
    }
  }).filter(e => !isNaN(e.index))
}

function serializeSrt(entries: SrtEntry[]): string {
  return entries.map(e =>
    `${e.index}\n${secToSrtTime(e.start)} --> ${secToSrtTime(e.end)}\n${e.text}`
  ).join('\n\n') + '\n'
}

const VOICES = [
  { id: 'cmn-TW-vs2-F04', label: '華語女聲 F04' },
  { id: 'cmn-TW-vs2-F01', label: '華語女聲 F01' },
  { id: 'cmn-TW-vs2-F02', label: '華語女聲 F02' },
  { id: 'cmn-TW-vs2-F03', label: '華語女聲 F03' },
  { id: 'cmn-TW-vs2-F05', label: '華語女聲 F05' },
  { id: 'cmn-TW-vs2-M01', label: '華語男聲 M01' },
  { id: 'cmn-TW-vs2-M02', label: '華語男聲 M02' },
  { id: 'cmn-TW-vs2-M03', label: '華語男聲 M03' },
  { id: 'nan-TW-vs2-F01', label: '台語女聲' },
  { id: 'nan-TW-vs2-M01', label: '台語男聲' },
]

export default function VideoStoryboardPage() {
  const { id } = useParams<{ id: string }>()
  const [materials, setMaterials] = useState<VideoMaterials | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [error, setError] = useState('')
  const [noStoryboard, setNoStoryboard] = useState(false)
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false)
  const [message, setMessage] = useState('')
  const [activeChapter, setActiveChapter] = useState(0)
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE)
  const [speakingRate, setSpeakingRate] = useState(1.0)
  const [sceneAssets, setSceneAssets] = useState<SceneAssets>({})
  const [chapterVideoUrls, setChapterVideoUrls] = useState<Record<string, string>>({})
  const [chapterSrtUrls, setChapterSrtUrls] = useState<Record<string, string>>({})
  const [chapterVideoState, setChapterVideoState] = useState<Record<string, AssetState>>({})
  const [showSettings, setShowSettings] = useState(false)
  const [expandedScenes, setExpandedScenes] = useState<Record<string, boolean>>({})
  const [skipExisting, setSkipExisting] = useState(true)
  const [batchLoading, setBatchLoading] = useState<Record<string, boolean>>({})
  const [videoViewerChapter, setVideoViewerChapter] = useState<number | null>(null)
  const [srtEditorOpen, setSrtEditorOpen] = useState(false)
  const [srtEditorChapter, setSrtEditorChapter] = useState<number | null>(null)
  const [srtEntries, setSrtEntries] = useState<SrtEntry[]>([])

  const assetKey = (ch: number, sc: number) => `${ch}_${sc}`

  useEffect(() => {
    adminGetVideoMaterials(id).then(r => {
      if (r.materials) {
        setMaterials(r.materials)
        setVoiceId(r.materials.settings?.voice_id || DEFAULT_VOICE)
        setSpeakingRate(r.materials.settings?.speaking_rate || 1.0)
      } else {
        setNoStoryboard(true)
      }
      if (r.scene_assets) {
        const parsed: SceneAssets = {}
        for (const [k, v] of Object.entries(r.scene_assets)) {
          const audioUrl = v.audio_url || ''
          const imageUrl = v.image_url || ''
          parsed[k] = {
            audioUrl,
            imageUrl,
            audioState: audioUrl ? ('done' as AssetState) : ('idle' as AssetState),
            imageState: imageUrl ? ('done' as AssetState) : ('idle' as AssetState),
          }
        }
        setSceneAssets(parsed)
      }
      if (r.chapter_videos) {
        setChapterVideoUrls(r.chapter_videos)
        const states: Record<string, AssetState> = {}
        for (const k of Object.keys(r.chapter_videos)) {
          states[k] = 'done'
        }
        setChapterVideoState(states)
      }
      if (r.chapter_srts) {
        setChapterSrtUrls(r.chapter_srts)
      }
      setLoading(false)
    }).catch(e => {
      setError(e instanceof Error ? e.message : 'Failed to load video materials')
      setLoading(false)
    })
  }, [id])

  const isFirstRender = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (!materials) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setAutoSaveStatus('saving')
      try {
        await adminSaveVideoMaterials(id, materials)
        setAutoSaveStatus('idle')
      } catch {
        setAutoSaveStatus('error')
      }
    }, 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [materials, id])

  function updateScene(chIdx: number, sIdx: number, field: 'narration_text' | 'visual_prompt', val: string) {
    if (!materials) return
    setMaterials({
      ...materials,
      chapters: materials.chapters.map((ch, ci) =>
        ci === chIdx
          ? { ...ch, scenes: ch.scenes.map((sc, si) => si === sIdx ? { ...sc, [field]: val } : sc) }
          : ch
      ),
    })
  }

  function toggleScene(chIdx: number, sIdx: number) {
    const key = assetKey(chIdx, sIdx)
    setExpandedScenes(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSceneTts = useCallback(async (chIdx: number, sIdx: number) => {
    const key = assetKey(chIdx, sIdx)
    if (!materials) return
    const text = materials.chapters[chIdx].scenes[sIdx]?.narration_text
    if (!text) { setMessage('旁白文字為空'); return }

    setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], audioState: 'loading', audioUrl: prev[key]?.audioUrl || '' } }))
    setMessage('')
    try {
      const r = await adminSceneTts(id, chIdx, sIdx, text, voiceId, speakingRate)
      setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], audioUrl: r.audio_data_url, audioState: 'done' as AssetState } }))
    } catch (e: unknown) {
      setMessage(`TTS 生成失敗：${e instanceof Error ? e.message : 'unknown'}`)
      setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], audioState: 'error' as AssetState } }))
    }
  }, [materials, id, voiceId, speakingRate])

  const handleSceneImage = useCallback(async (chIdx: number, sIdx: number) => {
    const key = assetKey(chIdx, sIdx)
    if (!materials) return
    const prompt = materials.chapters[chIdx].scenes[sIdx]?.visual_prompt
    if (!prompt) { setMessage('視覺提示為空'); return }

    setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], imageState: 'loading', imageUrl: prev[key]?.imageUrl || '' } }))
    setMessage('')
    try {
      const r = await adminSceneImage(id, chIdx, sIdx, prompt)
      setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], imageUrl: r.image_data_url, imageState: 'done' as AssetState } }))
    } catch (e: unknown) {
      setMessage(`圖片生成失敗：${e instanceof Error ? e.message : 'unknown'}`)
      setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], imageState: 'error' as AssetState } }))
    }
  }, [materials, id])

  const handleChapterAssemble = useCallback(async (chIdx: number) => {
    setChapterVideoState(prev => ({ ...prev, [String(chIdx)]: 'loading' }))
    setMessage('')
    try {
      const r = await adminChapterAssemble(id, chIdx)
      setChapterVideoUrls(prev => ({ ...prev, [String(chIdx)]: r.video_url }))
      const srtUrl = r.srt_url
      if (srtUrl) setChapterSrtUrls(prev => ({ ...prev, [String(chIdx)]: srtUrl }))
      setChapterVideoState(prev => ({ ...prev, [String(chIdx)]: 'done' }))
    } catch (e: unknown) {
      setMessage(`章節影片組合失敗：${e instanceof Error ? e.message : 'unknown'}`)
      setChapterVideoState(prev => ({ ...prev, [String(chIdx)]: 'error' }))
    }
  }, [id])

  const openSrtEditor = (chIdx: number) => {
    const srtUrl = chapterSrtUrls[String(chIdx)]
    if (!srtUrl) { setMessage('請先產生章節影片與字幕'); return }
    setSrtEditorChapter(chIdx)
    fetch(srtUrl).then(r => r.text()).then(content => {
      setSrtEntries(parseSrt(content))
      setSrtEditorOpen(true)
    }).catch(() => setMessage('讀取字幕檔失敗'))
  }

  const handleChapterTts = useCallback(async (chIdx: number) => {
    if (!materials) return
    const scenes = materials.chapters[chIdx]?.scenes
    if (!scenes?.length) return
    const batchKey = `tts_${chIdx}`
    setBatchLoading(prev => ({ ...prev, [batchKey]: true }))
    setMessage('')
    for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
      const key = assetKey(chIdx, sIdx)
      const text = scenes[sIdx]?.narration_text
      if (!text) continue
      const existing = sceneAssets[key]
      if (skipExisting && existing?.audioState === 'done') continue
      setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], audioState: 'loading', audioUrl: prev[key]?.audioUrl || '' } }))
      try {
        const r = await adminSceneTts(id, chIdx, sIdx, text, voiceId, speakingRate)
        setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], audioUrl: r.audio_data_url, audioState: 'done' as AssetState } }))
      } catch {
        setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], audioState: 'error' as AssetState } }))
      }
    }
    setBatchLoading(prev => ({ ...prev, [batchKey]: false }))
    setMessage('章節語音全部產生完成')
  }, [materials, id, voiceId, speakingRate, skipExisting, sceneAssets])

  const handleChapterImages = useCallback(async (chIdx: number) => {
    if (!materials) return
    const scenes = materials.chapters[chIdx]?.scenes
    if (!scenes?.length) return
    const batchKey = `img_${chIdx}`
    setBatchLoading(prev => ({ ...prev, [batchKey]: true }))
    setMessage('')
    for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
      const key = assetKey(chIdx, sIdx)
      const prompt = scenes[sIdx]?.visual_prompt
      if (!prompt) continue
      const existing = sceneAssets[key]
      if (skipExisting && existing?.imageState === 'done') continue
      setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], imageState: 'loading', imageUrl: prev[key]?.imageUrl || '' } }))
      try {
        const r = await adminSceneImage(id, chIdx, sIdx, prompt)
        setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], imageUrl: r.image_data_url, imageState: 'done' as AssetState } }))
      } catch {
        setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], imageState: 'error' as AssetState } }))
      }
    }
    setBatchLoading(prev => ({ ...prev, [batchKey]: false }))
    setMessage('章節圖片全部產生完成')
  }, [materials, id, skipExisting, sceneAssets])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
    </div>
  )

  if (error || !materials) {
    if (noStoryboard) return (
      <div className="space-y-6 fade-up p-6 max-w-2xl mx-auto text-center">
        <Link href={`/admin/orders/${id}`} className="text-sm text-mist hover:text-gold block text-left">← 返回訂單</Link>
        <div className="py-12">
          <h2 className="text-xl font-display font-bold text-paper mb-2">尚未產生分鏡腳本</h2>
          <p className="text-sm text-mist mb-6">點擊下方按鈕開始自動生成角色設定、場景劃分與旁白腳本</p>
          <button onClick={async () => {
            setGeneratingStoryboard(true)
            try {
              await adminGenerateStoryboard(id)
              setMessage('分鏡腳本正在生成中，請稍後重新整理頁面')
              // Poll for completion
              const poll = setInterval(async () => {
                const r = await adminGetVideoMaterials(id)
                if (r.materials) {
                  clearInterval(poll)
                  setNoStoryboard(false)
                  setMaterials(r.materials)
                  setVoiceId(r.materials.settings?.voice_id || DEFAULT_VOICE)
                  setSpeakingRate(r.materials.settings?.speaking_rate || 1.0)
                  const parsed: SceneAssets = {}
                  for (const [k, v] of Object.entries(r.scene_assets || {})) {
                    parsed[k] = {
                      audioUrl: v.audio_url || '',
                      imageUrl: v.image_url || '',
                      audioState: v.audio_url ? 'done' as AssetState : 'idle' as AssetState,
                      imageState: v.image_url ? 'done' as AssetState : 'idle' as AssetState,
                    }
                  }
                  setSceneAssets(parsed)
                  if (r.chapter_videos) setChapterVideoUrls(r.chapter_videos)
                  const states: Record<string, AssetState> = {}
                  for (const k of Object.keys(r.chapter_videos || {})) states[k] = 'done'
                  setChapterVideoState(states)
                  if (r.chapter_srts) setChapterSrtUrls(r.chapter_srts)
                  setGeneratingStoryboard(false)
                }
              }, 3000)
            } catch {
              setGeneratingStoryboard(false)
              setError('觸發生成失敗')
            }
          }} disabled={generatingStoryboard}
            className="px-6 py-3 rounded-xl bg-gold text-white font-bold text-base hover:bg-gold/90 disabled:opacity-40 transition-colors shadow-lg shadow-gold/20">
            {generatingStoryboard ? '⏳ 正在生成…' : '生成分鏡腳本'}
          </button>
          {message && <p className="text-sm text-mist mt-4">{message}</p>}
        </div>
      </div>
    )
    return (
      <div className="space-y-4 fade-up p-6">
        <Link href={`/admin/orders/${id}`} className="text-sm text-mist hover:text-gold">← 返回訂單</Link>
        <p className="text-coral text-base">{error}</p>
      </div>
    )
  }

  const chapter = materials.chapters[activeChapter]
  const totalScenes = materials.chapters.reduce((s: number, ch: VideoChapter) => s + ch.scenes.length, 0)
  const chKey = String(chapter?.chapter_index ?? '')

  function statusIcon(state: AssetState) {
    if (state === 'loading') return <span className="text-yellow-400 text-xs animate-pulse">⏳</span>
    if (state === 'done') return <span className="text-green-400 text-xs">✓</span>
    if (state === 'error') return <span className="text-red-400 text-xs">✗</span>
    return null
  }

  return (
    <>
    <div className="space-y-4 fade-up p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href={`/admin/orders/${id}`} className="text-sm text-mist hover:text-gold transition-colors">← 返回訂單</Link>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-paper mt-1">影片分鏡腳本</h1>
          <p className="text-xs text-mist mt-0.5">{materials.chapters.length} 章 · {totalScenes} 個場景</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-1.5 rounded-lg border border-white/20 text-paper text-xs hover:bg-white/10 transition-colors">
            設定
          </button>
          <span className="text-xs text-mist/60">
            {autoSaveStatus === 'saving' ? '儲存中…' : autoSaveStatus === 'error' ? '儲存失敗' : '✓ 已自動儲存'}
          </span>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-paper">{message}</div>
      )}

      {/* Skip-existing toggle */}
      <label className="flex items-center gap-2 text-xs text-mist cursor-pointer select-none px-1">
        <input type="checkbox" checked={skipExisting} onChange={e => setSkipExisting(e.target.checked)}
          className="accent-gold" />
        批次產生時跳過已完成的
      </label>

      {/* Settings */}
      {showSettings && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold text-paper mb-3">語音設定</h2>
            <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs text-mist block mb-1">語者 (BRONCI TTS)</label>
              <select value={voiceId} onChange={e => setVoiceId(e.target.value)}
                className="rounded bg-[#1e293b] border border-white/10 text-paper text-sm px-3 py-2 focus:outline-none focus:border-gold">
                {VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-mist block mb-1">語速 ({speakingRate.toFixed(1)})</label>
              <input type="range" min="0.25" max="4.0" step="0.25"
                value={speakingRate} onChange={e => setSpeakingRate(parseFloat(e.target.value))}
                className="w-28 accent-gold" />
            </div>
          </div>
        </div>
      )}

      {/* Global Character Sheet */}
      <details className="rounded-xl border border-white/10 bg-white/5 p-3">
        <summary className="text-sm font-semibold text-paper cursor-pointer">角色與場景設定</summary>
        <div className="mt-2 space-y-1.5 text-xs">
          {Object.entries(materials.global_style.characters).map(([name, desc]) => (
            <div key={name}>
              <span className="font-medium text-gold">{name}</span>
              <p className="text-mist whitespace-pre-wrap">{desc}</p>
            </div>
          ))}
          <div className="mt-2">
            <span className="font-medium text-gold">環境</span>
            <p className="text-mist whitespace-pre-wrap">{materials.global_style.environment}</p>
          </div>
        </div>
      </details>

      {/* Chapter Tab Bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {materials.chapters.map((ch: VideoChapter, ci: number) => {
          const ck = String(ch.chapter_index)
          const url = chapterVideoUrls[ck]
          return (
            <button key={ci} onClick={() => setActiveChapter(ci)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                ${ci === activeChapter
                  ? 'bg-gold/20 text-gold border border-gold/40'
                  : 'bg-white/5 text-mist border border-white/10 hover:bg-white/10'}`}>
              {ci + 1}. {ZH_CHAPTER_TITLES[ci] || ch.title}
              {chapterVideoState[ck] === 'done' && url && (
                <span onClick={e => { e.stopPropagation(); setVideoViewerChapter(ch.chapter_index) }}
                  className="text-green-400 cursor-pointer hover:scale-110 transition-transform" title="觀看影片">▶</span>
              )}
              {chapterVideoState[ck] === 'loading' && (
                <span className="text-yellow-400 text-[10px] animate-pulse">⏳</span>
              )}
              {chapterVideoState[ck] === 'error' && (
                <span className="text-red-400" title="影片生成失敗">✗</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Active Chapter */}
      {chapter && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
          {/* Chapter header with video button */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-paper">
              Chapter {chapter.chapter_index + 1}: {chapter.title}
              <span className="text-xs text-mist font-normal ml-2">({chapter.scenes.length} 場景)</span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleChapterTts(chapter.chapter_index)}
                disabled={batchLoading[`tts_${chapter.chapter_index}`]}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-paper hover:bg-white/20 disabled:opacity-40 transition-colors">
                {batchLoading[`tts_${chapter.chapter_index}`] ? '⏳ 語音批次中…' : '🔊 產生全部語音'}
              </button>
              <button
                onClick={() => handleChapterImages(chapter.chapter_index)}
                disabled={batchLoading[`img_${chapter.chapter_index}`]}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-paper hover:bg-white/20 disabled:opacity-40 transition-colors">
                {batchLoading[`img_${chapter.chapter_index}`] ? '⏳ 圖片批次中…' : '🖼 產生全部圖片'}
              </button>
              {chapterVideoUrls[chKey] ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVideoViewerChapter(chapter.chapter_index)}
                    className="w-8 h-8 rounded-lg bg-green-900/40 text-green-300 border border-green-700/30 flex items-center justify-center hover:bg-green-800/40 transition-colors text-sm"
                    title="觀看影片">▶</button>
                  {chapterSrtUrls[chKey] && (
                    <>
                    <a href={chapterSrtUrls[chKey]} download
                      className="px-2 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-paper hover:bg-white/20 transition-colors no-underline"
                      title="下載字幕檔">SRT</a>
                    <button onClick={() => openSrtEditor(chapter.chapter_index)}
                      className="px-2 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-paper hover:bg-white/20 transition-colors">
                      驗證
                    </button>
                    </>
                  )}
                  <button
                    onClick={() => handleChapterAssemble(chapter.chapter_index)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-paper hover:bg-white/20 transition-colors">
                    🔄 重新產生
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleChapterAssemble(chapter.chapter_index)}
                  disabled={chapterVideoState[chKey] === 'loading'}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-gold text-white hover:bg-gold/90 disabled:opacity-40 transition-colors shadow-lg shadow-gold/20">
                  {chapterVideoState[chKey] === 'loading' ? '⏳ 組合中…' : '🎬 生成此章影片'}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {chapter.scenes.map((scene: VideoScene, sIdx: number) => {
              const key = assetKey(chapter.chapter_index, sIdx)
              const assets = sceneAssets[key] || { audioUrl: '', imageUrl: '', audioState: 'idle', imageState: 'idle' }
              const isExpanded = expandedScenes[key] ?? false

              return (
                <div key={scene.scene_index}
                  className="rounded-lg border border-white/5 bg-white/[0.03] overflow-hidden">
                  {/* Scene header */}
                  <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => toggleScene(chapter.chapter_index, sIdx)}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-mist">
                        Scene {scene.scene_index + 1}
                      </span>
                      <span className="text-[10px] text-mist/60">{scene.duration_est}</span>
                      <div className="flex items-center gap-1 ml-1">
                        {statusIcon(assets.audioState)}
                        {statusIcon(assets.imageState)}
                      </div>
                    </div>
                    <span className="text-mist/40 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3">
                      {/* Narration */}
                      <div>
                        <label className="text-xs text-mist block mb-1">旁白腳本 (Traditional Chinese)</label>
                        <textarea value={scene.narration_text}
                          ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }}}
                          onChange={e => { updateScene(chapter.chapter_index, sIdx, 'narration_text', e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                          dir="auto"
                          className="w-full rounded bg-[#1e293b] border border-white/10 text-paper text-sm px-3 py-2 focus:outline-none focus:border-gold resize-none overflow-hidden" />
                      </div>

                      {/* Visual prompt */}
                      <div>
                        <label className="text-xs text-mist block mb-1">視覺提示 (English prompt)</label>
                        <textarea value={scene.visual_prompt}
                          ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }}}
                          onChange={e => { updateScene(chapter.chapter_index, sIdx, 'visual_prompt', e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                          className="w-full rounded bg-[#1e293b] border border-white/10 text-paper text-sm px-3 py-2 focus:outline-none focus:border-gold resize-none overflow-hidden font-mono text-xs" />
                      </div>

                      {/* Generation controls */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Audio */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleSceneTts(chapter.chapter_index, sIdx)}
                            disabled={assets.audioState === 'loading'}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40
                              ${assets.audioState === 'done' ? 'bg-green-900/30 text-green-300 border border-green-700/30' : 'bg-white/10 text-paper hover:bg-white/20'}`}>
                            {assets.audioState === 'loading' ? '⏳' : assets.audioUrl ? '🔊 重新生成' : '🔊 生成語音'}
                          </button>
                          {assets.audioUrl && (
                            <audio controls src={assets.audioUrl} preload="none" className="h-8 w-32" />
                          )}
                        </div>

                        {/* Image */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleSceneImage(chapter.chapter_index, sIdx)}
                            disabled={assets.imageState === 'loading'}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40
                              ${assets.imageState === 'done' ? 'bg-green-900/30 text-green-300 border border-green-700/30' : 'bg-white/10 text-paper hover:bg-white/20'}`}>
                            {assets.imageState === 'loading' ? '⏳' : assets.imageUrl ? '🖼 重新生成' : '🖼 生成圖片'}
                          </button>
                        </div>
                      </div>

                      {/* Image preview */}
                      {assets.imageUrl && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-mist/60">圖片預覽</p>
                          <img src={assets.imageUrl} alt="Generated visual"
                            className="rounded border border-white/10 max-w-full max-h-48 object-contain" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>

      {/* SRT Editor modal */}
      {srtEditorOpen && srtEditorChapter !== null && chapterVideoUrls[String(srtEditorChapter)] && (
        <SrtVerifierModal
          videoUrl={chapterVideoUrls[String(srtEditorChapter)]}
          entries={srtEntries}
          onClose={() => setSrtEditorOpen(false)}
        />
      )}

      {/* Video viewer modal */}
      {videoViewerChapter !== null && chapterVideoUrls[String(videoViewerChapter)] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setVideoViewerChapter(null)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setVideoViewerChapter(null)}
              className="absolute -top-8 right-0 text-white/70 hover:text-white text-sm">
              關閉 ✕
            </button>
            <div className="flex items-center justify-between mb-2">
              <video controls autoPlay className="w-full rounded-lg shadow-2xl"
                src={chapterVideoUrls[String(videoViewerChapter)]} />
            </div>
            {chapterSrtUrls[String(videoViewerChapter)] && (
              <a href={chapterSrtUrls[String(videoViewerChapter)]} download
                className="inline-block px-3 py-1 text-xs text-white/70 hover:text-white bg-white/10 rounded transition-colors no-underline"
                target="_blank" rel="noopener noreferrer">
                下載字幕 (.srt)
              </a>
            )}
          </div>
        </div>
      )}
    </>
  )
}


function SrtVerifierModal({ videoUrl, entries, onClose }: {
  videoUrl: string
  entries: SrtEntry[]
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentIdx, setCurrentIdx] = useState(-1)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    const onTime = () => {
      const t = vid.currentTime
      const idx = entries.findIndex(e => t >= e.start && t < e.end)
      setCurrentIdx(idx)
    }
    vid.addEventListener('timeupdate', onTime)
    return () => vid.removeEventListener('timeupdate', onTime)
  }, [entries])

  useEffect(() => {
    if (currentIdx < 0 || !listRef.current) return
    const el = listRef.current.children[currentIdx] as HTMLElement
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentIdx])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4"
      onClick={onClose}>
      <div className="relative max-w-4xl w-full max-h-[95vh] flex flex-col bg-[#0f172a] rounded-xl border border-white/10 overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 shrink-0">
          <h3 className="text-sm font-semibold text-paper">字幕時間軸驗證</h3>
          <button onClick={onClose}
            className="text-white/50 hover:text-white text-sm">✕</button>
        </div>

        {/* Video */}
        <div className="bg-black shrink-0">
          <video ref={videoRef} controls src={videoUrl} preload="auto"
            className="w-full max-h-48 sm:max-h-64 object-contain mx-auto" />
        </div>

        {/* Subtitle list */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {entries.map((e, i) => (
            <div key={e.index}
              onClick={() => { if (videoRef.current) videoRef.current.currentTime = e.start }}
              className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors text-xs
                ${i === currentIdx ? 'bg-gold/15 border border-gold/30' : 'hover:bg-white/5 border border-transparent'}`}>
              <span className="shrink-0 w-5 text-mist/60 font-mono text-[10px] pt-1">{e.index}</span>
              <span className="shrink-0 w-24 text-mist/80 font-mono text-[10px] pt-1">
                {secToSrtTime(e.start).replace(',', '.')} → {secToSrtTime(e.end).replace(',', '.')}
              </span>
              <div className="flex-1 text-paper text-xs leading-relaxed whitespace-pre-wrap">
                {e.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
