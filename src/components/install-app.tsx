"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { useHealth } from "@/components/health-provider"
import { Button } from "@/components/ui/button"
import { pick } from "@/lib/copy"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  INSTALLED_APP_URL,
  installSurface,
  isIosDevice,
  isOurInstalledApp,
  type InstallSurface,
} from "@/lib/web-app"

const DISMISS_KEY = "epoch.install-dismissed"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const COPY: Record<"en" | "de", Record<Exclude<InstallSurface, "hidden">, { title: string; body: string; action: string }>> = {
  en: {
    install: {
      title: "Install Epoch",
      body: "Puts Epoch on this device. It then opens without the browser bar.",
      action: "Install",
    },
    ios: {
      title: "Add Epoch to the Home Screen",
      body: "iPhone and iPad install it from the share sheet. This page cannot switch into that icon.",
      action: "Show me how",
    },
    open: {
      title: "Open the Epoch app",
      body: "This device already has Epoch installed.",
      action: "Open the app",
    },
  },
  de: {
    install: {
      title: "Epoch installieren",
      body: "Legt Epoch auf dieses Gerät. Es öffnet sich dann ohne die Browserleiste.",
      action: "Installieren",
    },
    ios: {
      title: "Epoch auf den Home-Bildschirm",
      body: "iPhone und iPad installieren es über das Teilen-Menü. Diese Seite kann nicht in das Symbol wechseln.",
      action: "Zeig mir wie",
    },
    open: {
      title: "Die Epoch-App öffnen",
      body: "Auf diesem Gerät ist Epoch schon installiert.",
      action: "App öffnen",
    },
  },
}

export function InstallApp() {
  const { locale } = useHealth()
  const pathname = usePathname()
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const openedRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [ios, setIos] = useState(false)
  const [installedRelated, setInstalledRelated] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [help, setHelp] = useState<"ios" | "menu" | null>(null)

  useEffect(() => {
    let cancelled = false
    const url = new URL(window.location.href)
    if (url.searchParams.has("open")) {
      url.searchParams.delete("open")
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {})
    }

    const nav = navigator as Navigator & { standalone?: boolean }
    const standaloneNow =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
    setStandalone(standaloneNow)
    setIos(isIosDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints))
    setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === "1")

    const onPrompt = (event: Event) => {
      event.preventDefault()
      promptRef.current = event as BeforeInstallPromptEvent
    }
    const onInstalled = () => {
      promptRef.current = null
      setInstalledRelated(true)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)

    const related = navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<{ platform: string; url?: string }[]>
    }
    if (!standaloneNow && related.getInstalledRelatedApps) {
      related
        .getInstalledRelatedApps()
        .then((apps) => {
          if (!cancelled && isOurInstalledApp(apps, window.location.origin)) setInstalledRelated(true)
        })
        .catch(() => {})
    }

    setReady(true)
    return () => {
      cancelled = true
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const surface = installSurface({ standalone, ios, installedRelated })
  const visible = ready && !dismissed && surface !== "hidden"

  useEffect(() => {
    const root = document.documentElement
    if (visible) root.dataset.installBanner = "true"
    else delete root.dataset.installBanner
    return () => {
      delete root.dataset.installBanner
    }
  }, [visible])

  useEffect(() => {
    if (!ready || !installedRelated || standalone || openedRef.current) return
    openedRef.current = true
    window.location.assign(INSTALLED_APP_URL)
  }, [ready, installedRelated, standalone])

  async function onPrimary() {
    if (surface === "open") {
      window.location.assign(INSTALLED_APP_URL)
      return
    }
    if (surface === "ios") {
      setHelp("ios")
      return
    }
    const prompt = promptRef.current
    if (!prompt) {
      setHelp("menu")
      return
    }
    await prompt.prompt()
    const choice = await prompt.userChoice
    promptRef.current = null
    if (choice.outcome === "accepted") setInstalledRelated(true)
  }

  function dismiss() {
    window.sessionStorage.setItem(DISMISS_KEY, "1")
    setDismissed(true)
    setHelp(null)
  }

  const aboveTabs = pathname.startsWith("/home")
  const copy = surface === "hidden" ? null : COPY[locale][surface]

  return (
    <>
      {visible && copy ? (
        <div
          role="region"
          aria-label={pick(locale, "Install Epoch", "Epoch installieren")}
          className={cn(
            "fixed z-40 rounded-2xl border border-border bg-card p-3 shadow-lg",
            aboveTabs
              ? "inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] md:inset-x-auto md:right-4 md:bottom-4 md:left-auto md:w-96"
              : "inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] w-[min(24rem,calc(100%-1.5rem))] md:inset-x-auto md:right-4 md:bottom-4 md:left-auto md:w-96",
          )}
        >
          <div className="flex items-start gap-3">
            <Image src="/icons/icon-192.png" alt="" width={44} height={44} className="size-11 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{copy.title}</p>
              <p className={cn("mt-0.5 text-xs text-muted-foreground", aboveTabs && "hidden md:block")}>{copy.body}</p>
              <div className="mt-2 flex flex-wrap gap-2 md:mt-3">
                <Button type="button" onClick={onPrimary}>
                  {copy.action}
                </Button>
                <Button type="button" variant="outline" onClick={dismiss}>
                  {pick(locale, "Not now", "Nicht jetzt")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <Dialog open={help !== null} onOpenChange={(open) => { if (!open) setHelp(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {help === "ios"
                ? pick(locale, "Add Epoch to the Home Screen", "Epoch auf den Home-Bildschirm")
                : pick(locale, "Install Epoch from the browser menu", "Epoch über das Browsermenü installieren")}
            </DialogTitle>
            <DialogDescription>
              {help === "ios"
                ? pick(locale, "Once the icon is on the Home Screen, open Epoch from that icon. Safari stays in the browser.", "Wenn das Symbol auf dem Home-Bildschirm liegt, öffne Epoch von dort. Safari bleibt im Browser.")
                : pick(locale, "This browser has not handed over an install prompt yet. The menu can still add it.", "Dieser Browser hat noch keine Installationsfrage übergeben. Das Menü kann es trotzdem hinzufügen.")}
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-4 text-sm">
            {help === "ios" ? (
              <>
                <li>{pick(locale, "Tap the Share button in the browser toolbar.", "Tippe auf Teilen in der Browserleiste.")}</li>
                <li>{pick(locale, "Scroll the sheet and tap Add to Home Screen.", "Scrolle das Blatt und tippe auf Zum Home-Bildschirm.")}</li>
                <li>{pick(locale, "Tap Add. The Epoch icon then opens without the Safari bar.", "Tippe auf Hinzufügen. Das Epoch-Symbol öffnet sich dann ohne die Safari-Leiste.")}</li>
              </>
            ) : (
              <>
                <li>{pick(locale, "Open the browser menu.", "Öffne das Browsermenü.")}</li>
                <li>{pick(locale, "Choose Install app, or Add to Home screen.", "Wähle App installieren oder Zum Home-Bildschirm.")}</li>
                <li>{pick(locale, "Confirm. Epoch then opens from its own icon.", "Bestätige. Epoch öffnet sich dann über das eigene Symbol.")}</li>
              </>
            )}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  )
}
