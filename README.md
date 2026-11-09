# Aegis eKYC UI

Giao diện module eKYC cho dự án cá nhân **Aegis Bank** — song ngữ Tiếng Việt / English, sáng/tối.

- **App khách hàng** (`/app/`): mở tài khoản trực tuyến — 19 màn hình gồm luồng chính, kết quả và ngoại lệ.
- **Aegis Compliance** (`/compliance/`): back-office xét duyệt — hàng đợi, chi tiết hồ sơ, Maker-Checker, hồ sơ đã xử lý, báo cáo SLA, cấu hình ngưỡng.
- **UI Kit** (`/`): design system và tài liệu thiết kế.

> Dữ liệu mẫu hoàn toàn hư cấu; camera, NFC, liveness và kết quả xác minh là mô phỏng, chưa nối API.

## Chạy

```bash
npm install
npm run dev -- --port 5179
npm run build      # build cả 3 trang vào dist/
npm run artifact   # build UI Kit thành 1 file để chia sẻ
```

| Trang | Đường dẫn |
|---|---|
| App khách hàng eKYC (sản phẩm) | http://localhost:5179/app/ |
| App khách hàng – tiếng Anh | http://localhost:5179/app/?lang=en |
| App khách hàng – kết quả chờ duyệt | http://localhost:5179/app/?ketqua=refer |
| App khách hàng – kết quả từ chối | http://localhost:5179/app/?ketqua=rejected |
| Web Compliance (sản phẩm) | http://localhost:5179/compliance/ |
| UI Kit & tài liệu thiết kế | http://localhost:5179/ |

## Vì sao chọn stack này

| Lựa chọn | Lý do |
|---|---|
| **React 18 + TypeScript** | Cùng mô hình component với React Native/Expo mà app mobile Aegis đang dùng (SCRUM-44). Logic màn hình và tên component chuyển sang được, TypeScript bắt lỗi kiểu dữ liệu như `Outcome`, `ReasonCode`. |
| **Tailwind CSS 3.4** | Tailwind chỉ là lớp ánh xạ tới token CSS (`tailwind.config.js`). Không dùng màu mặc định của Tailwind, nên đổi theme chỉ cần sửa `tokens.css`. |
| **CSS custom properties** | Một nguồn token cho cả web và (qua bước export) React Native. Chế độ sáng/tối đổi bằng biến, component không cần biết đang ở chế độ nào. |
| **lucide-react** | Bộ icon nét đều, nhẹ, tree-shake được. |
| **Vite** | Build nhanh, ra bản một file để chia sẻ. |

Khi đưa vào app mobile thật: giữ nguyên token và cấu trúc màn hình, thay `div/button` bằng `View/Pressable` (hoặc dùng NativeWind để giữ class Tailwind).

## Cấu trúc

```
src/
├── styles/tokens.css        ← token ngữ nghĩa (sáng/tối), lớp phủ tương tác
├── components/ui/index.tsx  ← Button, Badge, Card, Alert, TextField, Checkbox, Tabs, Modal, Stepper, ProgressBar, KV
├── mobile/
│   ├── MobileShell.tsx      ← khung thiết bị, bố cục màn hình chuẩn, minh hoạ CCCD
│   ├── screens.tsx          ← 19 màn hình
│   └── MobileFlowPage.tsx   ← danh sách màn hình + ghi chú UX + truy vết Jira
├── web/
│   ├── data.ts              ← dữ liệu mẫu, quy tắc SLA, mã lý do
│   └── CompliancePage.tsx   ← EKYC-W1, EKYC-W2, modal phê duyệt / bổ sung / từ chối
└── ds/DesignSystemPage.tsx  ← tài liệu design system, bảng tương phản WCAG tính trực tiếp
```

## Nguyên tắc design system

1. **Token đặt tên theo công dụng** (tối đa 4 từ): `action-primary-subtle-text`, `status-warning-subtle-bg`…
2. **Lớp phủ trong suốt cho hover/nhấn** (`.interactive`): không thêm màu cho mỗi trạng thái.
3. **WCAG 2.1 AA** ở cả hai chế độ, kiểm tra ngay trên trang Design System.
4. **Chế độ tối**: độ cao thể hiện bằng nền sáng dần, không dùng bóng.
5. **Không chỉ dựa vào màu**: trạng thái luôn có chữ và chấm/icon đi kèm.

## Truy vết Jira

| Phần giao diện | Ticket |
|---|---|
| Luồng mobile chính | SCRUM-17/18/19/39/46/47 |
| Hàng đợi & chi tiết Compliance | SCRUM-21/48 |
| Trùng khách hàng, giấy tờ hết hạn | SCRUM-73, SCRUM-74 |
| Tiếp tục phiên | SCRUM-75 |
| Yêu cầu bổ sung | SCRUM-76 |
| Thông báo, SLA hàng đợi | SCRUM-77, SCRUM-78 |
| Maker-Checker, audit xem PII | SCRUM-79 |
| Nguồn so khớp chip / OCR-only không STP | SCRUM-80 |

Toàn bộ tên người, số giấy tờ, số tài khoản trong bản mẫu là dữ liệu hư cấu.
