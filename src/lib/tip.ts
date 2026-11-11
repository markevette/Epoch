import { bmiBand, type BmiBand } from "./body"
import { hashString } from "./format"
import { DRIVER_LABELS } from "./score"
import type { DriverKey } from "./types"

export type DailyTip = {
  subject: string
  title: string
  body: string
}

const DRIVER_TIPS: Record<DriverKey, { title: string; body: string }[]> = {
  sleep: [
    {
      title: "Keep tomorrow’s wake time close to today’s",
      body: "The score moves more from a week that holds than from one long night. Leave the weekend within an hour of the weekday alarm.",
    },
    {
      title: "Dim the last hour",
      body: "Screens in the last hour keep the day going. A dim room is a smaller change than a new mattress, and the file can see the sleep that follows.",
    },
    {
      title: "An early evening beats a late nap",
      body: "After a short night, the useful move is an earlier lights-out. A long nap that pushes bedtime later usually gives the next morning back.",
    },
  ],
  hrv: [
    {
      title: "Give the nervous system an easy day",
      body: "Heart-rate variability likes effort the body can recover from. A walk counts. A second hard session on a tired morning often does not.",
    },
    {
      title: "Two quiet minutes before the inbox",
      body: "The morning reading is the aftermath of the night and the first hour. A quiet start is a real input, even when the rest of the day is full.",
    },
    {
      title: "Check the morning after a drink",
      body: "Alcohol often shows up in the next morning’s variability before it shows up anywhere else. Notice that number, then decide about the next evening.",
    },
  ],
  restingHr: [
    {
      title: "Use the morning number",
      body: "Resting heart rate is a morning reading. A post-coffee or post-stairs number makes the file noisier than you are.",
    },
    {
      title: "A hot room and a late meal both lift it",
      body: "Log the night you actually had. Heat and a heavy dinner can raise the morning rate without any change in fitness.",
    },
    {
      title: "A lower rate is a month of easy work",
      body: "Easy cardio across the month moves this more than one intense class. The plan already ranks the week.",
    },
  ],
  activity: [
    {
      title: "Add ten minutes you will repeat",
      body: "The next useful block is a short walk that happens again tomorrow. The score does not award a plan you only do once.",
    },
    {
      title: "Two short strength sessions beat a program in the notes",
      body: "Keep the sessions small enough to keep. The weekly count is what the activity driver reads.",
    },
    {
      title: "Walk between the long sits",
      body: "A few minutes between sitting blocks changes the day more than saving every step for the evening.",
    },
  ],
  nutrition: [
    {
      title: "Put protein on the meal you usually skip",
      body: "A palm-sized portion at that meal does more here than a perfect day. Fiber beside it still counts.",
    },
    {
      title: "Sweets are a pattern, not a confession",
      body: "The slider is how often, not a verdict. A dessert on a quiet week is a different file from a sweet drink every afternoon.",
    },
    {
      title: "Count the drinks that happened",
      body: "Alcohol is already inside the nutrition score. An honest week moves the estimate more than leaving two of them off the slider.",
    },
  ],
  stress: [
    {
      title: "Shrink one block today",
      body: "Pick one meeting, thread, or scroll that can get smaller. The stress number is what you log, so the reduction has to happen in the day.",
    },
    {
      title: "Leave the phone for the walk",
      body: "Twenty quiet minutes on foot is the same kind of action the plan likes. It counts for load and for steps.",
    },
    {
      title: "Name the load before you score it",
      body: "A 6 and an 8 are different weeks. If the number has been stuck, look at the calendar before you move the slider.",
    },
  ],
}

const BODY_TIPS: Record<Exclude<BmiBand, "usual">, DailyTip> = {
  under: {
    subject: "Body mass index",
    title: "The ratio is under the usual adult band",
    body: "BMI is weight divided by height squared. It stays off the biological-age math. If eating has been hard, that conversation belongs with a clinician.",
  },
  over: {
    subject: "Body mass index",
    title: "The ratio is above the usual adult band",
    body: "BMI cannot see muscle or frame. Keep it beside the age estimate, and read a rising number next to steps, protein, and sleep.",
  },
  high: {
    subject: "Body mass index",
    title: "This BMI is high enough to mention",
    body: "The file keeps the number so the trend is visible. It does not change biological age. A clinician is the right person to decide whether the trend needs more than habits.",
  },
}

export function dailyTip(args: {
  date: string
  drivers: { key: DriverKey; score: number }[]
  bmi: number
}): DailyTip {
  const band = bmiBand(args.bmi)
  if (band !== "usual" && hashString(`${args.date}:bmi`) % 4 === 0) {
    return BODY_TIPS[band]
  }
  const weakest = args.drivers.reduce((low, driver) => (driver.score < low.score ? driver : low))
  const pool = DRIVER_TIPS[weakest.key]
  const index = hashString(`${args.date}:${weakest.key}`) % pool.length
  return { subject: DRIVER_LABELS[weakest.key], ...pool[index] }
}
