"use client"

import { useCallback, useEffect, useState } from "react"
import { Disclaimer } from "@/components/disclaimer"
import { GroveTree } from "@/components/grove-tree"
import { useHealth } from "@/components/health-provider"
import { pick, translateError } from "@/lib/copy"
import { formatEur } from "@/lib/format"
import { appFetch } from "@/lib/browser-api"
import type { GroveStage, GroveView } from "@/lib/grove"
import { currentReminderPermission, requestReminderPermission, type ReminderPermission } from "@/lib/native-reminders"

const STAGE_NAME: Record<GroveStage, { en: string; de: string }> = {
  seed: { en: "Seed", de: "Samen" },
  sprout: { en: "Sprout", de: "Spross" },
  sapling: { en: "Sapling", de: "Setzling" },
  young: { en: "Young tree", de: "Jungbaum" },
  tree: { en: "Tree", de: "Baum" },
  canopy: { en: "Canopy", de: "Krone" },
}

const PACK_NAME: Record<GroveView["packs"][number]["id"], { en: string; de: string }> = {
  handful: { en: "Handful", de: "Handvoll" },
  basket: { en: "Basket", de: "Korb" },
  barrow: { en: "Barrow", de: "Karre" },
}

const ORB_SPOTS = [
  { left: "8%", top: "16%" },
  { left: "70%", top: "12%" },
  { left: "18%", top: "38%" },
  { left: "78%", top: "40%" },
  { left: "42%", top: "8%" },
  { left: "58%", top: "34%" },
]

function isView(value: unknown): value is GroveView {
  if (!value || typeof value !== "object") return false
  const row = value as GroveView
  return typeof row.sun === "number" && typeof row.stage === "string" && Array.isArray(row.packs)
}

export default function GrovePage() {
  const { locale, reload } = useHealth()
  const [view, setView] = useState<GroveView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [splash, setSplash] = useState(false)
  const [permission, setPermission] = useState<ReminderPermission | null>(null)

  const apply = useCallback((data: GroveView) => {
    setView(data)
    setError(null)
  }, [])

  useEffect(() => {
    void currentReminderPermission().then(setPermission)
  }, [])

  useEffect(() => {
    let cancel = false
    appFetch("/api/grove")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (cancel) return
        if (isView(data)) apply(data)
        else setError(typeof (data as { error?: string })?.error === "string" ? (data as { error: string }).error : "The grove could not be opened.")
      })
      .catch(() => {
        if (!cancel) setError("This server could not be reached.")
      })
    return () => {
      cancel = true
    }
  }, [apply])

  async function act(body: { action: "gather" | "water" | "buy"; pack?: string }) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await appFetch("/api/grove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => null)) as (GroveView & { error?: string }) | null
      if (!res.ok || !data || !isView(data)) {
        setError(data?.error || "The grove request was incomplete.")
        return
      }
      apply(data)
      if (body.action === "water") {
        setSplash(true)
        window.setTimeout(() => setSplash(false), 700)
      }
      if (data.checkoutUrl) window.location.assign(data.checkoutUrl)
      else await reload()
    } catch {
      setError("This server could not be reached.")
    } finally {
      setBusy(false)
    }
  }

  const stageName = view ? STAGE_NAME[view.stage][locale] : ""
  const orbs = view ? Math.min(ORB_SPOTS.length, Math.ceil(view.pendingSun / Math.max(1, view.tapSun || 1))) : 0
  const span = view && view.poursToNext != null ? view.poursIntoLevel + view.poursToNext : 1
  const fill = view && view.poursToNext != null ? Math.round((view.poursIntoLevel / span) * 100) : 100

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Grove", "Hain")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">{pick(locale, "Water a sapling into a tree.", "Gieße einen Setzling zum Baum.")}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        {pick(
          locale,
          "Sun falls from reward points. Tap a sun, then pour it on the plant. Each pour is one step up the levels. Packs buy more sun. Buddy points stay where they are, and the daily score does not move.",
          "Sonne fällt aus Belohnungspunkten. Tippe eine Sonne an und gieße sie auf die Pflanze. Jeder Guss ist eine Stufe. Packs kaufen mehr Sonne. Buddy-Punkte bleiben, wo sie sind, und der Tageswert bewegt sich nicht.",
        )}
      </p>

      {error ? <p className="mt-4 text-sm text-copper">{translateError(locale, error)}</p> : null}

      <section className="grove-lawn relative mt-8 overflow-hidden rounded-3xl border border-border shadow-[0_24px_50px_-36px_rgba(30,50,40,0.6)]">
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-full bg-[oklch(0.9_0.12_95)] px-3 py-1 text-sm text-[oklch(0.32_0.05_70)]">
          <span className="size-3 rounded-full bg-[oklch(0.82_0.16_90)]" aria-hidden />
          <span className="tabular font-medium">{view?.sun ?? "–"}</span>
          <span>{pick(locale, "sun", "Sonne")}</span>
        </div>
        {view && orbs > 0
          ? ORB_SPOTS.slice(0, orbs).map((spot, index) => (
              <button
                key={`${spot.left}-${spot.top}`}
                type="button"
                className="grove-sun absolute z-10 grid size-12 place-items-center rounded-full bg-[oklch(0.88_0.15_95)] text-xs font-medium text-[oklch(0.32_0.05_70)] shadow-md disabled:opacity-60"
                style={{ left: spot.left, top: spot.top, animationDelay: `${index * 0.2}s` }}
                onClick={() => act({ action: "gather" })}
                disabled={busy}
              >
                +{index === orbs - 1 ? view.pendingSun - view.tapSun * (orbs - 1) : view.tapSun}
              </button>
            ))
          : null}
        <div className="px-4 pt-16 pb-4">
          {view ? <GroveTree stage={view.stage} blossoms={view.blossoms} splash={splash} /> : <div className="h-64" />}
          <div className="mb-2 flex justify-center">
            <button
              type="button"
              className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              onClick={() => act({ action: "water" })}
              disabled={busy || !view || view.sun < view.pourCost}
            >
              {pick(locale, `Pour ${view?.pourCost ?? 4} sun`, `${view?.pourCost ?? 4} Sonne gießen`)}
            </button>
          </div>
        </div>
      </section>

      {view ? (
        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
            {pick(locale, `Level ${view.level} of ${view.levelCount}`, `Stufe ${view.level} von ${view.levelCount}`)}
          </p>
          <h2 className="mt-2 font-display text-3xl tracking-tight">{stageName}</h2>
          <div className="mt-3 h-1.5 rounded-full bg-muted">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${fill}%` }} />
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {view.poursToNext == null
              ? pick(
                  locale,
                  `The canopy is open. Further pours add blossoms. This one has ${view.blossoms}.`,
                  `Die Krone ist offen. Weitere Güsse geben Blüten. Diese hat ${view.blossoms}.`,
                )
              : pick(
                  locale,
                  `${view.poursToNext} ${view.poursToNext === 1 ? "pour" : "pours"} to the next level. ${view.pendingSun} sun still sitting on the lawn from ${view.rewardPoints} reward points.`,
                  `${view.poursToNext} ${view.poursToNext === 1 ? "Guss" : "Güsse"} bis zur nächsten Stufe. ${view.pendingSun} Sonne liegt noch auf der Wiese, aus ${view.rewardPoints} Belohnungspunkten.`,
                )}
          </p>
          <ol className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(STAGE_NAME) as GroveStage[]).map((stage, index) => {
              const on = index + 1 === view.level
              const done = index + 1 < view.level
              return (
                <li key={stage} className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary bg-moss text-foreground" : done ? "border-border text-foreground" : "border-border text-muted-foreground"}`}>
                  {index + 1} {STAGE_NAME[stage][locale]}
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}

      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Reminder", "Erinnerung")}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {pick(
            locale,
            "At 18:00 a reminder can ask you to collect sun or to pour, when there is something to do. It is the same kind of reminder as the practice doors. Chrome and the installed app can show it while Epoch is closed.",
            "Um 18:00 kann eine Erinnerung zum Sammeln oder Gießen kommen, wenn etwas zu tun ist. Es ist dieselbe Art Erinnerung wie bei den Übungstüren. Chrome und die installierte App können sie zeigen, während Epoch geschlossen ist.",
          )}
        </p>
        {permission === "default" ? (
          <button
            type="button"
            className="mt-3 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => {
              void requestReminderPermission().then((next) => {
                setPermission(next)
                if (next === "granted") window.dispatchEvent(new Event("epoch-reminders"))
              })
            }}
          >
            {pick(locale, "Allow reminders", "Erinnerungen erlauben")}
          </button>
        ) : null}
        {permission === "granted" ? <p className="mt-3 text-sm">{pick(locale, "Reminders are on for this device.", "Erinnerungen sind auf diesem Gerät an.")}</p> : null}
        {permission === "denied" ? <p className="mt-3 text-sm">{pick(locale, "Reminders are off for this device.", "Erinnerungen sind auf diesem Gerät aus.")}</p> : null}
        {permission === "unsupported" ? <p className="mt-3 text-sm">{pick(locale, "This browser cannot hold a reminder.", "Dieser Browser kann keine Erinnerung halten.")}</p> : null}
      </section>

      <section className="mt-6">
        <h2 className="font-display text-2xl">{pick(locale, "Buy sun", "Sonne kaufen")}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {view?.shop === "sample"
            ? pick(locale, "Sample shop on this machine. A pack adds sun and does not charge a card.", "Beispielshop auf diesem Rechner. Ein Pack gibt Sonne und belastet keine Karte.")
            : view?.shop === "off"
              ? pick(locale, "Packs stay closed until Mollie is connected. Sun from reward points still falls.", "Packs bleiben zu, bis Mollie verbunden ist. Sonne aus Belohnungspunkten fällt weiter.")
              : pick(locale, "Prices are in euros and include tax. Sun arrives when the payment is confirmed. Paying asks for that delivery to start. Sun does not change the score.", "Preise sind in Euro und enthalten die Steuer. Die Sonne kommt, wenn die Zahlung bestätigt ist. Das Bezahlen bittet darum, dass diese Lieferung beginnt. Sonne ändert den Wert nicht.")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(view?.packs ?? []).map((pack) => (
            <button
              key={pack.id}
              type="button"
              className="rounded-2xl border border-border bg-card p-4 text-left disabled:opacity-50"
              onClick={() => act({ action: "buy", pack: pack.id })}
              disabled={busy || view?.shop === "off"}
            >
              <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{PACK_NAME[pack.id][locale]}</p>
              <p className="mt-2 font-display text-3xl tabular">{pack.sun}</p>
              <p className="text-sm text-muted-foreground">{pick(locale, "sun", "Sonne")}</p>
              <p className="mt-3 text-sm">{formatEur(pack.cents / 100, 2)}</p>
            </button>
          ))}
        </div>
      </section>
      <Disclaimer className="mt-8" />
    </main>
  )
}
