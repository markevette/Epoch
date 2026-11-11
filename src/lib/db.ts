import { randomUUID, timingSafeEqual } from "crypto"
import { addMember, MIN_PASSWORD_LENGTH, normalizeEmail, type Account, type PublicAccount, type Role } from "./accounts"
import { averyProfile } from "./personas"
import { hashPassword, hashSecret, newSecret, verifyPassword } from "./passwords"
import { recommendations } from "./interventions"
import { acceptMeals, mealClockOffset } from "./meals"
import { acceptWorkouts } from "./workouts"
import { acceptRewards } from "./rewards"
import { acceptPractice } from "./practice"
import { assess, loggedDayCount } from "./score"
import { recoveryLetter, sendLetter } from "./mail"
import { cleanConsentAt } from "./legal"
import { cleanLocale } from "./locale"
import { cleanNudgePoints, freshen } from "./storage"
import type { Profile } from "./types"
import { publicOrigin } from "./origin"
import { HOUR_MS, takeRateLimit } from "./rate-limit"
import { qall, qget, qrun, setSeeder, type SqlDb } from "./sql"

export { databasePath, getDb, resetDbForTests, usesFileDatabase, usesPostgres } from "./sql"

type UserRow = {
  id: string
  email: string
  password_hash: string
  name: string
  role: Role
  profile_json: string | null
  created_at: string
}

export type AccessEntry = {
  id: string
  staffEmail: string
  openedAt: string
}

function demoSeedEnabled() {
  const flag = process.env.EPOCH_SEED_DEMO?.trim()
  if (flag === "1") return true
  if (flag === "0") return false
  return process.env.NODE_ENV !== "production"
}

async function insertUser(
  db: SqlDb,
  account: { email: string; password: string; name: string; role: Role; profile: Profile | null },
) {
  await db.prepare(
    `INSERT INTO users (id, email, password_hash, name, role, profile_json, created_at)
     VALUES (@id, @email, @password_hash, @name, @role, @profile_json, @created_at)`,
  ).run({
    id: randomUUID(),
    email: account.email,
    password_hash: hashPassword(account.password),
    name: account.name,
    role: account.role,
    profile_json: account.profile ? JSON.stringify(account.profile) : null,
    created_at: new Date().toISOString(),
  })
}

function demoAccounts(today: Date): Account[] {
  const accounts: Account[] = []
  const memberEmail = process.env.EPOCH_DEMO_EMAIL?.trim() ?? ""
  const memberPassword = process.env.EPOCH_DEMO_PASSWORD ?? ""
  if (memberEmail.includes("@") && memberPassword.length >= MIN_PASSWORD_LENGTH) {
    accounts.push({
      email: normalizeEmail(memberEmail),
      password: memberPassword,
      role: "member",
      name: "Demo member",
      profile: averyProfile(today),
    })
  }
  const adminEmail = process.env.EPOCH_DEMO_ADMIN_EMAIL?.trim() ?? ""
  const adminPassword = process.env.EPOCH_DEMO_ADMIN_PASSWORD ?? ""
  if (adminEmail.includes("@") && adminPassword.length >= MIN_PASSWORD_LENGTH) {
    accounts.push({
      email: normalizeEmail(adminEmail),
      password: adminPassword,
      role: "admin",
      name: "Epoch staff",
      profile: null,
    })
  }
  return accounts
}

async function seed(db: SqlDb) {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM users").get<{ n: number }>()
  if ((row?.n ?? 0) === 0 && demoSeedEnabled()) {
    await db.transaction(async () => {
      for (const account of demoAccounts(new Date())) await insertUser(db, account)
    })()
  }
  await ensureStaffAccount(db)
}

async function ensureStaffAccount(db: SqlDb) {
  const email = process.env.EPOCH_ADMIN_EMAIL?.trim().toLowerCase() ?? ""
  const password = process.env.EPOCH_ADMIN_PASSWORD ?? ""
  if (!email && !password) return
  if (!email.includes("@") || email.startsWith("@") || email.endsWith("@") || password.length < 8) {
    throw new Error("Set EPOCH_ADMIN_EMAIL and an EPOCH_ADMIN_PASSWORD of at least 8 characters.")
  }
  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").get<{ id: string }>(email)
  if (existing) return
  await insertUser(db, { email, password, name: "Epoch staff", role: "admin", profile: null })
}

setSeeder(seed)

async function toAccount(row: UserRow): Promise<PublicAccount> {
  if (!row.profile_json) {
    return { email: row.email, role: row.role, name: row.name, profile: null }
  }
  const profile = freshen(JSON.parse(row.profile_json) as Profile)
  const serialized = JSON.stringify(profile)
  if (serialized !== row.profile_json) {
    await qrun("UPDATE users SET profile_json = ?, name = ? WHERE id = ?", serialized, profile.name, row.id)
  }
  return { email: row.email, role: row.role, name: profile.name, profile }
}

async function rowById(id: string): Promise<UserRow | undefined> {
  return qget<UserRow>("SELECT * FROM users WHERE id = ?", id)
}

export async function userByEmail(email: string): Promise<UserRow | undefined> {
  return qget<UserRow>("SELECT * FROM users WHERE email = ?", email)
}

export async function openSession(email: string, password: string): Promise<{ token: string; account: PublicAccount } | null> {
  const row = await userByEmail(normalizeEmail(email))
  if (!row || !verifyPassword(password, row.password_hash)) return null
  const token = newSecret()
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await qrun(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    hashSecret(token),
    row.id,
    expires,
    new Date().toISOString(),
  )
  return { token, account: await toAccount(row) }
}

export async function accountForToken(token: string): Promise<{ id: string; account: PublicAccount } | null> {
  const row = await qget<UserRow>(
    `SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    hashSecret(token),
    new Date().toISOString(),
  )
  if (!row) return null
  return { id: row.id, account: await toAccount(row) }
}

export async function closeSession(token: string) {
  await qrun("DELETE FROM sessions WHERE token_hash = ?", hashSecret(token))
}

export async function registerMember(input: {
  email: string
  password: string
  name: string
}): Promise<{ token: string; account: PublicAccount } | { error: string }> {
  const checked = addMember([], input)
  if (checked.error || !checked.accounts[0]) return { error: checked.error ?? "Enter an email address." }
  const account = checked.accounts[0]
  try {
    await qrun(
      `INSERT INTO users (id, email, password_hash, name, role, profile_json, created_at)
       VALUES (?, ?, ?, ?, 'member', NULL, ?)`,
      randomUUID(),
      account.email,
      hashPassword(account.password),
      account.name,
      new Date().toISOString(),
    )
  } catch {
    return { error: "That email already has an account. Sign in instead." }
  }
  const opened = await openSession(account.email, account.password)
  if (!opened) return { error: "The account was created, but sign-in failed." }
  return opened
}

export async function listMembers(): Promise<PublicAccount[]> {
  const rows = await qall<UserRow>("SELECT * FROM users WHERE role = 'member' ORDER BY email")
  const accounts: PublicAccount[] = []
  for (const row of rows) accounts.push(await toAccount(row))
  return accounts
}

export async function saveOwnedProfile(
  userId: string,
  incoming: Profile,
  options?: { grantHealthConsent?: boolean },
): Promise<PublicAccount | null> {
  const row = await rowById(userId)
  if (!row || row.role !== "member") return null
  const stored = row.profile_json ? (JSON.parse(row.profile_json) as Profile) : null
  const serverNow = new Date()
  const healthConsentAt =
    cleanConsentAt(stored?.healthConsentAt, serverNow.getTime()) ?? (options?.grantHealthConsent ? serverNow.toISOString() : null)
  const freshened = freshen({
    ...incoming,
    demo: stored?.demo ?? false,
    healthConsentAt,
    locale: cleanLocale(incoming.locale) ?? cleanLocale(stored?.locale),
  })
  const plan = recommendations({
    age: freshened.age,
    sex: freshened.sex,
    inputs: freshened.inputs,
    loggedDays: loggedDayCount(freshened.history),
  })
  const clock = mealClockOffset(stored?.rewardClockOffset, incoming.rewardClockOffset, serverNow)
  const rewards = acceptRewards({
    stored: stored?.rewards,
    incoming: incoming.rewards,
    history: freshened.history,
    serverNow,
    requestedOffset: incoming.rewardClockOffset,
    storedOffset: stored?.rewardClockOffset,
    dayDoneDelta: plan[0]?.points ?? 0,
  })
  const meals = acceptMeals({
    stored: stored?.meals,
    incoming: incoming.meals,
    serverNow,
    offset: clock,
  })
  const workouts = acceptWorkouts({
    stored: stored?.workouts,
    incoming: incoming.workouts,
    serverNow,
    offset: clock,
  })
  const profile = {
    ...freshened,
    rewards: rewards.rewards,
    nudgePoints: cleanNudgePoints(stored?.nudgePoints),
    meals,
    workouts,
    rewardClockOffset: clock ?? rewards.rewardClockOffset,
    practice: acceptPractice({
      stored: stored?.practice,
      incoming: freshened.practice,
      serverNow,
      offset: clock,
    }),
  }
  await qrun("UPDATE users SET profile_json = ?, name = ? WHERE id = ?", JSON.stringify(profile), profile.name, userId)
  const next = await rowById(userId)
  return next ? toAccount(next) : null
}

export async function listAccess(memberId: string): Promise<AccessEntry[]> {
  const rows = await qall<{ id: string; staff_email: string; opened_at: string }>(
    "SELECT id, staff_email, opened_at FROM access_log WHERE member_user_id = ? ORDER BY opened_at DESC LIMIT 40",
    memberId,
  )
  return rows.map((row) => ({ id: row.id, staffEmail: row.staff_email, openedAt: row.opened_at }))
}

export async function openMemberFile(staffEmail: string, memberEmail: string): Promise<{ account: PublicAccount } | { error: string }> {
  const row = await userByEmail(normalizeEmail(memberEmail))
  if (!row || row.role !== "member") return { error: "That member is not on this server." }
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const recent = await qget<{ id: string }>(
    "SELECT id FROM access_log WHERE staff_email = ? AND member_user_id = ? AND opened_at > ?",
    staffEmail,
    row.id,
    since,
  )
  if (!recent) {
    await qrun(
      "INSERT INTO access_log (id, staff_email, member_user_id, opened_at) VALUES (?, ?, ?, ?)",
      randomUUID(),
      staffEmail,
      row.id,
      new Date().toISOString(),
    )
  }
  return { account: await toAccount(row) }
}

export async function deleteOwnedAccount(userId: string): Promise<boolean> {
  const row = await rowById(userId)
  if (!row || row.role !== "member") return false
  await qrun("DELETE FROM users WHERE id = ?", userId)
  return true
}

const RESET_WINDOW_MS = HOUR_MS
const RESET_MAX = 3

export async function joinRequiresInvite(): Promise<boolean> {
  const row = await qget<{ n: number }>("SELECT COUNT(*) AS n FROM users")
  if (!row || row.n === 0) return false
  if (process.env.EPOCH_BETA_CODE?.trim()) return true
  return process.env.NODE_ENV === "production"
}

function codesMatch(left: string, right: string): boolean {
  const a = Buffer.from(hashSecret(left))
  const b = Buffer.from(hashSecret(right))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function acceptInvite(code: string): Promise<boolean> {
  const trimmed = code.trim()
  if (!trimmed) return false
  const shared = process.env.EPOCH_BETA_CODE?.trim() ?? ""
  if (shared && codesMatch(trimmed, shared)) return true
  const hashed = hashSecret(trimmed)
  const row = await qget<{ id: string }>("SELECT id FROM invites WHERE code_hash = ? AND used_at IS NULL", hashed)
  if (!row) return false
  await qrun("UPDATE invites SET used_at = ? WHERE id = ? AND used_at IS NULL", new Date().toISOString(), row.id)
  return true
}

export async function mintInvite(): Promise<{ code: string }> {
  const code = newSecret().slice(0, 12)
  await qrun("INSERT INTO invites (id, code_hash, created_at) VALUES (?, ?, ?)", randomUUID(), hashSecret(code), new Date().toISOString())
  return { code }
}

export type InviteRow = { id: string; createdAt: string; usedAt: string | null }

export async function listInvites(): Promise<InviteRow[]> {
  return qall<InviteRow>(`SELECT id, created_at AS "createdAt", used_at AS "usedAt" FROM invites ORDER BY created_at DESC LIMIT 40`)
}

export const RECOVERY_NOTICE = "If that email is on a file, a reset note is on its way."

export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  const needle = normalizeEmail(email)
  const base = publicOrigin()
  const now = Date.now()
  if (!needle.includes("@") || !base) return { ok: true }
  if (!(await takeRateLimit("recover-email", needle, RESET_MAX, RESET_WINDOW_MS, now))) return { ok: true }
  const row = await userByEmail(needle)
  if (!row || row.role !== "member") return { ok: true }
  const token = newSecret()
  const created = new Date(now).toISOString()
  const expires = new Date(now + RESET_WINDOW_MS).toISOString()
  await qrun("UPDATE recovery_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL", created, row.id)
  await qrun(
    "INSERT INTO recovery_tokens (token_hash, user_id, kind, expires_at, used_at, created_at) VALUES (?, ?, 'reset', ?, NULL, ?)",
    hashSecret(token),
    row.id,
    expires,
    created,
  )
  const letter = recoveryLetter(base, token)
  const outboxId = randomUUID()
  await qrun(
    "INSERT INTO mail_outbox (id, to_email, subject, body, sent_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)",
    outboxId,
    row.email,
    letter.subject,
    letter.body,
    created,
  )
  const sent = await sendLetter({ to: row.email, subject: letter.subject, body: letter.body })
  if (sent) await qrun("UPDATE mail_outbox SET sent_at = ? WHERE id = ?", new Date().toISOString(), outboxId)
  return { ok: true }
}

export async function resetPasswordWithToken(token: string, password: string): Promise<{ ok: true } | { error: string }> {
  if (password.trim().length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.` }
  }
  const hashed = hashSecret(token)
  const now = new Date().toISOString()
  const row = await qget<{ userId: string }>(
    `SELECT user_id AS "userId" FROM recovery_tokens
     WHERE token_hash = ? AND kind = 'reset' AND used_at IS NULL AND expires_at > ?`,
    hashed,
    now,
  )
  if (!row) return { error: "That reset link is closed. Request a new one." }
  await qrun("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(password), row.userId)
  await qrun("UPDATE recovery_tokens SET used_at = ? WHERE token_hash = ?", now, hashed)
  await qrun("DELETE FROM sessions WHERE user_id = ?", row.userId)
  return { ok: true }
}

export async function changePassword(userId: string, current: string, next: string): Promise<{ ok: true } | { error: string }> {
  const row = await rowById(userId)
  if (!row) return { error: "Sign in again." }
  if (!verifyPassword(current, row.password_hash)) return { error: "That current password does not match." }
  if (next.trim().length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.` }
  }
  await qrun("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(next), userId)
  return { ok: true }
}

export type OutboxRow = { id: string; toEmail: string; subject: string; body: string; sentAt: string | null; createdAt: string }

export async function listOutbox(): Promise<OutboxRow[]> {
  return qall<OutboxRow>(
    `SELECT id, to_email AS "toEmail", subject, body, sent_at AS "sentAt", created_at AS "createdAt"
     FROM mail_outbox ORDER BY created_at DESC LIMIT 40`,
  )
}

export type BoardRow = {
  handle: string
  name: string
  age: number
  score: number
  ageDelta: number
}

export async function listBoard(): Promise<BoardRow[]> {
  const rows = await qall<UserRow>("SELECT * FROM users WHERE role = 'member'")
  const board: BoardRow[] = []
  for (const row of rows) {
    const account = await toAccount(row)
    const profile = account.profile
    if (!profile || !profile.leaderboard || profile.demo) continue
    const model = assess({
      age: profile.age,
      sex: profile.sex,
      inputs: profile.inputs,
      loggedDays: loggedDayCount(profile.history),
    })
    board.push({
      handle: profile.handle,
      name: profile.name,
      age: profile.age,
      score: model.longevityScore,
      ageDelta: model.ageDelta,
    })
  }
  board.sort((a, b) => b.score - a.score || a.handle.localeCompare(b.handle))
  return board
}
