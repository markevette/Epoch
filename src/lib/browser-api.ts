import { CSRF_HEADER } from "./csrf"

let memory = ""
let inflight: Promise<string> | null = null

async function csrfToken(): Promise<string> {
  if (typeof document === "undefined") return ""
  if (memory.length >= 32) return memory
  if (!inflight) {
    inflight = fetch("/api/csrf", { credentials: "same-origin" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { token?: string } | null
        const token = response.ok && typeof data?.token === "string" && data.token.length >= 32 ? data.token : ""
        if (token) memory = token
        return token
      })
      .catch(() => "")
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export async function appFetch(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase()
  const headers = new Headers(init?.headers)
  const mutating = method !== "GET" && method !== "HEAD"
  if (mutating) {
    const token = await csrfToken()
    if (token) headers.set(CSRF_HEADER, token)
  }
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" })
  if (!mutating || response.status !== 403) return response
  const data = (await response.clone().json().catch(() => null)) as { error?: string } | null
  if (data?.error !== "This request did not come from Epoch.") return response
  memory = ""
  const token = await csrfToken()
  if (!token) return response
  headers.set(CSRF_HEADER, token)
  return fetch(path, { ...init, headers, credentials: "same-origin" })
}
