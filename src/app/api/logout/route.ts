import { endSession } from "@/lib/auth-server"

export const runtime = "nodejs"

export async function POST() {
  await endSession()
  return Response.json({ ok: true })
}
