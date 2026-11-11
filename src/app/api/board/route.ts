import { requireUser } from "@/lib/auth-server"
import { listBoard } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "member") {
    return Response.json({ error: "Sign in to see the board." }, { status: 401 })
  }
  return Response.json({ rows: await listBoard() })
}
