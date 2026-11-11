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

export default function JoinPage() {
  const router = useRouter()
  const { ready, account, signUp } = useHealth()
  const t = useCopy()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [invite, setInvite] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready || !account) return
    router.replace(account.role === "admin" ? "/admin" : account.profile ? "/home" : "/onboarding")
  }, [ready, account, router])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
      <SiteHeader action={<Link href="/login" className="text-sm">{t.join.signIn}</Link>} />
      <div className="mt-16">
        <p className="text-xs tracking-[0.16em] text-primary uppercase">{t.join.kicker}</p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">{t.join.title}</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {t.join.body}
        </p>
        <DaypartMark className="mt-3" />
        <form
          className="mt-8 grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault()
            const result = await signUp({ name, email, password, invite })
            if (!result.ok) {
              setError(result.error)
              return
            }
            router.push("/onboarding")
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="name">{t.join.name}</Label>
            <Input id="name" className="h-11" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">{t.join.email}</Label>
            <Input id="email" className="h-11" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">{t.join.password}</Label>
            <Input id="password" className="h-11" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite">{t.join.invite}</Label>
            <Input id="invite" className="h-11" value={invite} autoComplete="off" onChange={(event) => setInvite(event.target.value)} />
          </div>
          {error ? <p className="text-sm text-copper">{error}</p> : null}
          <Button className="h-11" type="submit" disabled={!ready || name.trim().length === 0 || email.trim().length === 0 || password.length < 8}>
            {t.join.submit}
          </Button>
        </form>
      </div>
    </main>
  )
}
