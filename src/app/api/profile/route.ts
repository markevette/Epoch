import { requireUser, sessionBody } from "@/lib/auth-server"
import { saveOwnedProfile } from "@/lib/db"
import type { Profile } from "@/lib/types"

export const runtime = "nodejs"

export async function PUT(request: Request) {
  const authed = await requireUser()
  if (!authed) return Response.json({ error: "Sign in again." }, { status: 401 })
  const incoming = (await request.json().catch(() => null)) as (Profile & { healthConsent?: boolean; adult?: boolean }) | null
  if (!incoming || typeof incoming !== "object" || !incoming.inputs) {
    return Response.json({ error: "The file was incomplete." }, { status: 400 })
  }
  const firstFile = authed.account.role === "member" && !authed.account.profile
  if (firstFile && incoming.healthConsent !== true) {
    return Response.json({ error: "Health data needs a separate consent before this file can open." }, { status: 400 })
  }
  if (firstFile && incoming.adult !== true) {
    return Response.json({ error: "Epoch is for adults." }, { status: 400 })
  }
  const saved = await saveOwnedProfile(authed.id, incoming, {
    grantHealthConsent: firstFile && incoming.healthConsent === true && incoming.adult === true,
  })
  if (!saved) return Response.json({ error: "This account cannot store a file." }, { status: 403 })
  return Response.json(await sessionBody())
}
