import { requireUser } from "@/lib/auth-server"
import { backupNow, listBackups } from "@/lib/backup"

export const runtime = "nodejs"

export async function GET() {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "admin") {
    return Response.json({ error: "Staff only." }, { status: 403 })
  }
  return Response.json({ backups: listBackups() })
}

export async function POST() {
  const authed = await requireUser()
  if (!authed || authed.account.role !== "admin") {
    return Response.json({ error: "Staff only." }, { status: 403 })
  }
  const result = await backupNow()
  if ("error" in result) return Response.json({ error: result.error }, { status: 500 })
  return Response.json({ name: result.name, backups: listBackups() })
}
