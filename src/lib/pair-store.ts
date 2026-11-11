import { randomUUID } from "crypto"
import { BUDDY_CODE_LENGTH, newBuddyCode, normalizeBuddyCode } from "./buddy-code"
import { qall, qget, qrun, qtx } from "./sql"
import { deviceWallClock, normalizeOffset, normalizeRewards, summarizeRewards } from "./rewards"
import { isoDate } from "./format"
import type { Locale } from "./locale"
import { freshen, cleanNudgePoints } from "./storage"
import { lastWeekScores, nudgeById, nudgeOptions, SCORE_NUDGE_POINTS, scoreTone, toneLine, type ScoreDay, type ScoreTone } from "./score-week"
import { hashSecret, newSecret } from "./passwords"
import {
  buddyCap,
  evaluatePair,
  firstSharedMorning,
  type PairEvaluation,
  type PairPause,
  type PairRepair,
  type PairSide,
  type PairSnapshot,
} from "./pairs"
import type { Profile } from "./types"

const INVITE_DAYS = 7

type PairRow = {
  id: string
  user_a: string
  user_b: string
  started_on: string
  created_at: string
  ended_at: string | null
  ended_streak: number | null
  ended_longest: number | null
  share_a: number
  share_b: number
  offset_a: number | null
  offset_b: number | null
  nudge_date: string | null
  nudge_by: PairSide | null
}

type InviteRow = {
  id: string
  token_hash: string
  inviter_id: string
  offset_minutes: number | null
  created_at: string
  expires_at: string
  pair_id: string | null
}

export type { PairSnapshot }

type PersonFile = {
  name: string
  handle: string
  offsetMinutes: number | null
  morningDates: string[]
  completeDates: string[]
  points: number
}

async function personFile(userId: string): Promise<PersonFile | null> {
  const row = await qget("SELECT profile_json, role FROM users WHERE id = ?", userId) as
    | { profile_json: string | null; role: string }
    | undefined
  if (!row || row.role !== "member" || !row.profile_json) return null
  const profile = JSON.parse(row.profile_json) as Profile
  const rewards = normalizeRewards(profile.rewards)
  const byDate = new Map<string, Set<string>>()
  for (const entry of rewards) {
    const slots = byDate.get(entry.date) ?? new Set<string>()
    slots.add(entry.slot)
    byDate.set(entry.date, slots)
  }
  const completeDates = [...byDate.entries()].filter(([, slots]) => slots.has("morning") && slots.has("day") && slots.has("night")).map(([date]) => date)
  return {
    name: profile.name,
    handle: profile.handle || "member",
    offsetMinutes: normalizeOffset(profile.rewardClockOffset),
    morningDates: rewards.filter((entry) => entry.slot === "morning").map((entry) => entry.date),
    completeDates,
    points: summarizeRewards(rewards, new Date()).total + cleanNudgePoints(profile.nudgePoints),
  }
}

async function capFor(userId: string): Promise<number> {
  return buddyCap((await personFile(userId))?.points ?? 0)
}

async function atCap(userId: string): Promise<boolean> {
  return await countActive(userId) >= await capFor(userId)
}

async function countActive(userId: string): Promise<number> {
  const row = await qget<{ n: number }>("SELECT COUNT(*) AS n FROM pairs WHERE ended_at IS NULL AND (user_a = ? OR user_b = ?)", userId, userId)
  return row?.n ?? 0
}

async function activePairs(userId: string): Promise<PairRow[]> {
  return await qall("SELECT * FROM pairs WHERE ended_at IS NULL AND (user_a = ? OR user_b = ?) ORDER BY created_at", userId, userId) as PairRow[]
}

async function endedPairs(userId: string): Promise<PairRow[]> {
  return await qall("SELECT * FROM pairs WHERE ended_at IS NOT NULL AND (user_a = ? OR user_b = ?) ORDER BY ended_at DESC LIMIT 3", userId, userId) as PairRow[]
}

async function pairOwned(userId: string, pairId: string): Promise<PairRow | undefined> {
  return await qget("SELECT * FROM pairs WHERE id = ? AND (user_a = ? OR user_b = ?)", pairId, userId, userId) as PairRow | undefined
}

async function activeBetween(left: string, right: string): Promise<boolean> {
  const row = await qget(
      `SELECT id FROM pairs WHERE ended_at IS NULL AND ((user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?))`
    , left, right, right, left) as { id: string } | undefined
  return Boolean(row)
}

function sideOf(row: PairRow, userId: string): PairSide {
  return row.user_a === userId ? "a" : "b"
}

async function pausesFor(pairId: string): Promise<PairPause[]> {
  const rows = await qall("SELECT week_monday, on_date FROM pair_pauses WHERE pair_id = ? ORDER BY on_date", pairId) as {
    week_monday: string
    on_date: string
  }[]
  return rows.map((row) => ({ weekMonday: row.week_monday, onDate: row.on_date }))
}

async function repairsFor(pairId: string): Promise<PairRepair[]> {
  const rows = await qall("SELECT month, gap_date, agreed_a, agreed_b FROM pair_repairs WHERE pair_id = ?", pairId) as {
    month: string
    gap_date: string
    agreed_a: number
    agreed_b: number
  }[]
  return rows.map((row) => ({ month: row.month, gapDate: row.gap_date, agreedA: row.agreed_a === 1, agreedB: row.agreed_b === 1 }))
}

async function rememberOffset(row: PairRow, you: PairSide, offset: number | null): Promise<void> {
  if (offset == null) return
  if (you === "a") {
    await qrun("UPDATE pairs SET offset_a = ? WHERE id = ?", offset, row.id)
    row.offset_a = offset
    return
  }
  await qrun("UPDATE pairs SET offset_b = ? WHERE id = ?", offset, row.id)
  row.offset_b = offset
}

async function evaluateRow(row: PairRow, userId: string, offset: number | null, now = new Date(), locale: Locale = "en"): Promise<{ you: PairSide; fileA: PersonFile; fileB: PersonFile; evaluation: PairEvaluation } | { error: string }> {
  const fileA = await personFile(row.user_a)
  const fileB = await personFile(row.user_b)
  if (!fileA || !fileB) return { error: "This pair is missing a file." }
  const you = sideOf(row, userId)
  await rememberOffset(row, you, offset)
  const personA = { ...fileA, offsetMinutes: row.offset_a ?? fileA.offsetMinutes }
  const personB = { ...fileB, offsetMinutes: row.offset_b ?? fileB.offsetMinutes }
  if (you === "a" && offset != null) personA.offsetMinutes = offset
  if (you === "b" && offset != null) personB.offsetMinutes = offset
  const evaluation = evaluatePair({
    now,
    startedOn: row.started_on,
    you,
    personA,
    personB,
    pauses: await pausesFor(row.id),
    repairs: await repairsFor(row.id),
    nudge: row.nudge_date && row.nudge_by ? { date: row.nudge_date, by: row.nudge_by } : null,
    shareA: row.share_a === 1,
    shareB: row.share_b === 1,
    locale,
  })
  return { you, fileA, fileB, evaluation }
}

async function snapshotOf(row: PairRow, userId: string, offset: number | null, now = new Date(), locale: Locale = "en"): Promise<PairSnapshot | { error: string }> {
  if (row.ended_at) {
    const you = sideOf(row, userId)
    const partner = await personFile(you === "a" ? row.user_b : row.user_a)
    return {
      state: "ended",
      id: row.id,
      streak: row.ended_streak ?? 0,
      longest: row.ended_longest ?? 0,
      partnerHandle: partner?.handle ?? "member",
      partnerName: partner?.name ?? "Your pair",
    }
  }
  const evaluated = await evaluateRow(row, userId, offset, now, locale)
  if ("error" in evaluated) return evaluated
  const partner = evaluated.you === "a" ? evaluated.fileB : evaluated.fileA
  const yours = evaluated.you === "a" ? evaluated.fileA : evaluated.fileB
  const view = evaluated.evaluation
  return {
    state: "active",
    id: row.id,
    yourHandle: yours.handle,
    partnerHandle: partner.handle,
    partnerName: partner.name,
    streak: view.streak,
    longest: view.longest,
    line: view.line,
    yourMark: view.yourMark,
    partnerMark: view.partnerMark,
    pauseAvailable: view.pauseAvailable,
    pauseDate: view.pauseDate,
    repair: view.repair
      ? { gapDate: view.repair.gapDate, youAgreed: view.repair.youAgreed, partnerAgreed: view.repair.partnerAgreed }
      : null,
    milestone: view.milestone,
    sharing: evaluated.you === "a" ? row.share_a === 1 : row.share_b === 1,
    partnerSharing: evaluated.you === "a" ? row.share_b === 1 : row.share_a === 1,
    canShare: view.canShare,
    canNudge: view.canNudge,
    nudged: view.nudged,
    partnerNudged: view.partnerNudged,
    startedOn: row.started_on,
    handleA: evaluated.fileA.handle,
    handleB: evaluated.fileB.handle,
  }
}

export type PairBoard = {
  code: string
  incoming: number
  pairs: Array<Extract<PairSnapshot, { state: "active" }>>
  ended: Array<Extract<PairSnapshot, { state: "ended" }>>
  pairCap: number
  points: number
}

export async function pairBoard(userId: string, offset: number | null, now = new Date(), locale: Locale = "en"): Promise<PairBoard | { error: string }> {
  const code = await ensureBuddyCode(userId)
  if ("error" in code) return code
  const pairs: PairBoard["pairs"] = []
  for (const row of await activePairs(userId)) {
    const view = await snapshotOf(row, userId, offset, now, locale)
    if ("error" in view || view.state !== "active") continue
    pairs.push(view)
  }
  const ended: PairBoard["ended"] = []
  for (const row of await endedPairs(userId)) {
    const view = await snapshotOf(row, userId, offset, now, locale)
    if ("error" in view || view.state !== "ended") continue
    ended.push(view)
  }
  const waiting = await qget<{ n: number }>("SELECT COUNT(*) AS n FROM pair_requests WHERE to_user = ? AND status = 'pending'", userId)
  const file = await personFile(userId)
  return { code: code.code, incoming: waiting?.n ?? 0, pairs, ended, pairCap: buddyCap(file?.points ?? 0), points: file?.points ?? 0 }
}

export async function createPairInvite(userId: string, offset: number | null): Promise<{ path: string; expiresAt: string } | { error: string }> {
  if (!(await personFile(userId))) return { error: "Open your file before starting a pair." }
  const cap = await capFor(userId)
  if (await countActive(userId) >= cap) return { error: `You already have ${cap} pairs.` }
  const token = newSecret()
  const expires = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  await qtx(async () => {
    await qrun("DELETE FROM pair_invites WHERE inviter_id = ? AND pair_id IS NULL", userId)
    await qrun(
      `INSERT INTO pair_invites (id, token_hash, inviter_id, offset_minutes, created_at, expires_at, pair_id)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      randomUUID(), hashSecret(token), userId, offset, new Date().toISOString(), expires,
    )
  })
  return { path: `/pair/${token}`, expiresAt: expires }
}

export async function acceptPairInvite(userId: string, token: string, offset: number | null, now = new Date()): Promise<{ ok: true } | { error: string }> {
  const file = await personFile(userId)
  if (!file) return { error: "Open your file before joining a pair." }
  const invite = await qget("SELECT * FROM pair_invites WHERE token_hash = ?", hashSecret(token.trim())) as InviteRow | undefined
  if (!invite) return { error: "This link does not match an invitation." }
  if (invite.pair_id) return { error: "This link has already been used." }
  if (invite.expires_at <= now.toISOString()) return { error: "This link has expired." }
  if (invite.inviter_id === userId) return { error: "This link is yours to send." }
  if (await atCap(userId) || await atCap(invite.inviter_id)) return { error: "That invitation is no longer open." }
  if (await activeBetween(userId, invite.inviter_id)) return { error: "You already keep mornings with this person." }
  const inviter = await personFile(invite.inviter_id)
  if (!inviter) return { error: "That invitation is no longer open." }
  const startedOn = firstSharedMorning(now, invite.offset_minutes, offset)
  const pairId = randomUUID()
  try {
    await qtx(async () => {
      const fresh = await qget<InviteRow>("SELECT pair_id, expires_at, inviter_id FROM pair_invites WHERE id = ?", invite.id)
      if (!fresh || fresh.pair_id || fresh.expires_at <= now.toISOString()) throw new Error("used")
      if (await atCap(userId) || await atCap(fresh.inviter_id) || await activeBetween(userId, fresh.inviter_id)) throw new Error("paired")
      await qrun(
        `INSERT INTO pairs (
          id, user_a, user_b, started_on, created_at, ended_at, ended_streak, ended_longest,
          share_a, share_b, offset_a, offset_b, nudge_date, nudge_by
        ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?, NULL, NULL)`,
        pairId, fresh.inviter_id, userId, startedOn, now.toISOString(), invite.offset_minutes, offset,
      )
      await qrun("UPDATE pair_invites SET pair_id = ? WHERE id = ?", pairId, invite.id)
    })
  } catch (error) {
    if (error instanceof Error && error.message === "used") return { error: "This link has already been used." }
    return { error: "That invitation is no longer open." }
  }
  return { ok: true }
}

export async function leavePair(userId: string, pairId: string, offset: number | null, now = new Date()): Promise<{ ok: true } | { error: string }> {
  const row = await pairOwned(userId, pairId)
  if (!row || row.ended_at) return { error: "You do not have a pair to leave." }
  const view = await snapshotOf(row, userId, offset, now)
  if ("error" in view) return view
  const streak = view.state === "active" ? view.streak : 0
  const longest = view.state === "active" ? view.longest : 0
  await qrun("UPDATE pairs SET ended_at = ?, ended_streak = ?, ended_longest = ? WHERE id = ? AND ended_at IS NULL", now.toISOString(), streak, longest, row.id)
  return { ok: true }
}

export async function deletePair(userId: string, pairId: string): Promise<{ ok: true } | { error: string }> {
  const row = await pairOwned(userId, pairId)
  if (!row) return { error: "There is no pair to delete." }
  await qtx(async () => {
    await qrun("DELETE FROM pairs WHERE id = ? AND (user_a = ? OR user_b = ?)", pairId, userId, userId)
    await qrun("DELETE FROM pair_invites WHERE inviter_id = ? AND pair_id IS NULL", userId)
  })
  return { ok: true }
}

export async function nudgePair(userId: string, pairId: string, offset: number | null, now = new Date()): Promise<{ ok: true } | { error: string }> {
  const row = await pairOwned(userId, pairId)
  if (!row || row.ended_at) return { error: "You do not have a pair to nudge." }
  const evaluated = await evaluateRow(row, userId, offset, now)
  if ("error" in evaluated) return evaluated
  if (!evaluated.evaluation.canNudge) return { error: "A nudge can wait. One line a day, and only while their morning is still open." }
  await qrun("UPDATE pairs SET nudge_date = ?, nudge_by = ? WHERE id = ?", evaluated.evaluation.focusDate, evaluated.you, row.id)
  return { ok: true }
}

export async function pausePair(userId: string, pairId: string, offset: number | null, now = new Date()): Promise<{ ok: true } | { error: string }> {
  const row = await pairOwned(userId, pairId)
  if (!row || row.ended_at) return { error: "You do not have a pair." }
  const evaluated = await evaluateRow(row, userId, offset, now)
  if ("error" in evaluated) return evaluated
  const { pauseDate, pauseWeek, pauseAvailable } = evaluated.evaluation
  if (!pauseAvailable || !pauseDate || !pauseWeek) return { error: "A pause is not available for this morning." }
  await qrun("INSERT INTO pair_pauses (pair_id, week_monday, on_date, spent_by) VALUES (?, ?, ?, ?)", row.id, pauseWeek, pauseDate, evaluated.you)
  return { ok: true }
}

export async function repairPair(userId: string, pairId: string, offset: number | null, now = new Date()): Promise<{ ok: true } | { error: string }> {
  const row = await pairOwned(userId, pairId)
  if (!row || row.ended_at) return { error: "You do not have a pair." }
  const evaluated = await evaluateRow(row, userId, offset, now)
  if ("error" in evaluated) return evaluated
  const offer = evaluated.evaluation.repair
  if (!offer) return { error: "This morning cannot be restored." }
  if (offer.youAgreed) return { error: "You already agreed to restore that morning." }
  const you = evaluated.you
  const existing = await qget("SELECT month, gap_date, agreed_a, agreed_b FROM pair_repairs WHERE pair_id = ? AND month = ?", row.id, offer.month) as
    | { month: string; gap_date: string; agreed_a: number; agreed_b: number }
    | undefined
  if (existing?.agreed_a === 1 && existing.agreed_b === 1) return { error: "A morning was already restored this month." }
  const agreedA = you === "a" ? 1 : existing && existing.gap_date === offer.gapDate ? existing.agreed_a : 0
  const agreedB = you === "b" ? 1 : existing && existing.gap_date === offer.gapDate ? existing.agreed_b : 0
  await qrun(
      `INSERT INTO pair_repairs (pair_id, month, gap_date, agreed_a, agreed_b) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (pair_id, month) DO UPDATE SET gap_date = excluded.gap_date, agreed_a = excluded.agreed_a, agreed_b = excluded.agreed_b`
    , row.id, offer.month, offer.gapDate, agreedA, agreedB)
  return { ok: true }
}

export async function setPairShare(userId: string, pairId: string, on: boolean): Promise<{ ok: true } | { error: string }> {
  const row = await pairOwned(userId, pairId)
  if (!row || row.ended_at) return { error: "You do not have a pair." }
  const flag = on ? 1 : 0
  if (sideOf(row, userId) === "a") await qrun("UPDATE pairs SET share_a = ? WHERE id = ?", flag, row.id)
  else await qrun("UPDATE pairs SET share_b = ? WHERE id = ?", flag, row.id)
  return { ok: true }
}

export async function invitePreview(token: string, now = new Date()): Promise<{ handle: string; name: string } | { error: string }> {
  const invite = await qget("SELECT * FROM pair_invites WHERE token_hash = ?", hashSecret(token.trim())) as InviteRow | undefined
  if (!invite || invite.pair_id || invite.expires_at <= now.toISOString()) return { error: "This link is no longer open." }
  const inviter = await personFile(invite.inviter_id)
  if (!inviter) return { error: "This link is no longer open." }
  return { handle: inviter.handle, name: inviter.name }
}

export type BuddyHit = {
  found: true
  self: boolean
  code: string
  name: string
  handle: string
  canPair: boolean
  reason: string | null
}

export type BuddyRequestRow = {
  id: string
  name: string
  handle: string
  code: string
  status: "pending" | "rejected"
}

async function ensureBuddyCode(userId: string): Promise<{ code: string } | { error: string }> {
  if (!(await personFile(userId))) return { error: "Open your file before starting a pair." }
  const existing = await qget("SELECT code FROM buddy_codes WHERE user_id = ?", userId) as { code: string } | undefined
  if (existing && existing.code.length >= BUDDY_CODE_LENGTH) return { code: existing.code }
  if (existing) return replaceBuddyCode(userId)
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = newBuddyCode()
    try {
      await qrun("INSERT INTO buddy_codes (user_id, code, created_at) VALUES (?, ?, ?)", userId, code, new Date().toISOString())
      return { code }
    } catch {
      const again = await qget("SELECT code FROM buddy_codes WHERE user_id = ?", userId) as { code: string } | undefined
      if (again) return { code: again.code }
    }
  }
  return { error: "A code could not be made." }
}

async function pendingBetween(left: string, right: string): Promise<{ id: string; from_user: string } | undefined> {
  return await qget(
      `SELECT id, from_user FROM pair_requests
       WHERE status = 'pending' AND ((from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?))`
    , left, right, right, left) as { id: string; from_user: string } | undefined
}

async function pairBlock(userId: string, otherId: string, otherName: string): Promise<string | null> {
  const name = otherName.trim().split(/\s+/)[0] || "This person"
  if (await activeBetween(userId, otherId)) return `You already keep mornings with ${name}.`
  const pending = await pendingBetween(userId, otherId)
  if (pending?.from_user === userId) return `Waiting for ${name} to accept.`
  if (pending) return `${name} has already asked you.`
  const mine = await capFor(userId)
  const theirs = await capFor(otherId)
  if (await countActive(userId) >= mine) return `You already have ${mine} pairs.`
  if (await countActive(otherId) >= theirs) return `${name} already has ${theirs} pairs.`
  return null
}

export async function searchBuddy(userId: string, raw: string): Promise<{ found: false } | BuddyHit | { error: string }> {
  const mine = await ensureBuddyCode(userId)
  if ("error" in mine) return mine
  const code = normalizeBuddyCode(raw)
  if (!code) return { found: false }
  const row = await qget("SELECT user_id, code FROM buddy_codes WHERE code = ?", code) as { user_id: string; code: string } | undefined
  if (!row) return { found: false }
  const file = await personFile(row.user_id)
  if (!file) return { found: false }
  if (row.user_id === userId) return { found: true, self: true, code: row.code, name: file.name, handle: file.handle, canPair: false, reason: "This is your code." }
  const reason = await pairBlock(userId, row.user_id, file.name)
  return { found: true, self: false, code: row.code, name: file.name, handle: file.handle, canPair: reason == null, reason }
}

export async function requestBuddy(userId: string, raw: string, now = new Date()): Promise<{ ok: true } | { error: string }> {
  const hit = await searchBuddy(userId, raw)
  if ("error" in hit) return hit
  if (!hit.found || hit.self || !hit.canPair) return { error: hit.found ? hit.reason || "No such ID exists." : "No such ID exists." }
  const other = await qget("SELECT user_id FROM buddy_codes WHERE code = ?", hit.code) as { user_id: string }
  try {
    await qrun("INSERT INTO pair_requests (id, from_user, to_user, status, created_at, resolved_at) VALUES (?, ?, ?, 'pending', ?, NULL)", randomUUID(), userId, other.user_id, now.toISOString())
  } catch {
    return { error: "That request is already waiting." }
  }
  return { ok: true }
}

export async function buddyRequests(userId: string): Promise<{ incoming: BuddyRequestRow[]; outgoing: BuddyRequestRow[] } | { error: string }> {
  const code = await ensureBuddyCode(userId)
  if ("error" in code) return code
  return { incoming: await requestRows(userId, "to"), outgoing: await requestRows(userId, "from") }
}

async function requestRows(userId: string, side: "to" | "from"): Promise<BuddyRequestRow[]> {
  const column = side === "to" ? "to_user" : "from_user"
  const other = side === "to" ? "from_user" : "to_user"
  const rows = await qall(`SELECT id, ${other} AS other_id, status, created_at FROM pair_requests WHERE ${column} = ? AND status IN ('pending', 'rejected') ORDER BY created_at DESC`, userId) as { id: string; other_id: string; status: "pending" | "rejected"; created_at: string }[]
  const seen = new Set<string>()
  const list: BuddyRequestRow[] = []
  for (const row of rows) {
    if (seen.has(row.other_id)) continue
    seen.add(row.other_id)
    if (row.status === "rejected" && side === "to") continue
    const file = await personFile(row.other_id)
    const code = await qget("SELECT code FROM buddy_codes WHERE user_id = ?", row.other_id) as { code: string } | undefined
    if (!file || !code) continue
    list.push({ id: row.id, name: file.name, handle: file.handle, code: code.code, status: row.status })
  }
  return list
}

export async function acceptBuddy(userId: string, requestId: string, offset: number | null, now = new Date()): Promise<{ ok: true } | { error: string }> {
  const request = await qget("SELECT * FROM pair_requests WHERE id = ?", requestId) as
    | { id: string; from_user: string; to_user: string; status: string }
    | undefined
  if (!request || request.to_user !== userId || request.status !== "pending") return { error: "That request is no longer open." }
  const from = await personFile(request.from_user)
  const to = await personFile(userId)
  if (!from || !to) return { error: "That request is no longer open." }
  if (await activeBetween(userId, request.from_user)) return { error: "You already keep mornings with this person." }
  if (await atCap(userId) || await atCap(request.from_user)) return { error: "That request is no longer open." }
  const startedOn = firstSharedMorning(now, from.offsetMinutes, offset)
  const pairId = randomUUID()
  try {
    await qtx(async () => {
      const fresh = await qget<{ status: string; from_user: string; to_user: string }>("SELECT status, from_user, to_user FROM pair_requests WHERE id = ?", requestId)
      if (!fresh || fresh.status !== "pending" || fresh.to_user !== userId) throw new Error("closed")
      if (await atCap(userId) || await atCap(fresh.from_user) || await activeBetween(userId, fresh.from_user)) throw new Error("full")
      await qrun(
        `INSERT INTO pairs (
          id, user_a, user_b, started_on, created_at, ended_at, ended_streak, ended_longest,
          share_a, share_b, offset_a, offset_b, nudge_date, nudge_by
        ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?, NULL, NULL)`,
        pairId, fresh.from_user, userId, startedOn, now.toISOString(), from.offsetMinutes, offset,
      )
      await qrun("UPDATE pair_requests SET status = 'accepted', resolved_at = ? WHERE id = ?", now.toISOString(), requestId)
    })
  } catch {
    return { error: "That request is no longer open." }
  }
  return { ok: true }
}

export async function rejectBuddy(userId: string, requestId: string, now = new Date()): Promise<{ ok: true } | { error: string }> {
  const request = await qget("SELECT to_user, status FROM pair_requests WHERE id = ?", requestId) as { to_user: string; status: string } | undefined
  if (!request || request.to_user !== userId || request.status !== "pending") return { error: "That request is no longer open." }
  await qrun("UPDATE pair_requests SET status = 'rejected', resolved_at = ? WHERE id = ?", now.toISOString(), requestId)
  return { ok: true }
}

export async function replaceBuddyCode(userId: string): Promise<{ code: string } | { error: string }> {
  if (!(await personFile(userId))) return { error: "Open your file before starting a pair." }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = newBuddyCode()
    try {
      await qrun(
          `INSERT INTO buddy_codes (user_id, code, created_at) VALUES (?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET code = excluded.code, created_at = excluded.created_at`
        , userId, code, new Date().toISOString())
      return { code }
    } catch {
      continue
    }
  }
  return { error: "A code could not be made." }
}

export type BuddyWeek = {
  pairId: string
  partnerName: string
  partnerHandle: string
  you: ScoreDay[]
  them: ScoreDay[]
  tone: ScoreTone
  toneLine: string
  options: { id: string; text: string }[]
  points: number
  sentToday: { text: string } | null
  received: { text: string; name: string } | null
  yourPoints: number
}

function localDay(offset: number | null, now: Date): Date {
  return offset == null ? now : deviceWallClock(now, offset)
}

async function ownedProfile(userId: string, today: Date): Promise<Profile | null> {
  const row = await qget("SELECT profile_json, role FROM users WHERE id = ?", userId) as
    | { profile_json: string | null; role: string }
    | undefined
  if (!row || row.role !== "member" || !row.profile_json) return null
  return freshen(JSON.parse(row.profile_json) as Profile, today)
}

async function weekForPair(userId: string, pairId: string, offset: number | null, now: Date): Promise<{ week: BuddyWeek; otherId: string; today: Date } | { error: string }> {
  const row = await pairOwned(userId, pairId)
  if (!row || row.ended_at) return { error: "You do not have this pair." }
  const today = localDay(offset, now)
  const you = await ownedProfile(userId, today)
  const otherId = row.user_a === userId ? row.user_b : row.user_a
  const them = await ownedProfile(otherId, today)
  if (!you || !them) return { error: "Open a file before reading a buddy’s week." }
  const yours = lastWeekScores(you, today)
  const theirs = lastWeekScores(them, today)
  const tone = scoreTone(theirs)
  const sentOn = isoDate(today)
  const sent = await qget("SELECT message FROM score_nudges WHERE pair_id = ? AND from_user = ? AND sent_on = ?", pairId, userId, sentOn) as { message: string } | undefined
  const received = await qget(
      `SELECT message, from_user FROM score_nudges
       WHERE pair_id = ? AND to_user = ?
       ORDER BY created_at DESC LIMIT 1`
    , pairId, userId) as { message: string; from_user: string } | undefined
  const sender = received ? await ownedProfile(received.from_user, today) : null
  return {
    otherId,
    today,
    week: {
      pairId,
      partnerName: them.name,
      partnerHandle: them.handle || "member",
      you: yours,
      them: theirs,
      tone,
      toneLine: toneLine(tone),
      options: nudgeOptions(tone),
      points: SCORE_NUDGE_POINTS,
      sentToday: sent ? { text: sent.message } : null,
      received: received ? { text: received.message, name: sender?.name || "Your buddy" } : null,
      yourPoints: summarizeRewards(you.rewards, today).total + cleanNudgePoints(you.nudgePoints),
    },
  }
}

export async function buddyWeek(userId: string, pairId: string, offset: number | null, now = new Date()): Promise<BuddyWeek | { error: string }> {
  const opened = await weekForPair(userId, pairId, offset, now)
  if ("error" in opened) return opened
  return opened.week
}

export async function sendScoreNudge(
  userId: string,
  pairId: string,
  optionId: string,
  offset: number | null,
  now = new Date(),
): Promise<BuddyWeek | { error: string }> {
  const opened = await weekForPair(userId, pairId, offset, now)
  if ("error" in opened) return opened
  if (opened.week.sentToday) return { error: "You already sent a line today." }
  const choice = nudgeById(optionId)
  if (!choice || choice.tone !== opened.week.tone) return { error: "That line does not match their week." }
  const profile = await ownedProfile(userId, opened.today)
  if (!profile) return { error: "Open a file before sending a line." }
  const next = { ...profile, nudgePoints: cleanNudgePoints(profile.nudgePoints) + SCORE_NUDGE_POINTS }
  const sentOn = isoDate(opened.today)
  try {
    await qtx(async () => {
      await qrun("UPDATE users SET profile_json = ? WHERE id = ?", JSON.stringify(next), userId)
      await qrun(
        `INSERT INTO score_nudges (id, pair_id, from_user, to_user, sent_on, message, points, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(), pairId, userId, opened.otherId, sentOn, choice.text, SCORE_NUDGE_POINTS, now.toISOString(),
      )
    })
  } catch {
    return { error: "You already sent a line today." }
  }
  return await buddyWeek(userId, pairId, offset, now)
}
