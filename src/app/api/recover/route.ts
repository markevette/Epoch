import { RECOVERY_NOTICE, requestPasswordReset } from "@/lib/db"
import { clientKey } from "@/lib/origin"
import { HOUR_MS, refuseIfLimited } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const blocked = await refuseIfLimited([{ name: "recover-ip", key: clientKey(request), max: 10, windowMs: HOUR_MS }])
  if (blocked) return blocked
  const body = (await request.json().catch(() => null)) as { email?: string } | null
  await requestPasswordReset(typeof body?.email === "string" ? body.email : "")
  return Response.json({ ok: true, notice: RECOVERY_NOTICE })
}
