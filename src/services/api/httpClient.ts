type RequestOptions = {
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH'
  body?: BodyInit | null
  headers?: HeadersInit
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown }
    if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
      return payload.message
    }
  } catch {
    // ignore parse failures and use generic message
  }
  return `Request failed with status ${response.status}`
}

export async function requestJson<T>(url: string, options: RequestOptions): Promise<T> {
  const response = await fetch(url, {
    method: options.method,
    body: options.body ?? null,
    headers: options.headers,
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return (await response.json()) as T
}
