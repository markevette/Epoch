import { PUBLIC_CLAIMS } from "./claims"
import type { DailyTip } from "./tip"
import type { Recommendation } from "./interventions"
import type { DriverKey, Inputs } from "./types"
import type { Locale } from "./locale"
import { GOALS } from "./personas"
import type { BmiBand } from "./body"
import type { ScoreTone } from "./score-week"
import type { MealName } from "./meals"
import type { Sex } from "./types"

const en = {
  nav: { today: "Today", buddies: "Buddies", board: "Board", share: "Share", practice: "Practice", signOut: "Sign out", signIn: "Sign in" },
  home: {
    kicker: "Closed beta · a daily score, practice, and buddies",
    title: "The next habit, from the day you just logged.",
    continue: "Continue",
    signIn: "Sign in",
    create: "Create an account",
    staff: "Staff console",
    yourDay: "Your day",
    note: "This beta is invite only. Sign in if you already have a file.",
    sample: "A sample day",
    dailyScore: "Daily score",
    score: "Score",
    practice: "Practice",
    buddies: "Buddies",
  },
  login: {
    kicker: "Sign in",
    title: "Your day is behind this door.",
    body: "Use the email and password for your account. If you cannot open the door, request a reset.",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    create: "Create account",
    forgot: "Forgot password",
  },
  join: {
    kicker: "Closed beta",
    title: "Open a file in your name.",
    body: "This beta needs an invite. Use at least 8 characters for the password.",
    name: "Name",
    email: "Email",
    password: "Password",
    invite: "Invite",
    submit: "Create account",
    signIn: "Sign in",
  },
  footer: { imprint: "Imprint", privacy: "Privacy", terms: "Terms" },
  lang: "Language",
  claims: [...PUBLIC_CLAIMS] as [string, string, string, string],
}

const de = {
  nav: { today: "Heute", buddies: "Buddies", board: "Tafel", share: "Teilen", practice: "Übung", signOut: "Abmelden", signIn: "Anmelden" },
  home: {
    kicker: "Geschlossene Beta · ein Tageswert, Übung und Buddies",
    title: "Die nächste Gewohnheit, aus dem Tag, den du gerade erfasst hast.",
    continue: "Weiter",
    signIn: "Anmelden",
    create: "Konto anlegen",
    staff: "Mitarbeiterbereich",
    yourDay: "Dein Tag",
    note: "Diese Beta ist nur mit Einladung. Melde dich an, wenn du schon eine Datei hast.",
    sample: "Ein Beispieltag",
    dailyScore: "Tageswert",
    score: "Wert",
    practice: "Übung",
    buddies: "Buddies",
  },
  login: {
    kicker: "Anmelden",
    title: "Dein Tag liegt hinter dieser Tür.",
    body: "Nutze die E-Mail und das Passwort deines Kontos. Wenn die Tür nicht aufgeht, fordere einen Reset an.",
    email: "E-Mail",
    password: "Passwort",
    submit: "Anmelden",
    create: "Konto anlegen",
    forgot: "Passwort vergessen",
  },
  join: {
    kicker: "Geschlossene Beta",
    title: "Öffne eine Datei auf deinen Namen.",
    body: "Diese Beta braucht eine Einladung. Das Passwort braucht mindestens 8 Zeichen.",
    name: "Name",
    email: "E-Mail",
    password: "Passwort",
    invite: "Einladung",
    submit: "Konto anlegen",
    signIn: "Anmelden",
  },
  footer: { imprint: "Impressum", privacy: "Datenschutz", terms: "AGB" },
  lang: "Sprache",
  claims: [
    "Ein Tageswert aus Schlaf, Fitness, Essen und Stress.",
    "Übung öffnet vier Türen am Tag. Eine neue Übung auf jedem Zweig einmal in der Woche.",
    "Buddies führen eine Morgenzählung. Belohnungspunkte öffnen bei je 150 Punkten einen weiteren Buddy.",
    "Eine geschlossene Beta. Eine Wellness-Akte zur Orientierung. Eine Ärztin oder ein Arzt stellt Diagnosen und behandelt. Es gibt noch keinen Store-Eintrag.",
  ] as [string, string, string, string],
}

export function copy(locale: Locale) {
  return locale === "de" ? de : en
}

export function pick(locale: Locale, english: string, german: string): string {
  return locale === "de" ? german : english
}

const DRIVERS: Record<Locale, Record<DriverKey, string>> = {
  en: {
    sleep: "Sleep",
    hrv: "Heart-rate variability",
    restingHr: "Resting heart rate",
    activity: "Activity",
    nutrition: "Nutrition",
    stress: "Stress load",
  },
  de: {
    sleep: "Schlaf",
    hrv: "Herzfrequenzvariabilität",
    restingHr: "Ruheherzfrequenz",
    activity: "Bewegung",
    nutrition: "Ernährung",
    stress: "Stresslast",
  },
}

export function driverLabel(locale: Locale, key: DriverKey): string {
  return DRIVERS[locale][key]
}

export function driverNote(locale: Locale, key: DriverKey, inputs: Inputs, age: number, hrvTarget: number): string {
  if (locale === "de") {
    if (key === "sleep") return `${inputs.sleepHours.toFixed(1)} h · Regelmäßigkeit ${inputs.sleepConsistency.toFixed(0)}/10`
    if (key === "hrv") return `${Math.round(inputs.hrv)} ms · Ziel nahe ${Math.round(hrvTarget)} ms mit ${Math.round(age)} Jahren`
    if (key === "restingHr") return `${Math.round(inputs.restingHr)} bpm`
    if (key === "activity") return `${Math.round(inputs.steps).toLocaleString("de-DE")} Schritte · ${Math.round(inputs.zone2Minutes)} Min. lockeres Cardio · ${inputs.strengthSessions.toFixed(0)} Kraft`
    if (key === "nutrition") return `Protein ${inputs.protein.toFixed(0)}/10 · Ballaststoffe ${inputs.fiber.toFixed(0)}/10 · ${inputs.alcoholPerWeek.toFixed(0)} Getränke`
    return `Gefühlte Last ${inputs.stress.toFixed(1)}/10`
  }
  if (key === "sleep") return `${inputs.sleepHours.toFixed(1)} h · consistency ${inputs.sleepConsistency.toFixed(0)}/10`
  if (key === "hrv") return `${Math.round(inputs.hrv)} ms · target near ${Math.round(hrvTarget)} ms at age ${Math.round(age)}`
  if (key === "restingHr") return `${Math.round(inputs.restingHr)} bpm`
  if (key === "activity") return `${Math.round(inputs.steps).toLocaleString("en-GB")} steps · ${Math.round(inputs.zone2Minutes)} min easy cardio · ${inputs.strengthSessions.toFixed(0)} strength`
  if (key === "nutrition") return `Protein ${inputs.protein.toFixed(0)}/10 · fiber ${inputs.fiber.toFixed(0)}/10 · ${inputs.alcoholPerWeek.toFixed(0)} drinks`
  return `Perceived load ${inputs.stress.toFixed(1)}/10`
}

const CONFIDENCE: Record<string, string> = {
  "Limited file": "Dünne Akte",
  "Growing file": "Wachsende Akte",
  "Substantial file": "Dichte Akte",
}

export function confidenceText(locale: Locale, label: string): string {
  return locale === "de" ? CONFIDENCE[label] ?? label : label
}

const BMI: Record<Locale, Record<BmiBand, string>> = {
  en: {
    under: "Under the usual adult band",
    usual: "Inside the usual adult band",
    over: "Above the usual adult band",
    high: "Well above the usual adult band",
  },
  de: {
    under: "Unter dem üblichen Erwachsenenbereich",
    usual: "Im üblichen Erwachsenenbereich",
    over: "Über dem üblichen Erwachsenenbereich",
    high: "Deutlich über dem üblichen Erwachsenenbereich",
  },
}

export function bmiText(locale: Locale, band: BmiBand): string {
  return BMI[locale][band]
}

const ACTIONS: Record<string, { title: string; detail: string; cadence: string }> = {
  "sleep-window": {
    title: "Ein Schlaffenster von 7,5 Stunden halten",
    detail: "Zuerst die Aufstehzeit setzen, 7,5 Stunden zurückzählen und Koffein acht Stunden vor dem Licht auslassen.",
    cadence: "Jede Nacht diese Woche",
  },
  "sleep-anchor": {
    title: "Die Aufstehzeit innerhalb von 30 Minuten halten",
    detail: "Dieselbe Aufstehzeit am Wochenende. Licht in der ersten Stunde tut der Regelmäßigkeit mehr als ein späteres Zubettgehen.",
    cadence: "Sieben Morgen",
  },
  "sleep-long": {
    title: "Die Zeit im Bett kürzen",
    detail: "Mehr als neun Stunden im Bett zerteilen den Schlaf oft. Eine feste Aufstehzeit schlägt den Versuch, länger zu schlafen.",
    cadence: "Diese Woche",
  },
  "hrv-downshift": {
    title: "Zehn ruhige Minuten vor dem Schlaf",
    detail: "Nasenatmung, etwa vier Sekunden ein und sechs Sekunden aus. Das ist ein Herunterfahren, kein Training.",
    cadence: "Fünf Abende",
  },
  zone2: {
    title: "Zwei lockere Cardio-Einheiten von 40 Minuten",
    detail: "Gesprächstempo. Du solltest in ganzen Sätzen sprechen können. Nasenatmung ist ein brauchbarer Begrenzer, wenn sie dir liegt.",
    cadence: "Diese Woche",
  },
  "steps-walk": {
    title: "Ein Spaziergang von 20 Minuten nach der größten Mahlzeit",
    detail: "An vier Tagen dieser Woche. Es geht um den Gang, nicht um ein Schrittziel auf der Uhr.",
    cadence: "Vier Tage",
  },
  strength: {
    title: "Zwei kurze Krafteinheiten",
    detail: "Kniebeuge, Hüftbeuge, Drücken, Ziehen. Dreißig bis vierzig Minuten reichen. Ein Tag Pause dazwischen.",
    cadence: "Zweimal diese Woche",
  },
  protein: {
    title: "Eine Handfläche Protein auf jede Mahlzeit",
    detail: "Eier, Fisch, Joghurt, Tofu, Fleisch oder ein Shake. Über den Tag verteilen, statt alles ins Abendessen zu legen.",
    cadence: "Diese Woche",
  },
  fiber: {
    title: "Eine Tasse Bohnen, Linsen oder Hafer dazu",
    detail: "Einmal am Tag. Wenn der Darm Ballaststoffe nicht gewohnt ist, mit einer halben Tasse beginnen und Wasser dazu trinken.",
    cadence: "Täglich",
  },
  alcohol: {
    title: "Alkohol diese Woche auf vier Getränke begrenzen",
    detail: "Schlaf und Herzfrequenzvariabilität merken das meist nach wenigen Nächten. Das ist ein Versuch, keine Lebensregel.",
    cadence: "Diese Woche",
  },
  sugar: {
    title: "Das süßeste tägliche Getränk tauschen",
    detail: "Wasser, Sprudel oder ungesüßter Tee statt des einen Getränks, das du jeden Tag hast.",
    cadence: "Täglich",
  },
  "stress-walk": {
    title: "Ein Spaziergang von 20 Minuten ohne Telefon",
    detail: "Vier Tage. Kein Podcast. Die Last bewegt sich, wenn das Nervensystem wirklich einen ruhigen Reiz bekommt, nicht noch einen produktiven.",
    cadence: "Vier Tage",
  },
  shutdown: {
    title: "Fünf Minuten Abschluss am Ende der Arbeit",
    detail: "Die erste Aufgabe für morgen aufschreiben, den Rechner schließen und den Raum verlassen. Kurz, damit es eine schlechte Woche übersteht.",
    cadence: "Jeden Arbeitstag",
  },
}

export function presentAction(locale: Locale, item: Recommendation): Recommendation {
  if (locale === "en") return item
  const next = ACTIONS[item.id]
  return next ? { ...item, ...next } : item
}

const TIPS: Record<string, { subject?: string; title: string; body: string }> = {
  "Keep tomorrow’s wake time close to today’s": {
    title: "Die Aufstehzeit von morgen nah an der von heute halten",
    body: "Der Wert bewegt sich mehr durch eine Woche, die hält, als durch eine lange Nacht. Das Wochenende innerhalb einer Stunde vom Wecker unter der Woche lassen.",
  },
  "Dim the last hour": {
    title: "Die letzte Stunde abdunkeln",
    body: "Bildschirme in der letzten Stunde halten den Tag wach. Ein dunkler Raum ist eine kleinere Änderung als eine neue Matratze, und die Akte sieht den Schlaf danach.",
  },
  "An early evening beats a late nap": {
    title: "Ein früher Abend schlägt ein spätes Nickerchen",
    body: "Nach einer kurzen Nacht ist das frühere Licht-aus der nützliche Zug. Ein langes Nickerchen, das die Schlafenszeit nach hinten schiebt, gibt den nächsten Morgen meist zurück.",
  },
  "Give the nervous system an easy day": {
    title: "Dem Nervensystem einen leichten Tag geben",
    body: "Die Herzfrequenzvariabilität mag Belastung, von der sich der Körper erholt. Ein Spaziergang zählt. Eine zweite harte Einheit an einem müden Morgen oft nicht.",
  },
  "Two quiet minutes before the inbox": {
    title: "Zwei ruhige Minuten vor dem Postfach",
    body: "Der Morgenwert ist die Folge der Nacht und der ersten Stunde. Ein ruhiger Start ist ein echter Eintrag, auch wenn der Rest des Tages voll ist.",
  },
  "Check the morning after a drink": {
    title: "Den Morgen nach einem Getränk ansehen",
    body: "Alkohol zeigt sich oft in der Variabilität des nächsten Morgens, bevor er sonst irgendwo auftaucht. Die Zahl ansehen und dann über den nächsten Abend entscheiden.",
  },
  "Use the morning number": {
    title: "Die Morgenzahl nehmen",
    body: "Die Ruheherzfrequenz ist ein Morgenwert. Eine Zahl nach Kaffee oder nach der Treppe macht die Akte lauter, als du bist.",
  },
  "A hot room and a late meal both lift it": {
    title: "Ein heißer Raum und eine späte Mahlzeit heben sie beide",
    body: "Die Nacht eintragen, die du wirklich hattest. Hitze und ein schweres Abendessen können die Morgenfrequenz heben, ohne dass sich die Fitness ändert.",
  },
  "A lower rate is a month of easy work": {
    title: "Eine niedrigere Frequenz ist ein Monat leichter Arbeit",
    body: "Lockeres Cardio über den Monat bewegt das mehr als eine intensive Stunde. Der Plan reiht die Woche schon.",
  },
  "Add ten minutes you will repeat": {
    title: "Zehn Minuten dazunehmen, die du wiederholst",
    body: "Der nächste nützliche Block ist ein kurzer Gang, der morgen wieder stattfindet. Der Wert belohnt keinen Plan, den du nur einmal machst.",
  },
  "Two short strength sessions beat a program in the notes": {
    title: "Zwei kurze Krafteinheiten schlagen ein Programm in den Notizen",
    body: "Die Einheiten klein genug halten, dass sie bleiben. Die Wochenzahl ist das, was der Bewegungsfaktor liest.",
  },
  "Walk between the long sits": {
    title: "Zwischen langem Sitzen gehen",
    body: "Ein paar Minuten zwischen Sitzblöcken ändern den Tag mehr, als alle Schritte für den Abend aufzusparen.",
  },
  "Put protein on the meal you usually skip": {
    title: "Protein auf die Mahlzeit legen, die du sonst auslässt",
    body: "Eine handtellergroße Portion bei dieser Mahlzeit tut hier mehr als ein perfekter Tag. Ballaststoffe daneben zählen trotzdem.",
  },
  "Sweets are a pattern, not a confession": {
    title: "Süßes ist ein Muster, kein Geständnis",
    body: "Der Schieber ist das Wie-oft, kein Urteil. Ein Nachtisch in einer ruhigen Woche ist eine andere Akte als ein süßes Getränk jeden Nachmittag.",
  },
  "Count the drinks that happened": {
    title: "Die Getränke zählen, die es gab",
    body: "Alkohol steckt schon im Ernährungswert. Eine ehrliche Woche bewegt die Schätzung mehr, als zwei davon vom Schieber zu lassen.",
  },
  "Shrink one block today": {
    title: "Heute einen Block kleiner machen",
    body: "Ein Meeting, einen Thread oder ein Scrollen wählen, das kleiner werden kann. Die Stresszahl ist das, was du einträgst, also muss die Kürzung im Tag passieren.",
  },
  "Leave the phone for the walk": {
    title: "Das Telefon beim Gehen liegen lassen",
    body: "Zwanzig ruhige Minuten zu Fuß sind dieselbe Art von Handlung, die der Plan mag. Sie zählt für Last und für Schritte.",
  },
  "Name the load before you score it": {
    title: "Die Last benennen, bevor du sie bewertest",
    body: "Eine 6 und eine 8 sind verschiedene Wochen. Wenn die Zahl feststeckt, erst in den Kalender sehen und dann den Schieber bewegen.",
  },
  "The ratio is under the usual adult band": {
    subject: "Body-Mass-Index",
    title: "Das Verhältnis liegt unter dem üblichen Erwachsenenbereich",
    body: "Der BMI ist Gewicht geteilt durch Größe im Quadrat. Er bleibt aus der Rechnung zum biologischen Alter. Wenn Essen schwerfällt, gehört das Gespräch zu einer Ärztin oder einem Arzt.",
  },
  "The ratio is above the usual adult band": {
    subject: "Body-Mass-Index",
    title: "Das Verhältnis liegt über dem üblichen Erwachsenenbereich",
    body: "Der BMI sieht weder Muskel noch Statur. Er steht neben der Altersschätzung. Eine steigende Zahl neben Schritten, Protein und Schlaf lesen.",
  },
  "This BMI is high enough to mention": {
    subject: "Body-Mass-Index",
    title: "Dieser BMI ist hoch genug, um ihn zu erwähnen",
    body: "Die Akte behält die Zahl, damit der Verlauf sichtbar bleibt. Sie ändert das biologische Alter nicht. Eine Ärztin oder ein Arzt entscheidet, ob der Verlauf mehr als Gewohnheiten braucht.",
  },
}

export function presentTip(locale: Locale, tip: DailyTip): DailyTip {
  if (locale === "en") return tip
  const next = TIPS[tip.title]
  if (!next) return tip
  return { subject: next.subject ?? driverSubject(tip.subject), title: next.title, body: next.body }
}

function driverSubject(subject: string): string {
  const match = (Object.keys(DRIVERS.en) as DriverKey[]).find((key) => DRIVERS.en[key] === subject)
  return match ? DRIVERS.de[match] : subject === "Body mass index" ? "Body-Mass-Index" : subject
}

const FLAGS: Record<string, string> = {
  "Under five hours of sleep is more than a coaching problem. If this is typical, talk to a clinician.":
    "Unter fünf Stunden Schlaf ist mehr als ein Coaching-Thema. Wenn das typisch ist, sprich mit einer Ärztin oder einem Arzt.",
  "Resting heart rate is high enough to mention to a clinician, especially if it is new.":
    "Die Ruheherzfrequenz ist hoch genug, um sie einer Ärztin oder einem Arzt zu nennen, besonders wenn sie neu ist.",
  "Resting heart rate is very low. Athletes see this; so do some medical conditions. This model cannot tell them apart.":
    "Die Ruheherzfrequenz ist sehr niedrig. Sportlerinnen und Sportler sehen das, manche Erkrankungen auch. Dieses Modell kann sie nicht unterscheiden.",
  "HbA1c is in a range that needs a clinician, not a wellness plan.":
    "Der HbA1c liegt in einem Bereich, der eine Ärztin oder einen Arzt braucht, keinen Wellness-Plan.",
  "Fasting glucose is in a range that needs a clinician.":
    "Der Nüchternglukosewert liegt in einem Bereich, der eine Ärztin oder einen Arzt braucht.",
  "ApoB at this level is worth a clinical conversation before any supplement experiment.":
    "ApoB auf diesem Niveau gehört in ein ärztliches Gespräch, bevor ein Ergänzungsversuch beginnt.",
  "hs-CRP is high enough that infection, injury, or illness should be ruled out before you treat it as a lifestyle score.":
    "hs-CRP ist hoch genug, dass Infektion, Verletzung oder Krankheit ausgeschlossen werden sollten, bevor du es als Lebensstilwert liest.",
}

export function presentFlag(locale: Locale, flag: string): string {
  return locale === "de" ? FLAGS[flag] ?? flag : flag
}

const NUDGES: Record<string, string> = {
  "down-how": "Die Woche ist gesunken. Wie geht es dir?",
  "down-holding": "Die Werte sind gefallen. Wie hältst du dich?",
  "down-week": "Eine ruhigere Woche. Magst du sagen, wie sie war?",
  "up-keep": "Die Woche steigt. Weiter so.",
  "up-earned": "Dieser Anstieg wirkt verdient. Schöne Woche.",
  "up-cheer": "Die Werte sind oben. Dem nächsten wird zugejubelt.",
  "flat-steady": "Die Woche blieb ruhig. Ich bin da.",
  "flat-pace": "Dasselbe Tempo wie am Wochenanfang. Das zählt.",
}

const NUDGE_EN: Record<string, string> = {
  "The week dipped. How are you doing?": "down-how",
  "Scores turned down. How are you holding up?": "down-holding",
  "A quieter week. Want to say how it went?": "down-week",
  "The week is climbing. Keep going.": "up-keep",
  "That rise looks earned. Nice week.": "up-earned",
  "Scores are up. Cheering the next one.": "up-cheer",
  "The week held steady. Still here.": "flat-steady",
  "Same pace as the start of the week. That counts.": "flat-pace",
}

export function nudgeText(locale: Locale, id: string, english: string): string {
  if (locale === "en") return english
  return NUDGES[id] ?? NUDGES[NUDGE_EN[english] ?? ""] ?? english
}

export function storedNudge(locale: Locale, english: string): string {
  if (locale === "en") return english
  const id = NUDGE_EN[english]
  return id ? NUDGES[id] : english
}

const TONE: Record<Locale, Record<ScoreTone, string>> = {
  en: { up: "Their week is climbing.", down: "Their week turned down.", flat: "Their week held steady." },
  de: { up: "Ihre Woche steigt.", down: "Ihre Woche ist gefallen.", flat: "Ihre Woche blieb ruhig." },
}

export function toneText(locale: Locale, tone: ScoreTone): string {
  return TONE[locale][tone]
}

const GOALS_DE: Record<(typeof GOALS)[number], string> = {
  "Sleep that holds": "Schlaf, der hält",
  "Metabolic health": "Stoffwechsel",
  Strength: "Kraft",
  "A calmer nervous system": "Ein ruhigeres Nervensystem",
  "A longer healthspan": "Eine längere gesunde Zeit",
}

export function goalText(locale: Locale, goal: string): string {
  if (locale === "en") return goal
  return GOALS_DE[goal as (typeof GOALS)[number]] ?? goal
}

export function sexText(locale: Locale, sex: Sex): string {
  const labels = {
    en: { female: "Female", male: "Male", other: "Other" },
    de: { female: "Weiblich", male: "Männlich", other: "Andere" },
  }
  return labels[locale][sex]
}

const MEALS: Record<Locale, Record<MealName, string>> = {
  en: { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" },
  de: { breakfast: "Frühstück", lunch: "Mittagessen", dinner: "Abendessen" },
}

export function mealText(locale: Locale, meal: MealName): string {
  return MEALS[locale][meal]
}

export function translateError(locale: Locale, message: string): string {
  if (locale === "en") return message
  const known: Record<string, string> = {
    "The request failed.": "Die Anfrage ist fehlgeschlagen.",
    "This server could not be reached.": "Dieser Server war nicht erreichbar.",
    "That email and password don’t match.": "E-Mail und Passwort passen nicht.",
    "That email and password don't match.": "E-Mail und Passwort passen nicht.",
    "Use at least 8 characters for the password.": "Nutze mindestens 8 Zeichen für das Passwort.",
    "This request did not come from Epoch.": "Diese Anfrage kam nicht von Epoch.",
    "Sleep is on the file. The morning check-in did not land.": "Der Schlaf liegt auf der Akte. Der Morgen-Check-in ist nicht angekommen.",
    "That check-in stayed closed. The open slot is the one on this device’s clock.": "Dieser Check-in blieb zu. Offen ist das Fenster auf der Uhr dieses Geräts.",
    "Those calories stayed off the file. The card only takes meals this clock has reached.": "Diese Kalorien sind nicht auf der Akte. Die Karte nimmt nur Mahlzeiten, die diese Uhr schon erreicht hat.",
    "That workout stayed off the file. The question follows this device’s clock.": "Dieses Training ist nicht auf der Akte. Die Frage folgt der Uhr dieses Geräts.",
    "The file is still here.": "Die Akte ist noch da.",
    "Buddies could not be loaded.": "Buddies konnten nicht geladen werden.",
    "That did not land.": "Das ist nicht angekommen.",
    "No such ID exists.": "Diese ID gibt es nicht.",
    "This week could not be opened.": "Diese Woche ließ sich nicht öffnen.",
    "That line did not send.": "Diese Zeile ist nicht rausgegangen.",
    "That skill stayed locked. Today’s quest is the open one.": "Diese Übung blieb zu. Diese Sparte hat die Übung von heute schon.",
    "That skill stayed locked. This branch already has today’s lesson.": "Diese Übung blieb zu. Diese Sparte hat die Übung von heute schon.",
    "The pairs could not be loaded.": "Die Paare konnten nicht geladen werden.",
    "This link is no longer open.": "Dieser Link ist nicht mehr offen.",
    "Choose a picture.": "Wähle ein Bild.",
    "That picture is too large.": "Dieses Bild ist zu groß.",
    "That picture could not be read.": "Dieses Bild ließ sich nicht lesen.",
    "Wait a minute and try again.": "Warte eine Minute und versuche es erneut.",
  }
  return known[message] ?? translateReason(locale, message)
}

export function translateReason(locale: Locale, reason: string): string {
  if (locale === "en") return reason
  if (reason === "This is your code.") return "Das ist dein Code."
  if (reason === "No such ID exists.") return "Diese ID gibt es nicht."
  const waiting = reason.match(/^Waiting for (.+) to accept\.$/)
  if (waiting) return `Warten, bis ${waiting[1]} annimmt.`
  const already = reason.match(/^You already keep mornings with (.+)\.$/)
  if (already) return `Du hältst die Morgen schon mit ${already[1]}.`
  const asked = reason.match(/^(.+) has already asked you\.$/)
  if (asked) return `${asked[1]} hat dich schon gefragt.`
  const mine = reason.match(/^You already have (\d+) pairs\.$/)
  if (mine) return `Du hast schon ${mine[1]} Paare.`
  const theirs = reason.match(/^(.+) already has (\d+) pairs\.$/)
  if (theirs) return `${theirs[1]} hat schon ${theirs[2]} Paare.`
  return reason
}
