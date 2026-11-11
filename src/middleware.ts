import { NextResponse, type NextRequest } from "next/server"
import { CSRF_COOKIE, CSRF_HEADER, csrfTokensMatch, newCsrfToken } from "./lib/csrf"
import { cookieIsSecure } from "./lib/cookie-policy"

function csrfCookie(request: NextRequest, token: string) {
  return {
    name: CSRF_COOKIE,
    value: token,
    httpOnly: false,
    sameSite: "lax" as const,
    path: "/",
    secure: cookieIsSecure({
      nodeEnv: process.env.NODE_ENV,
      forwardedProto: request.headers.get("x-forwarded-proto"),
      override: process.env.EPOCH_COOKIE_SECURE,
    }),
  }
}

function withCsrfCookie(request: NextRequest, response: NextResponse) {
  const existing = request.cookies.get(CSRF_COOKIE)?.value
  const token = existing && existing.length >= 32 ? existing : newCsrfToken()
  response.cookies.set(csrfCookie(request, token))
  return response
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const mutating = request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS"
  if (path.startsWith("/api/") && mutating) {
    const cookie = request.cookies.get(CSRF_COOKIE)?.value
    const header = request.headers.get(CSRF_HEADER)
    if (!csrfTokensMatch(cookie, header)) {
      return NextResponse.json({ error: "This request did not come from Epoch." }, { status: 403 })
    }
    return NextResponse.next()
  }
  return withCsrfCookie(request, NextResponse.next())
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js).*)"],
}
