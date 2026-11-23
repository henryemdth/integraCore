import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useTranslation } from "react-i18next"
import { useSetupStatus } from "@/hooks/useSetupStatus"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { Loader2, Eye, EyeOff, Wifi, CheckCircle2, XCircle, Save } from "lucide-react"
import { getErrorMessage } from "@/lib/errorMessages"
import { setBackendUrl } from "@/lib/api"
import { toast } from "sonner"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const isClient = window.electronAPI?.platform === "client"
  const [showServerConfig, setShowServerConfig] = useState(false)
  const [serverUrl, setServerUrl] = useState("")
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "ok" | "fail">("unknown")
  const { login } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    if (isClient && window.electronAPI?.getBackendUrl) {
      window.electronAPI.getBackendUrl().then((url: string) => {
        setServerUrl(url)
      })
    }
  }, [isClient])

  // First-run gate: on an empty users table the server has no accounts yet,
  // so send the visitor to the setup screen instead of letting them fail to log in.
  const { data: setupStatus, isLoading: checking } = useSetupStatus()

  useEffect(() => {
    if (setupStatus?.needsSetup) {
      navigate("/setup")
    }
  }, [setupStatus, navigate])

  if (checking) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AuthLayout>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await login(username, password)
      navigate("/")
    } catch (err: unknown) {
      setError(getErrorMessage(err, "auth.loginFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Card className="border-0 shadow-none lg:border lg:shadow-subtle">
        <CardHeader>
          <CardTitle className="text-headline-md">{t("auth.signIn")}</CardTitle>
          <CardDescription>{t("auth.signInDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-label-caps">{t("auth.username")}</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("auth.username")}
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-label-caps">{t("auth.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.password")}
                  required
                  autoComplete="current-password"
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
          {isClient && (
            <div className="mt-4 pt-4 border-t border-border space-y-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => setShowServerConfig((v) => !v)}
              >
                <Wifi className="h-4 w-4 mr-2" />
                {t("settings.connection.title")}
              </Button>
              {showServerConfig && (
                <div className="space-y-2">
                  <Label htmlFor="login-server-url" className="text-label-caps">{t("settings.connection.serverUrl")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="login-server-url"
                      value={serverUrl}
                      onChange={(e) => { setServerUrl(e.target.value); setConnectionStatus("unknown") }}
                      placeholder="http://192.168.1.100:3001"
                      className="flex-1 font-data"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={testingConnection || !serverUrl}
                      onClick={async () => {
                        setTestingConnection(true)
                        setConnectionStatus("unknown")
                        try {
                          if (window.electronAPI?.testConnection) {
                            const ok = await window.electronAPI.testConnection(serverUrl)
                            setConnectionStatus(ok ? "ok" : "fail")
                            if (ok) toast.success(t("settings.connection.testOk"))
                            else toast.error(t("settings.connection.testFail"))
                          }
                        } catch {
                          setConnectionStatus("fail")
                          toast.error(t("settings.connection.testFail"))
                        } finally {
                          setTestingConnection(false)
                        }
                      }}
                    >
                      {testingConnection ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : connectionStatus === "ok" ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : connectionStatus === "fail" ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        t("settings.connection.test")
                      )}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={!serverUrl}
                    onClick={async () => {
                      if (window.electronAPI?.setBackendUrl) {
                        const saved = await window.electronAPI.setBackendUrl(serverUrl)
                        if (saved) {
                          setBackendUrl(serverUrl)
                          toast.success(t("settings.connection.saved"))
                        } else {
                          toast.error(t("settings.connection.testFail"))
                        }
                      }
                    }}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {t("settings.connection.save")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
