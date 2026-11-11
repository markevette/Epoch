import { addDays, hashString, isoDate, parseIsoDate } from "./format"
import { clamp } from "./score"
import type { DayRecord, Inputs } from "./types"

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function jitter(rand: () => number, amount: number): number {
  return (rand() * 2 - 1) * amount
}

export function sanitizeInputs(inputs: Inputs): Inputs {
  return {
    sleepHours: clamp(inputs.sleepHours, 3.5, 12),
    sleepConsistency: clamp(inputs.sleepConsistency, 0, 10),
    hrv: clamp(inputs.hrv, 8, 180),
    restingHr: clamp(inputs.restingHr, 35, 130),
    steps: clamp(inputs.steps, 0, 40000),
    zone2Minutes: clamp(inputs.zone2Minutes, 0, 600),
    strengthSessions: clamp(inputs.strengthSessions, 0, 14),
    protein: clamp(inputs.protein, 0, 10),
    fiber: clamp(inputs.fiber, 0, 10),
    alcoholPerWeek: clamp(inputs.alcoholPerWeek, 0, 30),
    addedSugar: clamp(inputs.addedSugar, 0, 10),
    stress: clamp(inputs.stress, 0, 10),
  }
}

function blend(origin: number, current: number, t: number, noise: number, min: number, max: number): number {
  return clamp(origin + (current - origin) * t + noise, min, max)
}

export function buildHistory(args: {
  inputs: Inputs
  days: number
  seed: number
  trend: "flat" | "improving"
  end: Date
}): DayRecord[] {
  const current = sanitizeInputs(args.inputs)
  const rand = mulberry32(args.seed || 1)
  const origin: Inputs =
    args.trend === "improving"
      ? sanitizeInputs({
          ...current,
          sleepHours: current.sleepHours - 0.85,
          sleepConsistency: current.sleepConsistency - 2,
          hrv: current.hrv - 9,
          restingHr: current.restingHr + 4,
          steps: current.steps - 1800,
          stress: current.stress + 1.5,
        })
      : current
  const days = Math.max(2, Math.round(args.days))
  const records: DayRecord[] = []
  for (let index = 0; index < days; index += 1) {
    const t = days === 1 ? 1 : index / (days - 1)
    const date = isoDate(addDays(args.end, index - (days - 1)))
    if (index === days - 1) {
      records.push({ date, inputs: current, source: "modeled" })
      continue
    }
    records.push({
      date,
      source: "modeled",
      inputs: {
        ...current,
        sleepHours: blend(origin.sleepHours, current.sleepHours, t, jitter(rand, 0.22), 3.5, 12),
        sleepConsistency: blend(origin.sleepConsistency, current.sleepConsistency, t, jitter(rand, 0.4), 0, 10),
        hrv: blend(origin.hrv, current.hrv, t, jitter(rand, 2.5), 8, 180),
        restingHr: blend(origin.restingHr, current.restingHr, t, jitter(rand, 1.4), 35, 130),
        steps: blend(origin.steps, current.steps, t, jitter(rand, 550), 0, 40000),
        stress: blend(origin.stress, current.stress, t, jitter(rand, 0.3), 0, 10),
      },
    })
  }
  return records
}

export function historySeed(name: string, age: number): number {
  return hashString(`${name}:${age}:epoch`)
}

/** Keep a 30-day window ending today. Logged days win over a regenerated modeled baseline. */
export function rollHistory(args: {
  history: DayRecord[]
  inputs: Inputs
  trend: "flat" | "improving"
  seed: number
  today: Date
}): DayRecord[] {
  const fresh = buildHistory({
    inputs: args.inputs,
    days: 30,
    seed: args.seed,
    trend: args.trend,
    end: args.today,
  })
  const logged = new Map(args.history.filter((day) => day.source === "logged").map((day) => [day.date, day]))
  return fresh.map((day) => logged.get(day.date) ?? day)
}

export function replaceDay(history: DayRecord[], date: string, inputs: Inputs, source: DayRecord["source"]): DayRecord[] {
  const next = history.map((day) => (day.date === date ? { date, inputs: sanitizeInputs(inputs), source } : day))
  if (!next.some((day) => day.date === date)) {
    next.push({ date, inputs: sanitizeInputs(inputs), source })
    next.sort((a, b) => a.date.localeCompare(b.date))
  }
  return next
}

export function shiftIso(iso: string, days: number): string {
  return isoDate(addDays(parseIsoDate(iso), days))
}
