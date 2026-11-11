import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { acceptMeals, foodDay, mealClockOffset, mealsDue, normalizeMeals, type MealDay } from "../src/lib/meals"
import { averyProfile } from "../src/lib/personas"
import { freshen } from "../src/lib/storage"
import type { Profile } from "../src/lib/types"

function day(date: string, breakfast: number | null, lunch: number | null, dinner: number | null): MealDay {
  return { date, breakfast, lunch, dinner }
}

describe("meal calories", () => {
  it("asks for the meals the clock has already reached", async () => {
    assert.deepEqual(mealsDue(new Date(2026, 9, 27, 8, 30)), ["breakfast"])
    assert.equal(foodDay(new Date(2026, 9, 27, 8, 30)), "2026-10-27")
    assert.deepEqual(mealsDue(new Date(2026, 9, 27, 14, 0)), ["breakfast", "lunch"])
    assert.deepEqual(mealsDue(new Date(2026, 9, 27, 19, 5)), ["breakfast", "lunch", "dinner"])
    assert.deepEqual(mealsDue(new Date(2026, 9, 28, 1, 15)), ["breakfast", "lunch", "dinner"])
    assert.equal(foodDay(new Date(2026, 9, 28, 1, 15)), "2026-10-27")
  })

  it("stores zero and keeps an earlier meal when a later one is added", async () => {
    const morning = new Date(Date.UTC(2026, 9, 27, 8, 0))
    const opened = acceptMeals({
      stored: [],
      incoming: [day("2026-10-27", 0, 900, 900)],
      serverNow: morning,
      offset: 0,
    })
    assert.deepEqual(opened, [day("2026-10-27", 0, null, null)])

    const evening = new Date(Date.UTC(2026, 9, 27, 19, 30))
    const later = acceptMeals({
      stored: opened,
      incoming: [day("2026-10-27", 0, 640, 810)],
      serverNow: evening,
      offset: 0,
    })
    assert.deepEqual(later, [day("2026-10-27", 0, 640, 810)])
  })

  it("refuses dinner before evening, a past day, and a number outside 0 to 4000", async () => {
    const afternoon = new Date(Date.UTC(2026, 9, 27, 15, 0))
    const stored = [day("2026-10-26", 300, 500, 700)]
    const saved = acceptMeals({
      stored,
      incoming: [day("2026-10-26", 1, 1, 1), { date: "2026-10-27", breakfast: 400, lunch: -5, dinner: 4001 } as MealDay],
      serverNow: afternoon,
      offset: 0,
    })
    assert.deepEqual(saved, [...stored, day("2026-10-27", 400, null, null)])

    const fraction = acceptMeals({
      stored: [],
      incoming: [{ date: "2026-10-27", breakfast: 1.5, lunch: 20, dinner: 30 } as MealDay],
      serverNow: afternoon,
      offset: 0,
    })
    assert.deepEqual(fraction, [day("2026-10-27", null, 20, null)])

    const evening = new Date(Date.UTC(2026, 9, 27, 20, 0))
    const capped = acceptMeals({
      stored: [day("2026-10-27", 100, 200, 0)],
      incoming: [{ date: "2026-10-27", breakfast: 100, lunch: 200, dinner: 4001 } as MealDay],
      serverNow: evening,
      offset: 0,
    })
    assert.equal(capped[0]?.dinner, 0)
  })

  it("does not let a shifted clock open dinner early", async () => {
    const serverNow = new Date(Date.UTC(2026, 9, 27, 16, 0))
    const offset = mealClockOffset(0, -180, serverNow)
    assert.equal(offset, 0)
    const saved = acceptMeals({
      stored: [day("2026-10-27", 200, 300, null)],
      incoming: [day("2026-10-27", 200, 300, 900)],
      serverNow,
      offset,
    })
    assert.equal(saved[0]?.dinner, null)
  })

  it("drops an empty day and keeps a missing list as none", async () => {
    assert.deepEqual(normalizeMeals(undefined), [])
    assert.deepEqual(normalizeMeals([day("2026-10-27", null, null, null)]), [])
    const profile = averyProfile(new Date(2026, 9, 27, 12))
    const blank = freshen({ ...profile, meals: undefined as unknown as Profile["meals"] })
    assert.deepEqual(blank.meals, [])
  })
})
