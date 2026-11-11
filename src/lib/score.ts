import type {
  DriverKey,
  DriverResult,
  Inputs,
  ModelResult,
  Sex,
} from "./types"

export const NEUTRAL_SCORE = 70
export const BEHAVIOR_YEARS_PER_POINT = 0.08

export const WEIGHTS: Record<DriverKey, number> = {
  sleep: 0.22,
  hrv: 0.18,
  restingHr: 0.12,
  activity: 0.18,
  nutrition: 0.15,
  stress: 0.15,
}

export const DRIVER_LABELS: Record<DriverKey, string> = {
  sleep: "Sleep",
  hrv: "Heart-rate variability",
  restingHr: "Resting heart rate",
  activity: "Activity",
  nutrition: "Nutrition",
  stress: "Stress load",
}


export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

export function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
}

export function sleepDurationScore(hours: number): number {
  const h = clamp(hours, 0, 14)
  if (h >= 7 && h <= 8.5) {
    return clamp(100 - Math.abs(h - 7.6) * 8, 0, 100)
  }
  if (h < 7) {
    return clamp(95 - (7 - h) * 24, 8, 95)
  }
  return clamp(92 - (h - 8.5) * 12, 40, 92)
}

export function sleepScore(inputs: Inputs): number {
  const duration = sleepDurationScore(inputs.sleepHours)
  const consistency = clamp(inputs.sleepConsistency, 0, 10) * 10
  return clamp(duration * 0.68 + consistency * 0.32, 0, 100)
}

/** Age-adjusted RMSSD target in milliseconds. Directional wellness anchor, not a clinical norm. */
export function hrvTarget(age: number): number {
  const years = clamp(age, 18, 90)
  return 66 * Math.exp(-0.014 * (years - 25))
}

export function hrvScore(hrv: number, age: number): number {
  const target = hrvTarget(age)
  const ratio = clamp(hrv, 0, 200) / target
  return clamp(100 * (1 - Math.exp(-ratio * 1.9)), 0, 100)
}

export function restingHrScore(rhr: number, sex: Sex): number {
  const adjusted = sex === "female" ? rhr - 4 : sex === "other" ? rhr - 2 : rhr
  const hr = clamp(adjusted, 30, 140)
  if (hr < 42) return 72
  if (hr <= 52) return lerp(hr, 42, 52, 88, 100)
  if (hr <= 62) return lerp(hr, 52, 62, 100, 90)
  if (hr <= 75) return lerp(hr, 62, 75, 90, 58)
  if (hr <= 90) return lerp(hr, 75, 90, 58, 28)
  return clamp(28 - (hr - 90) * 1.2, 8, 28)
}

export function stepsScore(steps: number): number {
  return clamp(100 * (1 - Math.exp(-clamp(steps, 0, 40000) / 4200)), 0, 100)
}

export function zone2Score(minutes: number): number {
  return clamp(12 + 88 * (1 - Math.exp(-clamp(minutes, 0, 600) / 100)), 0, 100)
}

export function strengthScore(sessions: number): number {
  const n = clamp(sessions, 0, 14)
  if (n <= 0) return 18
  if (n < 2) return lerp(n, 0, 2, 18, 76)
  if (n <= 4) return lerp(n, 2, 4, 76, 96)
  return clamp(96 - (n - 4) * 8, 60, 96)
}

export function activityScore(inputs: Inputs): number {
  return clamp(
    stepsScore(inputs.steps) * 0.42 +
      zone2Score(inputs.zone2Minutes) * 0.36 +
      strengthScore(inputs.strengthSessions) * 0.22,
    0,
    100
  )
}

export function alcoholScore(drinks: number): number {
  const d = clamp(drinks, 0, 40)
  if (d <= 2) return 100 - d * 5
  if (d <= 7) return 90 - (d - 2) * 8
  return clamp(50 - (d - 7) * 6, 6, 50)
}

export function sugarScore(frequency: number): number {
  return clamp(100 - clamp(frequency, 0, 10) * 8.5, 0, 100)
}

export function nutritionScore(inputs: Inputs): number {
  const protein = clamp(inputs.protein, 0, 10) * 10
  const fiber = clamp(inputs.fiber, 0, 10) * 10
  return clamp(
    protein * 0.34 + fiber * 0.28 + alcoholScore(inputs.alcoholPerWeek) * 0.22 + sugarScore(inputs.addedSugar) * 0.16,
    0,
    100
  )
}

export function stressScore(stress: number): number {
  const x = clamp(stress, 0, 10) / 10
  return clamp(100 * (1 - Math.pow(x, 1.15)), 0, 100)
}

function driverNote(key: DriverKey, inputs: Inputs, age: number): string {
  switch (key) {
    case "sleep":
      return `${inputs.sleepHours.toFixed(1)} h · consistency ${inputs.sleepConsistency.toFixed(0)}/10`
    case "hrv":
      return `${Math.round(inputs.hrv)} ms · target near ${Math.round(hrvTarget(age))} ms at age ${Math.round(age)}`
    case "restingHr":
      return `${Math.round(inputs.restingHr)} bpm`
    case "activity":
      return `${Math.round(inputs.steps).toLocaleString("en-GB")} steps · ${Math.round(inputs.zone2Minutes)} min easy cardio · ${inputs.strengthSessions.toFixed(0)} strength`
    case "nutrition":
      return `Protein ${inputs.protein.toFixed(0)}/10 · fiber ${inputs.fiber.toFixed(0)}/10 · ${inputs.alcoholPerWeek.toFixed(0)} drinks`
    case "stress":
      return `Perceived load ${inputs.stress.toFixed(1)}/10`
  }
}

export function driverScores(inputs: Inputs, age: number, sex: Sex): Record<DriverKey, number> {
  return {
    sleep: sleepScore(inputs),
    hrv: hrvScore(inputs.hrv, age),
    restingHr: restingHrScore(inputs.restingHr, sex),
    activity: activityScore(inputs),
    nutrition: nutritionScore(inputs),
    stress: stressScore(inputs.stress),
  }
}

export function confidenceScore(loggedDays: number): number {
  const days = clamp(loggedDays, 0, 21)
  return clamp(0.4 + days * 0.012, 0.35, 0.88)
}

export function confidenceLabel(confidence: number): string {
  if (confidence < 0.5) return "Limited file"
  if (confidence < 0.7) return "Growing file"
  return "Substantial file"
}

function safetyFlags(inputs: Inputs): string[] {
  const flags: string[] = []
  if (inputs.sleepHours < 5) {
    flags.push("Under five hours of sleep is more than a coaching problem. If this is typical, talk to a clinician.")
  }
  if (inputs.restingHr >= 95) {
    flags.push("Resting heart rate is high enough to mention to a clinician, especially if it is new.")
  }
  if (inputs.restingHr > 0 && inputs.restingHr < 42) {
    flags.push("Resting heart rate is very low. Athletes see this; so do some medical conditions. This model cannot tell them apart.")
  }
  return flags
}

export function assess(args: {
  age: number
  sex: Sex
  inputs: Inputs
  loggedDays: number
}): ModelResult {
  const age = clamp(args.age, 18, 90)
  const scores = driverScores(args.inputs, age, args.sex)
  const drivers: DriverResult[] = (Object.keys(WEIGHTS) as DriverKey[]).map((key) => ({
    key,
    label: DRIVER_LABELS[key],
    score: scores[key],
    weight: WEIGHTS[key],
    note: driverNote(key, args.inputs, age),
  }))
  const behaviorScore = drivers.reduce((sum, driver) => sum + driver.score * driver.weight, 0)
  const longevityScore = clamp(behaviorScore, 0, 100)
  const ageDelta = clamp((NEUTRAL_SCORE - behaviorScore) * BEHAVIOR_YEARS_PER_POINT, -8, 8)
  const confidence = confidenceScore(args.loggedDays)
  return {
    drivers,
    behaviorScore,
    longevityScore,
    biologicalAge: age + ageDelta,
    ageDelta,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    flags: safetyFlags(args.inputs),
  }
}

export function loggedDayCount(history: { source: string }[]): number {
  return history.filter((day) => day.source === "logged").length
}
