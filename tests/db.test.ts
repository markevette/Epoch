import assert from "node:assert/strict"
import { mkdtempSync } from "fs"
import { tmpdir } from "os"
import path from "path"
import { describe, it } from "node:test"
import { DEMO_ADMIN_EMAIL as ADMIN_EMAIL, DEMO_ADMIN_PASSWORD as ADMIN_PASSWORD, DEMO_MEMBER_EMAIL as MEMBER_EMAIL, DEMO_MEMBER_PASSWORD as MEMBER_PASSWORD } from "./demo-env"
import {
  accountForToken,
  deleteOwnedAccount,
  listAccess,
  openMemberFile,
  openSession,
  registerMember,
  resetDbForTests,
  saveOwnedProfile,
} from "../src/lib/db"
import { hashPassword, verifyPassword } from "../src/lib/passwords"
import { averyProfile, createProfile } from "../src/lib/personas"
import { foodDay, mealsDue } from "../src/lib/meals"
import type { WorkoutDay } from "../src/lib/workouts"
import { rewardWindow } from "../src/lib/rewards"

process.env.EPOCH_DB = path.join(mkdtempSync(path.join(tmpdir(), "epoch-")), "test.sqlite")
resetDbForTests()

describe("database", () => {
  it("hashes passwords and opens the same account from a new session", async () => {
    const stored = hashPassword("avery")
    assert.equal(verifyPassword("avery", stored), true)
    assert.equal(verifyPassword("nope", stored), false)

    const first = await openSession(MEMBER_EMAIL, MEMBER_PASSWORD)
    const second = await openSession(MEMBER_EMAIL, MEMBER_PASSWORD)
    assert.ok(first)
    assert.ok(second)
    assert.notEqual(first.token, second.token)
    assert.equal((await accountForToken(first.token))?.account.email, MEMBER_EMAIL)
    assert.equal((await accountForToken(second.token))?.account.profile?.name, "Avery Chen")
    assert.equal(await accountForToken("not-a-token"), null)
    assert.equal(await openSession(MEMBER_EMAIL, "wrong"), null)
  })

  it("drops a leftover paid-tier field when the file is saved", async () => {
    const created = await registerMember({ email: "self.pro@example.com", password: "self-pro-1", name: "Self Pro" })
    assert.ok(!("error" in created))
    const owner = await accountForToken(created.token)
    assert.ok(owner)
    const saved = await saveOwnedProfile(owner.id, { ...averyProfile(), name: "Self Pro", handle: "selfpro", demo: false, tier: "pro" } as ReturnType<typeof averyProfile> & { tier: string })
    assert.equal((saved?.profile as { tier?: unknown } | null)?.tier, undefined)
  })

  it("registers a second member the first session can not see as itself", async () => {
    const created = await registerMember({ email: "nia@example.com", password: "nia-pass", name: "Nia" })
    assert.ok(!("error" in created))
    assert.equal(created.account.email, "nia@example.com")
    assert.equal(created.account.profile, null)
    const duplicate = await registerMember({ email: "nia@example.com", password: "nia-pass", name: "Nia" })
    assert.ok("error" in duplicate)
  })

  it("records a staff open, and deletes that file", async () => {
    const created = await registerMember({ email: "report-nia@example.com", password: "nia-pass-2", name: "Report Nia" })
    assert.ok(!("error" in created))
    const owner = await accountForToken(created.token)
    assert.ok(owner)
    const profile = { ...averyProfile(), name: "Report Nia", handle: "report-nia", demo: false }
    assert.ok(await saveOwnedProfile(owner.id, profile))
    const opened = await openMemberFile(ADMIN_EMAIL, "report-nia@example.com")
    assert.ok(!("error" in opened))
    await openMemberFile(ADMIN_EMAIL, "report-nia@example.com")
    assert.equal((await listAccess(owner.id)).length, 1)
    assert.equal((await listAccess(owner.id))[0]?.staffEmail, ADMIN_EMAIL)
    const admin = await accountForToken((await openSession(ADMIN_EMAIL, ADMIN_PASSWORD))!.token)
    assert.equal(await deleteOwnedAccount(admin!.id), false)
    assert.equal(await deleteOwnedAccount(owner.id), true)
    assert.equal(await openSession("report-nia@example.com", "nia-pass-2"), null)
    assert.equal((await accountForToken((await openSession(MEMBER_EMAIL, MEMBER_PASSWORD))!.token))?.account.email, MEMBER_EMAIL)
  })

  it("keeps the open reward slot and drops a backfilled one", async () => {
    const authed = (await accountForToken((await openSession(MEMBER_EMAIL, MEMBER_PASSWORD))!.token))!
    const profile = authed.account.profile!
    const window = rewardWindow(new Date())
    const note = window.slot === "night" ? "Held the evening." : window.slot === "day" ? "done" : ""
    const history = profile.history.map((day) => (day.date === window.date ? { ...day, source: "logged" as const } : day))
    const saved = await saveOwnedProfile(authed.id, {
      ...profile,
      history,
      rewardClockOffset: new Date().getTimezoneOffset(),
      rewards: [
        { date: "2020-01-06", slot: "morning", at: "", note: "", bonus: 99 },
        { date: window.date, slot: window.slot, at: new Date().toISOString(), note, bonus: 99 },
      ],
    })
    assert.equal(saved?.profile?.rewards.length, 1)
    assert.equal(saved?.profile?.rewards[0]?.date, window.date)
    assert.equal(saved?.profile?.rewards[0]?.slot, window.slot)
    assert.notEqual(saved?.profile?.rewards[0]?.bonus, 99)
    if (window.slot === "day") assert.ok((saved?.profile?.rewards[0]?.bonus ?? 0) >= 1)
    else assert.equal(saved?.profile?.rewards[0]?.bonus, 0)
    const again = await saveOwnedProfile(authed.id, {
      ...saved!.profile!,
      rewards: [...saved!.profile!.rewards, { date: "2020-01-07", slot: "day", at: "", note: "done", bonus: 99 }],
    })
    assert.equal(again?.profile?.rewards.length, 1)
  })

  it("stores calories for meals the clock has reached, including zero", async () => {
    const authed = (await accountForToken((await openSession(MEMBER_EMAIL, MEMBER_PASSWORD))!.token))!
    const profile = authed.account.profile!
    const now = new Date()
    const date = foodDay(now)
    const due = mealsDue(now)
    const offered = {
      date,
      breakfast: 0,
      lunch: due.includes("lunch") ? 640 : 640,
      dinner: due.includes("dinner") ? 810 : 900,
    }
    const saved = await saveOwnedProfile(authed.id, {
      ...profile,
      rewardClockOffset: now.getTimezoneOffset(),
      meals: [{ date: "2020-01-06", breakfast: 100, lunch: 100, dinner: 100 }, offered],
    })
    const row = saved?.profile?.meals.find((meal) => meal.date === date)
    assert.ok(row)
    assert.equal(saved?.profile?.meals.some((meal) => meal.date === "2020-01-06"), false)
    assert.equal(row.breakfast, 0)
    assert.equal(row.lunch, due.includes("lunch") ? 640 : null)
    assert.equal(row.dinner, due.includes("dinner") ? 810 : null)
    const updated = await saveOwnedProfile(authed.id, {
      ...saved!.profile!,
      meals: [{ ...row, breakfast: 420 }],
    })
    const next = updated?.profile?.meals.find((meal) => meal.date === date)
    assert.equal(next?.breakfast, 420)
    assert.equal(next?.lunch, row.lunch)
    assert.equal(next?.dinner, row.dinner)
  })

  it("stores today’s workout burn and keeps a no at zero", async () => {
    const authed = (await accountForToken((await openSession(MEMBER_EMAIL, MEMBER_PASSWORD))!.token))!
    const profile = authed.account.profile!
    const now = new Date()
    const date = foodDay(now)
    const yes: WorkoutDay = { date, workedOut: true, kcal: 320 }
    const saved = await saveOwnedProfile(authed.id, {
      ...profile,
      rewardClockOffset: now.getTimezoneOffset(),
      workouts: [{ date: "2020-01-06", workedOut: true, kcal: 100 }, yes],
    })
    assert.deepEqual(saved?.profile?.workouts, [yes])
    const cleared = await saveOwnedProfile(authed.id, {
      ...saved!.profile!,
      workouts: [{ date, workedOut: false, kcal: 900 }],
    })
    assert.deepEqual(cleared?.profile?.workouts, [{ date, workedOut: false, kcal: 0 }])
  })

  it("records health consent once and ignores a later wipe", async () => {
    const opened = await registerMember({ email: "consent.member@example.com", password: "consent-pass", name: "Consent Member" })
    assert.equal("token" in opened, true)
    if (!("token" in opened)) return
    const authed = (await accountForToken(opened.token))!
    const profile = createProfile({
      name: "Consent Member",
      handle: "consentmember",
      age: 30,
      sex: "female",
      goals: ["Sleep that holds"],
      inputs: averyProfile().inputs,
    })
    const saved = await saveOwnedProfile(authed.id, { ...profile, healthConsentAt: "2099-01-01T00:00:00.000Z" }, { grantHealthConsent: true })
    assert.ok(saved?.profile?.healthConsentAt)
    assert.equal(saved?.profile?.healthConsentAt?.startsWith("2099"), false)
    const wiped = await saveOwnedProfile(authed.id, { ...saved!.profile!, healthConsentAt: null })
    assert.equal(wiped?.profile?.healthConsentAt, saved?.profile?.healthConsentAt)
  })
})
