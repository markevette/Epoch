import { POUR_COST } from "./grove"
import type { Locale } from "./locale"
import { nextReminderAt } from "./sleep-clock"

/** Evening, after the day's check-ins have had time to drop sun. */
export const GROVE_REMINDER_MINUTES = 18 * 60
export const GROVE_REMINDER_URL = "/home/grove"
export const GROVE_REMINDER_TAG = "epoch-grove"
export const GROVE_NATIVE_ID = 105

export type GroveNudge = "collect" | "water"

export function groveNudge(pendingSun: number, sun: number, pourCost = POUR_COST): GroveNudge | null {
  const waiting = Number.isFinite(pendingSun) ? Math.max(0, Math.floor(pendingSun)) : 0
  const held = Number.isFinite(sun) ? Math.max(0, Math.floor(sun)) : 0
  if (waiting > 0) return "collect"
  if (held >= pourCost) return "water"
  return null
}

export function groveReminderAt(now: Date): Date {
  return nextReminderAt(GROVE_REMINDER_MINUTES, now)
}

/** The evening hour, while there is still something to collect or pour. */
export function groveReminderDue(nudge: GroveNudge | null, nowMinutes: number): boolean {
  if (!nudge) return false
  return nowMinutes >= GROVE_REMINDER_MINUTES && nowMinutes < GROVE_REMINDER_MINUTES + 60
}

export function groveReminderNotification(locale: Locale, nudge: GroveNudge): { title: string; body: string; tag: string; url: string } {
  if (locale === "de") {
    return nudge === "collect"
      ? {
          title: "Sonne wartet auf der Wiese",
          body: "Sammle sie im Hain und gieße sie dann auf den Baum.",
          tag: GROVE_REMINDER_TAG,
          url: GROVE_REMINDER_URL,
        }
      : {
          title: "Der Baum kann einen Guss nehmen",
          body: "Du hast genug Sonne. Öffne den Hain und gieße.",
          tag: GROVE_REMINDER_TAG,
          url: GROVE_REMINDER_URL,
        }
  }
  return nudge === "collect"
    ? {
        title: "Sun is waiting on the lawn",
        body: "Collect it in the grove, then pour it on the tree.",
        tag: GROVE_REMINDER_TAG,
        url: GROVE_REMINDER_URL,
      }
    : {
        title: "The tree can take a pour",
        body: "You have enough sun. Open the grove and water it.",
        tag: GROVE_REMINDER_TAG,
        url: GROVE_REMINDER_URL,
      }
}
