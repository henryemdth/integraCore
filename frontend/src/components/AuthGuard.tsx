import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useTranslation } from "react-i18next"

// Route-level guard: requires authentication, and optionally one of the given
// roles (the backend enforces permissions too — this just keeps users off
// screens their role can't use, even when typing the URL directly).
export default function AuthGuard({ roles }: { roles?: string[] }) {
  const { user, loading } = useAuth()
  const { t } = useTranslation()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t("common.loading")}</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
