import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Package2 } from "lucide-react"

export default function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container-highest mb-6">
        <Package2 className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-headline-lg text-foreground">{t("notFound.title")}</h1>
      <p className="mt-2 text-body-md text-muted-foreground">{t("notFound.message")}</p>
      <Link to="/" className="mt-6">
        <Button>{t("notFound.goHome")}</Button>
      </Link>
    </div>
  )
}
