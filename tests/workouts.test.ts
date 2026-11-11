import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { averyProfile } from "../src/lib/personas"
import { freshen } from "../src/lib/storage"
import type { Profile } from "../src/lib/types"
import { acceptWorkouts, burnedLine, normalizeWorkouts, type WorkoutDay } from "../src/lib/workouts"

function day(date: string, workedOut: boolean, kcal: number): WorkoutDay {
  return { date, workedOut, kcal }
}

describe("workout calories", () => {
  it("stores a yes with its burn, and turns a no into zero", async () => {
    const evening = new Date(Date.UTC(2026, 9, 27, 19, 0))
    const yes = acceptWorkouts({
      stored: [],
      incoming: [day("2026-10-27", true, 320), day("2020-01-06", true, 900)],
      serverNow: evening,
      offset: 0,
    })
    assert.deepEqual(yes, [day("2026-10-27", true, 320)])

    const no = acceptWorkouts({
      stored: yes,
      incoming: [day("2026-10-27", false, 900)],
      serverNow: evening,
      offset: 0,
    })
    assert.deepEqual(no, [day("2026-10-27", false, 0)])
    assert.equal(burnedLine(0), null)
    assert.equal(burnedLine(320), "320 kcal burned")
    assert.equal(burnedLine(null), null)
  })

  it("drops a burn outside 0 to 4000 and a shifted clock’s other day", async () => {
    const afternoon = new Date(Date.UTC(2026, 9, 27, 15, 0))
    const stored = [day("2026-10-26", true, 200)]
    const saved = acceptWorkouts({
      stored,
      incoming: [{ date: "2026-10-27", workedOut: true, kcal: 4001 } as WorkoutDay, day("2026-10-26", true, 1)],
      serverNow: afternoon,
      offset: 0,
    })
    assert.deepEqual(saved, stored)
    assert.deepEqual(normalizeWorkouts(undefined), [])
    const blank = freshen({ ...averyProfile(), workouts: undefined as unknown as Profile["workouts"] })
    assert.deepEqual(blank.workouts, [])
  })
})
