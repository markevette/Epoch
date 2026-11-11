import { requireUser } from "@/lib/auth-server"
import { openMemberFile } from "@/lib/db"
import { normalizeEmail } from "@/lib/accounts"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "admin") {
    return Response.json({ error: "Staff sign-in is required to open a file." }, { status: 401 })
  }
  const body = (await request.json().catch(() => null)) as { email?: string } | null
  const email = normalizeEmail(body?.email ?? "")
  if (!email) return Response.json({ error: "Name the member." }, { status: 400 })
  const opened = await openMemberFile(authed.account.email, email)
  if ("error" in opened) return Response.json({ error: opened.error }, { status: 404 })
  return Response.json(opened)
}
