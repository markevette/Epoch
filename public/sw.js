self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", () => {
  // Present so the browser can offer installation. Pages stay on the network.
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const raw = event.notification.data && event.notification.data.url
  const path = raw === "/home/practice/sleep-wake" || raw === "/home/practice/sleep-dim" || raw === "/home/practice/sleep-nap"
    ? raw
    : "/home/practice"
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
