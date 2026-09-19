import { cn } from "@/lib/utils"

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border bg-card text-card-foreground shadow-[0_1px_2px_oklch(0.4_0.05_260/0.04),0_8px_24px_-12px_oklch(0.4_0.08_260/0.12)]", className)}
      {...props}
    />
  )
}
