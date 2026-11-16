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

const BURST = [
  { x: "-78px", y: "-72px", spin: "-80deg", delay: "0s" },
  { x: "-40px", y: "-104px", spin: "46deg", delay: "0.04s" },
  { x: "4px", y: "-118px", spin: "-24deg", delay: "0.08s" },
  { x: "42px", y: "-100px", spin: "86deg", delay: "0.02s" },
  { x: "82px", y: "-68px", spin: "-58deg", delay: "0.1s" },
  { x: "108px", y: "-28px", spin: "130deg", delay: "0.06s" },
  { x: "-108px", y: "-24px", spin: "18deg", delay: "0.12s" },
]

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
    <div key={token} className="epoch-cheer-slot">
      {still
        ? null
        : BURST.map((bit) => (
            <span
              key={bit.x}
              className={`epoch-bit ${BITS[kind]}`}
              style={{ animationDelay: bit.delay, ["--bit-x" as string]: bit.x, ["--bit-y" as string]: bit.y, ["--bit-spin" as string]: bit.spin }}
            />
          ))}
      <div role="status" aria-live="polite" className="epoch-cheer">
        <p className="font-display text-2xl tracking-tight">{line.title}</p>
        <p className="mt-1 text-sm leading-6">{line.body}</p>
      </div>
    </div>
  )
}
