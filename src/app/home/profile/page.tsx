"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useHealth } from "@/components/health-provider"
import { Button } from "@/components/ui/button"
import { pick } from "@/lib/copy"

export default function ProfilePage() {
  const { profile, account, signOut, locale } = useHealth()
  const router = useRouter()
  const [pending, setPending] = useState(false)
  if (!profile || !account) return null

  async function switchAccount() {
    if (pending) return
    setPending(true)
    await signOut()
    router.replace("/login")
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6 md:px-8 md:py-10">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Profile", "Profil")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">{profile.name}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{account.email}</p>
      <p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">
        {pick(
          locale,
          "Switch account signs out of this file. The next screen can open another one.",
          "Konto wechseln meldet diese Datei ab. Der nächste Schritt kann ein anderes Konto öffnen.",
        )}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button className="h-11 px-4" disabled={pending} onClick={() => void switchAccount()}>
          {pick(locale, "Switch account", "Konto wechseln")}
        </Button>
        <Link href="/home/password" className="inline-flex h-11 items-center px-4 text-sm text-primary">
          {pick(locale, "Password", "Passwort")}
        </Link>
      </div>
    </main>
  )
}
