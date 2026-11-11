import { sessionBody, writeSessionCookie } from "@/lib/auth-server"
import { acceptInvite, joinRequiresInvite, registerMember } from "@/lib/db"
import { clientKey } from "@/lib/origin"
import { HOUR_MS, refuseIfLimited } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const blocked = await refuseIfLimited([{ name: "join-ip", key: clientKey(request), max: 8, windowMs: HOUR_MS }])
  if (blocked) return blocked
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string; name?: string; invite?: string } | null
  if ((await joinRequiresInvite()) && !(await acceptInvite(body?.invite ?? ""))) {
    return Response.json({ error: "This beta needs an invite." }, { status: 400 })
  }
  const created = await registerMember({
    email: body?.email ?? "",
    password: body?.password ?? "",
    name: body?.name ?? "",
  })
  if ("error" in created) return Response.json({ error: created.error }, { status: 400 })
  await writeSessionCookie(created.token)
  return Response.json(await sessionBody())
}
