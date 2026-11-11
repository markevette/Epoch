"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Share2, Sprout, SunMedium, Trophy, Users } from "lucide-react"
import { DaypartMark } from "@/components/daypart"
import { LanguageToggle, useCopy } from "@/components/language-toggle"
import { useHealth } from "@/components/health-provider"
import { SleepReminderHost } from "@/components/sleep-clock"

const NAV = [
  { href: "/home", key: "today", icon: SunMedium },
  { href: "/home/buddies", key: "buddies", icon: Users },
  { href: "/home/board", key: "board", icon: Trophy },
  { href: "/home/share", key: "share", icon: Share2 },
  { href: "/home/practice", key: "practice", icon: Sprout },
] as const

function active(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home"
  return pathname.startsWith(href)
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, account, signOut } = useHealth()
  const t = useCopy()

  async function leave() {
    await signOut()
    router.replace("/login")
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside data-chrome="sidebar" className="sticky top-0 hidden h-screen flex-col justify-between overflow-y-auto border-r border-border bg-card/70 px-4 py-6 md:flex">
        <div>
          <Link href="/home" className="font-display text-2xl tracking-tight">
            Epoch
          </Link>
          <p className="mt-3 text-sm font-medium">{profile?.name}</p>
          <p className="text-xs text-muted-foreground">{account?.email}</p>
          <DaypartMark className="mt-4" />
          <LanguageToggle className="mt-4" />
          <Link href="/home/password" className="mt-3 text-sm text-primary hover:underline">
            {t.login.password}
          </Link>
          <button type="button" className="mt-3 text-left text-sm text-primary hover:underline" onClick={leave}>
            {t.nav.signOut}
          </button>
          <nav className="mt-6 grid gap-1">
            {NAV.map((item) => {
              const Icon = item.icon
              const on = active(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${on ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
                  aria-current={on ? "page" : undefined}
                >
                  <Icon className="size-4" />
                  {t.nav[item.key]}
                </Link>
              )
            })}
          </nav>
        </div>
        </aside>
      <div data-chrome="member" className="pb-20 md:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <div>
            <Link href="/home" className="font-display text-xl">
              Epoch
            </Link>
            <p className="text-[11px] text-muted-foreground">{profile?.name ?? ""}</p>
            <DaypartMark compact />
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link href="/home/password" className="text-sm text-primary">
              {t.login.password}
            </Link>
            <button type="button" className="text-sm text-primary" onClick={leave}>
              {t.nav.signOut}
            </button>
          </div>
        </header>
        {children}
        <SleepReminderHost />
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-border bg-card md:hidden">
        {NAV.map((item) => {
          const Icon = item.icon
          const on = active(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-16 flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px] ${on ? "text-primary" : "text-muted-foreground"}`}
              aria-current={on ? "page" : undefined}
            >
              <Icon className="size-4" />
              {t.nav[item.key]}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
