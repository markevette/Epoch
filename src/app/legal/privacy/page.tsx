import { PrivacyView } from "@/components/privacy-view"
import { legalOperator } from "@/lib/legal"

export default function PrivacyPage() {
  return <PrivacyView operator={legalOperator()} />
}
