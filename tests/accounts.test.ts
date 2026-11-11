import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  addMember,
  authenticate,
  seedAccounts,
} from "../src/lib/accounts"

const creds = {
  member: { email: "member@example.test", password: "test-member-9" },
  admin: { email: "staff@example.test", password: "test-staff-9" },
}

describe("accounts", () => {
  it("signs a member in and staff in as admin", async () => {
    const accounts = seedAccounts(new Date(2026, 9, 16), creds)
    const member = authenticate(accounts, "Member@Example.test", creds.member.password)
    const admin = authenticate(accounts, creds.admin.email, creds.admin.password)
    assert.equal(member?.role, "member")
    assert.equal(member?.email, creds.member.email)
    assert.equal(member?.profile?.name, "Avery Chen")
    assert.equal(admin?.role, "admin")
    assert.equal(admin?.profile, null)
    assert.equal(authenticate(accounts, creds.member.email, "nope"), null)
  })

  it("refuses a short password, a duplicate email, and accepts a new free member", async () => {
    const accounts = seedAccounts(new Date(2026, 9, 16), creds)
    const short = addMember(accounts, { email: "sam@example.com", password: "short", name: "Sam" })
    assert.ok(short.error)
    const duplicate = addMember(accounts, { email: creds.member.email, password: "long-enough", name: "Avery" })
    assert.ok(duplicate.error)
    const created = addMember(accounts, { email: "Sam@example.com", password: "sammy-pass", name: "Sam" })
    assert.equal(created.error, null)
    const sam = created.accounts.find((account) => account.email === "sam@example.com")
    assert.equal(sam?.role, "member")
    assert.equal(sam?.profile, null)
  })

})
