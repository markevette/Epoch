import { requireUser } from "@/lib/auth-server"
import { changePassword } from "@/lib/db"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const authed = await requireUser()
  if (!authed) return Response.json({ error: "Sign in again." }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { current?: string; next?: string } | null
  const result = await changePassword(authed.id, body?.current ?? "", body?.next ?? "")
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 })
  return Response.json({ ok: true })
}
