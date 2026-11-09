/* Aegis Compliance — ứng dụng back-office: thanh trên navy, sidebar cố định, vùng làm việc */
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bell, LogOut, ShieldCheck } from "lucide-react";
import "../styles/tokens.css";
import CompliancePage from "../web/CompliancePage";
import { ThemeToggle, useTheme } from "../shared/theme";
import { LangProvider, LangSwitch, useLang } from "../i18n";
import { ME } from "../web/data";
import { Button, Modal, cx } from "../components/ui";

function Notifications() {
  const { tr } = useLang();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(2);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const items = [
    { t: tr("Hồ sơ EKS-2611-0039 đã quá SLA", "Case EKS-2611-0039 breached SLA"), d: tr("2 phút trước", "2 min ago"), tone: "bg-danger" },
    { t: tr("Khách đã bổ sung hồ sơ EKS-2611-0042", "Customer resubmitted EKS-2611-0042"), d: tr("Hôm qua 21:10", "Yesterday 21:10"), tone: "bg-info" },
    { t: tr("Trần Hải Yến gửi EKS-2611-0036 chờ Checker", "Trần Hải Yến sent EKS-2611-0036 for checking"), d: tr("Hôm qua 18:44", "Yesterday 18:44"), tone: "bg-warning" },
  ];
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen(!open); setUnread(0); }} aria-expanded={open} aria-haspopup="true"
        className="relative grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label={unread ? tr(`Thông báo, ${unread} mới`, `Notifications, ${unread} new`) : tr("Thông báo", "Notifications")}>
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-[#ff6b5e]" aria-hidden />}
      </button>
      {open && (
        <div role="dialog" aria-label={tr("Thông báo", "Notifications")} className="absolute right-0 top-11 w-[340px] max-w-[calc(100vw-32px)] rounded-lg border border-line-subtle bg-bg-raised text-fg-primary shadow-overlay">
          <p className="border-b border-line-subtle px-4 py-3 text-body-sm font-semibold">{tr("Thông báo", "Notifications")}</p>
          <ul>
            {items.map((i) => (
              <li key={i.t} className="flex gap-3 border-b border-line-subtle px-4 py-3 last:border-0">
                <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", i.tone)} aria-hidden />
                <span className="min-w-0"><span className="block text-body-sm">{i.t}</span><span className="text-caption text-fg-tertiary">{i.d}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ComplianceApp() {
  const [theme, setTheme] = useTheme();
  const { tr } = useLang();
  const [logout, setLogout] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  if (signedOut)
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-sm rounded-xl bg-bg-surface p-6 text-center shadow-raised">
          <ShieldCheck className="mx-auto size-10 text-action-subtle-fg" />
          <h1 className="mt-3 text-title">{tr("Bạn đã đăng xuất", "You've signed out")}</h1>
          <p className="mt-1 text-body-sm text-fg-secondary">{tr("Phiên làm việc đã kết thúc an toàn.", "Your session ended securely.")}</p>
          <Button className="mt-5" block onClick={() => setSignedOut(false)}>{tr("Đăng nhập lại", "Sign in again")}</Button>
        </div>
      </div>
    );

  return (
    <CompliancePage
      standalone
      layout={(nav, body) => (
        <div className="min-h-full">
          <header className="sticky z-30 text-white" style={{ top: "env(safe-area-inset-top, 0px)", background: "var(--brand-bg)" }}>
            <div className="gutter flex h-14 items-center gap-3">
              <ShieldCheck className="size-6 shrink-0" aria-hidden />
              <span className="shrink-0 text-[15px] font-bold tracking-tight">Aegis Bank</span>
              <span className="hidden h-5 w-px bg-white/25 sm:block" aria-hidden />
              <span className="hidden truncate text-body-sm text-white/80 sm:block">{tr("Hệ thống xét duyệt eKYC", "eKYC Review System")}</span>
              <span className="ml-1 hidden rounded-sm bg-[#f2c069] px-2 py-0.5 text-caption font-bold text-[#3b2600] md:inline">UAT</span>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <LangSwitch onBrand />
                <Notifications />
                <span className="hidden size-8 place-items-center rounded-full bg-white/15 text-caption font-bold sm:grid" title={ME}>MA</span>
              </div>
            </div>
          </header>

          <aside className="fixed bottom-0 left-0 top-14 z-20 hidden w-[248px] flex-col border-r border-line-subtle bg-bg-surface lg:flex">
            <div className="flex-1 overflow-y-auto p-3">
              <p className="px-3 pb-2 pt-1 text-caption font-semibold text-fg-tertiary">{tr("Xét duyệt", "Review")}</p>
              {nav}
            </div>
            <div className="border-t border-line-subtle p-3">
              <div className="flex items-center gap-3 px-2 py-1">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-action-subtle text-caption font-bold text-action-subtle-fg">MA</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-semibold">{ME}</p>
                  <p className="text-caption text-fg-tertiary">Compliance Officer</p>
                </div>
                <button onClick={() => setLogout(true)} className="interactive grid size-8 place-items-center rounded-md text-fg-tertiary" aria-label={tr("Đăng xuất", "Sign out")}><LogOut className="size-4" /></button>
              </div>
              <div className="mt-3 flex justify-center"><ThemeToggle theme={theme} onChange={setTheme} /></div>
            </div>
          </aside>

          {/* Điều hướng cho màn hình nhỏ */}
          <div className="gutter border-b border-line-subtle bg-bg-surface py-2 lg:hidden">
            <div className="overflow-x-auto [&_nav]:flex-row [&_nav]:gap-1 [&_button]:whitespace-nowrap">{nav}</div>
          </div>

          <main className="gutter py-6 lg:ml-[248px]">
            <div className="mx-auto max-w-[1240px]">{body}</div>
          </main>

          <Modal open={logout} onClose={() => setLogout(false)} title={tr("Đăng xuất?", "Sign out?")}
            footer={<><Button variant="ghost" onClick={() => setLogout(false)}>{tr("Huỷ", "Cancel")}</Button><Button onClick={() => { setLogout(false); setSignedOut(true); }}>{tr("Đăng xuất", "Sign out")}</Button></>}>
            <p className="text-body-sm text-fg-secondary">{tr("Hồ sơ bạn đang nhận xử lý sẽ được giữ thêm 2 giờ trước khi tự nhả.", "Cases you've claimed stay assigned to you for 2 more hours before being released.")}</p>
          </Modal>
        </div>
      )}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LangProvider>
      <ComplianceApp />
    </LangProvider>
  </StrictMode>,
);
