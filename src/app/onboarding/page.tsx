"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Disclaimer } from "@/components/disclaimer"
import { useHealth } from "@/components/health-provider"
import { MetricField } from "@/components/metric-field"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { pick, sexText } from "@/lib/copy"
import { isoDate, toHandle } from "@/lib/format"
import { currentReminderPermission, requestReminderPermission, type ReminderPermission } from "@/lib/native-reminders"
import { STARTER_INPUTS, createProfile } from "@/lib/personas"
import { todayQuest } from "@/lib/practice"
import { parseClock } from "@/lib/sleep-clock"
import type { Sex } from "@/lib/types"

const DEFAULT_WAKE = "07:00"
const DEFAULT_BED = "23:00"

export default function OnboardingPage() {
  const router = useRouter()
  const { ready, account, saveNew, signOut, locale } = useHealth()
  const steps = locale === "de" ? ["Du", "Einwilligung", "Schlaf"] : ["You", "Consent", "Sleep"]
  const [step, setStep] = useState(0)
  const [name, setName] = useState("")
  const [age, setAge] = useState(36)
  const [sex, setSex] = useState<Sex>("female")
  const [heightCm, setHeightCm] = useState(168)
  const [weightKg, setWeightKg] = useState(68)
  const [adult, setAdult] = useState(false)
  const [healthConsent, setHealthConsent] = useState(false)
  const [wake, setWake] = useState(DEFAULT_WAKE)
  const [bed, setBed] = useState(DEFAULT_BED)
  const [permission, setPermission] = useState<ReminderPermission | null>(null)
  const [saving, setSaving] = useState(false)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    if (!ready) return
    if (!account) router.replace("/login")
    else if (account.role === "admin") router.replace("/admin")
    else if (account.profile && !opening) router.replace("/home")
    else setName((current) => current || account.name)
  }, [ready, account, router, opening])

  useEffect(() => {
    void currentReminderPermission().then(setPermission)
  }, [])

  const clockOk = parseClock(wake) != null && parseClock(bed) != null

  async function finish() {
    const trimmed = name.trim()
    if (!trimmed || !adult || !healthConsent || !clockOk || saving) {
      if (!trimmed) setStep(0)
      return
    }
    setSaving(true)
    setOpening(true)
    const saved = await saveNew(
      {
        ...createProfile({
          name: trimmed,
          handle: toHandle(trimmed),
          age,
          sex,
          heightCm,
          weightKg,
          goals: ["A longer healthspan"],
          inputs: STARTER_INPUTS,
          leaderboard: false,
          trend: "flat",
          demo: false,
        }),
        locale,
        sleepClock: { wake, bed },
      },
      { healthConsent, adult },
    )
    if (!saved) {
      setSaving(false)
      setOpening(false)
      return
    }
    window.dispatchEvent(new Event("epoch-reminders"))
    const quest = todayQuest({ completions: [] }, isoDate(new Date()))
    router.push(quest ? `/home/practice/${quest.lesson.id}` : "/home")
  }

  async function allowReminders() {
    const result = await requestReminderPermission()
    setPermission(result)
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-6 md:py-10">
      <SiteHeader
        action={
          <button
            type="button"
            className="text-sm text-muted-foreground"
            onClick={() => {
              void signOut().then(() => router.replace("/login"))
            }}
          >
            {pick(locale, "Sign out", "Abmelden")}
          </button>
        }
      />
      <p className="mt-10 text-xs tracking-[0.16em] text-primary uppercase">
        {pick(locale, `Step ${step + 1} of ${steps.length}`, `Schritt ${step + 1} von ${steps.length}`)} · {steps[step]}
      </p>
      <div className="mt-3 h-1 rounded-full bg-muted">
        <div className="h-1 rounded-full bg-primary" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{pick(locale, "New files open on Free. Pro is applied by staff.", "Neue Akten öffnen auf Free. Pro setzt das Team.")}</p>

      <div className="mt-8 space-y-6">
        {step === 0 ? (
          <>
            <h1 className="font-display text-4xl leading-tight">{pick(locale, "Who is this file for?", "Für wen ist diese Akte?")}</h1>
            <div className="space-y-2">
              <Label htmlFor="name">{pick(locale, "Name", "Name")}</Label>
              <Input id="name" className="h-11" value={name} maxLength={40} placeholder={pick(locale, "Your name", "Dein Name")} onChange={(event) => setName(event.target.value)} />
            </div>
            <MetricField label={pick(locale, "Age", "Alter")} min={18} max={90} step={1} value={age} unit={pick(locale, "years", "Jahre")} onChange={setAge} />
            <MetricField label={pick(locale, "Height", "Größe")} min={140} max={220} step={1} value={heightCm} unit="cm" onChange={setHeightCm} hint={pick(locale, "Used only for BMI. It does not move biological age.", "Nur für den BMI. Es bewegt das biologische Alter nicht.")} />
            <MetricField label={pick(locale, "Weight", "Gewicht")} min={35} max={220} step={0.5} value={weightKg} unit="kg" onChange={setWeightKg} digits={1} />
            <div>
              <p className="mb-2 text-sm font-medium">{pick(locale, "Sex, for the resting-heart-rate anchor", "Geschlecht, für den Anker der Ruheherzfrequenz")}</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={pick(locale, "Sex", "Geschlecht")}>
                {(["female", "male", "other"] as Sex[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={sex === option}
                    onClick={() => setSex(option)}
                    className={`h-11 rounded-xl border ${sex === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
                  >
                    {sexText(locale, option)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{pick(locale, "Women’s resting heart rates tend to run a few beats higher, so the same number scores a little kinder.", "Die Ruheherzfrequenz von Frauen liegt oft ein paar Schläge höher, deshalb bewertet dieselbe Zahl etwas freundlicher.")}</p>
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1 className="font-display text-4xl leading-tight">{pick(locale, "Two checks before the file opens", "Zwei Haken, bevor die Akte aufgeht")}</h1>
            <label className="flex items-start gap-3 text-sm leading-6">
              <input type="checkbox" className="mt-1 size-4" checked={adult} onChange={(event) => setAdult(event.target.checked)} />
              <span>{pick(locale, "I am 18 or older. Epoch is for adults. A clinician diagnoses illness and prescribes treatment.", "Ich bin 18 oder älter. Epoch ist für Erwachsene. Eine Ärztin oder ein Arzt stellt Diagnosen und behandelt.")}</span>
            </label>
            <label className="flex items-start gap-3 text-sm leading-6">
              <input type="checkbox" className="mt-1 size-4" checked={healthConsent} onChange={(event) => setHealthConsent(event.target.checked)} />
              <span>
                {pick(
                  locale,
                  "I consent to Epoch storing health data in this file, including sleep, heart-rate variability, resting heart rate, stress, meals, and workouts. The file sits on a server in the European Union. Staff can open it. A buddy sees seven daily scores. Meals and workouts stay private. This consent is separate from creating the account. The details are in the",
                  "Ich willige ein, dass Epoch Gesundheitsdaten in dieser Akte speichert, darunter Schlaf, Herzfrequenzvariabilität, Ruheherzfrequenz, Stress, Mahlzeiten und Training. Die Akte liegt auf einem Server in der Europäischen Union. Das Team kann sie öffnen. Ein Buddy sieht sieben Tageswerte. Mahlzeiten und Training bleiben privat. Diese Einwilligung ist getrennt vom Anlegen des Kontos. Die Einzelheiten stehen in der",
                )}{" "}
                <Link href="/legal/privacy" className="text-primary hover:underline">{pick(locale, "privacy notice", "Datenschutzerklärung")}</Link>.
              </span>
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="font-display text-4xl leading-tight">{pick(locale, "When should the lesson arrive?", "Wann soll die Übung kommen?")}</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {pick(
                locale,
                "Wake time and bedtime stay on this file. Allow reminders so today’s lesson can appear at those times on this device.",
                "Aufwachzeit und Schlafenszeit bleiben auf dieser Akte. Erlaube Erinnerungen, dann kann die Übung von heute zu diesen Zeiten auf diesem Gerät erscheinen.",
              )}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                {pick(locale, "Wake time", "Aufwachzeit")}
                <input
                  type="time"
                  value={wake}
                  onChange={(event) => setWake(event.target.value)}
                  className="h-11 rounded-lg border border-input bg-transparent px-3 text-base"
                />
              </label>
              <label className="grid gap-1 text-sm">
                {pick(locale, "Bedtime", "Schlafenszeit")}
                <input
                  type="time"
                  value={bed}
                  onChange={(event) => setBed(event.target.value)}
                  className="h-11 rounded-lg border border-input bg-transparent px-3 text-base"
                />
              </label>
            </div>
            {permission == null || permission === "default" ? (
              <Button type="button" variant="outline" className="h-11" onClick={() => void allowReminders()}>
                {pick(locale, "Allow reminders", "Erinnerungen erlauben")}
              </Button>
            ) : permission === "granted" ? (
              <p className="text-sm text-muted-foreground">{pick(locale, "Reminders are on for this device.", "Erinnerungen sind auf diesem Gerät an.")}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{pick(locale, "These times still stay on the file.", "Diese Zeiten bleiben trotzdem auf der Akte.")}</p>
            )}
          </>
        ) : null}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="outline" className="h-11 px-4" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>
          {pick(locale, "Back", "Zurück")}
        </Button>
        {step < steps.length - 1 ? (
          <Button
            className="h-11 px-4"
            disabled={(step === 0 && name.trim().length === 0) || (step === 1 && (!adult || !healthConsent))}
            onClick={() => setStep((value) => value + 1)}
          >
            {pick(locale, "Continue", "Weiter")}
          </Button>
        ) : (
          <Button className="h-11 px-4" onClick={() => void finish()} disabled={name.trim().length === 0 || !adult || !healthConsent || !clockOk || saving}>
            {pick(locale, "Open today’s lesson", "Die Übung von heute öffnen")}
          </Button>
        )}
      </div>
      <Disclaimer className="mt-10" />
    </main>
  )
}
