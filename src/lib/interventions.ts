import { assess } from "./score"
import type { DriverKey, Inputs, ModelResult, Sex } from "./types"

export type Recommendation = {
  id: string
  driver: DriverKey
  title: string
  detail: string
  cadence: string
  points: number
  years: number
}

type Action = {
  id: string
  driver: DriverKey
  title: string
  detail: string
  cadence: string
  when: (inputs: Inputs) => boolean
  apply: (inputs: Inputs) => Inputs
}

const ACTIONS: Action[] = [
  {
    id: "sleep-window",
    driver: "sleep",
    title: "Hold a 7.5-hour sleep window",
    detail: "Set the wake time first, count back 7.5 hours, and stop caffeine eight hours before lights out.",
    cadence: "Every night this week",
    when: (inputs) => inputs.sleepHours < 7.2,
    apply: (inputs) => ({ ...inputs, sleepHours: Math.max(inputs.sleepHours, 7.5) }),
  },
  {
    id: "sleep-anchor",
    driver: "sleep",
    title: "Anchor wake time within 30 minutes",
    detail: "Keep the same wake time on weekends. Morning light in the first hour does more for consistency than a later bedtime.",
    cadence: "Seven mornings",
    when: (inputs) => inputs.sleepConsistency < 7,
    apply: (inputs) => ({ ...inputs, sleepConsistency: Math.max(inputs.sleepConsistency, 8) }),
  },
  {
    id: "sleep-long",
    driver: "sleep",
    title: "Shorten time in bed",
    detail: "More than nine hours in bed often fragments sleep. A fixed wake time beats trying to sleep longer.",
    cadence: "This week",
    when: (inputs) => inputs.sleepHours > 9.2,
    apply: (inputs) => ({ ...inputs, sleepHours: 8.2 }),
  },
  {
    id: "hrv-downshift",
    driver: "hrv",
    title: "Ten quiet minutes before bed",
    detail: "Nasal breathing, about four seconds in and six seconds out. This is a downshift, not a workout.",
    cadence: "Five evenings",
    when: (inputs) => inputs.hrv < 55 && inputs.stress >= 4,
    apply: (inputs) => ({
      ...inputs,
      hrv: inputs.hrv + 6,
      stress: Math.max(0, inputs.stress - 0.8),
    }),
  },
  {
    id: "zone2",
    driver: "activity",
    title: "Two easy-cardio sessions of 40 minutes",
    detail: "Conversation pace. You should be able to talk in full sentences. Nasal breathing is a useful governor if it is available to you.",
    cadence: "This week",
    when: (inputs) => inputs.zone2Minutes < 120,
    apply: (inputs) => ({ ...inputs, zone2Minutes: Math.max(inputs.zone2Minutes, 150), restingHr: Math.max(48, inputs.restingHr - 2) }),
  },
  {
    id: "steps-walk",
    driver: "activity",
    title: "A 20-minute walk after your largest meal",
    detail: "Add it four days this week. The point is the walk, not a step target on the watch.",
    cadence: "Four days",
    when: (inputs) => inputs.steps < 8000,
    apply: (inputs) => ({ ...inputs, steps: inputs.steps + 2200 }),
  },
  {
    id: "strength",
    driver: "activity",
    title: "Two short strength sessions",
    detail: "Squat pattern, hinge, push, pull. Thirty to forty minutes is enough. Leave a day between them.",
    cadence: "Twice this week",
    when: (inputs) => inputs.strengthSessions < 2,
    apply: (inputs) => ({ ...inputs, strengthSessions: 2 }),
  },
  {
    id: "protein",
    driver: "nutrition",
    title: "Put a palm of protein on each meal",
    detail: "Eggs, fish, yogurt, tofu, meat, or a shake. Spread it across the day rather than loading dinner.",
    cadence: "This week",
    when: (inputs) => inputs.protein < 7,
    apply: (inputs) => ({ ...inputs, protein: Math.max(inputs.protein, 8) }),
  },
  {
    id: "fiber",
    driver: "nutrition",
    title: "Add one cup of beans, lentils, or oats",
    detail: "Once a day. If your gut is unused to fiber, start with half a cup and drink water with it.",
    cadence: "Daily",
    when: (inputs) => inputs.fiber < 7,
    apply: (inputs) => ({ ...inputs, fiber: Math.max(inputs.fiber, 8) }),
  },
  {
    id: "alcohol",
    driver: "nutrition",
    title: "Cap alcohol at four drinks this week",
    detail: "Sleep and heart-rate variability usually notice within a few nights. This is an experiment, not a rule for life.",
    cadence: "This week",
    when: (inputs) => inputs.alcoholPerWeek > 4,
    apply: (inputs) => ({ ...inputs, alcoholPerWeek: 3, sleepHours: Math.min(9, inputs.sleepHours + 0.2) }),
  },
  {
    id: "sugar",
    driver: "nutrition",
    title: "Swap the sweetest daily drink",
    detail: "Water, sparkling water, or unsweetened tea in place of the one drink you have every day.",
    cadence: "Daily",
    when: (inputs) => inputs.addedSugar > 5,
    apply: (inputs) => ({ ...inputs, addedSugar: Math.max(0, inputs.addedSugar - 3) }),
  },
  {
    id: "stress-walk",
    driver: "stress",
    title: "A 20-minute walk with the phone left behind",
    detail: "Four days. No podcast. The load score moves when the nervous system actually gets a quiet input, not another productive one.",
    cadence: "Four days",
    when: (inputs) => inputs.stress >= 6,
    apply: (inputs) => ({ ...inputs, stress: Math.max(0, inputs.stress - 1.6), hrv: inputs.hrv + 3 }),
  },
  {
    id: "shutdown",
    driver: "stress",
    title: "A five-minute shutdown at the end of work",
    detail: "Write the first task for tomorrow, close the laptop, and leave the room. Short on purpose so it survives a bad week.",
    cadence: "Each workday",
    when: (inputs) => inputs.stress >= 4 && inputs.stress < 6,
    apply: (inputs) => ({ ...inputs, stress: Math.max(0, inputs.stress - 1) }),
  },
]

export function recommendations(args: {
  age: number
  sex: Sex
  inputs: Inputs
  loggedDays: number
}): Recommendation[] {
  const base = assess({ ...args })
  const ranked = ACTIONS.filter((action) => action.when(args.inputs))
    .map((action) => {
      const next = assess({ ...args, inputs: action.apply(args.inputs) })
      return {
        id: action.id,
        driver: action.driver,
        title: action.title,
        detail: action.detail,
        cadence: action.cadence,
        points: next.longevityScore - base.longevityScore,
        years: base.biologicalAge - next.biologicalAge,
      }
    })
    .filter((item) => item.points >= 0.35)
    .sort((a, b) => b.points - a.points)
  return ranked
}

export function movementBetween(older: ModelResult, newer: ModelResult): { key: DriverKey; label: string; points: number }[] {
  return newer.drivers
    .map((driver) => {
      const previous = older.drivers.find((item) => item.key === driver.key)
      const points = (driver.score - (previous?.score ?? driver.score)) * driver.weight
      return { key: driver.key, label: driver.label, points }
    })
    .filter((item) => Math.abs(item.points) >= 0.15)
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
}
