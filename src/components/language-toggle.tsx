"use client"

import { useHealth } from "@/components/health-provider"
import { copy } from "@/lib/copy"
import type { Locale } from "@/lib/locale"

export function useCopy() {
  const { locale } = useHealth()
  return copy(locale)
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useHealth()
  const label = copy(locale).lang
  return (
    <div className={`inline-flex items-center rounded-full border border-border p-0.5 text-xs ${className}`} role="group" aria-label={label}>
      {(["de", "en"] as Locale[]).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={locale === option}
          className={`rounded-full px-2 py-1 uppercase tracking-[0.12em] ${locale === option ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          onClick={() => void setLocale(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
