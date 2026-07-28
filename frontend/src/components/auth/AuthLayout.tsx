import { Package2 } from "lucide-react"
import { useTranslation } from "react-i18next"

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-surface-container-low items-center justify-center p-12">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Package2 className="h-7 w-7" />
            </div>
            <h1 className="text-headline-lg text-primary tracking-tight">integraCore</h1>
          </div>
          <h2 className="text-headline-md text-foreground mb-3">{t("auth.brandTitle")}</h2>
          <p className="text-body-lg text-muted-foreground">{t("auth.brandDesc")}</p>
          <div className="mt-12 flex gap-3">
            <div className="h-1 w-12 rounded-full bg-primary" />
            <div className="h-1 w-8 rounded-full bg-primary/30" />
            <div className="h-1 w-4 rounded-full bg-primary/15" />
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Package2 className="h-5 w-5" />
            </div>
            <h1 className="text-headline-sm text-primary">integraCore</h1>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
