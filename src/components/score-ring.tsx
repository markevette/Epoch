export function ScoreRing({ score, label = "Longevity score" }: { score: number; label?: string }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const shown = Math.max(0, Math.min(100, score))
  const offset = circumference * (1 - shown / 100)
  return (
    <div className="relative grid size-40 place-items-center" role="img" aria-label={`${label} ${Math.round(shown)} out of 100`}>
      <svg viewBox="0 0 140 140" className="size-40">
        <circle cx="70" cy="70" r={radius} className="fill-none stroke-border" strokeWidth="8" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          className="fill-none stroke-primary"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-5xl tabular leading-none">{Math.round(shown)}</div>
        <div className="mt-1 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">of 100</div>
      </div>
    </div>
  )
}
