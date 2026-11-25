# L06 · Hạn mức – yêu cầu phi chức năng và từ điển chỉ số KPI

| | |
|---|---|
| Phiên bản | 0.1 · 25/11/2026 · Han Dao (BA) |
| Trạng thái | 📝 Bản nháp – chờ Tech Lead, Ops, Vận hành thẻ và InfoSec chốt các ngưỡng *đề xuất* |
| Epic | [SCRUM-8](https://baohandao2303.atlassian.net/browse/SCRUM-8) |
| Nguồn | BAS-BRD-v1.2: BR-LIM, RULE-LIM, ghi chú NFR trong UC-LIM-01 → 06, §1.9 KPI-07 → 09 · BAS-RAID-v1.2: NFR-PERF-01, NFR-SEC-02, NFR-SEC-04, NFR-AUD-01/02, RSK-08, 09, 14, 16, DEP-10, ISS-04 · bảng dữ liệu [L05](L05-api-data-dictionary.md) |
| Chuẩn tham chiếu | ISO/IEC 25010:2023 · ISO/IEC/IEEE 29148:2018 · BABOK v3 *Metrics and KPIs* · PCI DSS v4.0 · WCAG 2.2 AA · Nghị định 13/2023/NĐ-CP (dữ liệu cá nhân) |
| Liên quan | Module 2 [R06](../02-reconciliation/R06-nfr-kpi.md) (KPI-09 dùng chung) · cách kiểm từng yêu cầu: [L07](L07-sit-perf-uat.md) |

> ⚠️ Baseline chỉ cho số cứng ở SLA authorization (p99 < 2 giây), 0 sự cố vượt hạn mức và sai lệch EOD bằng 0. Cột **Nguồn** ghi rõ ngưỡng nào từ baseline và ngưỡng nào là **đề xuất của BA**. Ngưỡng đề xuất phải được chốt trước khi đưa vào tiêu chí nghiệm thu (RSK-13, DEP-12).

## 1. Yêu cầu phi chức năng

### 1.1 Hiệu năng (Performance efficiency)

| Mã | Yêu cầu | Ngưỡng | Nguồn | Kiểm bằng | Ưu tiên |
|---|---|---|---|---|---|
| NFR-LIM-01 | Hệ thống phải trả 0110 cho bản tin 0100 trong thời gian giới hạn, tính từ lúc nhận tới lúc gửi. | p99 < 2 000 ms ở tải đỉnh | BR-LIM-01, RULE-LIM-01, NFR-PERF-01, KPI-07 | PERF-LIM-01, UAT-LIM-P01 | Must |
| NFR-LIM-02 | Hệ thống phải giữ NFR-LIM-01 ở tải đỉnh kéo dài. | 300 giao dịch/giây trong 60 phút, lỗi < 0,1% | *Đề xuất*: UI mẫu hiện 1 284 giao dịch/phút (~21/giây trung bình), nhân hệ số đỉnh ×10 và dự phòng tăng trưởng | PERF-LIM-02 | Must |
| NFR-LIM-03 | Hệ thống phải chia ngân sách 2 giây cho từng bước và trả từ chối fail-safe trước khi hết tổng ngân sách. | Nhận + giải mã ≤ 50 ms · đọc + cập nhật hạn mức ≤ 200 ms · CASA ≤ 600 ms · ghi log ≤ 100 ms · gửi ≤ 50 ms · **dừng và từ chối ở 1 800 ms** | BR-LIM-09, RULE-LIM-07 · số từng bước *đề xuất* **[D-LIM-06]** | TC-LIM-B09, PERF-LIM-04 | Must |
| NFR-LIM-04 | Hệ thống phải giải phóng hạn mức sau khi nhận 0420 hợp lệ. | ≤ 5 giây | UC-LIM-05 · *đề xuất* | SIT-LIM-03 | Must |
| NFR-LIM-05 | Hệ thống phải khoá Boost và đưa thông báo vào hàng gửi gần thời gian thực sau khi nhận tín hiệu gian lận điểm cao. | ≤ 60 giây từ tín hiệu tới `notifications` `PENDING`; SMS tới khách ≤ 5 phút (p95) | UC-LIM-06 "gần thời gian thực" · *đề xuất* | SIT-LIM-07, PERF-LIM-05 | Must |
| NFR-LIM-06 | API đọc của web vận hành và app phải trả trong thời gian giới hạn. | p95 < 2 giây, 50 người dùng web + 1 000 người dùng app đồng thời | *Đề xuất* (cùng mức R06 NFR-REC-04) | PERF-LIM-03 | Should |
| NFR-LIM-07 | Sự kiện `limit.authorization.processed` phải tới Module 2 trong thời gian giới hạn. | p95 < 10 giây | KPI-09 (b), SCRUM-53 · *đề xuất* | SIT-LIM-09, PERF-LIM-06 | Must |
| NFR-LIM-08 | Boost và lời mời phải hết hạn tự động đúng mốc. | ≤ 15 phút sau `expires_at`; 0 Boost quá hạn còn `ACTIVE` | RULE-LIM-06, US-LIM-04 · độ trễ *đề xuất* | TC-LIM-B07, UAT-LIM-06 | Must |

### 1.2 Độ tin cậy (Reliability)

| Mã | Yêu cầu | Ngưỡng | Nguồn | Kiểm bằng | Ưu tiên |
|---|---|---|---|---|---|
| NFR-LIM-09 | Cổng authorization phải sẵn sàng liên tục. | ≥ 99,95% / tháng, 24/7 | *Đề xuất* – cần khớp cam kết với tổ chức thẻ | Giám sát vận hành | Must |
| NFR-LIM-10 | Hệ thống phải không để giao dịch nào làm vượt hạn mức thực tế do xử lý đồng thời. | 0 sự cố (KPI-08); 0 lần `available_limit` < 0 trong 10 000 cặp giao dịch song song | BR-LIM-02, RULE-LIM-02, RSK-08 | TC-LIM-B03, PERF-LIM-02, UAT-LIM-01 | Must |
| NFR-LIM-11 | Hệ thống phải không trừ hạn mức hai lần cho bản tin gửi lại. | 0 lần trừ trùng | BR-LIM-03, RULE-LIM-03 | TC-LIM-B02, SIT-LIM-02 | Must |
| NFR-LIM-12 | Hệ thống phải có circuit breaker riêng cho mỗi phụ thuộc (CASA, Fraud Engine, Notification). | Mở khi ≥ 50% lỗi / timeout trong 20 lời gọi gần nhất; chờ 30 giây rồi thử lại 3 lời gọi | BR-LIM-09 · tham số *đề xuất* | TC-LIM-B09, SIT-LIM-04 | Must |
| NFR-LIM-13 | Hệ thống phải không mất giao dịch hạn mức đã trả lời cho tổ chức thẻ khi sự cố. | RPO = 0 cho `card_limit_profiles`, `authorization_logs` (ghi đồng bộ); RTO ≤ 30 phút | *Đề xuất* – cần khớp BCP / ISO 22301 của ngân hàng | Diễn tập khôi phục | Must |
| NFR-LIM-14 | Hệ thống phải phát sự kiện theo kiểu ít nhất một lần, mỗi sự kiện có `messageId` cố định. | 0 sự kiện mất; bên nhận loại trùng | REQ-LIM-20, NFR-REC-09 | TC-LIM-B10, SIT-LIM-09 | Must |

### 1.3 Bảo mật (Security)

| Mã | Yêu cầu | Ngưỡng | Nguồn | Kiểm bằng | Ưu tiên |
|---|---|---|---|---|---|
| NFR-LIM-15 | Hệ thống phải không lưu PAN rõ; token hoá ngay tại cổng; mọi màn, log, sự kiện, file xuất chỉ có PAN che. | 0 PAN đầy đủ trong DB, log, sự kiện, ảnh bằng chứng UAT | NFR-SEC-04, PCI DSS 3.3–3.5, RSK-03, RSK-16, DEP-10 | SIT-LIM-10, UAT-LIM-10, TC-LIM-04/25 | Must |
| NFR-LIM-16 | Kết nối với tổ chức thẻ, CASA, Fraud Engine, Notification phải mã hoá; dịch vụ nội bộ xác thực lẫn nhau. | TLS 1.2 trở lên; mTLS cho API nội bộ | NFR-SEC-02 · *đề xuất* mTLS | SIT-LIM-01 → 08 | Must |
| NFR-LIM-17 | Hệ thống phải xác thực người dùng qua SSO, phân quyền theo `CARD_OPS`, `CREDIT_RISK`, `LIM_VIEWER`, và kiểm SoD-L1/L2 ở server. | 100% API (trừ health check) cần danh tính; 0 lần vượt SoD bằng gọi API trực tiếp | L05 §1.1 | SIT-LIM-11 | Must |
| NFR-LIM-18 | Thông báo SMS/App chỉ chứa dữ liệu tối thiểu, không có PAN đầy đủ, OTP, đường link. | 100% mẫu đã duyệt đạt | REQ-LIM-15, Nghị định 13/2023 | UAT-LIM-07 | Must |

### 1.4 Kiểm toán (Accountability)

| Mã | Yêu cầu | Ngưỡng | Nguồn | Kiểm bằng | Ưu tiên |
|---|---|---|---|---|---|
| NFR-LIM-19 | Hệ thống phải ghi `AuthorizationLog` đầy đủ cho mọi bản tin, kể cả bản tin trùng và bị từ chối fail-safe. | 100% bản tin có log với `response_time_ms` | UC-LIM-01 bước 4, NFR-AUD-01 | TC-LIM-B01, PERF-LIM-01 | Must |
| NFR-LIM-20 | Hệ thống phải ghi audit chỉ thêm cho khoá / mở khoá Boost, điều chỉnh hạn mức, đóng case, gửi lại thông báo, bật/tắt Fallback, khoá thẻ. | 100% thao tác trong danh mục L05 §3.6 | NFR-AUD-01/02 | UAT-LIM-P09 | Must |

### 1.5 Khả năng sử dụng và bảo trì

| Mã | Yêu cầu | Ngưỡng | Nguồn | Kiểm bằng | Ưu tiên |
|---|---|---|---|---|---|
| NFR-LIM-21 | Giao diện web và app Hạn mức phải đạt WCAG 2.2 mức AA. | 0 lỗi mức A/AA trên 7 màn | [L03 §7](L03-ui-spec.md) | Kiểm trợ năng trước UAT | Should |
| NFR-LIM-22 | Ngưỡng Boost, trần %, ngưỡng khoá gian lận, tham số breaker, lịch gửi lại phải đổi được qua cấu hình có duyệt, không cần triển khai lại. | Danh mục L05 §3.6 `config` | DEP-12, ACT-02 | UAT-LIM-P08 | Should |

## 2. Từ điển chỉ số KPI

Mã, tên và mục tiêu lấy từ BAS-BRD-v1.2 §1.9. Cột **Công thức** là cách tính BA đề xuất trên lược đồ L05.

| Mã | Chỉ số | Định nghĩa | Công thức | Mục tiêu | Chiều cắt | Màn |
|---|---|---|---|---|---|---|
| KPI-07 | Tỷ lệ Authorization đáp ứng SLA < 2 giây | Bản tin 0100 được trả lời dưới 2 giây ÷ tổng bản tin 0100 trong kỳ | `count(message_type = AUTH AND response_time_ms < 2000) / count(message_type = AUTH)` | ≥ 99% (tương đương p99 < 2 000 ms) | Giờ, ngày, sản phẩm, quyết định, có / không fallback | W1 |
| KPI-08 | Số sự cố vượt hạn mức thực tế do lỗi đồng thời | Số lần dư nợ + tạm giữ vượt hạn mức + Boost hiệu lực mà không phải do chính sách cho phép (REQ-LIM-09, 0120 stand-in) | Kiểm sau mỗi cập nhật + truy vấn §3 | 0 sự cố | Ngày, thẻ | Báo cáo, cảnh báo |
| KPI-09 | Sai lệch đối soát chéo Ledger cuối ngày | Dòng lệch giữa ledger Hạn mức và GL của Module 2 chưa giải trình | Theo [R06 §2](../02-reconciliation/R06-nfr-kpi.md) trên `eod_diffs` | Bằng 0 hoặc giải trình 100% | Ngày, loại lệch | Báo cáo EOD |

**Chỉ số vận hành bổ sung** (không có mã trong baseline, không dùng làm tiêu chí nghiệm thu):

| Chỉ số | Công thức (L05) | Dùng để |
|---|---|---|
| Tỷ lệ duyệt qua Smart Fallback | `count(fallback_id IS NOT NULL) / count(decision = APPROVE)` | Đánh giá giá trị tính năng (US-LIM-03) |
| Tỷ lệ nhận Boost | `count(boost_offers ACCEPTED) / count(boost_offers)` | Đánh giá chính sách Boost |
| Tỷ lệ Boost bị khoá | `count(boosts từng LOCKED_SUSPECTED_FRAUD) / count(boosts)` | Theo dõi RSK-11 |
| Tỷ lệ báo nhầm gian lận | `count(conclusion = FALSE_POSITIVE) / count(fraud_cases CLOSED)` | Hiệu chỉnh ngưỡng (D-LIM-07) |
| Tỷ lệ thông báo tới khách | `count(notifications DELIVERED) / count(notifications)` theo kênh | RSK-14, CR-003 |
| Số bản tin trùng | `count(is_duplicate)` theo ngày | Theo dõi retry của tổ chức thẻ |
| Số reversal không khớp | `count(message_type = REVERSAL AND decision = UNMATCHED)` | RSK-10 |
| Từ chối fail-safe | `count(decline_reason IN (TIMEOUT_FAILSAFE, LOCK_TIMEOUT, CB_OPEN))` | Phát hiện sớm nguy cơ vượt SLA (RSK-09) |

### 2.1 Quy tắc tính

| Quy tắc | Nội dung |
|---|---|
| Kỳ | Theo ngày nghiệp vụ, giờ Việt Nam. W1 hiển thị theo giờ trong ngày, 7 ngày, tháng |
| Loại trừ khỏi KPI-07 | Bản tin trùng (`is_duplicate`) không tính 2 lần. Bản tin từ chối fail-safe **vẫn tính** (thời gian trả lời là của hệ thống) |
| KPI-08 | Giao dịch 0120 (stand-in do tổ chức thẻ duyệt thay) và trường hợp REQ-LIM-09 không tính là sự cố nhưng phải liệt kê riêng |
| Ngưỡng cảnh báo | KPI-07 dưới 99,5% trong 15 phút → cảnh báo Ops (*đề xuất*); KPI-08 ≥ 1 → cảnh báo ngay, leo thang theo RAID §4.1 |

## 3. Truy vấn kiểm chứng (PostgreSQL, trên lược đồ L05)

```sql
-- KPI-07: tỷ lệ đáp ứng SLA và p99 theo ngày
SELECT to_timestamp(created_at / 1000)::date AS day,
       avg((response_time_ms < 2000)::int)                         AS sla_rate,
       percentile_cont(0.99) WITHIN GROUP (ORDER BY response_time_ms) AS p99_ms
FROM authorization_logs
WHERE message_type = 'AUTH' AND NOT is_duplicate
GROUP BY 1 ORDER BY 1;

-- KPI-08: thẻ đang vượt hạn mức thực tế (phải trả về 0 dòng ngoài các trường hợp được phép)
SELECT card_id, credit_limit, boost_amount_active, available_limit
FROM card_limit_profiles
WHERE available_limit < 0;

-- Từ chối fail-safe theo lý do (RSK-09)
SELECT decline_reason, count(*)
FROM authorization_logs
WHERE decline_reason IN ('TIMEOUT_FAILSAFE', 'LOCK_TIMEOUT', 'CB_OPEN')
GROUP BY 1;
```

## 4. Truy vết

| Yêu cầu | BR / RULE / KPI | Kiểm bằng ([L07](L07-sit-perf-uat.md)) |
|---|---|---|
| NFR-LIM-01 → 03 | BR-LIM-01, 09, RULE-LIM-01, 07, KPI-07 | PERF-LIM-01, 02, 04 · UAT-LIM-P01 |
| NFR-LIM-04 | BR-LIM-08 | SIT-LIM-03 |
| NFR-LIM-05 | BR-LIM-07 | SIT-LIM-07, PERF-LIM-05 |
| NFR-LIM-07, 14 | BR-LIM-10, KPI-09 | SIT-LIM-09, PERF-LIM-06 |
| NFR-LIM-08 | BR-LIM-06, RULE-LIM-06 | UAT-LIM-06 |
| NFR-LIM-10, 11 | BR-LIM-02, 03, KPI-08 | PERF-LIM-02, SIT-LIM-02, UAT-LIM-01 |
| NFR-LIM-15, 18 | NFR-SEC-04, CR-003 | SIT-LIM-10, UAT-LIM-07, 10 |
| NFR-LIM-17, 20 | NFR-AUD-01/02 | SIT-LIM-11, UAT-LIM-P09 |

## 5. Câu hỏi mở

| # | Câu hỏi | Người trả lời |
|---|---|---|
| 1 | Tải đỉnh thực tế (giao dịch/giây) của danh mục thẻ giai đoạn 1 | Vận hành thẻ |
| 2 | Cam kết sẵn sàng với tổ chức thẻ và chế độ stand-in khi hệ thống không trả lời | Vận hành thẻ |
| 3 | Chia ngân sách 2 giây có tính thời gian mạng giữa switch và ngân hàng không? | Tech Lead |
| 4 | Trường hợp nào được coi là vượt hạn mức hợp lệ (KPI-08)? | Risk tín dụng |

## 6. Kiểm soát tài liệu

### Lịch sử phiên bản

| Phiên bản | Ngày | Người sửa | Commit | Thay đổi |
|---|---|---|---|---|
| 0.1 | 25/11/2026 | Han Dao | — | Bản đầu: 22 yêu cầu phi chức năng theo ISO/IEC 25010, KPI-07 → 09 và 8 chỉ số vận hành, truy vấn kiểm chứng |

### Phê duyệt

| Vai trò | Người | Ngày | Kết luận |
|---|---|---|---|
| BA (soạn) | Han Dao | 25/11/2026 | Trình duyệt |
| Tech Lead | | | |
| Ops | | | |
| Vận hành thẻ | | | |
| InfoSec | | | |
