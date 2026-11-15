import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { POUR_COST } from "../src/lib/grove"
import {
  GROVE_REMINDER_MINUTES,
  GROVE_REMINDER_TAG,
  GROVE_REMINDER_URL,
  groveNudge,
  groveReminderAt,
  groveReminderDue,
  groveReminderNotification,
} from "../src/lib/grove-reminders"

describe("grove reminders", () => {
  it("asks to collect sun before it asks for a pour", () => {
    assert.equal(groveNudge(0, 0), null)
    assert.equal(groveNudge(0, POUR_COST - 1), null)
    assert.equal(groveNudge(0, POUR_COST), "water")
    assert.equal(groveNudge(3, POUR_COST), "collect")
  })

  it("is due during the 18:00 hour and schedules the next 18:00", () => {
    assert.equal(groveReminderDue(null, GROVE_REMINDER_MINUTES), false)
    assert.equal(groveReminderDue("collect", GROVE_REMINDER_MINUTES - 1), false)
    assert.equal(groveReminderDue("water", GROVE_REMINDER_MINUTES), true)
    assert.equal(groveReminderDue("collect", GROVE_REMINDER_MINUTES + 59), true)
    assert.equal(groveReminderDue("collect", GROVE_REMINDER_MINUTES + 60), false)
    const afternoon = new Date(2026, 10, 15, 15, 0, 0)
    const later = groveReminderAt(afternoon)
    assert.equal(later.getDate(), 15)
    assert.equal(later.getHours(), 18)
    assert.equal(later.getMinutes(), 0)
    const evening = new Date(2026, 10, 15, 18, 30, 0)
    const tomorrow = groveReminderAt(evening)
    assert.equal(tomorrow.getDate(), 16)
    assert.equal(tomorrow.getHours(), 18)
  })

  it("opens the grove and leaves the practice tags alone", () => {
    const collect = groveReminderNotification("en", "collect")
    assert.equal(collect.title, "Sun is waiting on the lawn")
    assert.equal(collect.url, GROVE_REMINDER_URL)
    assert.equal(collect.tag, GROVE_REMINDER_TAG)
    assert.equal(collect.tag.startsWith("epoch-sleep"), false)
    const water = groveReminderNotification("de", "water")
    assert.equal(water.title, "Der Baum kann einen Guss nehmen")
    assert.ok(water.body.includes("Hain"))
  })
})
