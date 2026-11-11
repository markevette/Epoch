import { assess } from "./score"
import type { Inputs } from "./types"

const AGE = 38
const SEX = "female" as const

const POOR: Inputs = {
  sleepHours: 6.1,
  sleepConsistency: 4,
  hrv: 36,
  restingHr: 68,
  steps: 5200,
  zone2Minutes: 30,
  strengthSessions: 0,
  protein: 4,
  fiber: 4,
  alcoholPerWeek: 8,
  addedSugar: 7,
  stress: 7.5,
}

export type Scenario = {
  id: string
  label: string
  detail: string
  points: number
  years: number
  fromScore: number
  toScore: number
  fromAge: number
  toAge: number
}

function run(label: string, id: string, detail: string, before: Inputs, after: Inputs): Scenario {
  const from = assess({
    age: AGE,
    sex: SEX,
    inputs: before,
    loggedDays: 0,
  })
  const to = assess({
    age: AGE,
    sex: SEX,
    inputs: after,
    loggedDays: 0,
  })
  return {
    id,
    label,
    detail,
    points: to.longevityScore - from.longevityScore,
    years: from.biologicalAge - to.biologicalAge,
    fromScore: from.longevityScore,
    toScore: to.longevityScore,
    fromAge: from.biologicalAge,
    toAge: to.biologicalAge,
  }
}

export function visibilityScenarios(): Scenario[] {
  return [
    run(
      "Sleep, and nothing else",
      "sleep",
      "A 38-year-old moves from 6.1 hours and a drifting schedule to 7.5 hours with a stable wake time. Activity, food, and stress stay put.",
      POOR,
      { ...POOR, sleepHours: 7.5, sleepConsistency: 8 }
    ),
    run(
      "A full adherent month",
      "protocol",
      "Sleep, easy cardio, strength, protein, fiber, alcohol, and stress all move toward the plan. This is a good month, not a typical one.",
      POOR,
      {
        ...POOR,
        sleepHours: 7.5,
        sleepConsistency: 8,
        hrv: 44,
        restingHr: 63,
        steps: 8500,
        zone2Minutes: 140,
        strengthSessions: 2,
        protein: 7,
        fiber: 7,
        alcoholPerWeek: 3,
        addedSugar: 4,
        stress: 5,
      }
    ),
  ]
}
