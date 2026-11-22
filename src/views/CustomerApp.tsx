/* App khách hàng eKYC — chạy toàn màn hình như sản phẩm thật */
import { useCallback, useEffect, useState } from "react";
import { SCREENS } from "../mobile/MobileFlowPage";
import type { Outcome, ScreenKey } from "../mobile/screens";
import { useTheme } from "../shared/theme";
import { LangProvider } from "../i18n";
import { CaptureProvider } from "../mobile/camera";
import { EkycProvider, useEkyc, useFlowGo } from "../ekyc/EkycContext";
import { EkycOverlay } from "../ekyc/Overlay";

// Kết quả xác minh mô phỏng: /app/?ketqua=refer | rejected (mặc định: duyệt tự động). Thêm &lang=en để mở bằng tiếng Anh.
const readOutcome = (): Outcome => {
  const param = new URLSearchParams(window.location.search).get("ketqua");
  return param === "refer" || param === "rejected" ? param : "approved";
};

function CustomerApp() {
  useTheme();
  const [outcome] = useState(readOutcome);
  // ?screen=cardHome mở thẳng một màn (vd. thẻ tín dụng) để test nhanh
  const [key, setKey] = useState<ScreenKey>(() => {
    const k = new URLSearchParams(window.location.search).get("screen");
    return SCREENS.some((s) => s.key === k) ? (k as ScreenKey) : "intro";
  });
  const [nonce, setNonce] = useState(0);
  const Comp = SCREENS.find((s) => s.key === key)!.comp;

  // Skin Aurora áp lên cả <html> để thanh trạng thái iPhone và nền cuộn cùng tông
  useEffect(() => {
    document.documentElement.classList.add("skin-aurora");
    return () => document.documentElement.classList.remove("skin-aurora");
  }, []);
  const rawGo = useCallback((k: ScreenKey) => {
    setKey(k);
    setNonce((n) => n + 1);
  }, []);
  // Có backend: mỗi lần chuyển màn gọi ekyc-service; không có: chạy demo như cũ
  const go = useFlowGo(key, rawGo);
  const ek = useEkyc();

  return (
    <div className="fixed inset-0 flex justify-center md:items-center md:p-6" style={{ background: "var(--grad-soft)" }}>
      <div
        className="relative flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-bg-base md:max-h-[880px] md:rounded-[40px] md:shadow-overlay"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <EkycOverlay />
        <Comp key={`${key}-${nonce}`} go={go} outcome={ek?.outcome ?? outcome} />
      </div>
    </div>
  );
}

export default function CustomerAppPage() {
  return (
    <LangProvider>
      <CaptureProvider>
        <EkycProvider>
          <CustomerApp />
        </EkycProvider>
      </CaptureProvider>
    </LangProvider>
  );
}
