import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PUBLIC_CLAIMS } from "../src/lib/claims"
import { copy } from "../src/lib/copy"
import { formatYears } from "../src/lib/format"
import { cleanLocale, localeFromCookieHeader } from "../src/lib/locale"
import { evaluatePair, morningsTogetherLabel, type PairPerson } from "../src/lib/pairs"
import { morningsKeptLine } from "../src/lib/rewards"
import { paintShareCard, type ShareCanvas } from "../src/lib/share-card"

function person(name: string): PairPerson {
  return { name, offsetMinutes: 0, morningDates: [], completeDates: [] }
}

describe("language", () => {
  it("keeps English claims and German navigation", async () => {
    assert.deepEqual(copy("en").claims, [...PUBLIC_CLAIMS])
    assert.equal(copy("de").nav.today, "Heute")
    assert.equal(copy("de").nav.practice, "Übung")
    assert.equal(cleanLocale("de"), "de")
    assert.equal(cleanLocale("fr"), null)
    assert.equal(localeFromCookieHeader("epoch_lang=de"), "de")
    assert.equal(localeFromCookieHeader("other=1"), "en")
  })

  it("translates years and pair lines without changing the English default", async () => {
    assert.equal(formatYears(-1.2, "de"), "1.2 Jahre jünger")
    assert.equal(formatYears(0, "en"), "In line with chronological age")
    assert.equal(morningsTogetherLabel(2), "2 mornings together")
    assert.equal(morningsTogetherLabel(1, "de"), "1 Morgen zusammen")
    assert.equal(morningsKeptLine(18), "18 mornings kept")
    assert.equal(morningsKeptLine(2, "de"), "2 Morgen gehalten")
    const open = evaluatePair({
      now: new Date(Date.UTC(2026, 9, 31, 9, 0, 0)),
      startedOn: "2026-10-31",
      you: "a",
      personA: person("Avery Chen"),
      personB: person("Mina Shah"),
      pauses: [],
      repairs: [],
      nudge: null,
      shareA: false,
      shareB: false,
      locale: "de",
    })
    assert.equal(open.line, "Beide Morgen sind noch offen.")
  })

  it("keeps German letters on the share card", async () => {
    const texts: string[] = []
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
    }
    paintShareCard(ctx, {
      name: "Jörg",
      date: "Dienstag, 10. November",
      score: "70",
      scoreLabel: "Tageswert",
      confidence: "Dünne Akte",
      morningsLine: null,
      burnedLine: null,
      sentences: ["Größe"],
    })
    const card = texts.join("\n")
    assert.ok(card.includes("Jörg"))
    assert.ok(card.includes("Dienstag, 10. November"))
    assert.ok(card.includes("Größe"))
    assert.ok(card.includes("Dünne Akte"))
    assert.ok(card.includes("Tageswert"))
  })
})
