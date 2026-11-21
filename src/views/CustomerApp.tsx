/* App khách hàng eKYC — chạy toàn màn hình như sản phẩm thật */
import { useEffect, useState } from "react";
import { SCREENS } from "../mobile/MobileFlowPage";
import type { Outcome, ScreenKey } from "../mobile/screens";
import { useTheme } from "../shared/theme";
import { LangProvider } from "../i18n";
import { CaptureProvider } from "../mobile/camera";

// Kết quả xác minh mô phỏng: /app/?ketqua=refer | rejected (mặc định: duyệt tự động). Thêm &lang=en để mở bằng tiếng Anh.
const readOutcome = (): Outcome => {
  const param = new URLSearchParams(window.location.search).get("ketqua");
  return param === "refer" || param === "rejected" ? param : "approved";
};

function CustomerApp() {
  useTheme();
  const [outcome] = useState(readOutcome);
  const [key, setKey] = useState<ScreenKey>("intro");
  const [nonce, setNonce] = useState(0);
  const Comp = SCREENS.find((s) => s.key === key)!.comp;

  // Skin Aurora áp lên cả <html> để thanh trạng thái iPhone và nền cuộn cùng tông
  useEffect(() => {
    document.documentElement.classList.add("skin-aurora");
    return () => document.documentElement.classList.remove("skin-aurora");
  }, []);
  const go = (k: ScreenKey) => {
    setKey(k);
    setNonce((n) => n + 1);
  };

  return (
    <div className="fixed inset-0 flex justify-center md:items-center md:p-6" style={{ background: "var(--grad-soft)" }}>
      <div
        className="flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-bg-base md:max-h-[880px] md:rounded-[40px] md:shadow-overlay"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <Comp key={`${key}-${nonce}`} go={go} outcome={outcome} />
      </div>
    </div>
  );
}

export default function CustomerAppPage() {
  return (
    <LangProvider>
      <CaptureProvider>
        <CustomerApp />
      </CaptureProvider>
    </LangProvider>
  );
}
