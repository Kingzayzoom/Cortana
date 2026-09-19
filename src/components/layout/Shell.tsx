"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Home,
  Layers,
  BookOpen,
  ChartNoAxesCombined,
  Shapes,
  Settings,
  HeartPulse,
  Menu,
  X,
  ChevronDown,
  AudioLines,
} from "lucide-react";
import { useLearning } from "@/lib/learning/provider";
import { useVoice } from "@/lib/voice/provider";
const navigation = [
  { href: "/", title: "Today", icon: Home },
  { href: "/rounds", title: "My Rounds", icon: Layers },
  { href: "/evidence", title: "Evidence Library", icon: BookOpen },
  { href: "/profile", title: "Learning Profile", icon: ChartNoAxesCombined },
  { href: "/topics", title: "Topics", icon: Shapes },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(),
    { data, error, refresh, clearError } = useLearning(),
    voice = useVoice();
  const [menu, setMenu] = useState(false),
    [greeting, setGreeting] = useState("Hello");
  const [mobile, setMobile] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = matchMedia("(max-width: 700px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const update = () => {
      const hour = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: data?.preferences.timezone || "America/New_York",
          hour: "numeric",
          hourCycle: "h23",
        }).format(new Date()),
      );
      setGreeting(
        hour < 12
          ? "Good morning"
          : hour < 17
            ? "Good afternoon"
            : "Good evening",
      );
    };
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [data?.preferences.timezone]);
  useEffect(() => {
    if (!menu || !mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const elements = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        ) || [],
      ).filter((e) => e.getBoundingClientRect().height > 0);
    elements()[0]?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
      if (event.key === "Tab") {
        const nodes = elements(),
          first = nodes[0],
          last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [menu, mobile]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {menu && mobile && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation backdrop"
          tabIndex={-1}
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        ref={sidebar}
        className={`sidebar ${menu ? "sidebar-open" : ""}`}
        aria-label="Primary navigation"
        inert={mobile && !menu}
        role={mobile ? "dialog" : undefined}
        aria-modal={mobile && menu ? true : undefined}
      >
        <Link
          href="/"
          className="brand"
          aria-label="Cortana home"
          onClick={() => setMenu(false)}
        >
          <span className="brand-mark" />
          cortana<span className="brand-period">.</span>
        </Link>
        <p className="brand-description">
          Clinical learning
          <br />
          that talks back.
        </p>
        <button
          className="icon-button mobile-nav-close"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X size={20} />
        </button>
        <nav className="navigation">
          {navigation.map(({ href, title, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={pathname === href ? "nav-link selected" : "nav-link"}
              onClick={() => setMenu(false)}
            >
              <Icon size={20} strokeWidth={1.65} />
              {title}
              {pathname === href && <span className="nav-indicator" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="tiny-orbit" />
            <p>
              A little learning.
              <br />A daily habit.
            </p>
          </div>
          <Link
            href="/settings"
            className={`nav-link ${pathname === "/settings" ? "selected" : ""}`}
            onClick={() => setMenu(false)}
          >
            <Settings size={20} strokeWidth={1.65} />
            Settings
          </Link>
          <div className="sidebar-footer">
            <span className="elevenlabs-attribution">
              <AudioLines size={15} />
              Voice with ElevenLabs
            </span>
            <span>VT Hacks · Educational prototype</span>
          </div>
        </div>
      </aside>
      <div className="workspace" inert={mobile && menu}>
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            <Menu size={23} />
          </button>
          <div className="header-greeting">
            <h2>
              {greeting}, {data?.preferences.name || "Dr. Patel"}.
            </h2>
            <p>Ready for today’s round?</p>
          </div>
          <div className="header-actions">
            <div className="specialty-selector">
              <HeartPulse size={19} />
              <select aria-label="Specialty">
                <option>Cardiology</option>
              </select>
              <ChevronDown size={14} />
            </div>
            <Link href="/settings" className="demo-badge">
              Demo profile
            </Link>
            <Link
              href="/profile"
              className="avatar"
              aria-label="Open learning profile"
            >
              {(data?.preferences.name || "Dr. Patel")
                .replace(/^Dr\.?\s*/i, "")
                .slice(0, 2)
                .toUpperCase()}
            </Link>
          </div>
        </header>
        {voice.connection === "connected" && pathname !== "/" && (
          <div className="ongoing-call">
            <AudioLines size={17} />
            <span>Your voice round is still active.</span>
            <Link href="/">Return to your round</Link>
            <button onClick={voice.end}>End session</button>
          </div>
        )}
        <main id="main" className="main-content">
          {error && (
            <div className="global-error" role="alert">
              <span>{error}</span>
              <button
                onClick={() => {
                  if (!data) void refresh();
                  else clearError();
                }}
              >
                {!data ? "Retry" : "Dismiss"}
              </button>
            </div>
          )}
          {children}
        </main>
        <footer className="workspace-footer">
          <span>Made for a moment of learning.</span>
          <span>Educational prototype · Synthetic cases only</span>
        </footer>
      </div>
    </div>
  );
}
