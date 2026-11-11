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
  sentences: string[]
  photo?: SharePhoto | null
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
  stroke: () => void
  fillText: (text: string, x: number, y: number) => void
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

function fittedPhoto(photo: { width: number; height: number }): { width: number; height: number; x: number; y: number } {
  const maxWidth = 216
  const maxHeight = 264
  const scale = Math.min(maxWidth / photo.width, maxHeight / photo.height)
  const width = Math.max(1, photo.width * scale)
  const height = Math.max(1, photo.height * scale)
  return { width, height, x: SHARE_CARD_WIDTH - PAD - width, y: 244 }
}

export function paintShareCard(
  ctx: ShareCanvas,
  card: ShareCard,
  photoImage?: unknown,
): void {
  paper(ctx, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT)
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
  const textRight = photo && photoImage ? SHARE_CARD_WIDTH - PAD - 248 : SHARE_CARD_WIDTH - PAD
  rule(ctx, 440, textRight)
  let y = 476
  const lineWidth = photo && photoImage ? 36 : 48
  if (card.morningsLine) {
    ctx.font = "500 22px Geist, system-ui, sans-serif"
    ctx.fillText(card.morningsLine, PAD, y)
    y += 40
  }
  if (card.burnedLine) {
    ctx.font = "700 32px Fraunces, 'Times New Roman', serif"
    ctx.fillText(card.burnedLine, PAD, y)
    y += 52
  }
  y += 8
  ctx.font = "400 22px Geist, system-ui, sans-serif"
  for (const sentence of card.sentences) {
    for (const line of wrap(sentence, lineWidth)) {
      ctx.fillText(line, PAD, y)
      y += 32
    }
    y += 12
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
): Promise<File> {
  const canvas = document.createElement("canvas")
  canvas.width = SHARE_CARD_WIDTH
  canvas.height = SHARE_CARD_HEIGHT
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("The card could not be drawn.")
  if (document.fonts?.ready) await document.fonts.ready
  await paint(ctx as unknown as ShareCanvas)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) throw new Error("The card could not be drawn.")
  return new File([blob], filename, { type: "image/png" })
}
