"use client"

import { useHealth } from "@/components/health-provider"
import { pick } from "@/lib/copy"

export function Disclaimer({ className = "" }: { className?: string }) {
  const { locale } = useHealth()
  return (
    <p className={`max-w-3xl text-xs leading-5 text-muted-foreground ${className}`}>
      {pick(
        locale,
        "Epoch is a wellness record for education. A clinician diagnoses illness and prescribes treatment. The daily score moves when sleep, fitness, food, or stress moves.",
        "Epoch ist eine Wellness-Akte zur Orientierung. Eine Ärztin oder ein Arzt stellt Diagnosen und behandelt. Der Tageswert bewegt sich, wenn Schlaf, Fitness, Essen oder Stress sich bewegen.",
      )}
    </p>
  )
}
