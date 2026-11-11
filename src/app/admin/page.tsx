"use client"

import Link from "next/link"
import { useHealth } from "@/components/health-provider"
import { assess, loggedDayCount } from "@/lib/score"

export default function MembersPage() {
  const { accounts } = useHealth()
  const members = accounts.filter((account) => account.role === "member")

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Staff</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">Members</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        Files on this host. Open one to read it. There is no paid plan to apply.
      </p>
      <ul className="mt-8 grid gap-3">
        {members.map((member) => {
          const profile = member.profile
          const model = profile
            ? assess({
                age: profile.age,
                sex: profile.sex,
                inputs: profile.inputs,
                loggedDays: loggedDayCount(profile.history),
              })
            : null
          return (
            <li key={member.email} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl">{profile?.name ?? member.name}</h2>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                  <Link href={`/admin/file/${encodeURIComponent(member.email)}`} className="mt-2 inline-block text-sm text-primary hover:underline">
                    Open file
                  </Link>
                </div>
                {model ? (
                  <div className="text-right">
                    <p className="font-display text-3xl tabular leading-none">{model.biologicalAge.toFixed(1)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Score {Math.round(model.longevityScore)}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Still opening the file</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
