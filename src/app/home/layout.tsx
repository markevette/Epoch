"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Shell } from "@/components/shell"
import { useHealth } from "@/components/health-provider"

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const { ready, account } = useHealth()
  const router = useRouter()

  useEffect(() => {
    if (!ready) return
    if (!account) router.replace("/login")
    else if (account.role === "admin") router.replace("/admin")
    else if (!account.profile) router.replace("/onboarding")
  }, [ready, account, router])

  if (!ready || account?.role !== "member" || !account.profile) {
    return (
      <div className="grid min-h-screen place-items-center">
        <p className="font-display text-4xl">Epoch</p>
      </div>
    )
  }

  return <Shell>{children}</Shell>
}
