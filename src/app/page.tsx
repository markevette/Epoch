"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { DaypartMark } from "@/components/daypart"
import { Disclaimer } from "@/components/disclaimer"
import { useHealth } from "@/components/health-provider"
import { SiteHeader } from "@/components/site-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useCopy } from "@/components/language-toggle"
import { AVERY_INPUTS } from "@/lib/personas"
import { assess } from "@/lib/score"

const preview = assess({
  age: 38,
  sex: "female",
  inputs: AVERY_INPUTS,
  loggedDays: 12,
})

export default function HomePage() {
  const router = useRouter()
  const { ready, account } = useHealth()
  const t = useCopy()
  const destination = account?.role === "admin" ? "/admin" : account?.profile ? "/home" : account ? "/onboarding" : "/login"

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-6 md:px-8 md:py-8">
      <SiteHeader
        action={
          <Link href={destination} className="text-sm text-foreground">
            {account?.role === "admin" ? t.home.staff : account ? t.home.yourDay : t.home.signIn}
          </Link>
        }
      />
      <section className="grid items-end gap-10 py-12 md:grid-cols-12 md:py-20">
        <div className="md:col-span-7">
          <p className="text-xs tracking-[0.18em] text-primary uppercase">{t.home.kicker}</p>
          <h1 className="mt-4 max-w-xl font-display text-5xl leading-[0.95] tracking-tight text-balance md:text-7xl">
            {t.home.title}
          </h1>
          <ul className="mt-6 grid max-w-lg gap-2 text-lg leading-7 text-muted-foreground">
            {t.claims.map((sentence) => (
              <li key={sentence}>{sentence}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button className="h-11 px-4" disabled={!ready} onClick={() => router.push(destination)}>
              {account ? t.home.continue : t.home.signIn}
            </Button>
            <Link href="/join" className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}>
              {t.home.create}
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {t.home.note}
          </p>
          <DaypartMark className="mt-3" />
        </div>
        <aside className="rounded-3xl border border-border bg-card p-6 shadow-[0_20px_50px_-32px_rgba(30,50,40,0.45)] md:col-span-5">
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{t.home.sample}</p>
          <p className="mt-6 font-display text-7xl tabular leading-none">{Math.round(preview.longevityScore)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t.home.dailyScore}</p>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">{t.claims[0]}</p>
        </aside>
      </section>

      <section className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3">
        {[
          {
            index: "01",
            title: t.home.score,
            body: t.claims[0],
          },
          {
            index: "02",
            title: t.home.practice,
            body: t.claims[1],
          },
          {
            index: "03",
            title: t.home.buddies,
            body: t.claims[2],
          },
        ].map((item) => (
          <article key={item.index} className="bg-card p-6">
            <p className="text-xs tracking-[0.16em] text-primary uppercase">{item.index}</p>
            <h2 className="mt-3 font-display text-3xl">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.body}</p>
          </article>
        ))}
      </section>

      <Disclaimer className="py-10" />
    </main>
  )
}
