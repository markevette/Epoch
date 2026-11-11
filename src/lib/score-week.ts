import { addDays, isoDate, parseIsoDate } from "./format"
import { assess, loggedDayCount } from "./score"
import type { Profile } from "./types"

export const SCORE_NUDGE_POINTS = 2
export const WEEK_DAYS = 7

export type ScoreTone = "up" | "down" | "flat"

export type ScoreDay = {
  date: string
  score: number
}

export type NudgeOption = {
  id: string
  text: string
}

const NUDGES: Record<ScoreTone, NudgeOption[]> = {
  down: [
    { id: "down-how", text: "The week dipped. How are you doing?" },
    { id: "down-holding", text: "Scores turned down. How are you holding up?" },
    { id: "down-week", text: "A quieter week. Want to say how it went?" },
  ],
  up: [
    { id: "up-keep", text: "The week is climbing. Keep going." },
    { id: "up-earned", text: "That rise looks earned. Nice week." },
    { id: "up-cheer", text: "Scores are up. Cheering the next one." },
  ],
  flat: [
    { id: "flat-steady", text: "The week held steady. Still here." },
    { id: "flat-pace", text: "Same pace as the start of the week. That counts." },
  ],
}

export function lastWeekScores(profile: Profile, today = new Date()): ScoreDay[] {
  const end = isoDate(today)
  const start = isoDate(addDays(parseIsoDate(end), -(WEEK_DAYS - 1)))
  const loggedDays = loggedDayCount(profile.history)
  return profile.history
    .filter((day) => day.date >= start && day.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({
      date: day.date,
      score: assess({
        age: profile.age,
        sex: profile.sex,
        inputs: day.inputs,
        loggedDays,
      }).longevityScore,
    }))
}

/** Rising, falling, or steady across the week that is on the graph. */
export function scoreTone(days: ScoreDay[]): ScoreTone {
  if (days.length < 2) return "flat"
  const delta = days[days.length - 1].score - days[0].score
  if (delta >= 2) return "up"
  if (delta <= -2) return "down"
  return "flat"
}

export function toneLine(tone: ScoreTone): string {
  if (tone === "up") return "Their week is climbing."
  if (tone === "down") return "Their week turned down."
  return "Their week held steady."
}

export function nudgeOptions(tone: ScoreTone): NudgeOption[] {
  return NUDGES[tone]
}

export function nudgeById(id: string): { tone: ScoreTone; text: string } | null {
  for (const tone of Object.keys(NUDGES) as ScoreTone[]) {
    const match = NUDGES[tone].find((option) => option.id === id)
    if (match) return { tone, text: match.text }
  }
  return null
}
