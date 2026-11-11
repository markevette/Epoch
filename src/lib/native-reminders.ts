import { App } from "@capacitor/app"
import { Capacitor } from "@capacitor/core"
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications"
import { lessonById, tracks, type PracticeLog, type PracticeTrack } from "./practice"
import { reminderNotification, scheduledDoor, type SleepClock } from "./sleep-clock"
import type { Locale } from "./locale"

const NATIVE_ID: Record<PracticeTrack, number> = {
  sleep: 101,
  movement: 102,
  nutrition: 103,
  stress: 104,
}

export function isNativeShell(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform()
}

export type ReminderPermission = NotificationPermission | "unsupported"

export function readReminderPermission(): ReminderPermission {
  if (typeof window === "undefined") return "unsupported"
  if (isNativeShell()) return "default"
  if (typeof Notification === "undefined") return "unsupported"
  return Notification.permission
}

export async function currentReminderPermission(): Promise<ReminderPermission> {
  if (typeof window === "undefined") return "unsupported"
  if (isNativeShell()) {
    const { display } = await LocalNotifications.checkPermissions()
    if (display === "granted") return "granted"
    if (display === "denied") return "denied"
    return "default"
  }
  if (typeof Notification === "undefined") return "unsupported"
  return Notification.permission
}

export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (typeof window === "undefined") return "unsupported"
  if (isNativeShell()) {
    const { display } = await LocalNotifications.requestPermissions()
    if (display === "granted") return "granted"
    if (display === "denied") return "denied"
    return "default"
  }
  if (typeof Notification === "undefined") return "unsupported"
  return Notification.requestPermission()
}

export async function armNativeReminders(
  clock: SleepClock,
  log: PracticeLog,
  locale: Locale,
  now = new Date(),
): Promise<void> {
  if (!isNativeShell()) return
  const { display } = await LocalNotifications.checkPermissions()
  if (display !== "granted") return
  await LocalNotifications.cancel({
    notifications: tracks().map((track) => ({ id: NATIVE_ID[track] })),
  })
  const notifications: LocalNotificationSchema[] = []
  for (const track of tracks()) {
    const door = scheduledDoor(clock, log, track, now)
    if (!door) continue
    const note = reminderNotification(locale, door.lesson.id, door.date)
    notifications.push({
      id: NATIVE_ID[track],
      title: note.title,
      body: note.body,
      schedule: { at: door.when, allowWhileIdle: true },
      extra: { url: note.url },
    })
  }
  if (notifications.length) await LocalNotifications.schedule({ notifications })
}

export async function showNativeReminder(locale: Locale, id: string, today = "2000-01-01"): Promise<void> {
  if (!isNativeShell()) return
  const { display } = await LocalNotifications.checkPermissions()
  if (display !== "granted") return
  const lesson = lessonById(id)
  if (!lesson) return
  const note = reminderNotification(locale, id, today)
  await LocalNotifications.schedule({
    notifications: [
      {
        id: NATIVE_ID[lesson.track],
        title: note.title,
        body: note.body,
        extra: { url: note.url },
        schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true },
      },
    ],
  })
}

export function onNativeReminderOpen(open: (url: string) => void): () => void {
  if (!isNativeShell()) return () => undefined
  let handle: { remove: () => Promise<void> } | null = null
  void LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    const url = event.notification.extra?.url
    if (typeof url === "string" && url.startsWith("/home/practice/")) open(url)
  }).then((listener) => {
    handle = listener
  })
  return () => {
    void handle?.remove()
  }
}

export function onNativeAppResume(handler: () => void): () => void {
  if (!isNativeShell()) return () => undefined
  let handle: { remove: () => Promise<void> } | null = null
  void App.addListener("appStateChange", (state) => {
    if (state.isActive) handler()
  }).then((listener) => {
    handle = listener
  })
  return () => {
    void handle?.remove()
  }
}
