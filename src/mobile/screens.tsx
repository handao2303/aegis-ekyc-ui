import { useEffect, useRef, useState, ReactNode } from "react";
import {
  Camera, Check, CheckCircle2, ChevronRight, Clock, CreditCard, FileText, IdCard,
  Lock, Nfc, RefreshCw, ScanFace, ShieldCheck, Smartphone, Sun, UserCheck, XCircle, Bell, CalendarClock,
  Upload, History, Headphones, Copy, Building2, ArrowRight, BookUser, CameraOff, FlipHorizontal2, BookOpen, Globe2,
} from "lucide-react";
import { Alert, Button, Checkbox, ProgressBar, cx } from "../components/ui";
import { FaceAvatar, IconTile, IdCardArt, PageTitle, ScanIllustration, Screen } from "./MobileShell";
import { useCamera, useCapture } from "./camera";
import { useLang } from "../i18n";
import { useEkyc } from "../ekyc/EkycContext";
import { PersonaPicker } from "../ekyc/Overlay";
import { fmtTime } from "../ekyc/api";
import { TERMS, TERMS_EFFECTIVE, TERMS_VERSION } from "../ekyc/terms";
import { Modal } from "../components/ui";

/* Định dạng dữ liệu thật từ backend */
const dmy = (iso: string) => iso.split("-").reverse().join("/");
const groupId = (id: string) => `${id.slice(0, 3)} ${id.slice(3, 6)} ${id.slice(6, 9)} ${id.slice(9)}`;
const maskId = (id: string) => `${id.slice(0, 3)} •••• ${id.slice(-4)}`;
const ITEM_LABEL: Record<string, [string, string]> = {
  FRONT_BLURRY: ["Ảnh mặt trước CCCD", "Front of ID card"],
  BACK_BLURRY_MRZ: ["Ảnh mặt sau CCCD", "Back of ID card"],
  BACK_MISSING: ["Ảnh mặt sau CCCD", "Back of ID card"],
  OCR_CHIP_MISMATCH: ["Chụp lại giấy tờ và quét chip", "Retake ID and rescan chip"],
  OTHER: ["Thông tin khác", "Other information"],
};

export type ScreenKey =
  | "intro" | "consent" | "reconsent" | "docType" | "captureFront" | "reviewFront" | "captureBack"
  | "ocrReview" | "nfc" | "unreadable" | "liveness" | "verifying"
  | "approved" | "refer" | "rejected" | "requestInfo" | "duplicate" | "resume" | "expiredDoc"
  | "cardHome" | "boostOffer" | "boostLocked" | "privacy";

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
  return <div className={cx("mx-auto grid size-20 place-items-center rounded-full ring-8 ring-white/70", cls)}>{icon}</div>;
}

/* ---------- 00 Giới thiệu ---------- */
export function Intro({ go }: ScreenProps) {
  const { tr } = useLang();
  const steps: [ReactNode, string, string][] = [
    [<FileText key="f" className="size-5" />, tr("Đồng ý điều khoản", "Accept the terms"), tr("Chọn dữ liệu bạn cho phép dùng", "Choose what data we can use")],
    [<IdCard key="i" className="size-5" />, tr("Chụp CCCD gắn chip", "Photograph your chip ID"), tr("Mặt trước và mặt sau", "Front and back")],
    [<Nfc key="n" className="size-5" />, tr("Quét chip NFC", "Scan the NFC chip"), tr("Áp thẻ vào mặt sau điện thoại", "Hold the card to your phone")],
    [<ScanFace key="s" className="size-5" />, tr("Xác thực khuôn mặt", "Verify your face"), tr("Làm theo hướng dẫn trên màn hình", "Follow the on-screen prompts")],
  ];
  return (
    <Screen
      title="Aegis Bank"
      footer={
        <>
          <Button size="lg" block onClick={() => go("consent")} iconRight={<ArrowRight className="size-5" />}>{tr("Bắt đầu", "Get started")}</Button>
          <Button variant="ghost" block onClick={() => go("resume")}>{tr("Tiếp tục hồ sơ đang dở", "Continue a saved application")}</Button>
        </>
      }
    >
      <ScanIllustration />
      <h2 className="mt-7 text-[30px] font-semibold leading-[36px] tracking-[-0.02em]">
        {tr("Mở tài khoản", "Open an account")}
        <br />
        <span className="text-gradient">{tr("chỉ trong 3 phút", "in just 3 minutes")}</span>
      </h2>
      <p className="mt-2.5 text-[15px] leading-[22px] text-fg-secondary">
        {tr("Không cần ra quầy. Chuẩn bị CCCD gắn chip hoặc hộ chiếu gắn chip và điện thoại có NFC.", "No branch visit. Have your chip ID card or e-passport and an NFC-enabled phone ready.")}
      </p>
      <ol className="mt-6 flex flex-col gap-3">
        {steps.map(([ic, t, d]) => (
          <li key={t} className="flex items-center gap-4 rounded-[18px] border border-line-subtle p-3">
            <IconTile size={44}>{ic}</IconTile>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold">{t}</span>
              <span className="block text-caption text-fg-tertiary">{d}</span>
            </span>
          </li>
        ))}
      </ol>
      <PersonaPicker />
    </Screen>
  );
}

/* ---------- 01 Đồng ý ---------- */
export function Consent({ go, reconsent }: ScreenProps & { reconsent?: boolean }) {
  const { tr, lang } = useLang();
  const ek = useEkyc();
  const [v, setV] = useState<Record<string, boolean>>({});
  const [terms, setTerms] = useState(false);
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
        <Button size="lg" block disabled={!ok} onClick={() => { if (ek) ek.marketing.current = !!v["scope-marketing"]; go(reconsent ? "liveness" : "docType"); }}>
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
      <button onClick={() => setTerms(true)} aria-haspopup="dialog" className="interactive mt-4 flex w-full items-center gap-3 rounded-lg bg-bg-surface p-4 text-left shadow-raised">
        <FileText className="size-5 shrink-0 text-fg-tertiary" />
        <span className="min-w-0 flex-1">
          <span className="block text-body-sm font-semibold">{tr("Điều khoản và điều kiện", "Terms and conditions")}</span>
          <span className="block text-caption text-fg-tertiary">{tr(`Phiên bản ${TERMS_VERSION} · hiệu lực ${TERMS_EFFECTIVE.vi}`, `Version ${TERMS_VERSION} · effective ${TERMS_EFFECTIVE.en}`)}</span>
        </span>
        <ChevronRight className="size-5 text-fg-tertiary" />
      </button>
      <p className="mt-4 text-caption text-fg-tertiary">
        {tr("Bạn có thể rút lại sự đồng ý trong Cài đặt › Quyền riêng tư. Một số dữ liệu vẫn được lưu theo thời hạn pháp luật yêu cầu.", "You can withdraw consent in Settings › Privacy. Some data is kept for the period required by law.")}
      </p>
      <Modal open={terms} onClose={() => setTerms(false)} title={tr("Điều khoản mở tài khoản trực tuyến", "Online account opening terms")}
        footer={<Button onClick={() => setTerms(false)}>{tr("Đã đọc", "Done")}</Button>}>
        <p className="text-caption text-fg-tertiary">{tr(`Phiên bản ${TERMS_VERSION} · hiệu lực ${TERMS_EFFECTIVE.vi}`, `Version ${TERMS_VERSION} · effective ${TERMS_EFFECTIVE.en}`)}</p>
        <div className="mt-3 flex max-h-[55vh] flex-col gap-4 overflow-y-auto pr-1">
          {TERMS.map((sec) => (
            <section key={sec.h[0]}>
              <h3 className="text-body-sm font-semibold">{lang === "en" ? sec.h[1] : sec.h[0]}</h3>
              {sec.p.map((x) => <p key={x[0]} className="mt-1.5 text-body-sm text-fg-secondary">{lang === "en" ? x[1] : x[0]}</p>)}
            </section>
          ))}
        </div>
      </Modal>
    </Screen>
  );
}

/* ---------- 02 Chọn giấy tờ ---------- */
export function DocType({ go }: ScreenProps) {
  const { tr } = useLang();
  const ek = useEkyc();
  const [sel, setSel] = useState(ek?.docType === "PASSPORT" ? "passport" : "cccd");
  const opts = [
    { id: "cccd", icon: <IdCard className="size-6" />, title: tr("CCCD gắn chip", "Chip-based citizen ID"), desc: tr("Duyệt tự động khi đọc được chip", "Approved instantly when the chip is read") },
    { id: "cancuoc", icon: <BookUser className="size-6" />, title: tr("Thẻ Căn cước (mẫu 2024)", "Identity card (2024)"), desc: tr("Cấp từ ngày 01/07/2024", "Issued from 1 Jul 2024") },
    { id: "passport", icon: <BookOpen className="size-6" />, title: tr("Hộ chiếu gắn chip", "Chip passport (e-passport)"), desc: tr("Hộ chiếu Việt Nam hoặc nước ngoài · chụp trang thông tin", "Vietnamese or foreign · photo of the data page") },
  ];
  const next = () => { ek?.chooseDocType(sel === "passport" ? "PASSPORT" : "CCCD"); go("captureFront"); };
  return (
    <Screen title={tr("Giấy tờ tuỳ thân", "ID document")} step={1} onBack={() => go("consent")} footer={<Button size="lg" block onClick={next}>{tr("Tiếp tục", "Continue")}</Button>}>
      <PageTitle title={tr("Chọn giấy tờ để tiếp tục", "Select a document to continue")} desc={tr("Dùng giấy tờ gốc, còn hạn để xác minh danh tính của bạn.", "Use an original, valid document to verify your identity.")} />
      <div role="radiogroup" aria-label={tr("Loại giấy tờ", "Document type")} className="flex flex-col gap-3">
        {opts.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={sel === o.id}
            onClick={() => setSel(o.id)}
            className={cx("interactive flex w-full items-center gap-4 rounded-[20px] border p-4 text-left transition-colors", sel === o.id ? "border-[#b46cf6] bg-[#faf6ff]" : "border-line-subtle")}
          >
            <IconTile>{o.icon}</IconTile>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold">{o.title}</span>
              <span className="block text-caption text-fg-tertiary">{o.desc}</span>
            </span>
            <span className={cx("grid size-6 shrink-0 place-items-center rounded-full border-2", sel === o.id ? "border-[#8a45e0]" : "border-line-strong")}>
              {sel === o.id && <span className="size-3 rounded-full" style={{ background: "var(--grad-brand)" }} />}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-5 flex gap-2 text-caption text-fg-tertiary">
        <Building2 className="size-4 shrink-0" />
        {tr("CMND 9 số và CCCD không gắn chip vui lòng mở tài khoản tại quầy giao dịch.", "For 9-digit IDs or non-chip ID cards, please visit a branch.")}
      </p>
      {sel === "passport" && (
        <p className="mt-2 flex gap-2 text-caption text-fg-tertiary">
          <Globe2 className="size-4 shrink-0" />
          {tr("Người nước ngoài: hồ sơ được nhân viên xem xét để kiểm tra thị thực/thẻ tạm trú, thường trong 24 giờ.", "Foreign nationals: our team reviews your visa or residence card, usually within 24 hours.")}
        </p>
      )}
    </Screen>
  );
}

/* ---------- 03 Camera ---------- */
const CARD_RATIO = 1.586;

/** Khung ngắm 4 góc */
function Corners({ ready, radius = 16 }: { ready: boolean; radius?: number }) {
  return (
    <>
      {(["left-0 top-0 border-l-[3px] border-t-[3px]", "right-0 top-0 border-r-[3px] border-t-[3px]", "left-0 bottom-0 border-l-[3px] border-b-[3px]", "right-0 bottom-0 border-r-[3px] border-b-[3px]"] as const).map((c, i) => (
        <span
          key={c}
          aria-hidden
          className={cx("absolute -m-2 size-9 transition-colors", c, ready ? "border-[#f7b31b]" : "border-white/80")}
          style={{ [["borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"][i]]: radius }}
        />
      ))}
    </>
  );
}

function CameraFallbackNote({ status, onRetry }: { status: string; onRetry: () => void }) {
  const { tr } = useLang();
  if (status !== "denied" && status !== "unavailable") return null;
  return (
    <div className="mt-5 flex items-start gap-3 rounded-[16px] bg-white/10 p-3 text-body-sm">
      <CameraOff className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{status === "denied" ? tr("Chưa có quyền dùng camera", "Camera access is off") : tr("Không tìm thấy camera", "No camera found")}</p>
        <p className="text-caption text-white/70">
          {status === "denied"
            ? tr("Vào Cài đặt › Safari › Camera để cho phép. Tạm thời dùng ảnh minh hoạ.", "Allow it in Settings › Safari › Camera. Using a sample image for now.")
            : tr("Đang dùng ảnh minh hoạ để bạn đi tiếp luồng.", "Using a sample image so you can continue.")}
        </p>
      </div>
      <button onClick={onRetry} className="interactive shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-caption font-semibold">{tr("Thử lại", "Retry")}</button>
    </div>
  );
}

function CameraView({ side, go }: { side: "front" | "back"; go: (k: ScreenKey) => void }) {
  const { tr } = useLang();
  const passport = useEkyc()?.docType === "PASSPORT";
  // Hộ chiếu chỉ chụp trang thông tin rồi sang bước kiểm tra
  const after: ScreenKey = side === "front" ? "reviewFront" : "ocrReview";
  const { real, setPhoto } = useCapture();
  const cam = useCamera("environment", real);
  const live = real && cam.status === "live";
  const fallback = !real || cam.status === "denied" || cam.status === "unavailable";
  const [aligned, setAligned] = useState(false);
  const [flash, setFlash] = useState(false);

  // Mô phỏng: căn chỉnh xong sau 1,4s. Camera thật: cho chụp ngay khi có hình.
  useEffect(() => {
    setAligned(false);
    if (live) return setAligned(true);
    if (!fallback) return;
    const t = setTimeout(() => setAligned(true), 1400);
    return () => clearTimeout(t);
  }, [side, live, fallback]);

  const shoot = () => {
    if (live) {
      const url = cam.capture({ crop: CARD_RATIO });
      if (url) setPhoto(side, url);
      setFlash(true);
      setTimeout(() => go(after), 180);
    } else {
      setPhoto(side, undefined);
      go(after);
    }
  };

  return (
    <Screen
      dark
      title={passport ? tr("Trang thông tin hộ chiếu", "Passport data page") : side === "front" ? tr("Mặt trước CCCD", "ID card – front") : tr("Mặt sau CCCD", "ID card – back")}
      step={1}
      onBack={() => go(side === "front" ? "docType" : "reviewFront")}
      footer={
        <div className="flex items-center justify-between">
          <span className="w-[88px]" />
          <button
            onClick={shoot}
            disabled={!aligned}
            aria-label={tr("Chụp ảnh", "Take photo")}
            className="interactive grid size-[76px] place-items-center rounded-full p-[4px] disabled:opacity-40"
            style={{ background: "var(--grad-brand)" }}
          >
            <span className="grid size-full place-items-center rounded-full bg-[var(--camera-bg)] p-[4px]"><span className="size-full rounded-full bg-white" /></span>
          </button>
          <button onClick={() => go("unreadable")} className="interactive h-11 w-[88px] rounded-full bg-white/10 text-caption font-semibold">
            {tr("Gặp sự cố?", "Trouble?")}
          </button>
        </div>
      }
    >
      <p className="mt-2 text-[20px] font-semibold">{passport ? tr("Mở trang có ảnh, đặt vào khung", "Open the photo page and fit it in the frame") : side === "front" ? tr("Đặt mặt trước vào khung", "Place the front in the frame") : tr("Đặt mặt sau vào khung", "Place the back in the frame")}</p>
      <p className="text-body-sm text-white/70">{passport ? tr("Thấy rõ 2 dòng mã ở cuối trang, không bị ngón tay che.", "Both code lines at the bottom must be visible, not covered by fingers.") : tr("Giữ điện thoại song song với thẻ, đủ sáng, không loá.", "Keep the phone parallel to the card, in good light, no glare.")}</p>

      <div className="relative mx-auto mt-7 w-full" style={{ aspectRatio: String(CARD_RATIO) }}>
        <div className="absolute inset-0 overflow-hidden rounded-[16px] bg-black">
          {real && (
            <video ref={cam.videoRef} playsInline muted autoPlay className={cx("absolute inset-0 size-full object-cover", live ? "opacity-100" : "opacity-0")} />
          )}
          {fallback && (passport ? <PassportArt /> : <IdCardArt side={side} className="opacity-90" />)}
          {real && cam.status === "starting" && (
            <p className="absolute inset-0 grid place-items-center text-body-sm text-white/70">{tr("Đang mở camera…", "Opening camera…")}</p>
          )}
          <span aria-hidden className="anim-scan-line absolute inset-x-0 h-[3px] rounded-full" style={{ background: "var(--grad-brand)", boxShadow: "0 0 14px rgba(180,108,246,.8)" }} />
          {flash && <span className="absolute inset-0 bg-white/80" aria-hidden />}
        </div>
        <Corners ready={aligned} />
      </div>

      <div className="mt-7 flex justify-center" aria-live="polite">
        <span className={cx("inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-body-sm font-medium", aligned ? "bg-white text-[#1a1a1a]" : "bg-white/15")}>
          {aligned ? <Check className="size-4 text-[#157347]" /> : <Camera className="size-4" />}
          {live ? tr("Căn thẻ vừa khung rồi bấm chụp", "Fit the card in the frame, then tap") : aligned ? tr("Đã căn chỉnh – có thể chụp", "Aligned – ready to capture") : tr("Đang tìm giấy tờ…", "Looking for your card…")}
        </span>
      </div>
      {real && <CameraFallbackNote status={cam.status} onRetry={cam.retry} />}
      <ul className="mt-5 grid grid-cols-3 gap-2 text-center text-caption text-white/70">
        <li>{tr("Không loá sáng", "No glare")}</li>
        <li>{tr("Đủ 4 góc", "All 4 corners")}</li>
        <li>{tr("Không che chữ", "Text not covered")}</li>
      </ul>
    </Screen>
  );
}
export const CaptureFront = ({ go }: ScreenProps) => <CameraView side="front" go={go} />;
export const CaptureBack = ({ go }: ScreenProps) => <CameraView side="back" go={go} />;

/** Ảnh đã chụp hoặc ảnh minh hoạ */
/** Trang thông tin hộ chiếu (minh hoạ, MRZ TD3) */
function PassportArt() {
  const ek = useEkyc();
  const o = ek?.live ? ek.persona.ocr : null;
  const name = (o?.full_name ?? "DANG MINH QUAN").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Đ/g, "D").toUpperCase();
  const nat = o?.nationality ?? "VNM";
  // MRZ ghi HỌ trước: tên Việt Nam họ đứng đầu, tên nước ngoài họ đứng cuối
  const parts = name.split(" ");
  const surname = nat === "VNM" ? parts[0] : parts[parts.length - 1];
  const given = nat === "VNM" ? parts.slice(1) : parts.slice(0, -1);
  const ymd = (iso?: string) => (iso ? iso.slice(2).replace(/-/g, "") : "000000");
  const mrz1 = `P<${nat}${surname}<<${given.join("<")}`.padEnd(44, "<").slice(0, 44);
  const mrz2 = `${(o?.passport_no ?? "C1414141").padEnd(9, "<")}0${nat}${ymd(o?.dob ?? "1996-04-14")}0${o?.sex ?? "M"}${ymd(o?.expiry ?? "2033-04-14")}0`.padEnd(44, "<").slice(0, 44);
  return (
    <div className="absolute inset-0 flex flex-col bg-[#eef1f6] p-[6%]" aria-hidden>
      <div className="flex flex-1 gap-[5%]">
        <div className="aspect-[3/4] h-full rounded-md bg-[#c9d3e3]" />
        <div className="flex flex-1 flex-col gap-[8%] pt-[2%]">
          {[70, 55, 80, 45, 60].map((w, i) => <span key={i} className="h-[7%] rounded bg-[#c3ccda]" style={{ width: `${w}%` }} />)}
        </div>
      </div>
      <div className="mt-[3%] font-mono text-[7.5px] leading-[10px] tracking-[0.06em] text-[#3a4256]">
        <div className="truncate">{mrz1}</div>
        <div className="truncate">{mrz2}</div>
      </div>
    </div>
  );
}

function CardPhoto({ side }: { side: "front" | "back" }) {
  const { tr } = useLang();
  const { photos } = useCapture();
  const passport = useEkyc()?.docType === "PASSPORT";
  const url = photos[side];
  if (!url && passport) return <div className="relative w-full overflow-hidden rounded-[14px]" style={{ aspectRatio: String(CARD_RATIO) }}><PassportArt /></div>;
  return url ? (
    <img src={url} alt={side === "front" ? tr("Ảnh mặt trước CCCD bạn vừa chụp", "Your photo of the ID front") : tr("Ảnh mặt sau CCCD bạn vừa chụp", "Your photo of the ID back")} className="w-full rounded-[14px] object-cover" style={{ aspectRatio: String(CARD_RATIO) }} />
  ) : (
    <IdCardArt side={side} />
  );
}

/* ---------- 04 Kiểm tra ảnh ---------- */
export function ReviewFront({ go }: ScreenProps) {
  const { tr } = useLang();
  const passport = useEkyc()?.docType === "PASSPORT";
  const { photos } = useCapture();
  const checks = [tr("Ảnh rõ nét", "Sharp image"), tr("Không bị loá", "No glare"), tr("Thấy đủ 4 góc", "All 4 corners visible")];
  return (
    <Screen
      title={tr("Kiểm tra ảnh", "Check your photo")}
      step={1}
      onBack={() => go("captureFront")}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={() => go("captureFront")}>{tr("Chụp lại", "Retake")}</Button>
          <Button size="lg" onClick={() => go(passport ? "ocrReview" : "captureBack")}>{tr("Dùng ảnh này", "Use photo")}</Button>
        </div>
      }
    >
      <PageTitle title={tr("Ảnh có đọc rõ không?", "Is everything readable?")} desc={tr("Đảm bảo nhìn rõ toàn bộ chữ và số trên thẻ.", "Make sure all text and numbers on the card are clear.")} />
      <div className="rounded-[24px] bg-bg-sunken p-4"><CardPhoto side="front" /></div>
      <ul className="mt-5 flex flex-col gap-3">
        {checks.map((c) => (
          <li key={c} className="flex items-center gap-3 text-[15px]"><span className="grid size-6 place-items-center rounded-full bg-success-subtle text-success"><Check className="size-4" /></span>{c}</li>
        ))}
      </ul>
      {photos.front && (
        <p className="mt-5 text-caption text-fg-tertiary">{tr("Ảnh chỉ nằm trên máy này trong bản demo, không được gửi đi.", "In this demo, photos stay on this device and are never uploaded.")}</p>
      )}
    </Screen>
  );
}

/* ---------- 05 Kiểm tra thông tin OCR ---------- */
export function OcrReview({ go }: ScreenProps) {
  const { tr } = useLang();
  const ek = useEkyc();
  const o = ek?.live ? ek.persona.ocr : null;
  const passport = ek?.docType === "PASSPORT";
  return (
    <Screen title={tr("Thông tin giấy tờ", "Document details")} step={1} onBack={() => go(passport ? "reviewFront" : "captureBack")} footer={<Button size="lg" block onClick={() => go("nfc")}>{tr("Xác nhận thông tin", "Confirm details")}</Button>}>
      <PageTitle title={tr("Kiểm tra thông tin", "Check your details")} desc={tr("Đọc tự động từ ảnh giấy tờ. Nếu sai, vui lòng chụp lại.", "Read automatically from your photos. If anything is wrong, retake the photos.")} />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <CardPhoto side="front" />
        {passport ? <div className="grid place-items-center rounded-[14px] bg-bg-sunken p-3 text-center text-caption text-fg-tertiary">{tr("Hộ chiếu chỉ cần trang thông tin", "Passports only need the data page")}</div> : <CardPhoto side="back" />}
      </div>
      <Section>
        <dl className="divide-y divide-[var(--border-subtle)] px-4">
          <Row label={tr("Họ và tên", "Full name")} value={o?.full_name ?? "NGUYỄN THỊ MINH THƯ"} strong />
          {passport ? (
            <>
              <Row label={tr("Số hộ chiếu", "Passport number")} value={o?.passport_no ?? "C1414141"} />
              <Row label={tr("Quốc tịch", "Nationality")} value={o?.nationality ?? "VNM"} />
              {(o ? o.id_number : "079096001414") && <Row label={tr("Số định danh", "Personal ID number")} value={groupId(o ? o.id_number : "079096001414")} />}
            </>
          ) : <Row label={tr("Số CCCD", "ID number")} value={o ? groupId(o.id_number) : "089 1234 5678"} />}
          <Row label={tr("Ngày sinh", "Date of birth")} value={o ? dmy(o.dob) : "15/03/1992"} />
          <Row label={tr("Giới tính", "Sex")} value={o?.sex === "M" ? tr("Nam", "Male") : tr("Nữ", "Female")} />
          <Row label={passport ? tr("Nơi sinh", "Place of birth") : tr("Quê quán", "Place of origin")} value={o?.origin ?? "Tân Châu, An Giang"} />
          <Row label={tr("Ngày cấp", "Date of issue")} value={o ? dmy(o.issued) : "12/06/2021"} />
          <Row label={tr("Có giá trị đến", "Expiry date")} value={o ? dmy(o.expiry) : "15/03/2032"} />
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
  const ek = useEkyc();
  const next = (read: boolean) => { if (ek) ek.chipRead.current = read; go("liveness"); };
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
          <Button size="lg" block onClick={() => next(true)}>{tr("Tiếp tục", "Continue")}</Button>
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
        title={phase === "done" ? tr("Đọc chip thành công", "Chip read successfully") : ek?.docType === "PASSPORT" ? tr("Áp bìa sau hộ chiếu vào điện thoại", "Hold the passport's back cover to your phone") : tr("Áp CCCD vào mặt sau điện thoại", "Hold your ID to the back of your phone")}
        desc={phase === "done" ? tr("Chữ ký số trên chip hợp lệ.", "The chip's digital signature is valid.") : phase === "reading" ? tr("Giữ yên cho đến khi hoàn tất.", "Keep still until it finishes.") : ek?.docType === "PASSPORT" ? tr("Gập hộ chiếu, đặt bìa sau (có biểu tượng chip) sát phần trên lưng máy, giữ 3–5 giây.", "Close the passport and hold the back cover (with the chip symbol) to the top of your phone for 3–5 seconds.") : tr("Đặt thẻ gần camera sau, giữ 3–5 giây.", "Place the card near the rear camera for 3–5 seconds.")}
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
            <Button size="sm" variant="secondary" onClick={() => next(false)}>{tr("Vẫn bỏ qua", "Skip anyway")}</Button>
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
  const { real, setPhoto } = useCapture();
  const cam = useCamera("user", real);
  const live = real && cam.status === "live";
  const challenges = [tr("Nhìn thẳng vào camera", "Look straight at the camera"), tr("Quay mặt sang trái", "Turn your head left"), tr("Quay mặt sang phải", "Turn your head right"), tr("Mỉm cười", "Smile")];
  const [i, setI] = useState(-1);
  const captureRef = useRef(cam.capture);
  captureRef.current = cam.capture;
  useEffect(() => {
    if (i < 0) return;
    if (i === 1 && live) {
      // Lưu ảnh selfie khi khách đang nhìn thẳng (sau thử thách đầu tiên)
      const url = captureRef.current({ mirror: true, maxWidth: 720 });
      if (url) setPhoto("selfie", url);
    }
    if (i >= challenges.length) {
      const t = setTimeout(() => go("verifying"), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI(i + 1), 1500);
    return () => clearTimeout(t);
  }, [i, go, challenges.length, live, setPhoto]);
  const done = Math.max(0, Math.min(i, challenges.length));
  const C = 2 * Math.PI * 128;
  return (
    <Screen dark title={tr("Xác thực khuôn mặt", "Face verification")} step={3} onBack={() => go("nfc")}
      footer={i < 0
        ? <Button size="lg" block disabled={real && cam.status === "starting"} onClick={() => setI(0)}>{tr("Tôi đã sẵn sàng", "I'm ready")}</Button>
        : <p className="text-center text-body-sm text-white/75 tabular" aria-live="polite">{tr("Đang kiểm tra", "Checking")} · {done}/{challenges.length}</p>}
    >
      <div className="relative mx-auto mt-2 aspect-[3/4] w-[76%]">
        <div className="absolute inset-[4%] overflow-hidden rounded-[50%] bg-white/5">
          {real && (
            <video ref={cam.videoRef} playsInline muted autoPlay className={cx("absolute inset-0 size-full -scale-x-100 object-cover", live ? "opacity-100" : "opacity-0")} />
          )}
          {!live && <FaceAvatar className="absolute inset-[18%] opacity-60" />}
        </div>
        <svg viewBox="0 0 280 360" className="absolute inset-0 size-full" aria-hidden>
          <defs>
            <linearGradient id="lv-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#b46cf6" />
              <stop offset="1" stopColor="#f7b31b" />
            </linearGradient>
          </defs>
          <ellipse cx="140" cy="180" rx="128" ry="168" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="6" />
          <ellipse cx="140" cy="180" rx="128" ry="168" fill="none" stroke="url(#lv-grad)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${(done / challenges.length) * C * 1.15} ${C * 2}`} transform="rotate(-90 140 180)" style={{ transition: "stroke-dasharray .5s" }} />
        </svg>
      </div>
      <div className="mt-6 text-center" aria-live="assertive">
        <p className="text-[22px] font-semibold">{i < 0 ? tr("Đưa khuôn mặt vào khung", "Fit your face in the oval") : i < challenges.length ? challenges[i] : tr("Hoàn tất", "Done")}</p>
        <p className="mt-1 text-body-sm text-white/70">{i < 0 ? tr("Bỏ kính râm, khẩu trang và mũ", "Remove sunglasses, mask and hat") : tr("Làm theo hướng dẫn", "Follow the instruction")}</p>
      </div>
      {real && <CameraFallbackNote status={cam.status} onRetry={cam.retry} />}
      {live && (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-caption text-white/55"><FlipHorizontal2 className="size-3.5" />{tr("Bản demo: thử thách chạy theo thời gian, chưa nhận diện cử động thật", "Demo: prompts are timed; head movement isn't analysed yet")}</p>
      )}
    </Screen>
  );
}

/* ---------- 08 Đang xác minh ---------- */
/** Đối chiếu ảnh CCCD với ảnh khuôn mặt vừa chụp */
function MatchPreview() {
  const { tr } = useLang();
  const { photos } = useCapture();
  return (
    <div className="mb-5 flex items-center justify-center gap-3 rounded-[24px] bg-bg-sunken p-4">
      <div className="w-[46%]">
        {photos.front ? <img src={photos.front} alt={tr("Ảnh CCCD", "ID photo")} className="w-full rounded-[12px] object-cover" style={{ aspectRatio: String(CARD_RATIO) }} /> : <IdCardArt side="front" />}
      </div>
      <span className="grid size-9 shrink-0 place-items-center rounded-full text-white" style={{ background: "var(--grad-action)" }}><ScanFace className="size-5" /></span>
      <div className="grid size-[84px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-white bg-bg-surface shadow-[0_6px_16px_rgba(72,43,100,0.15)]">
        {photos.selfie ? <img src={photos.selfie} alt={tr("Ảnh khuôn mặt", "Face photo")} className="size-full object-cover" /> : <FaceAvatar className="size-[70px]" />}
      </div>
    </div>
  );
}

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
      <MatchPreview />
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
  const r = useEkyc()?.result;
  const acct = r?.account_no ?? "190366882025";
  const [copied, setCopied] = useState(false);
  const next: [ReactNode, string, string][] = [
    [<Lock key="l" className="size-5" />, tr("Tạo mã PIN giao dịch", "Set up your transaction PIN"), tr("Bắt buộc trước giao dịch đầu tiên", "Needed before your first payment")],
    [<CreditCard key="c" className="size-5" />, tr("Phát hành thẻ ghi nợ ảo", "Get a virtual debit card"), tr("Dùng ngay, miễn phí năm đầu", "Ready instantly, free for year one")],
  ];
  const copy = () => {
    navigator.clipboard?.writeText(acct).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <Screen title={tr("Kết quả", "Result")} footer={<Button size="lg" block onClick={() => go("cardHome")}>{tr("Vào trang chủ", "Go to home")}</Button>}>
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full text-white" style={{ background: "var(--grad-action)" }}><CheckCircle2 className="size-6" /></span>
        <div>
          <h2 className="text-[24px] font-semibold leading-[30px] tracking-[-0.02em]">{tr("Mở tài khoản thành công", "Your account is open")}</h2>
          <p className="text-body-sm text-fg-secondary">{tr("Chào mừng bạn đến với Aegis Bank.", "Welcome to Aegis Bank.")}</p>
        </div>
      </div>

      {/* Thẻ tài khoản */}
      <div className="relative mt-6 overflow-hidden rounded-[24px] p-5 text-white" style={{ background: "var(--aurora-deep)" }}>
        <div aria-hidden className="absolute -right-12 -top-16 size-48 rounded-full opacity-60 blur-3xl" style={{ background: "var(--grad-brand)" }} />
        <div className="relative flex items-center justify-between">
          <span className="text-body-sm text-white/70">{tr("Tài khoản thanh toán · VND", "Current account · VND")}</span>
          <span className="rounded-full bg-aurora-amber px-2.5 py-0.5 text-caption font-semibold text-aurora-ink">{tr("Đang hoạt động", "Active")}</span>
        </div>
        <div className="relative mt-4 flex items-center gap-3">
          <span className="text-[26px] font-bold tracking-[0.04em] tabular">{acct.replace(/(\d{4})(?=\d)/g, "$1 ")}</span>
          <button onClick={copy} className="interactive grid size-9 place-items-center rounded-full bg-white/10" aria-label={tr("Sao chép số tài khoản", "Copy account number")}>
            {copied ? <Check className="size-4 text-aurora-amber" /> : <Copy className="size-4" />}
          </button>
        </div>
        <p className="relative mt-1 h-4 text-caption text-aurora-amber" aria-live="polite">{copied ? tr("Đã sao chép", "Copied") : ""}</p>
        <div className="relative mt-3 flex items-end justify-between border-t border-white/10 pt-3">
          <div>
            <p className="text-caption text-white/60">{tr("Chủ tài khoản", "Account holder")}</p>
            <p className="text-body-sm font-semibold">{r?.holder ?? "NGUYỄN THỊ MINH THƯ"}</p>
          </div>
          <p className="shrink-0 text-caption text-white/60 tabular">{r?.decided_at ? fmtTime(r.decided_at) : "09:42 · 09/11/2026"}</p>
        </div>
      </div>

      <Receipt>
        <Row label={tr("Số dư khả dụng", "Available balance")} value="0 ₫" strong />
        <Row label={tr("Mã hồ sơ", "Reference")} value={r?.session_id ?? "EKS-2611-0042"} />
      </Receipt>

      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-body font-semibold">{tr("Việc tiếp theo", "Next steps")}</h3>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {next.map(([ic, t, d]) => (
          <li key={t}>
            <button className="interactive flex w-full items-center gap-3 rounded-lg bg-bg-surface p-4 text-left shadow-raised">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-action-subtle text-action-subtle-fg">{ic}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-body-sm font-semibold">{t}</span>
                <span className="block text-caption text-fg-tertiary">{d}</span>
              </span>
              <span className="grid size-9 place-items-center rounded-full bg-bg-sunken"><ChevronRight className="size-4" /></span>
            </button>
          </li>
        ))}
      </ul>
    </Screen>
  );
}

export function Refer({ go }: ScreenProps) {
  const { tr } = useLang();
  const ek = useEkyc();
  const r = ek?.result;
  const q = r?.queued_at;
  const tl = [
    { t: tr("Đã nhận hồ sơ", "Application received"), d: q ? fmtTime(q) : tr("09:41 hôm nay", "Today, 09:41"), s: "done" },
    r?.status === "REFER_RESUBMITTED"
      ? { t: tr("Đã nhận ảnh bổ sung", "Extra photo received"), d: tr("Hồ sơ được ưu tiên xem lại", "Your application is prioritised"), s: "doing" }
      : { t: tr("Đang xem xét", "Under review"), d: q ? tr(`Dự kiến trước ${fmtTime(q + 24 * 3600_000)}`, `Expected by ${fmtTime(q + 24 * 3600_000)}`) : tr("Dự kiến trước 09:41 ngày mai", "Expected by 09:41 tomorrow"), s: "doing" },
    { t: tr("Thông báo kết quả", "Decision sent"), d: tr("Qua SMS và ứng dụng", "By SMS and in the app"), s: "todo" },
  ];
  return (
    <Screen title={tr("Kết quả", "Result")} footer={<>
      {ek?.live && ek.session
        ? <Button size="lg" block icon={<RefreshCw className="size-5" />} loading={ek.busy} onClick={() => ek.refreshResult().then((k) => k && k !== "refer" && go(k))}>{tr("Kiểm tra kết quả", "Check for a decision")}</Button>
        : <Button size="lg" block icon={<Bell className="size-5" />}>{tr("Bật thông báo", "Turn on notifications")}</Button>}
      <Button variant="ghost" block onClick={() => go("privacy")}>{tr("Quyền riêng tư & đồng ý", "Privacy & consent")}</Button></>}>
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
      <Receipt><Row label={tr("Mã hồ sơ", "Reference")} value={r?.session_id ?? "EKS-2611-0042"} strong /></Receipt>
    </Screen>
  );
}

export function Rejected({ go }: ScreenProps) {
  const { tr } = useLang();
  const r = useEkyc()?.result;
  return (
    <Screen title={tr("Kết quả", "Result")} footer={<><Button size="lg" block icon={<Headphones className="size-5" />}>{tr("Gọi 1900 6868", "Call 1900 6868")}</Button><Button variant="ghost" block onClick={() => go("intro")}>{tr("Về trang chủ", "Back to home")}</Button></>}>
      <StatusMark tone="danger" icon={<XCircle className="size-9" />} />
      <h2 className="mt-4 text-center text-[22px] font-bold">{tr("Chưa thể mở tài khoản trực tuyến", "We can't open your account online")}</h2>
      <p className="mt-1 text-center text-body-sm text-fg-secondary">{r?.reason && r.reason.code !== "GENERAL" ? r.reason.message : tr("Hồ sơ chưa đáp ứng điều kiện mở tài khoản qua ứng dụng.", "Your application doesn't meet the requirements for opening an account in the app.")}</p>
      <Section title={tr("Bạn có thể", "What you can do")} className="mt-6">
        <ul className="flex flex-col gap-3 p-4 pt-3 text-body-sm text-fg-secondary">
          <li className="flex gap-2"><Building2 className="mt-0.5 size-4 shrink-0" />{tr("Đến chi nhánh gần nhất cùng CCCD bản gốc", "Visit your nearest branch with your original ID")}</li>
          <li className="flex gap-2"><Headphones className="mt-0.5 size-4 shrink-0" />{tr("Gọi tổng đài 1900 6868 (8:00–20:00)", "Call 1900 6868 (8 am – 8 pm)")}</li>
        </ul>
      </Section>
      <Receipt><Row label={tr("Mã hồ sơ", "Reference")} value={r?.session_id ?? "EKS-2611-0057"} strong /></Receipt>
    </Screen>
  );
}

/* ---------- Ngoại lệ ---------- */
export function RequestInfo({ go }: ScreenProps) {
  const { tr } = useLang();
  const ir = useEkyc()?.result?.info_request;
  const items = ir?.items.map((i) => tr(...(ITEM_LABEL[i] ?? [i, i]))) ?? [tr("Ảnh mặt sau CCCD", "Back of ID card")];
  const daysLeft = ir ? Math.max(0, Math.ceil((ir.deadline_at - Date.now()) / 86_400_000)) : 4;
  const front = ir?.items.includes("FRONT_BLURRY");
  return (
    <Screen title={tr("Bổ sung hồ sơ", "More information needed")} footer={<Button size="lg" block icon={<Upload className="size-5" />} onClick={() => go(front ? "captureFront" : "captureBack")}>{front ? tr("Chụp lại giấy tờ", "Retake your ID") : tr("Chụp lại mặt sau", "Retake the back")}</Button>}>
      <PageTitle title={tr(`Cần bổ sung ${items.length} mục`, items.length > 1 ? `We need ${items.length} more things` : "We need one more thing")} desc={tr("Nhân viên cần thêm thông tin để hoàn tất xét duyệt.", "Our team needs this to finish reviewing your application.")} />
      <Section>
        <dl className="divide-y divide-[var(--border-subtle)] px-4">
          <Row label={tr("Hạng mục", "Item")} value={[...new Set(items)].join(", ")} strong />
          <Row label={tr("Lý do", "Reason")} value={ir ? ir.message ?? tr("Nhân viên cần ảnh rõ hơn", "We need a clearer photo") : tr("Ảnh bị mờ, chưa đọc được dòng mã cuối thẻ", "Blurred – the code line at the bottom isn't readable")} />
          <Row label={tr("Hạn bổ sung", "Due by")} value={ir ? tr(`${fmtTime(ir.deadline_at).split(" · ")[1]} (còn ${daysLeft} ngày)`, `${fmtTime(ir.deadline_at).split(" · ")[1]} (${daysLeft} days left)`) : tr("14/11/2026 (còn 4 ngày)", "14 Nov 2026 (4 days left)")} tone="danger" />
        </dl>
      </Section>
      <p className="mt-4 flex gap-2 text-caption text-fg-tertiary"><CalendarClock className="size-4 shrink-0" />{tr("Quá hạn, hồ sơ sẽ tự huỷ và bạn cần làm lại từ đầu.", "After the deadline, the application is cancelled and you'll need to start again.")}</p>
    </Screen>
  );
}

export function Duplicate({ go }: ScreenProps) {
  const { tr } = useLang();
  const ek = useEkyc();
  const id = ek?.live ? (ek.persona.ocr.id_number ? maskId(ek.persona.ocr.id_number) : ek.persona.ocr.passport_no ?? "") : "089 •••• 5678";
  return (
    <Screen title={tr("Mở tài khoản", "Open an account")} footer={<><Button size="lg" block onClick={() => go("intro")}>{tr("Đăng nhập", "Log in")}</Button><Button variant="ghost" block>{tr("Quên mật khẩu", "Forgot password")}</Button></>}>
      <PageTitle title={tr("Bạn đã có tài khoản Aegis", "You already have an Aegis account")} desc={tr("Số CCCD này đã được dùng để mở tài khoản. Vui lòng đăng nhập.", "This ID number is already linked to an account. Please log in.")} />
      <Section className="flex items-center gap-3 p-4"><UserCheck className="size-6 text-action-subtle-fg" /><span className="text-body-sm">{tr("CCCD", "ID")} <span className="font-semibold tabular">{id}</span></span></Section>
      <Alert tone="warning" className="mt-4" title={tr("Không phải bạn mở tài khoản này?", "Didn't open this account?")}>{tr("Gọi ngay 1900 6868 để khoá tài khoản.", "Call 1900 6868 now to lock it.")}</Alert>
    </Screen>
  );
}

export function Resume({ go }: ScreenProps) {
  const { tr } = useLang();
  const rs = useEkyc()?.resumable;
  const docDone = !rs || ["DOC_CAPTURED", "LIVENESS_DONE"].includes(rs.last_step);
  const done = [tr("Đồng ý điều khoản", "Terms accepted"), ...(docDone ? [tr("Chụp giấy tờ", "ID photographed"), tr("Quét chip NFC", "NFC chip scanned")] : [])];
  const until = rs?.expires_at ? fmtTime(rs.expires_at).split(" · ")[1] : "16/11/2026";
  return (
    <Screen title={tr("Mở tài khoản", "Open an account")} footer={<><Button size="lg" block onClick={() => go("liveness")}>{docDone ? tr("Tiếp tục từ bước 4", "Continue from step 4") : tr("Tiếp tục từ bước 2", "Continue from step 2")}</Button><Button variant="ghost" block onClick={() => go("intro")}>{tr("Làm lại từ đầu", "Start over")}</Button></>}>
      <PageTitle title={tr("Tiếp tục hồ sơ đang làm dở?", "Continue where you left off?")} desc={tr(`Bạn đã xong ${done.length}/5 bước. Hồ sơ được giữ đến ${until}.`, `You've completed ${done.length} of 5 steps. We'll keep your application until ${until}.`)} />
      {rs?.reconsent_required && <Alert tone="warning" className="mb-4" title={tr("Điều khoản đã cập nhật", "Our terms have changed")}>{tr("Bạn cần đồng ý lại trước khi tiếp tục.", "Please accept them again to continue.")}</Alert>}
      <Section>
        <ul className="px-4 py-1">
          {done.map((s) => (
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
  const ek = useEkyc();
  const o = ek?.live ? ek.persona.ocr : null;
  return (
    <Screen title={tr("Giấy tờ không hợp lệ", "Document not valid")} footer={<><Button size="lg" block onClick={() => go("docType")}>{tr("Dùng giấy tờ khác", "Use another document")}</Button><Button variant="ghost" block>{tr("Tìm nơi cấp đổi CCCD", "Where to renew your ID")}</Button></>}>
      <Alert tone="danger" title={o?.doc_type === "PASSPORT" ? tr("Hộ chiếu đã hết hạn", "Your passport has expired") : tr("CCCD đã hết hạn", "Your ID has expired")}>{tr("Vui lòng cấp đổi trước khi mở tài khoản.", "Please renew it before opening an account.")}</Alert>
      <Section className="mt-4">
        <dl className="divide-y divide-[var(--border-subtle)] px-4">
          <Row label={o?.doc_type === "PASSPORT" ? tr("Số hộ chiếu", "Passport number") : tr("Số CCCD", "ID number")} value={o ? (o.doc_type === "PASSPORT" ? o.passport_no ?? "" : maskId(o.id_number)) : "089 •••• 5678"} />
          <Row label={tr("Có giá trị đến", "Expiry date")} value={o ? dmy(o.expiry) : "15/03/2025"} tone="danger" />
        </dl>
      </Section>
      <p className="mt-4 flex gap-2 text-caption text-fg-tertiary"><ShieldCheck className="size-4 shrink-0" />{tr("Chúng tôi không lưu ảnh giấy tờ đã hết hạn.", "We don't keep photos of expired documents.")}</p>
    </Screen>
  );
}

/* ---------- 14 Quyền riêng tư – rút lại đồng ý (C12, RULE-EKYC-15) ---------- */
export function Privacy({ go }: ScreenProps) {
  const { tr } = useLang();
  const ek = useEkyc();
  const [confirm, setConfirm] = useState<null | "identity" | "marketing">(null);
  const [msg, setMsg] = useState<{ tone: "success" | "info"; text: string } | null>(null);
  const hasAccount = !!ek?.result?.account_no;
  const rows = [
    { scope: "identity" as const, label: tr("Xử lý dữ liệu định danh", "Identity data"), desc: tr("Bắt buộc để mở và duy trì tài khoản", "Required to open and keep an account") },
    { scope: "screening" as const, label: tr("Tra cứu tín dụng và kiểm tra tuân thủ", "Credit and compliance checks"), desc: tr("Bắt buộc theo quy định phòng, chống rửa tiền", "Required by anti-money-laundering law") },
    { scope: "marketing" as const, label: tr("Nhận ưu đãi phù hợp", "Relevant offers"), desc: tr("Tuỳ chọn", "Optional") },
  ];
  const run = async (scope: "identity" | "marketing") => {
    setConfirm(null);
    if (!ek?.live || !ek.session) {
      setMsg({ tone: "info", text: scope === "marketing" ? tr("Đã ngừng gửi ưu đãi.", "Offers turned off.") : tr("Bản demo: hồ sơ sẽ được huỷ và dữ liệu xoá trong 24 giờ.", "Demo: the application would be cancelled and data deleted within 24 hours.") });
      return;
    }
    const r = await ek.withdraw(scope);
    if (r) setMsg({ tone: r.result === "RETAINED" ? "info" : "success", text: r.message });
  };
  return (
    <Screen title={tr("Quyền riêng tư", "Privacy")} onBack={() => go("intro")}>
      <PageTitle title={tr("Dữ liệu và sự đồng ý", "Your data and consent")} desc={tr(`Bạn đã đồng ý điều khoản phiên bản ${TERMS_VERSION}.`, `You accepted terms version ${TERMS_VERSION}.`)} />
      {msg && <Alert tone={msg.tone} className="mb-4" title={msg.text} />}
      <Section>
        <ul className="divide-y divide-[var(--border-subtle)] px-4">
          {rows.map((r) => (
            <li key={r.scope} className="flex items-center justify-between gap-3 py-3.5">
              <span className="min-w-0">
                <span className="block text-body-sm font-semibold">{r.label}</span>
                <span className="block text-caption text-fg-tertiary">{r.desc}</span>
              </span>
              {r.scope !== "screening" && (
                <Button size="sm" variant={r.scope === "identity" ? "danger" : "secondary"} onClick={() => setConfirm(r.scope as "identity" | "marketing")}>{tr("Rút lại", "Withdraw")}</Button>
              )}
            </li>
          ))}
        </ul>
      </Section>
      <p className="mt-4 text-caption text-fg-tertiary">{tr("Rút lại đồng ý xử lý dữ liệu định danh khi chưa có tài khoản sẽ huỷ hồ sơ và xoá dữ liệu trong 24 giờ. Khi đã có tài khoản, dữ liệu định danh vẫn được lưu theo quy định pháp luật.", "Withdrawing identity consent before an account is opened cancels the application and deletes data within 24 hours. Once you have an account, identity data is still kept as required by law.")}</p>
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm === "identity" ? tr("Rút lại đồng ý xử lý dữ liệu định danh?", "Withdraw identity data consent?") : tr("Ngừng nhận ưu đãi?", "Stop receiving offers?")}
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>{tr("Huỷ", "Cancel")}</Button><Button variant={confirm === "identity" ? "danger" : "primary"} onClick={() => confirm && run(confirm)}>{tr("Xác nhận", "Confirm")}</Button></>}>
        <p className="text-body-sm text-fg-secondary">
          {confirm === "identity"
            ? hasAccount ? tr("Bạn đã có tài khoản nên dữ liệu định danh vẫn phải được lưu theo quy định. Chúng tôi sẽ ngừng mọi xử lý ngoài mục đích bắt buộc.", "You already have an account, so identity data must be kept by law. We'll stop all processing beyond what is required.") : tr("Hồ sơ mở tài khoản đang làm sẽ bị huỷ và dữ liệu được xoá trong 24 giờ.", "Your application will be cancelled and its data deleted within 24 hours.")
            : tr("Bạn sẽ không nhận thông tin ưu đãi nữa. Có thể bật lại bất cứ lúc nào.", "You won't receive offers any more. You can turn this back on at any time.")}
        </p>
      </Modal>
    </Screen>
  );
}
