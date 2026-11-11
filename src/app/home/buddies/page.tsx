"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useHealth } from "@/components/health-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { appFetch } from "@/lib/browser-api"
import { pick, translateError, translateReason } from "@/lib/copy"
import { BUDDY_UNLOCK_POINTS } from "@/lib/pairs"

type Buddy = { found: true; self: boolean; code: string; name: string; handle: string; canPair: boolean; reason: string | null }
type RequestRow = { id: string; name: string; handle: string; code: string; status: "pending" | "rejected" }
type Home = { code: string; pairCount: number; pairCap: number; points: number; incoming: RequestRow[]; outgoing: RequestRow[]; error?: string }
type ApiBody = {
  error?: string
  found?: boolean
  line?: string
  self?: boolean
  code?: string
  name?: string
  handle?: string
  canPair?: boolean
  reason?: string | null
  pairCount?: number
  pairCap?: number
  points?: number
  incoming?: RequestRow[]
  outgoing?: RequestRow[]
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "This person"
}

export default function BuddiesPage() {
  const { locale } = useHealth()
  const [home, setHome] = useState<Home | null>(null)
  const [query, setQuery] = useState("")
  const [hit, setHit] = useState<Buddy | { found: false; line: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const response = await appFetch("/api/buddies")
    const body = (await response.json().catch(() => null)) as Home | null
    if (!response.ok || !body || body.error) {
      setError(body?.error || "Buddies could not be loaded.")
      return
    }
    setHome(body)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function post(action: string, extra?: { code?: string; requestId?: string }) {
    setPending(action + (extra?.requestId ?? ""))
    setError(null)
    const response = await appFetch("/api/buddies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, offset: new Date().getTimezoneOffset(), ...extra }),
    })
    const body = (await response.json().catch(() => null)) as ApiBody | null
    setPending(null)
    if (!response.ok || !body || body.error) {
      setError(body?.error || "That did not land.")
      return null
    }
    return body
  }

  async function search(event: React.FormEvent) {
    event.preventDefault()
    setCopied(false)
    const body = await post("search", { code: query })
    if (!body) return
    if (body.found === false) setHit({ found: false, line: body.line || "No such ID exists." })
    else if (body.found && body.code && body.name && body.handle) {
      setHit({
        found: true,
        self: Boolean(body.self),
        code: body.code,
        name: body.name,
        handle: body.handle,
        canPair: Boolean(body.canPair),
        reason: body.reason ?? null,
      })
    }
  }

  async function requestPair() {
    if (!hit || !("found" in hit) || !hit.found) return
    const body = await post("request", { code: hit.code })
    if (!body || !body.code || body.pairCount == null || body.pairCap == null || body.points == null || !body.incoming || !body.outgoing) return
    setHome({ code: body.code, pairCount: body.pairCount, pairCap: body.pairCap, points: body.points, incoming: body.incoming, outgoing: body.outgoing })
    setHit({ ...hit, canPair: false, reason: `Waiting for ${firstName(hit.name)} to accept.` })
  }

  async function decide(action: "accept" | "reject", requestId: string) {
    const body = await post(action, { requestId })
    if (!body || !body.code || body.pairCount == null || body.pairCap == null || body.points == null || !body.incoming || !body.outgoing) return
    setHome({ code: body.code, pairCount: body.pairCount, pairCap: body.pairCap, points: body.points, incoming: body.incoming, outgoing: body.outgoing })
  }

  async function replaceCode() {
    const body = await post("replace")
    if (!body || !body.code || body.pairCount == null || body.pairCap == null || body.points == null || !body.incoming || !body.outgoing) return
    setHome({ code: body.code, pairCount: body.pairCount, pairCap: body.pairCap, points: body.points, incoming: body.incoming, outgoing: body.outgoing })
    setConfirmReplace(false)
    setHit(null)
  }

  async function copyCode() {
    if (!home) return
    try {
      await navigator.clipboard.writeText(home.code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Buddies</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">{pick(locale, "Find a person by their code.", "Finde eine Person über ihren Code.")}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        {pick(locale, "A search returns that exact code, or it says no such ID exists. Pair streak asks them to accept or reject, and only while you both have room. Each pair keeps its own morning count. Open a buddy’s week to compare the last 7 daily scores.", "Eine Suche gibt genau diesen Code zurück, oder sie sagt, diese ID gibt es nicht. Paar-Zählung bittet um Annahme oder Ablehnung, und nur solange ihr beide Platz habt. Jedes Paar hält seine eigene Morgenzählung. Öffne die Woche eines Buddies, um die letzten 7 Tageswerte zu vergleichen.")}
      </p>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Your code", "Dein Code")}</p>
        <p className="mt-2 font-display text-5xl tracking-[0.18em]">{home?.code ?? "······"}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {pick(locale, "Hand this to someone. They type it here on their side.", "Gib das jemandem. Die Person tippt es hier auf ihrer Seite ein.")}{" "}
          {home ? pick(locale, `${home.pairCount} of ${home.pairCap} pairs.`, `${home.pairCount} von ${home.pairCap} Paaren.`) : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" className="h-10" onClick={() => void copyCode()} disabled={!home}>
            {copied ? pick(locale, "Copied", "Kopiert") : pick(locale, "Copy code", "Code kopieren")}
          </Button>
          {confirmReplace ? (
            <Button variant="outline" className="h-10" disabled={pending !== null} onClick={() => void replaceCode()}>
              {pick(locale, "Replace it now", "Jetzt ersetzen")}
            </Button>
          ) : (
            <Button variant="outline" className="h-10" onClick={() => setConfirmReplace(true)}>
              {pick(locale, "Replace code", "Code ersetzen")}
            </Button>
          )}
        </div>
      </section>

      <form className="mt-6 rounded-2xl border border-border bg-card p-5" onSubmit={(event) => void search(event)}>
        <Label htmlFor="buddy-code">{pick(locale, "Their code", "Deren Code")}</Label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id="buddy-code"
            className="h-11 uppercase tracking-[0.14em]"
            value={query}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button className="h-11" type="submit" disabled={pending !== null || query.trim().length === 0}>
            {pick(locale, "Search", "Suchen")}
          </Button>
        </div>
        {hit && !hit.found ? <p className="mt-3 text-sm">{translateError(locale, "No such ID exists.")}</p> : null}
        {hit && hit.found ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3">
            {hit.canPair ? (
              <Button type="button" className="h-10" disabled={pending !== null} onClick={() => void requestPair()}>
                {pick(locale, "Pair streak", "Paar-Zählung")}
              </Button>
            ) : null}
            <div>
              <p className="font-display text-2xl tracking-[0.12em]">{hit.code}</p>
              <p className="mt-1 text-sm">{hit.name} · @{hit.handle}</p>
              {hit.reason ? <p className="mt-1 text-sm text-muted-foreground">{translateReason(locale, hit.reason)}</p> : null}
            </div>
          </div>
        ) : null}
      </form>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-2xl">{pick(locale, "Reward points open more buddies", "Belohnungspunkte öffnen mehr Buddies")}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {pick(locale, `Every file starts with 5 pairs. Each ${BUDDY_UNLOCK_POINTS} reward points unlocks one more. A full week of check-ins is 40 points.`, `Jede Akte startet mit 5 Paaren. Je ${BUDDY_UNLOCK_POINTS} Belohnungspunkte öffnen ein weiteres. Eine volle Woche Check-ins sind 40 Punkte.`)}
          {home
            ? pick(
                locale,
                ` You have ${home.points} points, so ${home.pairCap} pairs are open, and ${home.pairCount} ${home.pairCount === 1 ? "is" : "are"} in use. The next pair opens at ${Math.floor(home.points / BUDDY_UNLOCK_POINTS) * BUDDY_UNLOCK_POINTS + BUDDY_UNLOCK_POINTS} points.`,
                ` Du hast ${home.points} Punkte, also sind ${home.pairCap} Paare offen, und ${home.pairCount} ${home.pairCount === 1 ? "ist" : "sind"} in Gebrauch. Das nächste Paar öffnet bei ${Math.floor(home.points / BUDDY_UNLOCK_POINTS) * BUDDY_UNLOCK_POINTS + BUDDY_UNLOCK_POINTS} Punkten.`,
              )
            : ""}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-2xl">{pick(locale, "Requests", "Anfragen")}</h2>
        {home && home.incoming.length === 0 && home.outgoing.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{pick(locale, "No one is waiting.", "Niemand wartet.")}</p>
        ) : null}
        <ul className="mt-3 grid gap-3">
          {home?.incoming.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <div>
                <p className="font-medium">{pick(locale, `${firstName(row.name)} asked to pair`, `${firstName(row.name)} möchte ein Paar`)}</p>
                <p className="text-sm text-muted-foreground">{row.code} · @{row.handle}</p>
              </div>
              <div className="flex gap-2">
                <Button className="h-10" disabled={pending !== null} onClick={() => void decide("accept", row.id)}>
                  {pick(locale, "Accept", "Annehmen")}
                </Button>
                <Button variant="outline" className="h-10" disabled={pending !== null} onClick={() => void decide("reject", row.id)}>
                  {pick(locale, "Reject", "Ablehnen")}
                </Button>
              </div>
            </li>
          ))}
          {home?.outgoing.map((row) => (
            <li key={row.id} className="rounded-2xl border border-border bg-card px-4 py-3 text-sm">
              {row.status === "pending"
                ? pick(locale, `Waiting for ${firstName(row.name)} to accept.`, `Warten, bis ${firstName(row.name)} annimmt.`)
                : pick(locale, `${firstName(row.name)} declined the request.`, `${firstName(row.name)} hat die Anfrage abgelehnt.`)}
              <span className="mt-1 block text-muted-foreground">{row.code} · @{row.handle}</span>
            </li>
          ))}
        </ul>
      </section>

      {error ? <p className="mt-4 text-sm text-copper">{translateError(locale, error)}</p> : null}
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/home/pair" className="text-primary">{pick(locale, "Open the pairs", "Die Paare öffnen")}</Link>
      </p>
    </main>
  )
}
