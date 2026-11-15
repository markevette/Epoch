import { requireUser } from "@/lib/auth-server"
import { buyGroveSun, gatherGroveSun, pourGroveWater, readGrove } from "@/lib/db"
import { QUARTER_HOUR_MS, HOUR_MS, refuseIfLimited } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function GET() {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "member") {
    return Response.json({ error: "Sign in again." }, { status: 401 })
  }
  const view = await readGrove(authed.id)
  if ("error" in view) return Response.json(view, { status: 400 })
  return Response.json(view)
}

export async function POST(request: Request) {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "member") {
    return Response.json({ error: "Sign in again." }, { status: 401 })
  }
  const blocked = await refuseIfLimited([{ name: "grove", key: authed.id, max: 40, windowMs: QUARTER_HOUR_MS }])
  if (blocked) return blocked
  const body = (await request.json().catch(() => null)) as { action?: string; pack?: string } | null
  const action = body?.action
  if (action === "buy") {
    const limited = await refuseIfLimited([{ name: "grove-buy", key: authed.id, max: 6, windowMs: HOUR_MS }])
    if (limited) return limited
    const view = await buyGroveSun(authed.id, typeof body?.pack === "string" ? body.pack : "")
    if ("error" in view) return Response.json(view, { status: 400 })
    return Response.json(view)
  }
  const view =
    action === "gather" ? await gatherGroveSun(authed.id)
    : action === "water" ? await pourGroveWater(authed.id)
    : null
  if (!view) return Response.json({ error: "The grove request was incomplete." }, { status: 400 })
  if ("error" in view) return Response.json(view, { status: 400 })
  return Response.json(view)
}
