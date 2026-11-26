# R06 · Đối soát – yêu cầu phi chức năng và từ điển chỉ số KPI

| | |
|---|---|
| Mã tài liệu | AEG-REC-R06 |
| Phiên bản | 0.3 |
| Ngày phát hành | 26/11/2026 |
| Trạng thái | 📝 Bản nháp – chờ Tech Lead, Ops và Kế toán trưởng chốt các ngưỡng đánh dấu *đề xuất* |
| Phân loại | Nội bộ |
| Tác giả | Han Dao (BA) |
| Người duyệt | Tech Lead · Ops / Quản lý vận hành · Kế toán trưởng · InfoSec – chưa duyệt |
| Mục đích và phạm vi | Định nghĩa yêu cầu phi chức năng và từ điển chỉ số KPI cho Đối soát |
| Chuẩn tham chiếu | ISO/IEC 25010:2023 (mô hình chất lượng sản phẩm) · ISO/IEC/IEEE 29148:2018 (cách viết yêu cầu) · BABOK v3 kỹ thuật *Metrics and KPIs* · WCAG 2.2 mức AA |
| Thuật ngữ | [G02 Thuật ngữ và chữ viết tắt](../00-overview/G02-glossary.md) |
| Epic | [SCRUM-7](https://baohandao2303.atlassian.net/browse/SCRUM-7) · liên quan [SCRUM-53](https://baohandao2303.atlassian.net/browse/SCRUM-53) (EOD) |
| Nguồn | BAS-BRD-v1.2 (BR-REC, RULE-REC, KPI) qua [R02](R02-requirements-gap-rtm.md) · chỉ số trên REC-01 ở [R01 §7](R01-reconciliation-flow.md) · bảng dữ liệu ở [R05](R05-api-data-dictionary.md) |
| Liên quan | Module 1: [C18](../01-ekyc/1.5-analytics/C18-kpi-metric-dictionary.md) (KPI), NFR trong [C03](../00-overview/C03-requirements-addendum-v1.3.md) · cách kiểm từng yêu cầu: [R07](R07-sit-perf-uat.md) |

> ⚠️ Module 2 chưa có yêu cầu phi chức năng nào trong các tài liệu hiện có. Cột **Nguồn** ghi rõ ngưỡng nào lấy từ baseline (BRD, RULE, KPI) và ngưỡng nào là **đề xuất của BA** dựa trên khối lượng dữ liệu của UI mẫu. Ngưỡng đề xuất phải được Tech Lead và Ops chốt trước khi đưa vào hợp đồng nghiệm thu.

## 1. Yêu cầu phi chức năng

Mỗi yêu cầu viết một câu "Hệ thống phải…", có ngưỡng đo được và cách kiểm (mã ca trong R07). Nhóm theo đặc tính chất lượng của ISO/IEC 25010.

### 1.1 Hiệu năng (Performance efficiency)

| Mã | Yêu cầu | Ngưỡng | Nguồn | Kiểm bằng | Ưu tiên |
|---|---|---|---|---|---|
| NFR-REC-01 | Hệ thống phải nạp và chuẩn hoá xong một file sao kê của một nguồn trong thời gian giới hạn kể từ khi nhận file. | File 1,3 triệu bản ghi (mức CBS/ngày của UI mẫu) ≤ 30 phút | *Đề xuất* | PERF-REC-01 | Must |
| NFR-REC-02 | Hệ thống phải có kết quả khớp của một lô trong thời gian giới hạn kể từ khi nạp xong. | ≤ 15 phút cho lô 1,3 triệu bản ghi | *Đề xuất* | PERF-REC-02 | Must |
| NFR-REC-03 | Hệ thống phải dừng tìm tổ hợp N:1 của một lô khi vượt giới hạn thời gian và chuyển thành ngoại lệ. | ≤ `n1_timeout_ms` (mặc định 2 giây) mỗi lô | RULE-REC-03, REQ-REC-15 | TC-REC-B05, PERF-REC-03 | Must |
| NFR-REC-04 | Hệ thống phải trả kết quả các API đọc của màn REC-01 → REC-06 trong thời gian giới hạn. | P95 < 2 giây với 10 000 ngoại lệ đang mở, 50 người dùng đồng thời | *Đề xuất* (Module 1 dùng < 3 giây – NFR-PERF-02) | PERF-REC-04 | Should |
| NFR-REC-05 | Hệ thống phải ghi nhận sự kiện từ Hạn mức và hạch toán (nếu cần) trong thời gian giới hạn kể từ khi sự kiện phát ra. | < 10 giây | KPI-09, TC-REC-B09 | PERF-REC-05 | Must |
| NFR-REC-06 | Hệ thống phải chạy xong đối chiếu cuối ngày với Hạn mức trước giờ làm việc của ngày kế tiếp. | Xong trước 06:00 | *Đề xuất* | PERF-REC-06 | Must |

### 1.2 Độ tin cậy (Reliability)

| Mã | Yêu cầu | Ngưỡng | Nguồn | Kiểm bằng | Ưu tiên |
|---|---|---|---|---|---|
| NFR-REC-07 | Hệ thống phải sẵn sàng cho người dùng trong giờ làm việc. | ≥ 99,5% từ 07:00 đến 20:00 các ngày làm việc | *Đề xuất* – cần khớp cam kết SLA nội bộ của ngân hàng | Giám sát vận hành | Should |
| NFR-REC-08 | Hệ thống phải cho chạy lại job nạp, engine khớp và đối chiếu cuối ngày mà không tạo bản ghi trùng. | 0 bản ghi trùng sau khi chạy lại | REQ-REC-14, REQ-REC-20 | TC-REC-B02, TC-REC-B09, SIT-REC-09 | Must |
| NFR-REC-09 | Hệ thống phải xử lý sự kiện nhận vào theo kiểu ít nhất một lần và loại trùng theo `message_id`. | 0 bút toán trùng khi sự kiện gửi lại | REQ-REC-20 | TC-REC-B09, SIT-REC-12 | Must |
| NFR-REC-10 | Hệ thống phải khôi phục được dữ liệu sau sự cố trong giới hạn mất dữ liệu và thời gian khôi phục. | RPO ≤ 15 phút, RTO ≤ 4 giờ | *Đề xuất* – cần khớp kế hoạch BCP của ngân hàng | Diễn tập khôi phục | Should |
| NFR-REC-11 | Hệ thống phải giữ nguyên file và giao dịch đã nạp khi một bước sau (khớp, hạch toán) lỗi, và cho chạy tiếp từ bước lỗi. | Không mất bản ghi; không phải nạp lại file | *Đề xuất* | SIT-REC-04 | Should |

### 1.3 Bảo mật (Security)

| Mã | Yêu cầu | Ngưỡng | Nguồn | Kiểm bằng | Ưu tiên |
|---|---|---|---|---|---|
| NFR-REC-12 | Hệ thống phải xác thực người dùng qua SSO của ngân hàng và phân quyền theo 4 vai trò `REC_OFFICER`, `REC_CHECKER`, `REC_LEAD`, `FIN_VIEWER`. | 100% API (trừ health check) yêu cầu danh tính | R05 §1.1 | SIT-REC-13 | Must |
| NFR-REC-13 | Hệ thống phải kiểm các ràng buộc phân tách nhiệm vụ SoD-1 → SoD-3 ở server, không dựa vào giao diện. | 0 lần vượt qua được bằng gọi API trực tiếp | BR-REC-07, BR-REC-08, RULE-REC-05 | TC-REC-B07, UAT-REC-P04 | Must |
| NFR-REC-14 | Hệ thống phải che số tài khoản (giữ 4 số cuối) khi hiển thị, mã hoá cột số tài khoản khi lưu, và không lưu số thẻ đầy đủ. | 0 số thẻ đầy đủ trong DB và log | D-REC-09, PCI DSS, R05 §3.2 | Rà soát DB và log trước UAT | Must |
| NFR-REC-15 | Hệ thống phải nhận file đối tác qua kênh mã hoá với khoá riêng cho từng nguồn và kiểm checksum trước khi nạp. | SFTP / TLS 1.2 trở lên; mỗi nguồn một khoá | *Đề xuất*, REQ-REC-14 | SIT-REC-01 → 05 | Must |

### 1.4 Kiểm toán và truy vết (Accountability)

| Mã | Yêu cầu | Ngưỡng | Nguồn | Kiểm bằng | Ưu tiên |
|---|---|---|---|---|---|
| NFR-REC-16 | Hệ thống phải ghi audit chỉ thêm cho mọi thao tác thay đổi trạng thái, xem số tài khoản đầy đủ và mọi lần bị chặn bởi SoD. | 100% thao tác trong danh mục R05 §3.9 | BR-REC-06, R05 §3.9 | UAT-REC-P09 | Must |
| NFR-REC-17 | Hệ thống phải không cho sửa hay xoá bút toán đã `POSTED` ở mọi tầng, kể cả lệnh trực tiếp trên DB. | DB từ chối `UPDATE` / `DELETE` | RULE-REC-08, REQ-REC-11 | TC-REC-B06 | Must |
| NFR-REC-18 | Hệ thống phải bảo đảm mọi bút toán truy ngược được tới giao dịch gốc. | 0 bản ghi mồ côi trong báo cáo `integrity` | BR-REC-10, REQ-REC-19 | TC-REC-B08, UAT-REC-10 | Must |

### 1.5 Khả năng sử dụng, tương thích, bảo trì

| Mã | Yêu cầu | Ngưỡng | Nguồn | Kiểm bằng | Ưu tiên |
|---|---|---|---|---|---|
| NFR-REC-19 | Giao diện Đối soát phải đạt WCAG 2.2 mức AA; trạng thái luôn có chữ đi kèm màu. | 0 lỗi mức A/AA trên 6 màn | R03 §8, chuẩn chung của dự án (Q01) | Kiểm trợ năng trước UAT | Should |
| NFR-REC-20 | Giao diện phải có tiếng Việt và tiếng Anh, giữ lựa chọn ngôn ngữ của người dùng. | Toàn bộ nhãn 6 màn | UI mẫu đã có VI/EN | UAT-REC-P10 | Could |
| NFR-REC-21 | Hệ thống phải đọc được các định dạng sao kê của baseline. | ISO 20022 camt.053 / camt.054, Visa BASE II TC33, Mastercard IPM, CSV của CBS, JSON của ví | BR-REC-01 | SIT-REC-01 → 05 | Must |
| NFR-REC-22 | Hệ thống phải cho đổi tham số nghiệp vụ (ngưỡng GL, ngưỡng Fuzzy, thời gian leo thang…) qua Maker-Checker mà không cần triển khai lại. | Tham số ở R05 §3.9 | R05 §3.9 | UAT-REC-P08 | Should |
| NFR-REC-23 | Hệ thống phải cảnh báo vận hành khi file của một nguồn trễ quá ngưỡng so với lịch hoặc bị cách ly. | Trễ > 60 phút hoặc cách ly → cảnh báo trong 5 phút | UAT-REC-02 · ngưỡng *đề xuất* | UAT-REC-02, SIT-REC-05 | Must |

## 2. Từ điển chỉ số KPI

Mã, tên và mục tiêu KPI lấy từ bảng *Business Success Metrics* của BAS-BRD-v1.2 §1.9 (đã đối chiếu 25/11/2026). Cột **Công thức** là cách tính BA đề xuất trên lược đồ R05.

| Mã | Chỉ số | Định nghĩa | Công thức (trên bảng R05) | Mục tiêu | Nguồn mục tiêu | Chiều cắt | Màn |
|---|---|---|---|---|---|---|---|
| KPI-03 | Tỷ lệ khớp tự động (Auto-Match Rate) | Giao dịch khớp không cần người ÷ tổng giao dịch hợp lệ đã chạy khớp trong kỳ | `count(txn trong match MATCHED do engine) / count(txn dq_status = VALID)` | ≥ 95% | BRD §1.9 | Ngày, nguồn, quy tắc | REC-01 |
| KPI-04 | MTTR xử lý ngoại lệ | Thời gian trung bình từ lúc tạo tới lúc đóng ngoại lệ | `avg(closed_at − opened_at)` trên ngoại lệ đóng trong kỳ | ≤ 4 giờ | BRD §1.9 · câu hỏi T+1 ở R02 §7 | Ngày, loại ngoại lệ, người xử lý | REC-01 |
| KPI-05 | Zero-touch Rate | Bút toán tự hạch toán ÷ tổng bút toán đã hạch toán | `count(gl POSTED, mode = ZERO_TOUCH) / count(gl POSTED)` | ≥ 30% giai đoạn đầu | BRD §1.9 · nghĩa theo D-REC-08 | Ngày, nguồn | REC-01, REC-06 |
| KPI-06 | Giá trị tồn đọng cuối ngày (Outstanding Value) | Tổng chênh lệch của ngoại lệ còn mở lúc chốt ngày nghiệp vụ | `sum(diff_amount)` với `status ≠ RESOLVED` tại 23:59 của `business_date` | Giảm dần theo từng chu kỳ vận hành (so kỳ trước); ngưỡng cảnh báo trong ngày cấu hình (REQ-REC-18) | BRD §1.9 | Nguồn, loại ngoại lệ, aging | REC-01 |
| KPI-09 | Sai lệch đối soát chéo Ledger cuối ngày (chung với Module 3) | (a) Số dòng lệch EOD chưa giải trình; (b) phụ: độ trễ nhận sự kiện từ Hạn mức | (a) `count(eod_diffs)` có `status = OPEN` hoặc `note` trống; (b) `percentile_95(processed_at − payload.processed_at)` | (a) Bằng 0 hoặc giải trình 100% (BRD); (b) < 10 giây (*đề xuất*, SCRUM-53) | BRD §1.9 · R02 REQ-REC-20, TC-REC-B09 | Ngày | Báo cáo EOD |

**Chỉ số vận hành bổ sung** (không có mã KPI trong baseline – BA đề xuất để theo dõi chất lượng; không dùng làm tiêu chí nghiệm thu):

| Chỉ số | Công thức | Dùng để |
|---|---|---|
| Tỷ lệ file bị cách ly | `count(source_files QUARANTINED) / count(source_files)` theo nguồn | Đánh giá chất lượng dữ liệu đối tác (RSK-05) |
| Tỷ lệ chọn nguyên nhân ngoài gợi ý AI | `count(root_cause_override) / count(ngoại lệ đã đóng)` | Đo độ chính xác mô hình AI (BR-REC-05); tăng cao → cần huấn luyện lại |
| Tỷ lệ ngoại lệ leo thang | `count(escalated_at IS NOT NULL) / count(ngoại lệ)` | Phát hiện thiếu người hoặc ngưỡng aging chưa hợp lý |
| Tỷ lệ bút toán bị trả về / từ chối | `count(submit_count > 1 OR status = REJECTED) / count(MAKER_CHECKER)` | Chất lượng bút toán do Maker lập |
| Số lần bị chặn SoD | `count(audit SOD_BLOCKED)` theo người | Phát hiện thao tác bất thường, cần InfoSec xem |

### 2.1 Quy tắc tính

| Quy tắc | Nội dung |
|---|---|
| Kỳ | Theo ngày nghiệp vụ (`business_date`, giờ Việt Nam). Kỳ 7 ngày / tháng là tổng của các ngày |
| Loại trừ | Giao dịch `dq_status = INVALID` không tính vào KPI-03; ngoại lệ `auto_healed` tính riêng, không tính vào KPI-04 **[D-REC-08]** |
| Ngoại lệ chờ đối tác T+1 | Tính vào KPI-04 cho tới khi PO trả lời câu hỏi 2 của R02 §7 |
| Thời điểm số liệu | Mọi thẻ hiển thị "Cập nhật lúc …" (UAT-REC-09) |
| Khớp số | Số trên REC-01 phải bằng kết quả truy vấn kiểm chứng ở §3 (sai lệch 0) |

## 3. Truy vấn kiểm chứng (PostgreSQL, trên lược đồ R05)

```sql
-- KPI-03: tỷ lệ khớp tự động theo ngày và nguồn
SELECT st.source,
       date(to_timestamp(st.created_at / 1000) AT TIME ZONE 'Asia/Ho_Chi_Minh') AS business_date,
       count(*) FILTER (WHERE mr.status = 'MATCHED' AND ec.case_id IS NULL)::numeric
         / nullif(count(*), 0) AS auto_match_rate
FROM source_transactions st
LEFT JOIN match_items mi    ON mi.txn_id = st.txn_id
LEFT JOIN match_results mr  ON mr.match_id = mi.match_id
LEFT JOIN exception_cases ec ON ec.match_id = mr.match_id
WHERE st.dq_status = 'VALID'
GROUP BY 1, 2;

-- KPI-04: MTTR (giờ) của ngoại lệ đóng trong ngày
SELECT avg((closed_at - opened_at) / 3600000.0) AS mttr_hours
FROM exception_cases
WHERE closed_at IS NOT NULL AND NOT auto_healed
  AND closed_at >= :from_ms AND closed_at < :to_ms;

-- KPI-05: zero-touch
SELECT count(*) FILTER (WHERE mode = 'ZERO_TOUCH')::numeric / nullif(count(*), 0) AS zero_touch
FROM gl_entries
WHERE status = 'POSTED' AND posted_at >= :from_ms AND posted_at < :to_ms;

-- KPI-09 (a): dòng lệch EOD chưa giải trình (mục tiêu 0) và dòng chưa có người phụ trách
SELECT r.business_date,
       count(d.diff_id) FILTER (WHERE d.status = 'OPEN' OR coalesce(d.note, '') = '') AS unexplained,
       count(d.diff_id) FILTER (WHERE d.owner_id IS NULL)                            AS unowned
FROM eod_runs r LEFT JOIN eod_diffs d ON d.run_id = r.run_id
GROUP BY 1;

-- KPI-06: giá trị tồn đọng lúc chốt ngày; chạy lúc 23:59, lưu vào báo cáo ngày để so với kỳ trước
SELECT sum(abs(diff_amount)) AS outstanding_value, count(*) AS open_cases
FROM exception_cases
WHERE status <> 'RESOLVED' AND opened_at < :end_of_day_ms;
```

## 4. Truy vết

| Yêu cầu | BR / RULE | Kiểm bằng (R07) |
|---|---|---|
| NFR-REC-01, 02, 21 | BR-REC-01 | PERF-REC-01, 02 · SIT-REC-01 → 05 |
| NFR-REC-03 | BR-REC-04, RULE-REC-03 | PERF-REC-03 · TC-REC-B05 |
| NFR-REC-05, 06, 09 | BR-LIM-10 | PERF-REC-05, 06 · SIT-REC-12 · TC-REC-B09 |
| NFR-REC-08, 11 | BR-REC-01 | SIT-REC-04, 09 · TC-REC-B02 |
| NFR-REC-12, 13 | BR-REC-07, 08 | SIT-REC-13 · TC-REC-B07 · UAT-REC-P04 |
| NFR-REC-16, 17, 18 | BR-REC-06, 10 | TC-REC-B06, B08 · UAT-REC-10, P09 |
| KPI-03 → 06 | BR-REC-09 | UAT-REC-P07 (số REC-01 khớp truy vấn §3) |

## 5. Câu hỏi mở

| # | Câu hỏi | Gửi |
|---|---|---|
| 1 | Chốt các ngưỡng *đề xuất* ở §1 (thời gian nạp, khớp, API, EOD, sẵn sàng, RPO/RTO) | Tech Lead + Ops |
| 2 | Khối lượng giao dịch thực tế theo nguồn và mức tăng dự kiến 2 năm để định cỡ kiểm thử hiệu năng | Ops + Data |
| 3 | ~~Xác nhận mã KPI-03 → 06~~ – đã đối chiếu BRD §1.9 ngày 25/11/2026. Còn lại: PO chốt KPI-06 so sánh với kỳ nào (ngày trước hay trung bình 7 ngày) | PO |
| 4 | Giờ làm việc của nhóm đối soát (để tính sẵn sàng và SLA leo thang) | Ops |

## 6. Kiểm soát tài liệu

### Tài liệu tham chiếu

| Mã | Tài liệu |
|---|---|
| R02 | [R02 · Đối soát – yêu cầu bổ sung, điểm lệch baseline & RTM](R02-requirements-gap-rtm.md) |
| R01 | [R01 · Đối soát giao dịch – luồng, trạng thái và kiểm soát](R01-reconciliation-flow.md) |
| R05 | [R05 · Đối soát – đặc tả API và từ điển dữ liệu (thiết kế đề xuất)](R05-api-data-dictionary.md) |
| C18 | [C18 · Dashboard KPI eKYC & từ điển chỉ số](../01-ekyc/1.5-analytics/C18-kpi-metric-dictionary.md) |
| C03 | [C03 · Requirements Addendum v1.3 & RTM – eKYC](../00-overview/C03-requirements-addendum-v1.3.md) |
| R07 | [R07 · Đối soát – kế hoạch SIT, kiểm thử hiệu năng, bộ UAT và biên bản nghiệm thu](R07-sit-perf-uat.md) |

Chuẩn quốc tế: xem trường *Chuẩn tham chiếu* ở đầu trang.

### Lịch sử phiên bản

| Phiên bản | Ngày | Người sửa | Commit | Thay đổi |
|---|---|---|---|---|
| 0.1 | 25/11/2026 | Han Dao | e5293ba | Bản đầu: 23 yêu cầu phi chức năng theo ISO/IEC 25010, từ điển 5 KPI và 5 chỉ số vận hành, truy vấn kiểm chứng |
| 0.2 | 25/11/2026 | Han Dao | — | Đối chiếu bảng KPI gốc BRD §1.9: KPI-06 là giá trị tồn đọng cuối ngày, mục tiêu giảm dần; KPI-09 lấy mục tiêu baseline "bằng 0 hoặc giải trình 100%", độ trễ sự kiện chuyển thành chỉ số phụ; bỏ ghi chú "cần đối chiếu" |
| 0.3 | 26/11/2026 | Han Dao | — | Chuẩn hoá cấu trúc theo ISO/IEC/IEEE 15289: khối thuộc tính đầu trang, tài liệu tham chiếu, thuật ngữ dùng chung (G02), mục kiểm soát tài liệu thống nhất |

### Phê duyệt

| Vai trò | Người | Ngày | Kết luận |
|---|---|---|---|
| BA (soạn) | Han Dao | 25/11/2026 | Trình duyệt |
| Tech Lead |  |  |  |
| Ops / Quản lý vận hành |  |  |  |
| Kế toán trưởng |  |  |  |
| InfoSec |  |  |  |
