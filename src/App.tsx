import { useEffect, useState } from "react";
import { Monitor, Moon, Palette, ShieldCheck, Smartphone, Sun } from "lucide-react";
import { cx } from "./components/ui";
import DesignSystemPage from "./ds/DesignSystemPage";
import MobileFlowPage from "./mobile/MobileFlowPage";
import CompliancePage from "./web/CompliancePage";

type View = "design-system" | "mobile" | "compliance";
type Theme = "system" | "light" | "dark";

const VIEWS: { id: View; label: string; short: string; icon: typeof Palette }[] = [
  { id: "mobile", label: "Mobile eKYC", short: "Mobile", icon: Smartphone },
  { id: "compliance", label: "Web Compliance", short: "Compliance", icon: ShieldCheck },
  { id: "design-system", label: "Design System", short: "Hệ thống", icon: Palette },
];

const readHash = (): View => {
  const h = location.hash.replace("#", "") as View;
  return VIEWS.some((v) => v.id === h) ? h : "mobile";
};

export default function App() {
  const [view, setView] = useState<View>(readHash);
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem("aegis-theme") as Theme) || "system";
    } catch {
      return "system";
    }
  });

  useEffect(() => {
    const onHash = () => setView(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("aegis-theme", theme);
    } catch {
      /* bỏ qua khi trình duyệt chặn lưu trữ */
    }
  }, [theme]);

  const go = (v: View) => {
    location.hash = v;
    setView(v);
  };

  const themes: { id: Theme; icon: typeof Sun; label: string }[] = [
    { id: "light", icon: Sun, label: "Sáng" },
    { id: "system", icon: Monitor, label: "Theo hệ thống" },
    { id: "dark", icon: Moon, label: "Tối" },
  ];

  return (
    <div className="min-h-full">
      <header className="sticky z-30 border-b border-line-subtle bg-bg-surface" style={{ top: "env(safe-area-inset-top, 0px)" }}>
        <div className="gutter mx-auto flex h-14 max-w-[1320px] items-center gap-3">
          <a href="#mobile" onClick={() => go("mobile")} className="flex items-center gap-2 shrink-0" aria-label="Aegis eKYC — trang đầu">
            <span className="grid size-8 place-items-center rounded-md bg-action text-action-fg">
              <ShieldCheck className="size-[18px]" aria-hidden />
            </span>
            <span className="hidden sm:block leading-tight">
              <span className="block text-body-sm font-bold">Aegis</span>
              <span className="block text-caption text-fg-tertiary">eKYC</span>
            </span>
          </a>

          <nav className="flex flex-1 justify-center gap-1 min-w-0" aria-label="Chế độ xem">
            {VIEWS.map(({ id, label, short, icon: Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(id);
                }}
                aria-current={view === id ? "page" : undefined}
                className={cx(
                  "interactive inline-flex h-9 items-center gap-2 rounded-md px-2.5 sm:px-3 text-body-sm font-medium",
                  view === id ? "bg-action-subtle text-action-subtle-fg" : "text-fg-secondary",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="hidden md:inline">{label}</span>
                <span className="hidden sm:inline md:hidden">{short}</span>
                <span className="sr-only sm:hidden">{label}</span>
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 rounded-md border border-line-subtle p-0.5" role="radiogroup" aria-label="Giao diện">
            {themes.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                role="radio"
                aria-checked={theme === id}
                aria-label={label}
                title={label}
                onClick={() => setTheme(id)}
                className={cx("interactive grid size-7 place-items-center rounded-sm", theme === id ? "bg-bg-sunken text-fg-primary" : "text-fg-tertiary")}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="gutter mx-auto max-w-[1320px] py-6">
        {view === "mobile" && <MobileFlowPage />}
        {view === "compliance" && <CompliancePage />}
        {view === "design-system" && <DesignSystemPage />}
      </main>
    </div>
  );
}
