import type { GroveStage } from "@/lib/grove"

const GROWN: Record<GroveStage, number> = {
  seed: 0,
  sprout: 1,
  sapling: 2,
  young: 3,
  tree: 4,
  canopy: 5,
}

export function GroveTree({ stage, blossoms, splash }: { stage: GroveStage; blossoms: number; splash: boolean }) {
  const grown = GROWN[stage]
  const crown = grown >= 5 ? 62 : grown === 4 ? 50 : grown === 3 ? 36 : 0
  return (
    <svg viewBox="0 0 220 230" className="mx-auto h-56 w-full max-w-md" role="img" aria-label={stage}>
      <ellipse cx="110" cy="204" rx="86" ry="16" fill="oklch(0.4 0.07 145)" />
      <ellipse cx="110" cy="198" rx="64" ry="10" fill="oklch(0.48 0.08 125 / 0.55)" />
      {grown === 0 ? (
        <>
          <ellipse cx="110" cy="186" rx="18" ry="11" fill="oklch(0.46 0.09 55)" />
          <ellipse cx="104" cy="182" rx="6" ry="3" fill="oklch(0.62 0.08 80 / 0.7)" />
        </>
      ) : null}
      {grown === 1 ? (
        <g className="grove-tree-sway">
          <path d="M110 196 C108 170 112 150 110 132" stroke="oklch(0.42 0.09 145)" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="86" cy="148" rx="22" ry="10" fill="oklch(0.62 0.13 145)" transform="rotate(-32 86 148)" />
          <ellipse cx="136" cy="142" rx="22" ry="10" fill="oklch(0.7 0.14 140)" transform="rotate(30 136 142)" />
        </g>
      ) : null}
      {grown === 2 ? (
        <g className="grove-tree-sway">
          <path d="M110 198 C106 160 114 130 110 108" stroke="oklch(0.4 0.08 145)" strokeWidth="6" fill="none" strokeLinecap="round" />
          <ellipse cx="72" cy="132" rx="26" ry="11" fill="oklch(0.55 0.12 150)" transform="rotate(-40 72 132)" />
          <ellipse cx="150" cy="126" rx="26" ry="11" fill="oklch(0.66 0.13 140)" transform="rotate(36 150 126)" />
          <ellipse cx="92" cy="104" rx="20" ry="9" fill="oklch(0.72 0.14 135)" transform="rotate(-16 92 104)" />
          <ellipse cx="132" cy="98" rx="20" ry="9" fill="oklch(0.6 0.12 148)" transform="rotate(18 132 98)" />
        </g>
      ) : null}
      {crown > 0 ? (
        <g className="grove-tree-sway">
          <path d="M110 200 C104 160 108 130 110 118" stroke="oklch(0.38 0.06 70)" strokeWidth={grown >= 5 ? 16 : grown === 4 ? 12 : 9} fill="none" strokeLinecap="round" />
          <circle cx="110" cy={128 - crown * 0.15} r={crown} fill="oklch(0.46 0.09 150)" />
          <circle cx={110 - crown * 0.55} cy={140 - crown * 0.05} r={crown * 0.72} fill="oklch(0.55 0.11 145)" />
          <circle cx={110 + crown * 0.58} cy={138 - crown * 0.02} r={crown * 0.68} fill="oklch(0.62 0.12 140)" />
          <circle cx="110" cy={112 - crown * 0.45} r={crown * 0.62} fill="oklch(0.58 0.12 145)" />
          {blossoms > 0 ? (
            <>
              <circle cx={110 - crown * 0.35} cy={118 - crown * 0.2} r="6" fill="oklch(0.78 0.12 55)" />
              <circle cx={110 + crown * 0.4} cy={136 - crown * 0.1} r="5" fill="oklch(0.8 0.1 70)" />
              {blossoms > 2 ? <circle cx="110" cy={100 - crown * 0.35} r="5" fill="oklch(0.84 0.12 95)" /> : null}
            </>
          ) : null}
        </g>
      ) : null}
      {splash ? <ellipse cx="110" cy="120" rx="18" ry="26" fill="oklch(0.85 0.08 220 / 0.55)" className="grove-splash" /> : null}
    </svg>
  )
}
