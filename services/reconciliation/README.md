# reconciliation-service

Backend Module 2 – Đối soát giao dịch của Aegis. Thiết kế theo [R05](../../docs/02-reconciliation/R05-api-data-dictionary.md), luồng theo [R01](../../docs/02-reconciliation/R01-reconciliation-flow.md), kiểm thử theo [R04 §4](../../docs/02-reconciliation/R04-test-plan-cases.md).

Node ≥ 23.6, **không phụ thuộc thư viện ngoài**: chạy TypeScript trực tiếp và dùng `node:sqlite`. Production dự kiến chạy trên Cloud Run và Cloud SQL Postgres (A01 §2). Lược đồ chỉ dùng kiểu dữ liệu mà cả hai hệ quản trị đều có.

## Chạy

Chạy service riêng:

```bash
npm --prefix services/reconciliation start
```

Service nghe ở cổng 8788, dữ liệu lưu tại `data/rec.db`. Lần chạy đầu tự tạo dữ liệu mẫu.

Chạy cả web, ekyc-service và reconciliation-service:

```bash
npm run dev:all
```

Chạy test (56 ca, khoảng 2 giây):

```bash
npm run test:rec
```

Mở UI: http://localhost:5179/reconciliation/. UI tự dò service; nếu thấy, màn hình hiện "Đã nối reconciliation-service".

- `?api=off`: về chế độ demo.
- `?api=on`: bật lại tự dò.
- `?as=trang` / `?as=quan`: đổi người dùng UAT.

## Cấu trúc

| File | Nội dung |
|---|---|
| `src/db.ts` | Lược đồ 16 bảng. Trigger bất biến cho `audit_event`, `match_results` và bút toán `POSTED`. Unique index một phần "1 bút toán chờ / ngoại lệ" |
| `src/money.ts` | Tiền là chuỗi thập phân ở API, số nguyên 1/100 trong DB. Không dùng số thực |
| `src/ingest.ts` | Đọc CSV (RFC 4180), JSON, ISO 20022 camt.053/054. Che số thẻ (PCI DSS). Một bản ghi lỗi là cách ly cả lô |
| `src/engine.ts` | Hàm thuần: EXACT → N:1 (subset-sum có giới hạn thời gian) → FUZZY (điểm 0..1, ngưỡng và khoảng cách) → DUPLICATE / UNMATCHED. Có bộ gợi ý nguyên nhân top-3 |
| `src/service.ts` | Nghiệp vụ: quy tắc có version, ngoại lệ, bút toán Maker-Checker, SoD-1/2/3, truy vết, KPI, sự kiện từ Hạn mức, đối chiếu cuối ngày (EOD), cấu hình qua Maker-Checker |
| `src/http.ts` | REST `/api/v1/rec` gồm 40 endpoint. `Idempotency-Key` cho mọi POST. Endpoint `/dev/*` chỉ bật ở dev |
| `src/seed.ts` | Dữ liệu mẫu hư cấu, đi qua đúng luồng thật (nạp file → engine → xử lý) |
| `test/` | Engine, nạp file và quy tắc, ngoại lệ và bút toán, truy vết / EOD / HTTP |

## Người dùng dev

Bản dev dùng header `x-staff-id` thay cho SSO ở API Gateway.

| id | Tên | Vai trò |
|---|---|---|
| `u-nam` | Lê Hoàng Nam | `REC_OFFICER` |
| `u-trang` | Phạm Thu Trang | `REC_CHECKER` |
| `u-quan` | Đỗ Minh Quân | `REC_LEAD` |
| `u-ha` | Vũ Thanh Hà | `FIN_VIEWER` (Kế toán trưởng) |

## Kiểm soát chính

- **SoD-1:** người duyệt bút toán phải khác Maker.
- **SoD-2 (RULE-REC-05):** bút toán trên ngưỡng không do người tạo hoặc người sửa gần nhất của quy tắc sinh giao dịch duyệt.
- **SoD-3:** người duyệt quy tắc phải khác người tạo.
- Mọi lần bị chặn đều ghi audit `SOD_BLOCKED`. Audit ghi ngoài giao dịch DB nên không mất khi rollback.
- **Ngưỡng 50 triệu (RULE-REC-04):** ≤ ngưỡng thì tự hạch toán (zero-touch); > ngưỡng thì chờ Checker, ngoại lệ ở `PENDING_POSTING` tới khi `POSTED`.
- Bút toán `POSTED` không sửa và không xoá được, kể cả bằng SQL trực tiếp. Muốn sửa phải tạo bút toán đảo (REQ-REC-11).
- **Production:** service không khởi động nếu thiếu `GATEWAY_SHARED_SECRET`. Yêu cầu không mang header `x-gateway-auth` đúng bị trả 401, dù có `x-staff-id`. CORS chỉ mở cho các origin trong `ALLOWED_ORIGINS`.
- Sự kiện `limit.authorization.processed` chống trùng theo `messageId`, luôn ack. Lỗi ghi vào `inbound_events`.

## Giả định đang chờ quyết định

Trong code đánh dấu `[D-REC-xx]` (R02 §3).

| Chỗ | Giả định | Ai chốt |
|---|---|---|
| Ngưỡng aging, leo thang 72 giờ | Theo UI mẫu | Kế toán trưởng (D-REC-02, 03) |
| Tài khoản GL `1131.xx`, `4211.xx`, `6311.xx` | Ví dụ | Kế toán trưởng (R05 §9 câu 3) |
| Bút toán tự động từ sự kiện Hạn mức cũng áp ngưỡng 50 triệu | Đề xuất của BA, theo hướng an toàn | Kế toán trưởng |
| Gợi ý nguyên nhân | Luật theo ngữ cảnh, thay cho mô hình AI | Data |
| Thời hạn lưu | Chưa có job xoá. Bút toán và audit không xoá ở tầng ứng dụng | Kế toán trưởng + Pháp chế (R05 §4.3) |
