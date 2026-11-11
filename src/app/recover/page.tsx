"use client"

import { useState } from "react"
import Link from "next/link"
import { useHealth } from "@/components/health-provider"
import { SiteHeader } from "@/components/site-header"
import { useCopy } from "@/components/language-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { appFetch } from "@/lib/browser-api"
import { pick } from "@/lib/copy"

export default function RecoverPage() {
  const t = useCopy()
  const { locale } = useHealth()
  const [email, setEmail] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit() {
    if (pending) return
    setPending(true)
    const response = await appFetch("/api/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const data = (await response.json().catch(() => null)) as { notice?: string } | null
    setNotice(
      data?.notice ??
        pick(locale, "If that email is on a file, a reset note is on its way.", "Wenn diese E-Mail auf einer Datei liegt, ist eine Reset-Notiz unterwegs."),
    )
    setPending(false)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
      <SiteHeader action={<Link href="/login" className="text-sm">{t.login.submit}</Link>} />
      <div className="mt-16">
        <p className="text-xs tracking-[0.16em] text-primary uppercase">{pick(locale, "Recover", "Wiederherstellen")}</p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">{pick(locale, "Open the door again.", "Öffne die Tür wieder.")}</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {pick(
            locale,
            "Enter the email on the file. The same answer comes back either way. Staff can send the note if mail is not connected yet.",
            "Gib die E-Mail der Datei ein. Die Antwort ist in beiden Fällen dieselbe. Das Team kann die Notiz schicken, wenn Post noch nicht verbunden ist.",
          )}
        </p>
        <form
          className="mt-8 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="email">{t.login.email}</Label>
            <Input id="email" className="h-11" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          {notice ? <p className="text-sm">{notice}</p> : null}
          <Button className="h-11" type="submit" disabled={pending || email.trim().length === 0}>
            {pick(locale, "Request a reset", "Reset anfordern")}
          </Button>
        </form>
      </div>
    </main>
  )
}
