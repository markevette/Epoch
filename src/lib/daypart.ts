export type Daypart = "morning" | "day" | "night"

/** Local hours. Morning is 05:00–11:59, day is 12:00–17:59, night is 18:00–04:59. */
export const MORNING_START = 5
export const DAY_START = 12
export const NIGHT_START = 18

export const DAYPART_LABEL: Record<Daypart, string> = {
  morning: "Morning",
  day: "Day",
  night: "Night",
}

export const DAYPART_NOTE: Record<Daypart, string> = {
  morning: "Lit for a start.",
  day: "The board is open.",
  night: "Dimmed for the evening.",
}

export function daypartFromHour(hour: number): Daypart {
  if (hour >= MORNING_START && hour < DAY_START) return "morning"
  if (hour >= DAY_START && hour < NIGHT_START) return "day"
  return "night"
}

export function daypart(date: Date): Daypart {
  return daypartFromHour(date.getHours())
}

export function daypartPreview(value: string | null): Daypart | null {
  if (value === "morning" || value === "day" || value === "night") return value
  return null
}

/** Runs before paint so the first frame matches the device clock. */
export const DAYPART_BOOT = `(function(){try{var s=sessionStorage.getItem("epoch.daypart");if(s==="morning"||s==="day"||s==="night"){document.documentElement.dataset.daypart=s;return;}}catch(e){}var h=new Date().getHours();var p=h>=${MORNING_START}&&h<${DAY_START}?"morning":h>=${DAY_START}&&h<${NIGHT_START}?"day":"night";document.documentElement.dataset.daypart=p;})();`
