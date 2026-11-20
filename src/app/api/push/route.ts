import { requireUser } from "@/lib/auth-server"
import { pushPublicKey, savePushSubscription } from "@/lib/push-dispatch"
import { cleanPushSubscription } from "@/lib/push-endpoint"
import { QUARTER_HOUR_MS, refuseIfLimited } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function GET() {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "member") return Response.json({ error: "Sign in again." }, { status: 401 })
  return Response.json({ publicKey: await pushPublicKey() })
}

export async function POST(request: Request) {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "member") return Response.json({ error: "Sign in again." }, { status: 401 })
  const blocked = await refuseIfLimited([{ name: "push-save", key: authed.id, max: 30, windowMs: QUARTER_HOUR_MS }])
  if (blocked) return blocked
  const clean = cleanPushSubscription(await request.json().catch(() => null))
  if (!clean) return Response.json({ error: "This device could not be registered for reminders." }, { status: 400 })
  await savePushSubscription(authed.id, clean)
  return Response.json({ ok: true })
}
