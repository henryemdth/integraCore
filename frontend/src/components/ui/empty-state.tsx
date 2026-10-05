import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { PackageOpen } from "lucide-react"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  /** Optional call-to-action, e.g. an "add the first product" button. */
  action?: ReactNode
}

// Friendly dead-end replacement for the plain "no results" row: explains the
// situation and offers the next step, so first-time users are never stuck
// staring at an empty table.
export function EmptyState({ icon: Icon = PackageOpen, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="h-14 w-14 rounded-full bg-primary/5 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-muted-foreground/60" />
      </div>
      <p className="text-body-md font-medium">{title}</p>
      {description && <p className="text-body-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
