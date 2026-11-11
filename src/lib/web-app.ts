import type { MetadataRoute } from "next"

export const INSTALLED_APP_URL = "web+epoch://open"

export type InstallSurface = "hidden" | "install" | "ios" | "open"

export function installSurface(input: {
  standalone: boolean
  ios: boolean
  installedRelated: boolean
}): InstallSurface {
  if (input.standalone) return "hidden"
  if (input.installedRelated) return "open"
  if (input.ios) return "ios"
  return "install"
}

export function isIosDevice(ua: string, platform: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return platform === "MacIntel" && maxTouchPoints > 1
}

export function isOurInstalledApp(apps: { platform: string; url?: string }[], origin: string): boolean {
  let expected: URL
  try {
    expected = new URL("/manifest.webmanifest", origin)
  } catch {
    return false
  }
  return apps.some((app) => {
    if (app.platform !== "webapp" || !app.url) return false
    try {
      const url = new URL(app.url)
      return url.origin === expected.origin && url.pathname === expected.pathname
    } catch {
      return false
    }
  })
}

export function epochManifest(origin: string): MetadataRoute.Manifest {
  const base = origin.replace(/\/$/, "")
  return {
    name: "Epoch",
    short_name: "Epoch",
    description: "A daily longevity score, a biological-age estimate, and the next action that moves them.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone"],
    background_color: "#f4efe6",
    theme_color: "#1e4f43",
    lang: "en",
    categories: ["health", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    protocol_handlers: [{ protocol: "web+epoch", url: "/?open=%s" }],
    related_applications: [{ platform: "webapp", url: `${base}/manifest.webmanifest` }],
    prefer_related_applications: false,
    launch_handler: { client_mode: "navigate-existing" },
  }
}
