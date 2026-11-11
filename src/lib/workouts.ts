import { foodDay } from "./meals"
import { deviceWallClock } from "./rewards"

export type WorkoutDay = {
  date: string
  workedOut: boolean
  /** Whole kcal. A no is stored as 0. */
  kcal: number
}

export const WORKOUT_KCAL_MAX = 4000

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function burnedLine(kcal: number | null, locale: "en" | "de" = "en"): string | null {
  if (kcal == null || kcal <= 0) return null
  const amount = kcal.toLocaleString(locale === "de" ? "de-DE" : "en-GB")
  return locale === "de" ? `${amount} kcal verbrannt` : `${amount} kcal burned`
}

export function workoutOn(workouts: WorkoutDay[], date: string): WorkoutDay | null {
  return workouts.find((day) => day.date === date) ?? null
}

function cleanKcal(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null
  if (value < 0 || value > WORKOUT_KCAL_MAX) return null
  return value
}

function cleanDay(value: unknown): WorkoutDay | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const date = typeof row.date === "string" ? row.date : ""
  if (!ISO_DATE.test(date) || typeof row.workedOut !== "boolean") return null
  const kcal = cleanKcal(row.kcal)
  if (kcal == null) return null
  return { date, workedOut: row.workedOut, kcal: row.workedOut ? kcal : 0 }
}

export function normalizeWorkouts(value: unknown): WorkoutDay[] {
  if (!Array.isArray(value)) return []
  const byDate = new Map<string, WorkoutDay>()
  for (const item of value) {
    const day = cleanDay(item)
    if (!day) continue
    byDate.set(day.date, day)
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function acceptWorkouts(args: {
  stored: unknown
  incoming: unknown
  serverNow: Date
  offset: number | null
}): WorkoutDay[] {
  const previous = normalizeWorkouts(args.stored)
  if (args.offset == null) return previous
  const date = foodDay(deviceWallClock(args.serverNow, args.offset))
  const incoming = normalizeWorkouts(args.incoming).find((day) => day.date === date)
  if (!incoming) return previous
  return normalizeWorkouts([...previous.filter((day) => day.date !== date), incoming])
}
