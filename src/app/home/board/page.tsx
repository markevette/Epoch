"use client"

import { useEffect, useState } from "react"
import { Disclaimer } from "@/components/disclaimer"
import { useHealth } from "@/components/health-provider"
import { Button } from "@/components/ui/button"
import { appFetch } from "@/lib/browser-api"
import { pick } from "@/lib/copy"
import { formatYears } from "@/lib/format"

const panel = "rounded-2xl border border-border bg-card p-5"

type BoardRow = {
  handle: string
  name: string
  age: number
  score: number
  ageDelta: number
}

export default function BoardPage() {
  const { profile, setLeaderboard, locale } = useHealth()
  const [rows, setRows] = useState<BoardRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    let cancel = false
    appFetch("/api/board")
      .then(async (response) => {
        const data = (await response.json()) as { rows?: BoardRow[]; error?: string }
        if (cancel) return
        if (!response.ok) {
          setError(data.error ?? pick(locale, "The board could not be read.", "Die Tafel konnte nicht gelesen werden."))
          setRows([])
          return
        }
        setRows(data.rows ?? [])
      })
      .catch(() => {
        if (!cancel) {
          setError(pick(locale, "The board could not be read.", "Die Tafel konnte nicht gelesen werden."))
          setRows([])
        }
      })
    return () => {
      cancel = true
    }
  }, [locale, profile, profile?.leaderboard])

  if (!profile) return null

  const you = rows?.find((row) => row.handle === profile.handle)
  const listed = rows ?? []

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Opt-in board", "Freiwillige Tafel")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">{pick(locale, "Scores, beside people who opted in.", "Werte, neben Menschen, die mitmachen.")}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {pick(
          locale,
          "Only files on this server that joined the board appear here. Sample names stay off. Blood tests do not change your place.",
          "Nur Dateien auf diesem Server, die der Tafel beigetreten sind, stehen hier. Beispielnamen bleiben weg. Blutwerte ändern deinen Platz nicht.",
        )}
      </p>

      <section className={`${panel} mt-6 flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h2 className="font-medium">{profile.leaderboard ? pick(locale, `${profile.handle} is on the board`, `${profile.handle} steht auf der Tafel`) : pick(locale, "You are off the board", "Du bist nicht auf der Tafel")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {you
              ? pick(
                  locale,
                  `Your row shows a score of ${Math.round(you.score)} and ${formatYears(you.ageDelta, locale).toLowerCase()}.`,
                  `Deine Zeile zeigt einen Wert von ${Math.round(you.score)} und ${formatYears(you.ageDelta, locale)}.`,
                )
              : pick(locale, "Join to put this file on the board.", "Tritt bei, um diese Datei auf die Tafel zu setzen.")}
          </p>
        </div>
        <Button className="h-10" variant={profile.leaderboard ? "outline" : "default"} onClick={() => setLeaderboard(!profile.leaderboard)}>
          {profile.leaderboard ? pick(locale, "Leave the board", "Tafel verlassen") : pick(locale, "Join the board", "Tafel beitreten")}
        </Button>
      </section>

      {error ? <p className="mt-4 text-sm text-copper">{error}</p> : null}
      {rows === null ? (
        <p className="mt-4 text-sm text-muted-foreground">{pick(locale, "Reading the board.", "Die Tafel wird gelesen.")}</p>
      ) : listed.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {pick(locale, "The board is empty until someone who opted in is on this file.", "Die Tafel ist leer, bis jemand, der mitmacht, auf dieser Datei ist.")}
        </p>
      ) : (
        <ol className="mt-4 grid gap-2">
          {listed.map((row, index) => {
            const isYou = row.handle === profile.handle && row.name === profile.name
            return (
              <li key={`${row.handle}-${row.age}-${index}`} className={`grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-2xl border px-4 py-3 ${isYou ? "border-primary bg-moss" : "border-border bg-card"}`}>
                <span className="tabular text-sm text-muted-foreground">{index + 1}</span>
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    @{row.handle} · {row.age}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl tabular leading-none">{Math.round(row.score)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatYears(row.ageDelta, locale)}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      <Disclaimer className="mt-8" />
    </main>
  )
}
