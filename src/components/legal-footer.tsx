"use client"

import Link from "next/link"
import { useCopy } from "@/components/language-toggle"

export function LegalFooter() {
  const t = useCopy()
  const links = [
    { href: "/legal/imprint", label: t.footer.imprint },
    { href: "/legal/privacy", label: t.footer.privacy },
    { href: "/legal/terms", label: t.footer.terms },
  ]
  return (
    <footer className="border-t border-border px-5 py-6 pb-24 md:pb-8">
      <nav className="mx-auto flex max-w-6xl flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-foreground">
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  )
}
