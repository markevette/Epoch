import { DEMO_HEIGHT_CM, DEMO_WEIGHT_KG, normalizeBody } from "./body"
import { buildHistory, historySeed } from "./history"
import type { Inputs, Profile, Sex } from "./types"

export const GOALS = [
  "Sleep that holds",
  "Metabolic health",
  "Strength",
  "A calmer nervous system",
  "A longer healthspan",
] as const

export const AVERY_INPUTS: Inputs = {
  sleepHours: 7.1,
  sleepConsistency: 6,
  hrv: 48,
  restingHr: 58,
  steps: 8600,
  zone2Minutes: 110,
  strengthSessions: 2,
  protein: 6,
  fiber: 5,
  alcoholPerWeek: 5,
  addedSugar: 4,
  stress: 6,
}

export function createProfile(args: {
  name: string
  handle: string
  age: number
  sex: Sex
  heightCm?: number
  weightKg?: number
  goals: string[]
  inputs: Inputs
  leaderboard?: boolean
  trend?: Profile["trend"]
  demo?: boolean
  today?: Date
}): Profile {
  const today = args.today ?? new Date()
  const id = `file-${args.handle}-${Math.round(args.age)}`
  return {
    id,
    name: args.name,
    handle: args.handle,
    age: args.age,
    sex: args.sex,
    ...normalizeBody(args.heightCm, args.weightKg, args.demo ?? false),
    goals: args.goals,
    inputs: args.inputs,
    leaderboard: args.leaderboard ?? false,
    history: buildHistory({
      inputs: args.inputs,
      days: 30,
      seed: historySeed(args.handle, args.age),
      trend: args.trend ?? "flat",
      end: today,
    }),
    savedOffers: [],
    trend: args.trend ?? "flat",
    createdAt: today.toISOString(),
    demo: args.demo ?? false,
    rewards: [],
    rewardClockOffset: null,
    meals: [],
    workouts: [],
  }
}

export function averyProfile(today = new Date()): Profile {
  return createProfile({
    name: "Avery Chen",
    handle: "avery",
    age: 38,
    sex: "female",
    heightCm: DEMO_HEIGHT_CM,
    weightKg: DEMO_WEIGHT_KG,
    goals: ["Sleep that holds", "A longer healthspan"],
    inputs: AVERY_INPUTS,
    leaderboard: true,
    trend: "improving",
    demo: true,
    today,
  })
}

export const STARTER_INPUTS: Inputs = {
  sleepHours: 6.8,
  sleepConsistency: 5,
  hrv: 42,
  restingHr: 64,
  steps: 6500,
  zone2Minutes: 60,
  strengthSessions: 1,
  protein: 5,
  fiber: 4,
  alcoholPerWeek: 4,
  addedSugar: 5,
  stress: 6,
}
