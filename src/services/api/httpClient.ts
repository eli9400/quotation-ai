import { firebaseAuth } from '../../config/firebaseClient'

type RequestOptions = {
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH'
  body?: BodyInit | null
  headers?: HeadersInit
}

const TOKEN_ERROR_PATTERN = /invalid or expired firebase id token/i

function normalizeApiMessage(message: string): string {
  if (TOKEN_ERROR_PATTERN.test(message)) {
    return 'פג תוקף ההתחברות. המערכת רעננה את האימות. אם הבעיה חוזרת, התחברו מחדש.'
  }
  return message
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown }
    if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
      return normalizeApiMessage(payload.message)
    }
  } catch {
    // ignore parse failures and use generic message
  }
  return `Request failed with status ${response.status}`
}

async function refreshFirebaseIdToken(): Promise<string | null> {
  try {
    const user = firebaseAuth.currentUser
    if (!user) return null
    return await user.getIdToken(true)
  } catch {
    return null
  }
}

function shouldRetryWithFreshToken(status: number, errorMessage: string, headers: Headers): boolean {
  if (status !== 401 && status !== 403) return false
  if (!headers.has('Authorization')) return false
  return TOKEN_ERROR_PATTERN.test(errorMessage)
}

async function executeRequest(url: string, options: RequestOptions, headers: Headers): Promise<Response> {
  return fetch(url, {
    method: options.method,
    body: options.body ?? null,
    headers,
  })
}

export async function requestJson<T>(url: string, options: RequestOptions): Promise<T> {
  const headers = new Headers(options.headers)
  let response = await executeRequest(url, options, headers)
  if (response.ok) {
    return (await response.json()) as T
  }

  const firstErrorMessage = await parseErrorMessage(response.clone())
  if (shouldRetryWithFreshToken(response.status, firstErrorMessage, headers)) {
    const freshToken = await refreshFirebaseIdToken()
    if (freshToken) {
      headers.set('Authorization', `Bearer ${freshToken}`)
      response = await executeRequest(url, options, headers)
      if (response.ok) {
        return (await response.json()) as T
      }
    }
  }

  throw new Error(await parseErrorMessage(response))
}
