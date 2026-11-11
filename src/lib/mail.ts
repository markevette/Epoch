const RESEND = "https://api.resend.com/emails"

export type OutboxLetter = {
  to: string
  subject: string
  body: string
}

export function mailConfigured(): boolean {
  return Boolean(process.env.EPOCH_MAIL_KEY?.trim() && process.env.EPOCH_MAIL_FROM?.trim())
}

export async function sendLetter(letter: OutboxLetter): Promise<boolean> {
  const key = process.env.EPOCH_MAIL_KEY?.trim()
  const from = process.env.EPOCH_MAIL_FROM?.trim()
  if (!key || !from) return false
  try {
    const response = await fetch(RESEND, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [letter.to],
        subject: letter.subject.slice(0, 200),
        text: letter.body.slice(0, 4000),
      }),
    })
    return response.ok
  } catch {
    return false
  }
}

export function recoveryLetter(origin: string, token: string): { subject: string; body: string } {
  const url = `${origin.replace(/\/$/, "")}/recover/new?token=${encodeURIComponent(token)}`
  return {
    subject: "Reset your Epoch password",
    body: `Use this link to choose a new password. It closes in an hour.\n\n${url}\n`,
  }
}
