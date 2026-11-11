import { requireUser } from "@/lib/auth-server"
import { buddyWeek, sendScoreNudge } from "@/lib/pair-store"
import { normalizeOffset } from "@/lib/rewards"

export const runtime = "nodejs"

function offsetOf(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null
  return normalizeOffset(typeof value === "number" ? value : Number(value))
}

export async function GET(request: Request) {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "member") return Response.json({ error: "Sign in again." }, { status: 401 })
  const url = new URL(request.url)
  const pairId = url.searchParams.get("pairId") ?? ""
  const raw = url.searchParams.get("offset")
  const view = await buddyWeek(authed.id, pairId, raw == null || raw.trim() === "" ? null : offsetOf(raw))
  if ("error" in view) return Response.json(view, { status: 400 })
  return Response.json(view)
}

export async function POST(request: Request) {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "member") return Response.json({ error: "Sign in again." }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { pairId?: string; optionId?: string; offset?: unknown } | null
  const view = await sendScoreNudge(authed.id, body?.pairId ?? "", body?.optionId ?? "", offsetOf(body?.offset))
  if ("error" in view) return Response.json(view, { status: 400 })
  return Response.json(view)
}
