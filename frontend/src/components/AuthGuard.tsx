import { useState, useEffect } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import api from "@/lib/api"

export default function AuthGuard() {
  const { user, loading } = useAuth()
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)

  useEffect(() => {
    api.get("/api/auth/setup-status").then((res) => {
      setNeedsSetup(res.data.needsSetup)
    })
  }, [])

  if (loading || needsSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (needsSetup) {
    return <Navigate to="/setup" replace />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
