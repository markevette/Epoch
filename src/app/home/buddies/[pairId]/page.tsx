"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { CompareChart } from "@/components/trend-chart"
import { useHealth } from "@/components/health-provider"
import { Button } from "@/components/ui/button"
import { appFetch } from "@/lib/browser-api"
import { nudgeText, pick, storedNudge, toneText, translateError } from "@/lib/copy"
import type { ScoreDay, ScoreTone } from "@/lib/score-week"

type Week = {
  pairId: string
  partnerName: string
  partnerHandle: string
  you: ScoreDay[]
  them: ScoreDay[]
  tone: ScoreTone
  toneLine: string
  options: { id: string; text: string }[]
  points: number
  sentToday: { text: string } | null
  received: { text: string; name: string } | null
  yourPoints: number
  error?: string
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "Your buddy"
}

export default function BuddyWeekPage() {
  const params = useParams<{ pairId: string }>()
  const pairId = params.pairId
  const { reload, locale } = useHealth()
  const [week, setWeek] = useState<Week | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await appFetch(`/api/buddies/week?pairId=${encodeURIComponent(pairId)}&offset=${new Date().getTimezoneOffset()}`)
    const body = (await response.json().catch(() => null)) as Week | null
    if (!response.ok || !body || body.error) {
      setError(body?.error || "This week could not be opened.")
      return
    }
    setError(null)
    setWeek(body)
  }, [pairId])

  useEffect(() => {
    void load()
  }, [load])

  async function send(optionId: string) {
    setPending(optionId)
    setError(null)
    const response = await appFetch("/api/buddies/week", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairId, optionId, offset: new Date().getTimezoneOffset() }),
    })
    const body = (await response.json().catch(() => null)) as Week | null
    setPending(null)
    if (!response.ok || !body || body.error) {
      setError(body?.error || "That line did not send.")
      return
    }
    setWeek(body)
    await reload()
  }

  const partner = week ? firstName(week.partnerName) : "Your buddy"

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Buddy</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">{pick(locale, `${partner}’s week`, `Woche von ${partner}`)}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        {pick(locale, "The last 7 daily scores, beside yours. Meals and workouts stay on their file.", "Die letzten 7 Tageswerte, neben deinen. Mahlzeiten und Training bleiben auf ihrer Akte.")}
        {week ? ` @${week.partnerHandle}` : ""}
      </p>

      {!week && !error ? <p className="mt-6 text-sm text-muted-foreground">{pick(locale, "The week is loading.", "Die Woche wird geladen.")}</p> : null}

      {week ? (
        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <CompareChart you={week.you} them={week.them} youName={pick(locale, "You", "Du")} themName={partner} />
          <p className="mt-4 text-sm leading-6">{toneText(locale, week.tone)}</p>
          {week.received ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {pick(locale, `${firstName(week.received.name)} wrote:`, `${firstName(week.received.name)} schrieb:`)} {storedNudge(locale, week.received.text)}
            </p>
          ) : null}
        </section>
      ) : null}

      {week ? (
        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-2xl">{pick(locale, "Send a line", "Eine Zeile schicken")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {week.sentToday
              ? pick(
                  locale,
                  `You sent: ${storedNudge(locale, week.sentToday.text)} It added ${week.points} reward points. One line a day for this buddy.`,
                  `Du hast geschickt: ${storedNudge(locale, week.sentToday.text)} Das hat ${week.points} Belohnungspunkte gegeben. Eine Zeile am Tag für diesen Buddy.`,
                )
              : pick(
                  locale,
                  `Pick a line that matches the graph. Sending it adds ${week.points} reward points, once today. You have ${week.yourPoints}.`,
                  `Wähle eine Zeile, die zum Verlauf passt. Das Schicken gibt ${week.points} Belohnungspunkte, einmal heute. Du hast ${week.yourPoints}.`,
                )}
          </p>
          {week.sentToday ? null : (
            <div className="mt-4 grid gap-2">
              {week.options.map((option) => (
                <Button
                  key={option.id}
                  variant="outline"
                  className="h-auto min-h-10 justify-start px-4 py-3 text-left whitespace-normal"
                  disabled={pending !== null}
                  onClick={() => void send(option.id)}
                >
                  {nudgeText(locale, option.id, option.text)}
                </Button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {error ? <p className="mt-4 text-sm text-copper">{translateError(locale, error)}</p> : null}
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/home/pair" className="text-primary">{pick(locale, "Back to the pairs", "Zurück zu den Paaren")}</Link>
      </p>
    </main>
  )
}
