import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface">
      <h1 className="text-headline-lg text-muted-foreground">{t("notFound.title")}</h1>
      <p className="mt-4 text-body-lg text-muted-foreground">{t("notFound.message")}</p>
      <Link to="/" className="mt-6">
        <Button>{t("notFound.goHome")}</Button>
      </Link>
    </div>
  )
}
