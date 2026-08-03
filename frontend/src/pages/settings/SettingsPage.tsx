import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { formatCurrency, getCurrencySymbol } from "@/lib/format"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { ChangePasswordDialog } from "@/components/users/ChangePasswordDialog"
import { Save, TrendingUp, TrendingDown, Globe, DollarSign, Shield, Download, Upload, Database, Loader2, Wifi, CheckCircle2, XCircle } from "lucide-react"

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation()
  const [targetAmount, setTargetAmount] = useState("")
  const [periodDays, setPeriodDays] = useState("")
  const [currency, setCurrency] = useState(() => getCurrencySymbol())
  const [pwdOpen, setPwdOpen] = useState(false)
  const [isSqlite, setIsSqlite] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isClient = window.electronAPI?.platform === "client"
  const [serverUrl, setServerUrl] = useState("")
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "ok" | "fail">("unknown")
  const [testingConnection, setTestingConnection] = useState(false)

  const { data: systemInfo } = useQuery({
    queryKey: ["system-info"],
    queryFn: async () => {
      const res = await api.get("/api/system/info")
      return res.data
    },
  })

  useEffect(() => {
    if (systemInfo) {
      setIsSqlite(systemInfo.dbDriver === "sqlite")
    }
  }, [systemInfo])

  useEffect(() => {
    if (isClient && window.electronAPI?.getBackendUrl) {
      window.electronAPI.getBackendUrl().then((url: string) => {
        setServerUrl(url)
      })
    }
  }, [isClient])

  const { data: target, isLoading: targetLoading } = useQuery({
    queryKey: ["profit-target"],
    queryFn: async () => {
      const res = await api.get("/api/profit/target")
      return res.data.target
    },
  })

  const { data: check, isLoading: checkLoading } = useQuery({
    queryKey: ["profit-check"],
    queryFn: async () => {
      const res = await api.get("/api/profit/check")
      return res.data
    },
  })

  useEffect(() => {
    if (target) {
      setTargetAmount(String(target.target_amount))
      setPeriodDays(String(target.period_days))
    }
  }, [target])

  const saveMutation = useMutation({
    mutationFn: () => api.put("/api/profit/target", {
      target_amount: parseFloat(targetAmount),
      period_days: parseInt(periodDays),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profit-target"] })
      queryClient.invalidateQueries({ queryKey: ["profit-check"] })
      toast.success(t("settings.profit.saved"))
    },
    onError: (err: any) => toast.error(err.response?.data?.error || t("settings.profit.failedSave")),
  })

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang)
    localStorage.setItem("i18n_language", lang)
  }

  const canSave = targetAmount !== "" && periodDays !== "" && parseInt(periodDays) >= 1 && parseFloat(targetAmount) >= 0

  return (
    <div className="space-y-8">
      <h2 className="text-headline-lg">{t("settings.title")}</h2>

      {/* Revenue Target Section */}
      <div className="space-y-3">
        <h3 className="text-label-caps text-muted-foreground">{t("settings.sections.revenueTarget")}</h3>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.profit.targetConfig")}</CardTitle>
              <CardDescription>{t("settings.profit.targetDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {targetLoading ? (
                <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="target">{t("settings.profit.revenueTarget")}</Label>
                    <Input
                      id="target"
                      type="number"
                      min="0"
                      step="0.01"
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      placeholder="0.00"
                      className="font-data"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period">{t("settings.profit.checkPeriod")}</Label>
                    <Input
                      id="period"
                      type="number"
                      min="1"
                      value={periodDays}
                      onChange={(e) => setPeriodDays(e.target.value)}
                      placeholder="15"
                      className="font-data"
                    />
                  </div>
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={!canSave || saveMutation.isPending}
                    className="w-full"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveMutation.isPending ? t("settings.profit.saving") : t("settings.profit.saveTarget")}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.profit.currentStatus")}</CardTitle>
              <CardDescription>{t("settings.profit.statusDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {checkLoading ? (
                <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
              ) : check ? (
                <>
                  <Progress value={check.percentage} className="h-3 mb-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm text-muted-foreground">{t("settings.profit.revenue")}</span>
                    <span className="text-data-lg font-data">{formatCurrency(check.revenue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm text-muted-foreground">{t("settings.profit.target")}</span>
                    <span className="text-data-lg font-data">{formatCurrency(check.target_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm text-muted-foreground">{t("settings.profit.progress")}</span>
                    <Badge variant={check.behind ? "destructive" : "success-light"}>
                      {check.behind ? <TrendingDown className="h-3 w-3 mr-1" /> : <TrendingUp className="h-3 w-3 mr-1" />}
                      <span className="font-data">{check.percentage}%</span>
                    </Badge>
                  </div>
                  {check.behind && (
                    <div className="flex items-center justify-between">
                      <span className="text-body-sm text-muted-foreground">{t("settings.profit.gap")}</span>
                      <span className="text-body-sm font-medium text-destructive font-data">{t("settings.profit.behind", { amount: formatCurrency(check.gap) })}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm text-muted-foreground">{t("settings.profit.period")}</span>
                    <span className="text-body-sm">{t("settings.profit.daysLabel", { days: check.period_days })}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("settings.profit.noTarget")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Interface Section */}
      <div className="space-y-3">
        <h3 className="text-label-caps text-muted-foreground">{t("settings.sections.interface")}</h3>
        <Card>
          <CardContent className="p-6 pt-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-body-md font-medium">{t("settings.language.title")}</Label>
                </div>
                <p className="text-body-sm text-muted-foreground">{t("settings.language.label")}</p>
                <Select value={i18n.language} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">{t("settings.language.spanish")}</SelectItem>
                    <SelectItem value="en">{t("settings.language.english")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-body-md font-medium">{t("settings.currency.title")}</Label>
                </div>
                <p className="text-body-sm text-muted-foreground">{t("settings.currency.label")}</p>
                <Select value={currency} onValueChange={(v) => { setCurrency(v); localStorage.setItem("currency_symbol", v) }}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bs.">Bs. (Bolívar)</SelectItem>
                    <SelectItem value="$">$ (Dólar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Section */}
      <div className="space-y-3">
        <h3 className="text-label-caps text-muted-foreground">{t("settings.sections.account")}</h3>
        <Card>
          <CardContent className="p-6 pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-body-md font-medium">{t("layout.changePassword")}</span>
                </div>
                <p className="text-body-sm text-muted-foreground">{t("changePassword.desc")}</p>
              </div>
              <Button variant="outline" onClick={() => setPwdOpen(true)}>
                {t("changePassword.title")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Section — SQLite only */}
      {isSqlite && (
        <div className="space-y-3">
          <h3 className="text-label-caps text-muted-foreground">{t("settings.sections.data")}</h3>
          <Card>
            <CardContent className="p-6 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-body-md font-medium">{t("settings.backup.title")}</span>
                  </div>
                  <p className="text-body-sm text-muted-foreground">{t("settings.backup.desc")}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={backupLoading}
                      onClick={async () => {
                        setBackupLoading(true)
                        try {
                          const res = await api.get("/api/backup/export", { responseType: "blob" })
                          const blob = new Blob([res.data], { type: "application/x-sqlite3" })
                          const disposition = res.headers["content-disposition"] || ""
                          const match = disposition.match(/filename="?(.+?)"?$/)
                          const fileName = match?.[1] || `backup-${new Date().toISOString().split("T")[0]}.sqlite`
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement("a")
                          a.href = url
                          a.download = fileName
                          a.click()
                          URL.revokeObjectURL(url)
                          toast.success(t("settings.backup.exported"))
                        } catch (err: any) {
                          toast.error(err.response?.data?.error || t("settings.backup.failedExport"))
                        } finally {
                          setBackupLoading(false)
                        }
                      }}
                    >
                      {backupLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      {backupLoading ? t("settings.backup.exporting") : t("settings.backup.exportBtn")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={restoreLoading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {restoreLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {restoreLoading ? t("settings.backup.restoring") : t("settings.backup.restoreBtn")}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".sqlite,.db"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (!confirm(t("settings.backup.confirmRestore"))) {
                          e.target.value = ""
                          return
                        }
                        setRestoreLoading(true)
                        try {
                          const buf = await file.arrayBuffer()
                          const base64 = btoa(new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), ""))
                          await api.post("/api/backup/restore", { file: base64 })
                          toast.success(t("settings.backup.restoreSuccess"))
                          queryClient.invalidateQueries()
                        } catch (err: any) {
                          toast.error(err.response?.data?.error || t("settings.backup.failedRestore"))
                        } finally {
                          setRestoreLoading(false)
                          e.target.value = ""
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Connection Section — Client only */}
      {isClient && (
        <div className="space-y-3">
          <h3 className="text-label-caps text-muted-foreground">{t("settings.sections.connection")}</h3>
          <Card>
            <CardContent className="p-6 pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-muted-foreground" />
                  <span className="text-body-md font-medium">{t("settings.connection.title")}</span>
                </div>
                <p className="text-body-sm text-muted-foreground">{t("settings.connection.desc")}</p>
                <div className="space-y-2">
                  <Label htmlFor="serverUrl">{t("settings.connection.serverUrl")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="serverUrl"
                      value={serverUrl}
                      onChange={(e) => { setServerUrl(e.target.value); setConnectionStatus("unknown") }}
                      placeholder="http://192.168.1.100:3001"
                      className="flex-1 font-data"
                    />
                    <Button
                      variant="outline"
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
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : connectionStatus === "ok" ? (
                        <CheckCircle2 className="h-4 w-4 mr-2 text-success" />
                      ) : connectionStatus === "fail" ? (
                        <XCircle className="h-4 w-4 mr-2 text-destructive" />
                      ) : null}
                      {t("settings.connection.test")}
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    if (window.electronAPI?.setBackendUrl) {
                      await window.electronAPI.setBackendUrl(serverUrl)
                      toast.success(t("settings.connection.saved"))
                    }
                  }}
                  disabled={!serverUrl}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {t("settings.connection.save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </div>
  )
}
