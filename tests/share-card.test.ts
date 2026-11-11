import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PUBLIC_CLAIMS } from "../src/lib/claims"
import { paintPairCard, paintShareCard, type ShareCanvas } from "../src/lib/share-card"

function recordPaint(paint: (ctx: ShareCanvas) => void) {
  const texts: string[] = []
  const images: unknown[] = []
  const ctx: ShareCanvas = {
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textBaseline: "top",
    lineWidth: 1,
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillText(text) {
      texts.push(text)
    },
    drawImage(image) {
      images.push(image)
    },
  }
  paint(ctx)
  return { text: texts.join(" "), texts, images }
}

describe("share card", () => {
  it("puts the score and the public lines on the card, and leaves the age off", async () => {
    const { text, images } = recordPaint((ctx) =>
      paintShareCard(ctx, {
        name: "Avery Chen",
        date: "Tuesday, 10 November",
        score: "75",
        confidence: "Growing file · 60% confidence",
        morningsLine: null,
        burnedLine: null,
        sentences: ["Avery's daily score is 75.", ...PUBLIC_CLAIMS],
      }),
    )
    assert.equal(images.length, 0)
    assert.ok(text.includes("Tuesday, 10 November"))
    assert.ok(text.includes("75"))
    assert.ok(text.includes("Daily score"))
    assert.ok(text.includes("Reward points open another buddy"))
    assert.equal(text.includes("biological"), false)
    assert.equal(text.includes("37.6"), false)
    assert.equal(text.includes("mornings kept"), false)
    assert.ok(text.includes("morning count"))
    assert.equal(text.includes("take"), false)
  })

  it("prints the mornings kept when there is at least one", async () => {
    const { text } = recordPaint((ctx) =>
      paintShareCard(ctx, {
        name: "Avery Chen",
        date: "Tuesday, 10 November",
        score: "75",
        confidence: "Growing file · 60% confidence",
        morningsLine: "18 mornings kept",
        burnedLine: null,
        sentences: ["A wellness model. A clinician still reads illness."],
      }),
    )
    assert.ok(text.includes("18 mornings kept"))
    assert.equal(text.includes("kcal burned"), false)
    assert.equal(text.includes("take"), false)
  })

  it("draws an optional picture beside the score", async () => {
    const photo = { tag: "photo" }
    const { text, images } = recordPaint((ctx) =>
      paintShareCard(
        ctx,
        {
          name: "Avery Chen",
          date: "Tuesday, 10 November",
          score: "75",
          confidence: "Growing file · 60% confidence",
          morningsLine: null,
          burnedLine: null,
          sentences: ["Avery's daily score is 75."],
          photo: { width: 80, height: 100 },
        },
        photo,
      ),
    )
    assert.deepEqual(images, [photo])
    assert.ok(text.includes("75"))
    assert.ok(text.includes("Daily score"))
  })

  it("prints the kcal burned when today has an answer", async () => {
    const { text } = recordPaint((ctx) =>
      paintShareCard(ctx, {
        name: "Avery Chen",
        date: "Tuesday, 10 November",
        score: "75",
        confidence: "Growing file · 60% confidence",
        morningsLine: "18 mornings kept",
        burnedLine: "320 kcal burned",
        sentences: ["320 kcal burned."],
      }),
    )
    assert.ok(text.includes("320 kcal burned"))
  })

  it("prints two handles and the shared mornings, without an age", async () => {
    const { text } = recordPaint((ctx) =>
      paintPairCard(ctx, {
        left: "avery",
        right: "mina",
        streak: 12,
        sentence: "A wellness model. A clinician still reads illness.",
      }),
    )
    assert.ok(text.includes("@avery and @mina"))
    assert.ok(text.includes("12"))
    assert.ok(text.includes("mornings together"))
    assert.equal(text.includes("biological"), false)
  })

  it("prints the date above the daily score", async () => {
    const { texts } = recordPaint((ctx) =>
      paintShareCard(ctx, {
        name: "Avery Chen",
        date: "Tuesday, 10 November",
        score: "75",
        confidence: "Growing file · 60% confidence",
        morningsLine: null,
        burnedLine: null,
        sentences: ["Avery's daily score is 75."],
      }),
    )
    const dateAt = texts.indexOf("Tuesday, 10 November")
    const scoreAt = texts.indexOf("75")
    const labelAt = texts.indexOf("Daily score")
    assert.ok(dateAt >= 0)
    assert.ok(scoreAt > dateAt)
    assert.ok(labelAt > scoreAt)
  })
})
