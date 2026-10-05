import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

// Compact ES/EN toggle for places outside Settings (login screen, sidebar) —
// sellers have no access to Settings but do need to switch the UI language.
export function LanguageToggle({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()

  const change = (lng: string) => {
    i18n.changeLanguage(lng)
    localStorage.setItem("i18n_language", lng)
  }

  return (
    <div
      className={cn("inline-flex items-center rounded-md border border-border p-0.5", className)}
      role="group"
      aria-label={t("settings.language.title")}
    >
      {(["es", "en"] as const).map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => change(lng)}
          aria-pressed={i18n.language === lng}
          className={cn(
            "px-2 py-1 text-xs font-medium rounded-sm transition-colors",
            i18n.language === lng ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
