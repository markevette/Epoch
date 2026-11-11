export function cookieIsSecure(env: {
  nodeEnv?: string
  forwardedProto?: string | null
  override?: string | null
}): boolean {
  const override = env.override?.trim()
  if (override === "0") return false
  if (override === "1") return true
  const proto = env.forwardedProto?.split(",")[0]?.trim().toLowerCase()
  if (proto === "https") return true
  if (proto === "http") return false
  return env.nodeEnv === "production"
}
