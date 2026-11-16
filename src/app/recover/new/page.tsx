"use client"

import { useLayoutEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useHealth } from "@/components/health-provider"
import { SiteHeader } from "@/components/site-header"
import { useCopy } from "@/components/language-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { appFetch } from "@/lib/browser-api"
import { pick } from "@/lib/copy"

function ResetForm() {
  const t = useCopy()
  const { locale } = useHealth()
  const router = useRouter()
  const [token, setToken] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useLayoutEffect(() => {
    const match = /^#token=([A-Za-z0-9_-]+)$/.exec(window.location.hash)
    const value = match?.[1] ? decodeURIComponent(match[1]) : ""
    if (value) setToken(value)
    if (match || new URLSearchParams(window.location.search).has("token")) {
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [])

  async function submit() {
    if (pending) return
    setPending(true)
    setError(null)
    const response = await appFetch("/api/recover/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    })
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    setPending(false)
    if (!response.ok) {
      setError(data?.error ?? pick(locale, "That reset link is closed.", "Dieser Reset-Link ist geschlossen."))
      return
    }
    router.replace("/login")
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
      <SiteHeader action={<Link href="/login" className="text-sm">{t.login.submit}</Link>} />
      <div className="mt-16">
        <p className="text-xs tracking-[0.16em] text-primary uppercase">{pick(locale, "New password", "Neues Passwort")}</p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">{pick(locale, "Choose a new password.", "Wähl ein neues Passwort.")}</h1>
        <form
          className="mt-8 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="password">{t.login.password}</Label>
            <Input id="password" className="h-11" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {error ? <p className="text-sm text-copper">{error}</p> : null}
          <Button className="h-11" type="submit" disabled={pending || token.length === 0 || password.length < 8}>
            {pick(locale, "Save the password", "Passwort speichern")}
          </Button>
        </form>
      </div>
    </main>
  )
}

export default function RecoverNewPage() {
  return <ResetForm />
}
