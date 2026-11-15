"use client"

import { SiteHeader } from "@/components/site-header"
import { useHealth } from "@/components/health-provider"
import { pick } from "@/lib/copy"

export default function TermsPage() {
  const { locale } = useHealth()
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-6 md:px-8 md:py-10">
      <SiteHeader />
      <p className="mt-10 text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Terms", "AGB")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">
        {pick(locale, "Adults and a wellness file", "Erwachsene und eine Wellness-Akte")}
      </h1>
      <div className="mt-6 space-y-4 text-sm leading-6">
        <p>
          {pick(
            locale,
            "Epoch is for adults. You open a file only if you are 18 or older.",
            "Epoch ist für Erwachsene. Sie öffnen eine Akte nur, wenn Sie 18 Jahre oder älter sind.",
          )}
        </p>
        <p>
          {pick(
            locale,
            "Epoch is a wellness record for education. A clinician diagnoses illness and prescribes treatment. The daily score and the estimated biological age move when sleep, fitness, food, or stress move. They are not a diagnosis, a lab result, or a reason to start or stop a treatment.",
            "Epoch ist eine Wellness-Akte zur Orientierung. Eine Ärztin oder ein Arzt stellt Diagnosen und behandelt. Der Tageswert und das geschätzte biologische Alter bewegen sich, wenn sich Schlaf, Fitness, Essen oder Stress bewegen. Sie sind keine Diagnose, kein Laborwert und kein Grund, eine Behandlung zu beginnen oder zu beenden.",
          )}
        </p>
        <p>
          {pick(
            locale,
            "This is a closed beta. There is no paid wellness plan and no store listing yet. Sun for the grove can be bought in packs. The price is in euros and includes tax. Sun is a game counter for watering a tree. It does not change the daily score. Sun arrives when the payment is confirmed, and paying asks for that delivery to start.",
            "Das ist eine geschlossene Beta. Es gibt noch keinen bezahlten Wellness-Plan und keinen Store-Eintrag. Sonne für den Hain kann in Packs gekauft werden. Der Preis ist in Euro und enthält die Steuer. Sonne ist ein Spielzähler, um einen Baum zu gießen. Sie ändert den Tageswert nicht. Die Sonne kommt, wenn die Zahlung bestätigt ist, und das Bezahlen bittet darum, dass diese Lieferung beginnt.",
          )}
        </p>
        <p>
          {pick(
            locale,
            "Meals and workouts stay on your file. A buddy sees the morning check-in and seven daily scores. The operator’s name and address are in the imprint.",
            "Mahlzeiten und Training bleiben auf Ihrer Akte. Ein Buddy sieht den Morgen-Check-in und sieben Tageswerte. Name und Anschrift der Anbieterin oder des Anbieters stehen im Impressum.",
          )}
        </p>
      </div>
    </main>
  )
}
