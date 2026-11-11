import { ImprintView } from "@/components/imprint-view"
import { legalOperator } from "@/lib/legal"

export default function ImprintPage() {
  return <ImprintView operator={legalOperator()} />
}
