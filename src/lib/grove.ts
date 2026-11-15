/** Sun collected from reward points, or bought, then poured to grow one tree. */

export const POUR_COST = 4
export const SUN_PER_TAP = 5
export const SUN_CAP = 100_000
export const WATER_CAP = 10_000

export const GROVE_STAGES = ["seed", "sprout", "sapling", "young", "tree", "canopy"] as const
export type GroveStage = (typeof GROVE_STAGES)[number]

const STAGE_WATER: Record<GroveStage, number> = {
  seed: 0,
  sprout: 3,
  sapling: 8,
  young: 16,
  tree: 28,
  canopy: 45,
}

export type SunPack = {
  id: "handful" | "basket" | "barrow"
  sun: number
  cents: number
}

export const SUN_PACKS: SunPack[] = [
  { id: "handful", sun: 20, cents: 99 },
  { id: "basket", sun: 60, cents: 249 },
  { id: "barrow", sun: 160, cents: 499 },
]

export type ShopMode = "live" | "sample" | "off"

export type GroveFile = {
  sun: number
  watered: number
  gathered: number
  credited: string[]
  pending: string | null
}

export type GroveView = {
  sun: number
  watered: number
  stage: GroveStage
  level: number
  levelCount: number
  poursIntoLevel: number
  poursToNext: number | null
  pourCost: number
  pendingSun: number
  tapSun: number
  blossoms: number
  rewardPoints: number
  shop: ShopMode
  packs: { id: SunPack["id"]; sun: number; cents: number }[]
  checkoutUrl?: string
}

const ID_TEXT = /^[A-Za-z0-9_-]{4,80}$/

export function emptyGrove(): GroveFile {
  return { sun: 0, watered: 0, gathered: 0, credited: [], pending: null }
}

function clampCount(value: unknown, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(max, Math.round(value)))
}

export function normalizeGrove(value: unknown): GroveFile {
  if (!value || typeof value !== "object") return emptyGrove()
  const row = value as Record<string, unknown>
  const credited: string[] = []
  const seen = new Set<string>()
  if (Array.isArray(row.credited)) {
    for (const item of row.credited) {
      if (typeof item !== "string" || !ID_TEXT.test(item) || seen.has(item)) continue
      seen.add(item)
      credited.push(item)
      if (credited.length >= 500) break
    }
  }
  const pending = typeof row.pending === "string" && ID_TEXT.test(row.pending) ? row.pending : null
  return {
    sun: clampCount(row.sun, SUN_CAP),
    watered: clampCount(row.watered, WATER_CAP),
    gathered: clampCount(row.gathered, SUN_CAP),
    credited,
    pending,
  }
}

export function shopMode(env: NodeJS.ProcessEnv = process.env): ShopMode {
  if (env.MOLLIE_API_KEY?.trim()) return "live"
  if (env.NODE_ENV === "production") return "off"
  return "sample"
}

export function packById(id: string): SunPack | null {
  return SUN_PACKS.find((pack) => pack.id === id) ?? null
}

export function stageFor(watered: number): { stage: GroveStage; level: number; poursIntoLevel: number; poursToNext: number | null; blossoms: number } {
  const pours = clampCount(watered, WATER_CAP)
  let stage: GroveStage = "seed"
  for (const name of GROVE_STAGES) {
    if (pours >= STAGE_WATER[name]) stage = name
  }
  const level = GROVE_STAGES.indexOf(stage) + 1
  const next = GROVE_STAGES[level] ?? null
  const into = pours - STAGE_WATER[stage]
  const blossoms = stage === "canopy" ? into : 0
  return {
    stage,
    level,
    poursIntoLevel: into,
    poursToNext: next ? STAGE_WATER[next] - pours : null,
    blossoms,
  }
}

export function presentGrove(grove: GroveFile, rewardPoints: number, mode: ShopMode, checkoutUrl?: string): GroveView {
  const file = normalizeGrove(grove)
  const points = clampCount(rewardPoints, SUN_CAP)
  const grown = stageFor(file.watered)
  const pendingSun = Math.max(0, points - file.gathered)
  const view: GroveView = {
    sun: file.sun,
    watered: file.watered,
    stage: grown.stage,
    level: grown.level,
    levelCount: GROVE_STAGES.length,
    poursIntoLevel: grown.poursIntoLevel,
    poursToNext: grown.poursToNext,
    pourCost: POUR_COST,
    pendingSun,
    tapSun: Math.min(SUN_PER_TAP, pendingSun),
    blossoms: grown.blossoms,
    rewardPoints: points,
    shop: mode,
    packs: SUN_PACKS.map((pack) => ({ id: pack.id, sun: pack.sun, cents: pack.cents })),
  }
  if (checkoutUrl) view.checkoutUrl = checkoutUrl
  return view
}

export function takeSun(grove: GroveFile, rewardPoints: number): { grove: GroveFile; took: number } | { error: string } {
  const file = normalizeGrove(grove)
  const pending = Math.max(0, clampCount(rewardPoints, SUN_CAP) - file.gathered)
  const took = Math.min(SUN_PER_TAP, pending)
  if (took < 1) return { error: "No sun to collect." }
  return {
    took,
    grove: { ...file, sun: Math.min(SUN_CAP, file.sun + took), gathered: file.gathered + took },
  }
}

export function pourWater(grove: GroveFile): { grove: GroveFile } | { error: string } {
  const file = normalizeGrove(grove)
  if (file.sun < POUR_COST) return { error: "Not enough sun to pour." }
  if (file.watered >= WATER_CAP) return { error: "This tree cannot take more water." }
  return { grove: { ...file, sun: file.sun - POUR_COST, watered: file.watered + 1 } }
}

export function creditPack(grove: GroveFile, pack: SunPack, paymentId: string): { grove: GroveFile } | { error: string } {
  const file = normalizeGrove(grove)
  if (!ID_TEXT.test(paymentId)) return { error: "That payment could not be recorded." }
  if (file.credited.includes(paymentId)) {
    return { grove: { ...file, pending: file.pending === paymentId ? null : file.pending } }
  }
  if (file.credited.length >= 500) return { error: "The shop ledger for this file is full." }
  return {
    grove: {
      ...file,
      sun: Math.min(SUN_CAP, file.sun + pack.sun),
      credited: [...file.credited, paymentId],
      pending: file.pending === paymentId ? null : file.pending,
    },
  }
}
