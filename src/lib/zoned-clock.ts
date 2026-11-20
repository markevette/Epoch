export function cleanTimeZone(value: unknown): string | null {
  if (typeof value !== "string") return null
  const zone = value.trim()
  if (!zone || zone.length > 80) return null
  try {
    Intl.DateTimeFormat("en-US", { timeZone: zone }).format(0)
    return zone
  } catch {
    return null
  }
}

function wallParts(now: Date, timeZone: string) {
  const bag: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now)) {
    if (part.type !== "literal") bag[part.type] = part.value
  }
  return {
    year: bag.year ?? "1970",
    month: bag.month ?? "01",
    day: bag.day ?? "01",
    hour: bag.hour === "24" ? "00" : (bag.hour ?? "00"),
    minute: bag.minute ?? "00",
  }
}

/** The calendar day and minute in that time zone. */
export function zonedClock(now: Date, timeZone: string): { date: string; minutes: number } {
  const wall = wallParts(now, timeZone)
  return {
    date: `${wall.year}-${wall.month}-${wall.day}`,
    minutes: Number(wall.hour) * 60 + Number(wall.minute),
  }
}

/** Same sign as Date#getTimezoneOffset: Berlin in winter is -60. */
export function zonedOffsetMinutes(now: Date, timeZone: string): number {
  const wall = wallParts(now, timeZone)
  const asUtc = Date.UTC(Number(wall.year), Number(wall.month) - 1, Number(wall.day), Number(wall.hour), Number(wall.minute))
  return Math.round((now.getTime() - asUtc) / 60_000)
}
