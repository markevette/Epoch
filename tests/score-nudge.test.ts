import assert from "node:assert/strict"
import { mkdtempSync } from "fs"
import { tmpdir } from "os"
import path from "path"
import { describe, it } from "node:test"
import { accountForToken, getDb, openSession, registerMember, resetDbForTests, saveOwnedProfile } from "../src/lib/db"
import { addDays, isoDate, parseIsoDate } from "../src/lib/format"
import { averyProfile } from "../src/lib/personas"
import { acceptBuddy, buddyRequests, buddyWeek, pairBoard, requestBuddy, sendScoreNudge } from "../src/lib/pair-store"
import { SCORE_NUDGE_POINTS } from "../src/lib/score-week"
import type { Profile } from "../src/lib/types"

process.env.EPOCH_DB = path.join(mkdtempSync(path.join(tmpdir(), "epoch-nudge-")), "test.sqlite")
resetDbForTests()

const now = new Date(2026, 10, 2, 15, 0, 0)

describe("buddy week", () => {
  it("compares the last 7 scores and pays 2 points for one matching line a day", async () => {
    const avery = await member("nudge-avery@example.com", "nudge-avery", "Avery Chen", "averyweek")
    const mina = await member("nudge-mina@example.com", "nudge-mina", "Mina Shah", "minaweek")
    await tilt(mina, "down", now)
    const minaCode = await codeOf(mina)
    assert.deepEqual(await requestBuddy(avery, minaCode), { ok: true })
    const incoming = await buddyRequests(mina)
    assert.ok(!("error" in incoming))
    if ("error" in incoming) return
    assert.deepEqual(await acceptBuddy(mina, incoming.incoming[0]!.id, 0, new Date(2026, 10, 1, 10)), { ok: true })
    const board = await pairBoard(avery, 0, now)
    assert.ok(!("error" in board))
    if ("error" in board) return
    const pairId = board.pairs[0]!.id
    const before = board.points

    const week = await buddyWeek(avery, pairId, 0, now)
    assert.ok(!("error" in week))
    if ("error" in week) return
    assert.equal(week.you.length, 7)
    assert.equal(week.them.length, 7)
    assert.equal(week.tone, "down")
    assert.match(week.options.map((option) => option.text).join(" "), /How are you doing/)
    assert.equal(week.partnerName, "Mina Shah")

    const stranger = await buddyWeek("missing-user", pairId, 0, now)
    assert.equal("error" in stranger, true)

    const wrong = await sendScoreNudge(avery, pairId, "up-keep", 0, now)
    assert.equal("error" in wrong, true)
    if (!("error" in wrong)) return
    assert.equal(wrong.error, "That line does not match their week.")

    const sent = await sendScoreNudge(avery, pairId, week.options[0]!.id, 0, now)
    assert.ok(!("error" in sent))
    if ("error" in sent) return
    assert.equal(sent.sentToday?.text, week.options[0]!.text)
    assert.equal(sent.yourPoints, before + SCORE_NUDGE_POINTS)

    const again = await sendScoreNudge(avery, pairId, week.options[1]!.id, 0, now)
    assert.equal("error" in again, true)
    if (!("error" in again)) return
    assert.equal(again.error, "You already sent a line today.")
    const after = await pairBoard(avery, 0, now)
    assert.ok(!("error" in after) && after.points === before + SCORE_NUDGE_POINTS)

    const seen = await buddyWeek(mina, pairId, 0, now)
    assert.ok(!("error" in seen) && seen.received?.text === week.options[0]!.text)

    const row = await (await getDb()).prepare("SELECT profile_json FROM users WHERE id = ?").get(avery) as { profile_json: string }
    const forged = JSON.parse(row.profile_json) as Profile
    forged.nudgePoints = 900
    const saved = await saveOwnedProfile(avery, forged)
    assert.equal(saved?.profile?.nudgePoints, before + SCORE_NUDGE_POINTS)
  })
})

async function codeOf(userId: string): Promise<string> {
  const board = await pairBoard(userId, 0, now)
  if ("error" in board) throw new Error(board.error)
  return board.code
}

async function member(email: string, password: string, name: string, handle: string): Promise<string> {
  const created = await registerMember({ email, password, name })
  const token = "error" in created ? (await openSession(email, password))?.token : created.token
  const authed = token ? await accountForToken(token) : null
  if (!authed) throw new Error("error" in created ? created.error : "missing session")
  const profile = averyProfile(now)
  profile.name = name
  profile.handle = handle
  profile.demo = false
  profile.rewards = []
  const saved = await saveOwnedProfile(authed.id, profile)
  if (!saved?.profile) throw new Error("profile")
  return authed.id
}

async function tilt(userId: string, direction: "up" | "down", today: Date) {
  const row = await (await getDb()).prepare("SELECT profile_json FROM users WHERE id = ?").get(userId) as { profile_json: string }
  const profile = JSON.parse(row.profile_json) as Profile
  const end = isoDate(today)
  for (let index = 0; index < 7; index += 1) {
    const date = isoDate(addDays(parseIsoDate(end), index - 6))
    const sleepHours = direction === "down" ? 8.6 - index * 0.6 : 5 + index * 0.55
    const stress = direction === "down" ? 2 + index : 8 - index
    const steps = direction === "down" ? 10000 - index * 1100 : 2500 + index * 1100
    const inputs = { ...profile.inputs, sleepHours, stress, steps }
    const existing = profile.history.find((day) => day.date === date)
    if (existing) {
      existing.inputs = inputs
      existing.source = "logged"
    } else {
      profile.history.push({ date, inputs, source: "logged" })
    }
  }
  await (await getDb()).prepare("UPDATE users SET profile_json = ? WHERE id = ?").run(JSON.stringify(profile), userId)
}
