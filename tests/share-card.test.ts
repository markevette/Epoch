import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PUBLIC_CLAIMS } from "../src/lib/claims"
import { paintPairCard, paintShareCard, WEEK_BAR_WIDTH, WEEK_PLOT, WEEK_SLOT, weekBarFrames, type ShareCanvas } from "../src/lib/share-card"

function recordPaint(paint: (ctx: ShareCanvas) => void) {
  const texts: string[] = []
  const images: unknown[] = []
  const rects: { x: number; y: number; w: number; h: number }[] = []
  const placed: { text: string; x: number; y: number }[] = []
  const ctx: ShareCanvas = {
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textBaseline: "top",
    lineWidth: 1,
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h })
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillText(text, x, y) {
      texts.push(text)
      placed.push({ text, x, y })
    },
    drawImage(image) {
      images.push(image)
    },
  }
  paint(ctx)
  return { text: texts.join(" "), texts, images, rects, placed }
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

  it("keeps the weekly scores off until the card asks for them", async () => {
    const hidden = recordPaint((ctx) =>
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
    assert.equal(hidden.text.includes("Last 7 daily scores"), false)
    const shown = recordPaint((ctx) =>
      paintShareCard(ctx, {
        name: "Avery Chen",
        date: "Tuesday, 10 November",
        score: "75",
        confidence: "Growing file · 60% confidence",
        morningsLine: null,
        burnedLine: null,
        sentences: ["Avery's daily score is 75."],
        week: [70, 72, 74],
        weekLabel: "Last 7 daily scores",
      }),
    )
    assert.ok(shown.text.includes("Last 7 daily scores"))
    const frames = weekBarFrames([70, 72, 74])
    assert.equal(frames.length, 3)
    assert.equal(new Set(frames.map((frame) => frame.barY + frame.barHeight)).size, 1)
    assert.equal(frames[0]?.baseline, WEEK_PLOT)
    assert.ok((frames[2]?.barHeight ?? 0) > (frames[0]?.barHeight ?? 0))
    const bars = shown.rects.filter((rect) => rect.w === WEEK_BAR_WIDTH)
    assert.equal(bars.length, 3)
    const bottoms = bars.map((rect) => rect.y + rect.h)
    assert.equal(new Set(bottoms).size, 1)
    for (const frame of frames) {
      const bar = bars.find((rect) => rect.x === 80 + frame.barX && rect.y + rect.h === (bottoms[0] ?? 0))
      const label = shown.placed.find((item) => item.text === frame.label && item.x === 80 + frame.labelX)
      assert.ok(bar)
      assert.ok(label)
      assert.equal(label.y, (bottoms[0] ?? 0) + 8)
      assert.ok(label.x >= frame.slotX + 80)
      assert.ok(label.x + frame.label.length * 9 <= frame.slotX + 80 + WEEK_SLOT)
    }
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
