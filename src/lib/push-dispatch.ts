import { randomUUID } from "crypto"
import { buddyWeekPath, isBuddyWeekPath } from "./app-paths"
import { storedNudge } from "./copy"
import { normalizeGrove, presentGrove } from "./grove"
import { cleanLocale, type Locale } from "./locale"
import { normalizePractice, type PracticeLog } from "./practice"
import { pushEndpointAllowed, type PushSubscriptionInput } from "./push-endpoint"
import { noteUrlAllowed, reminderNote, remindersDue, type PushNote } from "./push-notes"
import { cleanNudgePoints } from "./storage"
import { normalizeRewards, deviceWallClock, summarizeRewards, type RewardCheckIn } from "./rewards"
import { cleanSleepClock, type SleepClock } from "./sleep-clock"
import { qall, qrun, qtx } from "./sql"
import { cleanTimeZone, zonedClock, zonedOffsetMinutes } from "./zoned-clock"

const VAPID_SUBJECT = "mailto:reminders@epoch.app"
const DEVICE_CAP = 6
const BATCH = 200

export type PushTarget = { id?: string; endpoint: string; p256dh: string; auth: string }

export type PushSender = (target: PushTarget, note: PushNote) => Promise<void>

type SubRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  locale: string
  time_zone: string
  profile_json: string | null
}

type WebPushModule = {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  generateVAPIDKeys(): { publicKey: string; privateKey: string }
  sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string | null,
    options?: { TTL?: number; timeout?: number },
  ): Promise<{ statusCode?: number }>
}

const pump = globalThis as { epochPushCursor?: string; epochPushStarted?: boolean; epochPushTick?: () => void }

function firstName(name: string, locale: Locale): string {
  const clean = name.replace(/[\u0000-\u001f]/g, "").trim().split(/\s+/)[0] ?? ""
  return clean.slice(0, 40) || (locale === "de" ? "Jemand" : "Someone")
}

function isWebPush(value: unknown): value is WebPushModule {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<WebPushModule>
  return typeof candidate.generateVAPIDKeys === "function" && typeof candidate.setVapidDetails === "function" && typeof candidate.sendNotification === "function"
}

async function loadWebPush(): Promise<WebPushModule> {
  const loaded: unknown = await import("web-push")
  if (isWebPush(loaded)) return loaded
  if (loaded && typeof loaded === "object" && "default" in loaded && isWebPush(loaded.default)) return loaded.default
  throw new Error("Reminders are unavailable.")
}

async function readVapid(): Promise<{ publicKey: string; privateKey: string } | null> {
  const rows = await qall<{ name: string; value: string }>(
    "SELECT name, value FROM app_secrets WHERE name IN ('vapid_public', 'vapid_private')",
  )
  const publicKey = rows.find((row) => row.name === "vapid_public")?.value
  const privateKey = rows.find((row) => row.name === "vapid_private")?.value
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey }
}

async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const existing = await readVapid()
  if (existing) return existing
  const made = (await loadWebPush()).generateVAPIDKeys()
  try {
    await qtx(async () => {
      if (await readVapid()) return
      await qrun("INSERT INTO app_secrets (name, value) VALUES ('vapid_public', ?)", made.publicKey)
      await qrun("INSERT INTO app_secrets (name, value) VALUES ('vapid_private', ?)", made.privateKey)
    })
  } catch {
    // Another process stored the pair first.
  }
  return (await readVapid()) ?? made
}

export async function pushPublicKey(): Promise<string> {
  return (await vapidKeys()).publicKey
}

function pushGone(error: unknown): boolean {
  const status = (error as { statusCode?: number })?.statusCode
  return status === 404 || status === 410
}

async function deliverPush(target: PushTarget, note: PushNote): Promise<void> {
  if (!pushEndpointAllowed(target.endpoint) || !noteUrlAllowed(note.url)) return
  const keys = await vapidKeys()
  const webpush = await loadWebPush()
  webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey)
  await webpush.sendNotification(
    { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
    JSON.stringify({
      title: note.title.slice(0, 120),
      body: note.body.slice(0, 240),
      tag: note.tag,
      url: note.url,
      lang: note.lang,
    }),
    { TTL: 60 * 60, timeout: 8000 },
  )
}

export async function savePushSubscription(userId: string, input: PushSubscriptionInput): Promise<void> {
  const now = new Date().toISOString()
  await qtx(async () => {
    await qrun(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, locale, time_zone, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         locale = excluded.locale,
         time_zone = excluded.time_zone,
         updated_at = excluded.updated_at`,
      randomUUID(),
      userId,
      input.endpoint,
      input.p256dh,
      input.auth,
      input.locale,
      input.timeZone,
      now,
    )
    const kept = await qall<{ id: string }>(
      "SELECT id FROM push_subscriptions WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?",
      userId,
      DEVICE_CAP,
    )
    const ids = kept.map((row) => row.id)
    if (ids.length === 0) return
    const extras = await qall<{ id: string }>("SELECT id FROM push_subscriptions WHERE user_id = ?", userId)
    for (const row of extras) {
      if (!ids.includes(row.id)) await qrun("DELETE FROM push_subscriptions WHERE id = ?", row.id)
    }
  })
}

function readProfile(json: string | null): {
  sleepClock: SleepClock | null
  practice: PracticeLog
  rewards: RewardCheckIn[]
  nudgePoints: number
  groveSun: number
  pendingSun: number
} | null {
  if (!json) return null
  try {
    const raw = JSON.parse(json) as Record<string, unknown>
    const rewards = normalizeRewards(raw.rewards)
    const nudgePoints = cleanNudgePoints(raw.nudgePoints)
    return {
      sleepClock: cleanSleepClock(raw.sleepClock),
      practice: normalizePractice(raw.practice),
      rewards,
      nudgePoints,
      groveSun: 0,
      pendingSun: 0,
    }
  } catch {
    return null
  }
}

async function claimSend(subscriptionId: string, tag: string, sentOn: string): Promise<boolean> {
  const result = await qrun(
    `INSERT INTO push_sent (id, subscription_id, tag, sent_on, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (subscription_id, tag, sent_on) DO NOTHING`,
    randomUUID(),
    subscriptionId,
    tag,
    sentOn,
    new Date().toISOString(),
  )
  return result.changes === 1
}

async function dispatchOne(row: SubRow, now: Date, sender: PushSender): Promise<void> {
  if (!pushEndpointAllowed(row.endpoint)) {
    await qrun("DELETE FROM push_subscriptions WHERE id = ?", row.id)
    return
  }
  const zone = cleanTimeZone(row.time_zone)
  const locale = cleanLocale(row.locale) ?? "en"
  const stored = readProfile(row.profile_json)
  if (!zone || !stored) return
  const clock = zonedClock(now, zone)
  const wall = deviceWallClock(now, zonedOffsetMinutes(now, zone))
  const points = summarizeRewards(stored.rewards, wall, stored.nudgePoints).total
  let groveSun = 0
  let pendingSun = 0
  try {
    const raw = JSON.parse(row.profile_json ?? "{}") as { grove?: unknown }
    const grove = normalizeGrove(raw.grove)
    const view = presentGrove(grove, points, "off")
    groveSun = view.sun
    pendingSun = view.pendingSun
  } catch {
    return
  }
  const due = remindersDue({
    sleepClock: stored.sleepClock,
    practice: stored.practice,
    pendingSun,
    sun: groveSun,
    date: clock.date,
    minutes: clock.minutes,
  })
  for (const reminder of due) {
    const note = reminderNote(locale, reminder, clock.date)
    if (!noteUrlAllowed(note.url)) continue
    if (!(await claimSend(row.id, note.tag, clock.date))) continue
    try {
      await sender(
        { id: row.id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
        note,
      )
    } catch (error) {
      if (pushGone(error)) await qrun("DELETE FROM push_subscriptions WHERE id = ?", row.id)
      else await qrun("DELETE FROM push_sent WHERE subscription_id = ? AND tag = ? AND sent_on = ?", row.id, note.tag, clock.date)
    }
  }
}

/** Send reminders that are due now. A caller may pass a sender in tests. */
export async function dispatchDuePushes(now = new Date(), sender: PushSender = deliverPush): Promise<void> {
  const cursor = pump.epochPushCursor ?? ""
  let rows: SubRow[]
  try {
    rows = await qall<SubRow>(
      `SELECT s.id, s.user_id, s.endpoint, s.p256dh, s.auth, s.locale, s.time_zone, u.profile_json
       FROM push_subscriptions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id > ?
       ORDER BY s.id
       LIMIT ?`,
      cursor,
      BATCH,
    )
  } catch {
    return
  }
  pump.epochPushCursor = rows.length === BATCH ? rows[rows.length - 1]?.id ?? "" : ""
  for (const row of rows) {
    try {
      await dispatchOne(row, now, sender)
    } catch {
      // The next device still gets its reminder.
    }
  }
}

async function devicesFor(userId: string): Promise<SubRow[]> {
  return qall<SubRow>(
    `SELECT id, user_id, endpoint, p256dh, auth, locale, time_zone, NULL AS profile_json
     FROM push_subscriptions WHERE user_id = ?`,
    userId,
  )
}

function demoNote(locale: Locale): PushNote {
  return locale === "de"
    ? {
        title: "Epoch erreicht dieses Gerät",
        body: "Diese Erinnerung kam an, während die App geschlossen war.",
        tag: "epoch-demo",
        url: "/home/practice",
        lang: "de",
      }
    : {
        title: "Epoch can reach this device",
        body: "This reminder arrived while the app was closed.",
        tag: "epoch-demo",
        url: "/home/practice",
        lang: "en",
      }
}

async function sendToDevices(userId: string, noteFor: (locale: Locale) => PushNote, sender: PushSender = deliverPush): Promise<{ sent: number; gone: number }> {
  const rows = await devicesFor(userId)
  let sent = 0
  let gone = 0
  for (const row of rows) {
    if (!pushEndpointAllowed(row.endpoint)) {
      await qrun("DELETE FROM push_subscriptions WHERE id = ?", row.id)
      continue
    }
    const note = noteFor(cleanLocale(row.locale) ?? "en")
    if (!noteUrlAllowed(note.url)) continue
    try {
      await sender(row, note)
      sent += 1
    } catch (error) {
      if (pushGone(error)) {
        gone += 1
        await qrun("DELETE FROM push_subscriptions WHERE id = ?", row.id)
      }
    }
  }
  return { sent, gone }
}

/** A fixed reminder for this member’s own devices. The text is not chosen by the caller. */
export async function sendDemoPush(userId: string, sender: PushSender = deliverPush): Promise<{ sent: number } | { error: string; refresh?: boolean }> {
  const rows = await devicesFor(userId)
  if (!rows.some((row) => pushEndpointAllowed(row.endpoint))) return { error: "Allow reminders on this device first.", refresh: true }
  const result = await sendToDevices(userId, demoNote, sender)
  if (result.sent > 0) return { sent: result.sent }
  if (result.gone > 0) return { error: "This device needs a new reminder registration.", refresh: true }
  return { error: "The reminder could not be delivered to this device." }
}

export async function notifyBuddyLine(input: {
  toUserId: string
  fromName: string
  english: string
  pairId: string
}): Promise<void> {
  const url = buddyWeekPath(input.pairId)
  if (!isBuddyWeekPath(url)) return
  await sendToDevices(input.toUserId, (locale) => {
    const name = firstName(input.fromName, locale)
    return {
      title: locale === "de" ? `${name} schrieb` : `${name} wrote`,
      body: storedNudge(locale, input.english).slice(0, 240),
      tag: "epoch-buddy-line",
      url,
      lang: locale,
    }
  })
}

export async function notifyBuddyNudge(input: { toUserId: string; fromName: string; pairId: string }): Promise<void> {
  if (!isBuddyWeekPath(buddyWeekPath(input.pairId))) return
  await sendToDevices(input.toUserId, (locale) => {
    const name = firstName(input.fromName, locale)
    return {
      title: locale === "de" ? `${name} hat dich angestupst` : `${name} nudged you`,
      body: locale === "de" ? "Eine Zeile, und sie kann warten." : "One line, and it can wait.",
      tag: "epoch-buddy-nudge",
      url: "/home/pair",
      lang: locale,
    }
  })
}

const CHECKIN_NAME = "checkin_how_are_you"
const CHECKIN_TAG = "epoch-checkin"
const CHECKIN_DAY = "once"

const howAreYou: PushNote = {
  title: "How are you doing today?",
  body: "",
  tag: CHECKIN_TAG,
  url: "/home",
  lang: "en",
}

async function checkInCutoff(): Promise<string> {
  const rows = await qall<{ value: string }>("SELECT value FROM app_secrets WHERE name = ?", CHECKIN_NAME)
  if (rows[0]?.value) return rows[0].value
  const now = new Date().toISOString()
  try {
    await qrun("INSERT INTO app_secrets (name, value) VALUES (?, ?)", CHECKIN_NAME, now)
  } catch {
    // Another process stored the cutoff.
  }
  const stored = await qall<{ value: string }>("SELECT value FROM app_secrets WHERE name = ?", CHECKIN_NAME)
  return stored[0]?.value ?? now
}

/** One question for the devices already registered. Later devices are left out. */
export async function dispatchHowAreYou(sender: PushSender = deliverPush): Promise<number> {
  const cutoff = await checkInCutoff()
  if (cutoff === "done") return 0
  const rows = await qall<SubRow>(
    `SELECT id, user_id, endpoint, p256dh, auth, locale, time_zone, NULL AS profile_json
     FROM push_subscriptions WHERE updated_at <= ? ORDER BY id`,
    cutoff,
  )
  let pending = 0
  let sent = 0
  for (const row of rows) {
    if (!pushEndpointAllowed(row.endpoint)) {
      await qrun("DELETE FROM push_subscriptions WHERE id = ?", row.id)
      continue
    }
    if (!noteUrlAllowed(howAreYou.url)) continue
    if (!(await claimSend(row.id, CHECKIN_TAG, CHECKIN_DAY))) continue
    try {
      await sender({ id: row.id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth }, howAreYou)
      sent += 1
    } catch (error) {
      pending += 1
      if (pushGone(error)) await qrun("DELETE FROM push_subscriptions WHERE id = ?", row.id)
      else await qrun("DELETE FROM push_sent WHERE subscription_id = ? AND tag = ? AND sent_on = ?", row.id, CHECKIN_TAG, CHECKIN_DAY)
    }
  }
  if (pending === 0) await qrun("UPDATE app_secrets SET value = 'done' WHERE name = ?", CHECKIN_NAME)
  return sent
}

export function startPushLoop(): void {
  pump.epochPushTick = () => {
    void dispatchDuePushes().catch(() => {})
    void dispatchHowAreYou().catch(() => {})
  }
  if (pump.epochPushStarted) return
  pump.epochPushStarted = true
  setTimeout(() => pump.epochPushTick?.(), 20_000)
  setInterval(() => pump.epochPushTick?.(), 60_000)
}
