import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { cookieIsSecure } from "../src/lib/cookie-policy"

function freshFile() {
  return path.join(mkdtempSync(path.join(tmpdir(), "epoch-deploy-")), "nested", "epoch.sqlite")
}

function probe(mode: string, extra: Record<string, string | undefined> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production", EPOCH_SEED_DEMO: "0" }
  delete env.EPOCH_DB
  delete env.EPOCH_ADMIN_EMAIL
  delete env.EPOCH_ADMIN_PASSWORD
  delete env.EPOCH_COOKIE_SECURE
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) delete env[key]
    else env[key] = value
  }
  const result = spawnSync(process.execPath, ["--import", "tsx", "tests/deploy-probe.ts", mode], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  const line = result.stdout.trim().split("\n").pop() ?? ""
  return JSON.parse(line) as Record<string, unknown>
}

describe("deploy", () => {
  it("marks the session cookie secure behind https and in production", async () => {
    assert.equal(cookieIsSecure({ nodeEnv: "development" }), false)
    assert.equal(cookieIsSecure({ nodeEnv: "production" }), true)
    assert.equal(cookieIsSecure({ nodeEnv: "production", forwardedProto: "http" }), false)
    assert.equal(cookieIsSecure({ nodeEnv: "development", forwardedProto: "https" }), true)
    assert.equal(cookieIsSecure({ nodeEnv: "development", forwardedProto: "HTTPS, http" }), true)
    assert.equal(cookieIsSecure({ nodeEnv: "production", override: "0", forwardedProto: "https" }), false)
    assert.equal(cookieIsSecure({ nodeEnv: "development", override: "1" }), true)
  })

  it("creates one staff account and skips the demo passwords", async () => {
    const file = freshFile()
    const report = probe("staff", {
      EPOCH_DB: file,
      EPOCH_ADMIN_EMAIL: "Ops@Example.com",
      EPOCH_ADMIN_PASSWORD: "correct-horse",
    })
    assert.equal(report.error, undefined)
    assert.equal(report.file, true)
    assert.equal(report.count, 1)
    assert.equal(report.reopen, 1)
    assert.equal(report.avery, false)
    assert.equal(report.demoAdmin, false)
    assert.equal(report.staff, "admin")
  })

  it("starts empty when production has no staff password", async () => {
    const report = probe("empty", { EPOCH_DB: freshFile() })
    assert.equal(report.count, 0)
    assert.equal(report.avery, false)
    assert.equal(report.demoAdmin, false)
  })

  it("refuses a production process with no database path", async () => {
    const report = probe("missing")
    assert.match(String(report.error), /EPOCH_DB/)
  })

  it("refuses a short staff password", async () => {
    const report = probe("short", {
      EPOCH_DB: freshFile(),
      EPOCH_ADMIN_EMAIL: "ops@example.com",
      EPOCH_ADMIN_PASSWORD: "short",
    })
    assert.match(String(report.error), /8 characters/)
  })

  it("loads the demo accounts only when that seed is asked for", async () => {
    const report = probe("demo", {
      EPOCH_DB: freshFile(),
      EPOCH_SEED_DEMO: "1",
      EPOCH_DEMO_EMAIL: "member@example.test",
      EPOCH_DEMO_PASSWORD: "test-member-9",
      EPOCH_DEMO_ADMIN_EMAIL: "staff@example.test",
      EPOCH_DEMO_ADMIN_PASSWORD: "test-staff-9",
    })
    assert.equal(report.count, 2)
    assert.equal(report.avery, true)
    assert.equal(report.demoAdmin, true)
  })

  it("does not turn an existing member into staff", async () => {
    const report = probe("keep-member", { EPOCH_DB: freshFile() })
    assert.equal(report.error, undefined)
    assert.equal(report.promoted, false)
    assert.equal(report.memberRole, "member")
    assert.equal(report.staffRole, "admin")
    assert.equal(report.count, 2)
  })
})
