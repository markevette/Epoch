import { isBuddyWeekPath } from "./app-paths"
import { groveNudge, groveReminderDue, groveReminderNotification, type GroveNudge } from "./grove-reminders"
import type { Locale } from "./locale"
import { canComplete, todayQuestOn, type PracticeLog } from "./practice"
import {
  DOOR_TRACKS,
  elapsedMinutes,
  REMINDER_WINDOW_MINUTES,
  reminderMinuteForTrack,
  reminderNotification,
  type SleepClock,
} from "./sleep-clock"

export type DueReminder =
  | { kind: "door"; id: string }
  | { kind: "grove"; nudge: GroveNudge }

export type PushNote = {
  title: string
  body: string
  tag: string
  url: string
  lang: Locale
}

export function noteUrlAllowed(url: string): boolean {
  if (url === "/home/grove" || url === "/home/practice" || url === "/home/pair") return true
  if (/^\/home\/practice\/[a-z0-9-]{1,64}$/.test(url)) return true
  return isBuddyWeekPath(url)
}

/** Doors and the grove hour that are inside their delivery window. */
export function remindersDue(input: {
  sleepClock: SleepClock | null
  practice: PracticeLog
  pendingSun: number
  sun: number
  date: string
  minutes: number
}): DueReminder[] {
  const due: DueReminder[] = []
  if (input.sleepClock) {
    for (const track of DOOR_TRACKS) {
      const quest = todayQuestOn(input.practice, input.date, track)
      if (!quest || quest.status !== "open") continue
      if (!canComplete(input.practice, quest.lesson.id, input.date)) continue
      const elapsed = elapsedMinutes(reminderMinuteForTrack(input.sleepClock, track), input.minutes)
      if (elapsed >= REMINDER_WINDOW_MINUTES) continue
      due.push({ kind: "door", id: quest.lesson.id })
    }
  }
  const nudge = groveNudge(input.pendingSun, input.sun)
  if (nudge && groveReminderDue(nudge, input.minutes)) due.push({ kind: "grove", nudge })
  return due
}

export function reminderNote(locale: Locale, reminder: DueReminder, date: string): PushNote {
  if (reminder.kind === "grove") {
    const note = groveReminderNotification(locale, reminder.nudge)
    return { ...note, lang: locale }
  }
  const note = reminderNotification(locale, reminder.id, date)
  return { ...note, lang: locale }
}
