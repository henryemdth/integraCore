import { useState, useEffect } from "react"
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
import { Save, TrendingUp, TrendingDown, Globe, DollarSign } from "lucide-react"

export default function ProfitSettingsPage() {
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation()
  const [targetAmount, setTargetAmount] = useState("")
  const [periodDays, setPeriodDays] = useState("")
  const [currency, setCurrency] = useState(() => getCurrencySymbol())

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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h2>

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
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("settings.profit.revenue")}</span>
                  <span className="text-lg font-bold">{formatCurrency(check.revenue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("settings.profit.target")}</span>
                  <span className="text-lg font-bold">{formatCurrency(check.target_amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("settings.profit.progress")}</span>
                  <Badge variant={check.behind ? "destructive" : "default"}>
                    {check.behind ? <TrendingDown className="h-3 w-3 mr-1" /> : <TrendingUp className="h-3 w-3 mr-1" />}
                    {check.percentage}%
                  </Badge>
                </div>
                {check.behind && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("settings.profit.gap")}</span>
                    <span className="text-sm font-medium text-destructive">{t("settings.profit.behind", { amount: formatCurrency(check.gap) })}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("settings.profit.period")}</span>
                  <span className="text-sm">{t("settings.profit.daysLabel", { days: check.period_days })}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("settings.profit.noTarget")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t("settings.language.title")}
          </CardTitle>
          <CardDescription>{t("settings.language.label")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={i18n.language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="es">{t("settings.language.spanish")}</SelectItem>
              <SelectItem value="en">{t("settings.language.english")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t("settings.currency.title")}
          </CardTitle>
          <CardDescription>{t("settings.currency.label")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={currency} onValueChange={(v) => { setCurrency(v); localStorage.setItem("currency_symbol", v) }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Bs.">Bs. (Bolívar)</SelectItem>
              <SelectItem value="$">$ (Dólar)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  )
}
