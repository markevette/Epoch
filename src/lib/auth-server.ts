import { cookies, headers } from "next/headers"
import { accountForToken, closeSession, listMembers } from "./db"
import type { PublicAccount } from "./accounts"
import { cookieIsSecure } from "./cookie-policy"

export const SESSION_COOKIE = "epoch_session"

const THIRTY_DAYS = 60 * 60 * 24 * 30

async function sessionCookie() {
  const headerStore = await headers()
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: cookieIsSecure({
      nodeEnv: process.env.NODE_ENV,
      forwardedProto: headerStore.get("x-forwarded-proto"),
      override: process.env.EPOCH_COOKIE_SECURE,
    }),
  }
}

export async function readToken(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(SESSION_COOKIE)?.value ?? null
}

export async function writeSessionCookie(token: string) {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, { ...(await sessionCookie()), maxAge: THIRTY_DAYS })
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, "", { ...(await sessionCookie()), maxAge: 0 })
}

export async function endSession() {
  const token = await readToken()
  if (token) await closeSession(token)
  await clearSessionCookie()
}

export type SessionBody = {
  user: PublicAccount | null
  members: PublicAccount[]
}

export async function sessionBody(): Promise<SessionBody> {
  const token = await readToken()
  const authed = token ? await accountForToken(token) : null
  if (!authed) return { user: null, members: [] }
  return {
    user: authed.account,
    members: authed.account.role === "admin" ? await listMembers() : [],
  }
}

export async function requireUser() {
  const token = await readToken()
  if (!token) return null
  return accountForToken(token)
}
