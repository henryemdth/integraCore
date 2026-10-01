import brandMarkUrl from "@/assets/brand-mark.png"

// Decorative brand tile — the app name lives in the surrounding text, not here.
export function BrandMark({ className }: { className?: string }) {
  return <img src={brandMarkUrl} alt="" className={className} draggable={false} />
}
