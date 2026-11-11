import { clearSessionCookie, requireUser } from "@/lib/auth-server"
import { deleteOwnedAccount } from "@/lib/db"

export const runtime = "nodejs"

export async function DELETE() {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "member") {
    return Response.json({ error: "Sign in as a member to delete this file." }, { status: 401 })
  }
  const removed = await deleteOwnedAccount(authed.id)
  if (!removed) return Response.json({ error: "This account cannot be deleted from here." }, { status: 403 })
  await clearSessionCookie()
  return Response.json({ ok: true })
}
