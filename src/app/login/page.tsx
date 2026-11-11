"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DaypartMark } from "@/components/daypart"
import { SiteHeader } from "@/components/site-header"
import { useCopy } from "@/components/language-toggle"
import { useHealth } from "@/components/health-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function pairReturn(): string | null {
  if (typeof window === "undefined") return null
  const next = new URLSearchParams(window.location.search).get("next")
  if (!next || !next.startsWith("/pair/") || next.includes("//") || next.includes("\\")) return null
  return next
}

export default function LoginPage() {
  const router = useRouter()
  const { ready, account, signIn } = useHealth()
  const t = useCopy()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready || !account) return
    const next = pairReturn()
    if (account.role === "member" && account.profile && next) {
      router.replace(next)
      return
    }
    router.replace(account.role === "admin" ? "/admin" : account.profile ? "/home" : "/onboarding")
  }, [ready, account, router])

  async function submit() {
    const result = await signIn(email, password)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const next = pairReturn()
    if (result.role === "member" && result.hasProfile && next) {
      router.push(next)
      return
    }
    router.push(result.role === "admin" ? "/admin" : result.hasProfile ? "/home" : "/onboarding")
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
      <SiteHeader action={<Link href="/join" className="text-sm text-foreground">{t.login.create}</Link>} />
      <div className="mt-16">
        <p className="text-xs tracking-[0.16em] text-primary uppercase">{t.login.kicker}</p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">{t.login.title}</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {t.login.body}
        </p>
        <DaypartMark className="mt-3" />
        <form
          className="mt-8 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="email">{t.login.email}</Label>
            <Input id="email" className="h-11" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">{t.login.password}</Label>
            <Input id="password" className="h-11" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {error ? <p className="text-sm text-copper">{error}</p> : null}
          <Button className="h-11" type="submit" disabled={!ready || email.trim().length === 0 || password.length === 0}>
            {t.login.submit}
          </Button>
          <Link href="/recover" className="text-sm text-primary">
            {t.login.forgot}
          </Link>
        </form>
      </div>
    </main>
  )
}
