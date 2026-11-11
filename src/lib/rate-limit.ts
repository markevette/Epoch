import { randomUUID } from "crypto"
import { qget, qrun, qtx } from "./sql"

export const RATE_LIMIT_NOTICE = "Wait a minute and try again."
export const QUARTER_HOUR_MS = 15 * 60 * 1000
export const HOUR_MS = 60 * 60 * 1000

export async function takeRateLimit(bucket: string, key: string, max: number, windowMs: number, now = Date.now()): Promise<boolean> {
  const since = new Date(now - windowMs).toISOString()
  const at = new Date(now).toISOString()
  const hitKey = key.slice(0, 160)
  return qtx(async () => {
    await qrun("DELETE FROM rate_hits WHERE bucket = ? AND hit_key = ? AND hit_at <= ?", bucket, hitKey, since)
    const row = await qget<{ n: number | string }>(
      "SELECT COUNT(*) AS n FROM rate_hits WHERE bucket = ? AND hit_key = ? AND hit_at > ?",
      bucket,
      hitKey,
      since,
    )
    if (Number(row?.n ?? 0) >= max) return false
    await qrun("INSERT INTO rate_hits (id, bucket, hit_key, hit_at) VALUES (?, ?, ?, ?)", randomUUID(), bucket, hitKey, at)
    return true
  })
}

export async function refuseIfLimited(
  buckets: { name: string; key: string; max: number; windowMs: number }[],
): Promise<Response | null> {
  for (const item of buckets) {
    if (!item.key) continue
    if (!(await takeRateLimit(item.name, item.key, item.max, item.windowMs))) {
      return Response.json({ error: RATE_LIMIT_NOTICE }, { status: 429 })
    }
  }
  return null
}
