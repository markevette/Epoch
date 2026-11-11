"use client"

import { useState } from "react"
import { useHealth } from "@/components/health-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { pick } from "@/lib/copy"
import { MORNING_START } from "@/lib/daypart"
import { formatLongDate } from "@/lib/format"
import { foodDay } from "@/lib/meals"
import { WORKOUT_KCAL_MAX, type WorkoutDay } from "@/lib/workouts"

function parseKcal(raw: string): number | null | "invalid" {
  const trimmed = raw.trim()
  if (trimmed === "") return null
  if (!/^\d+$/.test(trimmed)) return "invalid"
  const value = Number(trimmed)
  if (value > WORKOUT_KCAL_MAX) return "invalid"
  return value
}

export function WorkoutToday({
  workouts,
  onSave,
}: {
  workouts: WorkoutDay[]
  onSave: (day: WorkoutDay) => Promise<boolean>
}) {
  const { locale } = useHealth()
  const now = new Date()
  const date = foodDay(now)
  const stored = workouts.find((day) => day.date === date) ?? null
  const [answer, setAnswer] = useState<boolean | null>(stored ? stored.workedOut : null)
  const [kcal, setKcal] = useState(stored?.workedOut ? String(stored.kcal) : "")
  const [pending, setPending] = useState(false)
  const parsed = parseKcal(kcal)
  const invalid = answer === true && parsed === "invalid"
  const nextKcal = answer === false ? 0 : parsed
  const changed =
    answer != null &&
    typeof nextKcal === "number" &&
    (stored == null || stored.workedOut !== answer || stored.kcal !== nextKcal)
  const ready = answer === false || (answer === true && typeof parsed === "number")

  async function save() {
    if (pending || !ready || !changed || answer == null || typeof nextKcal !== "number") return
    setPending(true)
    await onSave({ date, workedOut: answer, kcal: nextKcal })
    setPending(false)
  }

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-5">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Workout", "Training")}</p>
      <h2 className="mt-1 font-display text-3xl tracking-tight">{pick(locale, "Did you work out today?", "Hast du heute trainiert?")}</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        {pick(locale, "Yes asks for the kcal burned. No stores 0. The number goes on the share card and stays out of biological age.", "Ja fragt nach den verbrannten kcal. Nein speichert 0. Die Zahl geht auf die Teilkarte und bleibt aus dem biologischen Alter.")}
        {now.getHours() < MORNING_START ? pick(locale, " This is still yesterday’s workout, until 05:00.", " Das ist noch das Training von gestern, bis 05:00.") : ""}
      </p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={pick(locale, "Did you work out today?", "Hast du heute trainiert?")}>
        <Button className="h-10" variant={answer === true ? "default" : "outline"} aria-pressed={answer === true} disabled={pending} onClick={() => setAnswer(true)}>
          {pick(locale, "Yes", "Ja")}
        </Button>
        <Button className="h-10" variant={answer === false ? "default" : "outline"} aria-pressed={answer === false} disabled={pending} onClick={() => setAnswer(false)}>
          {pick(locale, "No", "Nein")}
        </Button>
      </div>
      {answer === true ? (
        <label className="mt-4 block max-w-xs">
          <span className="text-sm font-medium">{pick(locale, "kcal burned", "kcal verbrannt")}</span>
          <span className="mt-2 flex items-center gap-2">
            <Input
              className="h-10 tabular"
              type="number"
              inputMode="numeric"
              min={0}
              max={WORKOUT_KCAL_MAX}
              step={1}
              value={kcal}
              aria-label={pick(locale, "Kilocalories burned", "Verbrannte Kilokalorien")}
              aria-invalid={invalid}
              onChange={(event) => setKcal(event.target.value)}
            />
            <span className="text-sm text-muted-foreground">kcal</span>
          </span>
        </label>
      ) : null}
      {invalid ? <p className="mt-3 text-sm text-copper">{pick(locale, `Use a whole number from 0 to ${WORKOUT_KCAL_MAX.toLocaleString("en-GB")}.`, `Nimm eine ganze Zahl von 0 bis ${WORKOUT_KCAL_MAX.toLocaleString("de-DE")}.`)}</p> : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {stored
            ? stored.workedOut
              ? pick(locale, `${stored.kcal.toLocaleString("en-GB")} kcal burned, on the file for ${formatLongDate(date, locale)}.`, `${stored.kcal.toLocaleString("de-DE")} kcal verbrannt, auf der Akte für ${formatLongDate(date, locale)}.`)
              : pick(locale, `No workout. 0 kcal burned, on the file for ${formatLongDate(date, locale)}.`, `Kein Training. 0 kcal verbrannt, auf der Akte für ${formatLongDate(date, locale)}.`)
            : pick(locale, "No answer is on the file yet.", "Auf der Akte liegt noch keine Antwort.")}
        </p>
        <Button className="h-10" disabled={pending || invalid || !ready || !changed} onClick={() => void save()}>
          {pick(locale, "Save workout", "Training speichern")}
        </Button>
      </div>
    </section>
  )
}
