export type Locale = "en" | "de"

export const LOCALE_COOKIE = "epoch_lang"

export function cleanLocale(value: unknown): Locale | null {
  return value === "en" || value === "de" ? value : null
}

export function localeFromCookieHeader(header: string | null): Locale {
  const match = header?.match(/(?:^|;\s*)epoch_lang=(en|de)(?:;|$)/)
  return match?.[1] === "de" ? "de" : "en"
}
