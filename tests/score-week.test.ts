import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { nudgeById, nudgeOptions, scoreTone, type ScoreDay } from "../src/lib/score-week"

function days(scores: number[]): ScoreDay[] {
  return scores.map((score, index) => ({ date: `2026-11-0${index + 1}`, score }))
}

describe("score week", () => {
  it("reads a rise, a dip, and a steady week", async () => {
    assert.equal(scoreTone(days([60, 61, 62, 63, 64, 65, 68])), "up")
    assert.equal(scoreTone(days([70, 69, 68, 66, 64, 63, 61])), "down")
    assert.equal(scoreTone(days([70, 71, 70, 69, 70, 71, 70])), "flat")
    assert.equal(scoreTone(days([70])), "flat")
  })

  it("offers a check-in when the week turns down, and a cheer when it climbs", async () => {
    const down = nudgeOptions("down").map((option) => option.text).join(" ")
    const up = nudgeOptions("up").map((option) => option.text).join(" ")
    assert.match(down, /How are you doing/)
    assert.equal(up.includes("How are you doing"), false)
    assert.match(up, /Keep going/)
    assert.equal(nudgeById("up-keep")?.tone, "up")
    assert.equal(nudgeById("down-how")?.tone, "down")
    assert.equal(nudgeById("nope"), null)
  })
})
