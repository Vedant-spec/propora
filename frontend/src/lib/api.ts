const TOKEN_KEY = 'propora.token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export type FieldErrors = Record<string, string>

export class ApiError extends Error {
  status: number
  /** Per-field messages from a 422, keyed by form field name. */
  errors: FieldErrors

  constructor(message: string, status: number, errors: FieldErrors = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

/** Narrow an unknown catch value into something a form can render. */
export function readError(err: unknown): { message: string; errors: FieldErrors } {
  if (err instanceof ApiError) return { message: err.message, errors: err.errors }
  if (err instanceof Error) return { message: err.message, errors: {} }
  return { message: 'Something went wrong', errors: {} }
}

type Params = Record<string, string | number | boolean | undefined | null>

type Options = {
  method?: string
  body?: unknown
  params?: Params
  /** Skip the automatic bounce to /session-expired (used by the login screen). */
  silent401?: boolean
}

function buildUrl(path: string, params?: Params) {
  const url = `/api${path}`
  if (!params) return url
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.append(key, String(value))
  })
  const qs = search.toString()
  return qs ? `${url}?${qs}` : url
}

export async function api<T = any>(path: string, options: Options = {}): Promise<T> {
  const token = tokenStore.get()
  const response = await fetch(buildUrl(path, options.params), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const payload = await response.json().catch(() => ({}))

  if (response.status === 401 && !options.silent401) {
    tokenStore.clear()
    // Show the dedicated screen rather than dumping the user on a blank login.
    if (!location.pathname.startsWith('/login') && !location.pathname.startsWith('/session-expired')) {
      location.assign('/session-expired')
    }
    throw new ApiError(payload?.message ?? 'Your session has expired.', 401)
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? `Request failed (${response.status})`,
      response.status,
      payload?.errors ?? {},
    )
  }

  return payload as T
}

/** Upload multipart form data (tenant ID documents). */
export async function upload<T = any>(path: string, formData: FormData): Promise<T> {
  const token = tokenStore.get()
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? 'Upload failed',
      response.status,
      payload?.errors ?? {},
    )
  }
  return payload as T
}

/** Fetch a file export with the auth header attached and hand it to the browser. */
export async function download(path: string, params: Params, filename: string) {
  const token = tokenStore.get()
  const response = await fetch(buildUrl(path, params), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new ApiError('Could not generate the export', response.status)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
