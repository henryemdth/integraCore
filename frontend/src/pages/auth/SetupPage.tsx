import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "@tanstack/react-query"
import { useSetupStatus } from "@/hooks/useSetupStatus"
import api from "@/lib/api"
import { fileToBase64 } from "@/lib/files"
import { queryKeys } from "@/lib/queryKeys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Loader2, Upload } from "lucide-react"
import { getErrorMessage } from "@/lib/errorMessages"

type SetupMode = "choose" | "start-fresh"

export default function SetupPage() {
  const [mode, setMode] = useState<SetupMode>("choose")
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null)
  const { setup, user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // Public endpoint: /api/system/info is auth-gated, so the setup gate also
  // carries the driver to decide whether to offer backup restore.
  const { data: setupStatus, isLoading: checking } = useSetupStatus()
  const isSqlite = (setupStatus?.dbDriver ?? "sqlite") === "sqlite"

  useEffect(() => {
    if (setupStatus && !setupStatus.needsSetup) {
      navigate("/login")
    }
  }, [setupStatus, navigate])

  useEffect(() => {
    if (user) navigate("/")
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    // App-side validation (noValidate on the form) keeps every message in the
    // user's language — browser-native checks would show in the OS language.
    if (username.trim().length < 3) {
      setError(t("auth.usernameTooShort"))
      return
    }
    if (password.length < 6) {
      setError(t("auth.passwordTooShort"))
      return
    }
    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"))
      return
    }
    setLoading(true)
    try {
      await setup(username, password, fullName)
      navigate("/")
    } catch (err: unknown) {
      setError(getErrorMessage(err, "auth.setupFailed"))
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (file: File) => {
    setError("")
    setRestoreLoading(true)
    try {
      const base64 = await fileToBase64(file)
      await api.post("/api/backup/restore", { file: base64 }, { timeout: 60000 })
      // Re-run the gate against the restored data. staleTime: 0 bypasses the
      // cached setup-status — the users table may have changed completely.
      const status = await queryClient.fetchQuery({
        queryKey: queryKeys.auth.setupStatus,
        queryFn: async () => {
          const res = await api.get("/api/auth/setup-status")
          return { needsSetup: res.data.needsSetup as boolean, dbDriver: res.data.dbDriver as string }
        },
        staleTime: 0,
      })
      if (status.needsSetup) {
        setMode("start-fresh")
      } else {
        navigate("/login")
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "auth.setupFailed"))
    } finally {
      setRestoreLoading(false)
    }
  }

  if (checking) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      {mode === "choose" && (
        <Card className="border-0 shadow-none lg:border lg:shadow-subtle">
          <CardHeader>
            <CardTitle className="text-headline-md">{t("auth.createAdmin")}</CardTitle>
            <CardDescription>{t("auth.setupDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button onClick={() => setMode("start-fresh")} className="w-full" size="lg">
              {t("auth.startFresh")}
            </Button>
            {isSqlite && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">{t("common.or")}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  disabled={restoreLoading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {restoreLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {restoreLoading ? t("auth.restoring") : t("auth.restoreFromBackup")}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sqlite,.db"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setPendingRestoreFile(file)
                    }
                    e.target.value = ""
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "start-fresh" && (
        <Card className="border-0 shadow-none lg:border lg:shadow-subtle">
          <CardHeader>
            <CardTitle className="text-headline-md">{t("auth.createAdmin")}</CardTitle>
            <CardDescription>{t("auth.setupDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-label-caps">{t("auth.fullName")}</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("auth.fullName")}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-label-caps">{t("auth.username")}</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("users.create.min3chars")}
                  required
                  minLength={3}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-label-caps">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("users.create.min6chars")}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-label-caps">{t("auth.confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("auth.confirmPassword")}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {loading ? t("auth.creatingAccount") : t("auth.createAdmin")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={pendingRestoreFile !== null}
        onOpenChange={(open: boolean) => { if (!open) setPendingRestoreFile(null) }}
        title={t("settings.backup.confirmRestoreTitle")}
        description={t("settings.backup.confirmRestore")}
        confirmLabel={t("settings.backup.restoreBtn")}
        destructive
        pending={restoreLoading}
        onConfirm={() => { const file = pendingRestoreFile; setPendingRestoreFile(null); if (file) handleRestore(file) }}
      />
    </AuthLayout>
  )
}
