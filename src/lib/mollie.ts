import type { SunPack } from "./grove"

const PAYMENTS = "https://api.mollie.com/v2/payments"
const PAYMENT_ID = /^tr_[A-Za-z0-9]+$/

export type MolliePayment = {
  id: string
  status: string
  checkoutUrl: string | null
  userId: string
  pack: string
  cents: number | null
  currency: string
}

export function eurValue(cents: number): string {
  const whole = Math.floor(cents / 100)
  const part = String(cents % 100).padStart(2, "0")
  return `${whole}.${part}`
}

export function centsFromValue(value: unknown): number | null {
  if (typeof value !== "string") return null
  const match = /^(\d+)\.(\d{2})$/.exec(value)
  if (!match) return null
  return Number(match[1]) * 100 + Number(match[2])
}

/** Only a Mollie-hosted checkout page may be opened from a payment response. */
export function allowedCheckout(value: unknown): string | null {
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return null
    if (url.hostname !== "www.mollie.com" && url.hostname !== "mollie.com") return null
    return url.toString()
  } catch {
    return null
  }
}

export function paymentIdOk(id: string): boolean {
  return PAYMENT_ID.test(id) && id.length <= 40
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  return value as Record<string, unknown>
}

export async function createMolliePayment(args: {
  pack: SunPack
  redirectUrl: string
  userId: string
  key: string
  fetchImpl?: typeof fetch
}): Promise<{ id: string; checkoutUrl: string } | { error: string }> {
  const key = args.key.trim()
  if (!key) return { error: "The shop could not open checkout." }
  const call = args.fetchImpl ?? fetch
  let response: Response
  try {
    response = await call(PAYMENTS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: { currency: "EUR", value: eurValue(args.pack.cents) },
        description: `Epoch sun, ${args.pack.id}`,
        redirectUrl: args.redirectUrl,
        metadata: { userId: args.userId, pack: args.pack.id },
      }),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return { error: "The shop could not open checkout." }
  }
  const body = record(await response.json().catch(() => null))
  if (!response.ok || !body) return { error: "The shop could not open checkout." }
  const id = body.id
  const links = record(body._links)
  const checkout = links ? record(links.checkout) : null
  const checkoutUrl = allowedCheckout(checkout?.href)
  if (typeof id !== "string" || !paymentIdOk(id) || !checkoutUrl) return { error: "The shop could not open checkout." }
  return { id, checkoutUrl }
}

export async function readMolliePayment(args: {
  id: string
  key: string
  fetchImpl?: typeof fetch
}): Promise<MolliePayment | null> {
  if (!paymentIdOk(args.id) || !args.key.trim()) return null
  const call = args.fetchImpl ?? fetch
  let response: Response
  try {
    response = await call(`${PAYMENTS}/${args.id}`, {
      headers: { Authorization: `Bearer ${args.key.trim()}` },
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return null
  }
  const body = record(await response.json().catch(() => null))
  if (!response.ok || !body || body.id !== args.id || typeof body.status !== "string") return null
  const amount = record(body.amount)
  const metadata = record(body.metadata)
  const links = record(body._links)
  const checkout = links ? record(links.checkout) : null
  return {
    id: args.id,
    status: body.status,
    checkoutUrl: allowedCheckout(checkout?.href),
    userId: typeof metadata?.userId === "string" ? metadata.userId : "",
    pack: typeof metadata?.pack === "string" ? metadata.pack : "",
    cents: centsFromValue(amount?.value),
    currency: typeof amount?.currency === "string" ? amount.currency : "",
  }
}
