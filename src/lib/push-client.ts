import { appFetch } from "./browser-api"
import type { Locale } from "./locale"

export type PushHold = "armed" | "open-only" | "skipped"

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function sameKey(current: ArrayBuffer | null, next: Uint8Array): boolean {
  if (!current) return false
  const bytes = new Uint8Array(current)
  if (bytes.length !== next.length) return false
  for (let index = 0; index < bytes.length; index += 1) if (bytes[index] !== next[index]) return false
  return true
}

let pending: Promise<PushHold> | null = null

/** Ask the server to deliver one test reminder after a short wait. */
export async function requestDemoReminder(): Promise<"scheduled" | "failed"> {
  const response = await appFetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "demo" }),
  })
  return response.ok ? "scheduled" : "failed"
}

/** Register this device so a reminder can arrive after Epoch is closed. */
export function holdPushReminders(locale: Locale): Promise<PushHold> {
  if (pending) return pending
  pending = arm(locale).finally(() => {
    pending = null
  })
  return pending
}

async function arm(locale: Locale): Promise<PushHold> {
  if (typeof window === "undefined") return "skipped"
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return "open-only"
  if (Notification.permission !== "granted") return "skipped"
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
    const response = await appFetch("/api/push")
    const body = (await response.json().catch(() => null)) as { publicKey?: string } | null
    if (!response.ok || !body?.publicKey) return "open-only"
    const key = urlBase64ToUint8Array(body.publicKey)
    let subscription = await registration.pushManager.getSubscription()
    if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
      await subscription.unsubscribe()
      subscription = null
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key as BufferSource,
      })
    }
    const saved = await appFetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: subscription.toJSON().keys,
        locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    })
    return saved.ok ? "armed" : "open-only"
  } catch {
    return "open-only"
  }
}
