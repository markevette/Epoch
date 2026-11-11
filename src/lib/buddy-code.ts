import { randomInt } from "crypto"

/** No 0/O or 1/I/L, so a code can be read aloud. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function normalizeBuddyCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, "")
}

export const BUDDY_CODE_LENGTH = 10

export function newBuddyCode(): string {
  let code = ""
  for (let index = 0; index < BUDDY_CODE_LENGTH; index += 1) code += ALPHABET[randomInt(ALPHABET.length)]
  return code
}
