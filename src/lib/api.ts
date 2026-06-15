import { getIdToken } from './firebase'

const BASE = process.env.NEXT_PUBLIC_API_URL || ''

// ── Global API loading state (for "Waiting for response…" indicator) ──────
type LoadingListener = (loading: boolean) => void
const listeners = new Set<LoadingListener>()

export function onApiLoading(listener: LoadingListener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function notifyLoading(loading: boolean) {
  listeners.forEach(fn => fn(loading))
}

let pending = 0
function wrapLoading<T>(fn: () => Promise<T>): Promise<T> {
  if (pending === 0) notifyLoading(true)
  pending++
  return fn().finally(() => {
    pending--
    if (pending === 0) notifyLoading(false)
  })
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean | undefined> | boolean,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const noAuth = typeof params === 'boolean' ? params : false
  const queryParams = typeof params === 'object' && params !== null && !Array.isArray(params) ? params : undefined

  if (!noAuth) {
    const token = await getIdToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  let url = `${BASE}${path}`
  if (queryParams) {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(queryParams)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    ).toString()
    if (qs) url += `?${qs}`
  }

  return wrapLoading(async () => {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new ApiError(err.detail || `HTTP ${res.status}`, res.status)
    }

    return res.json()
  })
}

// ── Orders ────────────────────────────────────────────────────────────────────
export const createOrder = (data: {
  track_type: string; source_lang: string; target_lang: string
  word_count: number; title?: string; notes?: string; sample_package?: boolean
}) => request<{ order_id: string; payment_url: string; status: string; price_ntd: number; has_sample_package: boolean; created_at: string }>(
  'POST', '/orders', data
)

export const getOrder = (id: string) =>
  request<Order>('GET', `/orders/${id}`)

export const listOrders = (params?: { status?: string; track_type?: string; limit?: number; offset?: number }) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k, String(v)]))
  ).toString()
  return request<{ orders: Order[]; total: number }>('GET', `/orders${qs ? '?' + qs : ''}`)
}

export const cancelOrder = (id: string) =>
  request<{ message: string }>('DELETE', `/orders/${id}`)

export const updateOrder = (id: string, data: { title?: string }) =>
  request<Order>('PATCH', `/orders/${id}`, data)

export const adminCancelOrder = (id: string) =>
  request<{ message: string }>('DELETE', `/admin/orders/${id}`)

// ── Files ─────────────────────────────────────────────────────────────────────
export const getUploadUrl = (data: { order_id: string; filename: string; content_type: string; file_size: number }) =>
  request<{ signed_url: string; gcs_path: string }>('POST', '/files/upload-url', data)

export const confirmUpload = (order_id: string, gcs_path: string) =>
  request<{ message: string }>('POST', `/files/${order_id}/confirm?gcs_path=${encodeURIComponent(gcs_path)}`)

export const getDownloadUrl = (order_id: string) =>
  request<{ signed_url: string }>('GET', `/files/${order_id}/download-url`)

export const getBilingualDownloadUrl = (order_id: string) =>
  request<{ signed_url: string }>('GET', `/files/${order_id}/bilingual-download-url`)

export const getPlainTextDownloadUrl = (order_id: string) =>
  request<{ signed_url: string }>('GET', `/files/${order_id}/plain-text-download-url`)

// ── Support Files (Literary Track) ────────────────────────────────────────────
export const getSupportUploadUrl = (order_id: string, filename: string, content_type: string = 'text/plain') =>
  request<{ signed_url: string; gcs_path: string }>('POST', `/files/${order_id}/support-upload-url`, undefined,
    { filename, content_type })

export const confirmSupportUpload = (order_id: string, data: {
  filename: string; content_type: string; file_size: number; gcs_path: string; file_role: string
}) =>
  request<SupportFile>('POST', `/files/${order_id}/support-confirm`, undefined, data)

export const listSupportFiles = (order_id: string) =>
  request<{ files: SupportFile[]; total: number }>('GET', `/files/${order_id}/support-files`)

export async function uploadFile(
  signedUrl: string,
  file: File,
  onProgress?: (pct: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'text/plain')
    if (onProgress) {
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100))
      }
    }
    xhr.onload  = () => xhr.status === 200 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
    xhr.onerror = () => reject(new Error('Upload network error'))
    xhr.send(file)
  })
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminGetOrder = (id: string) =>
  request<Order & { qa_result?: QAResult }>('GET', `/admin/orders/${id}`)

export const adminGetDownloadUrl = (id: string) =>
  request<{ signed_url: string }>('GET', `/admin/orders/${id}/download-url`)

export const adminGetBilingualDownloadUrl = (id: string) =>
  request<{ signed_url: string }>('GET', `/admin/orders/${id}/bilingual-download-url`)

export const adminGetPlainTextDownloadUrl = (id: string) =>
  request<{ signed_url: string }>('GET', `/admin/orders/${id}/plain-text-download-url`)

export const adminGetPipelineProgress = (id: string) =>
  request<PipelineProgress>('GET', `/admin/orders/${id}/pipeline-progress`)

export const adminGetTokenUsage = (orderId: string) =>
  request<TokenUsageResponse>('GET', `/admin/orders/${orderId}/token-usage`)

// ── Video Materials (Gutenberg Track) ─────────────────────────────────────────
export const adminGetVideoMaterials = (orderId: string) =>
  request<{
    materials: VideoMaterials | null
    message?: string
    scene_assets?: Record<string, { audio_url: string | null; image_url: string | null }>
    chapter_videos?: Record<string, string>
    chapter_srts?: Record<string, string>
  }>(
    'GET', `/admin/orders/${orderId}/video-materials`
  )

export const adminSaveVideoMaterials = (orderId: string, materials: VideoMaterials) =>
  request<{ message: string }>(
    'PUT', `/admin/orders/${orderId}/video-materials`, { materials }
  )

export const adminApproveVideoMaterials = (
  orderId: string,
  materials: VideoMaterials,
  voice_id?: string,
  speaking_rate?: number,
) =>
  request<{ message: string; order_id: string }>(
    'POST', `/admin/orders/${orderId}/video-materials/approve`,
    { materials, voice_id, speaking_rate }
  )

export const adminSceneTts = (
  orderId: string,
  chapter_index: number,
  scene_index: number,
  text: string,
  voice_id?: string,
  speaking_rate?: number,
  language?: string,
) =>
  request<{ audio_data_url: string; gcs_path: string }>(
    'POST', `/admin/orders/${orderId}/video-materials/scene/tts`,
    { chapter_index, scene_index, text, voice_id, speaking_rate, language }
  )

export const adminSceneImage = (
  orderId: string,
  chapter_index: number,
  scene_index: number,
  prompt: string,
) =>
  request<{ image_data_url: string; gcs_path: string }>(
    'POST', `/admin/orders/${orderId}/video-materials/scene/image`,
    { chapter_index, scene_index, prompt }
  )

export const adminChapterAssemble = (
  orderId: string,
  chapter_index: number,
  language: string = 'zh',
) =>
  request<{ video_url: string; srt_url: string | null; gcs_path: string }>(
    'POST', `/admin/orders/${orderId}/video-materials/chapter/assemble`,
    { chapter_index, language }
  )

export const adminSaveChapterSrt = (
  orderId: string,
  chapter_index: number,
  srt_content: string,
) =>
  request<{ srt_url: string }>(
    'PUT', `/admin/orders/${orderId}/video-materials/chapter/srt`,
    { chapter_index, srt_content }
  )

export const adminGenerateStoryboard = (orderId: string) =>
  request<{ message: string; order_id: string }>(
    'POST', `/admin/orders/${orderId}/video-materials/generate-storyboard`
  )

export const adminCleanVideoAssets = (
  orderId: string,
  options?: { backup?: boolean; language?: string; remove_materials?: boolean }
) =>
  request<{ message: string; backup_taken: boolean; remove_materials: boolean; backup_prefix: string | null; deleted: Record<string, number> }>(
    'POST', `/admin/orders/${orderId}/video-materials/clean`,
    { backup: options?.backup ?? true, language: options?.language ?? '', remove_materials: options?.remove_materials ?? false }
  )

export const adminGetTokenUsageDetail = (orderId: string, params?: { limit?: number; offset?: number }) =>
  request<TokenUsageDetailResponse>('GET', `/admin/orders/${orderId}/token-usage-detail`, undefined, params)

export const adminGetOriginalContent = (id: string) =>
  request<{ filename: string; content_type: string; html: string }>('GET', `/admin/orders/${id}/original-content`)

export const adminListSupportFiles = (id: string) =>
  request<{ files: SupportFile[]; total: number }>('GET', `/admin/orders/${id}/support-files`)

export const adminGetSupportFileContent = (orderId: string, fileId: string) =>
  request<{ filename: string; content_type: string; html: string }>('GET', `/admin/orders/${orderId}/support-files/${fileId}/content`)

export const editorGetOriginalContent = (id: string) =>
  request<{ filename: string; content_type: string; html: string }>('GET', `/editor/orders/${id}/original-content`)

export const ltGetOriginalContent = (id: string) =>
  request<{ filename: string; content_type: string; html: string }>('GET', `/editor/lt/orders/${id}/original-content`)

export const ltListSupportFiles = (id: string) =>
  request<{ files: SupportFile[]; total: number }>('GET', `/editor/lt/orders/${id}/support-files`)

export const ltGetSupportFileContent = (orderId: string, fileId: string) =>
  request<{ filename: string; content_type: string; html: string }>('GET', `/editor/lt/orders/${orderId}/support-files/${fileId}/content`)

export const adminListOrders = (params?: { status?: string; track_type?: string; limit?: number; offset?: number }) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k, String(v)]))
  ).toString()
  return request<{ orders: Order[]; total: number }>('GET', `/admin/orders${qs ? '?' + qs : ''}`)
}

export const adminListQaFlags = (params?: { flag_level?: string; resolved?: boolean; order_id?: string; limit?: number; offset?: number }) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k, String(v)]))
  ).toString()
  return request<{ flags: QAFlag[]; total: number }>('GET', `/admin/qa-flags${qs ? '?' + qs : ''}`)
}

export const resolveQaFlag = (id: string, reviewer_note: string) =>
  request<{ message: string }>('PATCH', `/admin/qa-flags/${id}`, { reviewer_note })

export const confirmPayment = (order_id: string, amount: number, note?: string) =>
  request<{ message: string }>('POST', `/admin/payments/${order_id}/confirm`, {
    confirmed_amount_ntd: amount, note
  })

export const markDelivered = (order_id: string, gcs_output_path: string) =>
  request<{ message: string }>('POST', `/admin/orders/${order_id}/deliver?gcs_output_path=${encodeURIComponent(gcs_output_path)}`)

export const adminListUsers = (params?: { limit?: number; offset?: number }) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k, String(v)]))
  ).toString()
  return request<{ users: UserAccount[]; total: number }>('GET', `/admin/users${qs ? '?' + qs : ''}`)
}

export const adminUpdateUser = (id: string, data: { disabled?: boolean; is_admin?: boolean; is_editor?: boolean }) =>
  request<{ message: string }>('PATCH', `/admin/users/${id}`, data)

// ── User Profile ─────────────────────────────────────────────────────────────
export const updateMyProfile = (data: {
  bio?: string; client_type?: string; company_name?: string; tax_id?: string; invoice_carrier?: string
}) =>
  request<UserProfile>('PATCH', '/users/me', data)

// ── Sample Translation Package ──────────────────────────────────────────────
export const getSamplePackage = (orderId: string) =>
  request<SamplePackage>('GET', `/editor/lt/orders/${orderId}/sample-package`)

export const updateSamplePackage = (orderId: string, data: SamplePackageUpdate) =>
  request<MessageResponse>('PATCH', `/editor/lt/orders/${orderId}/sample-package`, data)

export const generateSamplePackage = (orderId: string) =>
  request<{ message: string; translator_bio: string; book_fact_sheet: BookFactSheet; synopsis: string; market_analysis: string }>(
    'POST', `/orders/${orderId}/sample-package/generate`
  )

export const editorGenerateSamplePackage = (orderId: string) =>
  request<{ message: string; translator_bio: string; book_fact_sheet: BookFactSheet; synopsis: string; market_analysis: string }>(
    'POST', `/editor/lt/orders/${orderId}/sample-package/generate`
  )

export const downloadSamplePackage = (orderId: string) =>
  request<{ download_url: string; message: string }>('GET', `/orders/${orderId}/sample-package/download`)

export const adminGetSegments = (id: string, params?: { limit?: number; offset?: number; q?: string; search_all?: boolean }) =>
  request<{ segments: QASegment[]; total: number }>('GET', `/admin/orders/${id}/segments`, undefined, params)

export const adminUpdateSegments = (id: string, segments: QASegmentUpdate[]) =>
  request<{ message: string }>('PATCH', `/admin/orders/${id}/segments`, { segments })

export const adminMarkQaDone = (id: string) =>
  request<{ message: string }>('POST', `/admin/orders/${id}/qa-done`)

export const adminUpdateOrderStatus = (id: string, status: string) =>
  request<{ message: string }>('PATCH', `/admin/orders/${id}/status?status=${status}`)

export const adminRetranslate = (id: string) =>
  request<{ message: string }>('POST', `/admin/orders/${id}/retranslate`)

export const adminRedeliver = (id: string) =>
  request<{ message: string }>('POST', `/admin/orders/${id}/redeliver`)

export const adminRerunStage = (id: string, stage: string) =>
  request<{ message: string }>('POST', `/admin/orders/${id}/rerun-stage`, { stage })

export const adminAssignEditor = (order_id: string, data: { editor_id: string | null; qa_id: string | null }) =>
  request<MessageResponse>('PATCH', `/admin/orders/${order_id}/assign-editor`, data)

export const adminUpdateUserLanguages = (user_id: string, languages: { source_lang: string; target_lang: string }[]) =>
  request<MessageResponse>('PUT', `/admin/users/${user_id}/languages`, { languages })

export const adminListEligibleUsers = (order_id: string) =>
  request<{ users: UserAccount[]; total: number }>('GET', `/admin/orders/${order_id}/eligible-users`)


// ── Editor ────────────────────────────────────────────────────────────────────
export const editorListOrders = (params?: { limit?: number; offset?: number }) =>
  request<{ orders: Order[]; total: number }>('GET', '/editor/orders', undefined, params)

export const editorListTeam = () =>
  request<{ users: UserAccount[]; total: number }>('GET', '/editor/team')

export const editorGetOrder = (id: string) =>
  request<Order>('GET', `/editor/orders/${id}`)

export const editorGetSegments = (id: string, params?: { limit?: number; offset?: number; q?: string; search_all?: boolean }) =>
  request<{ segments: QASegment[]; total: number }>('GET', `/editor/orders/${id}/segments`, undefined, params)

export const editorUpdateSegments = (id: string, segments: QASegmentUpdate[]) =>
  request<{ message: string }>('PATCH', `/editor/orders/${id}/segments`, { segments })

export const editorSubmit = (id: string) =>
  request<{ message: string }>('POST', `/editor/orders/${id}/submit`)

export const editorReturn = (id: string) =>
  request<{ message: string }>('POST', `/editor/orders/${id}/return`)

export const editorAssignQa = (order_id: string, qa_id: string | null) =>
  request<{ message: string }>('PATCH', `/editor/orders/${order_id}/assign-qa`, { qa_id })

// ── Literary Track: Editor/Proofreader Portal ───────────────────────────────
export const ltListAssignments = (params?: { limit?: number; offset?: number }) =>
  request<{ assignments: Assignment[]; total: number }>('GET', '/editor/lt/assignments', undefined, params)

export const ltGetOrder = (id: string, role: 'editor' | 'proofreader') =>
  request<Order>('GET', `/editor/lt/orders/${id}`, undefined, { role })

export interface QASegmentListResponse {
  segments: QASegment[]
  total: number
  total_must_fix: number
  must_fix_indices: number[]
  all_flags: QAFlag[]
}

export const ltGetSegments = (id: string, role: 'editor' | 'proofreader', params?: { limit?: number; offset?: number; q?: string; search_all?: boolean }) =>
  request<QASegmentListResponse>('GET', `/editor/lt/orders/${id}/segments`, undefined, { ...params, role })

export const ltUpdateSegments = (id: string, role: 'editor' | 'proofreader', segments: QASegmentUpdate[]) =>
  request<{ message: string }>('PATCH', `/editor/lt/orders/${id}/segments`, { segments }, { role })

export const ltCompleteAssignment = (id: string, role: 'editor' | 'proofreader') =>
  request<{ message: string }>('POST', `/editor/lt/orders/${id}/complete`, undefined, { role })

export const ltRejectAssignment = (id: string, role: 'editor' | 'proofreader', notes: string) =>
  request<{ message: string }>('POST', `/editor/lt/orders/${id}/reject`, { notes }, { role })

export const listAssignments = (params?: { status?: string; limit?: number; offset?: number }) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k, String(v)]))
  ).toString()
  return request<{ assignments: Assignment[]; total: number }>('GET', `/admin/assignments${qs ? '?' + qs : ''}`)
}

export const updateAssignment = (order_id: string, data: { editor_id?: string; proofreader_id?: string }) =>
  request<Assignment>('PATCH', `/admin/assignments/${order_id}`, data)

export const adminAssignLiteraryRole = (order_id: string, role: 'editor' | 'proofreader', user_id: string) =>
  request<Assignment>('POST', `/admin/assignments/${order_id}`, { role, user_id })

export const adminCompleteLiteraryRole = (order_id: string, role: 'editor' | 'proofreader') =>
  request<Assignment>('POST', `/admin/assignments/${order_id}/complete`, { role })

// ── Literary Track Quotation ─────────────────────────────────────────────────
export const adminUpdateQuote = (order_id: string, data: { quoted_price: number; admin_notes?: string }) =>
  request<{ message: string }>('POST', `/admin/orders/${order_id}/quote`, data)


// ── Gutenberg Track ──────────────────────────────────────────────────────────
export interface GutenbergBookInfo {
  book_id: number
  title: string
  authors: string[]
  language: string
  word_count: number
  num_chapters: number
  num_chunks: number
}

export const adminFetchGutenbergBook = (book_id: number) =>
  request<GutenbergBookInfo>('GET', `/admin/gutenberg/${book_id}`)

export const adminStartGutenbergTranslation = (book_id: number) =>
  request<{ order_id: string; message: string }>('POST', `/admin/gutenberg/${book_id}`)

export type GutenbergVersion = 'standard' | 'youth' | 'tailo' | 'sxc' | 'simplified_tailo' | 'simplified_reader' | 'full_vs_simplified'

export const adminGetGutenbergDownloadUrl = (order_id: string, version: GutenbergVersion) =>
  request<{ signed_url: string }>('GET', `/admin/gutenberg/${order_id}/download-url?version=${version}`)

export interface GutenbergChapterItem {
  index: number
  title: string
  segment_start: number
  segment_end: number
  segment_count: number
  char_count: number
}

export interface GutenbergChapterSegment {
  index: number
  chapter_index: number
  chapter_title: string
  source: string
  translated: string
  simplified: string
  tailo: string
}

export interface GutenbergChaptersResponse {
  chapters: GutenbergChapterItem[]
  source_filename: string | null
  total_segments: number
  selected_chapter: GutenbergChapterItem | null
  segments: GutenbergChapterSegment[]
  version: string | null
}

export const adminGetGutenbergChapters = (
  order_id: string,
  chapter: number | null,
  version: 'all' | GutenbergVersion = 'all',
) => {
  const params = new URLSearchParams()
  if (chapter !== null) params.set('chapter', String(chapter))
  if (version !== 'all') params.set('version', version)
  const qs = params.toString()
  return request<GutenbergChaptersResponse>(
    'GET',
    `/admin/gutenberg/${order_id}/chapters${qs ? `?${qs}` : ''}`,
  )
}


// ── Language Configs ─────────────────────────────────────────────────────────
export const getLanguages = () =>
  request<{ languages: LanguageConfig[] }>('GET', '/languages', undefined, true)

export const adminListSupportedLanguages = () =>
  request<SupportedLanguage[]>('GET', '/languages/supported')

export const adminListLanguages = () =>
  request<{ languages: LanguageConfig[] }>('GET', '/admin/languages')

export const adminCreateLanguage = (data: { code: string; direction: string; sort_order?: number; price_multiplier?: number }) =>
  request<LanguageConfig>('POST', '/admin/languages', data)

export const adminUpdateLanguage = (id: number, data: Partial<LanguageConfig>) =>
  request<LanguageConfig>('PATCH', `/admin/languages/${id}`, data)

export const adminDeleteLanguage = (id: number) =>
  request<{ message: string }>('DELETE', `/admin/languages/${id}`)



// ── Users ─────────────────────────────────────────────────────────────────────
export const getMe = () =>
  request<UserProfile>('GET', '/users/me')

export const createInvitation = (data: { email: string; role: 'editor' | 'qa' }) =>
  request<{ id: string; token: string }>('POST', '/users/invite', data)

export const acceptInvitation = (token: string) =>
  request<{ message: string }>('POST', '/users/accept-invite', { token })

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MessageResponse {
  message: string
}

export interface Order {
  id: string
  track_type: string
  status: string
  source_lang: string
  target_lang: string
  word_count: number
  price_ntd: number
  quoted_price?: number
  reference_price?: number
  quoted_at?: string
  title?: string
  notes?: string
  has_sample_package?: boolean
  created_at: string
  deadline_at?: string
  delivered_at?: string
  payment_status?: string
  invoice_no?: string
  gcs_output_path?: string
  gcs_bilingual_output_path?: string
  gcs_plain_text_output_path?: string
  gcs_upload_path?: string
  editor_id?: string
  qa_id?: string
  proofreader_id?: string
  assignment_status?: string
  proofreader_notes?: string
}

export interface UserProfile {
  id:              string
  uid_firebase:    string
  client_type:     string
  company_name?:   string
  tax_id?:         string
  invoice_carrier?: string
  is_admin:        boolean
  is_editor:       boolean
  is_qa:           boolean
  roles:           string[]
  bio:             string
  created_at:      string
}

export interface QAResult {
  layer1_structure?:  { pass: boolean; flags: number; pass_count: number; overall_ratio: number }
  layer2_semantic?:   { pass: boolean; flags: number; avg_score: number; sampled: number }
  layer3_terminology?:{ pass: boolean; flags: number; terms_checked: number }
  layer4_llm_judge?:  { pass: boolean; score: number; flags: number; evaluated: number }
}

export interface QAFlag {
  id: string
  job_id: string
  order_id: string
  paragraph_index: number
  flag_level: string
  flag_type: string
  source_segment?: string
  translated_segment?: string
  reviewer_note?: string
  resolved: boolean
  flagged_at: string
}

export interface UserAccount {
  id: string
  uid_firebase: string
  email?: string
  client_type: string
  disabled: boolean
  created_at: string
  is_admin: boolean
  is_editor: boolean
  is_qa: boolean
  languages: { source_lang: string; target_lang: string }[]
  admin_role?: string
}

export interface Assignment {
  id: string
  order_id: string
  editor_id?: string
  qa_id?: string
  proofreader_id?: string
  status: string
  assigned_at: string
  editor_submitted_at?: string
  proofread_submitted_at?: string
  qa_submitted_at?: string
  editor_notes?: string
  proofreader_notes?: string
}

export interface SupportFile {
  id: string
  order_id: string
  filename: string
  content_type: string
  file_size: number
  gcs_path: string
  file_role: string
  created_at: string
}

export interface QASegment {
  index:          number
  source:         string
  translated:     string
  raw?:           string
  comments?:      string
  editor_comments?: string
  proofreader_comments?: string
  flags:          QAFlag[]
}

export interface QASegmentUpdate {
  index:      number
  translated: string
  comments?:  string
  editor_comments?: string
  proofreader_comments?: string
}

export interface SamplePackage {
  id:              string
  order_id:        string
  status:          string
  translator_bio:  string
  book_fact_sheet: BookFactSheet
  synopsis:        string
  market_analysis: string
  notes?:          string
  updated_at?:     string
  updated_by?:     string
}

export interface BookFactSheet {
  title_original?:      string
  title_target?:        string
  author_original?:     string
  author_target?:       string
  publisher_original?:  string
  publisher_target?:    string
  pub_date_original?:   string
  pub_date_target?:     string
  word_count?:          string
  category_original?:   string
  category_target?:     string
  sales_original?:      string
  sales_target?:        string
}

export interface SamplePackageUpdate {
  translator_bio?:  string
  book_fact_sheet?: BookFactSheet
  synopsis?:        string
  market_analysis?: string
  notes?:           string
}

export interface LanguageConfig {
  id:               number
  code:             string
  label_zh:         string
  label_en:         string
  direction:        string
  is_active:        boolean
  sort_order:       number
  price_multiplier: number
  created_at:       string
}

export interface SupportedLanguage {
  code:             string
  label_zh:         string
  label_en:         string
  default_direction: string
}

export interface TokenUsageItem {
  job_type:          string
  model:             string
  prompt_tokens:     number
  candidates_tokens: number
  total_tokens:      number
  input_rate:        number
  output_rate:       number
  cost_usd:          number
}

export interface TokenUsageResponse {
  order_id:          string
  total_prompt:      number
  total_candidates:  number
  total_tokens:      number
  total_cost_usd:    number
  breakdown:         TokenUsageItem[]
}

export interface TokenUsageDetailItem {
  job_type:          string
  model:             string
  prompt_tokens:     number
  candidates_tokens: number
  total_tokens:      number
  input_rate:        number
  output_rate:       number
  cost_usd:          number
  created_at:        string
}

export interface TokenUsageDetailResponse {
  order_id:          string
  items:             TokenUsageDetailItem[]
  total:             number
}

export interface PipelineProgress {
  status:             'no_batches' | 'in_progress' | 'complete'
  total_batches:      number
  completed_batches:  number
  total_segments:     number
  completed_segments: number
}

// ── Video Materials (Gutenberg Track) ─────────────────────────────────────────
export interface VideoSceneTrack {
  narration_text: string
}

export interface VideoScene {
  scene_index:    number
  narration_text?: string       // legacy flat field (pre-dual-track files)
  visual_prompt:  string
  duration_est:   string
  tracks?: {
    zh:     VideoSceneTrack
    "tai-lo": VideoSceneTrack
  }
}

export interface VideoChapter {
  chapter_index: number
  title:         string
  scenes:        VideoScene[]
}

export interface VideoGlobalStyle {
  characters:   Record<string, string>
  environment:  string
}

export interface VideoMaterials {
  global_style: VideoGlobalStyle
  chapters:     VideoChapter[]
  settings:     {
    voice_id:      string
    speaking_rate: number
  }
}

// ── Translation Versions ────────────────────────────────────────────────────
export interface TranslationVersion {
  id:                string
  version:           number
  label:             string | null
  source:            string
  created_at:        string
  segment_count:     number | null
  gcs_path:          string
  created_by_email:  string | null
}

export interface DiffSegment {
  index:             number
  source:            string
  old?:              string
  new?:              string
  text?:             string
}

export interface VersionDiff {
  changed:           DiffSegment[]
  added:             DiffSegment[]
  removed:           DiffSegment[]
}

export const adminListVersions = (orderId: string) =>
  request<TranslationVersion[]>('GET', `/admin/orders/${orderId}/versions`)

export const adminSaveVersion = (orderId: string, label?: string) =>
  request<TranslationVersion>('POST', `/admin/orders/${orderId}/versions?label=${label ? encodeURIComponent(label) : ''}`)

export const adminRestoreVersion = (orderId: string, versionId: string) =>
  request<TranslationVersion>('POST', `/admin/orders/${orderId}/versions/${versionId}/restore`)

export const adminDiffVersions = (orderId: string, versionId: string, against?: string) => {
  const qs = against ? `?against=${against}` : ''
  return request<VersionDiff>('GET', `/admin/orders/${orderId}/versions/${versionId}/diff${qs}`)
}

export const ltListVersions = (orderId: string) =>
  request<TranslationVersion[]>('GET', `/editor/lt/orders/${orderId}/versions`)

export const ltDiffVersions = (orderId: string, versionId: string, against?: string) => {
  const qs = against ? `?against=${against}` : ''
  return request<VersionDiff>('GET', `/editor/lt/orders/${orderId}/versions/${versionId}/diff${qs}`)
}

export const adminDiffLive = (orderId: string) =>
  request<VersionDiff>('GET', `/admin/orders/${orderId}/versions/live/diff`)

