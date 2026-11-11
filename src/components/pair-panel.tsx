"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatLongDate } from "@/lib/format"
import { useHealth } from "@/components/health-provider"
import { appFetch } from "@/lib/browser-api"
import { copy, pick, translateError } from "@/lib/copy"
import { morningsTogetherLabel, pairCardHandles, type PairMark, type PairSnapshot } from "@/lib/pairs"
import { paintPairCard, PAIR_CARD_FILENAME, pngFileFromPaint } from "@/lib/share-card"

type ActivePair = Extract<PairSnapshot, { state: "active" }>
type EndedPair = Extract<PairSnapshot, { state: "ended" }>
type Board = { code: string; incoming: number; pairs: ActivePair[]; ended: EndedPair[]; pairCap?: number; error?: string }

function deviceOffset(): number {
  return new Date().getTimezoneOffset()
}

function markLabel(mark: PairMark, locale: "en" | "de"): string {
  if (locale === "de") {
    if (mark === "kept") return "Gehalten"
    if (mark === "miss") return "Verpasst"
    if (mark === "pause") return "Pause"
    return "Noch offen"
  }
  if (mark === "kept") return "Kept"
  if (mark === "miss") return "Missed"
  if (mark === "pause") return "Pause"
  return "Still open"
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "Your pair"
}

export function PairPanel({ detail = false }: { detail?: boolean }) {
  const [view, setView] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const { locale } = useHealth()

  const load = useCallback(async () => {
    const response = await appFetch(`/api/pair?offset=${deviceOffset()}&lang=${locale}`)
    const body = (await response.json().catch(() => null)) as Board | null
    if (!response.ok || !body || body.error) {
      setError(body?.error || "The pairs could not be loaded.")
      return
    }
    setError(null)
    setView(body)
  }, [locale])

  useEffect(() => {
    void load()
  }, [load])

  async function act(action: string, pairId: string, extra?: { on?: boolean }) {
    setPending(`${action}:${pairId}`)
    setError(null)
    const response = await appFetch("/api/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, pairId, offset: deviceOffset(), ...extra }),
    })
    const body = (await response.json().catch(() => null)) as Board | null
    setPending(null)
    if (!response.ok || !body || body.error) {
      setError(body?.error || "That did not land.")
      return
    }
    setView(body)
    setConfirm(null)
  }

  if (!view && !error) {
    return (
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">{pick(locale, "The pairs are loading.", "Die Paare werden geladen.")}</p>
      </section>
    )
  }

  const pairs = view?.pairs ?? []
  const ended = view?.ended ?? []

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Mornings together", "Morgen zusammen")}</p>
        <p className="text-xs text-muted-foreground">{pairs.length} of {view?.pairCap ?? 5}</p>
      </div>
      {view && view.incoming > 0 ? (
        <p className="mt-3 text-sm">
          <Link href="/home/buddies" className="text-primary">
            {view.incoming === 1
              ? pick(locale, "1 request is waiting on Buddies.", "1 Anfrage wartet bei den Buddies.")
              : pick(locale, `${view.incoming} requests are waiting on Buddies.`, `${view.incoming} Anfragen warten bei den Buddies.`)}
          </Link>
        </p>
      ) : null}
      {pairs.length === 0 && ended.length === 0 ? (
        <div className="mt-3">
          <h2 className="font-display text-3xl tracking-tight">{pick(locale, "Each person, their own count.", "Jede Person, ihre eigene Zählung.")}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {pick(locale, "A buddy code finds the right person. They accept or reject. Five pairs are open, and each 150 reward points unlocks one more. They see whether you checked in each morning, and the last 7 daily scores beside their own. Meals and workouts stay on your file.", "Ein Buddy-Code findet die richtige Person. Sie nimmt an oder lehnt ab. Fünf Paare sind offen, und je 150 Belohnungspunkte öffnen ein weiteres. Die Person sieht, ob du jeden Morgen eingecheckt hast, und die letzten 7 Tageswerte neben den eigenen. Mahlzeiten und Training bleiben auf deiner Akte.")}
          </p>
          <Link href="/home/buddies" className="mt-4 inline-flex text-sm text-primary">
            {pick(locale, "Open Buddies", "Buddies öffnen")}
          </Link>
        </div>
      ) : null}
      <div className="mt-4 grid gap-4">
        {pairs.map((pair) =>
          detail ? (
            <FullPair
              key={pair.id}
              pair={pair}
              pending={pending}
              confirm={confirm}
              shareNote={shareNote}
              onAct={act}
              onConfirm={setConfirm}
              onShareNote={setShareNote}
            />
          ) : (
            <CompactPair key={pair.id} pair={pair} pending={pending} onAct={act} />
          )
        )}
        {detail
          ? ended.map((pair) => (
              <EndedPairCard key={pair.id} pair={pair} pending={pending} confirm={confirm} onAct={act} onConfirm={setConfirm} />
            ))
          : null}
      </div>
      {pairs.length > 0 && !detail ? (
        <Link href="/home/pair" className="mt-4 inline-flex text-sm text-primary">
          {pick(locale, "Open the pairs", "Die Paare öffnen")}
        </Link>
      ) : null}
      {error ? <p className="mt-3 text-sm text-copper">{translateError(locale, error)}</p> : null}
    </section>
  )
}

function CompactPair({ pair, pending, onAct }: { pair: ActivePair; pending: string | null; onAct: (action: string, pairId: string) => void }) {
  const { locale } = useHealth()
  const partner = firstName(pair.partnerName)
  return (
    <article className="rounded-xl border border-border px-4 py-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="font-display text-4xl tabular leading-none">{pair.streak}</p>
        <p className="text-sm text-muted-foreground">@{pair.partnerHandle}</p>
      </div>
      <p className="mt-2 text-sm">{morningsTogetherLabel(pair.streak, locale)} {pick(locale, "with", "mit")} {partner}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{pair.line}</p>
      <Link href={`/home/buddies/${pair.id}`} className="mt-3 inline-flex text-sm text-primary">
        {pick(locale, `${partner}’s week`, `Woche von ${partner}`)}
      </Link>
      {pair.canNudge ? (
        <Button className="mt-3 h-10" disabled={pending !== null} onClick={() => onAct("nudge", pair.id)}>
          {pick(locale, `Nudge ${partner}`, `${partner} anstupsen`)}
        </Button>
      ) : null}
    </article>
  )
}

function FullPair({
  pair,
  pending,
  confirm,
  shareNote,
  onAct,
  onConfirm,
  onShareNote,
}: {
  pair: ActivePair
  pending: string | null
  confirm: string | null
  shareNote: string | null
  onAct: (action: string, pairId: string, extra?: { on?: boolean }) => void
  onConfirm: (value: string | null) => void
  onShareNote: (value: string | null) => void
}) {
  const { locale } = useHealth()
  const partner = firstName(pair.partnerName)
  const [left, right] = pairCardHandles(pair.handleA, pair.handleB)
  const busy = pending !== null

  async function cardFile() {
    return pngFileFromPaint(PAIR_CARD_FILENAME, (ctx) => {
      paintPairCard(ctx, {
        left,
        right,
        streak: pair.streak,
        sentence: copy(locale).claims[3],
        together: morningsTogetherLabel(pair.streak, locale),
      })
    })
  }

  async function downloadCard() {
    try {
      const file = await cardFile()
      const url = URL.createObjectURL(file)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = file.name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      onShareNote(pick(locale, "The card downloaded as a PNG.", "Die Karte wurde als PNG geladen."))
    } catch {
      onShareNote(pick(locale, "The card could not be drawn.", "Die Karte konnte nicht gezeichnet werden."))
    }
  }

  async function nativeShare() {
    let file: File
    try {
      file = await cardFile()
    } catch {
      onShareNote(pick(locale, "The card could not be drawn.", "Die Karte konnte nicht gezeichnet werden."))
      return
    }
    const text = `@${left} and @${right}. ${morningsTogetherLabel(pair.streak, locale)}. ${copy(locale).claims[3]}`
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      await downloadCard()
      return
    }
    try {
      await navigator.share({ title: "Epoch", text, files: [file] })
      onShareNote(pick(locale, "Share sheet opened with the card.", "Das Teilen hat sich mit der Karte geöffnet."))
    } catch {
      onShareNote(pick(locale, "Share was dismissed.", "Das Teilen wurde geschlossen."))
    }
  }

  return (
    <article className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-5xl tabular leading-none">{pair.streak}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {morningsTogetherLabel(pair.streak, locale)} {pick(locale, "with", "mit")}{" "}
            <Link href={`/home/buddies/${pair.id}`} className="text-primary">{partner}</Link>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">@{pair.partnerHandle}</p>
      </div>
      <p className="mt-3 text-sm leading-6">{pair.line}</p>
      {pair.longest > pair.streak ? <p className="mt-1 text-sm text-muted-foreground">{pick(locale, `Longest together: ${pair.longest}.`, `Längste Folge: ${pair.longest}.`)}</p> : null}
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        <li className="rounded-xl border border-border px-3 py-3 text-sm">
          <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{pick(locale, "You", "Du")}</p>
          <p className="mt-1 font-medium">{markLabel(pair.yourMark, locale)}</p>
        </li>
        <li className="rounded-xl border border-border px-3 py-3 text-sm">
          <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{partner}</p>
          <p className="mt-1 font-medium">{markLabel(pair.partnerMark, locale)}</p>
        </li>
      </ul>
      {pair.partnerNudged ? <p className="mt-3 text-sm text-muted-foreground">{pick(locale, `${partner} nudged you. One line, and it can wait.`, `${partner} hat dich angestupst. Eine Zeile, und sie kann warten.`)}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {pair.canNudge ? (
          <Button className="h-10" disabled={busy} onClick={() => onAct("nudge", pair.id)}>
            {pick(locale, `Nudge ${partner}`, `${partner} anstupsen`)}
          </Button>
        ) : null}
        {pair.pauseAvailable && pair.pauseDate ? (
          <Button variant="outline" className="h-10" disabled={busy} onClick={() => onAct("pause", pair.id)}>
            {pick(locale, `Use a pause for ${formatLongDate(pair.pauseDate, locale)}`, `Eine Pause für den ${formatLongDate(pair.pauseDate, locale)} nutzen`)}
          </Button>
        ) : null}
        {pair.repair && !pair.repair.youAgreed ? (
          <Button variant="outline" className="h-10" disabled={busy} onClick={() => onAct("repair", pair.id)}>
            {pick(locale, `Restore ${formatLongDate(pair.repair.gapDate, locale)} together`, `${formatLongDate(pair.repair.gapDate, locale)} gemeinsam wiederherstellen`)}
          </Button>
        ) : null}
      </div>
      {pair.repair?.youAgreed && !pair.repair.partnerAgreed ? <p className="mt-3 text-sm text-muted-foreground">{pick(locale, `You agreed. Waiting on ${partner}.`, `Du hast zugestimmt. Warten auf ${partner}.`)}</p> : null}
      {pair.yourMark === "open" || pair.yourMark === "waiting" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {pick(locale, "A morning counts when you confirm it in", "Ein Morgen zählt, wenn du ihn bestätigst in")}{" "}
          <a href="/home#check-ins" className="text-primary">{pick(locale, "today’s check-ins", "den Check-ins von heute")}</a>.
        </p>
      ) : null}
      <div className="mt-5 border-t border-border pt-4">
        <p className="text-sm leading-6 text-muted-foreground">
          {pick(locale, "At 7 mornings, and again at 30, the card can be sent when you both allow it. It shows the two handles and the number.", "Bei 7 Morgen, und wieder bei 30, kann die Karte geschickt werden, wenn ihr beide zustimmt. Sie zeigt die beiden Kürzel und die Zahl.")}
        </p>
        <Button variant="outline" className="mt-3 h-10" disabled={busy} onClick={() => onAct("share", pair.id, { on: !pair.sharing })}>
          {pair.sharing ? pick(locale, "The card is allowed from your side", "Die Karte ist von deiner Seite erlaubt") : pick(locale, "Allow the pair card", "Die Paarkarte erlauben")}
        </Button>
        {pair.milestone && pair.canShare ? (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">@{left} and @{right}</p>
            <p className="mt-2 font-display text-4xl tabular">{pair.streak}</p>
            <p className="mt-1 text-sm">{morningsTogetherLabel(pair.streak, locale)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="h-10" onClick={() => void downloadCard()}>{pick(locale, "Download card", "Karte laden")}</Button>
              <Button variant="outline" className="h-10" onClick={() => void nativeShare()}>{pick(locale, "Share", "Teilen")}</Button>
            </div>
            {shareNote ? <p className="mt-3 text-sm text-muted-foreground">{shareNote}</p> : null}
          </div>
        ) : pair.milestone ? (
          <p className="mt-3 text-sm text-muted-foreground">{pick(locale, "The card stays here until you both allow it.", "Die Karte bleibt hier, bis ihr beide zustimmt.")}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {confirm === `leave:${pair.id}` ? (
            <Button variant="outline" className="h-10" disabled={busy} onClick={() => onAct("leave", pair.id)}>
              {pick(locale, "Leave now", "Jetzt verlassen")}
            </Button>
          ) : (
            <Button variant="outline" className="h-10" onClick={() => onConfirm(`leave:${pair.id}`)}>
              {pick(locale, "Leave this pair", "Dieses Paar verlassen")}
            </Button>
          )}
          {confirm === `delete:${pair.id}` ? (
            <Button variant="outline" className="h-10" disabled={busy} onClick={() => onAct("delete", pair.id)}>
              {pick(locale, "Delete it for both of you", "Für euch beide löschen")}
            </Button>
          ) : (
            <Button variant="outline" className="h-10" onClick={() => onConfirm(`delete:${pair.id}`)}>
              {pick(locale, "Delete this pair", "Dieses Paar löschen")}
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

function EndedPairCard({
  pair,
  pending,
  confirm,
  onAct,
  onConfirm,
}: {
  pair: EndedPair
  pending: string | null
  confirm: string | null
  onAct: (action: string, pairId: string) => void
  onConfirm: (value: string | null) => void
}) {
  const { locale } = useHealth()
  const partner = firstName(pair.partnerName)
  return (
    <article className="rounded-xl border border-border p-4">
      <p className="font-display text-2xl">{pick(locale, "Ended at", "Beendet bei")} {morningsTogetherLabel(pair.streak, locale)} {pick(locale, "with", "mit")} {partner}.</p>
      <p className="mt-2 text-sm text-muted-foreground">{pick(locale, `@${pair.partnerHandle} no longer sees today’s check-in. Your own mornings stay on the file.`, `@${pair.partnerHandle} sieht den Check-in von heute nicht mehr. Deine eigenen Morgen bleiben auf der Akte.`)}</p>
      {confirm === `delete:${pair.id}` ? (
        <Button variant="outline" className="mt-3 h-10" disabled={pending !== null} onClick={() => onAct("delete", pair.id)}>
          {pick(locale, "Delete it for both of you", "Für euch beide löschen")}
        </Button>
      ) : (
        <Button variant="outline" className="mt-3 h-10" onClick={() => onConfirm(`delete:${pair.id}`)}>
          {pick(locale, "Delete this pair", "Dieses Paar löschen")}
        </Button>
      )}
    </article>
  )
}
