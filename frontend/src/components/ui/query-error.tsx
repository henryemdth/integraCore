import { useTranslation } from "react-i18next"
import { AlertTriangle, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"

interface QueryErrorStateProps {
  onRetry: () => void
  /** The query's error, when available: lets us tell "server unreachable" (a
   * LAN machine being off) apart from any other failure. */
  error?: unknown
}

export function QueryErrorState({ onRetry, error }: QueryErrorStateProps) {
  const { t } = useTranslation()

  // Axios network failures have no response: on a LAN install this almost
  // always means the server machine is off or the address is wrong — say so
  // instead of the generic "couldn't load" text.
  const e = error as { isAxiosError?: boolean; response?: unknown } | undefined
  const isNetworkError = e?.isAxiosError && !e.response

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      {isNetworkError ? <WifiOff className="h-8 w-8 text-destructive" /> : <AlertTriangle className="h-8 w-8 text-destructive" />}
      <p className="text-body-md text-muted-foreground">
        {isNetworkError ? t("common.serverUnreachable") : t("common.loadError")}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  )
}
