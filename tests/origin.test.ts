import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parsePublicOrigin, publicOrigin } from "../src/lib/origin"

describe("public origin", () => {
  it("uses only EPOCH_PUBLIC_URL and never a Host header", async () => {
    assert.equal(
      publicOrigin({ NODE_ENV: "production", EPOCH_PUBLIC_URL: "https://epoch.apps.grok.bot/" }),
      "https://epoch.apps.grok.bot",
    )
    assert.equal(publicOrigin({ NODE_ENV: "production" }), null)
    assert.equal(parsePublicOrigin("http://evil.example"), null)
    assert.equal(parsePublicOrigin("https://user:pass@epoch.apps.grok.bot"), null)
  })

  it("uses localhost when the public URL is unset off production", async () => {
    assert.equal(publicOrigin({ NODE_ENV: "development" }), "http://127.0.0.1:4317")
    assert.equal(parsePublicOrigin("http://127.0.0.1:4317"), "http://127.0.0.1:4317")
  })
})
