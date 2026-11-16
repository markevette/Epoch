"use client"

import { useEffect, useState } from "react"
import { useHealth } from "@/components/health-provider"
import { cheerLine, isCheerKind, type CheerKind } from "@/lib/cheer"

const BITS: Record<CheerKind, string> = {
  task: "epoch-bit-leaf",
  "check-in": "epoch-bit-mark",
  pour: "epoch-bit-drop",
  sun: "epoch-bit-sun",
  line: "epoch-bit-mark",
  level: "epoch-bit-leaf",
}

export function CheerHost() {
  const { locale } = useHealth()
  const [kind, setKind] = useState<CheerKind | null>(null)
  const [token, setToken] = useState(0)
  const [still, setStill] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const read = () => setStill(media.matches)
    read()
    media.addEventListener("change", read)
    return () => media.removeEventListener("change", read)
  }, [])

  useEffect(() => {
    const onCheer = (event: Event) => {
      const next = (event as CustomEvent<{ kind?: unknown }>).detail?.kind
      if (!isCheerKind(next)) return
      setKind(next)
      setToken((value) => value + 1)
    }
    window.addEventListener("epoch-cheer", onCheer)
    return () => window.removeEventListener("epoch-cheer", onCheer)
  }, [])

  useEffect(() => {
    if (!kind) return
    const timer = window.setTimeout(() => setKind(null), 2800)
    return () => window.clearTimeout(timer)
  }, [kind, token])

  if (!kind) return null
  const line = cheerLine(locale, kind)
  return (
    <div key={token} role="status" aria-live="polite" className="epoch-cheer">
      {still
        ? null
        : [0, 1, 2, 3, 4, 5].map((index) => (
            <span key={index} className={`epoch-bit ${BITS[kind]}`} style={{ left: `${12 + index * 14}%`, animationDelay: `${index * 0.12}s` }} />
          ))}
      <p className="font-display text-2xl tracking-tight">{line.title}</p>
      <p className="mt-1 text-sm leading-6">{line.body}</p>
    </div>
  )
}
