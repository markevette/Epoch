"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { PublicAccount, Role } from "@/lib/accounts"
import type { SessionBody } from "@/lib/auth-server"
import { movementBetween, recommendations, type Recommendation } from "@/lib/interventions"
import { assess, loggedDayCount } from "@/lib/score"
import { foodDay, mealsDue, normalizeMeals, type MealDay } from "@/lib/meals"
import { normalizeWorkouts, type WorkoutDay } from "@/lib/workouts"
import { normalizeRewards, rewardWindow } from "@/lib/rewards"
import { canComplete, normalizePractice } from "@/lib/practice"
import { cleanSleepClock, type SleepClock } from "@/lib/sleep-clock"
import { isoDate } from "@/lib/format"
import { appFetch } from "@/lib/browser-api"
import { freshen, withDailyLog, withInputs } from "@/lib/storage"
import { cleanLocale, LOCALE_COOKIE, type Locale } from "@/lib/locale"
import type { DriverKey, Inputs, ModelResult, Profile } from "@/lib/types"

type Movement = { key: DriverKey; label: string; points: number }

type HealthContextValue = {
  ready: boolean
  account: PublicAccount | null
  role: Role | null
  accounts: PublicAccount[]
  profile: Profile | null
  error: string | null
  model: ModelResult | null
  series: { date: string; score: number; source: "modeled" | "logged" }[]
  plan: Recommendation[]
  movement: Movement[]
  movementLabel: string
  signIn: (email: string, password: string) => Promise<{ ok: true; role: Role; hasProfile: boolean } | { ok: false; error: string }>
  signUp: (input: { email: string; password: string; name: string; invite?: string }) => Promise<{ ok: true } | { ok: false; error: string }>
  signOut: () => Promise<void>
  saveNew: (profile: Profile, consent: { healthConsent: boolean; adult: boolean }) => Promise<boolean>
  updateInputs: (inputs: Inputs) => void
  logToday: (
    daily: Pick<Inputs, "sleepHours" | "hrv" | "restingHr" | "steps" | "stress">,
    options?: { claimMorning?: boolean },
  ) => Promise<boolean>
  claimReward: (note: string) => Promise<boolean>
  logMeals: (day: MealDay) => Promise<boolean>
  logWorkout: (day: WorkoutDay) => Promise<boolean>
  completeLesson: (id: string) => Promise<boolean>
  saveSleepClock: (clock: SleepClock) => Promise<boolean>
  setLeaderboard: (on: boolean) => void
  updateIdentity: (patch: Pick<Profile, "name" | "age" | "sex" | "handle" | "heightCm" | "weightKg">) => void
  reload: () => Promise<void>
  locale: Locale
  setLocale: (locale: Locale) => Promise<void>
}

const HealthContext = createContext<HealthContextValue | null>(null)

async function api<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await appFetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    })
    const data = (await res.json().catch(() => ({}))) as T & { error?: string }
    if (!res.ok) return { ok: false, error: data.error || "The request failed." }
    return { ok: true, data }
  } catch {
    return { ok: false, error: "This server could not be reached." }
  }
}

export function HealthProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale: Locale }) {
  const [ready, setReady] = useState(false)
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const localeRef = useRef(initialLocale)
  const stamped = useRef<string | null>(null)
  const [user, setUser] = useState<PublicAccount | null>(null)
  const [members, setMembers] = useState<PublicAccount[]>([])
  const [error, setError] = useState<string | null>(null)

  const applySession = useCallback((data: SessionBody) => {
    setUser(data.user)
    setMembers(data.members)
    setError(null)
  }, [])

  useEffect(() => {
    let cancel = false
    api<SessionBody>("/api/session").then((result) => {
      if (cancel) return
      if (result.ok) applySession(result.data)
      else setError(result.error)
      setReady(true)
    })
    function onVisible() {
      if (document.visibilityState !== "visible") return
      api<SessionBody>("/api/session").then((result) => {
        if (!cancel && result.ok) applySession(result.data)
      })
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancel = true
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [applySession])

  const profile = user?.role === "member" ? user.profile : null
  localeRef.current = locale

  const applyLocale = useCallback((next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`
    document.documentElement.lang = next
    localeRef.current = next
    setLocaleState(next)
  }, [])
  const stampProfile = useRef<(next: Profile) => void>(() => {})
  const chosenLocale = useRef<Locale | null>(null)

  useEffect(() => {
    if (!profile) return
    const stored = cleanLocale(profile.locale)
    if (chosenLocale.current) {
      if (stored === chosenLocale.current) chosenLocale.current = null
      else return
    }
    if (stored) {
      if (stored !== localeRef.current) applyLocale(stored)
      return
    }
    if (stamped.current === profile.id) return
    stamped.current = profile.id
    stampProfile.current({ ...profile, locale: localeRef.current })
  }, [profile, applyLocale])

  function rememberProfile(next: Profile) {
    setUser((current) => (current ? { ...current, name: next.name, profile: next } : current))
  }

  async function commitProfile(nextProfile: Profile, consent?: { healthConsent: boolean; adult: boolean }): Promise<Profile | null> {
    const next = freshen(nextProfile)
    rememberProfile(next)
    const result = await api<SessionBody>("/api/profile", {
      method: "PUT",
      body: JSON.stringify({ ...next, healthConsent: consent?.healthConsent === true, adult: consent?.adult === true }),
    })
    if (!result.ok) {
      setError(result.error)
      return null
    }
    applySession(result.data)
    return result.data.user?.role === "member" ? result.data.user.profile : next
  }
  stampProfile.current = (next) => {
    void commitProfile(next)
  }

  const derived = useMemo(() => {
    if (!profile) {
      return { model: null, series: [], plan: [], movement: [], movementLabel: "" }
    }
    const loggedDays = loggedDayCount(profile.history)
    const common = {
      age: profile.age,
      sex: profile.sex,
      inputs: profile.inputs,
      loggedDays,
    }
    const model = assess(common)
    const series = profile.history.map((day) => {
      const dayModel = assess({
        age: profile.age,
        sex: profile.sex,
        inputs: day.inputs,
        loggedDays,
      })
      return { date: day.date, score: dayModel.longevityScore, source: day.source }
    })
    const plan = recommendations(common)
    const previous = profile.history[Math.max(0, profile.history.length - 8)]
    const previousModel = previous
      ? assess({
          age: profile.age,
          sex: profile.sex,
          inputs: previous.inputs,
          loggedDays,
        })
      : null
    const movement = previousModel ? movementBetween(previousModel, model) : []
    const movementLabel = previous
      ? previous.source === "logged"
        ? "Since a logged day last week"
        : "Since the modeled day a week ago"
      : ""
    return { model, series, plan, movement, movementLabel }
  }, [profile])

  const reload = useCallback(async () => {
    const result = await api<SessionBody>("/api/session")
    if (result.ok) applySession(result.data)
  }, [applySession])

  const value: HealthContextValue = {
    ready,
    account: user,
    role: user?.role ?? null,
    accounts: user?.role === "admin" ? members : user ? [user] : [],
    profile,
    error,
    ...derived,
    signIn: async (email, password) => {
      const result = await api<SessionBody>("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
      if (!result.ok || !result.data.user) return { ok: false, error: result.ok ? "That email and password don’t match." : result.error }
      applySession(result.data)
      return { ok: true, role: result.data.user.role, hasProfile: Boolean(result.data.user.profile) }
    },
    signUp: async (input) => {
      const result = await api<SessionBody>("/api/join", { method: "POST", body: JSON.stringify(input) })
      if (!result.ok) return { ok: false, error: result.error }
      applySession(result.data)
      return { ok: true }
    },
    signOut: async () => {
      setUser(null)
      setMembers([])
      await api("/api/logout", { method: "POST" })
    },
    saveNew: async (next, consent) => Boolean(await commitProfile(next, consent)),
    updateInputs: (inputs) => {
      if (!profile) return
      void commitProfile(withInputs(profile, inputs))
    },
    logToday: async (daily, options) => {
      if (!profile) return false
      const now = new Date()
      const window = rewardWindow(now)
      let next = withDailyLog(profile, daily)
      const claimMorning = Boolean(options?.claimMorning && window.slot === "morning")
      const already = normalizeRewards(next.rewards).some((entry) => entry.date === window.date && entry.slot === "morning")
      if (claimMorning && !already) {
        next = {
          ...next,
          rewardClockOffset: now.getTimezoneOffset(),
          rewards: [...normalizeRewards(next.rewards), { date: window.date, slot: "morning", at: now.toISOString(), note: "", bonus: 0 }],
        }
      }
      const saved = await commitProfile(next)
      if (!claimMorning) return Boolean(saved)
      const landed = normalizeRewards(saved?.rewards).some((entry) => entry.date === window.date && entry.slot === "morning")
      if (!landed) setError("Sleep is on the file. The morning check-in did not land.")
      return landed
    },
    claimReward: async (note) => {
      if (!profile) return false
      const now = new Date()
      const window = rewardWindow(now)
      const rewards = normalizeRewards(profile.rewards)
      if (rewards.some((entry) => entry.date === window.date && entry.slot === window.slot)) return true
      const saved = await commitProfile({
        ...profile,
        rewardClockOffset: now.getTimezoneOffset(),
        rewards: [...rewards, { date: window.date, slot: window.slot, at: now.toISOString(), note, bonus: 0 }],
      })
      const landed = normalizeRewards(saved?.rewards).some((entry) => entry.date === window.date && entry.slot === window.slot)
      if (!landed) setError("That check-in stayed closed. The open slot is the one on this device’s clock.")
      return landed
    },
    logMeals: async (day) => {
      if (!profile) return false
      const now = new Date()
      const date = foodDay(now)
      const due = mealsDue(now)
      if (day.date !== date) return false
      const previous = normalizeMeals(profile.meals).filter((item) => item.date !== date)
      const saved = await commitProfile({
        ...profile,
        rewardClockOffset: now.getTimezoneOffset(),
        meals: [...previous, day],
      })
      const row = normalizeMeals(saved?.meals).find((item) => item.date === date)
      const landed = due.every((meal) => day[meal] == null || row?.[meal] === day[meal])
      if (!landed) setError("Those calories stayed off the file. The card only takes meals this clock has reached.")
      return landed
    },
    logWorkout: async (day) => {
      if (!profile) return false
      const now = new Date()
      const date = foodDay(now)
      if (day.date !== date) return false
      const previous = normalizeWorkouts(profile.workouts).filter((item) => item.date !== date)
      const saved = await commitProfile({
        ...profile,
        rewardClockOffset: now.getTimezoneOffset(),
        workouts: [...previous, day],
      })
      const row = normalizeWorkouts(saved?.workouts).find((item) => item.date === date)
      const landed = row?.workedOut === day.workedOut && row.kcal === (day.workedOut ? day.kcal : 0)
      if (!landed) setError("That workout stayed off the file. The question follows this device’s clock.")
      return landed
    },
    completeLesson: async (id) => {
      if (!profile) return false
      const now = new Date()
      const date = isoDate(now)
      const current = normalizePractice(profile.practice)
      if (!canComplete(current, id, date)) return false
      const saved = await commitProfile({
        ...profile,
        rewardClockOffset: now.getTimezoneOffset(),
        practice: { completions: [...current.completions, { id, date }] },
      })
      const landed = normalizePractice(saved?.practice).completions.some((item) => item.id === id && item.date === date)
      if (!landed) setError("That skill stayed locked. This branch already has today’s lesson.")
      return landed
    },
    saveSleepClock: async (clock) => {
      if (!profile) return false
      const clean = cleanSleepClock(clock)
      if (!clean) return false
      const saved = await commitProfile({ ...profile, sleepClock: clean })
      const landed = cleanSleepClock(saved?.sleepClock)
      return landed?.wake === clean.wake && landed?.bed === clean.bed
    },
    setLeaderboard: (on) => {
      if (!profile) return
      void commitProfile({ ...profile, leaderboard: on })
    },
    updateIdentity: (patch) => {
      if (!profile) return
      void commitProfile({ ...profile, ...patch })
    },
    reload,
    locale,
    setLocale: async (next) => {
      chosenLocale.current = next
      applyLocale(next)
      if (!profile) return
      stamped.current = profile.id
      await commitProfile({ ...profile, locale: next })
    },
  }

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>
}

export function useHealth() {
  const context = useContext(HealthContext)
  if (!context) throw new Error("useHealth must be used within HealthProvider")
  return context
}
