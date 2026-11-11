import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { DAYPART_BOOT, daypart, daypartFromHour, daypartPreview } from "../src/lib/daypart"

describe("daypart", () => {
  it("splits the local day into morning, day, and night", async () => {
    assert.equal(daypartFromHour(0), "night")
    assert.equal(daypartFromHour(4), "night")
    assert.equal(daypartFromHour(5), "morning")
    assert.equal(daypartFromHour(11), "morning")
    assert.equal(daypartFromHour(12), "day")
    assert.equal(daypartFromHour(17), "day")
    assert.equal(daypartFromHour(18), "night")
    assert.equal(daypartFromHour(23), "night")
  })

  it("reads the hour from the date it is given", async () => {
    const morning = new Date(2026, 9, 17, 7, 30)
    const afternoon = new Date(2026, 9, 17, 15, 0)
    const evening = new Date(2026, 9, 17, 21, 15)
    assert.equal(daypart(morning), "morning")
    assert.equal(daypart(afternoon), "day")
    assert.equal(daypart(evening), "night")
  })

  it("boots with the same boundaries as the function", async () => {
    assert.match(DAYPART_BOOT, /h>=5&&h<12/)
    assert.match(DAYPART_BOOT, /h>=12&&h<18/)
    assert.match(DAYPART_BOOT, /dataset\.daypart/)
  })

  it("accepts only the three preview names", async () => {
    assert.equal(daypartPreview("night"), "night")
    assert.equal(daypartPreview("noon"), null)
    assert.equal(daypartPreview(null), null)
  })
})
