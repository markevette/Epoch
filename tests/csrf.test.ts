import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { csrfCookieSettings, csrfTokensMatch, newCsrfToken } from "../src/lib/csrf"

describe("csrf tokens", () => {
  it("accepts the same token and rejects a different one", async () => {
    const token = newCsrfToken()
    assert.equal(csrfTokensMatch(token, token), true)
    assert.equal(csrfTokensMatch(token, `${token}x`.slice(1)), false)
    assert.equal(csrfTokensMatch(undefined, token), false)
    assert.equal(csrfTokensMatch("short", "short"), false)
  })

  it("keeps the CSRF cookie hidden from page scripts", async () => {
    assert.equal(csrfCookieSettings(true).httpOnly, true)
    assert.equal(csrfCookieSettings(false).httpOnly, true)
  })
})
