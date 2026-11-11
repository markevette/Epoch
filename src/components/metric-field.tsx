"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

type MetricFieldProps = {
  label: string
  hint?: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
  unit?: string
  digits?: number
}

function roundTo(value: number, step: number) {
  const digits = (String(step).split(".")[1] ?? "").length
  const snapped = Math.round(value / step) * step
  return Number(snapped.toFixed(digits))
}

export function MetricField({ label, hint, min, max, step, value, onChange, unit, digits }: MetricFieldProps) {
  const shown = (Number.isFinite(value) ? value : min).toFixed(digits ?? (String(step).split(".")[1] ?? "").length)
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <div className="flex items-baseline gap-1.5">
          <Input
            id={id}
            className="tabular h-9 w-24 text-right font-display text-lg"
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={shown}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)))
            }}
          />
          {unit ? <span className="w-14 text-xs text-muted-foreground">{unit}</span> : null}
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[Math.min(max, Math.max(min, value))]}
        onValueChange={(next) => {
          const raw = Array.isArray(next) ? Number(next[0]) : Number(next)
          if (Number.isFinite(raw)) onChange(roundTo(Math.min(max, Math.max(min, raw)), step))
        }}
        aria-label={label}
      />
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
