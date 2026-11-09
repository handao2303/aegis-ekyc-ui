import { useEffect, useState, ReactNode } from "react";
import {
  Camera, Check, CheckCircle2, ChevronRight, Clock, CreditCard, FileText, IdCard, Zap,
  Lock, Nfc, RefreshCw, ScanFace, ShieldCheck, Smartphone, Sun, UserCheck, XCircle, Bell, CalendarClock,
  Upload, History, Headphones, Copy, Building2,
} from "lucide-react";
import { Alert, Button, Checkbox, ProgressBar, cx } from "../components/ui";
import { IdCardArt, PageTitle, Screen } from "./MobileShell";
import { useLang } from "../i18n";

export type ScreenKey =
  | "intro" | "consent" | "reconsent" | "docType" | "captureFront" | "reviewFront" | "captureBack"
  | "ocrReview" | "nfc" | "unreadable" | "liveness" | "verifying"
  | "approved" | "refer" | "rejected" | "requestInfo" | "duplicate" | "resume" | "expiredDoc";

export type Outcome = "approved" | "refer" | "rejected";
export type ScreenProps = { go: (k: ScreenKey) => void; outcome: Outcome };

/* ---------- Thành phần dùng chung ---------- */
function Section({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-lg bg-bg-surface shadow-raised", className)}>
      {title && <h3 className="px-4 pt-4 text-body-sm font-semibold text-fg-secondary">{title}</h3>}
      {children}
    </section>
  );
}

/** Dòng thông tin kiểu sao kê ngân hàng: nhãn trái, giá trị phải */
function Row({ label, value, strong, tone }: { label: string; value: ReactNode; strong?: boolean; tone?: "danger" }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="shrink-0 text-body-sm text-fg-tertiary">{label}</dt>
      <dd className={cx("min-w-0 text-right text-body-sm tabular break-words", strong && "font-semibold", tone === "danger" && "text-danger font-semibold")}>{value}</dd>
    </div>
  );
}

function StatusMark({ tone, icon }: { tone: "success" | "warning" | "danger"; icon: ReactNode }) {
  const cls = { success: "bg-success-subtle text-success", warning: "bg-warning-subtle text-warning", danger: "bg-danger-subtle text-danger" }[tone];
  return <div className={cx("mx-auto grid size-[72px] place-items-center rounded-full", cls)}>{icon}</div>;
}

/* ---------- 00 Giới thiệu ---------- */
export function Intro({ go }: ScreenProps) {
  const { tr } = useLang();
  const steps = [
    [tr("Đồng ý điều khoản", "Accept the terms"), tr("Chọn phạm vi dữ liệu bạn cho phép", "Choose what data you allow us to use")],
    [tr("Chụp CCCD gắn chip", "Photograph your chip ID"), tr("Mặt trước và mặt sau", "Front and back")],
    [tr("Quét chip NFC", "Scan the NFC chip"), tr("Áp thẻ vào mặt sau điện thoại", "Hold the card to the back of your phone")],
    [tr("Xác thực khuôn mặt", "Verify your face"), tr("Làm theo hướng dẫn trên màn hình", "Follow the on-screen prompts")],
  ];
  const needs: [ReactNode, string][] = [
    [<IdCard key="i" className="size-5" />, tr("CCCD gắn chip, còn hạn", "Valid chip ID card")],
    [<Nfc key="n" className="size-5" />, tr("Điện thoại có NFC", "NFC-enabled phone")],
    [<Sun key="s" className="size-5" />, tr("Nơi đủ ánh sáng", "Good lighting")],
  ];
  return (
    <Screen title={tr("Mở tài khoản", "Open an account")} footer={<Button size="lg" block onClick={() => go("consent")}>{tr("Bắt đầu", "Get started")}</Button>}>
      <PageTitle title={tr("Mở tài khoản thanh toán trực tuyến", "Open a payment account online")} desc={tr("Khoảng 3 phút. Không cần đến quầy giao dịch.", "About 3 minutes. No branch visit needed.")} />
      <Section title={tr("Quy trình gồm 4 bước", "4 simple steps")}>
        <ol className="px-4 pb-1">
          {steps.map(([t, d], i) => (
            <li key={t} className="flex gap-3 border-b border-line-subtle py-3 last:border-0">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-action-subtle text-caption font-bold text-action-subtle-fg tabular">{i + 1}</span>
              <span className="min-w-0">
                <span className="block text-body-sm font-semibold">{t}</span>
                <span className="block text-caption text-fg-tertiary">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>
      <Section title={tr("Bạn cần chuẩn bị", "What you'll need")} className="mt-4">
        <ul className="grid grid-cols-3 gap-2 p-4 pt-3 text-center">
          {needs.map(([icon, label]) => (
            <li key={label} className="flex flex-col items-center gap-2 rounded-md bg-bg-base px-2 py-3">
              <span className="text-action-subtle-fg">{icon}</span>
              <span className="text-caption leading-tight text-fg-secondary">{label}</span>
            </li>
          ))}
        </ul>
      </Section>
    </Screen>
  );
}

/* ---------- 01 Đồng ý ---------- */
export function Consent({ go, reconsent }: ScreenProps & { reconsent?: boolean }) {
  const { tr } = useLang();
  const [v, setV] = useState<Record<string, boolean>>({});
  const scopes = [
    { id: "scope-identity", label: tr("Xử lý dữ liệu định danh", "Process my identity data"), desc: tr("Ảnh giấy tờ, dữ liệu chip CCCD, ảnh khuôn mặt", "ID photos, chip data and a face image"), required: true },
    { id: "scope-screening", label: tr("Tra cứu tín dụng và kiểm tra tuân thủ", "Credit and compliance checks"), desc: tr("Theo quy định về phòng chống rửa tiền", "As required by anti-money-laundering rules"), required: true },
    { id: "scope-marketing", label: tr("Nhận ưu đãi phù hợp", "Receive relevant offers"), desc: tr("Có thể tắt bất cứ lúc nào trong Cài đặt", "You can turn this off any time in Settings"), required: false },
  ];
  const ok = scopes.filter((s) => s.required).every((s) => v[s.id]);
  return (
    <Screen
      title={tr("Điều khoản", "Terms")}
      step={0}
      onBack={() => go("intro")}
      footer={
        <Button size="lg" block disabled={!ok} onClick={() => go(reconsent ? "liveness" : "docType")}>
          {ok ? tr("Đồng ý và tiếp tục", "Agree and continue") : tr("Chọn 2 mục bắt buộc", "Select the 2 required items")}
        </Button>
      }
    >
      {reconsent && (
        <Alert tone="warning" className="mb-4" title={tr("Điều khoản đã được cập nhật", "Our terms have been updated")}>
          {tr("Vui lòng đồng ý lại để tiếp tục hồ sơ của bạn.", "Please accept them again to continue your application.")}
        </Alert>
      )}
      <PageTitle title={tr("Cho phép xử lý dữ liệu", "Allow us to use your data")} desc={tr("Chúng tôi chỉ dùng dữ liệu trong phạm vi bạn chọn.", "We only use your data for what you select.")} />
      <Section>
        <div className="flex flex-col px-4 py-1">
          {scopes.map((s) => (
            <Checkbox key={s.id} id={s.id} checked={!!v[s.id]} onChange={(c) => setV({ ...v, [s.id]: c })} label={s.label} description={s.desc} required={s.required} />
          ))}
        </div>
      </Section>
      <button className="interactive mt-4 flex w-full items-center gap-3 rounded-lg bg-bg-surface p-4 text-left shadow-raised">
        <FileText className="size-5 shrink-0 text-fg-tertiary" />
        <span className="min-w-0 flex-1">
          <span className="block text-body-sm font-semibold">{tr("Điều khoản và điều kiện", "Terms and conditions")}</span>
          <span className="block text-caption text-fg-tertiary">{tr("Phiên bản 3.2 · hiệu lực 01/11/2026", "Version 3.2 · effective 1 Nov 2026")}</span>
        </span>
        <ChevronRight className="size-5 text-fg-tertiary" />
      </button>
      <p className="mt-4 text-caption text-fg-tertiary">
        {tr("Bạn có thể rút lại sự đồng ý trong Cài đặt › Quyền riêng tư. Một số dữ liệu vẫn được lưu theo thời hạn pháp luật yêu cầu.", "You can withdraw consent in Settings › Privacy. Some data is kept for the period required by law.")}
      </p>
    </Screen>
  );
}

/* ---------- 02 Chọn giấy tờ ---------- */
export function DocType({ go }: ScreenProps) {
  const { tr } = useLang();
  const [sel, setSel] = useState("cccd");
  const opts = [
    { id: "cccd", title: tr("Căn cước công dân gắn chip", "Chip-based citizen ID"), desc: tr("Được duyệt tự động khi đọc được chip", "Approved instantly when the chip can be read") },
    { id: "cancuoc", title: tr("Thẻ Căn cước (mẫu 2024)", "Identity card (2024 format)"), desc: tr("Cấp từ ngày 01/07/2024", "Issued from 1 Jul 2024") },
  ];
  return (
    <Screen title={tr("Giấy tờ tuỳ thân", "ID document")} step={1} onBack={() => go("consent")} footer={<Button size="lg" block onClick={() => go("captureFront")}>{tr("Tiếp tục", "Continue")}</Button>}>
      <PageTitle title={tr("Chọn loại giấy tờ", "Choose your document")} desc={tr("Chỉ chấp nhận bản gốc, còn hạn.", "Original, unexpired documents only.")} />
      <Section>
        <div role="radiogroup" aria-label={tr("Loại giấy tờ", "Document type")} className="divide-y divide-[var(--border-subtle)]">
          {opts.map((o) => (
            <button key={o.id} role="radio" aria-checked={sel === o.id} onClick={() => setSel(o.id)} className="interactive flex w-full items-center gap-3 p-4 text-left first:rounded-t-lg last:rounded-b-lg">
              <CreditCard className="size-6 shrink-0 text-fg-tertiary" />
              <span className="min-w-0 flex-1">
                <span className="block text-body-sm font-semibold">{o.title}</span>
                <span className="block text-caption text-fg-tertiary">{o.desc}</span>
              </span>
              <span className={cx("grid size-5 shrink-0 place-items-center rounded-full border-2", sel === o.id ? "border-action" : "border-line-strong")}>
                {sel === o.id && <span className="size-2.5 rounded-full bg-action" />}
              </span>
            </button>
          ))}
        </div>
      </Section>
      <p className="mt-4 flex gap-2 text-caption text-fg-tertiary">
        <Building2 className="size-4 shrink-0" />
        {tr("CMND 9 số và CCCD không gắn chip vui lòng mở tài khoản tại quầy giao dịch.", "For 9-digit IDs or non-chip ID cards, please visit a branch.")}
      </p>
    </Screen>
  );
}

/* ---------- 03 Camera ---------- */
function CameraView({ side, go }: { side: "front" | "back"; go: (k: ScreenKey) => void }) {
  const { tr } = useLang();
  const [state, setState] = useState<"aligning" | "ready">("aligning");
  useEffect(() => {
    setState("aligning");
    const t = setTimeout(() => setState("ready"), 1400);
    return () => clearTimeout(t);
  }, [side]);
  return (
    <Screen
      dark
      title={side === "front" ? tr("Mặt trước CCCD", "ID card – front") : tr("Mặt sau CCCD", "ID card – back")}
      step={1}
      onBack={() => go(side === "front" ? "docType" : "reviewFront")}
      footer={
        <div className="flex items-center justify-between">
          <button className="interactive grid size-12 place-items-center rounded-full bg-white/10" aria-label={tr("Bật đèn", "Torch")}>
            <Zap className="size-5" />
          </button>
          <button
            onClick={() => go(side === "front" ? "reviewFront" : "ocrReview")}
            disabled={state !== "ready"}
            aria-label={tr("Chụp ảnh", "Take photo")}
            className="interactive grid size-[72px] place-items-center rounded-full border-4 border-white/90 disabled:opacity-40"
          >
            <span className="size-14 rounded-full bg-white" />
          </button>
          <button onClick={() => go("unreadable")} className="interactive h-12 rounded-full bg-white/10 px-3 text-caption font-semibold">
            {tr("Gặp sự cố?", "Trouble?")}
          </button>
        </div>
      }
    >
      <p className="mt-4 text-[17px] font-semibold">{side === "front" ? tr("Đặt mặt trước vào khung", "Place the front inside the frame") : tr("Đặt mặt sau vào khung", "Place the back inside the frame")}</p>
      <p className="text-body-sm text-white/70">{tr("Giữ điện thoại song song với giấy tờ", "Keep your phone parallel to the card")}</p>
      <div className="relative mx-auto mt-8 w-full">
        <div className="relative overflow-hidden rounded-[14px]">
          <IdCardArt side={side} className="opacity-90" />
          <span aria-hidden className="anim-scan-line absolute inset-x-0 h-px bg-white shadow-[0_0_10px_white]" />
        </div>
        {(["left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-[16px]", "right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-[16px]", "left-0 bottom-0 border-l-[3px] border-b-[3px] rounded-bl-[16px]", "right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-[16px]"] as const).map((c) => (
          <span key={c} aria-hidden className={cx("absolute -m-2 size-9 transition-colors", c, state === "ready" ? "border-[#4ade80]" : "border-white/70")} />
        ))}
      </div>
      <div className="mt-8 flex justify-center" aria-live="polite">
        <span className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-body-sm font-medium", state === "ready" ? "bg-[#15803d] text-white" : "bg-white/15")}>
          {state === "ready" ? <Check className="size-4" /> : <Camera className="size-4" />}
          {state === "ready" ? tr("Đã căn chỉnh – có thể chụp", "Aligned – ready to capture") : tr("Đang tìm giấy tờ…", "Looking for your card…")}
        </span>
      </div>
      <ul className="mt-6 grid grid-cols-3 gap-2 text-center text-caption text-white/70">
        <li>{tr("Không loá sáng", "No glare")}</li>
        <li>{tr("Đủ 4 góc", "All 4 corners")}</li>
        <li>{tr("Không che chữ", "Text not covered")}</li>
      </ul>
    </Screen>
  );
}
export const CaptureFront = ({ go }: ScreenProps) => <CameraView side="front" go={go} />;
export const CaptureBack = ({ go }: ScreenProps) => <CameraView side="back" go={go} />;

/* ---------- 04 Kiểm tra ảnh ---------- */
export function ReviewFront({ go }: ScreenProps) {
  const { tr } = useLang();
  const checks = [tr("Ảnh rõ nét", "Sharp image"), tr("Không bị loá", "No glare"), tr("Thấy đủ 4 góc", "All 4 corners visible")];
  return (
    <Screen
      title={tr("Kiểm tra ảnh", "Check your photo")}
      step={1}
      onBack={() => go("captureFront")}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="lg" onClick={() => go("captureFront")}>{tr("Chụp lại", "Retake")}</Button>
          <Button size="lg" onClick={() => go("captureBack")}>{tr("Dùng ảnh này", "Use photo")}</Button>
        </div>
      }
    >
      <PageTitle title={tr("Ảnh có đọc rõ không?", "Is everything readable?")} desc={tr("Đảm bảo nhìn rõ toàn bộ chữ và số.", "Make sure all text and numbers are clear.")} />
      <Section className="p-3"><IdCardArt side="front" /></Section>
      <ul className="mt-4 flex flex-col gap-2.5">
        {checks.map((c) => (
          <li key={c} className="flex items-center gap-2 text-body-sm"><CheckCircle2 className="size-5 text-success" /> {c}</li>
        ))}
      </ul>
    </Screen>
  );
}

/* ---------- 05 Kiểm tra thông tin OCR ---------- */
export function OcrReview({ go }: ScreenProps) {
  const { tr } = useLang();
  return (
    <Screen title={tr("Thông tin giấy tờ", "Document details")} step={1} onBack={() => go("captureBack")} footer={<Button size="lg" block onClick={() => go("nfc")}>{tr("Xác nhận thông tin", "Confirm details")}</Button>}>
      <PageTitle title={tr("Kiểm tra thông tin", "Check your details")} desc={tr("Đọc tự động từ ảnh giấy tờ. Nếu sai, vui lòng chụp lại.", "Read automatically from your photos. If anything is wrong, retake the photos.")} />
      <Section>
        <dl className="divide-y divide-[var(--border-subtle)] px-4">
          <Row label={tr("Họ và tên", "Full name")} value="NGUYỄN THỊ MINH THƯ" strong />
          <Row label={tr("Số CCCD", "ID number")} value="089 1234 5678" />
          <Row label={tr("Ngày sinh", "Date of birth")} value="15/03/1992" />
          <Row label={tr("Giới tính", "Sex")} value={tr("Nữ", "Female")} />
          <Row label={tr("Quê quán", "Place of origin")} value="Tân Châu, An Giang" />
          <Row label={tr("Ngày cấp", "Date of issue")} value="12/06/2021" />
          <Row label={tr("Có giá trị đến", "Expiry date")} value="15/03/2032" />
        </dl>
      </Section>
      <button onClick={() => go("captureFront")} className="interactive mt-3 flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-body-sm font-semibold text-action-subtle-fg">
        <RefreshCw className="size-4" /> {tr("Thông tin chưa đúng? Chụp lại", "Details wrong? Retake photos")}
      </button>
    </Screen>
  );
}

/* ---------- 06 Quét chip NFC ---------- */
export function NfcScan({ go }: ScreenProps) {
  const { tr } = useLang();
  const [phase, setPhase] = useState<"idle" | "reading" | "done">("idle");
  const [pct, setPct] = useState(0);
  const [skip, setSkip] = useState(false);
  useEffect(() => {
    if (phase !== "reading") return;
    const t = setInterval(() => setPct((p) => (p >= 100 ? 100 : p + 7)), 120);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => {
    if (pct >= 100 && phase === "reading") setPhase("done");
  }, [pct, phase]);

  return (
    <Screen
      title={tr("Quét chip", "Scan chip")}
      step={2}
      onBack={() => go("ocrReview")}
      footer={
        phase === "done" ? (
          <Button size="lg" block onClick={() => go("liveness")}>{tr("Tiếp tục", "Continue")}</Button>
        ) : (
          <>
            <Button size="lg" block loading={phase === "reading"} onClick={() => { setPct(0); setPhase("reading"); }}>
              {phase === "reading" ? tr("Đang đọc chip…", "Reading chip…") : tr("Bắt đầu quét", "Start scanning")}
            </Button>
            <Button variant="ghost" block onClick={() => setSkip(true)}>{tr("Điện thoại không có NFC?", "Phone doesn't have NFC?")}</Button>
          </>
        )
      }
    >
      <PageTitle
        title={phase === "done" ? tr("Đọc chip thành công", "Chip read successfully") : tr("Áp CCCD vào mặt sau điện thoại", "Hold your ID to the back of your phone")}
        desc={phase === "done" ? tr("Chữ ký số trên chip hợp lệ.", "The chip's digital signature is valid.") : phase === "reading" ? tr("Giữ yên thẻ cho đến khi hoàn tất.", "Keep the card still until it finishes.") : tr("Đặt thẻ gần camera sau, giữ 3–5 giây.", "Place the card near the rear camera for 3–5 seconds.")}
      />
      <Section className="grid place-items-center py-10">
        <div className="relative grid size-40 place-items-center" aria-hidden>
          {phase !== "done" && (
            <>
              <span className="anim-pulse-ring absolute inset-4 rounded-full border-2 border-action" />
              <span className="anim-pulse-ring absolute inset-4 rounded-full border-2 border-action" style={{ animationDelay: "1s" }} />
            </>
          )}
          <div className={cx("relative grid size-24 place-items-center rounded-full", phase === "done" ? "bg-success-subtle text-success" : "bg-action-subtle text-action-subtle-fg")}>
            {phase === "done" ? <CheckCircle2 className="size-11" /> : <Nfc className="size-11" />}
          </div>
        </div>
        {phase === "reading" && (
          <div className="mt-6 w-3/4" aria-live="polite">
            <ProgressBar value={pct} label={tr("Tiến độ đọc chip", "Chip reading progress")} />
            <p className="mt-2 text-center text-caption text-fg-tertiary tabular">{Math.min(pct, 100)}%</p>
          </div>
        )}
      </Section>
      {skip && phase !== "done" && (
        <Alert tone="warning" className="mt-4" title={tr("Hồ sơ sẽ được duyệt thủ công", "Your application will be reviewed manually")}>
          <p>{tr("Không đọc chip, nhân viên cần xem xét hồ sơ, thường trong 24 giờ.", "Without the chip, our team needs to review it, usually within 24 hours.")}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => go("liveness")}>{tr("Vẫn bỏ qua", "Skip anyway")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setSkip(false)}>{tr("Thử quét lại", "Try again")}</Button>
          </div>
        </Alert>
      )}
    </Screen>
  );
}

/* ---------- Không đọc được ---------- */
export function Unreadable({ go }: ScreenProps) {
  const { tr } = useLang();
  return (
    <Screen
      title={tr("Chưa đọc được giấy tờ", "We couldn't read your ID")}
      step={1}
      onBack={() => go("captureFront")}
      footer={
        <>
          <Button size="lg" block onClick={() => go("captureFront")}>{tr("Chụp lại (còn 1 lần)", "Retake (1 attempt left)")}</Button>
          <Button variant="ghost" block onClick={() => go("refer")}>{tr("Gửi để nhân viên hỗ trợ", "Send for manual review")}</Button>
        </>
      }
    >
      <Alert tone="warning" title={tr("Ảnh chưa đủ rõ · lần thử 2/3", "Photo not clear enough · attempt 2 of 3")}>
        {tr("Sau 3 lần không thành công, hồ sơ được chuyển cho nhân viên xem xét.", "After 3 failed attempts, a member of our team will review your application.")}
      </Alert>
      <Section title={tr("Mẹo chụp rõ hơn", "Tips for a clearer photo")} className="mt-4">
        <ul className="flex flex-col gap-3 p-4 pt-3 text-body-sm text-fg-secondary">
          <li className="flex gap-3"><Sun className="mt-0.5 size-4 shrink-0" />{tr("Đứng gần cửa sổ, tắt đèn flash nếu bị loá", "Stand near a window; turn off the flash if there's glare")}</li>
          <li className="flex gap-3"><Smartphone className="mt-0.5 size-4 shrink-0" />{tr("Đặt giấy tờ trên nền tối, phẳng", "Lay the card on a flat, dark surface")}</li>
          <li className="flex gap-3"><Camera className="mt-0.5 size-4 shrink-0" />{tr("Lau sạch camera trước khi chụp", "Wipe your camera lens")}</li>
        </ul>
      </Section>
    </Screen>
  );
}

/* ---------- 07 Khuôn mặt ---------- */
export function Liveness({ go }: ScreenProps) {
  const { tr } = useLang();
  const challenges = [tr("Nhìn thẳng vào camera", "Look straight at the camera"), tr("Quay mặt sang trái", "Turn your head left"), tr("Quay mặt sang phải", "Turn your head right"), tr("Mỉm cười", "Smile")];
  const [i, setI] = useState(-1);
  useEffect(() => {
    if (i < 0) return;
    if (i >= challenges.length) {
      const t = setTimeout(() => go("verifying"), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI(i + 1), 1300);
    return () => clearTimeout(t);
  }, [i, go, challenges.length]);
  const done = Math.max(0, Math.min(i, challenges.length));
  const C = 2 * Math.PI * 128;
  return (
    <Screen dark title={tr("Xác thực khuôn mặt", "Face verification")} step={3} onBack={() => go("nfc")}
      footer={i < 0 ? <Button size="lg" block className="!bg-white !text-[#0b2559]" onClick={() => setI(0)}>{tr("Tôi đã sẵn sàng", "I'm ready")}</Button> : <p className="text-center text-body-sm text-white/75 tabular" aria-live="polite">{tr("Đang kiểm tra", "Checking")} · {done}/{challenges.length}</p>}
    >
      <div className="relative mx-auto mt-4 aspect-[3/4] w-[74%]">
        <svg viewBox="0 0 280 360" className="absolute inset-0 size-full" aria-hidden>
          <ellipse cx="140" cy="180" rx="128" ry="168" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="5" />
          <ellipse cx="140" cy="180" rx="128" ry="168" fill="none" stroke="#4ade80" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${(done / challenges.length) * C * 1.15} ${C * 2}`} transform="rotate(-90 140 180)" style={{ transition: "stroke-dasharray .5s" }} />
        </svg>
        <div className="absolute inset-[6%] grid place-items-center rounded-[50%] bg-white/5">
          <ScanFace className="size-20 opacity-40" aria-hidden />
        </div>
      </div>
      <div className="mt-6 text-center" aria-live="assertive">
        <p className="text-[20px] font-semibold">{i < 0 ? tr("Đưa khuôn mặt vào khung", "Fit your face in the oval") : i < challenges.length ? challenges[i] : tr("Hoàn tất", "Done")}</p>
        <p className="mt-1 text-body-sm text-white/70">{i < 0 ? tr("Bỏ kính râm, khẩu trang và mũ", "Remove sunglasses, mask and hat") : tr("Làm theo hướng dẫn", "Follow the instruction")}</p>
      </div>
    </Screen>
  );
}

/* ---------- 08 Đang xác minh ---------- */
export function Verifying({ go, outcome }: ScreenProps) {
  const { tr } = useLang();
  const items = [tr("Đối chiếu giấy tờ với dữ liệu chip", "Matching your ID with chip data"), tr("So khớp khuôn mặt", "Matching your face"), tr("Kiểm tra hồ sơ theo quy định", "Running required checks"), tr("Tạo tài khoản", "Creating your account")];
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n > items.length - 1) {
      const t = setTimeout(() => go(outcome), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN(n + 1), 900);
    return () => clearTimeout(t);
  }, [n, go, outcome, items.length]);
  return (
    <Screen title={tr("Đang xác minh", "Verifying")} step={4}>
      <PageTitle title={tr("Đang xác minh hồ sơ", "Verifying your application")} desc={tr("Thường dưới 1 phút. Vui lòng không đóng ứng dụng.", "Usually under a minute. Please keep the app open.")} />
      <Section>
        <ol className="px-4 py-2" aria-live="polite">
          {items.map((t, idx) => {
            const st = idx < n ? "done" : idx === n ? "doing" : "todo";
            return (
              <li key={t} className="flex items-center gap-3 border-b border-line-subtle py-3.5 last:border-0">
                <span className={cx("grid size-7 shrink-0 place-items-center rounded-full", st === "done" ? "bg-success-subtle text-success" : st === "doing" ? "bg-action-subtle text-action-subtle-fg" : "bg-bg-sunken text-fg-tertiary")}>
                  {st === "done" ? <Check className="size-4" /> : st === "doing" ? <RefreshCw className="size-4 animate-spin" /> : <span className="text-caption tabular">{idx + 1}</span>}
                </span>
                <span className={cx("text-body-sm", st === "todo" ? "text-fg-tertiary" : "font-medium")}>{t}</span>
              </li>
            );
          })}
        </ol>
      </Section>
    </Screen>
  );
}

/* ---------- Kết quả: bố cục biên lai ---------- */
function Receipt({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 rounded-lg bg-bg-surface shadow-raised">
      <dl className="divide-y divide-dashed divide-[var(--border-strong)] px-4">{children}</dl>
    </div>
  );
}

export function Approved({ go }: ScreenProps) {
  const { tr } = useLang();
  const next: [ReactNode, string][] = [
    [<Lock key="l" className="size-5" />, tr("Tạo mã PIN giao dịch", "Set up your transaction PIN")],
    [<CreditCard key="c" className="size-5" />, tr("Phát hành thẻ ghi nợ ảo", "Get a virtual debit card")],
  ];
  return (
    <Screen title={tr("Kết quả", "Result")} footer={<Button size="lg" block onClick={() => go("intro")}>{tr("Vào trang chủ", "Go to home")}</Button>}>
      <StatusMark tone="success" icon={<CheckCircle2 className="size-9" />} />
      <h2 className="mt-4 text-center text-[22px] font-bold">{tr("Mở tài khoản thành công", "Your account is open")}</h2>
      <p className="mt-1 text-center text-body-sm text-fg-secondary">{tr("Chào mừng bạn đến với Aegis Bank.", "Welcome to Aegis Bank.")}</p>
      <Receipt>
        <Row label={tr("Chủ tài khoản", "Account holder")} value="NGUYỄN THỊ MINH THƯ" strong />
        <Row label={tr("Số tài khoản", "Account number")} value={<span className="inline-flex items-center gap-2 font-semibold">1903 6688 2025 <Copy className="size-4 text-action-subtle-fg" aria-label={tr("Sao chép", "Copy")} /></span>} />
        <Row label={tr("Loại tài khoản", "Account type")} value={tr("Thanh toán – VND", "Current account – VND")} />
        <Row label={tr("Thời gian", "Time")} value="09:42 · 09/11/2026" />
        <Row label={tr("Mã hồ sơ", "Reference")} value="EKS-2611-0042" />
      </Receipt>
      <Section title={tr("Việc tiếp theo", "Next steps")} className="mt-4">
        <ul className="px-4 pb-1 pt-1">
          {next.map(([ic, t]) => (
            <li key={t} className="flex items-center gap-3 border-b border-line-subtle py-3.5 text-body-sm font-medium last:border-0">
              <span className="text-action-subtle-fg">{ic}</span><span className="flex-1">{t}</span><ChevronRight className="size-5 text-fg-tertiary" />
            </li>
          ))}
        </ul>
      </Section>
    </Screen>
  );
}

export function Refer({ go }: ScreenProps) {
  const { tr } = useLang();
  const tl = [
    { t: tr("Đã nhận hồ sơ", "Application received"), d: tr("09:41 hôm nay", "Today, 09:41"), s: "done" },
    { t: tr("Đang xem xét", "Under review"), d: tr("Dự kiến trước 09:41 ngày mai", "Expected by 09:41 tomorrow"), s: "doing" },
    { t: tr("Thông báo kết quả", "Decision sent"), d: tr("Qua SMS và ứng dụng", "By SMS and in the app"), s: "todo" },
  ];
  return (
    <Screen title={tr("Kết quả", "Result")} footer={<><Button size="lg" block icon={<Bell className="size-5" />}>{tr("Bật thông báo", "Turn on notifications")}</Button><Button variant="ghost" block onClick={() => go("intro")}>{tr("Về trang chủ", "Back to home")}</Button></>}>
      <StatusMark tone="warning" icon={<Clock className="size-9" />} />
      <h2 className="mt-4 text-center text-[22px] font-bold">{tr("Hồ sơ đang được xem xét", "We're reviewing your application")}</h2>
      <p className="mt-1 text-center text-body-sm text-fg-secondary">{tr("Kết quả sẽ được gửi trong vòng 24 giờ.", "You'll hear from us within 24 hours.")}</p>
      <Section className="mt-6 p-4">
        <ol className="relative flex flex-col gap-5 pl-7">
          <span aria-hidden className="absolute bottom-2 left-[9px] top-2 w-0.5 bg-bg-sunken" />
          {tl.map((x) => (
            <li key={x.t} className="relative">
              <span className={cx("absolute -left-7 top-0.5 grid size-5 place-items-center rounded-full", x.s === "done" ? "bg-success" : x.s === "doing" ? "bg-warning" : "border-2 border-line-strong bg-bg-surface")}>
                {x.s === "done" && <Check className="size-3" style={{ color: "var(--bg-surface)" }} />}
              </span>
              <p className="text-body-sm font-semibold">{x.t}</p>
              <p className="text-caption text-fg-tertiary">{x.d}</p>
            </li>
          ))}
        </ol>
      </Section>
      <Receipt><Row label={tr("Mã hồ sơ", "Reference")} value="EKS-2611-0042" strong /></Receipt>
    </Screen>
  );
}

export function Rejected({ go }: ScreenProps) {
  const { tr } = useLang();
  return (
    <Screen title={tr("Kết quả", "Result")} footer={<><Button size="lg" block icon={<Headphones className="size-5" />}>{tr("Gọi 1900 6868", "Call 1900 6868")}</Button><Button variant="ghost" block onClick={() => go("intro")}>{tr("Về trang chủ", "Back to home")}</Button></>}>
      <StatusMark tone="danger" icon={<XCircle className="size-9" />} />
      <h2 className="mt-4 text-center text-[22px] font-bold">{tr("Chưa thể mở tài khoản trực tuyến", "We can't open your account online")}</h2>
      <p className="mt-1 text-center text-body-sm text-fg-secondary">{tr("Hồ sơ chưa đáp ứng điều kiện mở tài khoản qua ứng dụng.", "Your application doesn't meet the requirements for opening an account in the app.")}</p>
      <Section title={tr("Bạn có thể", "What you can do")} className="mt-6">
        <ul className="flex flex-col gap-3 p-4 pt-3 text-body-sm text-fg-secondary">
          <li className="flex gap-2"><Building2 className="mt-0.5 size-4 shrink-0" />{tr("Đến chi nhánh gần nhất cùng CCCD bản gốc", "Visit your nearest branch with your original ID")}</li>
          <li className="flex gap-2"><Headphones className="mt-0.5 size-4 shrink-0" />{tr("Gọi tổng đài 1900 6868 (8:00–20:00)", "Call 1900 6868 (8 am – 8 pm)")}</li>
        </ul>
      </Section>
      <Receipt><Row label={tr("Mã hồ sơ", "Reference")} value="EKS-2611-0057" strong /></Receipt>
    </Screen>
  );
}

/* ---------- Ngoại lệ ---------- */
export function RequestInfo({ go }: ScreenProps) {
  const { tr } = useLang();
  return (
    <Screen title={tr("Bổ sung hồ sơ", "More information needed")} footer={<Button size="lg" block icon={<Upload className="size-5" />} onClick={() => go("captureBack")}>{tr("Chụp lại mặt sau", "Retake the back")}</Button>}>
      <PageTitle title={tr("Cần bổ sung 1 mục", "We need one more thing")} desc={tr("Nhân viên cần thêm thông tin để hoàn tất xét duyệt.", "Our team needs this to finish reviewing your application.")} />
      <Section>
        <dl className="divide-y divide-[var(--border-subtle)] px-4">
          <Row label={tr("Hạng mục", "Item")} value={tr("Ảnh mặt sau CCCD", "Back of ID card")} strong />
          <Row label={tr("Lý do", "Reason")} value={tr("Ảnh bị mờ, chưa đọc được dòng mã cuối thẻ", "Blurred – the code line at the bottom isn't readable")} />
          <Row label={tr("Hạn bổ sung", "Due by")} value={tr("14/11/2026 (còn 4 ngày)", "14 Nov 2026 (4 days left)")} tone="danger" />
        </dl>
      </Section>
      <p className="mt-4 flex gap-2 text-caption text-fg-tertiary"><CalendarClock className="size-4 shrink-0" />{tr("Quá hạn, hồ sơ sẽ tự huỷ và bạn cần làm lại từ đầu.", "After the deadline, the application is cancelled and you'll need to start again.")}</p>
    </Screen>
  );
}

export function Duplicate({ go }: ScreenProps) {
  const { tr } = useLang();
  return (
    <Screen title={tr("Mở tài khoản", "Open an account")} footer={<><Button size="lg" block onClick={() => go("intro")}>{tr("Đăng nhập", "Log in")}</Button><Button variant="ghost" block>{tr("Quên mật khẩu", "Forgot password")}</Button></>}>
      <PageTitle title={tr("Bạn đã có tài khoản Aegis", "You already have an Aegis account")} desc={tr("Số CCCD này đã được dùng để mở tài khoản. Vui lòng đăng nhập.", "This ID number is already linked to an account. Please log in.")} />
      <Section className="flex items-center gap-3 p-4"><UserCheck className="size-6 text-action-subtle-fg" /><span className="text-body-sm">{tr("CCCD", "ID")} <span className="font-semibold tabular">089 •••• 5678</span></span></Section>
      <Alert tone="warning" className="mt-4" title={tr("Không phải bạn mở tài khoản này?", "Didn't open this account?")}>{tr("Gọi ngay 1900 6868 để khoá tài khoản.", "Call 1900 6868 now to lock it.")}</Alert>
    </Screen>
  );
}

export function Resume({ go }: ScreenProps) {
  const { tr } = useLang();
  return (
    <Screen title={tr("Mở tài khoản", "Open an account")} footer={<><Button size="lg" block onClick={() => go("liveness")}>{tr("Tiếp tục từ bước 4", "Continue from step 4")}</Button><Button variant="ghost" block onClick={() => go("intro")}>{tr("Làm lại từ đầu", "Start over")}</Button></>}>
      <PageTitle title={tr("Tiếp tục hồ sơ đang làm dở?", "Continue where you left off?")} desc={tr("Bạn đã xong 3/5 bước. Hồ sơ được giữ đến 16/11/2026.", "You've completed 3 of 5 steps. We'll keep your application until 16 Nov 2026.")} />
      <Section>
        <ul className="px-4 py-1">
          {[tr("Đồng ý điều khoản", "Terms accepted"), tr("Chụp giấy tờ", "ID photographed"), tr("Quét chip NFC", "NFC chip scanned")].map((s) => (
            <li key={s} className="flex items-center gap-3 border-b border-line-subtle py-3 text-body-sm"><CheckCircle2 className="size-5 text-success" />{s}</li>
          ))}
          <li className="flex items-center gap-3 py-3 text-body-sm text-fg-tertiary"><History className="size-5" />{tr("Xác thực khuôn mặt – làm lại để đảm bảo an toàn", "Face check – must be redone for your security")}</li>
        </ul>
      </Section>
    </Screen>
  );
}

export function ExpiredDoc({ go }: ScreenProps) {
  const { tr } = useLang();
  return (
    <Screen title={tr("Giấy tờ không hợp lệ", "Document not valid")} footer={<><Button size="lg" block onClick={() => go("docType")}>{tr("Dùng giấy tờ khác", "Use another document")}</Button><Button variant="ghost" block>{tr("Tìm nơi cấp đổi CCCD", "Where to renew your ID")}</Button></>}>
      <Alert tone="danger" title={tr("CCCD đã hết hạn", "Your ID has expired")}>{tr("Vui lòng cấp đổi trước khi mở tài khoản.", "Please renew it before opening an account.")}</Alert>
      <Section className="mt-4">
        <dl className="divide-y divide-[var(--border-subtle)] px-4">
          <Row label={tr("Số CCCD", "ID number")} value="089 •••• 5678" />
          <Row label={tr("Có giá trị đến", "Expiry date")} value="15/03/2025" tone="danger" />
        </dl>
      </Section>
      <p className="mt-4 flex gap-2 text-caption text-fg-tertiary"><ShieldCheck className="size-4 shrink-0" />{tr("Chúng tôi không lưu ảnh giấy tờ đã hết hạn.", "We don't keep photos of expired documents.")}</p>
    </Screen>
  );
}
