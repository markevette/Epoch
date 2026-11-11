import { clamp } from "./score"

export type BmiBand = "under" | "usual" | "over" | "high"

export const BMI_BAND_LABEL: Record<BmiBand, string> = {
  under: "Under the usual adult band",
  usual: "Inside the usual adult band",
  over: "Above the usual adult band",
  high: "Well above the usual adult band",
}

/** Avery’s file. 165 cm and 62 kg land near 22.8. */
export const DEMO_HEIGHT_CM = 165
export const DEMO_WEIGHT_KG = 62

/** A workable adult start when a file has no measurements yet. */
export const DEFAULT_HEIGHT_CM = 170
export const DEFAULT_WEIGHT_KG = 70

export function bmi(heightCm: number, weightKg: number): number {
  const meters = heightCm / 100
  if (!Number.isFinite(meters) || meters <= 0) return 0
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 0
  return weightKg / (meters * meters)
}

export function bmiBand(value: number): BmiBand {
  if (value < 18.5) return "under"
  if (value < 25) return "usual"
  if (value < 30) return "over"
  return "high"
}

export function normalizeBody(
  heightCm: number | undefined,
  weightKg: number | undefined,
  demo = false,
): { heightCm: number; weightKg: number } {
  const heightFallback = demo ? DEMO_HEIGHT_CM : DEFAULT_HEIGHT_CM
  const weightFallback = demo ? DEMO_WEIGHT_KG : DEFAULT_WEIGHT_KG
  const height = typeof heightCm === "number" && Number.isFinite(heightCm) ? heightCm : heightFallback
  const weight = typeof weightKg === "number" && Number.isFinite(weightKg) ? weightKg : weightFallback
  return {
    heightCm: Math.round(clamp(height, 140, 220)),
    weightKg: Math.round(clamp(weight, 35, 220) * 10) / 10,
  }
}
