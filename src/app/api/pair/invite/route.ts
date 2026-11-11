import { invitePreview } from "@/lib/pair-store"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? ""
  const preview = await invitePreview(token)
  if ("error" in preview) return Response.json(preview, { status: 404 })
  return Response.json(preview)
}
