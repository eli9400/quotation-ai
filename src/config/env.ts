const DEFAULT_API_BASE_URL = 'http://localhost:4000/api'

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
}
