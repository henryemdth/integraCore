import * as React from "react"
import { cn } from "@/lib/utils"

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  initials?: string
  fallback?: React.ReactNode
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, initials, fallback, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-label-caps font-bold",
        className
      )}
      {...props}
    >
      {initials ?? fallback ?? <span className="text-xs">?</span>}
    </div>
  )
)
Avatar.displayName = "Avatar"

export { Avatar }
