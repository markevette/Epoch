export const CSRF_COOKIE = "epoch_csrf"
export const CSRF_HEADER = "x-epoch-csrf"
export const CSRF_ISSUED_HEADER = "x-epoch-csrf-issued"

export function csrfCookieSettings(secure: boolean) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure,
  }
}

export function newCsrfToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "")
}

export function csrfTokensMatch(cookie: string | undefined, header: string | null): boolean {
  if (!cookie || !header || cookie.length < 32) return false
  if (cookie.length !== header.length) return false
  let diff = 0
  for (let i = 0; i < cookie.length; i += 1) diff |= cookie.charCodeAt(i) ^ header.charCodeAt(i)
  return diff === 0
}
