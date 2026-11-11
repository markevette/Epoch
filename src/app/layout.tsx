import type { Metadata, Viewport } from "next"
import { cookies } from "next/headers"
import { Fraunces, Geist, Geist_Mono } from "next/font/google"
import { DaypartSync } from "@/components/daypart"
import { HealthProvider } from "@/components/health-provider"
import { LegalFooter } from "@/components/legal-footer"
import { InstallApp } from "@/components/install-app"
import { DAYPART_BOOT } from "@/lib/daypart"
import { cleanLocale, LOCALE_COOKIE } from "@/lib/locale"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Epoch",
  description:
    "A daily score from sleep, fitness, food, and stress. A closed beta. A wellness record for education.",
  applicationName: "Epoch",
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  appleWebApp: {
    capable: true,
    title: "Epoch",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
}

export const viewport: Viewport = {
  themeColor: "#1e4f43",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = cleanLocale((await cookies()).get(LOCALE_COOKIE)?.value) ?? "en"
  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full antialiased">
        <script dangerouslySetInnerHTML={{ __html: DAYPART_BOOT }} />
        <DaypartSync>
          <HealthProvider initialLocale={locale}>
            {children}
            <LegalFooter />
            <InstallApp />
          </HealthProvider>
        </DaypartSync>
      </body>
    </html>
  )
}
