import { CSRF_COOKIE, CSRF_HEADER } from "./csrf"

export function csrfHeaders(): Record<string, string> {
  if (typeof document === "undefined") return {}
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`))
  const token = match ? decodeURIComponent(match[1]) : ""
  return token ? { [CSRF_HEADER]: token } : {}
}

export function appFetch(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase()
  const headers = new Headers(init?.headers)
  if (method !== "GET" && method !== "HEAD") {
    for (const [key, value] of Object.entries(csrfHeaders())) headers.set(key, value)
  }
  return fetch(path, { ...init, headers, credentials: "same-origin" })
}
