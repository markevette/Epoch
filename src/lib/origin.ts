const LOCAL_ORIGIN = "http://127.0.0.1:4317"

function loopback(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost"
}

/** Only https origins, or http on this machine. Never a Host header. */
export function parsePublicOrigin(value: string | undefined | null): string | null {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.username || url.password) return null
    if (url.protocol === "https:") return url.origin
    if (url.protocol === "http:" && loopback(url.hostname)) return url.origin
  } catch {
    // Not a URL.
  }
  return null
}

export function publicOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = parsePublicOrigin(env.EPOCH_PUBLIC_URL)
  if (configured) return configured
  if (env.NODE_ENV === "production") return null
  return LOCAL_ORIGIN
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "local"
  return ip.slice(0, 64)
}
