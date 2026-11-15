import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { creditPack, emptyGrove, packById, pourWater, presentGrove, shopMode, stageFor, takeSun, POUR_COST, SUN_PER_TAP } from "../src/lib/grove"
import { allowedCheckout, centsFromValue, createMolliePayment, eurValue } from "../src/lib/mollie"

describe("grove", () => {
  it("grows a seed into a canopy and then counts blossoms", () => {
    assert.equal(stageFor(0).stage, "seed")
    assert.equal(stageFor(0).level, 1)
    assert.equal(stageFor(3).stage, "sprout")
    assert.equal(stageFor(8).stage, "sapling")
    assert.equal(stageFor(16).stage, "young")
    assert.equal(stageFor(28).stage, "tree")
    assert.equal(stageFor(44).stage, "tree")
    assert.equal(stageFor(44).poursToNext, 1)
    assert.equal(stageFor(45).stage, "canopy")
    assert.equal(stageFor(45).poursToNext, null)
    assert.equal(stageFor(48).blossoms, 3)
  })

  it("collects sun only up to the reward points already earned", () => {
    let grove = emptyGrove()
    let got = 0
    for (let turn = 0; turn < 10; turn += 1) {
      const next = takeSun(grove, 12)
      if ("error" in next) break
      assert.ok(next.took <= SUN_PER_TAP)
      got += next.took
      grove = next.grove
    }
    assert.equal(got, 12)
    assert.equal(grove.sun, 12)
    assert.equal(grove.gathered, 12)
    const blocked = takeSun(grove, 11)
    assert.equal("error" in blocked && blocked.error, "No sun to collect.")
  })

  it("spends sun to pour and refuses an empty can", () => {
    const poured = pourWater({ ...emptyGrove(), sun: POUR_COST })
    assert.ok(!("error" in poured))
    if ("error" in poured) return
    assert.equal(poured.grove.sun, 0)
    assert.equal(poured.grove.watered, 1)
    const dry = pourWater(poured.grove)
    assert.equal("error" in dry && dry.error, "Not enough sun to pour.")
  })

  it("credits a pack once", () => {
    const pack = packById("handful")
    assert.ok(pack)
    const first = creditPack(emptyGrove(), pack!, "tr_paidonce")
    assert.ok(!("error" in first))
    if ("error" in first) return
    assert.equal(first.grove.sun, 20)
    const again = creditPack(first.grove, pack!, "tr_paidonce")
    assert.ok(!("error" in again))
    if ("error" in again) return
    assert.equal(again.grove.sun, 20)
    assert.equal(again.grove.credited.length, 1)
  })

  it("keeps the shop closed in production until Mollie is set", () => {
    assert.equal(shopMode({ NODE_ENV: "production" }), "off")
    assert.equal(shopMode({ NODE_ENV: "development" }), "sample")
    assert.equal(shopMode({ NODE_ENV: "production", MOLLIE_API_KEY: "live_test" }), "live")
    const view = presentGrove(emptyGrove(), 0, "off")
    assert.equal(view.packs.length, 3)
    assert.equal(view.shop, "off")
  })

  it("formats euro amounts and refuses a checkout that is not Mollie", async () => {
    assert.equal(eurValue(99), "0.99")
    assert.equal(eurValue(249), "2.49")
    assert.equal(centsFromValue("4.99"), 499)
    assert.equal(centsFromValue("4.9"), null)
    assert.equal(allowedCheckout("https://www.mollie.com/checkout/select-method/abc"), "https://www.mollie.com/checkout/select-method/abc")
    assert.equal(allowedCheckout("https://evil.example/checkout"), null)
    assert.equal(allowedCheckout("javascript:alert(1)"), null)
    const created = await createMolliePayment({
      pack: packById("basket")!,
      redirectUrl: "http://127.0.0.1:4317/home/grove",
      userId: "user-1",
      key: "test_key",
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(String(init?.body))
        assert.equal(body.amount.value, "2.49")
        assert.equal(body.amount.currency, "EUR")
        assert.equal(body.metadata.pack, "basket")
        assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test_key")
        return new Response(JSON.stringify({ id: "tr_abc", _links: { checkout: { href: "https://pay.example/steal" } } }), { status: 201 })
      },
    })
    assert.equal("error" in created && created.error, "The shop could not open checkout.")
  })
})
