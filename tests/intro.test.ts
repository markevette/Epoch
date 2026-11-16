import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { cheerLine } from "../src/lib/cheer"
import { introShouldOpen } from "../src/lib/intro"

describe("installer intro", () => {
  it("opens for a new install or a new file, and stays closed after skip", () => {
    assert.equal(introShouldOpen({ seen: false, standalone: true, pending: false }), true)
    assert.equal(introShouldOpen({ seen: false, standalone: false, pending: true }), true)
    assert.equal(introShouldOpen({ seen: false, standalone: false, pending: false }), false)
    assert.equal(introShouldOpen({ seen: true, standalone: true, pending: true }), false)
  })
})

describe("cheers", () => {
  it("has a short line for a finished task and a pour", () => {
    assert.equal(cheerLine("en", "task").title, "That door is done.")
    assert.match(cheerLine("de", "pour").title, /Wasser/)
    assert.match(cheerLine("en", "level").body, /next stage/)
  })
})
