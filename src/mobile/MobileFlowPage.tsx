import { useState, ComponentType } from "react";
import { RotateCcw } from "lucide-react";
import { Badge, Card, cx } from "../components/ui";
import { PhoneFrame } from "./MobileShell";
import * as S from "./screens";
import type { Outcome, ScreenKey, ScreenProps } from "./screens";

type Meta = {
  key: ScreenKey;
  code: string;
  name: string;
  group: "Luồng chính" | "Kết quả" | "Ngoại lệ";
  comp: ComponentType<ScreenProps>;
  dark?: boolean;
  purpose: string;
  rules: string[];
  refs: string[];
};

const ReConsent = (p: ScreenProps) => <S.Consent {...p} reconsent />;

export const SCREENS: Meta[] = [
  { key: "intro", code: "eKYC-00", name: "Giới thiệu", group: "Luồng chính", comp: S.Intro, purpose: "Đặt kỳ vọng: cần chuẩn bị gì, mất bao lâu, dữ liệu được bảo vệ ra sao.", rules: ["Nêu rõ thời gian ~3 phút để giảm bỏ ngang", "Nhắc NFC ngay từ đầu vì ảnh hưởng tới duyệt tự động"], refs: ["SCRUM-47"] },
  { key: "consent", code: "eKYC-01", name: "Đồng ý điều khoản", group: "Luồng chính", comp: S.Consent, purpose: "Thu thập đồng ý theo từng phạm vi (consent_scope), ghi lại terms_version.", rules: ["2 mục bắt buộc, 1 mục tuỳ chọn — không chọn sẵn", "Nút chính bị khoá kèm lý do cho đến khi đủ mục bắt buộc", "Nhắc quyền rút lại đồng ý"], refs: ["SCRUM-17", "SCRUM-81 (C12)"] },
  { key: "docType", code: "eKYC-02", name: "Chọn giấy tờ", group: "Luồng chính", comp: S.DocType, purpose: "Chọn loại giấy tờ hợp lệ, chặn sớm loại không hỗ trợ.", rules: ["Chỉ giấy tờ gắn chip (quyết định G-02)", "Nói rõ loại không hỗ trợ và cách khác để mở tài khoản"], refs: ["SCRUM-47", "SCRUM-74 (C05)"] },
  { key: "captureFront", code: "eKYC-03", name: "Chụp mặt trước", group: "Luồng chính", comp: S.CaptureFront, dark: true, purpose: "Chụp ảnh giấy tờ có hướng dẫn căn chỉnh theo thời gian thực.", rules: ["Nút chụp chỉ bật khi đã căn chỉnh", "Khung đổi màu khi giấy tờ nằm đúng vị trí", "Nền tối giúp ảnh tương phản tốt"], refs: ["SCRUM-18"] },
  { key: "reviewFront", code: "eKYC-04", name: "Kiểm tra ảnh", group: "Luồng chính", comp: S.ReviewFront, purpose: "Cho khách tự xác nhận chất lượng ảnh trước khi gửi.", rules: ["Hai lựa chọn ngang hàng: Chụp lại / Ảnh đã rõ", "Checklist chất lượng tự động"], refs: ["SCRUM-18", "G-04"] },
  { key: "captureBack", code: "eKYC-03b", name: "Chụp mặt sau", group: "Luồng chính", comp: S.CaptureBack, dark: true, purpose: "Chụp mặt sau để đọc mã MRZ.", rules: ["Cùng mẫu với mặt trước để giảm thời gian học"], refs: ["SCRUM-18"] },
  { key: "ocrReview", code: "eKYC-05", name: "Kiểm tra thông tin", group: "Luồng chính", comp: S.OcrReview, purpose: "Hiển thị dữ liệu OCR để khách xác nhận.", rules: ["Không cho sửa tay — sai thì chụp lại (tránh gian lận)", "Số hiển thị bằng font mono, chia nhóm 4 số"], refs: ["SCRUM-18", "SCRUM-74 (C05)"] },
  { key: "nfc", code: "eKYC-03B", name: "Quét chip NFC", group: "Luồng chính", comp: S.NfcScan, purpose: "Đọc chip & xác thực chữ ký số; nguồn ảnh gốc để so khớp khuôn mặt.", rules: ["Bỏ qua NFC được phép nhưng báo trước hệ quả: duyệt thủ công", "Trạng thái: chờ → đang đọc (%) → thành công"], refs: ["SCRUM-18", "SCRUM-58", "SCRUM-80 (C11)"] },
  { key: "liveness", code: "eKYC-06", name: "Xác thực khuôn mặt", group: "Luồng chính", comp: S.Liveness, dark: true, purpose: "Liveness chủ động với thử thách ngẫu nhiên.", rules: ["Thông báo hướng dẫn qua aria-live cho trình đọc màn hình", "Vòng tiến trình quanh khung mặt"], refs: ["SCRUM-19", "SCRUM-43", "SCRUM-83 (C14)"] },
  { key: "verifying", code: "eKYC-06b", name: "Đang xác minh", group: "Luồng chính", comp: S.Verifying, purpose: "Màn chờ có tiến trình từng bước thay cho spinner vô định.", rules: ["Không nhắc AML/PEP với khách — dùng “Kiểm tra hồ sơ theo quy định”"], refs: ["SCRUM-40", "SCRUM-47"] },
  { key: "approved", code: "eKYC-07", name: "Thành công", group: "Kết quả", comp: S.Approved, purpose: "STP_APPROVED: xác nhận và dẫn sang bước tiếp theo.", rules: ["Hiển thị số tài khoản bằng font mono", "Gợi ý 2 bước kế tiếp"], refs: ["SCRUM-39", "SCRUM-37"] },
  { key: "refer", code: "eKYC-09", name: "Đang xem xét", group: "Kết quả", comp: S.Refer, purpose: "REFER: cam kết 24 giờ, timeline rõ ràng, mời bật thông báo.", rules: ["Không tiết lộ lý do nhạy cảm", "Hiển thị mã hồ sơ để tra cứu"], refs: ["SCRUM-39", "SCRUM-77 (C08)", "SCRUM-78 (C09)"] },
  { key: "rejected", code: "eKYC-08", name: "Từ chối", group: "Kết quả", comp: S.Rejected, purpose: "REJECTED: lý do chung chung, luôn có lối đi tiếp.", rules: ["Lý do qua toCustomerSafeReasons()", "Đưa phương án thay thế: quầy giao dịch, tổng đài"], refs: ["SCRUM-39", "SCRUM-40"] },
  { key: "unreadable", code: "eKYC-03C", name: "Không đọc được giấy tờ", group: "Ngoại lệ", comp: S.Unreadable, purpose: "Lỗi OCR/NFC có hướng dẫn khắc phục và đếm số lần thử.", rules: ["Hiện retry_count (2/3)", "Lần 3 thất bại → chuyển REFER (RULE-EKYC-07)"], refs: ["SCRUM-41"] },
  { key: "reconsent", code: "eKYC-01R", name: "Đồng ý lại điều khoản", group: "Ngoại lệ", comp: ReConsent, purpose: "terms_version mới hơn bản khách đã đồng ý.", rules: ["Banner cảnh báo ở đầu màn", "Sau khi đồng ý, quay về đúng bước đang dở"], refs: ["SCRUM-46"] },
  { key: "resume", code: "eKYC-10", name: "Tiếp tục phiên", group: "Ngoại lệ", comp: S.Resume, purpose: "Khách quay lại phiên dở trong 7 ngày.", rules: ["Liveness luôn phải làm lại", "Cho phép làm lại từ đầu"], refs: ["SCRUM-75 (C06)"] },
  { key: "requestInfo", code: "eKYC-11", name: "Yêu cầu bổ sung", group: "Ngoại lệ", comp: S.RequestInfo, purpose: "Compliance yêu cầu bổ sung; deep link mở thẳng màn này.", rules: ["Chỉ yêu cầu đúng hạng mục cần bổ sung", "Hiển thị hạn chót và hệ quả khi quá hạn"], refs: ["SCRUM-76 (C07)"] },
  { key: "duplicate", code: "eKYC-12", name: "Đã có tài khoản", group: "Ngoại lệ", comp: S.Duplicate, purpose: "CCCD đã có tài khoản active.", rules: ["Dừng trước Liveness/CIC để không tốn chi phí", "Có lối báo cáo mạo danh"], refs: ["SCRUM-73 (C04)"] },
  { key: "expiredDoc", code: "eKYC-13", name: "Giấy tờ hết hạn", group: "Ngoại lệ", comp: S.ExpiredDoc, purpose: "Giấy tờ quá hạn hiệu lực.", rules: ["Nêu ngày hết hạn cụ thể", "Gợi ý cách xử lý"], refs: ["SCRUM-74 (C05)"] },
];

const GROUPS = ["Luồng chính", "Kết quả", "Ngoại lệ"] as const;

export default function MobileFlowPage() {
  const [key, setKey] = useState<ScreenKey>("intro");
  const [outcome, setOutcome] = useState<Outcome>("approved");
  const [nonce, setNonce] = useState(0);
  const meta = SCREENS.find((s) => s.key === key)!;
  const Comp = meta.comp;
  const go = (k: ScreenKey) => {
    setKey(k);
    setNonce((n) => n + 1);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
      {/* Danh sách màn hình */}
      <aside className="order-2 lg:order-1 min-w-0">
        <p className="eyebrow">Màn hình · {SCREENS.length}</p>
        <nav className="mt-3 flex flex-col gap-5" aria-label="Danh sách màn hình">
          {GROUPS.map((g) => (
            <div key={g}>
              <p className="mb-1 text-caption font-semibold text-fg-secondary">{g}</p>
              <ul className="flex flex-col">
                {SCREENS.filter((s) => s.group === g).map((s) => (
                  <li key={s.key}>
                    <button
                      onClick={() => go(s.key)}
                      aria-current={s.key === key ? "true" : undefined}
                      className={cx("interactive flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-body-sm", s.key === key ? "bg-action-subtle text-action-subtle-fg font-semibold" : "text-fg-secondary")}
                    >
                      <span className="w-[68px] shrink-0 font-mono text-caption opacity-80">{s.code}</span>
                      <span className="truncate">{s.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Thiết bị */}
      <section className="order-1 lg:order-2 min-w-0" aria-label="Bản mẫu tương tác">
        <PhoneFrame dark={meta.dark}>
          <Comp key={`${key}-${nonce}`} go={go} outcome={outcome} />
        </PhoneFrame>
        <div className="mt-4 flex justify-center">
          <button onClick={() => go("intro")} className="interactive inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-body-sm text-fg-secondary">
            <RotateCcw className="size-4" /> Chạy lại từ đầu
          </button>
        </div>
      </section>

      {/* Ghi chú UX */}
      <aside className="order-3 min-w-0 flex flex-col gap-4">
        <Card className="p-4">
          <p className="eyebrow">Đang xem</p>
          <h2 className="mt-1 text-title">{meta.name}</h2>
          <p className="font-mono text-caption text-fg-tertiary">{meta.code}</p>
          <p className="mt-3 text-body-sm text-fg-secondary">{meta.purpose}</p>
          <p className="mt-4 eyebrow">Quyết định UX</p>
          <ul className="mt-2 flex flex-col gap-2">
            {meta.rules.map((r) => (
              <li key={r} className="flex gap-2 text-body-sm">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-action" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 eyebrow">Truy vết Jira</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {meta.refs.map((r) => (
              <Badge key={r} tone={r.includes("(C") ? "brand" : "neutral"}>{r}</Badge>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <p className="eyebrow">Kịch bản demo</p>
          <p className="mt-1 text-body-sm text-fg-secondary">Kết quả trả về sau màn “Đang xác minh”.</p>
          <div className="mt-3 flex flex-col gap-1.5" role="radiogroup" aria-label="Kết quả mô phỏng">
            {([
              ["approved", "STP_APPROVED", "success"],
              ["refer", "REFER", "warning"],
              ["rejected", "REJECTED", "danger"],
            ] as const).map(([v, label, tone]) => (
              <button key={v} role="radio" aria-checked={outcome === v} onClick={() => setOutcome(v)}
                className={cx("interactive flex items-center justify-between rounded-md border px-3 py-2 text-left", outcome === v ? "border-action" : "border-line-subtle")}
              >
                <Badge tone={tone} dot>{label}</Badge>
                <span className={cx("grid size-4 place-items-center rounded-full border-2", outcome === v ? "border-action" : "border-line-strong")}>
                  {outcome === v && <span className="size-2 rounded-full bg-action" />}
                </span>
              </button>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}
