import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { cleanConsentAt, legalOperator } from "../src/lib/legal"

describe("legal pages", () => {
  it("reads the operator from the server environment", async () => {
    const missing = legalOperator({})
    assert.equal(missing.complete, false)
    assert.equal(missing.country, "Germany")
    const ready = legalOperator({
      EPOCH_LEGAL_NAME: "Ada Example",
      EPOCH_LEGAL_STREET: "Example Street 1",
      EPOCH_LEGAL_POSTAL: "10115",
      EPOCH_LEGAL_CITY: "Berlin",
      EPOCH_LEGAL_EMAIL: "ada@example.com",
    })
    assert.equal(ready.complete, true)
    assert.equal(ready.name, "Ada Example")
  })

  it("keeps a real consent time and drops a forged one", async () => {
    const now = Date.parse("2026-11-03T12:00:00.000Z")
    assert.equal(cleanConsentAt("2026-11-03T11:00:00.000Z", now), "2026-11-03T11:00:00.000Z")
    assert.equal(cleanConsentAt("tomorrow", now), null)
    assert.equal(cleanConsentAt("2026-11-04T12:00:00.000Z", now), null)
  })

})
