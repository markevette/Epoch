import { isoDate } from "./format"
import type { Locale } from "./locale"
import { PRACTICE_TRACKS, type PracticeTrack } from "./practice-lessons"
import {
  canComplete,
  lessonById,
  presentToday,
  todayQuestOn,
  type Lesson,
  type PracticeLog,
} from "./practice"
export type SleepClock = {
  wake: string
  bed: string
}

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/
const DAY = 24 * 60
export const REMINDER_WINDOW_MINUTES = 60

export const DOOR_TRACKS: PracticeTrack[] = [...PRACTICE_TRACKS]

export function parseClock(value: string): number | null {
  const match = CLOCK.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

export function cleanSleepClock(value: unknown): SleepClock | null {
  if (!value || typeof value !== "object") return null
  const wake = (value as { wake?: unknown }).wake
  const bed = (value as { bed?: unknown }).bed
  if (typeof wake !== "string" || typeof bed !== "string") return null
  if (parseClock(wake) == null || parseClock(bed) == null) return null
  return { wake, bed }
}

export function minutesNow(now = new Date()): number {
  return now.getHours() * 60 + now.getMinutes()
}

/** Sleep at wake. Movement five hours later. Nutrition seven hours later. Stress one hour before bed. */
export function reminderMinuteForTrack(clock: SleepClock, track: PracticeTrack): number {
  const wake = parseClock(clock.wake) ?? 0
  const bed = parseClock(clock.bed) ?? 0
  if (track === "sleep") return wake
  if (track === "movement") return (wake + 5 * 60) % DAY
  if (track === "nutrition") return (wake + 7 * 60) % DAY
  return (bed - 60 + DAY) % DAY
}

export function elapsedMinutes(at: number, now: number): number {
  return (now - at + DAY) % DAY
}

export function dueReminder(
  clock: SleepClock | null,
  log: PracticeLog,
  today: string,
  nowMinutes: number,
): string | null {
  if (!clock) return null
  let best: { id: string; elapsed: number } | null = null
  for (const track of DOOR_TRACKS) {
    const quest = todayQuestOn(log, today, track)
    if (!quest || quest.status !== "open") continue
    if (!canComplete(log, quest.lesson.id, today)) continue
    const elapsed = elapsedMinutes(reminderMinuteForTrack(clock, track), nowMinutes)
    if (elapsed >= REMINDER_WINDOW_MINUTES) continue
    if (!best || elapsed < best.elapsed) best = { id: quest.lesson.id, elapsed }
  }
  return best?.id ?? null
}

/** The next local time this reminder should appear. A time already passed today moves to tomorrow. */
export function nextReminderAt(atMinutes: number, now: Date): Date {
  const next = new Date(now)
  next.setSeconds(0, 0)
  next.setHours(Math.floor(atMinutes / 60), atMinutes % 60, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next
}

export function scheduledDoor(
  clock: SleepClock,
  log: PracticeLog,
  track: PracticeTrack,
  now: Date,
): { when: Date; lesson: Lesson; date: string } | null {
  let when = nextReminderAt(reminderMinuteForTrack(clock, track), now)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const date = isoDate(when)
    const quest = todayQuestOn(log, date, track)
    if (quest && quest.status === "open" && canComplete(log, quest.lesson.id, date)) {
      return { when, lesson: quest.lesson, date }
    }
    when = new Date(when.getTime() + 24 * 60 * 60 * 1000)
  }
  return null
}

export function reminderPath(id: string): string {
  return `/home/practice/${id}`
}

export function reminderNotification(
  locale: Locale,
  id: string,
  today = "2000-01-01",
): { title: string; body: string; tag: string; url: string } {
  const lesson = lessonById(id)
  const text = lesson ? presentToday(locale, lesson, today) : null
  return {
    title: text?.title ?? id,
    body: text?.action ?? "",
    tag: `epoch-${id}`,
    url: reminderPath(id),
  }
}
