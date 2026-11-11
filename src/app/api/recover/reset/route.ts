import { resetPasswordWithToken } from "@/lib/db"
import { clientKey } from "@/lib/origin"
import { HOUR_MS, refuseIfLimited } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const blocked = await refuseIfLimited([{ name: "reset-ip", key: clientKey(request), max: 15, windowMs: HOUR_MS }])
  if (blocked) return blocked
  const body = (await request.json().catch(() => null)) as { token?: string; password?: string } | null
  const result = await resetPasswordWithToken(body?.token ?? "", body?.password ?? "")
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 })
  return Response.json({ ok: true })
}
