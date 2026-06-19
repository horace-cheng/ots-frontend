'use client'
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  adminGetVideoMaterials, adminSaveVideoMaterials,
  adminSceneTts, adminSceneRetranslate, adminSceneVideo, adminSceneReferenceImage,
  adminChapterAssemble, adminChapterMerge, adminSceneRegeneratePrompt,
  adminGenerateStoryboard, adminCleanVideoAssets,
  VideoMaterials, VideoChapter, VideoScene,
} from '@/lib/api'

type AssetState = 'idle' | 'loading' | 'done' | 'error'
type Track = 'zh' | 'tai-lo'

const TRACK_LABELS: Record<Track, string> = {
  zh: '華語',
  'tai-lo': '台語',
}
type SceneAssets = Record<string, {
  audioUrl: string
  imageUrl: string
  videoUrl: string
  audioState: AssetState
  imageState: AssetState
  videoState: AssetState
  audioDuration: number
}>

const TRACK_DEFAULT_VOICES: Record<Track, string> = {
  zh: 'cmn-TW-vs2-F04',
  'tai-lo': 'cmn-TW-vs2-F04',
}

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
  const [voiceSettings, setVoiceSettings] = useState<Record<Track, { voiceId: string; speakingRate: number; shortPause: number; longPause: number }>>({
    zh: { voiceId: TRACK_DEFAULT_VOICES.zh, speakingRate: 1.0, shortPause: 150, longPause: 450 },
    'tai-lo': { voiceId: TRACK_DEFAULT_VOICES['tai-lo'], speakingRate: 1.0, shortPause: 150, longPause: 450 },
  })
  const [sceneAssets, setSceneAssets] = useState<SceneAssets>({})
  const [chapterVideoUrls, setChapterVideoUrls] = useState<Record<string, string>>({})
  const [chapterSrtUrls, setChapterSrtUrls] = useState<Record<string, string>>({})
  const [chapterVideoState, setChapterVideoState] = useState<Record<string, AssetState>>({})
  const [showSettings, setShowSettings] = useState(false)
  const [expandedScenes, setExpandedScenes] = useState<Record<string, boolean>>({})
  const [skipExisting, setSkipExisting] = useState(true)
  const [batchLoading, setBatchLoading] = useState<Record<string, boolean>>({})
  const [videoViewerChapter, setVideoViewerChapter] = useState<{ chIdx: number; track: Track } | null>(null)
  const [sceneVideoPreview, setSceneVideoPreview] = useState<{ videoUrl: string; track: Track } | null>(null)
  const [srtEditorOpen, setSrtEditorOpen] = useState(false)
  const [srtEditorChapter, setSrtEditorChapter] = useState<{ chIdx: number; track: Track } | null>(null)
  const [srtEntries, setSrtEntries] = useState<SrtEntry[]>([])

  const [cleanModal, setCleanModal] = useState<{ show: boolean; backingUp: boolean; removeMaterials: boolean }>({ show: false, backingUp: true, removeMaterials: false })

  const assetKey = (ch: number, sc: number, track: Track) => `${ch}_${sc}_${track}`

  useEffect(() => {
    adminGetVideoMaterials(id).then(r => {
      if (r.materials) {
        setMaterials(r.materials)
        const s = r.materials.settings
        if (s) {
          setVoiceSettings(prev => ({
            ...prev,
            zh: {
              ...prev.zh,
              voiceId: (s as any).voice_id_zh || s.voice_id || TRACK_DEFAULT_VOICES.zh,
              shortPause: (s as any).short_pause_duration ?? prev.zh.shortPause,
              longPause: (s as any).long_pause_duration ?? prev.zh.longPause,
            },
            'tai-lo': {
              ...prev['tai-lo'],
              voiceId: (s as any).voice_id_tai_lo || TRACK_DEFAULT_VOICES['tai-lo'],
              shortPause: (s as any).short_pause_duration ?? prev['tai-lo'].shortPause,
              longPause: (s as any).long_pause_duration ?? prev['tai-lo'].longPause,
            },
          }))
        }
      } else {
        setNoStoryboard(true)
      }
      if (r.scene_assets) {
        const parsed: SceneAssets = {}
        for (const [k, v] of Object.entries(r.scene_assets)) {
          const audioUrl = (v as any).audio_url || ''
          const refUrl = (v as any).reference_image_url || ''
          parsed[k] = {
            audioUrl,
            imageUrl: refUrl,
            videoUrl: (v as any).video_url || '',
            audioState: audioUrl ? ('done' as AssetState) : ('idle' as AssetState),
            imageState: refUrl ? ('done' as AssetState) : ('idle' as AssetState),
            videoState: (v as any).video_url ? ('done' as AssetState) : ('idle' as AssetState),
            audioDuration: (v as any).audio_duration || 0,
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

  function updateScene(chIdx: number, sIdx: number, field: string, val: string, track?: Track) {
    if (!materials) return
    setMaterials(prev => {
      if (!prev) return prev
      return {
        ...prev,
        chapters: prev.chapters.map((ch, ci) =>
          ci === chIdx
            ? {
                ...ch,
                scenes: ch.scenes.map((sc, si) => {
                  if (si !== sIdx) return sc
                  if (field === 'visual_prompt') return { ...sc, visual_prompt: val }
                  // narration_text for a specific track
                  const tracks = sc.tracks || { zh: { narration_text: sc.narration_text || '' }, 'tai-lo': { narration_text: '' } }
                  const t = track || 'zh'
                  return { ...sc, tracks: { ...tracks, [t]: { narration_text: val } } }
                })
              }
            : ch
        ),
      }
    })
  }

  function toggleScene(chIdx: number, sIdx: number) {
    const key = `${chIdx}_${sIdx}`
    setExpandedScenes(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSceneTts = useCallback(async (chIdx: number, sIdx: number, track: Track) => {
    const key = assetKey(chIdx, sIdx, track)
    if (!materials) return
    const scene = materials.chapters[chIdx].scenes[sIdx]
    const text = scene.tracks?.[track]?.narration_text || (track === 'zh' ? scene.narration_text : '')
    if (!text) { setMessage('旁白文字為空'); return }

    setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], audioState: 'loading', audioUrl: prev[key]?.audioUrl || '' } }))
    setMessage('')
    try {
      const vs = voiceSettings[track]
      const r = await adminSceneTts(id, chIdx, sIdx, text, vs.voiceId, vs.speakingRate, track, vs.shortPause, vs.longPause)
      setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], audioUrl: r.audio_data_url, audioDuration: r.duration_sec, audioState: 'done' as AssetState } }))
    } catch (e: unknown) {
      setMessage(`TTS 生成失敗：${e instanceof Error ? e.message : 'unknown'}`)
      setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], audioState: 'error' as AssetState } }))
    }
  }, [materials, id, voiceSettings])

  const handleSceneRetranslate = useCallback(async (chIdx: number, sIdx: number) => {
    if (!materials) return
    setMessage('')
    try {
      const r = await adminSceneRetranslate(id, chIdx, sIdx)
      setMaterials(prev => {
        if (!prev) return prev
        return {
          ...prev,
          chapters: prev.chapters.map((ch, ci) =>
            ci === chIdx
              ? {
                  ...ch,
                  scenes: ch.scenes.map((sc, si) => {
                    if (si !== sIdx) return sc
                    const tracks = sc.tracks || { zh: { narration_text: '' }, 'tai-lo': { narration_text: '' } }
                    return { ...sc, tracks: { ...tracks, 'tai-lo': { narration_text: r.tai_lo_text } } }
                  })
                }
              : ch
          ),
        }
      })
      // Clear stale Tai-lo audio asset
      const taiLoKey = assetKey(chIdx, sIdx, 'tai-lo')
      setSceneAssets(prev => ({ ...prev, [taiLoKey]: { audioUrl: '', imageUrl: prev[taiLoKey]?.imageUrl || '', videoUrl: '', audioState: 'idle', imageState: prev[taiLoKey]?.imageState || 'idle', videoState: 'idle', audioDuration: 0 } }))
      setMessage('台語翻譯完成')
    } catch (e: unknown) {
      setMessage(`台語翻譯失敗：${e instanceof Error ? e.message : 'unknown'}`)
    }
  }, [materials, id])

  const handleChapterAssemble = useCallback(async (chIdx: number, track: Track) => {
    const chKey = `${chIdx}_${track}`
    setChapterVideoState(prev => ({ ...prev, [chKey]: 'loading' }))
    setMessage('')
    try {
      const r = await adminChapterAssemble(id, chIdx, track)
      setChapterVideoUrls(prev => ({ ...prev, [chKey]: r.video_url }))
      const srtUrl = r.srt_url
      if (srtUrl) setChapterSrtUrls(prev => ({ ...prev, [chKey]: srtUrl }))
      setChapterVideoState(prev => ({ ...prev, [chKey]: 'done' }))
    } catch (e: unknown) {
      setMessage(`章節影片組合失敗：${e instanceof Error ? e.message : 'unknown'}`)
      setChapterVideoState(prev => ({ ...prev, [chKey]: 'error' }))
    }
  }, [id])

  const handleSceneReferenceImage = useCallback(async (chIdx: number, sIdx: number) => {
    if (!materials) return
    const blank = { audioUrl: '', imageUrl: '', videoUrl: '', audioState: 'idle' as AssetState, imageState: 'idle' as AssetState, videoState: 'idle' as AssetState, audioDuration: 0 }
    setMessage('')
    try {
      for (const t of (['zh', 'tai-lo'] as Track[])) {
        const k = assetKey(chIdx, sIdx, t)
        setSceneAssets(prev => ({ ...prev, [k]: { ...blank, imageState: 'loading' as AssetState } }))
      }
      const r = await adminSceneReferenceImage(id, chIdx, sIdx)
      for (const t of (['zh', 'tai-lo'] as Track[])) {
        const k = assetKey(chIdx, sIdx, t)
        setSceneAssets(prev => ({ ...prev, [k]: { ...blank, imageUrl: r.image_data_url, imageState: 'done' as AssetState } }))
      }
      setMessage('參考圖片已產生')
    } catch (e: unknown) {
      for (const t of (['zh', 'tai-lo'] as Track[])) {
        const k = assetKey(chIdx, sIdx, t)
        setSceneAssets(prev => ({ ...prev, [k]: { ...blank, imageState: 'error' as AssetState } }))
      }
      setMessage(`參考圖片產生失敗：${e instanceof Error ? e.message : 'unknown'}`)
    }
  }, [materials, id])

  const handleSceneVideo = useCallback(async (chIdx: number, sIdx: number, track: Track) => {
    const key = assetKey(chIdx, sIdx, track)
    if (!materials) return

    setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], videoState: 'loading', videoUrl: prev[key]?.videoUrl || '' } }))
    setMessage('')
    try {
      const r = await adminSceneVideo(id, chIdx, sIdx, track)
      setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], videoUrl: r.video_data_url, videoState: 'done' as AssetState } }))
    } catch (e: unknown) {
      setMessage(`場景影片生成失敗：${e instanceof Error ? e.message : 'unknown'}`)
      setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], videoState: 'error' as AssetState } }))
    }
  }, [materials, id])

  const handleChapterMerge = useCallback(async (chIdx: number, track: Track) => {
    const chKey = `${chIdx}_${track}`
    setChapterVideoState(prev => ({ ...prev, [chKey]: 'loading' }))
    setMessage('')
    try {
      const r = await adminChapterMerge(id, chIdx, track)
      setChapterVideoUrls(prev => ({ ...prev, [chKey]: r.video_url }))
      const srtUrl = r.srt_url
      if (srtUrl) setChapterSrtUrls(prev => ({ ...prev, [chKey]: srtUrl }))
      setChapterVideoState(prev => ({ ...prev, [chKey]: 'done' }))
    } catch (e: unknown) {
      setMessage(`章節影片合併失敗：${e instanceof Error ? e.message : 'unknown'}`)
      setChapterVideoState(prev => ({ ...prev, [chKey]: 'error' }))
    }
  }, [id])

  const handleSceneRegeneratePrompt = useCallback(async (chIdx: number, sIdx: number) => {
    if (!materials) return
    setMessage('')
    try {
      const r = await adminSceneRegeneratePrompt(id, chIdx, sIdx)
      setMaterials(prev => {
        if (!prev) return prev
        const updated = { ...prev, chapters: [...prev.chapters] }
        const ch = { ...updated.chapters[chIdx] }
        ch.scenes = [...ch.scenes]
        ch.scenes[sIdx] = { ...ch.scenes[sIdx], visual_prompt: r.visual_prompt }
        updated.chapters[chIdx] = ch
        return updated
      })
      setMessage('視覺提示已重新生成')
    } catch (e: unknown) {
      setMessage(`重新生成失敗：${e instanceof Error ? e.message : 'unknown'}`)
    }
  }, [materials, id])

  const openSrtEditor = (chIdx: number, track: Track) => {
    const srtUrl = chapterSrtUrls[`${chIdx}_${track}`]
    if (!srtUrl) { setMessage('請先產生章節影片與字幕'); return }
    setSrtEditorChapter({ chIdx, track })
    fetch(srtUrl).then(r => r.text()).then(content => {
      setSrtEntries(parseSrt(content))
      setSrtEditorOpen(true)
    }).catch(() => setMessage('讀取字幕檔失敗'))
  }

  const handleChapterTts = useCallback(async (chIdx: number, track: Track) => {
    if (!materials) return
    const scenes = materials.chapters[chIdx]?.scenes
    if (!scenes?.length) return
    const batchKey = `tts_${chIdx}_${track}`
    setBatchLoading(prev => ({ ...prev, [batchKey]: true }))
    setMessage('')
    const vs = voiceSettings[track]
    for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
      const key = assetKey(chIdx, sIdx, track)
      const scene = scenes[sIdx]
      const text = scene.tracks?.[track]?.narration_text || (track === 'zh' ? scene.narration_text : '')
      if (!text) continue
      const existing = sceneAssets[key]
      if (skipExisting && existing?.audioState === 'done') continue
      setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], audioState: 'loading', audioUrl: prev[key]?.audioUrl || '' } }))
      try {
        const r = await adminSceneTts(id, chIdx, sIdx, text, vs.voiceId, vs.speakingRate, track, vs.shortPause, vs.longPause)
        setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], audioUrl: r.audio_data_url, audioState: 'done' as AssetState } }))
      } catch {
        setSceneAssets(prev => ({ ...prev, [key]: { ...prev[key], audioState: 'error' as AssetState } }))
      }
    }
    setBatchLoading(prev => ({ ...prev, [batchKey]: false }))
    setMessage(`章節語音（${TRACK_LABELS[track]}）全部產生完成`)
  }, [materials, id, voiceSettings, skipExisting, sceneAssets])

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
                  const s = r.materials.settings
                  if (s) {
                    setVoiceSettings(prev => ({
                      ...prev,
                      zh: {
                        ...prev.zh,
                        voiceId: (s as any).voice_id_zh || s.voice_id || TRACK_DEFAULT_VOICES.zh,
                        shortPause: (s as any).short_pause_duration ?? prev.zh.shortPause,
                        longPause: (s as any).long_pause_duration ?? prev.zh.longPause,
                      },
                      'tai-lo': {
                        ...prev['tai-lo'],
                        voiceId: (s as any).voice_id_tai_lo || TRACK_DEFAULT_VOICES['tai-lo'],
                        shortPause: (s as any).short_pause_duration ?? prev['tai-lo'].shortPause,
                        longPause: (s as any).long_pause_duration ?? prev['tai-lo'].longPause,
                      },
                    }))
                  }
                  const parsed: SceneAssets = {}
                  for (const [k, v] of Object.entries(r.scene_assets || {})) {
                    const audioUrl = (v as any).audio_url || ''
                    const refUrl = (v as any).reference_image_url || ''
                    parsed[k] = {
                      audioUrl,
                      imageUrl: refUrl || (v as any).image_url || '',
                      videoUrl: (v as any).video_url || '',
                      audioState: audioUrl ? 'done' as AssetState : 'idle' as AssetState,
                      imageState: refUrl ? 'done' as AssetState : 'idle' as AssetState,
                      videoState: (v as any).video_url ? 'done' as AssetState : 'idle' as AssetState,
                      audioDuration: (v as any).audio_duration || 0,
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

  return (
    <>
    <div className="space-y-4 fade-up">
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
          {/* Clean button */}
          <button onClick={() => setCleanModal({ show: true, backingUp: true, removeMaterials: false })}
            className="px-3 py-1.5 rounded-lg border border-red-400/30 text-red-300 text-xs hover:bg-red-900/20 transition-colors">
            清除
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
          <div className="flex flex-col gap-4">
            {(['zh', 'tai-lo'] as Track[]).map(t => (
              <div key={t} className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs text-mist block mb-1">語者 — {TRACK_LABELS[t]}</label>
                  <select value={voiceSettings[t].voiceId}
                    onChange={e => setVoiceSettings(prev => ({ ...prev, [t]: { ...prev[t], voiceId: e.target.value } }))}
                    className="rounded bg-[#1e293b] border border-white/10 text-paper text-sm px-3 py-2 focus:outline-none focus:border-gold">
                    {VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-mist block mb-1">語速 ({TRACK_LABELS[t]}) — {voiceSettings[t].speakingRate.toFixed(1)}</label>
                  <input type="range" min="0.25" max="4.0" step="0.25"
                    value={voiceSettings[t].speakingRate}
                    onChange={e => { const v = parseFloat(e.target.value); setVoiceSettings(prev => ({ ...prev, [t]: { ...prev[t], speakingRate: v } })); setMaterials(prev => prev ? { ...prev, settings: { ...prev.settings, speaking_rate: v } } : prev) }}
                    className="w-28 accent-gold" />
                </div>
                <div>
                  <label className="text-xs text-mist block mb-1">短停頓 ({TRACK_LABELS[t]}) — {voiceSettings[t].shortPause}ms</label>
                  <input type="range" min="0" max="500" step="10"
                    value={voiceSettings[t].shortPause}
                    onChange={e => { const v = parseInt(e.target.value); setVoiceSettings(prev => ({ ...prev, [t]: { ...prev[t], shortPause: v } })); setMaterials(prev => prev ? { ...prev, settings: { ...prev.settings, short_pause_duration: v } } : prev) }}
                    className="w-28 accent-gold" />
                </div>
                <div>
                  <label className="text-xs text-mist block mb-1">長停頓 ({TRACK_LABELS[t]}) — {voiceSettings[t].longPause}ms</label>
                  <input type="range" min="0" max="1000" step="10"
                    value={voiceSettings[t].longPause}
                    onChange={e => { const v = parseInt(e.target.value); setVoiceSettings(prev => ({ ...prev, [t]: { ...prev[t], longPause: v } })); setMaterials(prev => prev ? { ...prev, settings: { ...prev.settings, long_pause_duration: v } } : prev) }}
                    className="w-28 accent-gold" />
                </div>
              </div>
            ))}
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
          const ck = `${ch.chapter_index}_zh`
          const url = chapterVideoUrls[ck]
          return (
            <button key={ci} onClick={() => setActiveChapter(ci)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                ${ci === activeChapter
                  ? 'bg-gold/20 text-gold border border-gold/40'
                  : 'bg-white/5 text-mist border border-white/10 hover:bg-white/10'}`}>
              {ci + 1}. {ch.title}
              {chapterVideoState[ck] === 'done' && url && (
                <span onClick={e => { e.stopPropagation(); setVideoViewerChapter({ chIdx: ch.chapter_index, track: 'zh' }) }}
                  className="text-green-400 cursor-pointer hover:scale-110 transition-transform" title="觀看影片">▶</span>
              )}
              {chapterVideoState[ck] === 'loading' && (
                <span className="text-yellow-400 text-xs animate-pulse">⏳</span>
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
              {(['zh', 'tai-lo'] as Track[]).map(t => (
                <button key={t}
                  onClick={() => handleChapterTts(chapter.chapter_index, t)}
                  disabled={batchLoading[`tts_${chapter.chapter_index}_${t}`]}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-paper hover:bg-white/20 disabled:opacity-40 transition-colors">
                  {batchLoading[`tts_${chapter.chapter_index}_${t}`] ? '⏳' : `🔊 ${TRACK_LABELS[t]}語音`}
                </button>
              ))}
              {(['zh', 'tai-lo'] as Track[]).map(t => {
                const chKey = `${chapter.chapter_index}_${t}`
                return (
                  <div key={t} className="flex items-center gap-1">
                    {chapterVideoUrls[chKey] ? (
                      <>
                        <button
                          onClick={() => setVideoViewerChapter({ chIdx: chapter.chapter_index, track: t })}
                          className="w-8 h-8 rounded-lg bg-green-900/40 text-green-300 border border-green-700/30 flex items-center justify-center hover:bg-green-800/40 transition-colors text-sm"
                          title={`觀看影片 (${TRACK_LABELS[t]})`}>▶</button>
                        {chapterSrtUrls[chKey] && (
                          <button onClick={() => openSrtEditor(chapter.chapter_index, t)}
                            className="px-2 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-paper hover:bg-white/20 transition-colors">
                            驗證
                          </button>
                        )}
                        <button
                          onClick={() => handleChapterMerge(chapter.chapter_index, t)}
                          disabled={chapterVideoState[chKey] === 'loading'}
                          className="px-2 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-paper hover:bg-white/20 transition-colors">
                          {chapterVideoState[chKey] === 'loading' ? '⏳' : '🔗 合併'} {TRACK_LABELS[t]}
                        </button>
                        <button
                          onClick={() => handleChapterAssemble(chapter.chapter_index, t)}
                          className="px-2 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-paper hover:bg-white/20 transition-colors">
                          🔄 {TRACK_LABELS[t]}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleChapterAssemble(chapter.chapter_index, t)}
                        disabled={chapterVideoState[chKey] === 'loading'}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gold text-white hover:bg-gold/90 disabled:opacity-40 transition-colors shadow-lg shadow-gold/20">
                        {chapterVideoState[chKey] === 'loading' ? '⏳' : `🎬 ${TRACK_LABELS[t]}影片`}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            {chapter.scenes.map((scene: VideoScene, sIdx: number) => {
              const isExpanded = expandedScenes[`${chapter.chapter_index}_${sIdx}`] ?? false

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
                      <span className="text-xs text-mist/60">{scene.duration_est}</span>
                      {(['zh', 'tai-lo'] as Track[]).map(t => {
                        const ak = assetKey(chapter.chapter_index, sIdx, t)
                        const a = sceneAssets[ak]
                        if (!a || !a.audioDuration) return null
                        const label = TRACK_LABELS[t].charAt(0)
                        const tooLong = a.audioDuration >= 15
                        return (
                          <span key={t}
                            className={`text-xs ${tooLong ? 'text-red-400' : 'text-mist/50'}`}
                            title={`${tooLong ? '⚠️ 音訊 ≥ 15s，建議縮短' : `${TRACK_LABELS[t]} TTS 長度`}`}>
                            {label}({a.audioDuration.toFixed(1)}s)
                          </span>
                        )
                      })}
                      <div className="flex items-center gap-1 ml-1">
                        {(['zh', 'tai-lo'] as Track[]).map(t => {
                          const ak = assetKey(chapter.chapter_index, sIdx, t)
                          const a = sceneAssets[ak]
                          if (!a || a.audioState === 'idle') return null
                          const label = TRACK_LABELS[t].charAt(0)
                          if (a.audioState === 'loading') return <span key={t} className="text-yellow-400 text-xs animate-pulse" title={`${TRACK_LABELS[t]} 語音生成中`}>{label}⏳</span>
                          if (a.audioState === 'error') return <span key={t} className="text-red-400 text-xs" title={`${TRACK_LABELS[t]} 語音失敗`}>{label}✗</span>
                          return null
                        })}
                        {(['zh', 'tai-lo'] as Track[]).map(t => {
                          const vk = assetKey(chapter.chapter_index, sIdx, t)
                          const v = sceneAssets[vk]
                          if (!v || v.videoState === 'idle') return null
                          const label = TRACK_LABELS[t].charAt(0)
                          if (v.videoState === 'loading') return <span key={t} className="text-yellow-400 text-xs animate-pulse" title={`${TRACK_LABELS[t]} 影片生成中`}>{label}🎬⏳</span>
                          if (v.videoState === 'done') return (
                            <span key={t}
                              className="text-green-400 text-xs cursor-pointer hover:scale-110 transition-transform"
                              title={`${TRACK_LABELS[t]} 影片完成 — 點擊預覽`}
                              onClick={e => { e.stopPropagation(); setSceneVideoPreview({ videoUrl: v.videoUrl, track: t }) }}>
                              {label}🎬
                            </span>
                          )
                          if (v.videoState === 'error') return <span key={t} className="text-red-400 text-xs" title={`${TRACK_LABELS[t]} 影片失敗`}>{label}🎬✗</span>
                          return null
                        })}
                      </div>
                    </div>
                    <span className="text-mist/40 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3">
                      {/* Narration — side by side */}
                      <div className="grid grid-cols-2 gap-3">
                        {(['zh', 'tai-lo'] as Track[]).map(t => (
                          <div key={t}>
                            <label className="text-xs text-mist block mb-1">{TRACK_LABELS[t]}</label>
                            <textarea value={scene.tracks?.[t]?.narration_text ?? (t === 'zh' ? (scene.narration_text ?? '') : '')}
                              ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }}}
                              onChange={e => { updateScene(chapter.chapter_index, sIdx, 'narration_text', e.target.value, t); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                              dir="auto"
                              className="w-full rounded bg-[#1e293b] border border-white/10 text-paper text-sm px-3 py-2 focus:outline-none focus:border-gold resize-none overflow-hidden" />
                            {t === 'tai-lo' && (
                              <button onClick={() => handleSceneRetranslate(chapter.chapter_index, sIdx)}
                                className="mt-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/10 text-paper hover:bg-white/20 transition-colors">
                                🔄 台語翻譯
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Visual prompt */}
                      <div>
                        <label className="text-xs text-mist block mb-1">視覺提示 (English prompt)</label>
                        <div className="flex gap-2">
                          <textarea value={scene.visual_prompt}
                            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }}}
                            onChange={e => { updateScene(chapter.chapter_index, sIdx, 'visual_prompt', e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                            className="flex-1 rounded bg-[#1e293b] border border-white/10 text-paper text-sm px-3 py-2 focus:outline-none focus:border-gold resize-none overflow-hidden font-mono text-xs" />
                          <button onClick={() => handleSceneRegeneratePrompt(chapter.chapter_index, sIdx)}
                            className="shrink-0 self-start px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-paper hover:bg-white/20 transition-colors"
                            title="用 AI 重新生成視覺提示">
                            🔄
                          </button>
                        </div>
                      </div>

                      {/* Generation controls */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Audio — per track */}
                        {(['zh', 'tai-lo'] as Track[]).map(t => {
                          const ak = assetKey(chapter.chapter_index, sIdx, t)
                          const a = sceneAssets[ak] || { audioUrl: '', imageUrl: '', audioState: 'idle', imageState: 'idle' }
                          return (
                            <div key={t} className="flex items-center gap-1">
                              <button
                                onClick={() => handleSceneTts(chapter.chapter_index, sIdx, t)}
                                disabled={a.audioState === 'loading'}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40
                                  ${a.audioState === 'done' ? 'bg-green-900/30 text-green-300 border border-green-700/30' : 'bg-white/10 text-paper hover:bg-white/20'}`}>
                                {a.audioState === 'loading' ? '⏳' : a.audioUrl ? `🔊 ${TRACK_LABELS[t]} 重新` : `🔊 ${TRACK_LABELS[t]}`}
                              </button>
                              {a.audioUrl && (
                                <audio controls src={a.audioUrl} preload="none" className="h-8 w-28" />
                              )}
                            </div>
                          )
                        })}



                        {/* Reference image — shared across tracks */}
                        <div className="flex items-center gap-1">
                          {(['zh', 'tai-lo'] as Track[]).map(t => {
                            const ik = assetKey(chapter.chapter_index, sIdx, t)
                            const i = sceneAssets[ik] || { audioUrl: '', imageUrl: '', audioState: 'idle', imageState: 'idle' }
                            if (t !== 'zh') return null
                            return (
                              <div key={t} className="flex items-center gap-1">
                                <button
                                  onClick={() => handleSceneReferenceImage(chapter.chapter_index, sIdx)}
                                  disabled={i.imageState === 'loading'}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40
                                    ${i.imageState === 'done' ? 'bg-green-900/30 text-green-300 border border-green-700/30' : 'bg-white/10 text-paper hover:bg-white/20'}`}>
                                  {i.imageState === 'loading' ? '⏳' : i.imageUrl ? `🖼 重新參考` : `🖼 參考圖片`}
                                </button>
                                {i.imageUrl && (
                                  <button onClick={() => setSceneVideoPreview({ videoUrl: i.imageUrl, track: t })}
                                    className="w-7 h-7 rounded-full bg-white/10 text-paper border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors text-xs"
                                    title="預覽參考圖片">👁</button>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Video — per track */}
                        {(['zh', 'tai-lo'] as Track[]).map(t => {
                          const vk = assetKey(chapter.chapter_index, sIdx, t)
                          const v = sceneAssets[vk] || { audioUrl: '', imageUrl: '', videoUrl: '', audioState: 'idle', imageState: 'idle', videoState: 'idle', audioDuration: 0 }
                          const noRef = v.imageState !== 'done'
                          return (
                            <div key={t} className="flex items-center gap-1">
                              <button
                                onClick={() => noRef ? undefined : handleSceneVideo(chapter.chapter_index, sIdx, t)}
                                disabled={v.videoState === 'loading' || noRef}
                                title={noRef ? '請先產生參考圖片' : ''}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40
                                  ${noRef ? 'bg-gray-800/50 text-mist/50 cursor-not-allowed' : v.videoState === 'done' ? 'bg-green-900/30 text-green-300 border border-green-700/30' : 'bg-white/10 text-paper hover:bg-white/20'}`}>
                                {v.videoState === 'loading' ? '⏳' : v.videoUrl ? `🎬 ${TRACK_LABELS[t]} 重新` : `🎬 ${TRACK_LABELS[t]} 影片`}
                              </button>
                              {v.videoUrl && (
                                <button onClick={() => setSceneVideoPreview({ videoUrl: v.videoUrl, track: t })}
                                  className="w-7 h-7 rounded-full bg-green-900/40 text-green-300 border border-green-700/30 flex items-center justify-center hover:bg-green-800/40 transition-colors text-xs"
                                  title="預覽場景影片">▶</button>
                              )}
                            </div>
                          )
                        })}
                      </div>
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
      {srtEditorOpen && srtEditorChapter !== null && (() => {
        const sk = `${srtEditorChapter.chIdx}_${srtEditorChapter.track}`
        return chapterVideoUrls[sk] ? (
          <SrtVerifierModal
            videoUrl={chapterVideoUrls[sk]}
            entries={srtEntries}
            onClose={() => setSrtEditorOpen(false)}
          />
        ) : null
      })()}

      {/* Video viewer modal */}
      {videoViewerChapter !== null && (() => {
        const vk = `${videoViewerChapter.chIdx}_${videoViewerChapter.track}`
        return chapterVideoUrls[vk] ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setVideoViewerChapter(null)}>
            <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
              <button onClick={() => setVideoViewerChapter(null)}
                className="absolute -top-8 right-0 text-white/70 hover:text-white text-sm">
                關閉 ✕
              </button>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-mist">{TRACK_LABELS[videoViewerChapter.track]}</span>
                <video controls autoPlay className="w-full rounded-lg shadow-2xl"
                  src={chapterVideoUrls[vk]} />
              </div>
              {chapterSrtUrls[vk] && (
                <a href={chapterSrtUrls[vk]} download
                  className="inline-block px-3 py-1 text-xs text-white/70 hover:text-white bg-white/10 rounded transition-colors no-underline"
                  target="_blank" rel="noopener noreferrer">
                  下載字幕 (.srt)
                </a>
              )}
            </div>
          </div>
        ) : null
      })()}

      {/* Scene video preview modal */}
      {sceneVideoPreview !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSceneVideoPreview(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSceneVideoPreview(null)}
              className="absolute -top-8 right-0 text-white/70 hover:text-white text-sm">
              關閉 ✕
            </button>
            <div className="mb-2">
              <span className="text-xs text-mist">{TRACK_LABELS[sceneVideoPreview.track]} 場景影片</span>
            </div>
            <video controls autoPlay className="w-full rounded-lg shadow-2xl"
              src={sceneVideoPreview.videoUrl} />
          </div>
        </div>
      )}

      {/* Clean confirmation modal */}
      {cleanModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setCleanModal({ show: false, backingUp: true, removeMaterials: false })}>
          <div className="relative max-w-md w-full bg-[#1e293b] border border-white/10 rounded-xl p-6"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-paper mb-3">清除已生成的素材</h3>
            <p className="text-sm text-mist mb-4">
              這將會刪除所有已生成的語音、圖片和影片。建議先備份。
            </p>
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="backupCheck"
                  checked={cleanModal.backingUp}
                  onChange={e => setCleanModal(prev => ({ ...prev, backingUp: e.target.checked }))}
                  className="accent-gold" />
                <label htmlFor="backupCheck" className="text-xs text-mist">清除前先備份</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="removeMaterialsCheck"
                  checked={cleanModal.removeMaterials}
                  onChange={e => setCleanModal(prev => ({ ...prev, removeMaterials: e.target.checked }))}
                  className="accent-gold" />
                <label htmlFor="removeMaterialsCheck" className="text-xs text-mist">一併刪除分鏡腳本（video_materials.json），重新生成時需要再觸發</label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCleanModal({ show: false, backingUp: true, removeMaterials: false })}
                className="px-4 py-2 rounded-lg border border-white/20 text-paper text-xs hover:bg-white/10 transition-colors">
                取消
              </button>
              <button onClick={async () => {
                setMessage('清除中…')
                try {
                  const r = await adminCleanVideoAssets(id, {
                    backup: cleanModal.backingUp,
                    remove_materials: cleanModal.removeMaterials,
                  })
                  setMessage(r.backup_taken
                    ? `已清除（備份於 ${r.backup_prefix}）`
                    : `已清除 ${r.deleted?.audio || 0} 音檔、${r.deleted?.video || 0} 影片`
                  )
                } catch (e: unknown) {
                  setMessage(`清除失敗：${e instanceof Error ? e.message : 'unknown'}`)
                }
                setCleanModal({ show: false, backingUp: true, removeMaterials: false })
                // Refresh page state
                adminGetVideoMaterials(id).then(r => {
                  if (!r.materials) {
                    setNoStoryboard(true)
                    setMaterials(null)
                    setSceneAssets({})
                    setChapterVideoUrls({})
                    setChapterSrtUrls({})
                    setChapterVideoState({})
                  } else {
                    setMaterials(r.materials)
                    const parsed: SceneAssets = {}
                    for (const [k, v] of Object.entries(r.scene_assets || {})) {
                      const audioUrl = (v as any).audio_url || ''
                      const refUrl = (v as any).reference_image_url || ''
                      parsed[k] = {
                        audioUrl,
                        imageUrl: refUrl || (v as any).image_url || '',
                        videoUrl: (v as any).video_url || '',
                        audioState: audioUrl ? 'done' as AssetState : 'idle' as AssetState,
                        imageState: refUrl ? 'done' as AssetState : 'idle' as AssetState,
                        videoState: (v as any).video_url ? 'done' as AssetState : 'idle' as AssetState,
                        audioDuration: (v as any).audio_duration || 0,
                      }
                    }
                    setSceneAssets(parsed)
                    setChapterVideoUrls(r.chapter_videos || {})
                    setChapterSrtUrls(r.chapter_srts || {})
                    const states: Record<string, AssetState> = {}
                    for (const k of Object.keys(r.chapter_videos || {})) states[k] = 'done'
                    setChapterVideoState(states)
                  }
                })
              }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs hover:bg-red-500 transition-colors">
                確認清除
              </button>
            </div>
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
              <span className="shrink-0 w-5 text-mist/60 font-mono text-xs pt-1">{e.index}</span>
              <span className="shrink-0 w-24 text-mist/80 font-mono text-xs pt-1">
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
