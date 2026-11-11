import assert from "node:assert/strict"
import { mkdtempSync } from "fs"
import { tmpdir } from "os"
import path from "path"
import { describe, it } from "node:test"
import { DEMO_MEMBER_EMAIL, DEMO_MEMBER_PASSWORD } from "./demo-env"
import {
  acceptInvite,
  accountForToken,
  changePassword,
  joinRequiresInvite,
  listBoard,
  listOutbox,
  mintInvite,
  openSession,
  registerMember,
  requestPasswordReset,
  resetDbForTests,
  resetPasswordWithToken,
  saveOwnedProfile,
} from "../src/lib/db"
import { averyProfile } from "../src/lib/personas"

process.env.EPOCH_DB = path.join(mkdtempSync(path.join(tmpdir(), "epoch-recover-")), "test.sqlite")
process.env.EPOCH_PUBLIC_URL = "http://127.0.0.1:4317"
delete process.env.EPOCH_BETA_CODE
resetDbForTests()

describe("account recovery", () => {
  it("resets a password from a one-use token and does not say whether the email exists", async () => {
    const missing = await requestPasswordReset("nobody@example.test")
    assert.deepEqual(missing, { ok: true })
    const sent = await requestPasswordReset(DEMO_MEMBER_EMAIL)
    assert.deepEqual(sent, { ok: true })
    const letter = (await listOutbox())[0]
    assert.ok(letter)
    assert.equal(letter.toEmail, DEMO_MEMBER_EMAIL)
    const token = /token=([A-Za-z0-9_-]+)/.exec(letter.body)?.[1]
    assert.ok(token)
    const short = await resetPasswordWithToken(token, "short")
    assert.ok("error" in short)
    const done = await resetPasswordWithToken(token, "fresh-pass-9")
    assert.deepEqual(done, { ok: true })
    assert.equal(await openSession(DEMO_MEMBER_EMAIL, DEMO_MEMBER_PASSWORD), null)
    assert.ok(await openSession(DEMO_MEMBER_EMAIL, "fresh-pass-9"))
    assert.ok("error" in await resetPasswordWithToken(token, "another-pass-9"))
  })

  it("writes reset links from EPOCH_PUBLIC_URL only, and stops after three notes", async () => {
    const created = await registerMember({ email: "reset.host@example.com", password: "host-pass-9", name: "Reset Host" })
    assert.ok(!("error" in created))
    await requestPasswordReset("reset.host@example.com")
    await requestPasswordReset("reset.host@example.com")
    await requestPasswordReset("reset.host@example.com")
    const notes = (await listOutbox()).filter((row) => row.toEmail === "reset.host@example.com")
    assert.equal(notes.length, 3)
    assert.ok(notes.every((row) => row.body.includes("http://127.0.0.1:4317/recover/new?token=")))
    assert.ok(notes.every((row) => !row.body.includes("evil.example")))
    await requestPasswordReset("reset.host@example.com")
    assert.equal((await listOutbox()).filter((row) => row.toEmail === "reset.host@example.com").length, 3)
  })

  it("changes a password only when the current one matches", async () => {
    const created = await registerMember({ email: "reset.me@example.com", password: "old-pass-9", name: "Reset Me" })
    assert.ok(!("error" in created))
    const owner = await accountForToken(created.token)
    assert.ok(owner)
    assert.ok("error" in await changePassword(owner.id, "wrong-pass", "new-pass-9"))
    assert.deepEqual(await changePassword(owner.id, "old-pass-9", "new-pass-9"), { ok: true })
    assert.ok(await openSession("reset.me@example.com", "new-pass-9"))
  })
})

describe("invites and the board", () => {
  it("mints a one-use invite and keeps a shared door", async () => {
    assert.equal(await joinRequiresInvite(), false)
    const minted = await mintInvite()
    assert.equal(await acceptInvite("not-a-code"), false)
    assert.equal(await acceptInvite(minted.code), true)
    assert.equal(await acceptInvite(minted.code), false)
    process.env.EPOCH_BETA_CODE = "beta-door-9"
    assert.equal(await joinRequiresInvite(), true)
    assert.equal(await acceptInvite("beta-door-9"), true)
    delete process.env.EPOCH_BETA_CODE
  })

  it("lists only opted-in files that are not sample files", async () => {
    const created = await registerMember({ email: "board.live@example.com", password: "board-pass-9", name: "Board Live" })
    assert.ok(!("error" in created))
    const owner = await accountForToken(created.token)
    assert.ok(owner)
    const profile = { ...averyProfile(), name: "Board Live", handle: "boardlive", demo: false, leaderboard: true }
    await saveOwnedProfile(owner.id, profile, { grantHealthConsent: true })
    const rows = await listBoard()
    assert.ok(rows.some((row) => row.handle === "boardlive"))
    assert.ok(rows.every((row) => row.handle !== "avery"))
  })
})
