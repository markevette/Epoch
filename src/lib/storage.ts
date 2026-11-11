import type { Account, Directory } from "./accounts"
import { normalizeBody } from "./body"
import { rollHistory, historySeed, replaceDay, sanitizeInputs } from "./history"
import { isoDate } from "./format"
import { normalizeMeals } from "./meals"
import { normalizeWorkouts } from "./workouts"
import { normalizeOffset, normalizeRewards } from "./rewards"
import { cleanConsentAt } from "./legal"
import { cleanLocale } from "./locale"
import { normalizePractice } from "./practice"
import { cleanSleepClock } from "./sleep-clock"
import type { DayRecord, Inputs, Profile } from "./types"

export const STORAGE_KEY = "epoch.v1"
export const DIRECTORY_KEY = "epoch.directory.v1"

export function loadProfile(): Profile | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Profile
    if (!parsed || typeof parsed.name !== "string" || !parsed.inputs) return null
    return freshen(parsed)
  } catch {
    return null
  }
}

export function saveProfile(profile: Profile | null) {
  if (typeof window === "undefined") return
  if (!profile) {
    window.localStorage.removeItem(STORAGE_KEY)
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

export function emptyDirectory(): Directory {
  return { sessionEmail: null, accounts: [] }
}

export function loadDirectory(): Directory {
  if (typeof window === "undefined") return emptyDirectory()
  try {
    const raw = window.localStorage.getItem(DIRECTORY_KEY)
    if (!raw) return emptyDirectory()
    const parsed = JSON.parse(raw) as Directory
    if (!parsed || !Array.isArray(parsed.accounts) || parsed.accounts.length === 0) return emptyDirectory()
    return {
      sessionEmail: typeof parsed.sessionEmail === "string" ? parsed.sessionEmail : null,
      accounts: parsed.accounts.map(restoreAccount),
    }
  } catch {
    return emptyDirectory()
  }
}

export function saveDirectory(directory: Directory) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(DIRECTORY_KEY, JSON.stringify(directory))
}

function restoreAccount(account: Account): Account {
  if (!account.profile) return account
  return {
    ...account,
    profile: freshen(account.profile),
  }
}

export function freshen(profile: Profile, today = new Date()): Profile {
  const history = rollHistory({
    history: profile.history ?? [],
    inputs: profile.inputs,
    trend: profile.trend ?? "flat",
    seed: historySeed(profile.handle, profile.age),
    today,
  })
  const todayIso = isoDate(today)
  const todayRow = history.find((day) => day.date === todayIso)
  const inputs = todayRow?.source === "logged" ? todayRow.inputs : profile.inputs
  const next = {
    ...profile,
    ...normalizeBody(profile.heightCm, profile.weightKg, profile.demo),
    inputs,
    history,
    rewards: normalizeRewards(profile.rewards),
    nudgePoints: cleanNudgePoints(profile.nudgePoints),
    rewardClockOffset: normalizeOffset(profile.rewardClockOffset),
    meals: normalizeMeals(profile.meals),
    workouts: normalizeWorkouts(profile.workouts),
    healthConsentAt: cleanConsentAt(profile.healthConsentAt),
    locale: cleanLocale(profile.locale),
    practice: normalizePractice(profile.practice),
    sleepClock: cleanSleepClock(profile.sleepClock),
  }
  const leftover = next as Profile & { tier?: unknown; upgradeRequest?: unknown; priceOffer?: unknown }
  delete leftover.tier
  delete leftover.upgradeRequest
  delete leftover.priceOffer
  return leftover
}

export function cleanNudgePoints(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100_000, Math.round(value)))
}

export function withInputs(profile: Profile, inputs: Inputs, today = new Date()): Profile {
  const clean = sanitizeInputs(inputs)
  const todayIso = isoDate(today)
  const existing = profile.history.find((day) => day.date === todayIso)
  const history: DayRecord[] = replaceDay(profile.history, todayIso, clean, existing?.source ?? "modeled")
  return { ...profile, inputs: clean, history }
}

export function withDailyLog(
  profile: Profile,
  daily: Pick<Inputs, "sleepHours" | "hrv" | "restingHr" | "steps" | "stress">,
  today = new Date()
): Profile {
  const inputs = sanitizeInputs({ ...profile.inputs, ...daily })
  const history = replaceDay(profile.history, isoDate(today), inputs, "logged")
  return { ...profile, inputs, history }
}
