import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { epochManifest, installSurface, isIosDevice, isOurInstalledApp } from "../src/lib/web-app"

function pngSize(path: string) {
  const bytes = readFileSync(path)
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a")
  assert.equal(bytes.subarray(12, 16).toString("ascii"), "IHDR")
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe("install surface", () => {
  it("hides the control inside the installed app", async () => {
    assert.equal(installSurface({ standalone: true, ios: true, installedRelated: true }), "hidden")
  })

  it("opens the app when this site is already installed", async () => {
    assert.equal(installSurface({ standalone: false, ios: false, installedRelated: true }), "open")
  })

  it("keeps iPhone on the Home Screen steps", async () => {
    assert.equal(installSurface({ standalone: false, ios: true, installedRelated: false }), "ios")
  })

  it("shows install on a phone and on a desktop until the app is installed", async () => {
    assert.equal(installSurface({ standalone: false, ios: false, installedRelated: false }), "install")
  })

  it("recognises an iPad that reports itself as a Mac", async () => {
    assert.equal(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)", "iPhone", 5), true)
    assert.equal(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5), true)
    assert.equal(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0), false)
  })

  it("matches only this site's web app", async () => {
    const apps = [
      { platform: "play", url: "https://play.google.com/store/apps/details?id=app" },
      { platform: "webapp", url: "https://epoch.example/manifest.webmanifest" },
    ]
    assert.equal(isOurInstalledApp(apps, "https://epoch.example"), true)
    assert.equal(isOurInstalledApp(apps, "https://other.example"), false)
    assert.equal(isOurInstalledApp([{ platform: "webapp", url: "not a url" }], "https://epoch.example"), false)
  })
})

describe("web app manifest", () => {
  it("points the browser at this site and keeps store preference off", async () => {
    const manifest = epochManifest("https://epoch.example/")
    assert.equal(manifest.display, "standalone")
    assert.equal(manifest.start_url, "/")
    assert.equal(manifest.prefer_related_applications, false)
    assert.equal(manifest.related_applications?.[0]?.platform, "webapp")
    assert.equal(manifest.related_applications?.[0]?.url, "https://epoch.example/manifest.webmanifest")
    assert.equal(manifest.protocol_handlers?.[0]?.protocol, "web+epoch")
    assert.equal(manifest.protocol_handlers?.[0]?.url, "/?open=%s")
    const icons = manifest.icons ?? []
    assert.ok(icons.some((icon) => icon.sizes === "192x192" && icon.purpose === "any"))
    assert.ok(icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any"))
    assert.ok(icons.some((icon) => icon.sizes === "192x192" && icon.purpose === "maskable"))
    assert.ok(icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"))
  })

  it("ships square icons at the sizes the install prompt requires", async () => {
    assert.deepEqual(pngSize("public/icons/icon-192.png"), { width: 192, height: 192 })
    assert.deepEqual(pngSize("public/icons/icon-512.png"), { width: 512, height: 512 })
    assert.deepEqual(pngSize("public/icons/icon-maskable-192.png"), { width: 192, height: 192 })
    assert.deepEqual(pngSize("public/icons/icon-maskable-512.png"), { width: 512, height: 512 })
    assert.deepEqual(pngSize("public/icons/apple-touch-icon.png"), { width: 180, height: 180 })
  })
})
