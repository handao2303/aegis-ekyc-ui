/* App khách hàng eKYC — chạy toàn màn hình như sản phẩm thật */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../styles/tokens.css";
import { SCREENS } from "../mobile/MobileFlowPage";
import type { Outcome, ScreenKey } from "../mobile/screens";
import { useTheme } from "../shared/theme";
import { LangProvider } from "../i18n";

// Kết quả xác minh mô phỏng: /app/?ketqua=refer | rejected (mặc định: duyệt tự động). Thêm &lang=en để mở bằng tiếng Anh.
const param = new URLSearchParams(location.search).get("ketqua");
const OUTCOME: Outcome = param === "refer" || param === "rejected" ? param : "approved";

function CustomerApp() {
  useTheme();
  const [key, setKey] = useState<ScreenKey>("intro");
  const [nonce, setNonce] = useState(0);
  const Comp = SCREENS.find((s) => s.key === key)!.comp;
  const go = (k: ScreenKey) => {
    setKey(k);
    setNonce((n) => n + 1);
  };

  return (
    <div className="fixed inset-0 flex justify-center bg-bg-sunken md:items-center md:p-6">
      <div
        className="flex h-full w-full max-w-[440px] flex-col overflow-hidden md:max-h-[880px] md:rounded-2xl md:shadow-overlay"
        style={{ background: "var(--brand-bg)", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <Comp key={`${key}-${nonce}`} go={go} outcome={OUTCOME} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LangProvider>
      <CustomerApp />
    </LangProvider>
  </StrictMode>,
);
