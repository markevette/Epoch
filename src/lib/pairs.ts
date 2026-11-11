import { DAY_START, MORNING_START } from "./daypart"
import { addDays, formatLongDate, isoDate, parseIsoDate } from "./format"
import type { Locale } from "./locale"
import { COMPLETE_DAYS_FOR_BONUS, deviceWallClock } from "./rewards"

export type PairSide = "a" | "b"
export type PairMark = "kept" | "open" | "waiting" | "miss" | "pause"

export type PairPerson = {
  name: string
  offsetMinutes: number | null
  morningDates: readonly string[]
  completeDates: readonly string[]
}

export type PairPause = { weekMonday: string; onDate: string }
export type PairRepair = { month: string; gapDate: string; agreedA: boolean; agreedB: boolean }

export const PAIR_CAP = 5
export const BUDDY_UNLOCK_POINTS = 150

/** Five pairs on every file, plus one more for each 150 reward points. */
export function buddyCap(points: number): number {
  const earned = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0
  return PAIR_CAP + Math.floor(earned / BUDDY_UNLOCK_POINTS)
}

export type PairSnapshot =
  | { state: "none" }
  | { state: "ended"; id: string; streak: number; longest: number; partnerHandle: string; partnerName: string }
  | {
      state: "active"
      id: string
      yourHandle: string
      partnerHandle: string
      partnerName: string
      streak: number
      longest: number
      line: string
      yourMark: PairMark
      partnerMark: PairMark
      pauseAvailable: boolean
      pauseDate: string | null
      repair: { gapDate: string; youAgreed: boolean; partnerAgreed: boolean } | null
      milestone: 7 | 30 | null
      sharing: boolean
      partnerSharing: boolean
      canShare: boolean
      canNudge: boolean
      nudged: boolean
      partnerNudged: boolean
      startedOn: string
      handleA: string
      handleB: string
    }

export type PairEvaluation = {
  streak: number
  longest: number
  line: string
  focusDate: string
  yourMark: PairMark
  partnerMark: PairMark
  pauseAvailable: boolean
  pauseDate: string | null
  pauseWeek: string | null
  repair: { gapDate: string; month: string; youAgreed: boolean; partnerAgreed: boolean } | null
  milestone: 7 | 30 | null
  canShare: boolean
  canNudge: boolean
  nudged: boolean
  partnerNudged: boolean
}

type Outcome = "kept" | "pause" | "bridge" | "miss" | "pending"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function firstSharedMorning(now: Date, offsetA: number | null, offsetB: number | null): string {
  const a = nextOpenMorning(wallOf(now, offsetA))
  const b = nextOpenMorning(wallOf(now, offsetB))
  return a > b ? a : b
}

export function evaluatePair(input: {
  now: Date
  startedOn: string
  you: PairSide
  personA: PairPerson
  personB: PairPerson
  pauses: readonly PairPause[]
  repairs: readonly PairRepair[]
  nudge: { date: string; by: PairSide } | null
  shareA: boolean
  shareB: boolean
  locale?: Locale
}): PairEvaluation {
  const you = input.you === "a" ? input.personA : input.personB
  const partner = input.you === "a" ? input.personB : input.personA
  const wallYou = wallOf(input.now, you.offsetMinutes)
  const wallA = wallOf(input.now, input.personA.offsetMinutes)
  const wallB = wallOf(input.now, input.personB.offsetMinutes)
  const todayYou = isoDate(wallYou)
  const todayA = isoDate(wallA)
  const todayB = isoDate(wallB)
  const through = todayA < todayB ? todayA : todayB
  const focusDate = todayYou < input.startedOn ? input.startedOn : todayYou
  const morningsA = new Set(input.personA.morningDates)
  const morningsB = new Set(input.personB.morningDates)
  const pauseOn = new Set(input.pauses.map((pause) => pause.onDate))
  const bridges = new Set(input.repairs.filter((repair) => repair.agreedA && repair.agreedB).map((repair) => repair.gapDate))

  const end = todayA > todayB ? todayA : todayB
  const dates = eachDate(input.startedOn, end < input.startedOn ? input.startedOn : end)
  const settled: { date: string; outcome: Outcome }[] = []
  let streak = 0
  let longest = 0
  let run = 0
  for (const date of dates) {
    const outcome = dayOutcome(date, wallA, wallB, morningsA, morningsB, pauseOn, bridges)
    if (outcome === "pending") break
    settled.push({ date, outcome })
    if (outcome === "kept") {
      run += 1
      streak = run
      if (streak > longest) longest = streak
    } else if (outcome === "miss") {
      run = 0
      streak = 0
    }
  }

  const yourMark = markFor(focusDate, wallYou, new Set(you.morningDates), pauseOn)
  const partnerMark = markFor(focusDate, wallOf(input.now, partner.offsetMinutes), new Set(partner.morningDates), pauseOn)
  const earned = earnedWeeks(input.startedOn, through, input.personA.completeDates, input.personB.completeDates)
  const spent = new Set(input.pauses.map((pause) => pause.weekMonday))
  const pauseWeek = earned.find((week) => !spent.has(week)) ?? null
  const pauseDate = trailingMiss(settled)
  const repair = repairOffer(settled, input.repairs, input.you)
  const milestone = streak >= 30 ? 30 : streak >= 7 ? 7 : null
  const nudged = input.nudge?.date === focusDate && input.nudge.by === input.you
  const partnerNudged = Boolean(input.nudge && input.nudge.date === focusDate && input.nudge.by !== input.you)
  const partnerWaiting = partnerMark === "open" || partnerMark === "waiting"
  const canNudge = yourMark === "kept" && partnerWaiting && input.nudge?.date !== focusDate

  return {
    streak,
    longest,
    line: statusLine({
      startedOn: input.startedOn,
      todayYou,
      focusDate,
      streak,
      longest,
      yourMark,
      partnerMark,
      partnerName: firstName(partner.name),
      paused: pauseOn.has(focusDate),
      locale: input.locale ?? "en",
    }),
    focusDate,
    yourMark,
    partnerMark,
    pauseAvailable: Boolean(pauseWeek && pauseDate),
    pauseDate: pauseWeek ? pauseDate : null,
    pauseWeek: pauseDate ? pauseWeek : null,
    repair,
    milestone,
    canShare: Boolean(milestone) && input.shareA && input.shareB,
    canNudge,
    nudged,
    partnerNudged,
  }
}

export function pairCardHandles(handleA: string, handleB: string): [string, string] {
  return [handleA, handleB].sort((left, right) => left.localeCompare(right)) as [string, string]
}

export function morningsTogetherLabel(count: number, locale: Locale = "en"): string {
  if (locale === "de") return count === 1 ? "1 Morgen zusammen" : `${count} Morgen zusammen`
  return count === 1 ? "1 morning together" : `${count} mornings together`
}

function statusLine(input: {
  startedOn: string
  todayYou: string
  focusDate: string
  streak: number
  longest: number
  yourMark: PairMark
  partnerMark: PairMark
  partnerName: string
  paused: boolean
  locale: Locale
}): string {
  const de = input.locale === "de"
  const date = formatLongDate(input.startedOn, input.locale)
  if (input.todayYou < input.startedOn) return de ? `Der erste gemeinsame Morgen ist der ${date}.` : `The first morning together is ${date}.`
  if (input.paused) return de ? "Eine Pause deckt diesen Morgen." : "A pause covers this morning."
  const yoursOpen = input.yourMark === "open" || input.yourMark === "waiting"
  const theirsOpen = input.partnerMark === "open" || input.partnerMark === "waiting"
  if (input.yourMark === "kept" && theirsOpen) {
    return de ? `Du hast diesen Morgen gehalten. Der Morgen von ${input.partnerName} ist noch offen.` : `You kept this morning. ${input.partnerName}'s morning is still open.`
  }
  if (input.partnerMark === "kept" && yoursOpen) {
    return de ? `${input.partnerName} hat diesen Morgen gehalten. Deiner ist noch offen.` : `${input.partnerName} kept this morning. Yours is still open.`
  }
  if (input.yourMark === "kept" && input.partnerMark === "kept") return morningsTogetherLabel(input.streak, input.locale)
  if (input.yourMark === "miss" && theirsOpen) {
    return de ? `Dein Morgen ist zu. Der Morgen von ${input.partnerName} ist noch offen.` : `Your morning closed. ${input.partnerName}'s morning is still open.`
  }
  if (input.partnerMark === "miss" && yoursOpen) {
    return de ? `Der Morgen von ${input.partnerName} ist zu. Deiner ist noch offen.` : `${input.partnerName}'s morning closed. Yours is still open.`
  }
  if (yoursOpen && theirsOpen) return de ? "Beide Morgen sind noch offen." : "Both mornings are still open."
  if (input.longest > 0) return de ? `Dieser Morgen hat das Paar zurückgesetzt. Längste Folge: ${input.longest}.` : `This morning reset the pair. Longest together: ${input.longest}.`
  return de ? "Dieser Morgen hat das Paar zurückgesetzt." : "This morning reset the pair."
}

function dayOutcome(
  date: string,
  wallA: Date,
  wallB: Date,
  morningsA: Set<string>,
  morningsB: Set<string>,
  pauseOn: Set<string>,
  bridges: Set<string>,
): Outcome {
  if (morningsA.has(date) && morningsB.has(date)) return "kept"
  if (bridges.has(date)) return "bridge"
  if (pauseOn.has(date)) return "pause"
  if (!windowClosed(date, wallA) || !windowClosed(date, wallB)) return "pending"
  return "miss"
}

function markFor(date: string, wall: Date, mornings: Set<string>, pauseOn: Set<string>): PairMark {
  if (pauseOn.has(date)) return "pause"
  if (mornings.has(date)) return "kept"
  const today = isoDate(wall)
  if (date > today) return "waiting"
  if (date < today) return "miss"
  const hour = wall.getHours()
  if (hour < MORNING_START) return "waiting"
  if (hour < DAY_START) return "open"
  return "miss"
}

function windowClosed(date: string, wall: Date): boolean {
  const today = isoDate(wall)
  if (date > today) return false
  if (date < today) return true
  return wall.getHours() >= DAY_START
}

function trailingMiss(settled: { date: string; outcome: Outcome }[]): string | null {
  const last = settled[settled.length - 1]
  const before = settled[settled.length - 2]
  if (!last || last.outcome !== "miss") return null
  if (!before || before.outcome === "miss") return null
  return last.date
}

function repairOffer(
  settled: { date: string; outcome: Outcome }[],
  repairs: readonly PairRepair[],
  you: PairSide,
): PairEvaluation["repair"] {
  const last = settled[settled.length - 1]
  const gap = settled[settled.length - 2]
  const before = settled[settled.length - 3]
  if (!last || !gap || !before) return null
  if (last.outcome !== "kept" || gap.outcome !== "miss" || before.outcome === "miss") return null
  const month = last.date.slice(0, 7)
  const existing = repairs.find((repair) => repair.month === month)
  if (existing?.agreedA && existing.agreedB) return null
  const same = existing?.gapDate === gap.date ? existing : null
  return {
    gapDate: gap.date,
    month,
    youAgreed: same ? (you === "a" ? same.agreedA : same.agreedB) : false,
    partnerAgreed: same ? (you === "a" ? same.agreedB : same.agreedA) : false,
  }
}

function earnedWeeks(startedOn: string, through: string, completeA: readonly string[], completeB: readonly string[]): string[] {
  const setA = new Set(completeA)
  const setB = new Set(completeB)
  const seeds = [...setA, ...setB].filter((date) => date >= startedOn && date < through).sort()
  if (seeds.length === 0 || !ISO_DATE.test(startedOn)) return []
  let cursor = mondayOf(seeds[0] < startedOn ? startedOn : seeds[0])
  const endMonday = mondayOf(through)
  const earned: string[] = []
  for (let guard = 0; guard < 520 && cursor <= endMonday; guard += 1) {
    const sunday = isoDate(addDays(parseIsoDate(cursor), 6))
    if (sunday >= startedOn && sunday < through) {
      let countA = 0
      let countB = 0
      for (let index = 0; index < 7; index += 1) {
        const date = isoDate(addDays(parseIsoDate(cursor), index))
        if (date < startedOn) continue
        if (setA.has(date)) countA += 1
        if (setB.has(date)) countB += 1
      }
      if (countA >= COMPLETE_DAYS_FOR_BONUS && countB >= COMPLETE_DAYS_FOR_BONUS) earned.push(cursor)
    }
    cursor = isoDate(addDays(parseIsoDate(cursor), 7))
  }
  return earned
}

function nextOpenMorning(wall: Date): string {
  if (wall.getHours() < DAY_START) return isoDate(wall)
  return isoDate(addDays(wall, 1))
}

function wallOf(now: Date, offset: number | null): Date {
  if (offset == null) return now
  return deviceWallClock(now, offset)
}

function eachDate(start: string, end: string): string[] {
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end) || start > end) return []
  const dates: string[] = []
  let cursor = start
  for (let guard = 0; guard < 800 && cursor <= end; guard += 1) {
    dates.push(cursor)
    cursor = isoDate(addDays(parseIsoDate(cursor), 1))
  }
  return dates
}

function mondayOf(iso: string): string {
  const date = parseIsoDate(iso)
  const day = date.getDay()
  const delta = day === 0 ? -6 : 1 - day
  return isoDate(addDays(date, delta))
}

function firstName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return "Your pair"
  return trimmed.split(/\s+/)[0] ?? trimmed
}
