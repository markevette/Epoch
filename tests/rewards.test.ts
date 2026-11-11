import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseIsoDate } from "../src/lib/format"
import { averyProfile } from "../src/lib/personas"
import {
  acceptRewards,
  deviceWallClock,
  morningsKeptLine,
  rewardPointsForAction,
  rewardWindow,
  summarizeRewards,
  type RewardCheckIn,
} from "../src/lib/rewards"
import { assess } from "../src/lib/score"
import { freshen } from "../src/lib/storage"
import type { Profile } from "../src/lib/types"

function entry(date: string, slot: RewardCheckIn["slot"], note = ""): RewardCheckIn {
  return { date, slot, at: "2026-10-27T10:00:00.000Z", note, bonus: 0 }
}

function fullDay(date: string): RewardCheckIn[] {
  return [entry(date, "morning"), entry(date, "day", "done"), entry(date, "night", "Held.")]
}

const WEEK = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]

describe("reward check-ins", () => {
  it("gives the night after midnight to the previous date", async () => {
    assert.deepEqual(rewardWindow(new Date(2026, 9, 27, 1, 0)), { slot: "night", date: "2026-10-26" })
    assert.deepEqual(rewardWindow(new Date(2026, 9, 27, 4, 59)), { slot: "night", date: "2026-10-26" })
    assert.deepEqual(rewardWindow(new Date(2026, 9, 27, 5, 0)), { slot: "morning", date: "2026-10-27" })
    assert.deepEqual(rewardWindow(new Date(2026, 9, 27, 12, 0)), { slot: "day", date: "2026-10-27" })
    assert.deepEqual(rewardWindow(new Date(2026, 9, 27, 18, 0)), { slot: "night", date: "2026-10-27" })
  })

  it("reads the device offset rather than the server zone", async () => {
    const serverNow = new Date(Date.UTC(2026, 9, 27, 4, 30))
    assert.deepEqual(rewardWindow(deviceWallClock(serverNow, 0)), { slot: "night", date: "2026-10-26" })
    assert.deepEqual(rewardWindow(deviceWallClock(serverNow, -60)), { slot: "morning", date: "2026-10-27" })
  })

  it("pays 2, 2, and 1, and refuses a second claim or a backfill", async () => {
    const serverNow = new Date(Date.UTC(2026, 9, 27, 9, 0))
    const history = [{ date: "2026-10-27", source: "logged" }]
    const morning = entry("2026-10-27", "morning", "please ignore")
    const opened = acceptRewards({
      stored: [],
      incoming: [entry("2020-01-06", "morning"), morning],
      history,
      serverNow,
      requestedOffset: 0,
      storedOffset: null,
    })
    assert.equal(opened.rewards.length, 1)
    assert.equal(opened.rewards[0]?.slot, "morning")
    assert.equal(opened.rewards[0]?.note, "")
    assert.equal(opened.rewardClockOffset, 0)
    assert.equal(summarizeRewards(opened.rewards, new Date(2026, 9, 27, 9)).total, 2)

    const repeat = acceptRewards({
      stored: opened.rewards,
      incoming: opened.rewards,
      history,
      serverNow,
      requestedOffset: 0,
      storedOffset: 0,
    })
    assert.equal(repeat.rewards.length, 1)

    const otherSlot = acceptRewards({
      stored: opened.rewards,
      incoming: [...opened.rewards, entry("2026-10-27", "day", "done")],
      history,
      serverNow,
      requestedOffset: 0,
      storedOffset: 0,
    })
    assert.equal(otherSlot.rewards.length, 1)

    const unlogged = acceptRewards({
      stored: [],
      incoming: [morning],
      history: [{ date: "2026-10-27", source: "modeled" }],
      serverNow,
      requestedOffset: 0,
      storedOffset: null,
    })
    assert.equal(unlogged.rewards.length, 0)
    assert.equal(unlogged.rewardClockOffset, null)
  })

  it("does not let a shifted clock open the other slots", async () => {
    const serverNow = new Date(Date.UTC(2026, 9, 27, 4, 30))
    const stored = [entry("2026-10-26", "night", "Earlier.")]
    const locked = acceptRewards({
      stored,
      incoming: [...stored, entry("2026-10-27", "morning")],
      history: [
        { date: "2026-10-26", source: "logged" },
        { date: "2026-10-27", source: "logged" },
      ],
      serverNow,
      requestedOffset: -60,
      storedOffset: 0,
    })
    assert.equal(locked.rewards.length, 1)
    assert.equal(locked.rewards[0]?.slot, "night")
    assert.equal(locked.rewardClockOffset, 0)
  })

  it("accepts a done, skipped, or unassigned day, and a night note of 1 to 140 characters", async () => {
    const dayNow = new Date(Date.UTC(2026, 9, 27, 15, 0))
    for (const note of ["done", "skipped", "unassigned"]) {
      const saved = acceptRewards({
        stored: [],
        incoming: [entry("2026-10-27", "day", note)],
        history: [],
        serverNow: dayNow,
        requestedOffset: 0,
        storedOffset: null,
      })
      assert.equal(saved.rewards[0]?.note, note)
      assert.equal(summarizeRewards(saved.rewards, new Date(2026, 9, 27, 15)).total, 2)
    }
    const rejected = acceptRewards({
      stored: [],
      incoming: [entry("2026-10-27", "day", "maybe")],
      history: [],
      serverNow: dayNow,
      requestedOffset: 0,
      storedOffset: null,
    })
    assert.equal(rejected.rewards.length, 0)

    const nightNow = new Date(Date.UTC(2026, 9, 27, 20, 0))
    const blank = acceptRewards({
      stored: [],
      incoming: [entry("2026-10-27", "night", "   ")],
      history: [],
      serverNow: nightNow,
      requestedOffset: 0,
      storedOffset: null,
    })
    assert.equal(blank.rewards.length, 0)
    const long = acceptRewards({
      stored: [],
      incoming: [entry("2026-10-27", "night", "a".repeat(141))],
      history: [],
      serverNow: nightNow,
      requestedOffset: 0,
      storedOffset: null,
    })
    assert.equal(long.rewards.length, 0)
    const kept = acceptRewards({
      stored: [],
      incoming: [entry("2026-10-27", "night", "a".repeat(140))],
      history: [],
      serverNow: nightNow,
      requestedOffset: 0,
      storedOffset: null,
    })
    assert.equal(kept.rewards[0]?.note.length, 140)
    assert.equal(summarizeRewards(kept.rewards, new Date(2026, 9, 27, 20)).total, 1)
  })

  it("adds 5 on Sunday after five complete days, and a full week is 40", async () => {
    assert.equal(parseIsoDate("2026-10-19").getDay(), 1)
    assert.equal(parseIsoDate("2026-10-25").getDay(), 0)
    const full = WEEK.flatMap(fullDay)
    const sunday = new Date(2026, 9, 25, 18)
    const complete = summarizeRewards(full, sunday)
    assert.equal(complete.checkInPoints, 35)
    assert.equal(complete.weekBonus, 5)
    assert.equal(complete.total, 40)
    assert.equal(complete.morningsKept, 7)

    const saturday = summarizeRewards(full.slice(0, 15), new Date(2026, 9, 24, 12))
    assert.equal(saturday.checkInPoints, 25)
    assert.equal(saturday.weekBonus, 0)
    assert.equal(saturday.total, 25)

    assert.equal(summarizeRewards(full.slice(0, 15), sunday).total, 30)
    assert.equal(summarizeRewards(full.slice(0, 12), sunday).weekBonus, 0)

    const gapped = ["2026-10-19", "2026-10-20", "2026-10-22", "2026-10-23", "2026-10-25"].flatMap(fullDay)
    const gap = summarizeRewards(gapped, sunday)
    assert.equal(gap.weekBonus, 5)
    assert.equal(gap.total, 30)
    assert.equal(gap.thisWeekComplete, 5)
  })

  it("counts mornings kept without turning a gap into a penalty", async () => {
    const mornings = [entry("2026-10-19", "morning"), entry("2026-10-21", "morning")]
    const summary = summarizeRewards(mornings, new Date(2026, 9, 25, 12))
    assert.equal(summary.total, 4)
    assert.equal(summary.morningsKept, 2)
    assert.equal(summary.weekBonus, 0)
    assert.equal(morningsKeptLine(0), null)
    assert.equal(morningsKeptLine(1), "1 morning kept")
    assert.equal(morningsKeptLine(18), "18 mornings kept")
    assert.equal(summarizeRewards([], new Date(2026, 9, 27)).total, 0)
  })

  it("adds the day’s action to the balance only when it is marked done", async () => {
    const dayNow = new Date(Date.UTC(2026, 9, 27, 15, 0))
    const forged = { ...entry("2026-10-27", "day", "done"), bonus: 99 }
    const saved = acceptRewards({
      stored: [],
      incoming: [forged],
      history: [],
      serverNow: dayNow,
      requestedOffset: 0,
      storedOffset: null,
      dayDoneDelta: 2.8,
    })
    assert.equal(saved.rewards[0]?.bonus, 3)
    assert.equal(summarizeRewards(saved.rewards, new Date(2026, 9, 27, 15)).total, 5)
    const skipped = acceptRewards({
      stored: [],
      incoming: [entry("2026-10-27", "day", "skipped")],
      history: [],
      serverNow: dayNow,
      requestedOffset: 0,
      storedOffset: null,
      dayDoneDelta: 2.8,
    })
    assert.equal(skipped.rewards[0]?.bonus, 0)
    assert.equal(summarizeRewards(skipped.rewards, new Date(2026, 9, 27, 15)).total, 2)
    assert.equal(rewardPointsForAction(2.8), 3)
    assert.equal(rewardPointsForAction(0.2), 0)
  })

  it("keeps stored check-ins when a save omits them", async () => {
    const stored = [entry("2026-10-27", "morning")]
    const saved = acceptRewards({
      stored,
      incoming: [],
      history: [],
      serverNow: new Date(Date.UTC(2026, 9, 27, 15, 0)),
      requestedOffset: 0,
      storedOffset: 0,
    })
    assert.equal(saved.rewards.length, 1)
  })

  it("round-trips check-ins on the file and leaves the age model unchanged", async () => {
    const profile = averyProfile(new Date(2026, 9, 27, 10))
    assert.deepEqual(profile.rewards, [])
    const blank = freshen({ ...profile, rewards: undefined as unknown as Profile["rewards"], rewardClockOffset: 90.8 })
    assert.deepEqual(blank.rewards, [])
    assert.equal(blank.rewardClockOffset, 90)
    const kept = freshen({ ...profile, rewards: fullDay("2026-10-20"), rewardClockOffset: -60 })
    assert.equal(kept.rewards.length, 3)
    assert.equal(kept.rewardClockOffset, -60)

    const args = {
      age: profile.age,
      sex: profile.sex,
      inputs: profile.inputs,
      loggedDays: 4,
    }
    const before = assess(args)
    assert.equal(summarizeRewards(kept.rewards, new Date(2026, 9, 27, 10)).total, 5)
    const after = assess(args)
    assert.equal(after.longevityScore, before.longevityScore)
    assert.equal(after.biologicalAge, before.biologicalAge)
  })
})
