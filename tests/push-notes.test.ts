import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { cleanPushSubscription, pushEndpointAllowed } from "../src/lib/push-endpoint"
import { remindersDue, reminderNote } from "../src/lib/push-notes"
import { zonedClock, zonedOffsetMinutes } from "../src/lib/zoned-clock"

const clock = { wake: "07:00", bed: "19:00" }
const practice = { completions: [] }

describe("zoned reminders", () => {
  it("reads Berlin wall time from a UTC instant", () => {
    const morning = new Date("2026-11-19T06:05:00.000Z")
    assert.deepEqual(zonedClock(morning, "Europe/Berlin"), { date: "2026-11-19", minutes: 7 * 60 + 5 })
    assert.equal(zonedOffsetMinutes(morning, "Europe/Berlin"), -60)
    const afterMidnight = new Date("2026-11-19T23:30:00.000Z")
    assert.deepEqual(zonedClock(afterMidnight, "Europe/Berlin"), { date: "2026-11-20", minutes: 30 })
  })

  it("includes the open door and the grove hour when each window is open", () => {
    const morning = remindersDue({
      sleepClock: clock,
      practice,
      pendingSun: 5,
      sun: 0,
      date: "2026-11-19",
      minutes: 7 * 60 + 5,
    })
    assert.deepEqual(morning, [{ kind: "door", id: "sleep-wake" }])

    const evening = remindersDue({
      sleepClock: clock,
      practice,
      pendingSun: 5,
      sun: 0,
      date: "2026-11-19",
      minutes: 18 * 60 + 10,
    })
    assert.deepEqual(evening, [
      { kind: "door", id: "load-name" },
      { kind: "grove", nudge: "collect" },
    ])
    const note = reminderNote("en", evening[1], "2026-11-19")
    assert.equal(note.tag, "epoch-grove")
    assert.equal(note.url, "/home/grove")
  })

  it("accepts a browser push service and refuses an address the member chose", () => {
    const keys = { p256dh: "a".repeat(40), auth: "b".repeat(22) }
    assert.equal(pushEndpointAllowed("https://fcm.googleapis.com/fcm/send/device"), true)
    assert.equal(pushEndpointAllowed("https://web.push.apple.com/Qabc"), true)
    assert.equal(pushEndpointAllowed("http://fcm.googleapis.com/fcm/send/device"), false)
    assert.equal(pushEndpointAllowed("https://127.0.0.1/push"), false)
    assert.equal(pushEndpointAllowed("https://fcm.googleapis.com.evil.com/fcm/send/device"), false)
    assert.equal(pushEndpointAllowed("https://user:pass@fcm.googleapis.com/fcm/send/device"), false)
    assert.equal(
      cleanPushSubscription({
        endpoint: "https://updates.push.services.mozilla.com/wpush/v2/device",
        keys,
        locale: "de",
        timeZone: "Europe/Berlin",
      })?.locale,
      "de",
    )
    assert.equal(cleanPushSubscription({ endpoint: "https://127.0.0.1/push", keys, timeZone: "Europe/Berlin" }), null)
    assert.equal(cleanPushSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/device", keys, timeZone: "Not/AZone" }), null)
  })
})
