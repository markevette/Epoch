"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import type { PublicAccount } from "@/lib/accounts"
import { appFetch } from "@/lib/browser-api"
import { formatYears } from "@/lib/format"
import { assess, loggedDayCount } from "@/lib/score"

const panel = "rounded-2xl border border-border bg-card p-5"

export default function StaffFilePage() {
  const params = useParams<{ email: string }>()
  const email = decodeURIComponent(params.email)
  const [account, setAccount] = useState<PublicAccount | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    appFetch("/api/admin/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
      .then(async (response) => {
        const data = (await response.json()) as { account?: PublicAccount; error?: string }
        if (cancel) return
        if (!response.ok || !data.account) {
          setError(data.error ?? "This file did not open.")
          return
        }
        setAccount(data.account)
      })
      .catch(() => {
        if (!cancel) setError("This server could not be reached.")
      })
    return () => {
      cancel = true
    }
  }, [email])

  const profile = account?.profile ?? null
  const model = profile
    ? assess({
        age: profile.age,
        sex: profile.sex,
        inputs: profile.inputs,
        loggedDays: loggedDayCount(profile.history),
      })
    : null

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Staff · file</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">{profile?.name ?? email}</h1>
      <p className="mt-3 text-sm text-muted-foreground">Opening this page is recorded on the member’s file, under your sign-in.</p>
      {error ? <p className="mt-4 text-sm text-copper">{error}</p> : null}
      {!account && !error ? <p className="mt-6 text-sm text-muted-foreground">Opening the file.</p> : null}
      {profile && model ? (
        <section className={`${panel} mt-6`}>
          <p className="font-display text-5xl tabular">{model.biologicalAge.toFixed(1)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatYears(model.ageDelta)} · score {Math.round(model.longevityScore)}
          </p>
          {model.flags.length > 0 ? (
            <ul className="mt-4 grid gap-2 text-sm text-copper">
              {model.flags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {account && !profile ? <p className="mt-6 text-sm text-muted-foreground">This member has not finished a file.</p> : null}
    </main>
  )
}
