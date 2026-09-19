"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AudioLines, CalendarDays, Headphones, LayoutGrid, LibraryBig, Settings, UserRound } from "lucide-react"

import { APP_NAME, DEMO_PROFILE } from "@/lib/config"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Today", icon: CalendarDays },
  { href: "/rounds", label: "My Rounds", icon: Headphones },
  { href: "/evidence", label: "Evidence", icon: LibraryBig },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const

// Planned sections, shown disabled so the navigation matches the design.
const SOON = [
  { label: "Topics", icon: LayoutGrid },
  { label: "Settings", icon: Settings },
] as const

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 z-30 flex shrink-0 items-center gap-1 border-b bg-card/80 px-3 py-2 backdrop-blur md:h-screen md:w-[88px] md:flex-col md:border-r md:border-b-0 md:px-2 md:py-5">
      <Link href="/" className="mr-2 flex items-center gap-2 md:mr-0 md:mb-6 md:flex-col md:gap-1" aria-label={`${APP_NAME} home`}>
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary via-[oklch(0.62_0.17_280)] to-cyan text-primary-foreground shadow-sm">
          <AudioLines className="size-5" />
        </span>
        <span className="text-sm font-semibold tracking-tight md:text-[0.7rem]">{APP_NAME}</span>
      </Link>

      <nav className="flex flex-1 items-center gap-1 overflow-x-auto md:w-full md:flex-col md:overflow-visible">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:w-full md:flex-col md:gap-1 md:px-1 md:py-2.5 md:text-[0.68rem]",
                active && "bg-accent font-medium text-accent-foreground",
              )}
            >
              <Icon className="size-[18px]" />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          )
        })}
        {SOON.map(({ label, icon: Icon }) => (
          <span
            key={label}
            aria-disabled="true"
            title="Coming soon"
            className="hidden shrink-0 cursor-not-allowed flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[0.68rem] text-muted-foreground/50 md:flex md:w-full"
          >
            <Icon className="size-[18px]" />
            {label}
          </span>
        ))}
      </nav>

      <div className="hidden flex-col items-center gap-1 md:flex" title={`${DEMO_PROFILE.name} · Demo profile`}>
        <span className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
          MP
        </span>
        <span className="text-[0.6rem] text-muted-foreground">Demo</span>
      </div>
    </aside>
  )
}
