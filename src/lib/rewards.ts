import { MORNING_START, daypartFromHour } from "./daypart"
import { addDays, isoDate, parseIsoDate } from "./format"

export type RewardSlot = "morning" | "day" | "night"

export type RewardCheckIn = {
  date: string
  slot: RewardSlot
  at: string
  note: string
  /** Extra reward points for a done action. The server writes this. */
  bonus: number
}

export const SLOT_POINTS: Record<RewardSlot, number> = {
  morning: 2,
  day: 2,
  night: 1,
}

export const WEEK_BONUS = 5
export const COMPLETE_DAYS_FOR_BONUS = 5
export const NIGHT_NOTE_MAX = 140
const BONUS_CAP = 30

/** The integer a done action adds. A forecast under the plan’s cutoff pays nothing. */
export function rewardPointsForAction(scoreDelta: number): number {
  if (!Number.isFinite(scoreDelta) || scoreDelta < 0.35) return 0
  return Math.max(1, Math.min(BONUS_CAP, Math.round(scoreDelta)))
}

const SLOT_ORDER: RewardSlot[] = ["morning", "day", "night"]
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const OFFSET_LIMIT = 14 * 60

export type RewardSummary = {
  total: number
  checkInPoints: number
  weekBonus: number
  morningsKept: number
  thisWeekComplete: number
}

export function rewardWindow(now: Date): { slot: RewardSlot; date: string } {
  const hour = now.getHours()
  const slot = daypartFromHour(hour)
  if (slot === "night" && hour < MORNING_START) {
    return { slot: "night", date: isoDate(addDays(now, -1)) }
  }
  return { slot, date: isoDate(now) }
}

export function normalizeOffset(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, Math.trunc(value)))
}

/** A Date whose local calendar fields match the device wall clock. */
export function deviceWallClock(serverNow: Date, offsetMinutes: number): Date {
  const shifted = new Date(serverNow.getTime() - normalizeOffset(offsetMinutes)! * 60_000)
  return new Date(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    shifted.getUTCHours(),
    shifted.getUTCMinutes(),
    shifted.getUTCSeconds(),
    shifted.getUTCMilliseconds(),
  )
}

export function normalizeRewards(value: unknown): RewardCheckIn[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const entries: RewardCheckIn[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const date = typeof row.date === "string" ? row.date : ""
    const slot = row.slot
    if (!ISO_DATE.test(date)) continue
    if (slot !== "morning" && slot !== "day" && slot !== "night") continue
    const key = `${date}:${slot}`
    if (seen.has(key)) continue
    seen.add(key)
    const note = typeof row.note === "string" ? row.note.slice(0, NIGHT_NOTE_MAX) : ""
    const at = typeof row.at === "string" ? row.at.slice(0, 40) : ""
    const rawBonus = typeof row.bonus === "number" && Number.isFinite(row.bonus) ? Math.round(row.bonus) : 0
    const bonus = Math.max(0, Math.min(BONUS_CAP, rawBonus))
    entries.push({ date, slot, at, note, bonus })
  }
  entries.sort((a, b) => a.date.localeCompare(b.date) || SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
  return entries
}

export function slotPoints(slot: RewardSlot): number {
  return SLOT_POINTS[slot]
}

export function morningsKeptLine(count: number, locale: "en" | "de" = "en"): string | null {
  if (count < 1) return null
  if (locale === "de") return count === 1 ? "1 Morgen gehalten" : `${count} Morgen gehalten`
  if (count === 1) return "1 morning kept"
  return `${count} mornings kept`
}

function mondayOf(iso: string): string {
  const date = parseIsoDate(iso)
  const day = date.getDay()
  const delta = day === 0 ? -6 : 1 - day
  return isoDate(addDays(date, delta))
}

function isComplete(entries: RewardCheckIn[], date: string): boolean {
  let morning = false
  let day = false
  let night = false
  for (const entry of entries) {
    if (entry.date !== date) continue
    if (entry.slot === "morning") morning = true
    if (entry.slot === "day") day = true
    if (entry.slot === "night") night = true
  }
  return morning && day && night
}

export function summarizeRewards(entries: RewardCheckIn[], today: Date, extraPoints = 0): RewardSummary {
  const clean = normalizeRewards(entries)
  const checkInPoints = clean.reduce((sum, entry) => sum + SLOT_POINTS[entry.slot], 0)
  const actionPoints = clean.reduce((sum, entry) => sum + entry.bonus, 0)
  const extra = Number.isFinite(extraPoints) ? Math.max(0, Math.round(extraPoints)) : 0
  const morningsKept = clean.filter((entry) => entry.slot === "morning").length
  const todayIso = isoDate(today)
  let weekBonus = 0
  if (clean.length > 0) {
    let cursor = mondayOf(clean.reduce((min, entry) => (entry.date < min ? entry.date : min), clean[0].date))
    const endMonday = mondayOf(todayIso)
    for (let guard = 0; guard < 520 && cursor <= endMonday; guard += 1) {
      const sunday = isoDate(addDays(parseIsoDate(cursor), 6))
      let complete = 0
      for (let index = 0; index < 7; index += 1) {
        const date = isoDate(addDays(parseIsoDate(cursor), index))
        if (isComplete(clean, date)) complete += 1
      }
      if (sunday <= todayIso && complete >= COMPLETE_DAYS_FOR_BONUS) weekBonus += WEEK_BONUS
      cursor = isoDate(addDays(parseIsoDate(cursor), 7))
    }
  }
  let thisWeekComplete = 0
  const thisMonday = mondayOf(todayIso)
  for (let index = 0; index < 7; index += 1) {
    const date = isoDate(addDays(parseIsoDate(thisMonday), index))
    if (isComplete(clean, date)) thisWeekComplete += 1
  }
  return {
    total: checkInPoints + actionPoints + weekBonus + extra,
    checkInPoints,
    weekBonus,
    morningsKept,
    thisWeekComplete,
  }
}

function rawNote(value: unknown, date: string, slot: RewardSlot): string | null {
  if (!Array.isArray(value)) return null
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    if (row.date === date && row.slot === slot) return typeof row.note === "string" ? row.note : ""
  }
  return null
}

function cleanClaimNote(slot: RewardSlot, note: string): string | null {
  const trimmed = note.trim()
  if (slot === "morning") return ""
  if (slot === "day") {
    if (trimmed === "done" || trimmed === "skipped" || trimmed === "unassigned") return trimmed
    return null
  }
  if (trimmed.length < 1 || trimmed.length > NIGHT_NOTE_MAX) return null
  return trimmed
}

function sameWindow(left: { date: string; slot: RewardSlot }, right: { date: string; slot: RewardSlot }): boolean {
  return left.date === right.date && left.slot === right.slot
}

function offsetForClaim(storedOffset: number | null, requested: number | null, serverNow: Date): number | null {
  if (storedOffset == null) return requested
  if (requested == null) return storedOffset
  const storedWindow = rewardWindow(deviceWallClock(serverNow, storedOffset))
  const requestedWindow = rewardWindow(deviceWallClock(serverNow, requested))
  return sameWindow(storedWindow, requestedWindow) ? requested : storedOffset
}

export function acceptRewards(args: {
  stored: unknown
  incoming: unknown
  history: { date: string; source: string }[]
  serverNow: Date
  requestedOffset: unknown
  storedOffset: unknown
  /** Longevity-score forecast for today’s action. Converted here so a client cannot name the amount. */
  dayDoneDelta?: number
}): { rewards: RewardCheckIn[]; rewardClockOffset: number | null } {
  const previous = normalizeRewards(args.stored)
  const storedOffset = normalizeOffset(args.storedOffset)
  const requested = normalizeOffset(args.requestedOffset)
  const incoming = normalizeRewards(args.incoming)
  const known = new Set(previous.map((entry) => `${entry.date}:${entry.slot}`))
  const novel = incoming.filter((entry) => !known.has(`${entry.date}:${entry.slot}`))
  const offset = offsetForClaim(storedOffset, requested, args.serverNow)
  if (novel.length === 0 || offset == null) {
    return { rewards: previous, rewardClockOffset: storedOffset }
  }
  const window = rewardWindow(deviceWallClock(args.serverNow, offset))
  const match = novel.find((entry) => sameWindow(entry, window))
  if (!match) return { rewards: previous, rewardClockOffset: storedOffset }
  const note = cleanClaimNote(match.slot, rawNote(args.incoming, match.date, match.slot) ?? match.note)
  if (note == null) return { rewards: previous, rewardClockOffset: storedOffset }
  if (match.slot === "morning" && !args.history.some((day) => day.date === match.date && day.source === "logged")) {
    return { rewards: previous, rewardClockOffset: storedOffset }
  }
  const saved: RewardCheckIn = {
    date: match.date,
    slot: match.slot,
    at: args.serverNow.toISOString(),
    note,
    bonus: note === "done" ? rewardPointsForAction(args.dayDoneDelta ?? 0) : 0,
  }
  return {
    rewards: normalizeRewards([...previous, saved]),
    rewardClockOffset: offset,
  }
}

export function slotPhase(
  slot: RewardSlot,
  window: { slot: RewardSlot; date: string },
  claimed: boolean,
): "claimed" | "open" | "empty" | "later" {
  if (claimed) return "claimed"
  if (slot === window.slot) return "open"
  return SLOT_ORDER.indexOf(slot) < SLOT_ORDER.indexOf(window.slot) ? "empty" : "later"
}

export const SLOT_HOURS: Record<RewardSlot, string> = {
  morning: "05:00–11:59",
  day: "12:00–17:59",
  night: "18:00–04:59",
}
