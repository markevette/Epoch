import assert from "node:assert/strict"
import { randomUUID } from "crypto"
import { mkdtempSync } from "fs"
import { tmpdir } from "os"
import path from "path"
import { describe, it } from "node:test"
import { savePushSubscription, dispatchDuePushes, type PushSender } from "../src/lib/push-dispatch"
import type { PushNote } from "../src/lib/push-notes"
import { qall, qrun, resetDbForTests } from "../src/lib/sql"

process.env.EPOCH_DB = path.join(mkdtempSync(path.join(tmpdir(), "epoch-push-")), "test.sqlite")
process.env.EPOCH_SEED_DEMO = "0"
resetDbForTests()

const keys = { p256dh: "a".repeat(40), auth: "b".repeat(22) }

describe("push delivery", () => {
  it("sends a due door once, then the grove hour, and drops a hostile endpoint", async () => {
    const userId = randomUUID()
    await qrun(
      `INSERT INTO users (id, email, password_hash, name, role, profile_json, created_at)
       VALUES (?, ?, ?, ?, 'member', ?, ?)`,
      userId,
      "push@example.test",
      "hash",
      "Mina Stone",
      JSON.stringify({
        sleepClock: { wake: "07:00", bed: "23:00" },
        practice: { completions: [] },
        grove: { sun: 0, watered: 0, gathered: 0, credited: [], pending: null },
        rewards: [],
        nudgePoints: 5,
      }),
      "2026-11-19T00:00:00.000Z",
    )
    await savePushSubscription(userId, {
      endpoint: "https://fcm.googleapis.com/fcm/send/mina",
      ...keys,
      locale: "en",
      timeZone: "Europe/Berlin",
    })
    await qrun(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, locale, time_zone, updated_at)
       VALUES (?, ?, ?, ?, ?, 'en', 'Europe/Berlin', ?)`,
      randomUUID(),
      userId,
      "https://127.0.0.1/push",
      keys.p256dh,
      keys.auth,
      "2026-11-19T00:00:00.000Z",
    )

    const sent: { endpoint: string; note: PushNote }[] = []
    const sender: PushSender = async (target, note) => {
      sent.push({ endpoint: target.endpoint, note })
    }
    const morning = new Date("2026-11-19T06:05:00.000Z")
    await dispatchDuePushes(morning, sender)
    await dispatchDuePushes(morning, sender)
    assert.equal(sent.length, 1)
    assert.equal(sent[0]?.endpoint, "https://fcm.googleapis.com/fcm/send/mina")
    assert.equal(sent[0]?.note.tag, "epoch-sleep-wake")
    assert.equal(sent[0]?.note.url, "/home/practice/sleep-wake")

    await dispatchDuePushes(new Date("2026-11-19T17:10:00.000Z"), sender)
    assert.equal(sent.length, 2)
    assert.equal(sent[1]?.note.tag, "epoch-grove")
    assert.equal(sent[1]?.note.url, "/home/grove")

    const left = await qall<{ endpoint: string }>("SELECT endpoint FROM push_subscriptions")
    assert.deepEqual(left.map((row) => row.endpoint), ["https://fcm.googleapis.com/fcm/send/mina"])
  })
})
