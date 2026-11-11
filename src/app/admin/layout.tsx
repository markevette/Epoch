"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminShell } from "@/components/admin-shell"
import { useHealth } from "@/components/health-provider"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ready, account } = useHealth()
  const router = useRouter()

  useEffect(() => {
    if (!ready) return
    if (!account) router.replace("/login")
    else if (account.role !== "admin") router.replace("/home")
  }, [ready, account, router])

  if (!ready || account?.role !== "admin") {
    return (
      <div className="grid min-h-screen place-items-center">
        <p className="font-display text-4xl">Epoch</p>
      </div>
    )
  }

  return <AdminShell>{children}</AdminShell>
}
