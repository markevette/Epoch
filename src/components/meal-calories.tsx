"use client"

import { useEffect, useState } from "react"
import { useHealth } from "@/components/health-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { mealText, pick } from "@/lib/copy"
import { DAY_START, MORNING_START, NIGHT_START } from "@/lib/daypart"
import { formatLongDate } from "@/lib/format"
import type { Locale } from "@/lib/locale"
import {
  MEAL_KCAL_MAX,
  MEAL_LABEL,
  MEAL_ORDER,
  foodDay,
  mealsDue,
  type MealDay,
  type MealName,
} from "@/lib/meals"

function parseKcal(raw: string): number | null | "invalid" {
  const trimmed = raw.trim()
  if (trimmed === "") return null
  if (!/^\d+$/.test(trimmed)) return "invalid"
  const value = Number(trimmed)
  if (value > MEAL_KCAL_MAX) return "invalid"
  return value
}

function fieldText(value: number | null | undefined): string {
  return value == null ? "" : String(value)
}

function reachedLine(now: Date, locale: Locale): string {
  const hour = now.getHours()
  if (hour < MORNING_START) {
    return pick(locale, "This is still yesterday’s food day, so dinner stays on the card. A new breakfast opens at 05:00.", "Das ist noch der Esstag von gestern, also bleibt das Abendessen auf der Karte. Ein neues Frühstück öffnet um 05:00.")
  }
  if (hour < DAY_START) return pick(locale, "Lunch joins at 12:00. Dinner joins at 18:00.", "Mittagessen kommt um 12:00 dazu. Abendessen um 18:00.")
  if (hour < NIGHT_START) return pick(locale, "Dinner joins at 18:00.", "Abendessen kommt um 18:00 dazu.")
  return pick(locale, "Dinner is on the card because the evening has started. Use 0 if it has not happened.", "Abendessen liegt auf der Karte, weil der Abend begonnen hat. Nimm 0, wenn es noch nicht stattfand.")
}

export function MealCalories({
  meals,
  onSave,
}: {
  meals: MealDay[]
  onSave: (day: MealDay) => Promise<boolean>
}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const date = foodDay(now)
  const due = mealsDue(now)
  return <MealForm key={`${date}:${due.join("-")}`} now={now} date={date} due={due} meals={meals} onSave={onSave} />
}

function MealForm({
  now,
  date,
  due,
  meals,
  onSave,
}: {
  now: Date
  date: string
  due: MealName[]
  meals: MealDay[]
  onSave: (day: MealDay) => Promise<boolean>
}) {
  const { locale } = useHealth()
  const stored = meals.find((day) => day.date === date) ?? null
  const [draft, setDraft] = useState<Record<MealName, string>>(() => ({
    breakfast: fieldText(stored?.breakfast),
    lunch: fieldText(stored?.lunch),
    dinner: fieldText(stored?.dinner),
  }))
  const [pending, setPending] = useState(false)
  const parsed = Object.fromEntries(MEAL_ORDER.map((meal) => [meal, parseKcal(draft[meal])])) as Record<MealName, number | null | "invalid">
  const invalid = due.some((meal) => parsed[meal] === "invalid")
  const changed = due.some((meal) => {
    const next = parsed[meal]
    return typeof next === "number" && next !== stored?.[meal]
  })
  const logged = due.filter((meal) => stored?.[meal] != null)
  const total = logged.reduce((sum, meal) => sum + (stored?.[meal] ?? 0), 0)

  async function save() {
    if (pending || invalid || !changed) return
    const day: MealDay = {
      date,
      breakfast: stored?.breakfast ?? null,
      lunch: stored?.lunch ?? null,
      dinner: stored?.dinner ?? null,
    }
    for (const meal of due) {
      const value = parsed[meal]
      if (typeof value === "number") day[meal] = value
    }
    setPending(true)
    await onSave(day)
    setPending(false)
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Meals", "Mahlzeiten")}</p>
      <h2 className="mt-1 font-display text-3xl tracking-tight">{formatLongDate(date, locale)}</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        {pick(locale, "Calories for each meal this clock has already reached. Zero is a real answer.", "Kalorien für jede Mahlzeit, die diese Uhr schon erreicht hat. Null ist eine echte Antwort.")} {reachedLine(now, locale)}
      </p>
      <div className={`mt-4 grid gap-3 ${due.length > 1 ? "sm:grid-cols-2" : ""} ${due.length > 2 ? "lg:grid-cols-3" : ""}`}>
        {due.map((meal) => (
          <label key={meal} className="rounded-xl border border-border p-3">
            <span className="text-sm font-medium">{mealText(locale, meal)}</span>
            <span className="mt-2 flex items-center gap-2">
              <Input
                className="h-10 tabular"
                type="number"
                inputMode="numeric"
                min={0}
                max={MEAL_KCAL_MAX}
                step={1}
                value={draft[meal]}
                aria-label={pick(locale, `${MEAL_LABEL[meal]} calories`, `${mealText(locale, meal)} Kalorien`)}
                aria-invalid={parsed[meal] === "invalid"}
                onChange={(event) => setDraft((current) => ({ ...current, [meal]: event.target.value }))}
              />
              <span className="text-sm text-muted-foreground">kcal</span>
            </span>
          </label>
        ))}
      </div>
      {invalid ? <p className="mt-3 text-sm text-copper">{pick(locale, `Use a whole number from 0 to ${MEAL_KCAL_MAX.toLocaleString("en-GB")}.`, `Nimm eine ganze Zahl von 0 bis ${MEAL_KCAL_MAX.toLocaleString("de-DE")}.`)}</p> : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {logged.length > 0
            ? pick(
                locale,
                `${logged.map((meal) => `${MEAL_LABEL[meal]} ${(stored?.[meal] ?? 0).toLocaleString("en-GB")} kcal`).join(", ")}. ${total.toLocaleString("en-GB")} kcal on the file.`,
                `${logged.map((meal) => `${mealText(locale, meal)} ${(stored?.[meal] ?? 0).toLocaleString("de-DE")} kcal`).join(", ")}. ${total.toLocaleString("de-DE")} kcal auf der Akte.`,
              )
            : pick(locale, "Nothing from these meals is on the file yet.", "Von diesen Mahlzeiten liegt noch nichts auf der Akte.")}
        </p>
        <Button className="h-10" disabled={pending || invalid || !changed} onClick={() => void save()}>
          {pick(locale, "Save meals", "Mahlzeiten speichern")}
        </Button>
      </div>
    </section>
  )
}
