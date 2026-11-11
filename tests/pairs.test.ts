import assert from "node:assert/strict"
import { mkdtempSync } from "fs"
import { tmpdir } from "os"
import path from "path"
import { describe, it } from "node:test"
import { accountForToken, getDb, openSession, registerMember, resetDbForTests, saveOwnedProfile } from "../src/lib/db"
import { averyProfile } from "../src/lib/personas"
import { acceptBuddy, acceptPairInvite, buddyRequests, createPairInvite, deletePair, leavePair, nudgePair, pairBoard, rejectBuddy, requestBuddy, searchBuddy } from "../src/lib/pair-store"
import { buddyCap, evaluatePair, firstSharedMorning, type PairPerson } from "../src/lib/pairs"
import type { Profile } from "../src/lib/types"

process.env.EPOCH_DB = path.join(mkdtempSync(path.join(tmpdir(), "epoch-pair-")), "test.sqlite")
resetDbForTests()

function at(iso: string, hour: number, offset = 0): Date {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, hour, 0, 0) + offset * 60_000)
}

function person(name: string, mornings: string[], complete: string[] = [], offset: number | null = 0): PairPerson {
  return { name, offsetMinutes: offset, morningDates: mornings, completeDates: complete }
}

const quiet = { pauses: [], repairs: [], nudge: null, shareA: false, shareB: false }

describe("pair mornings", () => {
  it("opens one more buddy at every 150 points", async () => {
    assert.equal(buddyCap(0), 5)
    assert.equal(buddyCap(149), 5)
    assert.equal(buddyCap(150), 6)
    assert.equal(buddyCap(300), 7)
  })

  it("starts on the next morning both people can still keep", async () => {
    const afternoon = at("2026-10-31", 15)
    assert.equal(firstSharedMorning(afternoon, 0, 0), "2026-11-01")
    const morning = at("2026-10-31", 10)
    assert.equal(firstSharedMorning(morning, 0, 0), "2026-10-31")
    assert.equal(firstSharedMorning(morning, 0, -300), "2026-11-01")
  })

  it("counts a day only after both mornings are kept, and waits while one window is open", async () => {
    const days = ["2026-10-28", "2026-10-29", "2026-10-30"]
    const open = evaluatePair({
      now: at("2026-10-31", 10),
      startedOn: "2026-10-28",
      you: "a",
      personA: person("Avery Chen", [...days, "2026-10-31"]),
      personB: person("Mina Shah", days),
      ...quiet,
    })
    assert.equal(open.streak, 3)
    assert.equal(open.line, "You kept this morning. Mina's morning is still open.")
    assert.equal(open.canNudge, true)

    const both = evaluatePair({
      now: at("2026-10-31", 10),
      startedOn: "2026-10-28",
      you: "a",
      personA: person("Avery Chen", [...days, "2026-10-31"]),
      personB: person("Mina Shah", [...days, "2026-10-31"]),
      ...quiet,
    })
    assert.equal(both.streak, 4)
    assert.equal(both.line, "4 mornings together")

    const waiting = evaluatePair({
      now: at("2026-10-31", 15),
      startedOn: "2026-10-30",
      you: "a",
      personA: person("Avery Chen", ["2026-10-30"], [], 0),
      personB: person("Mina Shah", ["2026-10-30"], [], 300),
      ...quiet,
    })
    assert.equal(waiting.streak, 1)
    assert.equal(waiting.line, "Your morning closed. Mina's morning is still open.")
  })

  it("resets after both windows close on a miss, and a pause keeps the run without adding a day", async () => {
    const kept = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]
    const complete = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]
    const missed = evaluatePair({
      now: at("2026-11-03", 15),
      startedOn: "2026-10-26",
      you: "a",
      personA: person("Avery Chen", kept, complete),
      personB: person("Mina Shah", kept, complete),
      ...quiet,
    })
    assert.equal(missed.streak, 0)
    assert.equal(missed.longest, 8)
    assert.equal(missed.pauseDate, "2026-11-03")
    assert.equal(missed.pauseAvailable, true)

    const paused = evaluatePair({
      now: at("2026-11-03", 15),
      startedOn: "2026-10-26",
      you: "b",
      personA: person("Avery Chen", kept, complete),
      personB: person("Mina Shah", kept, complete),
      pauses: [{ weekMonday: missed.pauseWeek!, onDate: "2026-11-03" }],
      repairs: [],
      nudge: null,
      shareA: false,
      shareB: false,
    })
    assert.equal(paused.streak, 8)
    assert.equal(paused.line, "A pause covers this morning.")
    assert.equal(paused.yourMark, "pause")
  })

  it("restores a single missed morning once both agree, and only once that month", async () => {
    const before = ["2026-10-28", "2026-10-29", "2026-10-30"]
    const after = [...before, "2026-11-01"]
    const base = {
      now: at("2026-11-01", 15),
      startedOn: "2026-10-28",
      personA: person("Avery Chen", after),
      personB: person("Mina Shah", after),
      pauses: [],
      nudge: null,
      shareA: true,
      shareB: true,
    }
    const offered = evaluatePair({ ...base, you: "a", repairs: [] })
    assert.equal(offered.streak, 1)
    assert.equal(offered.repair?.gapDate, "2026-10-31")
    assert.equal(offered.repair?.youAgreed, false)

    const half = evaluatePair({
      ...base,
      you: "b",
      repairs: [{ month: "2026-11", gapDate: "2026-10-31", agreedA: true, agreedB: false }],
    })
    assert.equal(half.streak, 1)
    assert.equal(half.repair?.partnerAgreed, true)
    assert.equal(half.repair?.youAgreed, false)

    const restored = evaluatePair({
      ...base,
      you: "a",
      repairs: [{ month: "2026-11", gapDate: "2026-10-31", agreedA: true, agreedB: true }],
    })
    assert.equal(restored.streak, 4)
    assert.equal(restored.repair, null)

    const used = evaluatePair({
      now: at("2026-11-08", 15),
      startedOn: "2026-11-05",
      you: "a",
      personA: person("Avery Chen", ["2026-11-05", "2026-11-06", "2026-11-08"]),
      personB: person("Mina Shah", ["2026-11-05", "2026-11-06", "2026-11-08"]),
      pauses: [],
      repairs: [{ month: "2026-11", gapDate: "2026-10-31", agreedA: true, agreedB: true }],
      nudge: null,
      shareA: false,
      shareB: false,
    })
    assert.equal(used.repair, null)
    assert.equal(used.streak, 1)
  })

  it("nudges once while the other morning is open, and shares the card from 7 mornings when both allow it", async () => {
    const days = ["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"]
    const ready = evaluatePair({
      now: at("2026-10-31", 10),
      startedOn: "2026-10-25",
      you: "a",
      personA: person("Avery Chen", days),
      personB: person("Mina Shah", days.slice(0, 6)),
      ...quiet,
      shareA: true,
      shareB: true,
    })
    assert.equal(ready.canNudge, true)
    assert.equal(ready.milestone, null)

    const nudged = evaluatePair({
      now: at("2026-10-31", 10),
      startedOn: "2026-10-25",
      you: "b",
      personA: person("Avery Chen", days),
      personB: person("Mina Shah", days.slice(0, 6)),
      pauses: [],
      repairs: [],
      nudge: { date: "2026-10-31", by: "a" },
      shareA: true,
      shareB: false,
    })
    assert.equal(nudged.partnerNudged, true)
    assert.equal(nudged.canNudge, false)

    const card = evaluatePair({
      now: at("2026-10-31", 15),
      startedOn: "2026-10-25",
      you: "a",
      personA: person("Avery Chen", days),
      personB: person("Mina Shah", days),
      pauses: [],
      repairs: [],
      nudge: null,
      shareA: true,
      shareB: true,
    })
    assert.equal(card.streak, 7)
    assert.equal(card.milestone, 7)
    assert.equal(card.canShare, true)

    const held = evaluatePair({ ...cardInput(days), shareA: true, shareB: false })
    assert.equal(held.canShare, false)
  })
})

function cardInput(days: string[]) {
  return {
    now: at("2026-10-31", 15),
    startedOn: "2026-10-25",
    you: "a" as const,
    personA: person("Avery Chen", days),
    personB: person("Mina Shah", days),
    pauses: [],
    repairs: [],
    nudge: null,
  }
}

describe("buddy codes", () => {
  it("returns the exact code, or no such ID, and pairs only after they accept", async () => {
    const avery = await member("avery@epoch.app", "avery-pass", "Avery Chen", "avery")
    const mina = await member("mina@example.com", "mina-pass", "Mina Shah", "mina")
    const now = at("2026-10-31", 10)
    const minaCode = await codeOf(mina)
    const spaced = `${minaCode.slice(0, 3).toLowerCase()}-${minaCode.slice(3)}`

    assert.deepEqual(await searchBuddy(avery, "ZZZZZZ"), { found: false })
    const own = await searchBuddy(avery, await codeOf(avery))
    assert.ok(!("error" in own) && own.found && own.self)
    if ("error" in own || !own.found) return
    assert.equal(own.canPair, false)
    assert.equal(own.reason, "This is your code.")

    const hit = await searchBuddy(avery, `  ${spaced} `)
    assert.ok(!("error" in hit) && hit.found && !hit.self)
    if ("error" in hit || !hit.found) return
    assert.equal(hit.code, minaCode)
    assert.equal(hit.handle, "mina")
    assert.equal(hit.canPair, true)
    assert.equal(hit.reason, null)

    assert.deepEqual(await requestBuddy(avery, minaCode, now), { ok: true })
    const waiting = await searchBuddy(avery, minaCode)
    assert.ok(!("error" in waiting) && waiting.found)
    if ("error" in waiting || !waiting.found) return
    assert.equal(waiting.canPair, false)
    assert.equal(waiting.reason, "Waiting for Mina to accept.")
    const asked = await buddyRequests(mina)
    assert.ok(!("error" in asked))
    if ("error" in asked) return
    assert.equal(asked.incoming.length, 1)
    assert.equal(asked.incoming[0]?.code, await codeOf(avery))
    assert.deepEqual(await acceptBuddy(mina, asked.incoming[0]!.id, 0, now), { ok: true })

    await setMornings(avery, ["2026-10-31"])
    await setMornings(mina, ["2026-10-31"])
    const view = await pairBoard(avery, 0, now)
    assert.ok(!("error" in view))
    if ("error" in view) return
    assert.equal(view.pairs.length, 1)
    assert.equal(view.pairs[0]?.partnerHandle, "mina")
    assert.equal(view.pairs[0]?.streak, 1)
    assert.equal(view.pairs[0]?.line, "1 morning together")
    const pairId = view.pairs[0]!.id
    assert.deepEqual(await nudgePair(avery, pairId, 0, now), { error: "A nudge can wait. One line a day, and only while their morning is still open." })

    assert.deepEqual(await leavePair(mina, pairId, 0, now), { ok: true })
    const ended = await pairBoard(avery, 0, now)
    assert.ok(!("error" in ended))
    if ("error" in ended) return
    assert.equal(ended.pairs.length, 0)
    assert.equal(ended.ended[0]?.streak, 1)

    assert.deepEqual(await deletePair(avery, pairId), { ok: true })
    const minaAfter = await pairBoard(mina, 0, now)
    const averyAfter = await pairBoard(avery, 0, now)
    assert.ok(!("error" in minaAfter) && minaAfter.pairs.length === 0 && minaAfter.ended.length === 0)
    assert.ok(!("error" in averyAfter) && averyAfter.pairs.length === 0 && averyAfter.ended.length === 0)
  })

  it("lets the code owner reject, and hides the pair button once either person has five pairs", async () => {
    const noah = await member("noah@example.com", "noah-pass", "Noah Berg", "noah")
    const lina = await member("lina@example.com", "lina-pass", "Lina Berg", "lina")
    assert.deepEqual(await requestBuddy(noah, await codeOf(lina)), { ok: true })
    const incoming = await buddyRequests(lina)
    assert.ok(!("error" in incoming))
    if ("error" in incoming) return
    assert.deepEqual(await rejectBuddy(lina, incoming.incoming[0]!.id), { ok: true })
    const after = await buddyRequests(noah)
    const linaAfter = await buddyRequests(lina)
    assert.ok(!("error" in after) && after.outgoing[0]?.status === "rejected")
    assert.ok(!("error" in linaAfter) && linaAfter.incoming.length === 0)
    const noahBoard = await pairBoard(noah, 0)
    assert.ok(!("error" in noahBoard) && noahBoard.pairs.length === 0)

    const host = await member("host-cap@example.com", "host-pass", "Host Lane", "hostlane")
    const extras: string[] = []
    for (let index = 0; index < 6; index += 1) {
      extras.push(await member(`extra${index}@example.com`, `extra-pass-${index}`, `Extra ${index}`, `extra${index}`))
    }
    for (const other of extras.slice(0, 5)) {
      assert.deepEqual(await requestBuddy(host, await codeOf(other)), { ok: true })
      const row = await buddyRequests(other)
      assert.ok(!("error" in row))
      if ("error" in row) return
      assert.deepEqual(await acceptBuddy(other, row.incoming[0]!.id, 0, at("2026-10-31", 10)), { ok: true })
    }
    const full = await searchBuddy(host, await codeOf(extras[5]!))
    assert.ok(!("error" in full) && full.found)
    if ("error" in full || !full.found) return
    assert.equal(full.canPair, false)
    assert.equal(full.reason, "You already have 5 pairs.")
    const theirs = await searchBuddy(extras[5]!, await codeOf(host))
    assert.ok(!("error" in theirs) && theirs.found)
    if ("error" in theirs || !theirs.found) return
    assert.equal(theirs.canPair, false)
    assert.equal(theirs.reason, "Host already has 5 pairs.")

    const row = await (await getDb()).prepare("SELECT profile_json FROM users WHERE id = ?").get(host) as { profile_json: string }
    const profile = JSON.parse(row.profile_json) as Profile
    profile.rewards = Array.from({ length: 5 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0")
      return { date: `2026-10-${day}`, slot: "morning" as const, at: `2026-10-${day}T08:00:00.000Z`, note: "", bonus: 30 }
    })
    await (await getDb()).prepare("UPDATE users SET profile_json = ? WHERE id = ?").run(JSON.stringify(profile), host)
    const sixth = extras[5]!
    assert.deepEqual(await requestBuddy(host, await codeOf(sixth)), { ok: true })
    const opened = await buddyRequests(sixth)
    assert.ok(!("error" in opened))
    if ("error" in opened) return
    assert.deepEqual(await acceptBuddy(sixth, opened.incoming[0]!.id, 0, at("2026-10-31", 10)), { ok: true })
    const again = await member("seventh@example.com", "seventh-pass", "Seventh Lane", "seventh")
    const blocked = await searchBuddy(host, await codeOf(again))
    assert.ok(!("error" in blocked) && blocked.found)
    if ("error" in blocked || !blocked.found) return
    assert.equal(blocked.canPair, false)
    assert.equal(blocked.reason, "You already have 6 pairs.")
  })

  it("drops an expired link", async () => {
    const host = await member("host@example.com", "host-pass", "Host Lane", "host")
    const guest = await member("guest@example.com", "guest-pass", "Guest Lane", "guest")
    const invite = await createPairInvite(host, 0)
    assert.ok(!("error" in invite))
    await (await getDb()).prepare("UPDATE pair_invites SET expires_at = ? WHERE inviter_id = ?").run("2020-01-01T00:00:00.000Z", host)
    const token = invite.path.slice("/pair/".length)
    const accepted = await acceptPairInvite(guest, token, 0, at("2026-10-31", 10))
    assert.equal("error" in accepted, true)
  })
})

async function codeOf(userId: string): Promise<string> {
  const board = await pairBoard(userId, 0)
  if ("error" in board) throw new Error(board.error)
  return board.code
}

async function member(email: string, password: string, name: string, handle: string): Promise<string> {
  const created = await registerMember({ email, password, name })
  const token = "error" in created ? (await openSession(email, password))?.token : created.token
  const authed = token ? await accountForToken(token) : null
  if (!authed) throw new Error("error" in created ? created.error : "missing session")
  const profile = averyProfile(new Date(2026, 9, 31))
  profile.name = name
  profile.handle = handle
  profile.demo = false
  profile.rewards = []
  const saved = await saveOwnedProfile(authed.id, profile)
  if (!saved?.profile) throw new Error("profile")
  return authed.id
}

async function setMornings(userId: string, dates: string[]) {
  const row = await (await getDb()).prepare("SELECT profile_json FROM users WHERE id = ?").get(userId) as { profile_json: string }
  const profile = JSON.parse(row.profile_json) as Profile
  profile.rewards = dates.map((date) => ({ date, slot: "morning" as const, at: "2026-10-31T08:00:00.000Z", note: "", bonus: 0 }))
  profile.rewardClockOffset = 0
  await (await getDb()).prepare("UPDATE users SET profile_json = ? WHERE id = ?").run(JSON.stringify(profile), userId)
}
