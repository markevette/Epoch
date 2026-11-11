"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { KeyRound, Users } from "lucide-react"
import { DaypartMark } from "@/components/daypart"
import { useHealth } from "@/components/health-provider"

const NAV = [
  { href: "/admin", label: "Members", icon: Users },
  { href: "/admin/door", label: "Door", icon: KeyRound },
]

function active(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/file")
  return pathname.startsWith(href)
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { account, signOut } = useHealth()

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside data-chrome="sidebar" className="sticky top-0 hidden h-screen flex-col justify-between overflow-y-auto border-r border-border bg-card/70 px-4 py-6 md:flex">
        <div>
          <Link href="/admin" className="font-display text-2xl tracking-tight">
            Epoch
          </Link>
          <p className="mt-1 text-xs tracking-[0.14em] text-primary uppercase">Staff console</p>
          <p className="mt-3 text-xs text-muted-foreground">{account?.email}</p>
          <DaypartMark className="mt-4" />
          <button
            type="button"
            className="mt-4 text-left text-sm text-primary hover:underline"
            onClick={() => {
              void signOut().then(() => router.replace("/login"))
            }}
          >
            Sign out
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
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
        </aside>
      <div>
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <div>
            <p className="font-display text-xl">Epoch</p>
            <p className="text-[11px] tracking-[0.14em] text-primary uppercase">Staff</p>
          </div>
          <button
            type="button"
            className="text-sm text-muted-foreground"
            onClick={() => {
              void signOut().then(() => router.replace("/login"))
            }}
          >
            Sign out
          </button>
        </header>
        <div className="flex gap-4 px-4 pt-4 text-sm md:hidden">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={active(pathname, item.href) ? "text-primary" : "text-muted-foreground"}>
              {item.label}
            </Link>
          ))}
        </div>
        {children}
      </div>
    </div>
  )
}
