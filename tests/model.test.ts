import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildHistory, rollHistory } from "../src/lib/history"
import { recommendations } from "../src/lib/interventions"
import { averyProfile } from "../src/lib/personas"
import {
  WEIGHTS,
  assess,
  hrvScore,
  restingHrScore,
  sleepDurationScore,
} from "../src/lib/score"
import type { Inputs } from "../src/lib/types"

const baseInputs: Inputs = {
  sleepHours: 7.4,
  sleepConsistency: 7,
  hrv: 50,
  restingHr: 60,
  steps: 8000,
  zone2Minutes: 120,
  strengthSessions: 2,
  protein: 7,
  fiber: 6,
  alcoholPerWeek: 3,
  addedSugar: 3,
  stress: 4,
}

function model(inputs: Inputs, extra?: Partial<Parameters<typeof assess>[0]>) {
  return assess({
    age: 38,
    sex: "female",
    inputs,
    loggedDays: 0,
    ...extra,
  })
}

describe("longevity score", () => {
  it("weights sum to one", async () => {
    const sum = Object.values(WEIGHTS).reduce((total, weight) => total + weight, 0)
    assert.ok(Math.abs(sum - 1) < 1e-9)
  })

  it("stays inside 0 to 100", async () => {
    const result = model(baseInputs)
    assert.ok(result.longevityScore > 0 && result.longevityScore <= 100)
    for (const driver of result.drivers) {
      assert.ok(driver.score >= 0 && driver.score <= 100)
    }
  })

  it("rewards a longer, steadier night of sleep", async () => {
    const short = sleepDurationScore(6)
    const solid = sleepDurationScore(7.5)
    assert.ok(solid > short)
    const before = model({ ...baseInputs, sleepHours: 6, sleepConsistency: 4 })
    const after = model({ ...baseInputs, sleepHours: 7.5, sleepConsistency: 8 })
    assert.ok(after.longevityScore > before.longevityScore)
    assert.ok(after.biologicalAge < before.biologicalAge)
  })

  it("scores the same heart-rate variability more kindly with age", async () => {
    assert.ok(hrvScore(40, 60) > hrvScore(40, 30))
  })

  it("expects a slightly higher resting heart rate in women", async () => {
    assert.ok(restingHrScore(64, "female") > restingHrScore(64, "male"))
  })

  it("raises confidence as logged days accumulate", async () => {
    const thin = model(baseInputs, { loggedDays: 0 })
    const thick = model(baseInputs, { loggedDays: 21 })
    assert.ok(thick.confidence > thin.confidence)
    assert.ok(thick.confidence <= 0.88)
    assert.equal(thin.confidenceLabel, "Limited file")
  })
})

describe("interventions and history", () => {
  it("leads with sleep when sleep is the obvious gap", async () => {
    const plan = recommendations({
      age: 38,
      sex: "male",
      inputs: { ...baseInputs, sleepHours: 5.8, sleepConsistency: 3, stress: 3, steps: 9000, zone2Minutes: 160, strengthSessions: 3, protein: 8, fiber: 8, alcoholPerWeek: 1, addedSugar: 2 },
      loggedDays: 3,
    })
    assert.ok(plan.length > 0)
    assert.equal(plan[0].driver, "sleep")
    assert.ok(plan[0].points > 0)
  })

  it("builds an improving month whose last week beats the first", async () => {
    const end = new Date(2026, 9, 14)
    const history = buildHistory({
      inputs: baseInputs,
      days: 30,
      seed: 42,
      trend: "improving",
      end,
    })
    assert.equal(history.length, 30)
    assert.deepEqual(history.at(-1)?.inputs.sleepHours, baseInputs.sleepHours)
    const scoreOf = (inputs: Inputs) => model(inputs).longevityScore
    const first = history.slice(0, 7).reduce((sum, day) => sum + scoreOf(day.inputs), 0) / 7
    const last = history.slice(-7).reduce((sum, day) => sum + scoreOf(day.inputs), 0) / 7
    assert.ok(last > first)
  })

  it("keeps logged days when the window rolls forward", async () => {
    const end = new Date(2026, 9, 10)
    const history = buildHistory({ inputs: baseInputs, days: 30, seed: 7, trend: "flat", end })
    const logged = { ...history[20], source: "logged" as const, inputs: { ...baseInputs, sleepHours: 8.4 } }
    history[20] = logged
    const rolled = rollHistory({
      history,
      inputs: baseInputs,
      trend: "flat",
      seed: 7,
      today: new Date(2026, 9, 14),
    })
    const kept = rolled.find((day) => day.date === logged.date)
    assert.equal(kept?.source, "logged")
    assert.equal(kept?.inputs.sleepHours, 8.4)
    assert.equal(rolled.at(-1)?.date, "2026-10-14")
  })
})

describe("demo file", () => {
  it("gives Avery a month of history on a behavior model", async () => {
    const avery = averyProfile(new Date(2026, 9, 14))
    assert.equal(avery.history.length, 30)
    assert.equal(avery.demo, true)
    const pro = assess({
      age: avery.age,
      sex: avery.sex,
      inputs: avery.inputs,
      loggedDays: 0,
    })
    assert.ok(pro.biologicalAge > 30 && pro.biologicalAge < 50)
  })
})
