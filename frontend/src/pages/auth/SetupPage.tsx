import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { Loader2, Upload } from "lucide-react"

type SetupMode = "choose" | "start-fresh" | "restore"

export default function SetupPage() {
  const [mode, setMode] = useState<SetupMode>("choose")
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [isSqlite, setIsSqlite] = useState(true)
  const { setup, user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api
      .get("/api/auth/setup-status")
      .then((res) => {
        if (!res.data.needsSetup) {
          navigate("/login")
        }
      })
      .finally(() => setChecking(false))
  }, [navigate])

  useEffect(() => {
    api
      .get("/api/system/info")
      .then((res) => setIsSqlite(res.data.dbDriver === "sqlite"))
      .catch(() => setIsSqlite(true))
  }, [])

  useEffect(() => {
    if (user) navigate("/")
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await setup(username, password, fullName)
      navigate("/")
    } catch (err: any) {
      setError(err.response?.data?.error || t("auth.setupFailed"))
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (file: File) => {
    setError("")
    setRestoreLoading(true)
    try {
      const buf = await file.arrayBuffer()
      const base64 = btoa(new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), ""))
      await api.post("/api/backup/restore", { file: base64 })
      const status = await api.get("/api/auth/setup-status")
      if (status.data.needsSetup) {
        setMode("start-fresh")
      } else {
        navigate("/login")
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t("common.error"))
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

  if (mode === "choose") {
    return (
      <AuthLayout>
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
                      if (!confirm(t("settings.backup.confirmRestore"))) {
                        e.target.value = ""
                        return
                      }
                      handleRestore(file)
                    }
                    e.target.value = ""
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      </AuthLayout>
    )
  }

  if (mode === "restore") {
    return (
      <AuthLayout>
        <Card className="border-0 shadow-none lg:border lg:shadow-subtle">
          <CardContent className="pt-6 space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <p className="text-body-sm text-muted-foreground">{t("auth.fallbackToFresh")}</p>
            <Button onClick={() => setMode("start-fresh")} className="w-full">
              {t("auth.createAdmin")}
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Card className="border-0 shadow-none lg:border lg:shadow-subtle">
        <CardHeader>
          <CardTitle className="text-headline-md">{t("auth.createAdmin")}</CardTitle>
          <CardDescription>{t("auth.setupDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
    </AuthLayout>
  )
}
