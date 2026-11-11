"use client"

import Link from "next/link"
import { Disclaimer } from "@/components/disclaimer"
import { SleepClockCard } from "@/components/sleep-clock"
import { useHealth } from "@/components/health-provider"
import { pick } from "@/lib/copy"
import { isoDate } from "@/lib/format"
import {
  leagueBand,
  hiddenDoor,
  lessonState,
  practiceXp,
  presentToday,
  todayQuests,
  trackLabel,
  tracks,
  visibleLessons,
  weekBounds,
  type LeagueBand,
} from "@/lib/practice"

const BAND: Record<LeagueBand, { en: string; de: string }> = {
  seed: { en: "Seed", de: "Samen" },
  sprout: { en: "Sprout", de: "Spross" },
  grove: { en: "Grove", de: "Hain" },
}

export default function PracticePage() {
  const { profile, locale } = useHealth()
  if (!profile) return null
  const today = isoDate(new Date())
  const log = profile.practice ?? { completions: [] }
  const quests = todayQuests(log, today)
  const week = weekBounds(today)
  const xp = practiceXp(log, week.from, week.through)
  const band = leagueBand(xp)

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Practice", "Übung")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">{pick(locale, "One skill on each branch today.", "Eine Übung auf jedem Zweig heute.")}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        {pick(
          locale,
          "Each branch keeps one open door today, with today’s number on it. A new skill on a branch opens a week after you first learn the last one. After the branch is learned, it rotates. Reminders still fire.",
          "Jeder Zweig behält heute eine offene Tür, mit der Zahl von heute. Eine neue Übung auf einem Zweig öffnet eine Woche nach dem ersten Lernen der letzten. Wenn der Zweig gelernt ist, rotiert er. Erinnerungen kommen weiter.",
        )}
      </p>

      <SleepClockCard />

      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Today’s doors", "Die Türen von heute")}</p>
        {quests.length === 0 ? (
          <p className="mt-2 text-sm leading-6">{pick(locale, "Come back tomorrow. The first skills on this tree stay on your file.", "Komm morgen wieder. Die ersten Übungen auf diesem Baum bleiben auf deiner Akte.")}</p>
        ) : (
          <ol className="mt-3 grid gap-3">
            {quests.map((quest) => {
              const shown = presentToday(locale, quest.lesson, today)
              return (
                <li key={quest.lesson.id} className="rounded-xl border border-border px-3 py-3">
                  <p className="text-xs text-muted-foreground">
                    {trackLabel(locale, quest.lesson.track)} · {pick(locale, `Level ${quest.lesson.level}`, `Stufe ${quest.lesson.level}`)} · {quest.status === "done" ? pick(locale, "Done", "Erledigt") : pick(locale, "Open", "Offen")}
                  </p>
                  <h2 className="mt-1 font-display text-2xl tracking-tight">{shown.title}</h2>
                  <p className="mt-2 text-sm leading-6">{quest.status === "done" ? shown.doneLine : shown.action}</p>
                  <Link href={`/home/practice/${quest.lesson.id}`} className="mt-2 inline-flex text-sm text-primary">
                    {quest.status === "done" ? pick(locale, "See the lesson", "Die Lektion ansehen") : pick(locale, "Open the lesson", "Die Lektion öffnen")}
                  </Link>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-display text-2xl">{pick(locale, "Skill tree", "Übungsbaum")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {tracks().map((track) => (
            <article key={track} className="rounded-2xl border border-border bg-card p-4">
              <h3 className="font-medium">{trackLabel(locale, track)}</h3>
              <ol className="mt-3 grid gap-2">
                {visibleLessons(log, track, today).map((lesson) => {
                  const state = lessonState(log, lesson.id, today)
                  const text = presentToday(locale, lesson, today)
                  const label = state === "done" ? pick(locale, "Done", "Erledigt") : pick(locale, "Open", "Offen")
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={`/home/practice/${lesson.id}`}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${state === "open" ? "border-primary bg-moss" : "border-border"}`}
                      >
                        <span className="tabular text-xs text-muted-foreground">{lesson.level}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm">{text.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {label} · {lesson.xp} XP
                          </span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
              {hiddenDoor(log, track, today) === "week" ? (
                <p className="mt-3 text-xs text-muted-foreground">{pick(locale, "The next new skill on this branch opens in a week.", "Die nächste neue Übung auf diesem Zweig öffnet in einer Woche.")}</p>
              ) : null}
              {hiddenDoor(log, track, today) === "rotation" ? (
                <p className="mt-3 text-xs text-muted-foreground">{pick(locale, "This branch stays in rotation.", "Dieser Zweig bleibt in der Rotation.")}</p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "This week", "Diese Woche")}</p>
        <h2 className="mt-2 font-display text-3xl tracking-tight">{BAND[band][locale]}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {pick(
            locale,
            `${xp} practice points this week. Seed is under 20, Sprout is 20, Grove is 40. Each skill counts once this week, including a return with today’s number. Next Monday this week starts again.`,
            `${xp} Übungspunkte in dieser Woche. Samen liegt unter 20, Spross bei 20, Hain bei 40. Jede Übung zählt einmal in dieser Woche, auch eine Rückkehr mit der Zahl von heute. Am Montag beginnt diese Woche neu.`,
          )}
        </p>
      </section>
      <Disclaimer className="mt-8" />
    </main>
  )
}
