"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Disclaimer } from "@/components/disclaimer"
import { useHealth } from "@/components/health-provider"
import { appFetch } from "@/lib/browser-api"
import { bmiText, confidenceText, driverLabel, driverNote, presentAction, presentFlag, presentTip, sexText, translateError, pick } from "@/lib/copy"
import { MetricField } from "@/components/metric-field"
import { ScoreRing } from "@/components/score-ring"
import { TrendChart } from "@/components/trend-chart"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { bmi, bmiBand } from "@/lib/body"
import { formatLongDate, formatSigned, formatYears, isoDate, toHandle } from "@/lib/format"
import { BEHAVIOR_YEARS_PER_POINT, NEUTRAL_SCORE, WEIGHTS, hrvTarget, loggedDayCount } from "@/lib/score"
import { MealCalories } from "@/components/meal-calories"
import { WorkoutToday } from "@/components/workout-today"
import { PairPanel } from "@/components/pair-panel"
import { RewardCheckIn } from "@/components/reward-check-in"
import { rewardPointsForAction, summarizeRewards } from "@/lib/rewards"
import { dailyTip } from "@/lib/tip"
import { presentToday, todayQuests, trackLabel } from "@/lib/practice"
import type { DriverResult, Inputs, Sex } from "@/lib/types"

const panel = "rounded-2xl border border-border bg-card p-5"

export default function TodayPage() {
  const router = useRouter()
  const health = useHealth()
  const { profile, account, model, series, plan, movement, movementLabel, logToday, claimReward, logMeals, logWorkout, updateInputs, updateIdentity, signOut, locale } = health
  const [logging, setLogging] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState("")
  const [deleteNote, setDeleteNote] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [claimMorning, setClaimMorning] = useState(false)
  const [editing, setEditing] = useState(false)
  const [method, setMethod] = useState(false)
  const [daily, setDaily] = useState<Pick<Inputs, "sleepHours" | "hrv" | "restingHr" | "steps" | "stress">>({
    sleepHours: 7,
    hrv: 45,
    restingHr: 60,
    steps: 7000,
    stress: 4,
  })
  const [draft, setDraft] = useState({ name: "", age: 36, sex: "female" as Sex, heightCm: 170, weightKg: 70 })

  if (!profile || !model) return null
  const today = isoDate(new Date())
  const loggedToday = profile.history.some((day) => day.date === today && day.source === "logged")
  const logged = loggedDayCount(profile.history)
  const bodyMass = bmi(profile.heightCm, profile.weightKg)
  const bodyBand = bmiBand(bodyMass)
  const tip = presentTip(locale, dailyTip({ date: today, drivers: model.drivers, bmi: bodyMass }))
  const lever = plan[0] ? presentAction(locale, plan[0]) : null
  const rewardTotal = summarizeRewards(profile.rewards, new Date(), profile.nudgePoints ?? 0).total
  const dayChecked = profile.rewards.some((entry) => entry.date === today && entry.slot === "day")

  function openLog(morning = false) {
    setClaimMorning(morning)
    setDaily({
      sleepHours: profile!.inputs.sleepHours,
      hrv: profile!.inputs.hrv,
      restingHr: profile!.inputs.restingHr,
      steps: profile!.inputs.steps,
      stress: profile!.inputs.stress,
    })
    setLogging(true)
  }

  async function removeAccount() {
    setDeleting(true)
    setDeleteNote(null)
    const response = await appFetch("/api/account", { method: "DELETE" })
    setDeleting(false)
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      setDeleteNote(data?.error ?? "The file is still here.")
      return
    }
    await signOut()
    router.replace("/login")
  }

  function openIdentity() {
    setDraft({
      name: profile!.name,
      age: profile!.age,
      sex: profile!.sex,
      heightCm: profile!.heightCm,
      weightKg: profile!.weightKg,
    })
    setEditing(true)
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{formatLongDate(today, locale)}</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight md:text-5xl">{pick(locale, `${profile.name.split(" ")[0]}’s file`, `Die Datei von ${profile.name.split(" ")[0]}`)}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {pick(locale, "Your day in one place. Log meals and whether you worked out, check in, and keep mornings with buddies. Five pairs are open, and each 150 reward points unlocks one more.", "Dein Tag an einem Ort. Trag Mahlzeiten und Training ein, checke ein und halte die Morgen mit Buddies. Fünf Paare sind offen, und je 150 Belohnungspunkte öffnen eines mehr.")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-10" onClick={openIdentity}>
            {pick(locale, "Edit file", "Akte bearbeiten")}
          </Button>
          <Button className="h-10" onClick={() => openLog(false)}>
            {loggedToday ? pick(locale, "Update today", "Heute aktualisieren") : pick(locale, "Log today", "Heute eintragen")}
          </Button>
        </div>
      </div>
      {health.error ? <p className="mt-4 text-sm text-copper">{translateError(locale, health.error)}</p> : null}

      <QuestCard />

      <MealCalories meals={profile.meals} onSave={logMeals} />
      <WorkoutToday workouts={profile.workouts} onSave={logWorkout} />

      <RewardCheckIn
        rewards={profile.rewards}
        history={profile.history}
        tipTitle={tip.title}
        hasAction={Boolean(lever)}
        actionPoints={lever ? rewardPointsForAction(lever.points) : 0}
        extraPoints={profile.nudgePoints ?? 0}
        onClaim={claimReward}
        onLogSleep={() => openLog(true)}
      />

      <PairPanel />

      <section className="mt-4 grid gap-4 lg:grid-cols-12">
        <article className={`${panel} lg:col-span-5`}>
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Estimated biological age", "Geschätztes biologisches Alter")}</p>
          <p className="mt-4 font-display text-7xl tabular leading-none md:text-8xl">{model.biologicalAge.toFixed(1)}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            {pick(locale, `Chronological age ${profile.age}.`, `Chronologisches Alter ${profile.age}.`)} {formatYears(model.ageDelta, locale)}.
          </p>
          <div className="mt-5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{confidenceText(locale, model.confidenceLabel)}</span>
              <span className="tabular">{Math.round(model.confidence * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-muted">
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${model.confidence * 100}%` }} />
            </div>
          </div>
          <button type="button" className="mt-4 text-sm text-primary underline-offset-4 hover:underline" onClick={() => setMethod(true)}>
            {pick(locale, "How this number is made", "Wie diese Zahl entsteht")}
          </button>
        </article>
        <article className={`${panel} flex flex-col items-center justify-center lg:col-span-3`}>
          <ScoreRing score={model.longevityScore} />
          <p className="mt-2 text-center text-xs tracking-[0.14em] text-muted-foreground uppercase">{pick(locale, "Longevity score", "Longevity-Wert")}</p>
          <p className="mt-4 font-display text-3xl tabular leading-none">{rewardTotal}</p>
          <p className="mt-1 text-center text-xs tracking-[0.14em] text-muted-foreground uppercase">{pick(locale, "Reward points", "Belohnungspunkte")}</p>
          <p className="mt-2 max-w-48 text-center text-xs leading-5 text-muted-foreground">{pick(locale, "Each 150 points unlocks one more buddy. They do not move the score.", "Je 150 Punkte öffnen einen weiteren Buddy. Sie bewegen den Wert nicht.")}</p>
        </article>
        <article className={`${panel} lg:col-span-4`}>
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Today’s lever", "Der Hebel von heute")}</p>
          {lever ? (
            <>
              <h2 className="mt-3 font-display text-3xl leading-tight">{lever.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{lever.detail}</p>
              <p className="mt-4 text-sm">
                {pick(locale, "Done adds", "Erledigt gibt")} <span className="font-medium tabular">{rewardPointsForAction(lever.points)} {pick(locale, "reward points", "Belohnungspunkte")}</span>.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{pick(locale, "Biological age stays on the logged file.", "Das biologische Alter bleibt auf der erfassten Akte.")}</p>
            </>
          ) : (
            <>
              <h2 className="mt-3 font-display text-3xl leading-tight">{pick(locale, "The week can stay steady.", "Die Woche kann ruhig bleiben.")}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{pick(locale, "The model only writes an action when a gap is large enough to be worth a week of attention.", "Das Modell schreibt nur dann eine Handlung, wenn eine Lücke groß genug für eine Woche Aufmerksamkeit ist.")}</p>
            </>
          )}
        </article>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-12">
        <article className={`${panel} lg:col-span-5`}>
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Body mass index", "Body-Mass-Index")}</p>
          <p className="mt-4 font-display text-6xl tabular leading-none">{bodyMass.toFixed(1)}</p>
          <p className="mt-3 text-sm">{bmiText(locale, bodyBand)}</p>
          <p className="mt-1 text-sm text-muted-foreground tabular">
            {profile.heightCm} cm · {profile.weightKg.toFixed(1)} kg
          </p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {pick(locale, "Weight divided by height squared. Muscle and frame are invisible to it, and it does not move biological age.", "Gewicht geteilt durch Größe im Quadrat. Muskel und Statur sieht er nicht, und er bewegt das biologische Alter nicht.")}
          </p>
          <button type="button" className="mt-4 text-sm text-primary underline-offset-4 hover:underline" onClick={openIdentity}>
            {pick(locale, "Update height and weight", "Größe und Gewicht aktualisieren")}
          </button>
        </article>
        <article data-tone="tip" className={`${panel} lg:col-span-7`}>
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Tip of the day", "Tipp des Tages")}</p>
          <p className="mt-3 text-xs tracking-[0.14em] text-primary uppercase">{tip.subject}</p>
          <h2 className="mt-2 font-display text-3xl leading-tight">{tip.title}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{tip.body}</p>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {dayChecked ? pick(locale, "Still the note for today.", "Noch der Hinweis für heute.") : pick(locale, "The same tip holds until tomorrow.", "Derselbe Tipp gilt bis morgen.")}
          </p>
        </article>
      </section>

      {model.flags.length > 0 ? (
        <ul className="mt-4 grid gap-2">
            {model.flags.map((flag) => (
              <li key={flag} className="rounded-2xl border border-copper/30 bg-card px-4 py-3 text-sm leading-6">
                {presentFlag(locale, flag)}
              </li>
            ))}
        </ul>
      ) : null}

      <section className="mt-4 grid gap-4 lg:grid-cols-12">
        <article className={`${panel} lg:col-span-7`}>
          <h2 className="font-display text-2xl">{pick(locale, "Drivers", "Faktoren")}</h2>
          <div className="mt-4 grid gap-4">
            {model.drivers.map((driver) => (
              <DriverRow key={driver.key} driver={driver} locale={locale} age={profile.age} inputs={profile.inputs} />
            ))}
          </div>
        </article>
        <article className={`${panel} lg:col-span-5`}>
          <h2 className="font-display text-2xl">{pick(locale, "Where the file stands", "Wo die Akte steht")}</h2>
          <ul className="mt-4 grid gap-3 text-sm">
            <li className="flex justify-between gap-4 border-b border-border pb-3">
              <span>{pick(locale, "Questionnaire", "Fragebogen")}</span>
              <span className="text-muted-foreground">{pick(locale, "On file", "Auf der Akte")}</span>
            </li>
            <li className="flex justify-between gap-4 border-b border-border pb-3">
              <span>{pick(locale, "Logged days", "Erfasste Tage")}</span>
              <span className="text-muted-foreground tabular">{logged} of {profile.history.length}</span>
            </li>
          </ul>
        </article>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-12">
          <article className={`${panel} lg:col-span-7`}>
            <h2 className="font-display text-2xl">{pick(locale, "Thirty days", "Dreißig Tage")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.trend === "improving" && profile.demo
                ? pick(locale, "Avery’s earlier days are a modeled recovery, drifting toward the numbers on file today.", "Averys frühere Tage sind eine modellierte Erholung, die auf die Zahlen von heute zuläuft.")
                : pick(locale, "Earlier days are a modeled baseline around your answers. Logged days replace them.", "Frühere Tage sind eine modellierte Basis um deine Antworten. Erfasste Tage ersetzen sie.")}
            </p>
            <div className="mt-4">
              <TrendChart points={series} />
            </div>
          </article>
          <article className={`${panel} lg:col-span-5`}>
            <h2 className="font-display text-2xl">{pick(locale, "What moved the score", "Was den Wert bewegt hat")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{pick(locale, movementLabel, movementLabel.startsWith("Since a logged") ? "Seit einem erfassten Tag der letzten Woche" : movementLabel.startsWith("Since the modeled") ? "Seit dem geschätzten Tag vor einer Woche" : movementLabel)}</p>
            {movement.length === 0 ? (
              <p className="mt-4 text-sm leading-6">{pick(locale, "The week held steady. Nothing shifted the score by enough to name.", "Die Woche blieb ruhig. Nichts hat den Wert genug verschoben, um es zu benennen.")}</p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {movement.map((item) => (
                  <li key={item.key} className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{driverLabel(locale, item.key)}</span>
                    <span className={`tabular ${item.points >= 0 ? "text-primary" : "text-copper"}`}>{formatSigned(item.points)} {pick(locale, "on the score", "auf dem Wert")}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

      <section className={`${panel} mt-4`}>
        <h2 className="font-display text-2xl">{pick(locale, "Weekly habits", "Wochengwohnheiten")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{pick(locale, "These are weekly patterns. Change them when the week changes, not every morning.", "Das sind Wochenmuster. Ändere sie, wenn die Woche sich ändert, nicht jeden Morgen.")}</p>
        <div className="mt-5 grid gap-5">
          <MetricField label={pick(locale, "Easy cardio", "Lockeres Cardio")} min={0} max={300} step={10} value={profile.inputs.zone2Minutes} unit={pick(locale, "min/wk", "Min./Woche")} onChange={(value) => updateInputs({ ...profile.inputs, zone2Minutes: value })} hint={pick(locale, "A pace where you can still talk in full sentences.", "Ein Tempo, bei dem du noch in ganzen Sätzen sprechen kannst.")} />
          <MetricField label={pick(locale, "Strength sessions", "Krafteinheiten")} min={0} max={7} step={1} value={profile.inputs.strengthSessions} unit={pick(locale, "/week", "/Woche")} onChange={(value) => updateInputs({ ...profile.inputs, strengthSessions: value })} />
          <MetricField label={pick(locale, "Sleep consistency", "Schlafregelmäßigkeit")} min={0} max={10} step={1} value={profile.inputs.sleepConsistency} unit="/10" onChange={(value) => updateInputs({ ...profile.inputs, sleepConsistency: value })} />
          <MetricField label={pick(locale, "Protein", "Protein")} min={0} max={10} step={1} value={profile.inputs.protein} unit="/10" onChange={(value) => updateInputs({ ...profile.inputs, protein: value })} />
          <MetricField label={pick(locale, "Fiber", "Ballaststoffe")} min={0} max={10} step={1} value={profile.inputs.fiber} unit="/10" onChange={(value) => updateInputs({ ...profile.inputs, fiber: value })} />
          <MetricField label={pick(locale, "Alcohol", "Alkohol")} min={0} max={20} step={1} value={profile.inputs.alcoholPerWeek} unit={pick(locale, "drinks", "Getränke")} onChange={(value) => updateInputs({ ...profile.inputs, alcoholPerWeek: value })} />
          <MetricField label={pick(locale, "Sweets", "Süßes")} min={0} max={10} step={1} value={profile.inputs.addedSugar} unit="/10" onChange={(value) => updateInputs({ ...profile.inputs, addedSugar: value })} />
        </div>
      </section>

      <Disclaimer className="mt-8" />

      <Dialog open={logging} onOpenChange={setLogging}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pick(locale, "Log today", "Heute eintragen")}</DialogTitle>
            <DialogDescription>
              {claimMorning
                ? pick(locale, "Saving this puts last night’s sleep on the file and keeps the morning check-in.", "Speichern legt den Schlaf der letzten Nacht auf die Akte und hält den Morgen-Check-in.")
                : pick(locale, "Five numbers. Weekly habits such as easy cardio stay as you set them below.", "Fünf Zahlen. Wochengwohnheiten wie lockeres Cardio bleiben, wie du sie unten setzt.")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <MetricField label={pick(locale, "Sleep", "Schlaf")} min={4} max={11} step={0.1} value={daily.sleepHours} unit={pick(locale, "hours", "Stunden")} onChange={(value) => setDaily((current) => ({ ...current, sleepHours: value }))} />
            <MetricField label={driverLabel(locale, "hrv")} min={10} max={120} step={1} value={daily.hrv} unit="ms" onChange={(value) => setDaily((current) => ({ ...current, hrv: value }))} hint={pick(locale, "The gap between heartbeats, usually from a watch.", "Der Abstand zwischen den Herzschlägen, meist von einer Uhr.")} />
            <MetricField label={driverLabel(locale, "restingHr")} min={40} max={110} step={1} value={daily.restingHr} unit="bpm" onChange={(value) => setDaily((current) => ({ ...current, restingHr: value }))} hint={pick(locale, "The morning pulse, before coffee and stairs.", "Der Morgenpuls, vor Kaffee und Treppe.")} />
            <MetricField label={pick(locale, "Steps", "Schritte")} min={0} max={20000} step={100} value={daily.steps} unit={pick(locale, "steps", "Schritte")} onChange={(value) => setDaily((current) => ({ ...current, steps: value }))} />
            <MetricField label={pick(locale, "Stress", "Stress")} min={0} max={10} step={0.5} value={daily.stress} unit="/10" onChange={(value) => setDaily((current) => ({ ...current, stress: value }))} />
          </div>
          <Button
            className="h-11"
            onClick={() => {
              void logToday(daily, { claimMorning }).then(() => {
                setLogging(false)
                setClaimMorning(false)
              })
            }}
          >
            {pick(locale, "Save today", "Heute speichern")}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pick(locale, "File details", "Angaben zur Akte")}</DialogTitle>
            <DialogDescription>{pick(locale, "Age changes the heart-rate variability target. The history stays.", "Das Alter ändert das Ziel der Herzfrequenzvariabilität. Der Verlauf bleibt.")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor="file-name">{pick(locale, "Name", "Name")}</Label>
              <Input id="file-name" className="h-11" value={draft.name} maxLength={40} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <MetricField label={pick(locale, "Age", "Alter")} min={18} max={90} step={1} value={draft.age} unit={pick(locale, "years", "Jahre")} onChange={(value) => setDraft((current) => ({ ...current, age: value }))} />
            <MetricField label={pick(locale, "Height", "Größe")} min={140} max={220} step={1} value={draft.heightCm} unit="cm" onChange={(value) => setDraft((current) => ({ ...current, heightCm: value }))} />
            <MetricField label={pick(locale, "Weight", "Gewicht")} min={35} max={220} step={0.5} value={draft.weightKg} unit="kg" digits={1} onChange={(value) => setDraft((current) => ({ ...current, weightKg: value }))} />
            <div className="grid grid-cols-3 gap-2">
              {(["female", "male", "other"] as Sex[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, sex: option }))}
                  className={`h-10 rounded-xl border capitalize ${draft.sex === option ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                >
                  {sexText(locale, option)}
                </button>
              ))}
            </div>
          </div>
          <Button
            className="h-11"
            disabled={draft.name.trim().length === 0}
            onClick={() => {
              updateIdentity({
                name: draft.name.trim(),
                age: draft.age,
                sex: draft.sex,
                handle: toHandle(draft.name),
                heightCm: draft.heightCm,
                weightKg: draft.weightKg,
              })
              setEditing(false)
            }}
          >
            {pick(locale, "Save file", "Akte speichern")}
          </Button>
        </DialogContent>
      </Dialog>

      <section className={`${panel} mt-8`}>
        <h2 className="font-display text-2xl">{pick(locale, "Delete this file", "Diese Akte löschen")}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {pick(locale, "This removes your account. Type", "Das entfernt dein Konto. Tippe")} {account?.email} {pick(locale, "to confirm.", "zur Bestätigung.")}
        </p>
        <Input className="mt-4 h-11 max-w-md" value={confirmDelete} onChange={(event) => setConfirmDelete(event.target.value)} autoComplete="off" />
        <Button className="mt-3 h-10" variant="outline" disabled={deleting || confirmDelete.trim().toLowerCase() !== account?.email} onClick={() => void removeAccount()}>
          {pick(locale, "Delete this file", "Diese Akte löschen")}
        </Button>
        {deleteNote ? <p className="mt-3 text-sm text-copper">{translateError(locale, deleteNote)}</p> : null}
      </section>

      <Dialog open={method} onOpenChange={setMethod}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{pick(locale, "How this number is made", "Wie diese Zahl entsteht")}</DialogTitle>
            <DialogDescription>
              {pick(locale, `A score of ${NEUTRAL_SCORE} sits on chronological age. Each behavior point is ${BEHAVIOR_YEARS_PER_POINT} years. Sleep, fitness, food, and stress are what move it.`, `Ein Wert von ${NEUTRAL_SCORE} liegt auf dem chronologischen Alter. Jeder Verhaltenspunkt sind ${BEHAVIOR_YEARS_PER_POINT} Jahre. Schlaf, Fitness, Essen und Stress bewegen ihn.`)}
            </DialogDescription>
          </DialogHeader>
          <ul className="grid gap-2 text-sm">
            {model.drivers.map((driver) => (
              <li key={driver.key} className="flex justify-between">
                <span>{driverLabel(locale, driver.key)}</span>
                <span className="tabular text-muted-foreground">{Math.round(WEIGHTS[driver.key] * 100)}%</span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-5 text-muted-foreground">
            {pick(locale, "Resting heart rate is shifted a few beats before scoring so a typical female rate is judged fairly. Ranges point the same direction as common preventive guidance. They are wellness bands for this product, and a clinician’s cutoff can differ. Height and weight produce the BMI beside this number. They stay out of the formula. Reward points from check-ins stay out of it too.", "Die Ruheherzfrequenz wird vor der Wertung um ein paar Schläge verschoben, damit eine typische weibliche Frequenz fair liegt. Die Bereiche zeigen in dieselbe Richtung wie übliche Vorsorge. Es sind Wellness-Bänder für dieses Produkt, und eine ärztliche Grenze kann anders liegen. Größe und Gewicht ergeben den BMI neben dieser Zahl. Sie bleiben aus der Formel. Belohnungspunkte aus Check-ins auch.")}
          </p>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function QuestCard() {
  const { profile, locale } = useHealth()
  if (!profile) return null
  const today = isoDate(new Date())
  const quests = todayQuests(profile.practice ?? { completions: [] }, today)
  const open = quests.filter((quest) => quest.status === "open")
  const shown = open.length > 0 ? open : quests
  if (shown.length === 0) return null
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Today’s doors", "Die Türen von heute")}</p>
      <ol className="mt-3 grid gap-3">
        {shown.map((quest) => {
          const lesson = presentToday(locale, quest.lesson, today)
          return (
            <li key={quest.lesson.id}>
              <p className="text-xs text-muted-foreground">{trackLabel(locale, quest.lesson.track)}</p>
              <h2 className="mt-1 font-display text-2xl tracking-tight">{lesson.title}</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{quest.status === "done" ? lesson.doneLine : lesson.action}</p>
              <Link href={`/home/practice/${quest.lesson.id}`} className="mt-2 inline-flex text-sm text-primary">
                {quest.status === "done" ? pick(locale, "See the lesson", "Die Lektion ansehen") : pick(locale, "Open the lesson", "Die Lektion öffnen")}
              </Link>
            </li>
          )
        })}
      </ol>
      {profile.sleepClock ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {pick(locale, `Wake ${profile.sleepClock.wake}. Bed ${profile.sleepClock.bed}.`, `Aufwachzeit ${profile.sleepClock.wake}. Schlafenszeit ${profile.sleepClock.bed}.`)}
        </p>
      ) : null}
    </section>
  )
}

function DriverRow({ driver, locale, age, inputs }: { driver: DriverResult; locale: "en" | "de"; age: number; inputs: Inputs }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{driverLabel(locale, driver.key)}</span>
        <span className="tabular">{Math.round(driver.score)}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-muted">
        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.max(2, driver.score)}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {driverNote(locale, driver.key, inputs, age, hrvTarget(age))} · {Math.round(driver.weight * 100)}% {pick(locale, "of the score", "des Werts")}
      </p>
    </div>
  )
}
