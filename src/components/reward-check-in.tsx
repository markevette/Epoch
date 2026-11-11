"use client"

import { useState } from "react"
import { useHealth } from "@/components/health-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { pick } from "@/lib/copy"
import { formatLongDate, isoDate } from "@/lib/format"
import type { Locale } from "@/lib/locale"
import {
  NIGHT_NOTE_MAX,
  SLOT_HOURS,
  SLOT_POINTS,
  morningsKeptLine,
  rewardWindow,
  slotPhase,
  summarizeRewards,
  type RewardCheckIn,
  type RewardSlot,
} from "@/lib/rewards"
import type { DayRecord } from "@/lib/types"

const SLOT_LABEL: Record<Locale, Record<RewardSlot, string>> = {
  en: { morning: "Morning", day: "Day", night: "Night" },
  de: { morning: "Morgen", day: "Tag", night: "Nacht" },
}

export function RewardCheckIn({
  rewards,
  history,
  tipTitle,
  hasAction,
  actionPoints,
  extraPoints = 0,
  onClaim,
  onLogSleep,
}: {
  rewards: RewardCheckIn[]
  history: DayRecord[]
  tipTitle: string
  hasAction: boolean
  actionPoints: number
  extraPoints?: number
  onClaim: (note: string) => Promise<boolean>
  onLogSleep: () => void
}) {
  const { locale } = useHealth()
  const now = new Date()
  const window = rewardWindow(now)
  const summary = summarizeRewards(rewards, now, extraPoints)
  const logged = history.some((day) => day.date === window.date && day.source === "logged")
  const dayClaimed = rewards.some((entry) => entry.date === isoDate(now) && entry.slot === "day")
  const kept = morningsKeptLine(summary.morningsKept, locale)
  const [note, setNote] = useState("")
  const [pending, setPending] = useState(false)

  async function claim(value: string) {
    if (pending) return
    setPending(true)
    const landed = await onClaim(value)
    if (landed) setNote("")
    setPending(false)
  }

  return (
    <section id="check-ins" className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Today’s check-ins", "Check-ins von heute")}</p>
          <h2 className="mt-1 font-display text-3xl tracking-tight">{formatLongDate(window.date, locale)}</h2>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl tabular leading-none">{summary.total}</p>
          <p className="mt-1 text-xs tracking-[0.14em] text-muted-foreground uppercase">{pick(locale, "Reward points", "Belohnungspunkte")}</p>
        </div>
      </div>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        {pick(
          locale,
          "Morning, day, and night each pay once. A done action adds its own reward points to the same balance. A line on a buddy’s week adds 2 points, once a day for that buddy. Each 150 points unlocks one more buddy. They do not move the longevity score.",
          "Morgen, Tag und Nacht zahlen je einmal. Eine erledigte Handlung legt ihre eigenen Belohnungspunkte auf dasselbe Guthaben. Eine Zeile auf der Woche eines Buddies gibt 2 Punkte, einmal am Tag für diesen Buddy. Je 150 Punkte öffnen einen weiteren Buddy. Sie bewegen den Langlebigkeitswert nicht.",
        )}{" "}
        {kept ? `${kept.charAt(0).toUpperCase()}${kept.slice(1)}.` : pick(locale, "The first morning starts the count on the share card.", "Der erste Morgen startet die Zählung auf der Teilkarte.")}
      </p>
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {(["morning", "day", "night"] as RewardSlot[]).map((slot) => {
          const entry = rewards.find((item) => item.date === window.date && item.slot === slot)
          const phase = slotPhase(slot, window, Boolean(entry))
          return (
            <li key={slot} className="rounded-xl border border-border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{SLOT_LABEL[locale][slot]}</p>
                <p className="text-xs tabular text-muted-foreground">{SLOT_POINTS[slot]} {pick(locale, SLOT_POINTS[slot] === 1 ? "point" : "points", SLOT_POINTS[slot] === 1 ? "Punkt" : "Punkte")}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{SLOT_HOURS[slot]}</p>
              <div className="mt-3">
                {phase === "claimed" && entry ? <Claimed slot={slot} note={entry.note} bonus={entry.bonus} locale={locale} /> : null}
                {phase === "empty" ? <p className="text-sm text-muted-foreground">{pick(locale, "Left empty. It does not subtract points.", "Leer gelassen. Es zieht keine Punkte ab.")}</p> : null}
                {phase === "later" ? <p className="text-sm text-muted-foreground">{pick(locale, "Opens later.", "Öffnet später.")}</p> : null}
                {phase === "open" && slot === "morning" ? (
                  logged ? (
                    <Button className="h-10" disabled={pending} onClick={() => void claim("")}>
                      {pick(locale, "Confirm last night’s sleep", "Den Schlaf der letzten Nacht bestätigen")}
                    </Button>
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground">{pick(locale, "Last night’s sleep is not on the file yet.", "Der Schlaf der letzten Nacht liegt noch nicht auf der Akte.")}</p>
                      <Button className="mt-2 h-10" onClick={onLogSleep}>
                        {pick(locale, "Log last night’s sleep", "Schlaf der letzten Nacht erfassen")}
                      </Button>
                    </div>
                  )
                ) : null}
                {phase === "open" && slot === "day" ? (
                  hasAction ? (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {actionPoints > 0
                          ? pick(locale, `Done adds ${actionPoints} reward points on top of the 2 for this check-in.`, `Erledigt legt ${actionPoints} Belohnungspunkte auf die 2 für diesen Check-in.`)
                          : pick(locale, "Mark today’s one action, done or skipped.", "Markiere die eine Handlung von heute, erledigt oder ausgelassen.")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                      <Button className="h-10" disabled={pending} onClick={() => void claim("done")}>
                        {pick(locale, "Done", "Erledigt")}
                      </Button>
                      <Button variant="outline" className="h-10" disabled={pending} onClick={() => void claim("skipped")}>
                        {pick(locale, "Skipped", "Ausgelassen")}
                      </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground">{pick(locale, "No action is large enough to assign. The check-in still counts.", "Keine Handlung ist groß genug. Der Check-in zählt trotzdem.")}</p>
                      <Button className="mt-2 h-10" disabled={pending} onClick={() => void claim("unassigned")}>
                        {pick(locale, "Nothing to assign", "Nichts zuzuweisen")}
                      </Button>
                    </div>
                  )
                ) : null}
                {phase === "open" && slot === "night" ? (
                  <form
                    className="grid gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (note.trim().length === 0) return
                      void claim(note)
                    }}
                  >
                    <p className="text-sm text-muted-foreground">{pick(locale, "One line about the day, like a short journal note.", "Eine Zeile über den Tag, wie eine kurze Tagebuchnotiz.")}</p>
                    <Input
                      className="h-10"
                      value={note}
                      maxLength={NIGHT_NOTE_MAX}
                      placeholder={pick(locale, "How the day went", "Wie der Tag war")}
                      aria-label={pick(locale, "How the day went", "Wie der Tag war")}
                      onChange={(event) => setNote(event.target.value)}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs tabular text-muted-foreground">{note.trim().length}/{NIGHT_NOTE_MAX}</span>
                      <Button type="submit" className="h-10" disabled={pending || note.trim().length === 0}>
                        {pick(locale, "Save", "Speichern")}
                      </Button>
                    </div>
                  </form>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
      {(["morning", "day", "night"] as RewardSlot[]).every((slot) => rewards.some((entry) => entry.date === window.date && entry.slot === slot)) ? (
        <p className="mt-4 text-sm">{pick(locale, "All three check-ins are in. Opening again adds nothing.", "Alle drei Check-ins sind drin. Nochmal öffnen gibt nichts.")}</p>
      ) : null}
      {dayClaimed ? (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{pick(locale, "Still the note for today", "Immer noch die Notiz für heute")}</p>
          <p className="mt-1 font-display text-2xl leading-tight">{tipTitle}</p>
        </div>
      ) : null}
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        {pick(
          locale,
          `This week has ${summary.thisWeekComplete} complete ${summary.thisWeekComplete === 1 ? "day" : "days"}. Five in a Monday–Sunday week add 5 reward points on Sunday.`,
          `Diese Woche hat ${summary.thisWeekComplete} volle ${summary.thisWeekComplete === 1 ? "Tag" : "Tage"}. Fünf in einer Woche von Montag bis Sonntag geben am Sonntag 5 Belohnungspunkte.`,
        )}
        {summary.weekBonus > 0
          ? pick(locale, ` ${summary.weekBonus} of those points are already in the total.`, ` ${summary.weekBonus} dieser Punkte liegen schon in der Summe.`)
          : ""}{" "}
        {pick(locale, "The open slot follows this device’s clock.", "Das offene Fenster folgt der Uhr dieses Geräts.")}
      </p>
    </section>
  )
}

function Claimed({ slot, note, bonus, locale }: { slot: RewardSlot; note: string; bonus: number; locale: Locale }) {
  const points = SLOT_POINTS[slot] + (slot === "day" && note === "done" ? bonus : 0)
  const label =
    slot === "morning"
      ? pick(locale, "Sleep is on the file.", "Der Schlaf liegt auf der Akte.")
      : slot === "night"
        ? note
        : note === "skipped"
          ? pick(locale, "Marked skipped.", "Als ausgelassen markiert.")
          : note === "unassigned"
            ? pick(locale, "Nothing to assign.", "Nichts zuzuweisen.")
            : bonus > 0
              ? pick(locale, `Marked done. ${bonus} for the action.`, `Als erledigt markiert. ${bonus} für die Handlung.`)
              : pick(locale, "Marked done.", "Als erledigt markiert.")
  return (
    <p className="text-sm">
      {label}{" "}
      <span className="text-muted-foreground">
        {points} {pick(locale, points === 1 ? "reward point" : "reward points", points === 1 ? "Belohnungspunkt" : "Belohnungspunkte")}.
      </span>
    </p>
  )
}
