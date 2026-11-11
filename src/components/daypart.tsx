"use client"

import { useEffect, useState } from "react"
import { DAYPART_LABEL, DAYPART_NOTE, daypartFromHour, daypartPreview, type Daypart } from "@/lib/daypart"

export function DaypartSync({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    function apply() {
      let preview: string | null = null
      try {
        preview = sessionStorage.getItem("epoch.daypart")
      } catch {
        preview = null
      }
      document.documentElement.dataset.daypart = daypartPreview(preview) ?? daypartFromHour(new Date().getHours())
    }
    apply()
    const id = window.setInterval(apply, 30_000)
    function onVisible() {
      if (document.visibilityState === "visible") apply()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])
  return children
}

export function DaypartMark({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const part = useDaypart()
  if (compact) {
    return (
      <p aria-label={part ? DAYPART_LABEL[part] : undefined} className={`daypart-label text-[11px] tracking-[0.14em] text-primary uppercase ${className}`} />
    )
  }
  return (
    <p aria-label={part ? `${DAYPART_LABEL[part]}. ${DAYPART_NOTE[part]}` : undefined} className={`text-xs leading-5 ${className}`}>
      <span className="daypart-label tracking-[0.14em] text-primary uppercase" />
      <span className="text-muted-foreground"> · </span>
      <span className="daypart-note text-muted-foreground" />
    </p>
  )
}

function useDaypart(): Daypart | null {
  const [part, setPart] = useState<Daypart | null>(null)
  useEffect(() => {
    function read() {
      const value = document.documentElement.dataset.daypart
      if (value === "morning" || value === "day" || value === "night") setPart(value)
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-daypart"] })
    return () => observer.disconnect()
  }, [])
  return part
}
