"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useHealth } from "@/components/health-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { pick } from "@/lib/copy"
import { isBuddyWeekPath } from "@/lib/app-paths"
import { isoDate } from "@/lib/format"
import { normalizeGrove, presentGrove } from "@/lib/grove"
import { groveNudge, groveReminderDue } from "@/lib/grove-reminders"
import {
  currentReminderPermission,
  onNativeAppResume,
  onNativeReminderOpen,
  requestReminderPermission,
  type ReminderPermission,
} from "@/lib/native-reminders"
import { lessonById, presentToday } from "@/lib/practice"
import { summarizeRewards } from "@/lib/rewards"
import { cleanSleepClock, dueReminder, minutesNow, parseClock, reminderNotification } from "@/lib/sleep-clock"
import { holdPushReminders, requestDemoReminder, type PushHold } from "@/lib/push-client"
import { armGroveReminder, armScheduledReminders, showGroveReminder, showReminder } from "@/lib/sleep-reminders"

function statusLine(
  locale: "en" | "de",
  note: "saved" | "failed" | null,
  permission: ReminderPermission | null,
  saved: boolean,
  push: PushHold,
) {
  if (note === "failed") return pick(locale, "Those times stayed off the file.", "Diese Zeiten blieben von der Akte.")
  if (permission === "granted" && push === "armed") {
    return pick(
      locale,
      "These times stay on your file. Reminders can appear on this device while Epoch is closed.",
      "Diese Zeiten bleiben auf deiner Akte. Erinnerungen können auf diesem Gerät erscheinen, während Epoch geschlossen ist.",
    )
  }
  if (permission === "granted" && push === "open-only") {
    return pick(
      locale,
      "These times stay on your file. This browser shows reminders while Epoch is open. Add Epoch to the home screen so they can arrive while it is closed.",
      "Diese Zeiten bleiben auf deiner Akte. Dieser Browser zeigt Erinnerungen, solange Epoch offen ist. Lege Epoch auf den Home-Bildschirm, dann können sie kommen, während es geschlossen ist.",
    )
  }
  if (permission === "granted") {
    return pick(locale, "These times stay on your file. Reminders are on for this device.", "Diese Zeiten bleiben auf deiner Akte. Erinnerungen sind auf diesem Gerät an.")
  }
  if (!saved && note !== "saved") {
    return pick(locale, "Allow reminders and today’s four doors can appear on this device at those times.", "Erlaube Erinnerungen, dann können die vier Türen von heute auf diesem Gerät zu diesen Zeiten erscheinen.")
  }
  return pick(locale, "These times stay on your file.", "Diese Zeiten bleiben auf deiner Akte.")
}

const DISMISSED_KEY = "epoch.sleep-dismissed"
const NOTIFIED_KEY = "epoch.sleep-notified"

function dayKey(id: string, today = isoDate(new Date())) {
  return `${id}:${today}`
}

export function SleepClockCard() {
  const { profile, locale, saveSleepClock } = useHealth()
  const saved = profile?.sleepClock ?? null
  const [wake, setWake] = useState(saved?.wake ?? "")
  const [bed, setBed] = useState(saved?.bed ?? "")
  const [pending, setPending] = useState(false)
  const [note, setNote] = useState<"saved" | "failed" | null>(null)
  const [permission, setPermission] = useState<ReminderPermission | null>(null)
  const [push, setPush] = useState<PushHold>("skipped")
  const [demoPending, setDemoPending] = useState(false)
  const [demoNote, setDemoNote] = useState<"sent" | "allow" | "home" | "failed" | null>(null)

  useEffect(() => {
    if (saved) {
      setWake(saved.wake)
      setBed(saved.bed)
    }
  }, [saved])

  useEffect(() => {
    void currentReminderPermission().then(setPermission)
  }, [])

  useEffect(() => {
    let cancelled = false
    const sync = () => {
      void holdPushReminders(locale).then((next) => {
        if (!cancelled) setPush(next)
      })
    }
    sync()
    window.addEventListener("epoch-reminders", sync)
    return () => {
      cancelled = true
      window.removeEventListener("epoch-reminders", sync)
    }
  }, [locale])

  if (!profile) return null
  const valid = parseClock(wake) != null && parseClock(bed) != null

  async function save() {
    if (!valid || pending) return
    setPending(true)
    const ok = await saveSleepClock({ wake, bed })
    setPending(false)
    setNote(ok ? "saved" : "failed")
    if (ok) window.dispatchEvent(new Event("epoch-reminders"))
  }

  async function allow() {
    const result = await requestReminderPermission()
    setPermission(result)
    window.dispatchEvent(new Event("epoch-reminders"))
  }

  async function sendTest() {
    if (demoPending) return
    setDemoPending(true)
    setDemoNote(null)
    let hold = await holdPushReminders(locale)
    if (hold === "skipped") {
      const result = await requestReminderPermission()
      setPermission(result)
      window.dispatchEvent(new Event("epoch-reminders"))
      hold = result === "granted" ? await holdPushReminders(locale) : "skipped"
    }
    if (hold !== "armed") {
      setDemoNote(hold === "open-only" ? "home" : "allow")
      setDemoPending(false)
      return
    }
    const result = await requestDemoReminder()
    setDemoNote(result === "scheduled" ? "sent" : "failed")
    setDemoPending(false)
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Wake time and bedtime", "Aufwachzeit und Schlafenszeit")}</p>
      <p className="mt-2 max-w-xl text-sm leading-6">
        {pick(
          locale,
          "Save the time you woke up, and the time you plan to sleep. Those two times place four reminders: sleep at wake, movement five hours later, nutrition seven hours later, stress one hour before bed. Each reminder opens today’s door on that branch. You mark it done there. Once reminders are allowed, they can appear while Epoch is closed.",
          "Speichere die Zeit, zu der du aufgewacht bist, und die Zeit, zu der du schlafen willst. Diese zwei Zeiten setzen vier Erinnerungen: Schlaf zur Aufwachzeit, Bewegung fünf Stunden später, Ernährung sieben Stunden später, Stress eine Stunde vor dem Schlafen. Jede Erinnerung öffnet die Tür von heute auf diesem Zweig. Dort markierst du sie als erledigt. Wenn Erinnerungen erlaubt sind, können sie erscheinen, während Epoch geschlossen ist.",
        )}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-11" disabled={demoPending} onClick={() => void sendTest()}>
          {pick(locale, "Send a test reminder", "Eine Test-Erinnerung senden")}
        </Button>
        {permission == null || permission === "default" ? (
          <Button type="button" variant="outline" className="h-11" onClick={() => void allow()}>
            {pick(locale, "Allow reminders", "Erinnerungen erlauben")}
          </Button>
        ) : null}
      </div>
      {demoNote === "sent" ? (
        <p className="mt-3 text-sm leading-6">{pick(locale, "Close Epoch. A test reminder should appear in about 20 seconds.", "Schließe Epoch. Eine Test-Erinnerung sollte in etwa 20 Sekunden erscheinen.")}</p>
      ) : null}
      {demoNote === "allow" ? (
        <p className="mt-3 text-sm leading-6">{pick(locale, "Allow reminders, then send the test again.", "Erlaube Erinnerungen, dann sende den Test erneut.")}</p>
      ) : null}
      {demoNote === "home" ? (
        <p className="mt-3 text-sm leading-6">{pick(locale, "Add Epoch to the home screen, open it from that icon, allow reminders, then send the test.", "Lege Epoch auf den Home-Bildschirm, öffne es von dort, erlaube Erinnerungen, und sende dann den Test.")}</p>
      ) : null}
      {demoNote === "failed" ? (
        <p className="mt-3 text-sm leading-6 text-copper">{pick(locale, "The test reminder could not be sent. Wait a minute and try again.", "Die Test-Erinnerung konnte nicht gesendet werden. Warte eine Minute und versuche es erneut.")}</p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          {pick(locale, "Wake time", "Aufwachzeit")}
          <input
            type="time"
            value={wake}
            onChange={(event) => { setWake(event.target.value); setNote(null) }}
            className="h-11 rounded-lg border border-input bg-transparent px-3 text-base"
          />
        </label>
        <label className="grid gap-1 text-sm">
          {pick(locale, "Bedtime", "Schlafenszeit")}
          <input
            type="time"
            value={bed}
            onChange={(event) => { setBed(event.target.value); setNote(null) }}
            className="h-11 rounded-lg border border-input bg-transparent px-3 text-base"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" className="h-11" disabled={!valid || pending} onClick={() => void save()}>
          {pick(locale, "Save these times", "Diese Zeiten speichern")}
        </Button>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{statusLine(locale, note, permission, Boolean(saved), push)}</p>
    </section>
  )
}

export function SleepReminderHost() {
  const { profile, locale } = useHealth()
  const router = useRouter()
  const [due, setDue] = useState<string | null>(null)
  const [lift, setLift] = useState(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const url = event.data?.type === "epoch-open" ? event.data.url : null
      if (url === "/home/grove" || url === "/home/pair" || url === "/home/practice" || (typeof url === "string" && isBuddyWeekPath(url))) {
        router.push(url)
        return
      }
      if (typeof url !== "string" || !url.startsWith("/home/practice/")) return
      const id = url.slice("/home/practice/".length)
      if (!lessonById(id)) return
      router.push(url)
    }
    navigator.serviceWorker.addEventListener("message", onMessage)
    return () => navigator.serviceWorker.removeEventListener("message", onMessage)
  }, [router])

  useEffect(() => onNativeReminderOpen((url) => router.push(url)), [router])

  useEffect(() => onNativeAppResume(() => window.dispatchEvent(new Event("epoch-reminders"))), [])

  useEffect(() => {
    void holdPushReminders(locale)
    const onArm = () => void holdPushReminders(locale)
    window.addEventListener("epoch-reminders", onArm)
    return () => window.removeEventListener("epoch-reminders", onArm)
  }, [locale])

  useEffect(() => {
    const root = document.documentElement
    const read = () => setLift(root.dataset.installBanner === "true")
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ["data-install-banner"] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const clock = cleanSleepClock(profile?.sleepClock)
    const log = profile?.practice ?? { completions: [] }

    async function tick() {
      if (!clock) {
        setDue(null)
        return
      }
      const today = isoDate(new Date())
      const id = dueReminder(clock, log, today, minutesNow())
      const key = id ? dayKey(id, today) : ""
      if (!id || window.localStorage.getItem(DISMISSED_KEY) === key) {
        setDue(null)
        return
      }
      setDue(id)
      const permission = await currentReminderPermission()
      if (permission !== "granted") return
      if (window.localStorage.getItem(NOTIFIED_KEY) === key) return
      window.localStorage.setItem(NOTIFIED_KEY, key)
      await showReminder(locale, id, today)
    }

    void tick()
    const timer = window.setInterval(() => void tick(), 30_000)
    const onArm = () => {
      if (clock) void currentReminderPermission().then((permission) => {
        if (permission === "granted") void armScheduledReminders(clock, log, locale)
      })
      void tick()
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick()
    }
    if (clock) {
      void currentReminderPermission().then((permission) => {
        if (permission === "granted") void armScheduledReminders(clock, log, locale)
      })
    }
    window.addEventListener("epoch-reminders", onArm)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("epoch-reminders", onArm)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [profile?.sleepClock, profile?.practice, locale])

  useEffect(() => {
    if (!profile) return
    const points = summarizeRewards(profile.rewards, new Date(), profile.nudgePoints ?? 0).total
    const view = presentGrove(normalizeGrove(profile.grove), points, "off")
    const nudge = groveNudge(view.pendingSun, view.sun, view.pourCost)

    async function arm() {
      const permission = await currentReminderPermission()
      if (permission !== "granted") return
      await armGroveReminder(nudge, locale)
      if (!groveReminderDue(nudge, minutesNow())) return
      const key = `${isoDate(new Date())}:${nudge}`
      if (window.localStorage.getItem("epoch.grove.notified") === key) return
      window.localStorage.setItem("epoch.grove.notified", key)
      if (nudge) await showGroveReminder(locale, nudge)
    }

    void arm()
    const onArm = () => void arm()
    const onVisible = () => {
      if (document.visibilityState === "visible") void arm()
    }
    window.addEventListener("epoch-reminders", onArm)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("epoch-reminders", onArm)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [profile, locale])

  if (!due) return null
  const dueId = due
  const lesson = lessonById(dueId)
  if (!lesson) return null
  const today = isoDate(new Date())
  const text = presentToday(locale, lesson, today)
  const note = reminderNotification(locale, dueId, today)

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, dayKey(dueId))
    setDue(null)
  }

  return (
    <div
      role="status"
      className={`fixed z-40 rounded-2xl border border-border bg-card p-4 shadow-lg inset-x-3 md:inset-x-auto md:right-4 md:w-96 ${lift ? "bottom-[calc(14rem+env(safe-area-inset-bottom))] md:bottom-40" : "bottom-[calc(5.75rem+env(safe-area-inset-bottom))] md:bottom-4"}`}
    >
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Reminder", "Erinnerung")}</p>
      <p className="mt-1 text-sm font-medium">{text.title}</p>
      <p className="mt-1 text-sm leading-6">{note.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={note.url} className={buttonVariants({ className: "h-11 px-3" })}>
          {pick(locale, "Open the lesson", "Die Lektion öffnen")}
        </Link>
        <Button type="button" variant="outline" className="h-11" onClick={dismiss}>
          {pick(locale, "Not now", "Nicht jetzt")}
        </Button>
      </div>
    </div>
  )
}
