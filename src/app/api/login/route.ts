import { normalizeEmail } from "@/lib/accounts"
import { sessionBody, writeSessionCookie } from "@/lib/auth-server"
import { openSession } from "@/lib/db"
import { clientKey } from "@/lib/origin"
import { QUARTER_HOUR_MS, refuseIfLimited } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null
  const email = normalizeEmail(body?.email ?? "")
  const password = body?.password ?? ""
  const blocked = await refuseIfLimited([
    { name: "login-ip", key: clientKey(request), max: 30, windowMs: QUARTER_HOUR_MS },
    { name: "login-email", key: email || clientKey(request), max: 10, windowMs: QUARTER_HOUR_MS },
  ])
  if (blocked) return blocked
  const opened = await openSession(email, password)
  if (!opened) {
    return Response.json({ error: "That email and password don’t match." }, { status: 401 })
  }
  await writeSessionCookie(opened.token)
  return Response.json(await sessionBody())
}
