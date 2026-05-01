import { getIdToken } from './firebase'

const BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  noAuth = false,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (!noAuth) {
    const token = await getIdToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  return res.json()
}

// ── Orders ────────────────────────────────────────────────────────────────────
export const createOrder = (data: {
  track_type: string; source_lang: string; target_lang: string
  word_count: number; title?: string; notes?: string
}) => request<{ order_id: string; payment_url: string; status: string; price_ntd: number; created_at: string }>(
  'POST', '/orders', data
)

export const getOrder = (id: string) =>
  request<Order>('GET', `/orders/${id}`)

export const listOrders = (params?: { status?: string; track_type?: string }) => {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return request<{ orders: Order[]; total: number }>('GET', `/orders${qs ? '?' + qs : ''}`)
}

export const cancelOrder = (id: string) =>
  request<{ message: string }>('DELETE', `/orders/${id}`)

// ── Files ─────────────────────────────────────────────────────────────────────
export const getUploadUrl = (data: { order_id: string; filename: string; content_type: string }) =>
  request<{ signed_url: string; gcs_path: string }>('POST', '/files/upload-url', data)

export const confirmUpload = (order_id: string, gcs_path: string) =>
  request<{ message: string }>('POST', `/files/${order_id}/confirm?gcs_path=${encodeURIComponent(gcs_path)}`)

export const getDownloadUrl = (order_id: string) =>
  request<{ signed_url: string }>('GET', `/files/${order_id}/download-url`)

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

export const adminListOrders = (params?: { status?: string; track_type?: string }) => {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return request<{ orders: Order[]; total: number }>('GET', `/admin/orders${qs ? '?' + qs : ''}`)
}

export const adminListQaFlags = (params?: { flag_level?: string; resolved?: boolean }) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k, String(v)]))
  ).toString()
  return request<QAFlag[]>('GET', `/admin/qa-flags${qs ? '?' + qs : ''}`)
}

export const resolveQaFlag = (id: string, reviewer_note: string) =>
  request<{ message: string }>('PATCH', `/admin/qa-flags/${id}`, { reviewer_note })

export const confirmPayment = (order_id: string, amount: number, note?: string) =>
  request<{ message: string }>('POST', `/admin/payments/${order_id}/confirm`, {
    confirmed_amount_ntd: amount, note
  })

export const markDelivered = (order_id: string, gcs_output_path: string) =>
  request<{ message: string }>('POST', `/admin/orders/${order_id}/deliver?gcs_output_path=${encodeURIComponent(gcs_output_path)}`)

export const adminListUsers = () =>
  request<UserAccount[]>('GET', '/admin/users')

export const adminUpdateUser = (id: string, data: { disabled?: boolean; is_admin?: boolean }) =>
  request<{ message: string }>('PATCH', `/admin/users/${id}`, data)

export const adminGetSegments = (id: string) =>
  request<{ segments: QASegment[] }>('GET', `/admin/orders/${id}/segments`)

export const adminUpdateSegments = (id: string, segments: QASegmentUpdate[]) =>
  request<{ message: string }>('PATCH', `/admin/orders/${id}/segments`, { segments })

export const adminMarkQaDone = (id: string) =>
  request<{ message: string }>('POST', `/admin/orders/${id}/qa-done`)

export const adminUpdateOrderStatus = (id: string, status: string) =>
  request<{ message: string }>('PATCH', `/admin/orders/${id}/status?status=${status}`)

export const listAssignments = (status?: string) => {
  const qs = status ? `?status=${status}` : ''
  return request<Assignment[]>('GET', `/admin/assignments${qs}`)
}

export const updateAssignment = (order_id: string, data: { editor_id?: string; proofreader_id?: string }) =>
  request<Assignment>('PATCH', `/admin/assignments/${order_id}`, data)

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Order {
  id: string
  track_type: string
  status: string
  source_lang: string
  target_lang: string
  word_count: number
  price_ntd: number
  title?: string
  notes?: string
  created_at: string
  deadline_at?: string
  delivered_at?: string
  payment_status?: string
  invoice_no?: string
  gcs_output_path?: string
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
  admin_role?: string
}

export interface Assignment {
  id: string
  order_id: string
  editor_id?: string
  proofreader_id?: string
  status: string
  assigned_at: string
  editor_submitted_at?: string
  proofread_submitted_at?: string
}

export interface QASegment {
  index:          number
  source:         string
  translated:     string
  raw?:           string
  comments?:      string
  flags:          QAFlag[]
}

export interface QASegmentUpdate {
  index:      number
  translated: string
  comments?:  string
}
