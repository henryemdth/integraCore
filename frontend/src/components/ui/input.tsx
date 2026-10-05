import * as React from "react"
import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Focus keeps the Material underline but adds a faint primary glow so
          // the focused field is unmistakable for low-vision / novice users.
          "flex h-11 w-full rounded bg-surface-container px-3 py-2 text-body-md text-foreground placeholder:text-muted-foreground border border-b-2 border-border border-b-transparent focus:outline-none focus:border-b-primary focus:ring-0 focus-visible:shadow-[0_1px_0_0_hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
