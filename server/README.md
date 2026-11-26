# ekyc-service

Backend cho module eKYC: phiên mở tài khoản của khách và hàng đợi xét duyệt của Compliance. Chạy bằng Node ≥ 23.6, **không cần cài thư viện**. Dùng các phần có sẵn trong Node: `node:http`, `node:sqlite` (thay cho Cloud SQL khi chạy local) và `node:test`.

```bash
npm start      # http://localhost:8787 – lần đầu tự tạo dữ liệu mẫu ở data/aegis.db
npm test       # 56 test, gồm UAT-EKYC-01 → 26 trong C17 (có hộ chiếu)
npm run dev    # tự khởi động lại khi sửa code
```

Ở thư mục gốc có sẵn `npm run server` và `npm run dev:all` (chạy backend và web cùng lúc).

## Bản đồ code ↔ tài liệu

| File | Nội dung | Tài liệu |
|---|---|---|
| `src/rules.ts` | Quy tắc dạng hàm thuần: trùng khách, hạn giấy tờ/tuổi, cây quyết định, cần Checker, SLA | C04, C05, A01 §4, C10, C09 |
| `src/service.ts` | Luồng phiên, chip, liveness → sàng lọc → quyết định; hàng đợi, yêu cầu bổ sung, Maker-Checker, cấu hình hai người, báo cáo | C06, C07, C10, C11, C12, C13, C18 |
| `src/jobs.ts` | Bỏ dở 30 phút, hết hạn 7 ngày, hạn bổ sung 5 ngày, tự nhả hồ sơ 2 giờ, leo thang 20h/24h, xoá dữ liệu | C06 §4, C07, C09, C12 §4 |
| `src/adapters.ts` | CIC, AML, Core Banking, Notification – bản giả lập theo fixture, có ngắt mạch | A01 §2, C16 |
| `src/db.ts` | Lược đồ; trigger chặn sửa/xoá `audit_event`, `kyc_decisions`, `consents` | C10 (NFR-AUD-03) |
| `src/personas.ts` | Hồ sơ mẫu TD-01 → TD-15 (TD-14, 15 là hộ chiếu), dùng chung với app | C17 §4 |
| `src/seed.ts` | Nhân viên, khách cũ TD-08, 8 hồ sơ mẫu trong hàng đợi | — |

## API

Khách gửi `x-session-token` (nhận khi tạo phiên). Nhân viên gửi `x-staff-id`, thay cho SSO ở API Gateway trên production.

**Production (`NODE_ENV=production`)** – G-SE-01:

| Biến môi trường | Bắt buộc | Tác dụng |
|---|---|---|
| `GATEWAY_SHARED_SECRET` | ✅ | Thiếu thì service không khởi động. `x-staff-id` chỉ được tin khi yêu cầu có header `x-gateway-auth` đúng bí mật này (API Gateway gắn sau khi xác thực SSO); không có thì mọi API nhân viên trả 401 |
| `ALLOWED_ORIGINS` | | Danh sách origin cách nhau bởi dấu phẩy cho CORS, vd. `https://compliance.aegis.example`. Origin khác không nhận header CORS |

Endpoint `/api/dev/*` chỉ có ở dev.

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| POST | `/api/sessions` | Tạo phiên (kiểm velocity C13) |
| POST | `/api/sessions/:id/consent` | Đồng ý điều khoản, đúng `terms_version` |
| POST | `/api/sessions/:id/document` | Dữ liệu OCR (`doc_type`: `CCCD` hoặc `PASSPORT` kèm `passport_no`, `nationality`) → kiểm tra hạn, tuổi, trùng khách |
| POST | `/api/sessions/:id/chip` | DG1 + kết quả SOD, hoặc `{ "skipped": true }` |
| POST | `/api/sessions/:id/liveness` | Điểm liveness/face match → sàng lọc → STP / REFER / REJECTED |
| POST | `/api/sessions/:id/capture-failures` | Đọc giấy tờ lỗi; lần 3 → REFER |
| GET | `/api/sessions/resume?device_id=` · POST `/:id/resume` · `/:id/cancel` | Tiếp tục hoặc huỷ phiên dở |
| POST | `/api/sessions/:id/consents/withdraw` | Rút lại đồng ý |
| POST | `/api/sessions/:id/info-request/submit` | Khách gửi bổ sung |
| GET | `/api/cases?view=queue\|checker\|mine\|done` | Hàng đợi theo thứ tự ưu tiên |
| GET | `/api/cases/:id[?pii=1]` | Chi tiết (ghi audit xem hồ sơ / xem PII) |
| POST | `/api/cases/:id/claim` · `release` · `info-requests` · `decision` · `checker` · `cic-retry` | Xử lý hồ sơ |
| GET/POST | `/api/config` · `/api/config/changes[/:id/approve\|reject]` | Cấu hình ngưỡng, cần trưởng nhóm khác người đề xuất duyệt |
| GET | `/api/reports/sla` · `/api/reports/kpi` | Báo cáo C09, C18 |
| POST | `/api/dev/clock/advance` · `/api/dev/jobs/run` · `/api/dev/reset` | Chỉ môi trường dev: tua giờ để thử SLA, chạy job, đặt lại dữ liệu |

## Nhân viên mẫu

| Mã | Tên | Vai trò |
|---|---|---|
| `u-anh` | Nguyễn Minh Anh | Compliance Officer |
| `u-yen` | Trần Hải Yến | Compliance Officer |
| `u-huy` | Lê Quang Huy | Trưởng nhóm (duyệt cấu hình) |
| `u-trang` | Phạm Thu Trang | CS – chỉ xem hồ sơ đã che |

## Chưa có (cần cho production)

- Kết nối thật CIC, AML, Core Banking, Notification (DEP-01→04, 07). Adapter đã tách sẵn, chỉ thay phần thân hàm.
- Liveness và face match tính ở server. Hiện server nhận điểm từ SDK trên máy (bản test lấy từ hồ sơ mẫu).
- Postgres + migration, SSO/OAuth2, mã hoá cột PII, lưu ảnh lên Cloud Storage.
- Xác minh chữ ký chip tới CSCA (A02).
