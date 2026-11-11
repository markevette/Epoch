import { requireUser } from "@/lib/auth-server"
import { localeFromCookieHeader } from "@/lib/locale"
import { deletePair, leavePair, nudgePair, pairBoard, pausePair, repairPair, setPairShare } from "@/lib/pair-store"
import { normalizeOffset } from "@/lib/rewards"

export const runtime = "nodejs"

function offsetOf(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null
  return normalizeOffset(typeof value === "number" ? value : Number(value))
}

function offsetFromUrl(request: Request): number | null {
  const raw = new URL(request.url).searchParams.get("offset")
  if (raw == null || raw.trim() === "") return null
  return offsetOf(raw)
}

export async function GET(request: Request) {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "member") return Response.json({ error: "Sign in again." }, { status: 401 })
  const view = await pairBoard(authed.id, offsetFromUrl(request), new Date(), localeFromCookieHeader(request.headers.get("cookie")))
  if ("error" in view) return Response.json(view, { status: 400 })
  return Response.json(view)
}

export async function POST(request: Request) {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "member") return Response.json({ error: "Sign in again." }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { action?: string; pairId?: string; offset?: unknown; on?: boolean } | null
  const action = body?.action
  const offset = offsetOf(body?.offset)
  const pairId = typeof body?.pairId === "string" ? body.pairId : ""
  const id = authed.id
  const result =
    action === "leave" ? await leavePair(id, pairId, offset)
    : action === "delete" ? await deletePair(id, pairId)
    : action === "nudge" ? await nudgePair(id, pairId, offset)
    : action === "pause" ? await pausePair(id, pairId, offset)
    : action === "repair" ? await repairPair(id, pairId, offset)
    : action === "share" ? await setPairShare(id, pairId, body?.on === true)
    : null
  if (!result) return Response.json({ error: "The pair request was incomplete." }, { status: 400 })
  if ("error" in result) return Response.json(result, { status: 400 })
  const view = await pairBoard(id, offset, new Date(), localeFromCookieHeader(request.headers.get("cookie")))
  if ("error" in view) return Response.json(view, { status: 400 })
  return Response.json(view)
}
