export function isoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

export function formatLongDate(iso: string, locale: "en" | "de" = "en"): string {
  return parseIsoDate(iso).toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

export function formatYears(delta: number, locale: "en" | "de" = "en"): string {
  const magnitude = Math.abs(delta)
  if (magnitude < 0.05) return locale === "de" ? "Im Rahmen des chronologischen Alters" : "In line with chronological age"
  const label = magnitude.toFixed(1)
  if (locale === "de") {
    const unit = magnitude >= 1.05 ? "Jahre" : "Jahr"
    return delta < 0 ? `${label} ${unit} jünger` : `${label} ${unit} älter`
  }
  const unit = magnitude >= 1.05 ? "years" : "year"
  return delta < 0 ? `${label} ${unit} younger` : `${label} ${unit} older`
}

export function formatSigned(value: number, digits = 1, suffix = ""): string {
  const rounded = value.toFixed(digits)
  if (value > 0.0001) return `+${rounded}${suffix}`
  return `${rounded}${suffix}`
}

export function formatEur(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export function toHandle(name: string): string {
  const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16)
  return handle || "member"
}

export function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
