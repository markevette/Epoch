import { sessionBody } from "@/lib/auth-server"

export const runtime = "nodejs"

export async function GET() {
  return Response.json(await sessionBody())
}
