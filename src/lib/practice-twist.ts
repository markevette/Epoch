import type { Locale } from "./locale"
import type { PracticeTrack } from "./practice-lessons"

export function daySeed(today: string, id: string): number {
  let n = 0
  for (const ch of `${today}:${id}`) n = (n * 33 + ch.charCodeAt(0)) >>> 0
  return n
}

const TWIST: Record<Locale, Record<PracticeTrack, { action: string; done: string }[]>> = {
  en: {
    sleep: [
      { action: "Today the gap is 20 minutes, not 30.", done: "The 20-minute gap is the one that counted." },
      { action: "If you woke late, do not push tomorrow later to make up for it.", done: "Tomorrow was not pushed later to compensate." },
      { action: "Write the alarm time down before you set it.", done: "The alarm time was written down, then set." },
      { action: "Hold the same wake even if bedtime slips.", done: "The wake stayed put even if bedtime slipped." },
    ],
    movement: [
      { action: "Do it before you sit down again.", done: "It happened before the next sit." },
      { action: "Today the block is 8 minutes.", done: "The 8-minute block is done." },
      { action: "If you skip, the failure is sitting through the next hour without standing.", done: "The next hour was not sat through without standing." },
      { action: "Count the minutes out loud once at the end.", done: "The minutes were counted out loud once." },
    ],
    nutrition: [
      { action: "The next meal is the only window. Not a snack after.", done: "The next meal was the window. No extra snack after." },
      { action: "If you already missed it, the failure is a second miss today, not the first.", done: "There was no second miss today." },
      { action: "Put a glass of water down before the plate.", done: "Water was down before the plate." },
      { action: "Leave the extra sweet, even if the rest of the meal stays the same.", done: "The extra sweet stayed off." },
    ],
    stress: [
      { action: "Do it before you open messages again.", done: "It happened before the next messages." },
      { action: "Today three rounds, then stop.", done: "Three rounds, then stop." },
      { action: "If it fails, the failure is stacking a fourth thing, not skipping.", done: "A fourth thing was not stacked on." },
      { action: "Stay off the extra tab until this is done.", done: "The extra tab stayed closed until this was done." },
    ],
  },
  de: {
    sleep: [
      { action: "Heute sind es 20 Minuten Abstand, nicht 30.", done: "Der 20-Minuten-Abstand hat gezählt." },
      { action: "Wenn du spät aufgewacht bist, schieb morgen nicht später, um das auszugleichen.", done: "Morgen wurde nicht später geschoben, um auszugleichen." },
      { action: "Schreib die Weckerzeit auf, bevor du ihn stellst.", done: "Die Weckerzeit stand da, dann wurde gestellt." },
      { action: "Halt dieselbe Aufstehzeit, auch wenn die Schlafenszeit rutscht.", done: "Die Aufstehzeit blieb, auch wenn die Schlafenszeit rutschte." },
    ],
    movement: [
      { action: "Mach es, bevor du dich wieder setzt.", done: "Es war erledigt, bevor das nächste Sitzen kam." },
      { action: "Heute sind es 8 Minuten.", done: "Der 8-Minuten-Block ist erledigt." },
      { action: "Wenn du es lässt, ist das Scheitern die nächste Stunde sitzen ohne aufzustehen.", done: "Die nächste Stunde war nicht ohne Aufstehen durchgesessen." },
      { action: "Zähl die Minuten am Ende einmal laut.", done: "Die Minuten wurden einmal laut gezählt." },
    ],
    nutrition: [
      { action: "Die nächste Mahlzeit ist das einzige Fenster. Kein Snack danach.", done: "Die nächste Mahlzeit war das Fenster. Kein Extra-Snack danach." },
      { action: "Wenn du es schon verpasst hast, ist das Scheitern ein zweites Mal heute, nicht das erste.", done: "Es gab kein zweites Mal heute." },
      { action: "Stell ein Glas Wasser hin, bevor der Teller kommt.", done: "Wasser stand vor dem Teller." },
      { action: "Lass das extra Süße, auch wenn der Rest der Mahlzeit gleich bleibt.", done: "Das extra Süße blieb weg." },
    ],
    stress: [
      { action: "Mach es, bevor du wieder Nachrichten öffnest.", done: "Es war erledigt, bevor die nächsten Nachrichten kamen." },
      { action: "Heute drei Runden, dann Schluss.", done: "Drei Runden, dann Schluss." },
      { action: "Wenn es scheitert, ist das Scheitern eine vierte Sache obendrauf, nicht das Auslassen.", done: "Eine vierte Sache kam nicht obendrauf." },
      { action: "Lass den extra Tab zu, bis das erledigt ist.", done: "Der extra Tab blieb zu, bis das erledigt war." },
    ],
  },
}

export function todayTwist(locale: Locale, track: PracticeTrack, today: string, id: string): { action: string; done: string } {
  const options = TWIST[locale][track]
  return options[daySeed(today, id) % options.length] ?? options[0]!
}
