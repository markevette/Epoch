"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { useHealth } from "@/components/health-provider"
import { Button } from "@/components/ui/button"
import { appFetch } from "@/lib/browser-api"
import { pick, translateError } from "@/lib/copy"

export default function PairInvitePage() {
  const params = useParams<{ token: string }>()
  const token = typeof params.token === "string" ? params.token : ""
  const router = useRouter()
  const { ready, account, locale } = useHealth()
  const [preview, setPreview] = useState<{ name: string; handle: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const next = `/login?next=${encodeURIComponent(`/pair/${token}`)}`

  useEffect(() => {
    if (!token) return
    void appFetch(`/api/pair/invite?token=${encodeURIComponent(token)}`).then(async (response) => {
      const body = (await response.json().catch(() => null)) as { name?: string; handle?: string; error?: string } | null
      if (!response.ok || !body?.name || !body.handle) {
        setError(body?.error || "This link is no longer open.")
        return
      }
      setPreview({ name: body.name, handle: body.handle })
    })
  }, [token])

  async function accept() {
    setPending(true)
    setError(null)
    const response = await appFetch("/api/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", token, offset: new Date().getTimezoneOffset() }),
    })
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    setPending(false)
    if (!response.ok) {
      setError(body?.error || "That did not land.")
      return
    }
    router.push("/home/pair")
  }

  const first = preview?.name.trim().split(/\s+/)[0]
  const member = account?.role === "member" && account.profile

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-5 py-6">
      <SiteHeader />
      <div className="mt-16">
        <p className="text-xs tracking-[0.16em] text-primary uppercase">{pick(locale, "Pair", "Paar")}</p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">{pick(locale, "Keep mornings with one person.", "Halte die Morgen mit einer Person.")}</h1>
        {preview && first ? (
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {pick(
              locale,
              `${first} (@${preview.handle}) invited you. You will each see whether the other checked in that morning. You will not see their score, meals, or workouts.`,
              `${first} (@${preview.handle}) hat dich eingeladen. Ihr seht beide, ob der andere an diesem Morgen eingecheckt hat. Den Wert, die Mahlzeiten und das Training siehst du nicht.`,
            )}
          </p>
        ) : error ? (
          <p className="mt-4 text-sm leading-6 text-copper">{translateError(locale, error)}</p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{pick(locale, "The invitation is loading.", "Die Einladung wird geladen.")}</p>
        )}
        {preview && ready && !account ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={next} className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm text-primary-foreground">
              {pick(locale, "Sign in to accept", "Anmelden, um anzunehmen")}
            </Link>
            <Link href="/join" className="inline-flex h-11 items-center text-sm text-primary">
              {pick(locale, "Create an account", "Konto anlegen")}
            </Link>
          </div>
        ) : null}
        {preview && ready && account && !member ? (
          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            {pick(locale, "Open a member file first, then come back to this link.", "Öffne zuerst eine Mitgliederakte, dann komm auf diesen Link zurück.")}{" "}
            {account.role === "member" ? <Link href="/onboarding" className="text-primary">{pick(locale, "Continue the file", "Die Akte fortsetzen")}</Link> : pick(locale, "This invitation is for a member.", "Diese Einladung ist für ein Mitglied.")}
          </p>
        ) : null}
        {preview && member ? (
          <Button className="mt-6 h-11" disabled={pending} onClick={() => void accept()}>
            {pick(locale, "Accept the pair", "Das Paar annehmen")}
          </Button>
        ) : null}
        {preview && error ? <p className="mt-4 text-sm text-copper">{translateError(locale, error)}</p> : null}
        <p className="mt-6 text-sm text-muted-foreground">{pick(locale, "The first shared morning is the next one you can both still keep. Agreeing after a morning has closed waits until the next one.", "Der erste gemeinsame Morgen ist der nächste, den ihr beide noch halten könnt. Eine Zusage nach einem geschlossenen Morgen wartet bis zum nächsten.")}</p>
      </div>
    </main>
  )
}
