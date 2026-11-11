import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { bmi, bmiBand, normalizeBody } from "../src/lib/body"
import { averyProfile } from "../src/lib/personas"
import { assess } from "../src/lib/score"
import { freshen } from "../src/lib/storage"
import { dailyTip } from "../src/lib/tip"
import type { DriverKey } from "../src/lib/types"

const drivers: { key: DriverKey; score: number }[] = [
  { key: "sleep", score: 80 },
  { key: "hrv", score: 70 },
  { key: "restingHr", score: 75 },
  { key: "activity", score: 60 },
  { key: "nutrition", score: 40 },
  { key: "stress", score: 55 },
]

describe("body mass index", () => {
  it("computes weight over height squared", async () => {
    const value = bmi(165, 62)
    assert.ok(Math.abs(value - 22.77) < 0.02)
    assert.equal(bmiBand(value), "usual")
    assert.equal(bmiBand(17.2), "under")
    assert.equal(bmiBand(27), "over")
    assert.equal(bmiBand(31), "high")
  })

  it("keeps Avery’s measurements and leaves biological age on the behavior model", async () => {
    const avery = averyProfile(new Date(2026, 9, 16))
    assert.equal(avery.heightCm, 165)
    assert.equal(avery.weightKg, 62)
    const withBody = assess({
      age: avery.age,
      sex: avery.sex,
      inputs: avery.inputs,
      loggedDays: 0,
    })
    assert.ok(Math.abs(withBody.biologicalAge - (avery.age + withBody.ageDelta)) < 1e-9)
    assert.ok(withBody.biologicalAge > 30 && withBody.biologicalAge < 50)
  })

  it("fills a missing measurement without inventing a zero", async () => {
    const filled = normalizeBody(undefined, undefined, true)
    assert.equal(filled.heightCm, 165)
    assert.equal(filled.weightKg, 62)
    const clamped = normalizeBody(90, 400, false)
    assert.equal(clamped.heightCm, 140)
    assert.equal(clamped.weightKg, 220)
  })

  it("restores height and weight onto an older file", async () => {
    const avery = averyProfile(new Date(2026, 9, 16))
    const stripped = { ...avery, heightCm: undefined, weightKg: undefined } as unknown as typeof avery
    const restored = freshen(stripped, new Date(2026, 9, 16))
    assert.equal(restored.heightCm, 165)
    assert.equal(restored.weightKg, 62)
  })

  it("drops stored paid-tier fields from an older file", async () => {
    const avery = averyProfile(new Date(2026, 9, 16))
    const stored = {
      ...avery,
      tier: "pro",
      upgradeRequest: "pro",
      priceOffer: { currency: "INR", pro: 299 },
    } as unknown as typeof avery
    const live = freshen(stored, new Date(2026, 9, 16)) as typeof avery & { tier?: unknown; upgradeRequest?: unknown; priceOffer?: unknown }
    assert.equal(live.tier, undefined)
    assert.equal(live.upgradeRequest, undefined)
    assert.equal(live.priceOffer, undefined)
  })
})

describe("tip of the day", () => {
  it("holds the same tip for a calendar day and follows the weakest driver", async () => {
    const first = dailyTip({ date: "2026-10-16", drivers, bmi: 22.8 })
    const again = dailyTip({ date: "2026-10-16", drivers, bmi: 22.8 })
    assert.deepEqual(first, again)
    assert.equal(first.subject, "Nutrition")
    assert.ok(first.title.length > 0)
    assert.ok(first.body.length > 20)
  })

  it("can write from BMI when the ratio sits outside the usual band", async () => {
    const dates = Array.from({ length: 40 }, (_, index) => `2026-11-${String(index + 1).padStart(2, "0")}`)
    const tips = dates.map((date) => dailyTip({ date, drivers, bmi: 31 }))
    assert.ok(tips.some((tip) => tip.subject === "Body mass index"))
    assert.ok(tips.some((tip) => tip.subject === "Nutrition"))
  })
})
