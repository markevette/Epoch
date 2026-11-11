import { requireUser } from "@/lib/auth-server"
import { acceptBuddy, buddyRequests, pairBoard, rejectBuddy, replaceBuddyCode, requestBuddy, searchBuddy } from "@/lib/pair-store"
import { QUARTER_HOUR_MS, refuseIfLimited } from "@/lib/rate-limit"
import { normalizeOffset } from "@/lib/rewards"

export const runtime = "nodejs"

export async function GET() {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "member") return Response.json({ error: "Sign in again." }, { status: 401 })
  const code = await pairBoard(authed.id, null)
  if ("error" in code) return Response.json(code, { status: 400 })
  const requests = await buddyRequests(authed.id)
  if ("error" in requests) return Response.json(requests, { status: 400 })
  return Response.json({ code: code.code, pairCount: code.pairs.length, pairCap: code.pairCap, points: code.points, ...requests })
}

export async function POST(request: Request) {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "member") return Response.json({ error: "Sign in again." }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { action?: string; code?: string; requestId?: string; offset?: unknown } | null
  const action = body?.action
  const offset = typeof body?.offset === "number" || typeof body?.offset === "string" ? normalizeOffset(Number(body.offset)) : null
  if (action === "search" || action === "request") {
    const blocked = await refuseIfLimited([
      { name: "buddy-search", key: authed.id, max: 20, windowMs: QUARTER_HOUR_MS },
    ])
    if (blocked) return blocked
  }
  if (action === "search") {
    const hit = await searchBuddy(authed.id, body?.code ?? "")
    if ("error" in hit) return Response.json(hit, { status: 400 })
    if (!hit.found) return Response.json({ found: false, line: "No such ID exists." })
    return Response.json(hit)
  }
  if (action === "request") {
    const result = await requestBuddy(authed.id, body?.code ?? "")
    if ("error" in result) return Response.json(result, { status: 400 })
  } else if (action === "accept") {
    const result = await acceptBuddy(authed.id, body?.requestId ?? "", offset)
    if ("error" in result) return Response.json(result, { status: 400 })
  } else if (action === "reject") {
    const result = await rejectBuddy(authed.id, body?.requestId ?? "")
    if ("error" in result) return Response.json(result, { status: 400 })
  } else if (action === "replace") {
    const result = await replaceBuddyCode(authed.id)
    if ("error" in result) return Response.json(result, { status: 400 })
  } else {
    return Response.json({ error: "The buddy request was incomplete." }, { status: 400 })
  }
  const code = await pairBoard(authed.id, offset)
  if ("error" in code) return Response.json(code, { status: 400 })
  const requests = await buddyRequests(authed.id)
  if ("error" in requests) return Response.json(requests, { status: 400 })
  return Response.json({ code: code.code, pairCount: code.pairs.length, pairCap: code.pairCap, points: code.points, ...requests })
}
