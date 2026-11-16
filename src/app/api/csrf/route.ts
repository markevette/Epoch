import { CSRF_ISSUED_HEADER } from "@/lib/csrf"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const token = request.headers.get(CSRF_ISSUED_HEADER) ?? ""
  if (token.length < 32) return Response.json({ error: "This request did not come from Epoch." }, { status: 403 })
  return Response.json({ token })
}
