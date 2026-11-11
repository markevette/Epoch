"use client"

import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { useHealth } from "@/components/health-provider"
import { pick } from "@/lib/copy"
import type { LegalOperator } from "@/lib/legal"

export function ImprintView({ operator }: { operator: LegalOperator }) {
  const { locale } = useHealth()
  const place = [operator.postalCode, operator.city].filter(Boolean).join(" ")
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-6 md:px-8 md:py-10">
      <SiteHeader />
      <p className="mt-10 text-xs tracking-[0.16em] text-muted-foreground uppercase">Impressum</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">{pick(locale, "Imprint", "Impressum")}</h1>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        {pick(
          locale,
          "Epoch is offered by the person named here, as a sole proprietor. This page is the notice required for a commercial website in Germany.",
          "Epoch wird von der hier genannten Person als Einzelunternehmen angeboten. Diese Seite ist die für eine gewerbliche Website in Deutschland vorgeschriebene Angabe.",
        )}
      </p>
      {operator.complete ? (
        <address className="mt-8 space-y-1 text-sm leading-6 not-italic">
          <p className="font-medium">{operator.name}</p>
          <p>{operator.street}</p>
          <p>
            {place}
            {operator.country ? `, ${operator.country}` : ""}
          </p>
          <p>
            {pick(locale, "Email", "E-Mail")}:{" "}
            <a className="text-primary hover:underline" href={`mailto:${operator.email}`}>
              {operator.email}
            </a>
          </p>
        </address>
      ) : (
        <section className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm leading-6">
          <p>
            {pick(
              locale,
              "The operator’s name, street, postal code, city, and email are read from the server.",
              "Name, Straße, Postleitzahl, Ort und E-Mail der Anbieterin oder des Anbieters werden vom Server gelesen.",
            )}
          </p>
          <p className="mt-2 text-muted-foreground">
            {pick(
              locale,
              "Set EPOCH_LEGAL_NAME, EPOCH_LEGAL_STREET, EPOCH_LEGAL_POSTAL, EPOCH_LEGAL_CITY, and EPOCH_LEGAL_EMAIL before anyone else creates an account. A post box alone is not enough. The address has to be one where official mail reaches you.",
              "Setzen Sie EPOCH_LEGAL_NAME, EPOCH_LEGAL_STREET, EPOCH_LEGAL_POSTAL, EPOCH_LEGAL_CITY und EPOCH_LEGAL_EMAIL, bevor jemand anderes ein Konto anlegt. Ein Postfach allein reicht nicht. Die Anschrift muss eine sein, unter der Sie behördliche Post erreicht.",
            )}
          </p>
        </section>
      )}
      <p className="mt-8 text-sm leading-6 text-muted-foreground">
        {pick(
          locale,
          "VAT is added here when the tax office issues a VAT number. Under the small-business rule, invoices show no VAT. Epoch is a wellness record for adults. A clinician diagnoses illness and prescribes treatment.",
          "Die Umsatzsteuer wird hier ergänzt, sobald das Finanzamt eine Umsatzsteuer-Identifikationsnummer vergibt. Nach der Kleinunternehmerregelung weisen Rechnungen keine Umsatzsteuer aus. Epoch ist eine Wellness-Akte für Erwachsene. Eine Ärztin oder ein Arzt stellt Diagnosen und behandelt.",
        )}
      </p>
      <p className="mt-6 text-sm">
        <Link href="/legal/privacy" className="text-primary hover:underline">
          {pick(locale, "Privacy", "Datenschutz")}
        </Link>
      </p>
    </main>
  )
}
