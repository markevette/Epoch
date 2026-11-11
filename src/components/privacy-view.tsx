"use client"

import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { useHealth } from "@/components/health-provider"
import { pick } from "@/lib/copy"
import type { LegalOperator } from "@/lib/legal"

export function PrivacyView({ operator }: { operator: LegalOperator }) {
  const { locale } = useHealth()
  const keeper = operator.name
    ? operator.name
    : pick(locale, "The operator named in the imprint", "Die im Impressum genannte Person")
  const contact = operator.email ? (
    <a className="text-primary hover:underline" href={`mailto:${operator.email}`}>
      {operator.email}
    </a>
  ) : (
    pick(locale, "the email in the imprint, once it is set", "die E-Mail im Impressum, sobald sie gesetzt ist")
  )
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-6 md:px-8 md:py-10">
      <SiteHeader />
      <p className="mt-10 text-xs tracking-[0.16em] text-muted-foreground uppercase">{pick(locale, "Privacy", "Datenschutz")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">
        {pick(locale, "How the file is kept", "Wie die Akte aufbewahrt wird")}
      </h1>
      <div className="mt-6 space-y-4 text-sm leading-6">
        <p>
          {keeper} {pick(locale, "keeps Epoch. Contact:", "betreibt Epoch. Kontakt:")} {contact}.
        </p>
        <p>
          {pick(
            locale,
            "The product is for adults. A clinician diagnoses illness and prescribes treatment.",
            "Das Produkt ist für Erwachsene. Eine Ärztin oder ein Arzt stellt Diagnosen und behandelt.",
          )}
        </p>
        <p>
          {pick(
            locale,
            "The member file sits on a server in the European Union. It is a SQLite database on that server. The session cookie is stored on your device so you stay signed in. It is required for the account. The site does not add an advertising cookie.",
            "Die Mitgliederakte liegt auf einem Server in der Europäischen Union. Sie ist eine SQLite-Datenbank auf diesem Server. Das Sitzungscookie liegt auf Ihrem Gerät, damit Sie angemeldet bleiben. Es ist für das Konto erforderlich. Die Seite setzt kein Werbecookie.",
          )}
        </p>
        <p>
          {pick(
            locale,
            "An account holds your name, email, and a hashed password. The file can hold age, sex, height, weight, sleep, wake time, bedtime, heart-rate variability, resting heart rate, steps, stress, easy cardio, strength, food ratings, alcohol, meals, workouts, check-ins, the night line, reward points, and the estimated biological age that those numbers produce. A picture on the share card stays in the browser for that visit and is placed in the image you download. It is not written onto the account.",
            "Ein Konto enthält Ihren Namen, Ihre E-Mail und ein gehashtes Passwort. Die Akte kann Alter, Geschlecht, Größe, Gewicht, Schlaf, Aufwachzeit, Schlafenszeit, Herzfrequenzvariabilität, Ruheherzfrequenz, Schritte, Stress, lockeres Cardio, Kraft, Essensbewertungen, Alkohol, Mahlzeiten, Training, Check-ins, die Nachtzeile, Belohnungspunkte und das geschätzte biologische Alter enthalten, das diese Zahlen ergeben. Ein Bild auf der Teilkarte bleibt für diesen Besuch im Browser und liegt in der Bilddatei, die Sie herunterladen. Es wird nicht auf das Konto geschrieben.",
          )}
        </p>
        <p>
          {pick(
            locale,
            "Health data is stored only after a separate consent on the last step of a new file. That consent is recorded with the time the server received it. You can delete the account from Today. Deletion removes the file, the pairs, and the payment rows tied to the account.",
            "Gesundheitsdaten werden erst nach einer gesonderten Einwilligung im letzten Schritt einer neuen Akte gespeichert. Diese Einwilligung wird mit dem Zeitpunkt vermerkt, zu dem der Server sie erhalten hat. Sie können das Konto unter Heute löschen. Die Löschung entfernt die Akte, die Paare und die Zahlungszeilen, die am Konto hängen.",
          )}
        </p>
        <p>
          {pick(
            locale,
            "Staff can open a member file. Opening it is written down with the staff email and the time.",
            "Das Team kann eine Mitgliederakte öffnen. Das Öffnen wird mit der E-Mail des Teams und der Uhrzeit festgehalten.",
          )}
        </p>
        <p>
          {pick(
            locale,
            "A buddy you accept can see whether the morning check-in was kept, and the last seven daily scores beside their own. Meals and workouts stay private. The board lists only people on this server who opted in. It does not publish you off this server.",
            "Ein Buddy, den Sie annehmen, sieht, ob der Morgen-Check-in gehalten wurde, und die letzten sieben Tageswerte neben den eigenen. Mahlzeiten und Training bleiben privat. Die Tafel listet nur Menschen auf diesem Server, die zugestimmt haben. Sie veröffentlicht Sie nicht außerhalb dieses Servers.",
          )}
        </p>
        <p>
          {pick(
            locale,
            "You can ask what is stored, ask for a correction, and ask for deletion. Deletion of the health file is on Today. Write to the imprint email to use these rights, or to complain to the data protection authority for your place of residence.",
            "Sie können erfragen, was gespeichert ist, eine Berichtigung verlangen und die Löschung verlangen. Die Löschung der Gesundheitsakte liegt unter Heute. Schreiben Sie an die E-Mail im Impressum, um diese Rechte zu nutzen, oder um sich bei der Datenschutzbehörde an Ihrem Wohnort zu beschweren.",
          )}
        </p>
      </div>
      <p className="mt-8 text-sm">
        <Link href="/legal/imprint" className="text-primary hover:underline">
          {pick(locale, "Imprint", "Impressum")}
        </Link>
      </p>
    </main>
  )
}
