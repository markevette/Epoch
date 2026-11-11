import type { MetadataRoute } from "next"
import { publicOrigin } from "@/lib/origin"
import { epochManifest } from "@/lib/web-app"

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  return epochManifest(publicOrigin() ?? "http://127.0.0.1:4317")
}
