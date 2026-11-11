import { DAY_START, MORNING_START, NIGHT_START } from "./daypart"
import { addDays, isoDate } from "./format"
import { deviceWallClock, normalizeOffset, rewardWindow } from "./rewards"

export const MEAL_ORDER = ["breakfast", "lunch", "dinner"] as const
export type MealName = (typeof MEAL_ORDER)[number]

export type MealDay = {
  date: string
  breakfast: number | null
  lunch: number | null
  dinner: number | null
}

/** A single meal. Zero is a logged meal with nothing eaten. */
export const MEAL_KCAL_MAX = 4000

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const MEAL_LABEL: Record<MealName, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
}

/** The food day follows the check-in day: before 05:00 it is still yesterday. */
export function foodDay(now: Date): string {
  if (now.getHours() < MORNING_START) return isoDate(addDays(now, -1))
  return isoDate(now)
}

/**
 * Meals whose window has opened.
 * Morning asks for breakfast. Afternoon adds lunch.
 * Evening adds dinner. Before 05:00, yesterday’s dinner is still open.
 */
export function mealsDue(now: Date): MealName[] {
  const hour = now.getHours()
  if (hour < MORNING_START || hour >= NIGHT_START) return ["breakfast", "lunch", "dinner"]
  if (hour < DAY_START) return ["breakfast"]
  return ["breakfast", "lunch"]
}

export function mealClockOffset(storedOffset: unknown, requestedOffset: unknown, serverNow: Date): number | null {
  const stored = normalizeOffset(storedOffset)
  const requested = normalizeOffset(requestedOffset)
  if (stored == null) return requested
  if (requested == null) return stored
  const left = rewardWindow(deviceWallClock(serverNow, stored))
  const right = rewardWindow(deviceWallClock(serverNow, requested))
  return left.date === right.date && left.slot === right.slot ? requested : stored
}

function cleanKcal(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null
  if (value < 0 || value > MEAL_KCAL_MAX) return null
  return value
}

function cleanDay(value: unknown): MealDay | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const date = typeof row.date === "string" ? row.date : ""
  if (!ISO_DATE.test(date)) return null
  return {
    date,
    breakfast: cleanKcal(row.breakfast),
    lunch: cleanKcal(row.lunch),
    dinner: cleanKcal(row.dinner),
  }
}

export function normalizeMeals(value: unknown): MealDay[] {
  if (!Array.isArray(value)) return []
  const byDate = new Map<string, MealDay>()
  for (const item of value) {
    const day = cleanDay(item)
    if (!day) continue
    if (day.breakfast == null && day.lunch == null && day.dinner == null) continue
    byDate.set(day.date, day)
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function acceptMeals(args: {
  stored: unknown
  incoming: unknown
  serverNow: Date
  offset: number | null
}): MealDay[] {
  const previous = normalizeMeals(args.stored)
  if (args.offset == null) return previous
  const wall = deviceWallClock(args.serverNow, args.offset)
  const date = foodDay(wall)
  const due = new Set(mealsDue(wall))
  const incoming = normalizeMeals(args.incoming).find((day) => day.date === date)
  if (!incoming) return previous
  const prior = previous.find((day) => day.date === date) ?? {
    date,
    breakfast: null,
    lunch: null,
    dinner: null,
  }
  const merged: MealDay = { ...prior }
  for (const meal of MEAL_ORDER) {
    if (!due.has(meal)) continue
    const value = incoming[meal]
    if (value == null) continue
    merged[meal] = value
  }
  if (merged.breakfast == null && merged.lunch == null && merged.dinner == null) return previous
  return normalizeMeals([...previous.filter((day) => day.date !== date), merged])
}
