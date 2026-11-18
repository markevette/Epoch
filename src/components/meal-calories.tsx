"use client"

import { useEffect, useState } from "react"
import { useHealth } from "@/components/health-provider"
import { Button } from "@/components/ui/button"
import { mealText, pick } from "@/lib/copy"
import { DAY_START, MORNING_START, NIGHT_START } from "@/lib/daypart"
import {
  FOOD_GROUPS,
  MEAL_COUNT_MAX,
  MEAL_LINE_MAX,
  foodAllows,
  foodName,
  foodsIn,
  mealEstimate,
  portionName,
  type MealLine,
} from "@/lib/foods"
import { formatLongDate } from "@/lib/format"
import type { Locale } from "@/lib/locale"
import { MEAL_KCAL_MAX, foodDay, linesOn, mealLineKey, mealsDue, type MealDay, type MealName } from "@/lib/meals"

function reachedLine(now: Date, locale: Locale): string {
  const hour = now.getHours()
  if (hour < MORNING_START) {
    return pick(locale, "This is still yesterday’s food day, so dinner stays on the card. A new breakfast opens at 05:00.", "Das ist noch der Esstag von gestern, also bleibt das Abendessen auf der Karte. Ein neues Frühstück öffnet um 05:00.")
  }
  if (hour < DAY_START) return pick(locale, "Lunch joins at 12:00. Dinner joins at 18:00.", "Mittagessen kommt um 12:00 dazu. Abendessen um 18:00.")
  if (hour < NIGHT_START) return pick(locale, "Dinner joins at 18:00.", "Abendessen kommt um 18:00 dazu.")
  return pick(locale, "Dinner is on the card because the evening has started. Use nothing eaten if it has not happened.", "Abendessen liegt auf der Karte, weil der Abend begonnen hat. Nimm nichts gegessen, wenn es noch nicht stattfand.")
}

type Draft = { lines: MealLine[]; plain: number | null }

function readDraft(stored: MealDay | null, meal: MealName): Draft {
  const lines = linesOn(stored, meal)
  if (lines.length) return { lines, plain: null }
  const plain = stored?.[meal]
  return { lines: [], plain: plain == null ? null : plain }
}

function sameDraft(left: Draft, right: Draft): boolean {
  return left.plain === right.plain && JSON.stringify(left.lines) === JSON.stringify(right.lines)
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
  const [drafts, setDrafts] = useState<Record<MealName, Draft>>(() => ({
    breakfast: readDraft(stored, "breakfast"),
    lunch: readDraft(stored, "lunch"),
    dinner: readDraft(stored, "dinner"),
  }))
  const [open, setOpen] = useState<MealName | null>(null)
  const [pending, setPending] = useState(false)
  const changed = due.some((meal) => !sameDraft(drafts[meal], readDraft(stored, meal)))
  const over = due.some((meal) => mealEstimate(drafts[meal].lines) > MEAL_KCAL_MAX)

  function update(meal: MealName, next: Draft) {
    setDrafts((current) => ({ ...current, [meal]: next }))
  }

  function toggleFood(meal: MealName, food: string, flag: "milky" | "honey" | "sugar") {
    setDrafts((current) => {
      const draft = current[meal]
      return {
        ...current,
        [meal]: { plain: null, lines: draft.lines.map((line) => (line.food === food ? toggleFlag(line, flag) : line)) },
      }
    })
  }

  function addFood(meal: MealName, id: string) {
    const draft = drafts[meal]
    const existing = draft.lines.find((line) => line.food === id)
    if (existing) {
      if (existing.count >= MEAL_COUNT_MAX) return
      update(meal, {
        plain: null,
        lines: draft.lines.map((line) => (line.food === id ? { ...line, count: line.count + 1 } : line)),
      })
      return
    }
    if (draft.lines.length >= MEAL_LINE_MAX) return
    update(meal, { plain: null, lines: [...draft.lines, { food: id, count: 1 }] })
  }

  async function save() {
    if (pending || !changed || over) return
    const day: MealDay = { date, breakfast: null, lunch: null, dinner: null }
    for (const meal of due) {
      const draft = drafts[meal]
      const key = mealLineKey(meal)
      if (draft.lines.length) {
        day[meal] = mealEstimate(draft.lines)
        day[key] = draft.lines
      } else if (draft.plain != null) {
        day[meal] = draft.plain
        day[key] = []
      }
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
        {pick(
          locale,
          "Name what you ate. The usual portion is already filled in, and an estimate appears on its own.",
          "Nenne, was du gegessen hast. Die übliche Portion ist schon eingetragen, und eine Schätzung erscheint von selbst.",
        )}{" "}
        {reachedLine(now, locale)}
      </p>
      <div className="mt-4 grid gap-4">
        {due.map((meal) => (
          <MealCard
            key={meal}
            meal={meal}
            draft={drafts[meal]}
            locale={locale}
            choosing={open === meal}
            onToggle={() => setOpen((current) => (current === meal ? null : meal))}
            onAdd={(id) => addFood(meal, id)}
            onChange={(next) => update(meal, next)}
            onFlag={(food, flag) => toggleFood(meal, food, flag)}
          />
        ))}
      </div>
      {over ? (
        <p className="mt-3 text-sm text-copper">
          {pick(locale, `A meal can hold up to ${MEAL_KCAL_MAX.toLocaleString("en-GB")} kcal.`, `Eine Mahlzeit kann bis zu ${MEAL_KCAL_MAX.toLocaleString("de-DE")} kcal halten.`)}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <Button className="h-10" disabled={pending || !changed || over} onClick={() => void save()}>
          {pick(locale, "Save meals", "Mahlzeiten speichern")}
        </Button>
      </div>
    </section>
  )
}

function MealCard({
  meal,
  draft,
  locale,
  choosing,
  onToggle,
  onAdd,
  onChange,
  onFlag,
}: {
  meal: MealName
  draft: Draft
  locale: Locale
  choosing: boolean
  onToggle: () => void
  onAdd: (id: string) => void
  onChange: (next: Draft) => void
  onFlag: (food: string, flag: "milky" | "honey" | "sugar") => void
}) {
  const estimate = mealEstimate(draft.lines)
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-2xl tracking-tight">{mealText(locale, meal)}</h3>
        {draft.lines.length > 0 ? (
          <p className="text-sm text-muted-foreground tabular" aria-live="polite">
            {pick(locale, `About ${estimate.toLocaleString("en-GB")} kcal`, `Etwa ${estimate.toLocaleString("de-DE")} kcal`)}
          </p>
        ) : null}
      </div>
      {draft.lines.length === 0 && draft.plain === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{pick(locale, "Nothing eaten.", "Nichts gegessen.")}</p>
      ) : null}
      {draft.lines.length === 0 && draft.plain != null && draft.plain > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {pick(
            locale,
            `About ${draft.plain.toLocaleString("en-GB")} kcal is already on this meal.`,
            `Etwa ${draft.plain.toLocaleString("de-DE")} kcal liegen schon auf dieser Mahlzeit.`,
          )}
        </p>
      ) : null}
      <div className="mt-3 grid gap-2">
        {draft.lines.map((line) => (
          <FoodLine key={line.food} line={line} locale={locale} onFlag={(flag) => onFlag(line.food, flag)} onChange={(next) => onChange({ plain: null, lines: replaceLine(draft.lines, next) })} onRemove={() => onChange({ plain: null, lines: draft.lines.filter((item) => item.food !== line.food) })} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded-full border border-border px-3 py-1.5 text-sm" aria-expanded={choosing} onClick={onToggle}>
          {choosing ? pick(locale, "Hide foods", "Lebensmittel verbergen") : pick(locale, "Add something", "Etwas hinzufügen")}
        </button>
        <button
          type="button"
          className="rounded-full px-3 py-1.5 text-sm text-muted-foreground"
          onClick={() => onChange({ lines: [], plain: 0 })}
        >
          {pick(locale, "Nothing eaten", "Nichts gegessen")}
        </button>
      </div>
      {choosing ? (
        <div className="mt-3 grid gap-3">
          {FOOD_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{locale === "de" ? group.de : group.en}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {foodsIn(group.id).map((food) => (
                  <button key={food.id} type="button" className="rounded-full border border-border bg-background px-3 py-1.5 text-sm" onClick={() => onAdd(food.id)}>
                    {locale === "de" ? food.de : food.en}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function replaceLine(lines: MealLine[], next: MealLine): MealLine[] {
  return lines.map((line) => (line.food === next.food ? next : line))
}

function toggleFlag(line: MealLine, flag: "milky" | "honey" | "sugar"): MealLine {
  const next: MealLine = { ...line }
  if (next[flag]) delete next[flag]
  else next[flag] = true
  return next
}

function FoodLine({
  line,
  locale,
  onChange,
  onRemove,
  onFlag,
}: {
  line: MealLine
  locale: Locale
  onChange: (next: MealLine) => void
  onRemove: () => void
  onFlag: (flag: "milky" | "honey" | "sugar") => void
}) {
  const name = foodName(line.food, locale)
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{portionName(line.food, line.count, locale)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full border border-border text-base"
            aria-label={line.count === 1 ? pick(locale, `Remove ${name}`, `${name} entfernen`) : pick(locale, `Less ${name}`, `Weniger ${name}`)}
            onClick={() => (line.count === 1 ? onRemove() : onChange({ ...line, count: line.count - 1 }))}
          >
            −
          </button>
          <span className="w-6 text-center text-sm tabular">{line.count}</span>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full border border-border text-base disabled:opacity-40"
            aria-label={pick(locale, `More ${name}`, `Mehr ${name}`)}
            disabled={line.count >= MEAL_COUNT_MAX}
            onClick={() => onChange({ ...line, count: line.count + 1 })}
          >
            +
          </button>
        </div>
      </div>
      {foodAllows(line.food, "sweet") || foodAllows(line.food, "milky") ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {foodAllows(line.food, "milky") ? (
            <Flag label={pick(locale, "Milky", "Milchig")} on={Boolean(line.milky)} onClick={() => onFlag("milky")} />
          ) : null}
          {foodAllows(line.food, "sweet") ? (
            <>
              <Flag label={pick(locale, "Honey", "Honig")} on={Boolean(line.honey)} onClick={() => onFlag("honey")} />
              <Flag label={pick(locale, "Sugar", "Zucker")} on={Boolean(line.sugar)} onClick={() => onFlag("sugar")} />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Flag({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={on ? "rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground" : "rounded-full border border-border px-3 py-1 text-sm"}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
