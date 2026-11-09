/* Song ngữ VI / EN — dùng tr("Tiếng Việt", "English") ngay tại chỗ để chuỗi hai ngữ luôn nằm cạnh nhau */
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { cx } from "./components/ui";

export type Lang = "vi" | "en";
export type L10n = { vi: string; en: string };

type Ctx = { lang: Lang; setLang: (l: Lang) => void; tr: (vi: string, en: string) => string; pick: (s: L10n) => string };
const LangContext = createContext<Ctx>({ lang: "vi", setLang: () => {}, tr: (vi) => vi, pick: (s) => s.vi });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem("aegis-lang");
      if (saved === "vi" || saved === "en") return saved;
    } catch {
      /* bỏ qua */
    }
    return new URLSearchParams(location.search).get("lang") === "en" ? "en" : "vi";
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("aegis-lang", lang);
    } catch {
      /* bỏ qua */
    }
  }, [lang]);
  const tr = (vi: string, en: string) => (lang === "en" ? en : vi);
  const pick = (s: L10n) => s[lang];
  return <LangContext.Provider value={{ lang, setLang, tr, pick }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** Công tắc ngôn ngữ dạng phân đoạn VI | EN */
export function LangSwitch({ onBrand }: { onBrand?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <div
      role="radiogroup"
      aria-label="Ngôn ngữ / Language"
      className={cx("flex shrink-0 rounded-full p-0.5 text-caption font-bold", onBrand ? "bg-white/15" : "bg-bg-sunken")}
    >
      {(["vi", "en"] as const).map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={lang === l}
          onClick={() => setLang(l)}
          className={cx(
            "h-6 min-w-[34px] rounded-full px-2 uppercase transition-colors",
            lang === l
              ? onBrand
                ? "bg-white text-[var(--brand-bg)]"
                : "bg-bg-surface text-fg-primary shadow-raised"
              : onBrand
                ? "text-white/75"
                : "text-fg-tertiary",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
