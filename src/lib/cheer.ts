import type { Locale } from "./locale"

export const CHEER_KINDS = ["task", "check-in", "pour", "sun", "line", "level"] as const

export type CheerKind = (typeof CHEER_KINDS)[number]

export function isCheerKind(value: unknown): value is CheerKind {
  return typeof value === "string" && (CHEER_KINDS as readonly string[]).includes(value)
}

const LINES: Record<CheerKind, { en: { title: string; body: string }; de: { title: string; body: string } }> = {
  task: {
    en: { title: "That door is done.", body: "Today’s action is on the file." },
    de: { title: "Diese Tür ist geschafft.", body: "Die Handlung von heute liegt auf der Akte." },
  },
  "check-in": {
    en: { title: "Checked in.", body: "The day has a mark." },
    de: { title: "Eingecheckt.", body: "Der Tag hat eine Markierung." },
  },
  pour: {
    en: { title: "The tree took the water.", body: "That pour stays on this level." },
    de: { title: "Der Baum hat das Wasser genommen.", body: "Dieser Guss bleibt auf dieser Stufe." },
  },
  sun: {
    en: { title: "Sun is in the can.", body: "You can pour it when you are ready." },
    de: { title: "Die Sonne ist in der Kanne.", body: "Du kannst sie gießen, wenn du soweit bist." },
  },
  line: {
    en: { title: "The line is sent.", body: "Your buddy can read it on the pair." },
    de: { title: "Die Zeile ist raus.", body: "Dein Buddy kann sie am Paar lesen." },
  },
  level: {
    en: { title: "The tree grew a level.", body: "That pour opened the next stage." },
    de: { title: "Der Baum ist eine Stufe gewachsen.", body: "Dieser Guss hat die nächste Stufe geöffnet." },
  },
}

export function cheerLine(locale: Locale, kind: CheerKind): { title: string; body: string } {
  return LINES[kind][locale]
}

export function raiseCheer(kind: CheerKind): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("epoch-cheer", { detail: { kind } }))
}
