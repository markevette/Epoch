"use client"

import { useEffect, useState } from "react"
import { useHealth } from "@/components/health-provider"
import { Button } from "@/components/ui/button"
import { pick } from "@/lib/copy"
import { INTRO_PENDING, INTRO_SEEN, introShouldOpen } from "@/lib/intro"

const STEPS = [
  {
    en: { title: "A day, scored.", body: "Today holds the daily score. Morning, day, and night check-ins add reward points. Those points do not move the score." },
    de: { title: "Ein Tag, bewertet.", body: "Heute hält den Tageswert. Check-ins am Morgen, am Tag und in der Nacht geben Belohnungspunkte. Diese Punkte bewegen den Wert nicht." },
  },
  {
    en: { title: "A buddy, one line.", body: "A buddy sees the morning check-in and the last 7 daily scores. You can send one line a day. Their line shows on your pair." },
    de: { title: "Ein Buddy, eine Zeile.", body: "Ein Buddy sieht den Morgen-Check-in und die letzten 7 Tageswerte. Du kannst eine Zeile am Tag schicken. Deren Zeile steht an deinem Paar." },
  },
  {
    en: { title: "Practice, then the grove.", body: "Four practice doors follow your wake time and bedtime. Sun from reward points waters a tree, one pour at a time." },
    de: { title: "Übung, dann der Hain.", body: "Vier Übungstüren folgen deiner Aufwachzeit und deiner Schlafenszeit. Sonne aus Belohnungspunkten gießt einen Baum, ein Guss nach dem anderen." },
  },
  {
    en: { title: "A card you can send.", body: "The share card carries the daily score. The weekly progress a buddy can see stays off until you turn it on." },
    de: { title: "Eine Karte, die du schicken kannst.", body: "Die Teilkarte trägt den Tageswert. Der Wochenverlauf, den ein Buddy sehen kann, bleibt aus, bis du ihn einschaltest." },
  },
] as const

function standaloneApp(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
}

export function InstallerIntro() {
  const { locale } = useHealth()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const seen = window.localStorage.getItem(INTRO_SEEN) === "seen"
    const pending = window.sessionStorage.getItem(INTRO_PENDING) === "1"
    setOpen(introShouldOpen({ seen, standalone: standaloneApp(), pending }))
  }, [])

  function close() {
    window.localStorage.setItem(INTRO_SEEN, "seen")
    window.sessionStorage.removeItem(INTRO_PENDING)
    setOpen(false)
  }

  if (!open) return null
  const current = STEPS[step]
  const last = step === STEPS.length - 1
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/92 px-4" role="dialog" aria-modal="true" aria-labelledby="epoch-intro-title">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-lg">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
          {pick(locale, `Epoch · ${step + 1} of ${STEPS.length}`, `Epoch · ${step + 1} von ${STEPS.length}`)}
        </p>
        <h2 id="epoch-intro-title" className="mt-3 font-display text-4xl tracking-tight">{current[locale].title}</h2>
        <p className="mt-3 text-sm leading-6">{current[locale].body}</p>
        <div className="mt-5 flex gap-2" aria-hidden="true">
          {STEPS.map((_, index) => (
            <span key={index} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-11" onClick={close}>
            {pick(locale, "Skip", "Überspringen")}
          </Button>
          <Button
            type="button"
            className="h-11"
            onClick={() => {
              if (last) close()
              else setStep((value) => value + 1)
            }}
          >
            {last ? pick(locale, "Start", "Start") : pick(locale, "Next", "Weiter")}
          </Button>
        </div>
      </div>
    </div>
  )
}
