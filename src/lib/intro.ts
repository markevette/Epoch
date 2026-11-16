export const INTRO_SEEN = "epoch.intro"
export const INTRO_PENDING = "epoch.intro.now"

export function introShouldOpen(input: { seen: boolean; standalone: boolean; pending: boolean }): boolean {
  if (input.seen) return false
  return input.standalone || input.pending
}
