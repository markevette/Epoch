import { requireUser } from "@/lib/auth-server"
import { pushPublicKey, savePushSubscription, sendDemoPush } from "@/lib/push-dispatch"
import { cleanPushSubscription } from "@/lib/push-endpoint"
import { HOUR_MS, QUARTER_HOUR_MS, refuseIfLimited } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function GET() {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "member") return Response.json({ error: "Sign in again." }, { status: 401 })
  return Response.json({ publicKey: await pushPublicKey() })
}

export async function POST(request: Request) {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "member") return Response.json({ error: "Sign in again." }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (body && typeof body === "object" && (body as { action?: unknown }).action === "demo") {
    const blocked = await refuseIfLimited([{ name: "push-demo", key: authed.id, max: 4, windowMs: HOUR_MS }])
    if (blocked) return blocked
    const delivered = await sendDemoPush(authed.id)
    if ("error" in delivered) return Response.json(delivered, { status: 400 })
    return Response.json(delivered)
  }
  const blocked = await refuseIfLimited([{ name: "push-save", key: authed.id, max: 30, windowMs: QUARTER_HOUR_MS }])
  if (blocked) return blocked
  const clean = cleanPushSubscription(body)
  if (!clean) return Response.json({ error: "This device could not be registered for reminders." }, { status: 400 })
  await savePushSubscription(authed.id, clean)
  return Response.json({ ok: true })
}
