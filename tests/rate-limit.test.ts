import assert from "node:assert/strict"
import { mkdtempSync } from "fs"
import { tmpdir } from "os"
import path from "path"
import { describe, it } from "node:test"
import { newBuddyCode } from "../src/lib/buddy-code"
import { resetDbForTests } from "../src/lib/db"
import { takeRateLimit } from "../src/lib/rate-limit"

process.env.EPOCH_DB = path.join(mkdtempSync(path.join(tmpdir(), "epoch-rate-")), "test.sqlite")
resetDbForTests()

describe("rate limits", () => {
  it("allows a short burst and then refuses the same key", async () => {
    const now = Date.UTC(2026, 10, 11, 12, 0, 0)
    assert.equal(await takeRateLimit("test", "one", 2, 60_000, now), true)
    assert.equal(await takeRateLimit("test", "one", 2, 60_000, now + 1), true)
    assert.equal(await takeRateLimit("test", "one", 2, 60_000, now + 2), false)
    assert.equal(await takeRateLimit("test", "two", 2, 60_000, now + 3), true)
    assert.equal(await takeRateLimit("test", "one", 2, 60_000, now + 60_000), true)
  })
})

describe("buddy codes", () => {
  it("mints a ten-character code without 0, O, 1, I, or L", async () => {
    const code = newBuddyCode()
    assert.equal(code.length, 10)
    assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/)
  })
})
