import type { CapacitorConfig } from "@capacitor/cli"

const nativeUrl = process.env.EPOCH_NATIVE_URL?.trim()

const config: CapacitorConfig = {
  appId: "app.epoch.loop",
  appName: "Epoch",
  webDir: "public",
  server: {
    url: nativeUrl || "http://10.0.2.2:4317",
    cleartext: true,
  },
  plugins: {
    LocalNotifications: {
      iconColor: "#1c3d32",
    },
  },
}

export default config
