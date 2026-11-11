"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { appFetch } from "@/lib/browser-api"

type InviteRow = { id: string; createdAt: string; usedAt: string | null }
type OutboxRow = { id: string; toEmail: string; subject: string; body: string; sentAt: string | null; createdAt: string }
type BackupFile = { name: string; at: string; bytes: number }

export default function DoorPage() {
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [letters, setLetters] = useState<OutboxRow[]>([])
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [freshCode, setFreshCode] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [inviteRes, mailRes, backupRes] = await Promise.all([
      appFetch("/api/admin/invites"),
      appFetch("/api/admin/outbox"),
      appFetch("/api/admin/backup"),
    ])
    const inviteData = (await inviteRes.json()) as { invites?: InviteRow[] }
    const mailData = (await mailRes.json()) as { letters?: OutboxRow[] }
    const backupData = (await backupRes.json()) as { backups?: BackupFile[] }
    setInvites(inviteData.invites ?? [])
    setLetters(mailData.letters ?? [])
    setBackups(backupData.backups ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function mint() {
    const response = await appFetch("/api/admin/invites", { method: "POST" })
    const data = (await response.json()) as { code?: string; error?: string }
    if (!response.ok || !data.code) {
      setNote(data.error ?? "The invite stayed unmade.")
      return
    }
    setFreshCode(data.code)
    setNote("Copy this invite now. It will not be shown again.")
    await load()
  }

  async function copyNow() {
    const response = await appFetch("/api/admin/backup", { method: "POST" })
    const data = (await response.json()) as { name?: string; backups?: BackupFile[]; error?: string }
    if (!response.ok) {
      setNote(data.error ?? "The copy stayed off the disk.")
      return
    }
    setNote(data.name ? `Copied as ${data.name}.` : "Copied.")
    setBackups(data.backups ?? [])
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Staff · door</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">Invites, recovery notes, copies of the file.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        This beta is invite only. If mail is not connected, a reset note lands here so you can send it.
      </p>
      {note ? <p className="mt-4 text-sm">{note}</p> : null}
      {freshCode ? (
        <p className="mt-2 rounded-xl border border-primary bg-moss px-3 py-2 font-mono text-sm">{freshCode}</p>
      ) : null}

      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Invites</h2>
          <Button className="h-10" onClick={() => void mint()}>
            Mint an invite
          </Button>
        </div>
        <ul className="mt-4 grid gap-2">
          {invites.length === 0 ? <li className="text-sm text-muted-foreground">None yet.</li> : null}
          {invites.map((invite) => (
            <li key={invite.id} className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{invite.createdAt.slice(0, 16).replace("T", " ")}</span>
              <span>{invite.usedAt ? "Used" : "Open"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-2xl">Recovery notes</h2>
        <ul className="mt-4 grid gap-3">
          {letters.length === 0 ? <li className="text-sm text-muted-foreground">None yet.</li> : null}
          {letters.map((letter) => (
            <li key={letter.id} className="rounded-xl border border-border px-3 py-3">
              <p className="text-sm font-medium">{letter.toEmail}</p>
              <p className="text-xs text-muted-foreground">
                {letter.sentAt ? "Sent" : "Waiting"} · {letter.createdAt.slice(0, 16).replace("T", " ")}
              </p>
              <pre className="mt-2 whitespace-pre-wrap break-all text-xs leading-5">{letter.body}</pre>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl">File copies</h2>
          <Button className="h-10" variant="outline" onClick={() => void copyNow()}>
            Copy now
          </Button>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The live file is copied on a schedule. Keep that copies directory on a different disk from the live file when you can.
        </p>
        <ul className="mt-4 grid gap-2">
          {backups.length === 0 ? <li className="text-sm text-muted-foreground">No copies yet.</li> : null}
          {backups.map((file) => (
            <li key={file.name} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-mono text-xs">{file.name}</span>
              <span className="text-muted-foreground">{Math.round(file.bytes / 1024)} kb</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
