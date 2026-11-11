import type { MealDay } from "./meals"
import type { PracticeLog } from "./practice"
import type { SleepClock } from "./sleep-clock"
import type { RewardCheckIn } from "./rewards"
import type { WorkoutDay } from "./workouts"

export type Sex = "female" | "male" | "other"

export type DriverKey =
  | "sleep"
  | "hrv"
  | "restingHr"
  | "activity"
  | "nutrition"
  | "stress"

export type Inputs = {
  sleepHours: number
  sleepConsistency: number
  hrv: number
  restingHr: number
  steps: number
  zone2Minutes: number
  strengthSessions: number
  protein: number
  fiber: number
  alcoholPerWeek: number
  addedSugar: number
  stress: number
}

export type DaySource = "modeled" | "logged"

export type DayRecord = {
  date: string
  inputs: Inputs
  source: DaySource
}

export type Profile = {
  id: string
  name: string
  handle: string
  age: number
  sex: Sex
  heightCm: number
  weightKg: number
  goals: string[]
  inputs: Inputs
  leaderboard: boolean
  history: DayRecord[]
  savedOffers: string[]
  trend: "flat" | "improving"
  createdAt: string
  demo: boolean
  rewards: RewardCheckIn[]
  /** Reward points from score-week lines. The server writes this. */
  nudgePoints?: number
  rewardClockOffset: number | null
  meals: MealDay[]
  workouts: WorkoutDay[]
  /** Server time of the separate health-data consent. The client cannot set this. */
  healthConsentAt?: string | null
  /** Language chosen for this account. */
  locale?: "en" | "de" | null
  /** Finished practice skills. Separate from reward points. */
  practice?: PracticeLog
  /** Usual wake time and bedtime, HH:MM. Reminders use these. */
  sleepClock?: SleepClock | null
}

export type DriverResult = {
  key: DriverKey
  label: string
  score: number
  weight: number
  note: string
}

export type ModelResult = {
  drivers: DriverResult[]
  behaviorScore: number
  longevityScore: number
  biologicalAge: number
  ageDelta: number
  confidence: number
  confidenceLabel: string
  flags: string[]
}
