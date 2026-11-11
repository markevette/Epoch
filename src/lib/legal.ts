export type LegalOperator = {
  name: string | null
  street: string | null
  postalCode: string | null
  city: string | null
  country: string
  email: string | null
  complete: boolean
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed.slice(0, 160) : null
}

export function legalOperator(env: Record<string, string | undefined> = process.env): LegalOperator {
  const name = clean(env.EPOCH_LEGAL_NAME)
  const street = clean(env.EPOCH_LEGAL_STREET)
  const postalCode = clean(env.EPOCH_LEGAL_POSTAL)
  const city = clean(env.EPOCH_LEGAL_CITY)
  const country = clean(env.EPOCH_LEGAL_COUNTRY) ?? "Germany"
  const email = clean(env.EPOCH_LEGAL_EMAIL)
  return {
    name,
    street,
    postalCode,
    city,
    country,
    email,
    complete: Boolean(name && street && postalCode && city && email),
  }
}

export function cleanConsentAt(value: unknown, now = Date.now()): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return null
  const time = Date.parse(value)
  if (!Number.isFinite(time) || time > now + 5 * 60 * 1000) return null
  return new Date(time).toISOString()
}
