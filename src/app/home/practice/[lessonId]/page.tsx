"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Disclaimer } from "@/components/disclaimer"
import { useHealth } from "@/components/health-provider"
import { Button } from "@/components/ui/button"
import { pick } from "@/lib/copy"
import { isoDate } from "@/lib/format"
import {
  canComplete,
  lessonById,
  lessonState,
  lessonsOn,
  nextOnBranch,
  presentToday,
  trackExhausted,
  trackLabel,
} from "@/lib/practice"

export default function LessonPage() {
  const params = useParams<{ lessonId: string }>()
  const lessonId = typeof params.lessonId === "string" ? params.lessonId : ""
  const { profile, locale, completeLesson } = useHealth()
  const [pending, setPending] = useState(false)
  if (!profile) return null
  const lesson = lessonById(lessonId)
  const today = isoDate(new Date())
  const log = profile.practice ?? { completions: [] }

  if (!lesson) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
        <p className="text-sm">{pick(locale, "That skill is not on the tree.", "Diese Übung steht nicht auf dem Baum.")}</p>
        <Link href="/home/practice" className="mt-4 inline-flex text-sm text-primary">{pick(locale, "Back to practice", "Zurück zur Übung")}</Link>
      </main>
    )
  }

  const state = lessonState(log, lesson.id, today)
  if (state === "locked") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
        <p className="text-sm">
          {pick(locale, "This skill is not open yet. A new skill on a branch opens one week after the last first-learn.", "Diese Übung ist noch nicht offen. Eine neue Übung auf einem Zweig öffnet eine Woche nach dem ersten Lernen der letzten.")}
        </p>
        <Link href="/home/practice" className="mt-4 inline-flex text-sm text-primary">{pick(locale, "Back to the tree", "Zurück zum Baum")}</Link>
      </main>
    )
  }
  const text = presentToday(locale, lesson, today)
  const ready = canComplete(log, lesson.id, today)
  const next = nextOnBranch(lesson)
  const branchDone = lessonsOn(lesson.track).every((item) => lessonState(log, item.id, today) === "done")
  const rotating = trackExhausted(log, lesson.track)

  async function finish() {
    if (pending) return
    setPending(true)
    await completeLesson(lessonId)
    setPending(false)
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
        {trackLabel(locale, lesson.track)} · {pick(locale, `Level ${lesson.level}`, `Stufe ${lesson.level}`)}
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">{text.title}</h1>
      <p className="mt-4 max-w-xl text-sm leading-6">{text.concept}</p>
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Today’s action", "Die Handlung von heute")}</p>
        <p className="mt-2 text-sm leading-6">{text.action}</p>
        {state === "done" ? (
          <p className="mt-4 text-sm">
            {text.doneLine}{" "}
            {rotating
              ? pick(locale, "Tomorrow this branch rotates to the skill that has waited longest.", "Morgen rotiert dieser Zweig zur Übung, die am längsten gewartet hat.")
              : next
                ? pick(locale, "The next new skill on this branch opens in a week. Until then this door can return with today’s number.", "Die nächste neue Übung auf diesem Zweig öffnet in einer Woche. Bis dahin kann diese Tür mit der Zahl von heute zurückkommen.")
                : branchDone
                  ? pick(locale, "This branch is complete.", "Dieser Zweig ist fertig.")
                  : pick(locale, "The next new skill on this branch opens in a week. Until then this door can return with today’s number.", "Die nächste neue Übung auf diesem Zweig öffnet in einer Woche. Bis dahin kann diese Tür mit der Zahl von heute zurückkommen.")}
          </p>
        ) : null}
        {state === "open" && !ready ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {pick(locale, "This branch already has a skill today. The next one waits until tomorrow.", "Diese Sparte hat heute schon eine Übung. Die nächste wartet bis morgen.")}
          </p>
        ) : null}
        {ready ? (
          <Button className="mt-4 h-11" disabled={pending} onClick={() => void finish()}>
            {pick(locale, "I did this", "Das habe ich gemacht")}
          </Button>
        ) : null}
      </section>
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/home/practice" className="text-primary">{pick(locale, "Back to the tree", "Zurück zum Baum")}</Link>
      </p>
      <Disclaimer className="mt-8" />
    </main>
  )
}
