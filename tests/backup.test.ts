import assert from "node:assert/strict"
import { existsSync, mkdtempSync } from "fs"
import { tmpdir } from "os"
import path from "path"
import { describe, it } from "node:test"
import "./demo-env"
import { backupNow, backupDirectory, listBackups } from "../src/lib/backup"
import { getDb, resetDbForTests } from "../src/lib/db"

const root = mkdtempSync(path.join(tmpdir(), "epoch-backup-"))
process.env.EPOCH_DB = path.join(root, "live", "epoch.sqlite")
process.env.EPOCH_BACKUP_DIR = path.join(root, "copies")
resetDbForTests()

describe("file copies", () => {
  it("copies the live file into a separate directory", async () => {
    await getDb()
    const result = await backupNow(new Date("2026-11-07T20:00:00.000Z"))
    assert.ok("name" in result)
    const full = path.join(backupDirectory(), result.name)
    assert.equal(existsSync(full), true)
    assert.ok(listBackups().some((file) => file.name === result.name))
    assert.notEqual(path.resolve(process.env.EPOCH_BACKUP_DIR!), path.dirname(process.env.EPOCH_DB!))
  })
})
