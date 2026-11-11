import fs from "fs"
import { getDb, openSession, registerMember, resetDbForTests } from "../src/lib/db"

async function count() {
  const row = await (await getDb()).prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number } | undefined
  return row?.n ?? 0
}

function report(data: unknown) {
  process.stdout.write(`${JSON.stringify(data)}\n`)
}

async function main() {
  const mode = process.argv[2]
  if (mode === "keep-member") {
    const created = await registerMember({ email: "nia@example.com", password: "nia-pass", name: "Nia" })
    if ("error" in created) throw new Error(created.error)
    process.env.EPOCH_ADMIN_EMAIL = "nia@example.com"
    process.env.EPOCH_ADMIN_PASSWORD = "long-password"
    resetDbForTests()
    await getDb()
    const promoted = await openSession("nia@example.com", "long-password")
    const member = await openSession("nia@example.com", "nia-pass")
    process.env.EPOCH_ADMIN_EMAIL = "ops@example.com"
    process.env.EPOCH_ADMIN_PASSWORD = "correct-horse"
    resetDbForTests()
    await getDb()
    const staff = await openSession("ops@example.com", "correct-horse")
    report({
      promoted: Boolean(promoted),
      memberRole: member?.account.role ?? null,
      staffRole: staff?.account.role ?? null,
      count: await count(),
    })
    return
  }
  await getDb()
  const file = process.env.EPOCH_DB ?? ""
  const staffEmail = process.env.EPOCH_ADMIN_EMAIL
  const staffPassword = process.env.EPOCH_ADMIN_PASSWORD
  const staffSession = staffEmail && staffPassword ? await openSession(staffEmail, staffPassword) : null
  const body: Record<string, unknown> = {
    count: await count(),
    file: file ? fs.existsSync(file) : false,
    avery: Boolean(await openSession(process.env.EPOCH_DEMO_EMAIL ?? "", process.env.EPOCH_DEMO_PASSWORD ?? "")),
    demoAdmin: Boolean(await openSession(process.env.EPOCH_DEMO_ADMIN_EMAIL ?? "", process.env.EPOCH_DEMO_ADMIN_PASSWORD ?? "")),
    staff: staffSession?.account.role ?? null,
  }
  resetDbForTests()
  await getDb()
  body.reopen = await count()
  report(body)
}

main().catch((error) => {
  report({ error: error instanceof Error ? error.message : String(error) })
})
