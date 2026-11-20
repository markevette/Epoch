import { cleanLocale, type Locale } from "./locale"
import { cleanTimeZone } from "./zoned-clock"

const KEY = /^[A-Za-z0-9_-]{16,200}$/

/** Browser push services only. A member cannot aim delivery at an address they type. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
]

export function pushEndpointAllowed(value: string): boolean {
  if (value.length > 2000) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== "https:") return false
  if (url.username || url.password || url.port) return false
  const host = url.hostname.toLowerCase()
  if (!PUSH_HOSTS.some((pattern) => pattern.test(host))) return false
  return url.pathname.length > 1
}

export type PushSubscriptionInput = {
  endpoint: string
  p256dh: string
  auth: string
  locale: Locale
  timeZone: string
}

export function cleanPushSubscription(body: unknown): PushSubscriptionInput | null {
  if (!body || typeof body !== "object") return null
  const row = body as {
    endpoint?: unknown
    keys?: { p256dh?: unknown; auth?: unknown }
    locale?: unknown
    timeZone?: unknown
  }
  if (typeof row.endpoint !== "string" || !pushEndpointAllowed(row.endpoint)) return null
  const p256dh = row.keys?.p256dh
  const auth = row.keys?.auth
  if (typeof p256dh !== "string" || !KEY.test(p256dh)) return null
  if (typeof auth !== "string" || !KEY.test(auth)) return null
  const timeZone = cleanTimeZone(row.timeZone)
  if (!timeZone) return null
  return {
    endpoint: row.endpoint,
    p256dh,
    auth,
    locale: cleanLocale(row.locale) ?? "en",
    timeZone,
  }
}
