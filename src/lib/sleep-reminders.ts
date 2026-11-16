import { tracks, type PracticeLog } from "./practice"
import { isBuddyWeekPath } from "./app-paths"
import { storedNudge } from "./copy"
import { GROVE_REMINDER_TAG, groveReminderAt, groveReminderNotification, type GroveNudge } from "./grove-reminders"
import {
  armNativeGroveReminder,
  armNativeReminders,
  currentReminderPermission,
  isNativeShell,
  showNativeBuddyLine,
  showNativeGroveReminder,
  showNativeReminder,
} from "./native-reminders"
import { reminderNotification, scheduledDoor, type SleepClock } from "./sleep-clock"
import type { Locale } from "./locale"

type TriggerWindow = Window & { TimestampTrigger?: new (timestamp: number) => unknown }

function canScheduleAhead(): boolean {
  return typeof Notification !== "undefined" && "showTrigger" in Notification.prototype && typeof (window as TriggerWindow).TimestampTrigger === "function"
}

export async function showReminder(locale: Locale, id: string, today = "2000-01-01"): Promise<void> {
  if (isNativeShell()) {
    await showNativeReminder(locale, id, today)
    return
  }
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return
  if (!("serviceWorker" in navigator)) return
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
  const note = reminderNotification(locale, id, today)
  await registration.showNotification(note.title, {
    body: note.body,
    tag: note.tag,
    lang: locale,
    icon: "/icons/icon-192.png",
    data: { url: note.url },
  })
}

/** Hold the next reminder on this device, including when the native shell is closed. */
export async function armScheduledReminders(
  clock: SleepClock,
  log: PracticeLog,
  locale: Locale,
  now = new Date(),
): Promise<void> {
  if (isNativeShell()) {
    await armNativeReminders(clock, log, locale, now)
    return
  }
  if (!canScheduleAhead() || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return
  const Trigger = (window as TriggerWindow).TimestampTrigger
  if (!Trigger) return
  const registration = await navigator.serviceWorker.ready
  const pending = await registration.getNotifications({ includeTriggered: true } as { tag?: string })
  for (const note of pending) {
    if (note.tag.startsWith("epoch-") && note.tag !== GROVE_REMINDER_TAG && !note.tag.startsWith("epoch-buddy")) note.close()
  }
  for (const track of tracks()) {
    const door = scheduledDoor(clock, log, track, now)
    if (!door) continue
    const note = reminderNotification(locale, door.lesson.id, door.date)
    await registration.showNotification(note.title, {
      body: note.body,
      tag: note.tag,
      lang: locale,
      icon: "/icons/icon-192.png",
      data: { url: note.url },
      showTrigger: new Trigger(door.when.getTime()),
    } as NotificationOptions)
  }
}

export async function showGroveReminder(locale: Locale, nudge: GroveNudge): Promise<void> {
  if (isNativeShell()) {
    await showNativeGroveReminder(locale, nudge)
    return
  }
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return
  if (!("serviceWorker" in navigator)) return
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
  const note = groveReminderNotification(locale, nudge)
  await registration.showNotification(note.title, {
    body: note.body,
    tag: note.tag,
    lang: locale,
    icon: "/icons/icon-192.png",
    data: { url: note.url },
  })
}

/** Hold the next grove reminder on this device. Pass null to clear one that is no longer due. */
export async function armGroveReminder(nudge: GroveNudge | null, locale: Locale, now = new Date()): Promise<void> {
  if (isNativeShell()) {
    await armNativeGroveReminder(nudge, locale, now)
    return
  }
  if (!canScheduleAhead() || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return
  const Trigger = (window as TriggerWindow).TimestampTrigger
  if (!Trigger) return
  const registration = await navigator.serviceWorker.ready
  const pending = await registration.getNotifications({ includeTriggered: true } as { tag?: string })
  for (const note of pending) {
    if (note.tag === GROVE_REMINDER_TAG) note.close()
  }
  if (!nudge) return
  const note = groveReminderNotification(locale, nudge)
  await registration.showNotification(note.title, {
    body: note.body,
    tag: note.tag,
    lang: locale,
    icon: "/icons/icon-192.png",
    data: { url: note.url },
    showTrigger: new Trigger(groveReminderAt(now).getTime()),
  } as NotificationOptions)
}

export async function showBuddyLine(locale: Locale, name: string, english: string, url: string): Promise<void> {
  if (!isBuddyWeekPath(url)) return
  const title = locale === "de" ? `${name} schrieb` : `${name} wrote`
  const body = storedNudge(locale, english)
  if (isNativeShell()) {
    await showNativeBuddyLine(title, body, url)
    return
  }
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return
  if (!("serviceWorker" in navigator)) return
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
  await registration.showNotification(title, {
    body,
    tag: "epoch-buddy-line",
    lang: locale,
    icon: "/icons/icon-192.png",
    data: { url },
  })
}

export { currentReminderPermission }
