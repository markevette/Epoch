"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { LanguageToggle, useCopy } from "@/components/language-toggle"

export function SiteHeader({ action }: { action?: ReactNode }) {
  const t = useCopy()
  return (
    <header className="flex items-center justify-between gap-4">
      <Link href="/" className="font-display text-2xl tracking-tight text-foreground">
        Epoch
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <LanguageToggle />
        {action ?? (
          <Link href="/login" className="text-foreground hover:text-primary">
            {t.nav.signIn}
          </Link>
        )}
      </nav>
    </header>
  )
}
