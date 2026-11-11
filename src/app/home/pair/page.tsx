"use client"

import Link from "next/link"
import { PairPanel } from "@/components/pair-panel"
import { useHealth } from "@/components/health-provider"
import { pick } from "@/lib/copy"

export default function PairPage() {
  const { locale } = useHealth()
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Pair", "Paar")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">{pick(locale, "Each person, their own count.", "Jede Person, ihre eigene Zählung.")}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        {pick(
          locale,
          "Every file starts with five pairs. Each 150 reward points unlocks one more. Open a name to see the last 7 daily scores beside yours, and send a line that matches their week. The shared number rises when you have both kept the morning on your own clocks. A miss resets that pair after the later morning closes, and leaves the others alone. Your own mornings stay on the file.",
          "Jede Akte startet mit fünf Paaren. Je 150 Belohnungspunkte öffnen ein weiteres. Öffne einen Namen, um die letzten 7 Tageswerte neben deinen zu sehen, und schick eine Zeile, die zur Woche passt. Die gemeinsame Zahl steigt, wenn ihr beide den Morgen auf euren eigenen Uhren gehalten habt. Ein Verpassen setzt dieses Paar zurück, sobald der spätere Morgen schließt, und lässt die anderen in Ruhe. Deine eigenen Morgen bleiben auf der Akte.",
        )}
      </p>
      <PairPanel detail />
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/home" className="text-primary">{pick(locale, "Back to today", "Zurück zu Heute")}</Link>
      </p>
    </main>
  )
}
