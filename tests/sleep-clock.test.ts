import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  cleanSleepClock,
  dueReminder,
  nextReminderAt,
  reminderMinuteForTrack,
  reminderNotification,
  reminderPath,
} from "../src/lib/sleep-clock"

const quiet = { completions: [] }
const clock = { wake: "07:15", bed: "23:00" }

describe("sleep clock", () => {
  it("keeps a wake time and a bedtime in HH:MM", async () => {
    assert.deepEqual(cleanSleepClock({ wake: "07:15", bed: "23:00" }), clock)
    assert.equal(cleanSleepClock({ wake: "7:15", bed: "23:00" }), null)
    assert.equal(cleanSleepClock({ wake: "24:00", bed: "23:00" }), null)
    assert.equal(cleanSleepClock(null), null)
  })

  it("places four doors from wake time and bedtime", async () => {
    assert.equal(reminderMinuteForTrack(clock, "sleep"), 7 * 60 + 15)
    assert.equal(reminderMinuteForTrack(clock, "movement"), 12 * 60 + 15)
    assert.equal(reminderMinuteForTrack(clock, "nutrition"), 14 * 60 + 15)
    assert.equal(reminderMinuteForTrack(clock, "stress"), 22 * 60)
    assert.equal(reminderMinuteForTrack({ wake: "07:00", bed: "00:20" }, "stress"), 23 * 60 + 20)
  })

  it("offers today’s open door during its hour", async () => {
    const yesterday = { completions: [{ id: "sleep-wake", date: "2026-11-03" }] }
    assert.equal(dueReminder(clock, quiet, "2026-11-04", 7 * 60 + 15), "sleep-wake")
    assert.equal(dueReminder(clock, quiet, "2026-11-04", 7 * 60 + 50), "sleep-wake")
    assert.equal(dueReminder(clock, quiet, "2026-11-04", 8 * 60 + 15), null)
    assert.equal(dueReminder(clock, quiet, "2026-11-04", 12 * 60 + 15), "move-walk")
    assert.equal(dueReminder(clock, quiet, "2026-11-04", 14 * 60 + 15), "food-water")
    assert.equal(dueReminder(clock, quiet, "2026-11-04", 22 * 60), "load-name")
    assert.equal(dueReminder(clock, yesterday, "2026-11-04", 7 * 60 + 15), "sleep-wake")
    assert.equal(dueReminder(clock, yesterday, "2026-11-04", 22 * 60 + 10), "load-name")
    const otherSkillToday = { completions: [...yesterday.completions, { id: "move-walk", date: "2026-11-04" }] }
    assert.equal(dueReminder(clock, otherSkillToday, "2026-11-04", 12 * 60 + 20), null)
    assert.equal(dueReminder(clock, otherSkillToday, "2026-11-04", 7 * 60 + 20), "sleep-wake")
    const weekLater = { completions: [{ id: "sleep-wake", date: "2026-11-04" }] }
    assert.equal(dueReminder(clock, weekLater, "2026-11-11", 7 * 60 + 15), "sleep-dim")
  })

  it("moves a passed reminder to the next day", async () => {
    const now = new Date(2026, 10, 4, 16, 10, 30)
    const wake = nextReminderAt(7 * 60, now)
    assert.equal(wake.getDate(), 5)
    assert.equal(wake.getHours(), 7)
    assert.equal(wake.getMinutes(), 0)
    const bed = nextReminderAt(23 * 60, now)
    assert.equal(bed.getDate(), 4)
    assert.equal(bed.getHours(), 23)
  })

  it("opens the lesson from the reminder", async () => {
    assert.equal(reminderPath("sleep-dim"), "/home/practice/sleep-dim")
    const note = reminderNotification("en", "sleep-dim", "2026-11-04")
    assert.equal(note.title, "Dim the last hour")
    assert.equal(note.url, "/home/practice/sleep-dim")
    assert.ok(note.body.split(". ").length >= 2)
    const german = reminderNotification("de", "sleep-nap", "2026-11-04")
    assert.equal(german.title, "Das späte Nickerchen lassen")
    assert.ok(german.body.includes("früher ins Bett"))
  })
})
