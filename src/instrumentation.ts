export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPushLoop } = await import("./lib/push-dispatch")
    startPushLoop()
  }
}
