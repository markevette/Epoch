function safePath(raw) {
  if (raw === "/home" || raw === "/home/grove" || raw === "/home/practice" || raw === "/home/pair") return raw
  if (typeof raw === "string" && /^\/home\/practice\/[a-z0-9-]{1,64}$/.test(raw)) return raw
  if (typeof raw === "string" && /^\/home\/buddies\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return raw
  return "/home"
}

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", () => {
  // Present so the browser can offer installation. Pages stay on the network.
})

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = typeof data.title === "string" && data.title.trim() ? data.title.slice(0, 120) : "Epoch"
  const body = typeof data.body === "string" ? data.body.slice(0, 240) : ""
  const tag = typeof data.tag === "string" && /^epoch-[a-z0-9-]{1,80}$/.test(data.tag) ? data.tag : "epoch-reminder"
  const lang = data.lang === "de" ? "de" : "en"
  const url = safePath(data.url)
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      lang,
      icon: "/icons/icon-192.png",
      data: { url },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const path = safePath(event.notification.data && event.notification.data.url)
  const target = new URL(path, self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin))
      if (open) {
        open.postMessage({ type: "epoch-open", url: path })
        return open.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    }),
  )
})
