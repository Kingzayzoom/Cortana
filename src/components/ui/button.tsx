import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
export function Button({
  className,
  variant = "primary",
  asChild = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn("button", `button-${variant}`, className)} {...props} />
  );
}
