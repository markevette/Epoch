import fs from "node:fs"
import path from "node:path"
import { databasePath, getDb, usesFileDatabase } from "./sql"

const KEEP = 14
const INTERVAL_MS = 6 * 60 * 60 * 1000
const STAMP = /\.sqlite$/

const globalForBackup = globalThis as unknown as { epochBackupTimer?: ReturnType<typeof setInterval> }

export function backupDirectory(): string {
  const configured = process.env.EPOCH_BACKUP_DIR?.trim()
  if (configured) return configured
  return path.join(path.dirname(databasePath()), "backups")
}

export type BackupFile = { name: string; at: string; bytes: number }

export function listBackups(): BackupFile[] {
  if (!usesFileDatabase()) return []
  const dir = backupDirectory()
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => STAMP.test(name) && name.startsWith("epoch-"))
    .map((name) => {
      const full = path.join(dir, name)
      const stat = fs.statSync(full)
      return { name, at: stat.mtime.toISOString(), bytes: stat.size }
    })
    .sort((a, b) => b.at.localeCompare(a.at))
}

export async function backupNow(now = new Date()): Promise<{ name: string } | { error: string }> {
  if (!usesFileDatabase()) return { error: "Copies of the live file are for the single-process host." }
  const destDir = backupDirectory()
  const source = path.resolve(databasePath())
  fs.mkdirSync(destDir, { recursive: true })
  const stamp = now.toISOString().replace(/[:.]/g, "-")
  const name = `epoch-${stamp}.sqlite`
  const dest = path.resolve(destDir, name)
  if (dest === source) return { error: "The backup directory cannot be the live file." }
  try {
    const db = await getDb()
    if (!db.backup) return { error: "This host does not copy the live file." }
    await db.backup(dest)
    rotate(destDir)
    return { name }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 180) : "The copy failed."
    return { error: message }
  }
}

function rotate(dir: string) {
  const kept = listBackups()
  for (const extra of kept.slice(KEEP)) {
    try {
      fs.unlinkSync(path.join(dir, extra.name))
    } catch {
      // Leave a file that cannot be removed; the next pass tries again.
    }
  }
}

export function startBackupLoop(): void {
  if (globalForBackup.epochBackupTimer) return
  if (process.env.NEXT_PHASE === "phase-production-build") return
  if (!usesFileDatabase()) return
  if (process.env.NODE_ENV === "production" && !process.env.EPOCH_DB?.trim()) return
  void backupNow()
  globalForBackup.epochBackupTimer = setInterval(() => {
    void backupNow()
  }, INTERVAL_MS)
  globalForBackup.epochBackupTimer.unref?.()
}
