"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { Disclaimer } from "@/components/disclaimer"
import { useHealth } from "@/components/health-provider"
import { Button } from "@/components/ui/button"
import { confidenceText, copy, pick, translateError } from "@/lib/copy"
import { formatLongDate, isoDate } from "@/lib/format"
import { foodDay } from "@/lib/meals"
import { morningsKeptLine, summarizeRewards } from "@/lib/rewards"
import {
  paintShareCard,
  pngFileFromPaint,
  SHARE_CARD_FILENAME,
  type SharePhoto,
} from "@/lib/share-card"
import { burnedLine, workoutOn } from "@/lib/workouts"

type CardPhoto = SharePhoto & { url: string; bitmap: ImageBitmap }

async function pictureFromFile(file: File): Promise<CardPhoto> {
  const original = await createImageBitmap(file)
  const longest = Math.max(original.width, original.height)
  const scale = Math.min(1, 640 / longest)
  const width = Math.max(1, Math.round(original.width * scale))
  const height = Math.max(1, Math.round(original.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("picture")
  context.drawImage(original, 0, 0, width, height)
  original.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) throw new Error("picture")
  const bitmap = await createImageBitmap(canvas)
  return { width, height, url: URL.createObjectURL(blob), bitmap }
}

export default function SharePage() {
  const { profile, model, locale } = useHealth()
  const [shareNote, setShareNote] = useState<string | null>(null)
  const [photo, setPhoto] = useState<CardPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  if (!profile || !model) return null
  const member = profile
  const reading = model

  const score = String(Math.round(reading.longevityScore))
  const first = member.name.split(" ")[0]
  const confidence = `${confidenceText(locale, reading.confidenceLabel)} · ${Math.round(reading.confidence * 100)}% ${pick(locale, "confidence", "Verlässlichkeit")}`
  const now = new Date()
  const date = formatLongDate(isoDate(now), locale)
  const workout = workoutOn(member.workouts, foodDay(now))
  const burned = burnedLine(workout ? workout.kcal : null, locale)
  const morningsLine = morningsKeptLine(summarizeRewards(member.rewards, now).morningsKept, locale)
  const sentences = [
    pick(locale, `${first}'s daily score is ${score}.`, `Der Tageswert von ${first} ist ${score}.`),
    ...copy(locale).claims,
    ...(burned ? [burned.endsWith(".") ? burned : `${burned}.`] : []),
  ]
  async function cardFile() {
    return pngFileFromPaint(SHARE_CARD_FILENAME, (ctx) => {
      paintShareCard(
        ctx,
        {
          name: member.name,
          date,
          score,
          scoreLabel: copy(locale).home.dailyScore,
          confidence,
          morningsLine,
          burnedLine: burned,
          sentences,
          photo,
        },
        photo?.bitmap,
      )
    })
  }

  async function downloadCard() {
    try {
      const file = await cardFile()
      const url = URL.createObjectURL(file)
      const link = document.createElement("a")
      link.href = url
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setShareNote(pick(locale, "The card downloaded as a PNG, with the lines underneath it.", "Die Karte wurde als PNG geladen, mit den Zeilen darunter."))
    } catch {
      setShareNote(pick(locale, "The card could not be drawn.", "Die Karte konnte nicht gezeichnet werden."))
    }
  }

  async function nativeShare() {
    let file: File
    try {
      file = await cardFile()
    } catch {
      setShareNote(pick(locale, "The card could not be drawn.", "Die Karte konnte nicht gezeichnet werden."))
      return
    }
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      await downloadCard()
      return
    }
    try {
      await navigator.share({ title: "Epoch", text: sentences.join(" "), files: [file] })
      setShareNote(pick(locale, "Share sheet opened with the card.", "Das Teilen hat sich mit der Karte geöffnet."))
    } catch {
      setShareNote(pick(locale, "Share was dismissed.", "Das Teilen wurde geschlossen."))
    }
  }

  function clearPhoto() {
    setPhoto((current) => {
      if (current) {
        URL.revokeObjectURL(current.url)
        current.bitmap.close()
      }
      return null
    })
    if (fileRef.current) fileRef.current.value = ""
  }

  async function choosePhoto(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setShareNote(translateError(locale, "Choose a picture."))
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setShareNote(translateError(locale, "That picture is too large."))
      return
    }
    try {
      const next = await pictureFromFile(file)
      setPhoto((current) => {
        if (current) {
          URL.revokeObjectURL(current.url)
          current.bitmap.close()
        }
        return next
      })
      setShareNote(null)
    } catch {
      setShareNote(translateError(locale, "That picture could not be read."))
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Share card", "Teilkarte")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">{pick(locale, "A score someone can actually read.", "Ein Wert, den jemand wirklich lesen kann.")}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        {pick(locale, "A card you can download or send. It shows the daily score. A picture is optional and sits on the right. Calories burned appear only when they are above zero.", "Eine Karte zum Herunterladen oder Schicken. Sie zeigt den Tageswert. Ein Bild ist freiwillig und sitzt rechts. Verbrannte Kalorien erscheinen nur, wenn sie über null liegen.")}
      </p>

      <article className={`mt-8 flex items-start gap-5 rounded-3xl border border-border bg-card p-5 shadow-[0_24px_60px_-36px_rgba(30,50,40,0.5)] sm:p-8 ${photo ? "max-w-xl" : "max-w-md"}`}>
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl">Epoch</p>
          <p className="mt-6 text-xs tracking-[0.16em] text-muted-foreground uppercase">{member.name}</p>
          <p className="mt-2 text-sm text-muted-foreground">{date}</p>
          <p className="mt-3 font-display text-7xl tabular leading-none">{Math.round(reading.longevityScore)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{copy(locale).home.dailyScore}</p>
          <p className="mt-1 text-sm">{confidence}</p>
          {morningsLine ? <p className="mt-4 text-sm">{morningsLine}</p> : null}
          {burned && workout && workout.kcal > 0 ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{pick(locale, "kcal burned", "kcal verbrannt")}</p>
              <p className="mt-1 font-display text-5xl tabular leading-none">{workout.kcal.toLocaleString(locale === "de" ? "de-DE" : "en-GB")}</p>
              <p className="mt-2 text-sm text-muted-foreground">{pick(locale, "Worked out today.", "Heute trainiert.")}</p>
            </div>
          ) : null}
        </div>
        {photo ? (
          <Image
            src={photo.url}
            alt=""
            width={photo.width}
            height={photo.height}
            unoptimized
            className="h-36 w-28 shrink-0 rounded-2xl object-cover sm:h-44 sm:w-36"
          />
        ) : null}
      </article>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            void choosePhoto(file)
          }}
        />
        <Button variant="outline" className="h-11 px-4" onClick={() => fileRef.current?.click()}>
          {photo ? pick(locale, "Replace picture", "Bild ersetzen") : pick(locale, "Add a picture", "Ein Bild hinzufügen")}
        </Button>
        {photo ? (
          <Button variant="outline" className="h-11 px-4" onClick={clearPhoto}>
            {pick(locale, "Remove picture", "Bild entfernen")}
          </Button>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button className="h-11 px-4" onClick={() => void downloadCard()}>
          {pick(locale, "Download card", "Karte laden")}
        </Button>
        <Button variant="outline" className="h-11 px-4" onClick={() => void nativeShare()}>
          {pick(locale, "Share", "Teilen")}
        </Button>
      </div>
      <div className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
        {sentences.map((sentence) => (
          <p key={sentence}>{sentence}</p>
        ))}
      </div>
      {shareNote ? <p className="mt-3 text-sm text-muted-foreground">{shareNote}</p> : null}
      <Disclaimer className="mt-8" />
    </main>
  )
}
