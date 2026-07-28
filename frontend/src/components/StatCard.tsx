import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: "up" | "down" | "neutral"
  trendLabel?: string
  className?: string
  loading?: boolean
}

function StatCard({ label, value, icon: Icon, trend, trendLabel, className, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className={cn("rounded-lg bg-card border border-border shadow-subtle p-5", className)}>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-5 rounded" />
        </div>
        <Skeleton className="h-7 w-20 mb-1" />
        <Skeleton className="h-3 w-16" />
      </div>
    )
  }

  return (
    <div className={cn("rounded-lg bg-card border border-border shadow-subtle p-5", className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-label-caps text-muted-foreground">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="text-data-lg text-foreground font-data">{value}</p>
      {trendLabel && (
        <p className={cn(
          "text-body-sm mt-1",
          trend === "up" && "text-success-foreground",
          trend === "down" && "text-destructive",
          trend === "neutral" && "text-muted-foreground"
        )}>
          {trendLabel}
        </p>
      )}
    </div>
  )
}

export { StatCard }
