export type SharePhoto = {
  width: number
  height: number
}

export type ShareCard = {
  name: string
  date: string
  score: string
  scoreLabel?: string
  confidence: string
  morningsLine: string | null
  burnedLine: string | null
  photo?: SharePhoto | null
  /** Last 7 daily scores, the same week a buddy can see. Omit to leave them off the card. */
  week?: number[] | null
  weekLabel?: string
  /** Current grove stage, drawn as a small sticker. Omit to leave it off. */
  groveStage?: "seed" | "sprout" | "sapling" | "young" | "tree" | "canopy" | null
  groveBlossoms?: number
}

export type PairCard = {
  left: string
  right: string
  streak: number
  sentence: string
  together?: string
}

export type ShareCanvas = {
  fillStyle: string
  strokeStyle: string
  font: string
  textBaseline: CanvasTextBaseline
  lineWidth: number
  fillRect: (x: number, y: number, w: number, h: number) => void
  beginPath: () => void
  moveTo: (x: number, y: number) => void
  lineTo: (x: number, y: number) => void
  arc: (x: number, y: number, r: number, start: number, end: number) => void
  ellipse: (x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number) => void
  fill: () => void
  stroke: () => void
  fillText: (text: string, x: number, y: number) => void
  measureText?: (text: string) => { width: number }
  drawImage?: (image: unknown, x: number, y: number, w: number, h: number) => void
}

export const SHARE_CARD_WIDTH = 840
export const SHARE_CARD_HEIGHT = 1400
export const SHARE_CARD_FILENAME = "epoch-share-card.png"
export const PAIR_CARD_FILENAME = "epoch-pair.png"

const INK = "#293d33"
const PAPER = "#f4efe6"
const RULE = "#bfc7bd"
const PAD = 80
const STICKER = 112

export function paintGroveSticker(
  ctx: ShareCanvas,
  stage: NonNullable<ShareCard["groveStage"]>,
  blossoms: number,
  x: number,
  y: number,
  size: number,
) {
  const cx = x + size / 2
  const cy = y + size / 2
  const ground = y + size * 0.78
  ctx.fillStyle = "#efe6d4"
  ctx.beginPath()
  ctx.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "#c9bfae"
  ctx.lineWidth = Math.max(2, size * 0.035)
  ctx.stroke()
  ctx.fillStyle = "#6d8a55"
  ctx.beginPath()
  ctx.ellipse(cx, ground, size * 0.3, size * 0.055, 0, 0, Math.PI * 2)
  ctx.fill()
  if (stage === "seed") {
    ctx.fillStyle = "#8a6230"
    ctx.beginPath()
    ctx.ellipse(cx, ground - size * 0.05, size * 0.09, size * 0.055, 0, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  const crown = stage === "canopy" || stage === "tree" || stage === "young"
  const top = stage === "sprout" ? y + size * 0.46 : stage === "sapling" ? y + size * 0.34 : y + size * 0.3
  ctx.strokeStyle = crown ? "#6b5344" : "#3d6b45"
  ctx.lineWidth = stage === "canopy" ? size * 0.07 : stage === "tree" ? size * 0.055 : size * 0.04
  ctx.beginPath()
  ctx.moveTo(cx, ground)
  ctx.lineTo(cx, top)
  ctx.stroke()
  const leaf = (lx: number, ly: number, rx: number, ry: number, rotation: number, color: string) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(lx, ly, rx, ry, rotation, 0, Math.PI * 2)
    ctx.fill()
  }
  if (!crown) {
    leaf(cx - size * 0.16, top + size * 0.08, size * 0.12, size * 0.05, -0.6, "#5f9a58")
    leaf(cx + size * 0.16, top + size * 0.06, size * 0.12, size * 0.05, 0.6, "#7eb56a")
    if (stage === "sapling") {
      leaf(cx - size * 0.1, top - size * 0.02, size * 0.09, size * 0.04, -0.3, "#8fbf62")
      leaf(cx + size * 0.1, top - size * 0.04, size * 0.09, size * 0.04, 0.35, "#6eaa5c")
    }
    return
  }
  const radius = stage === "canopy" ? size * 0.24 : stage === "tree" ? size * 0.2 : size * 0.15
  const crownY = top + size * 0.02
  ctx.fillStyle = "#3f7a4e"
  ctx.beginPath()
  ctx.arc(cx, crownY, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#5a9458"
  ctx.beginPath()
  ctx.arc(cx - radius * 0.7, crownY + radius * 0.25, radius * 0.72, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#6aaa62"
  ctx.beginPath()
  ctx.arc(cx + radius * 0.72, crownY + radius * 0.2, radius * 0.68, 0, Math.PI * 2)
  ctx.fill()
  if (blossoms > 0) {
    ctx.fillStyle = "#e2b15a"
    ctx.beginPath()
    ctx.arc(cx - radius * 0.3, crownY - radius * 0.15, size * 0.035, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx + radius * 0.35, crownY + radius * 0.1, size * 0.03, 0, Math.PI * 2)
    ctx.fill()
  }
}

function wrap(value: string, width: number): string[] {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > width && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function paper(ctx: ShareCanvas, width: number, height: number) {
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = INK
  ctx.textBaseline = "top"
}

function rule(ctx: ShareCanvas, y: number, right: number) {
  ctx.strokeStyle = RULE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(right, y)
  ctx.stroke()
  ctx.fillStyle = INK
}

export function weekBars(scores: number[]): number[] {
  if (scores.length === 0) return []
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const span = Math.max(1, max - min)
  return scores.map((score) => 0.35 + ((score - min) / span) * 0.65)
}

export const WEEK_SLOT = 44
export const WEEK_BAR_WIDTH = 14
export const WEEK_PLOT = 56

export type WeekBarFrame = {
  slotX: number
  barX: number
  barY: number
  barWidth: number
  barHeight: number
  baseline: number
  label: string
  labelX: number
}

/** One column per day. Every bar ends on the same baseline, and its score is centered in that column. */
export function weekBarFrames(scores: number[], measure: (label: string) => number = (label) => label.length * 9): WeekBarFrame[] {
  const heights = weekBars(scores)
  return scores.map((score, index) => {
    const label = String(Math.round(score))
    const barHeight = Math.max(2, Math.round(WEEK_PLOT * (heights[index] ?? 0)))
    const slotX = index * WEEK_SLOT
    const textWidth = measure(label)
    return {
      slotX,
      barX: slotX + (WEEK_SLOT - WEEK_BAR_WIDTH) / 2,
      barY: WEEK_PLOT - barHeight,
      barWidth: WEEK_BAR_WIDTH,
      barHeight,
      baseline: WEEK_PLOT,
      label,
      labelX: slotX + (WEEK_SLOT - textWidth) / 2,
    }
  })
}

function fittedPhoto(photo: { width: number; height: number }): { width: number; height: number; x: number; y: number } {
  const maxWidth = 216
  const maxHeight = 264
  const scale = Math.min(maxWidth / photo.width, maxHeight / photo.height)
  const width = Math.max(1, photo.width * scale)
  const height = Math.max(1, photo.height * scale)
  return { width, height, x: SHARE_CARD_WIDTH - PAD - width, y: 244 }
}

/** The painted card ends under the score, the optional week, the calories, and the picture. */
export function shareCardHeight(card: ShareCard): number {
  const week = (card.week ?? []).filter((score) => Number.isFinite(score)).slice(0, 7)
  let bottom = 404
  if (week.length > 0 || card.morningsLine || card.burnedLine) {
    let y = 476
    if (week.length > 0) y += 36 + WEEK_PLOT + 32
    if (card.morningsLine) y += 40
    if (card.burnedLine) y += 52
    bottom = y
  }
  const photo = card.photo && card.photo.width > 0 && card.photo.height > 0 ? fittedPhoto(card.photo) : null
  if (photo) bottom = Math.max(bottom, photo.y + photo.height)
  if (card.groveStage) bottom = Math.max(bottom, 72 + STICKER)
  return Math.ceil(bottom + 72)
}

export function paintShareCard(
  ctx: ShareCanvas,
  card: ShareCard,
  photoImage?: unknown,
): void {
  paper(ctx, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT)
  if (card.groveStage) {
    paintGroveSticker(ctx, card.groveStage, card.groveBlossoms ?? 0, SHARE_CARD_WIDTH - PAD - STICKER, 72, STICKER)
    ctx.fillStyle = INK
  }
  ctx.font = "700 44px Fraunces, 'Times New Roman', serif"
  ctx.fillText("Epoch", PAD, 72)
  ctx.font = "500 22px Geist, system-ui, sans-serif"
  ctx.fillText(card.name, PAD, 148)
  ctx.font = "400 22px Geist, system-ui, sans-serif"
  ctx.fillText(card.date, PAD, 188)
  ctx.font = "700 96px Fraunces, 'Times New Roman', serif"
  ctx.fillText(card.score, PAD, 228)
  ctx.font = "500 22px Geist, system-ui, sans-serif"
  ctx.fillText(card.scoreLabel || "Daily score", PAD, 348)
  ctx.font = "400 20px Geist, system-ui, sans-serif"
  ctx.fillText(card.confidence, PAD, 384)
  const photo = card.photo && card.photo.width > 0 && card.photo.height > 0 ? card.photo : null
  if (photo && photoImage && ctx.drawImage) {
    const placed = fittedPhoto(photo)
    ctx.drawImage(photoImage, placed.x, placed.y, placed.width, placed.height)
  }
  const week = (card.week ?? []).filter((score) => Number.isFinite(score)).slice(0, 7)
  const hasBelow = week.length > 0 || Boolean(card.morningsLine) || Boolean(card.burnedLine)
  if (!hasBelow) return
  const textRight = photo && photoImage ? SHARE_CARD_WIDTH - PAD - 248 : SHARE_CARD_WIDTH - PAD
  rule(ctx, 440, textRight)
  let y = 476
  if (week.length > 0) {
    ctx.font = "500 20px Geist, system-ui, sans-serif"
    ctx.fillText(card.weekLabel || "Last 7 daily scores", PAD, y)
    y += 36
    const frames = weekBarFrames(week, (label) => ctx.measureText?.(label).width ?? label.length * 9)
    const plotTop = y
    for (const frame of frames) {
      ctx.fillRect(PAD + frame.barX, plotTop + frame.barY, frame.barWidth, frame.barHeight)
    }
    const baseline = plotTop + WEEK_PLOT
    ctx.strokeStyle = RULE
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(PAD, baseline)
    ctx.lineTo(PAD + frames.length * WEEK_SLOT, baseline)
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.font = "400 16px Geist, system-ui, sans-serif"
    for (const frame of frames) {
      ctx.fillText(frame.label, PAD + frame.labelX, baseline + 8)
    }
    y = baseline + 32
  }
  if (card.morningsLine) {
    ctx.font = "500 22px Geist, system-ui, sans-serif"
    ctx.fillText(card.morningsLine, PAD, y)
    y += 40
  }
  if (card.burnedLine) {
    ctx.font = "700 32px Fraunces, 'Times New Roman', serif"
    ctx.fillText(card.burnedLine, PAD, y)
  }
}

export function paintPairCard(ctx: ShareCanvas, input: PairCard): void {
  paper(ctx, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT)
  const together = input.together ?? (input.streak === 1 ? "morning together" : "mornings together")
  ctx.font = "700 44px Fraunces, 'Times New Roman', serif"
  ctx.fillText("Epoch", PAD, 72)
  ctx.font = "500 24px Geist, system-ui, sans-serif"
  ctx.fillText(`@${input.left} and @${input.right}`, PAD, 148)
  ctx.font = "700 96px Fraunces, 'Times New Roman', serif"
  ctx.fillText(String(input.streak), PAD, 200)
  ctx.font = "500 28px Geist, system-ui, sans-serif"
  ctx.fillText(together, PAD, 320)
  rule(ctx, 384, SHARE_CARD_WIDTH - PAD)
  let y = 428
  ctx.font = "400 22px Geist, system-ui, sans-serif"
  for (const line of wrap(input.sentence, 48)) {
    ctx.fillText(line, PAD, y)
    y += 32
  }
}

export async function pngFileFromPaint(
  filename: string,
  paint: (ctx: ShareCanvas) => void | Promise<void>,
  height: number = SHARE_CARD_HEIGHT,
): Promise<File> {
  const canvas = document.createElement("canvas")
  canvas.width = SHARE_CARD_WIDTH
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("The card could not be drawn.")
  if (document.fonts?.ready) await document.fonts.ready
  await paint(ctx as unknown as ShareCanvas)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) throw new Error("The card could not be drawn.")
  return new File([blob], filename, { type: "image/png" })
}
