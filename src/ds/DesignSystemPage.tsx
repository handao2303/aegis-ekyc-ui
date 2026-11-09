import { useState, ReactNode } from "react";
import { ArrowRight, Check, Plus } from "lucide-react";
import { Alert, Badge, Button, Card, Checkbox, ProgressBar, Stepper, Tabs, TextField, cx } from "../components/ui";

/* Giá trị đặc của token (dùng để tính tương phản WCAG ngay trên trang) */
const SOLID: Record<string, [string, string]> = {
  "bg-surface": ["#ffffff", "#121b2e"],
  "bg-base": ["#f2f4f8", "#0b1220"],
  "text-primary": ["#0d1b33", "#e8edf6"],
  "text-secondary": ["#45526b", "#a9b4c8"],
  "text-tertiary": ["#5f6b82", "#8b97ad"],
  "action-primary-bg": ["#1849a9", "#7aa2ff"],
  "action-primary-text": ["#ffffff", "#07142e"],
  "status-success-text": ["#11734a", "#6fd59e"],
  "status-warning-text": ["#8a5300", "#f2c069"],
  "status-danger-text": ["#b42318", "#ff9a90"],
  "status-info-text": ["#1849a9", "#a9c1ff"],
  "status-danger-solid-bg": ["#b42318", "#ff8a7f"],
  "status-danger-solid-text": ["#ffffff", "#2a0705"],
};

function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function ratio(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const PAIRS: { fg: string; bg: string; use: string; min: number }[] = [
  { fg: "text-primary", bg: "bg-surface", use: "Nội dung chính", min: 4.5 },
  { fg: "text-secondary", bg: "bg-surface", use: "Mô tả, chú thích", min: 4.5 },
  { fg: "text-tertiary", bg: "bg-surface", use: "Nhãn phụ, placeholder", min: 4.5 },
  { fg: "text-tertiary", bg: "bg-base", use: "Nhãn phụ trên nền trang", min: 4.5 },
  { fg: "action-primary-text", bg: "action-primary-bg", use: "Nút chính", min: 4.5 },
  { fg: "status-danger-solid-text", bg: "status-danger-solid-bg", use: "Nút nguy hiểm", min: 4.5 },
  { fg: "status-success-text", bg: "bg-surface", use: "Trạng thái thành công", min: 4.5 },
  { fg: "status-warning-text", bg: "bg-surface", use: "Trạng thái cảnh báo", min: 4.5 },
  { fg: "status-danger-text", bg: "bg-surface", use: "Trạng thái lỗi", min: 4.5 },
  { fg: "status-info-text", bg: "bg-surface", use: "Trạng thái thông tin", min: 4.5 },
];

const COLOR_GROUPS: { title: string; tokens: { name: string; use: string }[] }[] = [
  { title: "Nền & bề mặt", tokens: [
    { name: "bg-base", use: "Nền trang" }, { name: "bg-surface", use: "Thẻ, bảng, ô nhập" }, { name: "bg-surface-raised", use: "Modal, menu — sáng hơn ở chế độ tối" }, { name: "bg-sunken", use: "Vùng lõm, track, chip trung tính" },
  ] },
  { title: "Chữ", tokens: [
    { name: "text-primary", use: "Tiêu đề, nội dung" }, { name: "text-secondary", use: "Mô tả" }, { name: "text-tertiary", use: "Nhãn phụ, gợi ý" },
  ] },
  { title: "Hành động", tokens: [
    { name: "action-primary-bg", use: "Nút chính, lựa chọn đang chọn" }, { name: "action-primary-subtle-bg", use: "Nút phụ có màu, mục đang chọn" }, { name: "action-primary-subtle-text", use: "Chữ trên nền subtle" },
  ] },
  { title: "Trạng thái", tokens: [
    { name: "status-success-text", use: "Đã duyệt, hợp lệ" }, { name: "status-warning-text", use: "Chờ duyệt, sắp quá hạn" }, { name: "status-danger-text", use: "Từ chối, lỗi, quá hạn" }, { name: "status-info-text", use: "Thông tin, đã bổ sung" },
  ] },
  { title: "Viền & tương tác (trong suốt)", tokens: [
    { name: "border-subtle", use: "Viền thẻ, đường chia" }, { name: "border-strong", use: "Viền ô nhập, nút phụ" }, { name: "overlay-hover", use: "Lớp phủ khi rê chuột" }, { name: "overlay-press", use: "Lớp phủ khi nhấn" },
  ] },
];

const TYPE = [
  { cls: "text-display", name: "display", spec: "32 / 40 · 700", sample: "1.903.668.825 ₫" },
  { cls: "text-headline", name: "headline", spec: "24 / 32 · 700", sample: "Xác minh danh tính trực tuyến" },
  { cls: "text-title", name: "title", spec: "20 / 28 · 600", sample: "Hàng đợi xét duyệt" },
  { cls: "text-title-sm", name: "title-sm", spec: "18 / 26 · 600", sample: "Sàng lọc rủi ro" },
  { cls: "text-body", name: "body", spec: "16 / 24 · 400", sample: "Đặt thẻ gần camera sau, giữ 3–5 giây." },
  { cls: "text-body-sm", name: "body-sm", spec: "14 / 20 · 400", sample: "Hồ sơ REFER cần xử lý trong 24 giờ." },
  { cls: "text-caption", name: "caption", spec: "12 / 16 · 400", sample: "Mã hồ sơ: EKS-2611-0042" },
];

function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="text-headline mt-1">{title}</h2>
      {intro && <p className="mt-1 max-w-[65ch] text-body-sm text-fg-secondary">{intro}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Specimen({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-caption font-semibold text-fg-tertiary">{label}</p>
      <div className={cx("flex flex-wrap items-center gap-3 rounded-md border border-dashed border-line-subtle p-4", className)}>{children}</div>
    </div>
  );
}

export default function DesignSystemPage() {
  const [dark, setDark] = useState(false);
  const [chk, setChk] = useState(true);
  const [tab, setTab] = useState<"a" | "b" | "c">("a");
  const idx = dark ? 1 : 0;

  const toc = [
    ["nguyen-tac", "Nguyên tắc"], ["mau", "Màu"], ["tuong-phan", "Tương phản"], ["chu", "Chữ"], ["khoang-cach", "Khoảng cách & bo góc"], ["component", "Component"], ["pattern", "Pattern eKYC"], ["van-phong", "Văn phong"],
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav className="hidden lg:block" aria-label="Mục lục design system">
        <div className="sticky top-20 flex flex-col gap-0.5">
          <p className="eyebrow mb-2">Aegis DS v1.0</p>
          {toc.map(([id, l]) => (
            <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); }}
              className="interactive rounded-md px-2.5 py-1.5 text-body-sm text-fg-secondary">{l}</a>
          ))}
        </div>
      </nav>

      <div className="flex min-w-0 flex-col gap-14">
        <header>
          <p className="eyebrow">Design System</p>
          <h1 className="text-display mt-1">Aegis eKYC</h1>
          <p className="mt-2 max-w-[65ch] text-body text-fg-secondary">
            Nền tảng giao diện cho luồng định danh điện tử trên mobile và công cụ xét duyệt Compliance trên web. Một bộ token, một bộ component, hai bề mặt sản phẩm.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="brand">React 18 + TypeScript</Badge><Badge tone="brand">Tailwind CSS 3.4</Badge><Badge>WCAG 2.1 AA</Badge><Badge>Sáng / Tối</Badge><Badge>Tiếng Việt</Badge>
          </div>
        </header>

        <Section id="nguyen-tac" eyebrow="Nền tảng" title="Nguyên tắc">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Token đặt tên theo công dụng", "Tên token nói rõ dùng ở đâu, tối đa 4 từ: nhóm-vai trò-biến thể-trạng thái. Không đặt tên theo màu (blue-600)."],
              ["Lớp phủ thay vì màu mới", "Hover và nhấn dùng một lớp phủ trong suốt đặt trên mọi nền, nên bảng màu không phình ra theo số trạng thái."],
              ["Tương phản như nhau ở hai chế độ", "Mỗi cặp chữ/nền đạt tối thiểu 4.5:1 ở cả sáng và tối, để thứ bậc thị giác không đổi khi đổi chế độ."],
              ["Độ cao bằng độ sáng", "Ở chế độ tối, bóng đổ gần như vô hình — bề mặt càng cao càng sáng hơn (bg-surface → bg-surface-raised)."],
            ].map(([t, d]) => (
              <Card key={t} className="p-4"><p className="text-body-sm font-semibold">{t}</p><p className="mt-1 text-body-sm text-fg-secondary">{d}</p></Card>
            ))}
          </div>
        </Section>

        <Section id="mau" eyebrow="Nền tảng" title="Màu" intro="Mọi màu trong sản phẩm đều đi qua token. Component không bao giờ dùng mã màu trực tiếp.">
          <div className="flex flex-col gap-6">
            {COLOR_GROUPS.map((g) => (
              <div key={g.title}>
                <p className="mb-2 text-body-sm font-semibold">{g.title}</p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {g.tokens.map((t) => (
                    <div key={t.name} className="flex items-center gap-3 rounded-md border border-line-subtle bg-bg-surface p-2.5">
                      <span className="size-10 shrink-0 rounded-sm border border-line-subtle" style={{ background: `var(--${t.name})` }} aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-caption">{t.name}</span>
                        <span className="block text-caption text-fg-tertiary">{t.use}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="tuong-phan" eyebrow="Nền tảng" title="Tương phản WCAG" intro="Tỷ lệ được tính trực tiếp từ giá trị token. Ngưỡng AA cho chữ thường là 4.5:1.">
          <div className="mb-3 flex gap-1 rounded-md border border-line-subtle p-0.5 w-fit" role="radiogroup" aria-label="Bộ giá trị">
            {["Sáng", "Tối"].map((l, i) => (
              <button key={l} role="radio" aria-checked={idx === i} onClick={() => setDark(i === 1)} className={cx("interactive rounded-sm px-3 py-1 text-body-sm", idx === i ? "bg-bg-sunken font-semibold" : "text-fg-tertiary")}>{l}</button>
            ))}
          </div>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-body-sm">
              <thead><tr className="border-b border-line-subtle text-left text-caption text-fg-tertiary">{["Mẫu", "Chữ / Nền", "Dùng cho", "Tỷ lệ", "AA"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {PAIRS.map((p) => {
                  const r = ratio(SOLID[p.fg][idx], SOLID[p.bg][idx]);
                  return (
                    <tr key={p.fg + p.bg} className="border-b border-line-subtle last:border-0">
                      <td className="px-4 py-2"><span className="inline-grid h-8 w-14 place-items-center rounded-sm text-body-sm font-semibold" style={{ background: SOLID[p.bg][idx], color: SOLID[p.fg][idx] }}>Aa</span></td>
                      <td className="px-4 py-2 font-mono text-caption">{p.fg}<br /><span className="text-fg-tertiary">on {p.bg}</span></td>
                      <td className="px-4 py-2 text-fg-secondary">{p.use}</td>
                      <td className="px-4 py-2 font-mono tabular">{r.toFixed(2)}:1</td>
                      <td className="px-4 py-2">{r >= p.min ? <Badge tone="success"><Check className="size-3" />Đạt</Badge> : <Badge tone="danger">Chưa đạt</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </Section>

        <Section id="chu" eyebrow="Nền tảng" title="Chữ" intro="Một họ chữ duy nhất: Be Vietnam Pro — thiết kế cho tiếng Việt, nét chắc chắn phù hợp ngân hàng. Số tài khoản, mã hồ sơ và điểm số bật tabular-nums để các chữ số thẳng cột thay vì đổi sang font khác.">
          <Card className="divide-y divide-[var(--border-subtle)]">
            {TYPE.map((t) => (
              <div key={t.name} className="grid gap-1 p-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-baseline">
                <div><p className="font-mono text-caption">{t.name}</p><p className="text-caption text-fg-tertiary">{t.spec}</p></div>
                <p className={cx(t.cls, "min-w-0 break-words")}>{t.sample}</p>
              </div>
            ))}
            <div className="grid gap-1 p-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-baseline">
              <div><p className="font-mono text-caption">số (tabular)</p><p className="text-caption text-fg-tertiary">14 / 20 · tabular-nums</p></div>
              <p className="font-mono tabular text-body-sm">0890 1234 5678 · EKS-2611-0042 · 58.20</p>
            </div>
          </Card>
        </Section>

        <Section id="khoang-cach" eyebrow="Nền tảng" title="Khoảng cách & bo góc" intro="Lưới 4px. Bo góc tăng theo kích thước phần tử: chip nhỏ bo ít, thẻ và modal bo nhiều.">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <p className="text-body-sm font-semibold mb-3">Khoảng cách</p>
              <div className="flex flex-col gap-2">
                {[4, 8, 12, 16, 20, 24, 32].map((v) => (
                  <div key={v} className="flex items-center gap-3"><span className="w-10 font-mono text-caption text-fg-tertiary tabular">{v}px</span><span className="h-3 rounded-sm bg-action opacity-70" style={{ width: v * 3 }} /></div>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-body-sm font-semibold mb-3">Bo góc</p>
              <div className="flex flex-wrap gap-4">
                {[["sm", 6, "Thanh nhỏ"], ["md", 8, "Nút, ô nhập"], ["lg", 12, "Thẻ"], ["xl", 16, "Modal"], ["full", 999, "Badge, avatar"]].map(([n, r, u]) => (
                  <div key={n as string} className="flex flex-col items-center gap-1.5">
                    <span className="size-14 border-2 border-action bg-action-subtle" style={{ borderRadius: r as number }} />
                    <span className="font-mono text-caption">{n}</span><span className="text-caption text-fg-tertiary">{u}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Section>

        <Section id="component" eyebrow="Component" title="Component" intro="Mỗi component có thuộc tính (variant, size, state) tương ứng component properties trong Figma.">
          <div className="grid gap-5 xl:grid-cols-2">
            <Specimen label="Button · variant">
              <Button>Tiếp tục</Button><Button variant="secondary">Chụp lại</Button><Button variant="subtle">Nhận xử lý</Button><Button variant="ghost">Bỏ qua</Button><Button variant="danger">Từ chối</Button>
            </Specimen>
            <Specimen label="Button · size & state">
              <Button size="sm" icon={<Plus className="size-4" />}>Nhỏ</Button><Button size="md">Vừa</Button><Button size="lg" iconRight={<ArrowRight className="size-5" />}>Lớn</Button><Button loading>Đang gửi</Button><Button disabled>Vô hiệu</Button>
            </Specimen>
            <Specimen label="Text field · state" className="grid sm:grid-cols-2 items-start">
              <TextField id="ds-f1" label="Số điện thoại" placeholder="09xx xxx xxx" helper="Dùng để nhận mã OTP" />
              <TextField id="ds-f2" label="Số CCCD" defaultValue="0890 1234" error="Số CCCD gồm 12 chữ số" />
              <TextField id="ds-f3" label="Ngày cấp" defaultValue="12/06/2021" disabled />
            </Specimen>
            <Specimen label="Checkbox">
              <div className="w-full"><Checkbox id="ds-c1" checked={chk} onChange={setChk} label="Thu thập & xử lý dữ liệu định danh" description="Bắt buộc để mở tài khoản" required /></div>
            </Specimen>
            <Specimen label="Badge · tone">
              <Badge>Trung tính</Badge><Badge tone="brand">Khuyên dùng</Badge><Badge tone="success" dot>Trong hạn</Badge><Badge tone="warning" dot>Sắp quá hạn</Badge><Badge tone="danger" dot>Quá SLA</Badge><Badge tone="info">Đã bổ sung</Badge>
            </Specimen>
            <Specimen label="Progress & Stepper" className="flex-col items-stretch">
              <Stepper steps={["Đồng ý", "Giấy tờ", "Chip", "Khuôn mặt", "Kết quả"]} current={2} />
              <ProgressBar value={64} label="Mẫu tiến độ" />
            </Specimen>
            <Specimen label="Alert" className="flex-col items-stretch">
              <Alert tone="info" title="Dữ liệu của bạn được bảo vệ">Ảnh chỉ dùng để xác minh danh tính.</Alert>
              <Alert tone="warning" title="Bỏ qua NFC sẽ chuyển sang duyệt thủ công" />
              <Alert tone="danger" title="Quyết định không thể hoàn tác" />
            </Specimen>
            <Specimen label="Tabs" className="block">
              <Tabs ariaLabel="Mẫu tabs" value={tab} onChange={setTab} items={[{ value: "a", label: "Tất cả", count: 8 }, { value: "b", label: "Của tôi", count: 1 }, { value: "c", label: "Chờ Checker", count: 1 }]} />
            </Specimen>
          </div>
        </Section>

        <Section id="pattern" eyebrow="Pattern" title="Pattern eKYC" intro="Ánh xạ thống nhất giữa trạng thái hệ thống và cách hiển thị, dùng chung cho mobile và web.">
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-body-sm">
              <thead><tr className="border-b border-line-subtle text-left text-caption text-fg-tertiary">{["Trạng thái hệ thống", "Hiển thị", "Khách hàng thấy", "Compliance thấy"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {([
                  ["STP_APPROVED", "success", "Đã duyệt", "Mở tài khoản thành công", "—"],
                  ["REFER", "warning", "Chờ xét duyệt", "Hồ sơ đang được xem xét (24 giờ)", "Lý do + điểm rủi ro"],
                  ["PENDING_CUSTOMER_INFO", "info", "Chờ bổ sung", "Cần bổ sung [hạng mục] trước [hạn]", "SLA tạm dừng"],
                  ["PENDING_CHECKER", "warning", "Chờ Checker", "Hồ sơ đang được xem xét", "Maker, chờ Checker khác"],
                  ["REJECTED", "danger", "Từ chối", "Chưa thể mở tài khoản trực tuyến", "Lý do nội bộ"],
                ] as const).map(([k, tone, label, cust, comp]) => (
                  <tr key={k}>
                    <td className="px-4 py-2.5 font-mono text-caption">{k}</td>
                    <td className="px-4 py-2.5"><Badge tone={tone} dot>{label}</Badge></td>
                    <td className="px-4 py-2.5 text-fg-secondary">{cust}</td>
                    <td className="px-4 py-2.5 text-fg-secondary">{comp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["Che dữ liệu cá nhân", "Tên và số CCCD che một phần ở danh sách. Xem đầy đủ phải bấm chủ động và được ghi audit (VIEW_PII)."],
              ["Lý do an toàn cho khách", "Không bao giờ hiển thị AML, PEP, Sanction, CIC cho khách. Dùng câu chung và luôn đưa lối đi tiếp."],
              ["SLA bằng hình thức", "Trạng thái SLA thể hiện bằng chấm màu + chữ + thời gian còn lại, không chỉ dựa vào màu."],
            ].map(([t, d]) => <Card key={t} className="p-4"><p className="text-body-sm font-semibold">{t}</p><p className="mt-1 text-body-sm text-fg-secondary">{d}</p></Card>)}
          </div>
        </Section>

        <Section id="van-phong" eyebrow="Nội dung" title="Văn phong">
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-body-sm">
              <thead><tr className="border-b border-line-subtle text-left text-caption text-fg-tertiary"><th className="px-4 py-2.5 font-semibold">Nên</th><th className="px-4 py-2.5 font-semibold">Tránh</th><th className="px-4 py-2.5 font-semibold">Vì sao</th></tr></thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {[
                  ["Ảnh chưa đủ rõ. Đứng gần cửa sổ và thử lại.", "Lỗi OCR_FAILED (code 422)", "Nói điều khách hiểu và cách sửa"],
                  ["Bắt đầu xác minh", "OK", "Nút nói rõ việc sẽ xảy ra"],
                  ["Hồ sơ đang được xem xét", "Bạn bị nghi trùng danh sách PEP", "Bảo vệ thông tin nhạy cảm"],
                  ["Còn 4 giờ 12 phút", "SLA 83%", "Con số cụ thể, dễ hành động"],
                ].map(([a, b, c]) => (
                  <tr key={a}><td className="px-4 py-2.5"><span className="text-success font-medium">✓ </span>{a}</td><td className="px-4 py-2.5 text-fg-secondary"><span className="text-danger font-medium">✕ </span>{b}</td><td className="px-4 py-2.5 text-fg-tertiary">{c}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Section>
      </div>
    </div>
  );
}
