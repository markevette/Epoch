"use client"

import { useState } from "react"
import { Disclaimer } from "@/components/disclaimer"
import { useHealth } from "@/components/health-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { appFetch } from "@/lib/browser-api"
import { pick } from "@/lib/copy"

export default function PasswordPage() {
  const { locale, account } = useHealth()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  if (!account) return null

  async function save() {
    if (pending) return
    setPending(true)
    setError(null)
    setNote(null)
    const response = await appFetch("/api/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current, next }),
    })
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    setPending(false)
    if (!response.ok) {
      setError(data?.error ?? pick(locale, "That password stayed as it was.", "Das Passwort blieb, wie es war."))
      return
    }
    setCurrent("")
    setNext("")
    setNote(pick(locale, "The new password is on this file.", "Das neue Passwort liegt auf dieser Datei."))
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Password", "Passwort")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">{pick(locale, "Change the password on this file.", "Ändere das Passwort auf dieser Datei.")}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        {pick(locale, `${account.email}. If you cannot sign in, request a reset from the sign-in page.`, `${account.email}. Wenn du dich nicht anmelden kannst, fordere auf der Anmeldeseite einen Reset an.`)}
      </p>
      <form
        className="mt-8 grid max-w-md gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="current">{pick(locale, "Current password", "Aktuelles Passwort")}</Label>
          <Input id="current" className="h-11" type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="next">{pick(locale, "New password", "Neues Passwort")}</Label>
          <Input id="next" className="h-11" type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} />
        </div>
        {error ? <p className="text-sm text-copper">{error}</p> : null}
        {note ? <p className="text-sm">{note}</p> : null}
        <Button className="h-11" type="submit" disabled={pending || current.length === 0 || next.length < 8}>
          {pick(locale, "Save the password", "Passwort speichern")}
        </Button>
      </form>
      <Disclaimer className="mt-8" />
    </main>
  )
}
