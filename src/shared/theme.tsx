import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cx } from "../components/ui";

export type Theme = "system" | "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem("aegis-theme") as Theme) || "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("aegis-theme", theme);
    } catch {
      /* trình duyệt chặn lưu trữ */
    }
  }, [theme]);
  return [theme, setTheme] as const;
}

export function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  const items: { id: Theme; icon: typeof Sun; label: string }[] = [
    { id: "light", icon: Sun, label: "Sáng" },
    { id: "system", icon: Monitor, label: "Theo hệ thống" },
    { id: "dark", icon: Moon, label: "Tối" },
  ];
  return (
    <div className="flex shrink-0 rounded-md border border-line-subtle p-0.5" role="radiogroup" aria-label="Giao diện">
      {items.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          role="radio"
          aria-checked={theme === id}
          aria-label={label}
          title={label}
          onClick={() => onChange(id)}
          className={cx("interactive grid size-7 place-items-center rounded-sm", theme === id ? "bg-bg-sunken text-fg-primary" : "text-fg-tertiary")}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
