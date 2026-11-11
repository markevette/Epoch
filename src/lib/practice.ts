import { addDays, isoDate, parseIsoDate } from "./format"
import type { Locale } from "./locale"
import { LESSON_CATALOG, lessonText, PRACTICE_TRACKS, type Lesson, type PracticeTrack } from "./practice-lessons"
import { todayTwist } from "./practice-twist"
import { deviceWallClock, normalizeOffset } from "./rewards"

/** One new skill per branch per week. Then that branch rotates. */
export const NEW_SKILL_DAYS = 7

export type { Lesson, PracticeTrack }

export type PracticeCompletion = {
  id: string
  date: string
}

export type PracticeLog = {
  completions: PracticeCompletion[]
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const LESSONS: Lesson[] = LESSON_CATALOG

const TRACK_LABEL: Record<Locale, Record<PracticeTrack, string>> = {
  en: { sleep: "Sleep", movement: "Movement", nutrition: "Nutrition", stress: "Stress" },
  de: { sleep: "Schlaf", movement: "Bewegung", nutrition: "Ernährung", stress: "Stress" },
}

export function trackLabel(locale: Locale, track: PracticeTrack): string {
  return TRACK_LABEL[locale][track]
}

export function lessonsOn(track: PracticeTrack): Lesson[] {
  return LESSONS.filter((lesson) => lesson.track === track).sort((a, b) => a.level - b.level)
}

export function lessonById(id: string): Lesson | null {
  return LESSONS.find((lesson) => lesson.id === id) ?? null
}

export function presentLesson(locale: Locale, lesson: Lesson): Lesson {
  return lessonText(locale, lesson)
}

export function presentToday(locale: Locale, lesson: Lesson, today: string): Lesson {
  const base = presentLesson(locale, lesson)
  const twist = todayTwist(locale, lesson.track, today, lesson.id)
  return {
    ...base,
    action: `${base.action} ${twist.action}`,
    doneLine: `${base.doneLine} ${twist.done}`,
  }
}

export function firstLearnedOn(log: PracticeLog, id: string): string | null {
  let earliest: string | null = null
  for (const item of log.completions) {
    if (item.id !== id) continue
    if (!earliest || item.date < earliest) earliest = item.date
  }
  return earliest
}

export function newSkillReady(log: PracticeLog, lesson: Lesson, today: string): boolean {
  if (isDone(log, lesson.id)) return false
  if (lesson.level === 1) return true
  const previous = lessonsOn(lesson.track).find((item) => item.level === lesson.level - 1)
  if (!previous || !isDone(log, previous.id)) return false
  const learned = firstLearnedOn(log, previous.id)
  if (!learned) return false
  return isoDate(addDays(parseIsoDate(learned), NEW_SKILL_DAYS)) <= today
}

export function normalizePractice(value: unknown): PracticeLog {
  if (!value || typeof value !== "object") return { completions: [] }
  const rows = (value as { completions?: unknown }).completions
  if (!Array.isArray(rows)) return { completions: [] }
  const seen = new Set<string>()
  const completions: PracticeCompletion[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const id = (row as { id?: unknown }).id
    const date = (row as { date?: unknown }).date
    if (typeof id !== "string" || !lessonById(id)) continue
    if (typeof date !== "string" || !ISO_DATE.test(date)) continue
    const key = `${id}:${date}`
    if (seen.has(key)) continue
    seen.add(key)
    completions.push({ id, date })
  }
  completions.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  return { completions }
}

export function isDone(log: PracticeLog, id: string): boolean {
  return log.completions.some((item) => item.id === id)
}

function lastCompletedOn(log: PracticeLog, id: string): string {
  let latest = ""
  for (const item of log.completions) {
    if (item.id === id && item.date > latest) latest = item.date
  }
  return latest
}

/** After a branch is learned, it keeps rotating those skills. */
export function rotateDoor(log: PracticeLog, track: PracticeTrack): Lesson | null {
  const available = lessonsOn(track).filter((lesson) => isDone(log, lesson.id))
  if (available.length === 0) return null
  return [...available].sort((a, b) => {
    const byDate = lastCompletedOn(log, a.id).localeCompare(lastCompletedOn(log, b.id))
    return byDate !== 0 ? byDate : a.level - b.level
  })[0] ?? null
}

export function lessonState(log: PracticeLog, id: string, today?: string): "done" | "open" | "locked" {
  const lesson = lessonById(id)
  if (!lesson) return "locked"
  if (today && !completedOnTrack(log, lesson.track, today)) {
    const unlocking = lessonsOn(lesson.track).find((item) => newSkillReady(log, item, today))
    if (unlocking) return unlocking.id === lesson.id ? "open" : isDone(log, id) ? "done" : "locked"
    const keep = rotateDoor(log, lesson.track)
    if (keep?.id === lesson.id) return "open"
  }
  if (isDone(log, id)) return "done"
  if (lesson.level === 1) return "open"
  const previous = lessonsOn(lesson.track).find((item) => item.level === lesson.level - 1)
  if (!previous || !isDone(log, previous.id)) return "locked"
  return today && newSkillReady(log, lesson, today) ? "open" : "locked"
}

export function visibleLessons(log: PracticeLog, track: PracticeTrack, today?: string): Lesson[] {
  return lessonsOn(track).filter((lesson) => lessonState(log, lesson.id, today) !== "locked")
}

export function hiddenDoor(log: PracticeLog, track: PracticeTrack, today?: string): "week" | "rotation" | null {
  if (trackExhausted(log, track)) return "rotation"
  const next = lessonsOn(track).find((lesson) => lessonState(log, lesson.id, today) === "locked")
  if (!next) return "rotation"
  const previous = lessonsOn(track).find((item) => item.level === next.level - 1)
  if (previous && isDone(log, previous.id)) return "week"
  return null
}

export function treeExhausted(log: PracticeLog): boolean {
  return LESSONS.every((lesson) => isDone(log, lesson.id))
}

export function trackExhausted(log: PracticeLog, track: PracticeTrack): boolean {
  return lessonsOn(track).every((lesson) => isDone(log, lesson.id))
}

export function completedOnTrack(log: PracticeLog, track: PracticeTrack, date: string): boolean {
  return log.completions.some((item) => {
    if (item.date !== date) return false
    const lesson = lessonById(item.id)
    return Boolean(lesson && lesson.track === track)
  })
}

export function canComplete(log: PracticeLog, id: string, date: string): boolean {
  if (!ISO_DATE.test(date)) return false
  const lesson = lessonById(id)
  if (!lesson) return false
  if (completedOnTrack(log, lesson.track, date)) return false
  return lessonState(log, id, date) === "open"
}

export function deviceToday(serverNow: Date, offsetMinutes: number | null): string {
  const offset = normalizeOffset(offsetMinutes)
  return isoDate(offset == null ? serverNow : deviceWallClock(serverNow, offset))
}

/** Keeps stored skills. A new skill lands only for the device’s today, and only one new skill per branch that day. */
export function acceptPractice(input: {
  stored: unknown
  incoming: unknown
  serverNow: Date
  offset: number | null
}): PracticeLog {
  const kept = normalizePractice(input.stored)
  const incoming = normalizePractice(input.incoming)
  const today = deviceToday(input.serverNow, input.offset)
  const have = new Set(kept.completions.map((item) => `${item.id}:${item.date}`))
  let next = kept
  for (const item of incoming.completions) {
    if (have.has(`${item.id}:${item.date}`) || item.date !== today) continue
    if (!canComplete(next, item.id, today)) continue
    next = { completions: [...next.completions, item] }
    have.add(`${item.id}:${item.date}`)
  }
  return normalizePractice(next)
}

/** Unique skills in the window. A later week can count a return to a skill already learned. */
export function practiceXp(log: PracticeLog, from?: string, through?: string): number {
  const counted = new Set<string>()
  let sum = 0
  for (const item of log.completions) {
    if (from && item.date < from) continue
    if (through && item.date > through) continue
    if (counted.has(item.id)) continue
    counted.add(item.id)
    sum += lessonById(item.id)?.xp ?? 0
  }
  return sum
}

export function weekBounds(iso: string): { from: string; through: string } {
  const date = parseIsoDate(iso)
  const day = date.getDay()
  const delta = day === 0 ? -6 : 1 - day
  const from = isoDate(addDays(date, delta))
  return { from, through: isoDate(addDays(parseIsoDate(from), 6)) }
}

export type LeagueBand = "seed" | "sprout" | "grove"

export function leagueBand(xp: number): LeagueBand {
  if (xp >= 40) return "grove"
  if (xp >= 20) return "sprout"
  return "seed"
}

export type DayQuest = { lesson: Lesson; status: "open" | "done" }

export function todayQuests(log: PracticeLog, today: string): DayQuest[] {
  const quests: DayQuest[] = []
  for (const track of PRACTICE_TRACKS) {
    const doneToday = log.completions.find((item) => {
      if (item.date !== today) return false
      const lesson = lessonById(item.id)
      return lesson?.track === track
    })
    if (doneToday) {
      const lesson = lessonById(doneToday.id)
      if (lesson) quests.push({ lesson, status: "done" })
      continue
    }
    const open = lessonsOn(track).find((lesson) => lessonState(log, lesson.id, today) === "open")
    if (open) {
      quests.push({ lesson: open, status: "open" })
      continue
    }
  }
  return quests
}

export function todayQuest(log: PracticeLog, today: string): DayQuest | null {
  const quests = todayQuests(log, today)
  return quests.find((quest) => quest.status === "open") ?? quests[0] ?? null
}

export function todayQuestOn(log: PracticeLog, today: string, track: PracticeTrack): DayQuest | null {
  return todayQuests(log, today).find((quest) => quest.lesson.track === track) ?? null
}

export function tracks(): PracticeTrack[] {
  return [...PRACTICE_TRACKS]
}

export function nextOnBranch(lesson: Lesson): Lesson | null {
  return lessonsOn(lesson.track).find((item) => item.level === lesson.level + 1) ?? null
}
