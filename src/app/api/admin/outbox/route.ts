import { requireUser } from "@/lib/auth-server"
import { listOutbox } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "admin") {
    return Response.json({ error: "Staff only." }, { status: 403 })
  }
  return Response.json({ letters: await listOutbox() })
}
