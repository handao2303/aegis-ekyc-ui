# L02 · Hạn mức – yêu cầu bổ sung, điểm lệch baseline & RTM

| | |
|---|---|
| Epic | [SCRUM-8](https://baohandao2303.atlassian.net/browse/SCRUM-8) · Real-time Credit Limit |
| Baseline | BAS-BRD-v1.2 §2.3 BR-LIM-01 → 10 · §3.5 entity · §4.3 UC-LIM-01 → 06 · §5.3 RULE-LIM-01 → 08 · §6.3 US-LIM-01 → 06 · §1.9 KPI-07 → 09 · BAS-RAID-v1.2 (RSK-08 → 11, 14, 16 · DEP-05 → 07, 10 · ISS-03, 04) · CR-003 (đã duyệt 20/09/2026) |
| Chuẩn tham chiếu | ISO/IEC/IEEE 29148:2018 (cách viết và thuộc tính yêu cầu) · BABOK v3 *Trace Requirements*, *Assess Requirements Changes* · ISO 8583 · PCI DSS v4.0 (che PAN) |
| Phiên bản | 0.2 – bản nháp · 26/11/2026 · Han Dao (BA) |
| Trạng thái | 📝 Chờ PO, Risk tín dụng, Vận hành thẻ và Tech Lead quyết định 9 điểm ở §3 |

## 1. Phạm vi baseline và mức độ đáp ứng hiện tại

Đánh giá theo 3 nguồn: luồng [L01](L01-credit-limit-flow.md), UI mẫu (`/credit-limit/`, `/app/?screen=cardHome`) và kết quả chạy thử [L04](L04-test-plan-cases.md).

| BR | Nội dung rút gọn | Ưu tiên | L01 | UI mẫu | Đánh giá |
|---|---|---|---|---|---|
| BR-LIM-01 | Xử lý MTI 0100/0110, SLA < 2 giây | Must | ✅ §1 | ✅ W1 p99, độ trễ từng dòng | Đủ về luồng; số đo thật cần backend |
| BR-LIM-02 | Không vượt hạn mức khi giao dịch đồng thời (khoá hoặc CAS) | Must | ⚠️ chỉ vẽ optimistic | ✅ W2 xung đột version | Lệch cách làm – D-LIM-02 |
| BR-LIM-03 | Chống trùng bằng STAN + RRN | Must | ✅ §1 | ⚠️ log chỉ có STAN, không có RRN | Thiếu RRN trên UI – REQ-LIM-01 |
| BR-LIM-04 | Smart Fallback CASA, debit hold + bút toán đối ứng | Should | ✅ §2 | ✅ M1 công tắc, W2 bảng HOLD/SETTLED/RELEASED | Chưa có fallback từng phần, bút toán – REQ-LIM-05, 06 |
| BR-LIM-05 | Behavioral Score → Boost Eligibility | Should | ✅ §4 | ✅ W3 cột Score | Chưa có ngưỡng – D-LIM-07 |
| BR-LIM-06 | Boost time-boxed theo chu kỳ sao kê, trần % | Should | ⚠️ 72 giờ | ❌ 72 giờ, không có % | Lệch – D-LIM-01, REQ-LIM-08 |
| BR-LIM-07 | Phát hiện lạm dụng, khoá Boost **đồng thời** gửi SMS/App (CR-003) | Should | ✅ §5 | ✅ W4, M3 · ⚠️ khoá thủ công ở W3 không gửi | D-LIM-08 |
| BR-LIM-08 | Reversal MTI 0420 tự động | Must | ⚠️ ghi 0400 | ❌ 0400, gắn DECLINED, hiếm khi hiện | Lệch – D-LIM-03, DEF-LIM-01 |
| BR-LIM-09 | Circuit breaker + timeout budget từng bước | Must | ⚠️ chỉ breaker CBS | ⚠️ một breaker CBS | D-LIM-06 |
| BR-LIM-10 | Đối chiếu chéo EOD với Module 2 | Should | ✅ sự kiện | — (thuộc báo cáo EOD) | Phối hợp REQ-REC-20 ([R02](../02-reconciliation/R02-requirements-gap-rtm.md)) |

**Tình trạng mã nguồn backend (cần xác minh):** Jira ghi SCRUM-27, 28, 29, 30 ở trạng thái *Testing* và SCRUM-38 *Done*, nhưng repo `aegis-ekyc-ui` không có mã `limit-service`. Ngoài sự kiện `ekyc.decision.completed` mà `ekyc-service` phát ra để khởi tạo hạn mức, chưa có bằng chứng chạy thật. Tech Lead cần chỉ vị trí mã hoặc chuyển các story về đúng trạng thái.

## 2. Bản đồ tài liệu Module 3

| Tài liệu | Nội dung | Chuẩn |
|---|---|---|
| [L01](L01-credit-limit-flow.md) | Luồng authorization, quyết định, circuit breaker, Boost, gian lận, bản đồ màn | BPMN/UML (sequence, state) |
| **L02** (tài liệu này) | Phạm vi baseline, điểm lệch, yêu cầu bổ sung, RTM | ISO/IEC/IEEE 29148, BABOK |
| [L03](L03-ui-spec.md) | Đặc tả giao diện LIM-W1 → W4, M1 → M3 | WCAG 2.2 AA |
| [L04](L04-test-plan-cases.md) | Kế hoạch kiểm thử, 33 ca UI đã chạy, ca backend viết sẵn, lỗi | ISO/IEC/IEEE 29119-3 |
| [L05](L05-api-data-dictionary.md) | Thiết kế `limit-service`: dữ liệu, API, ISO 8583, sự kiện, mã lỗi | OpenAPI 3.1, ISO 8583 |
| [L06](L06-nfr-kpi.md) | Yêu cầu phi chức năng, KPI-07 → 09 | ISO/IEC 25010 |
| [L07](L07-sit-perf-uat.md) | SIT, hiệu năng, UAT, biên bản nghiệm thu | ISO/IEC/IEEE 29119-3 |
| [L08](L08-compliance-terms.md) | Tuân thủ, phạm vi đồng ý, dự thảo điều khoản Boost / Smart Fallback, mẫu thông báo; REQ-LIM-21 → 26 | ISO/IEC 29100, Luật 91/2025 |

## 3. Điểm lệch giữa baseline và L01 / UI mẫu – cần quyết định

| Mã | Điểm lệch | Baseline nói | L01 / UI mẫu đang làm | Đề xuất của BA | Người quyết |
|---|---|---|---|---|---|
| D-LIM-01 | Thời hạn Boost | Hết hiệu lực sau chu kỳ sao kê kế tiếp (BR-LIM-06, RULE-LIM-06, US-LIM-04) | Cố định 72 giờ; M2 ghi hạn 24/11 nhưng M1 đếm ngược 62 giờ | Theo baseline: `expires_at` = ngày chốt sao kê kế tiếp 23:59. M2 hiện ngày cụ thể, M1 đếm ngược tới mốc đó | Risk tín dụng, PO |
| D-LIM-02 | Cách chống vượt hạn mức khi đồng thời | Khoá dòng / khoá phân tán + trừ nguyên tử là luồng chính; optimistic là luồng phụ (UC-LIM-02) | Đọc version rồi ghi có điều kiện, xung đột thì đọc lại | Một lệnh `UPDATE … SET available = available − :amt WHERE card_id = :id AND available ≥ :amt` (CAS mức dòng, không giữ khoá lâu); `version` giữ cho thao tác vận hành ở W2. Đáp ứng cả RULE-LIM-02 và SLA | Tech Lead |
| D-LIM-03 | Mã bản tin reversal | MTI 0420 (và 0120 advice) | 0400, quyết định DECLINED | Theo baseline. Log tách loại bản tin (`AUTH`, `REVERSAL`, `ADVICE`) khỏi quyết định | Vận hành thẻ |
| D-LIM-04 | Trạng thái lời mời Boost | Entity Boost chỉ có `ACTIVE`, `EXPIRED`, `LOCKED_SUSPECTED_FRAUD` | Có thêm `OFFERED`, `DECLINED` | Thêm entity `BoostOffer` (`OFFERED`, `ACCEPTED`, `DECLINED`, `EXPIRED`); bổ sung vào BRD §3.5 qua CR | PO |
| D-LIM-05 | Khách tự khoá thẻ ở M3 ("Không phải tôi – khoá thẻ") | BRD chỉ yêu cầu thông báo lý do và hướng dẫn liên hệ khiếu nại (UC-LIM-06 bước 4) | Bấm là khoá thẻ, hẹn tra soát trong 24 giờ | Ngoài phạm vi baseline → lập CR, cần Vận hành thẻ xác nhận quy trình tra soát và cam kết 24 giờ, 30 phút | PO, Vận hành thẻ |
| D-LIM-06 | Circuit breaker | Kích hoạt khi trễ vượt SLA với Card Scheme, timeout budget theo từng bước (BR-LIM-09, RULE-LIM-07) | Một breaker cho kết nối CBS | Breaker riêng cho từng phụ thuộc (CASA, Fraud Engine, Notification) + ngân sách thời gian tổng 2 giây chia theo bước (đề xuất ở [L06](L06-nfr-kpi.md)); W1 hiện trạng thái từng breaker | Tech Lead, Ops |
| D-LIM-07 | Ngưỡng điểm | Ngưỡng Boost, trần %, ngưỡng khoá gian lận do Risk duyệt trước UAT (ASM-03, DEP-12, ACT-02) | UI dùng tạm: khoá khi điểm gian lận ≥ 75; Boost +10 triệu / 80 triệu (12,5%) | Risk chốt 3 số: điểm Boost tối thiểu, trần %, ngưỡng khoá; đóng băng cấu hình trước UAT | Risk tín dụng |
| D-LIM-08 | Khoá Boost thủ công ở W3 | Khoá Boost phải đi cùng thông báo khách (BR-LIM-07) | Khoá ngay, không hỏi lý do, không gửi thông báo; mở khoá thì bắt lý do | Khoá thủ công cũng bắt lý do ≥ 10 ký tự, gửi cùng mẫu thông báo, ghi audit | Risk tín dụng |
| D-LIM-09 | Điều chỉnh hạn mức gốc ở W2 | BRD không có use case điều chỉnh hạn mức thủ công | Một người sửa và lưu ngay | Hoặc bỏ khỏi phạm vi giai đoạn 1, hoặc áp Maker-Checker như Module 2 (người lập ≠ người duyệt) | PO, Risk tín dụng |

## 4. Yêu cầu bổ sung

Viết theo ISO/IEC/IEEE 29148: một ý, kiểm chứng được, có nguồn. Ưu tiên theo MoSCoW. Giá trị in nghiêng là *đề xuất*, chờ người có thẩm quyền chốt.

### 4.1 Authorization và reversal (UC-LIM-01, 02, 05)

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| REQ-LIM-01 | Hệ thống phải nhận diện bản tin trùng theo khoá `stan + rrn + terminal_id + ngày giao dịch (F7)` và trả lại đúng kết quả lần đầu, không trừ hạn mức lần hai. Log và W1 phải hiện RRN. | BR-LIM-03, RULE-LIM-03 · STAN có thể lặp lại theo ngày (*cần Vận hành thẻ xác nhận*) | Must |
| REQ-LIM-02 | Khi hết ngân sách thời gian hoặc không lấy được khoá, hệ thống phải trả 0110 từ chối với một mã F39 riêng cho fail-safe và ghi lý do `TIMEOUT_FAILSAFE`. | UC-LIM-01, 02 luồng ngoại lệ · mã F39 cụ thể *cần xác minh* với tổ chức thẻ | Must |
| REQ-LIM-03 | Reversal không tìm thấy giao dịch gốc theo STAN/RRN phải được đưa vào hàng chờ "Reversal không khớp" trên W1 để vận hành xử lý tay. | UC-LIM-05 luồng ngoại lệ · RSK-10 | Must |
| REQ-LIM-04 | Reversal đến trễ nhưng còn trong cửa sổ hợp lệ vẫn được xử lý và ghi độ trễ so với giao dịch gốc. | UC-LIM-05 luồng phụ · cửa sổ *đề xuất 24 giờ* | Should |

### 4.2 Smart Fallback (UC-LIM-03)

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| REQ-LIM-05 | Hệ thống phải hỗ trợ fallback toàn phần và từng phần theo cấu hình sản phẩm; ghi `fallback_type` và phần trừ vào hạn mức, phần trừ vào CASA. | UC-LIM-03 luồng phụ, BRD §3.5 FallbackTransaction | Should |
| REQ-LIM-06 | Mỗi giao dịch fallback phải sinh bút toán đối ứng thẻ ↔ CASA và phát sự kiện để Module 2 đối chiếu cuối ngày. | UC-LIM-03 bước 3, 4 · BR-LIM-10 | Should |
| REQ-LIM-07 | Khách chỉ bật Smart Fallback cho CASA đứng tên mình và đang hoạt động; tắt có hiệu lực với giao dịch kế tiếp. | UC-LIM-03 tiền điều kiện | Should |

### 4.3 Temporary Limit Boost (UC-LIM-04)

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| REQ-LIM-08 | Số tiền Boost không vượt `boost_percentage` × hạn mức gốc; W3 hiện cả số tiền và %. | BR-LIM-06, RULE-LIM-05 | Should |
| REQ-LIM-09 | Khi Boost hết hạn mà dư nợ lớn hơn hạn mức gốc, hệ thống không tự huỷ giao dịch đã duyệt; khả dụng về 0 và các giao dịch mới bị từ chối cho tới khi khách trả bớt. | RULE-LIM-06 · tình huống biên chưa có trong BRD – *Risk xác nhận* | Should |
| REQ-LIM-10 | Hệ thống không cấp Boost nếu điểm hành vi giảm quá ngưỡng hoặc thẻ có cờ gian lận mở, kể cả khi lần đánh giá trước đã đủ điều kiện. | UC-LIM-04 luồng ngoại lệ | Should |
| REQ-LIM-11 | Màn M2 phải hiện: hạn mức mới, ngày giờ hết hạn, việc tự trở về hạn mức gốc, phí, điều kiện có thể bị khoá; khách phải xác nhận mới nhận được. | BR-LIM-06, CR-003 (minh bạch) · TC-LIM-27 | Must |
| REQ-LIM-12 | Khách có thể chủ động yêu cầu xét Boost sớm hơn kỳ đánh giá. | UC-LIM-04 luồng phụ · chưa có UI | Could |

### 4.4 Giám sát gian lận và thông báo (UC-LIM-06, CR-003)

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| REQ-LIM-13 | Khi khoá Boost (tự động hoặc thủ công), hệ thống phải gửi SMS và App push trong cùng giao dịch nghiệp vụ, lưu `delivery_status` từng kênh. | BR-LIM-07, CR-003 · D-LIM-08 | Must (nếu go-live Boost – DEC-02) |
| REQ-LIM-14 | Gửi thất bại thì tự gửi lại *tối đa 3 lần (sau 1, 5, 15 phút)*; vẫn lỗi thì hiện cảnh báo trên W4 và cho Risk gửi lại tay. | RSK-14 · TC-LIM-21 | Must |
| REQ-LIM-15 | Nội dung thông báo dùng mẫu đã được Risk/Legal/CSKH duyệt, nêu lý do và kênh khiếu nại, không chứa PAN đầy đủ, OTP hay đường link. | UC-LIM-06 bước 4 · ISS-03, ACT-05 | Must |
| REQ-LIM-16 | Khiếu nại của khách về việc bị khoá Boost được chuyển thành case cho Vận hành thẻ. | UC-LIM-06 luồng ngoại lệ | Should |
| REQ-LIM-17 | Đóng case gian lận phải chọn kết luận (`CONFIRMED_FRAUD`, `FALSE_POSITIVE`, `CUSTOMER_CONFIRMED`) và ghi chú, để làm dữ liệu cải thiện mô hình. | UC-LIM-06 hậu điều kiện · TC-LIM-23 | Should |
| REQ-LIM-18 | Người khoá Boost thủ công không được tự mở khoá Boost đó (phân tách nhiệm vụ). | *Đề xuất* theo nguyên tắc SoD của Module 2 | Could |

### 4.5 Bảo mật, đối chiếu cuối ngày

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| REQ-LIM-19 | PAN phải được che (6 số đầu + 4 số cuối hoặc chỉ 4 số cuối) ở mọi màn, file xuất, log, sự kiện và bằng chứng UAT. | NFR-SEC-04, PCI DSS 3.4 · RSK-16 · UAT-LIM-10 | Must |
| REQ-LIM-20 | Mọi giao dịch đã duyệt, reversal và fallback phát sự kiện `limit.authorization.processed` có `messageId` duy nhất; cuối ngày xuất ledger để Module 2 đối chiếu, dòng lệch phải được giải trình. | BR-LIM-10, RULE-LIM-08, KPI-09 · REQ-REC-20 | Should |

## 5. Dữ liệu cần thêm vào mô hình BRD §3.5

Chi tiết từng trường ở [L05 §3](L05-api-data-dictionary.md).

| Entity | Thêm | Lý do |
|---|---|---|
| CardLimitProfile | `boost_amount_active`, `hold_amount`, `fallback_enabled`, `product_code`, `statement_day` | Tính khả dụng = hạn mức + Boost − đã dùng − tạm giữ; tính ngày hết hạn Boost (D-LIM-01) |
| AuthorizationLog | `message_type` (AUTH / REVERSAL / ADVICE), `original_auth_id`, `transmission_date` (F7), `fallback_id`, `decline_reason`; đổi `decision` thành `APPROVE` / `DECLINE` và để fallback thành cờ | D-LIM-03, REQ-LIM-01, 02 |
| FallbackTransaction | `auth_id`, `card_part_amount`, `casa_part_amount`, `hold_ref`, `settled_at`, `released_at` | REQ-LIM-05, 06 |
| TemporaryLimitBoost | `offer_id`, `locked_reason`, `locked_by`, `unlocked_by`, `unlock_reason` | D-LIM-04, 08 · audit |
| *Mới:* BoostOffer | `offer_id`, `card_id`, `score_id`, `amount`, `percentage`, `status`, `offered_at`, `responded_at` | D-LIM-04 |
| *Mới:* FraudCase | `case_id`, `card_id`, `signal`, `score`, `action`, `status`, `conclusion` | REQ-LIM-17 |
| *Mới:* Notification | `notification_id`, `case_id`, `channel`, `template_id`, `delivery_status`, `attempts` | REQ-LIM-13, 14 |

## 6. Ma trận truy vết (RTM)

| BR | UC | RULE | US | REQ | Màn | Ca UI ([L04](L04-test-plan-cases.md)) | Ca backend / SIT / hiệu năng | UAT | Jira |
|---|---|---|---|---|---|---|---|---|---|
| BR-LIM-01 | UC-LIM-01 | RULE-LIM-01 | US-LIM-01 | REQ-LIM-02 | W1 | TC-LIM-01, 02, 08 | TC-LIM-B01, SIT-LIM-01, PERF-LIM-01 | UAT-LIM-P01 | SCRUM-27 |
| BR-LIM-02 | UC-LIM-02 | RULE-LIM-02 | US-LIM-02 | — (D-LIM-02) | W2 | TC-LIM-14, 15 | TC-LIM-B03, PERF-LIM-02 | UAT-LIM-01 | SCRUM-28 |
| BR-LIM-03 | UC-LIM-01 | RULE-LIM-03 | US-LIM-01 | REQ-LIM-01 | W1 | — (UI chưa có RRN) | TC-LIM-B02, SIT-LIM-02 | UAT-LIM-02* | SCRUM-28 |
| BR-LIM-04 | UC-LIM-03 | RULE-LIM-04 | US-LIM-03 | REQ-LIM-05, 06, 07 | M1, W2 | TC-LIM-11, 12, 24, 26 | TC-LIM-B04, SIT-LIM-04, 05 | UAT-LIM-03, 04 | SCRUM-29 |
| BR-LIM-05 | UC-LIM-04 | RULE-LIM-05 | US-LIM-04 | REQ-LIM-10 | W3 | TC-LIM-16 | TC-LIM-B06 | UAT-LIM-P05 | SCRUM-30 |
| BR-LIM-06 | UC-LIM-04 | RULE-LIM-05, 06 | US-LIM-04 | REQ-LIM-08, 09, 11 | M1, M2, W3 | TC-LIM-27 → 30 | TC-LIM-B07 | UAT-LIM-06 | SCRUM-30 |
| BR-LIM-07 | UC-LIM-06 | — | US-LIM-06 | REQ-LIM-13 → 18 | W3, W4, M3 | TC-LIM-17 → 23, 31 → 33 | TC-LIM-B08, SIT-LIM-07, 08 | UAT-LIM-07 | SCRUM-30, 54 |
| BR-LIM-08 | UC-LIM-05 | — | US-LIM-05 | REQ-LIM-03, 04 | W1 | TC-LIM-07 | TC-LIM-B05, SIT-LIM-03 | UAT-LIM-05 | SCRUM-27 |
| BR-LIM-09 | UC-LIM-01 | RULE-LIM-07 | — | — (D-LIM-06) | W1 | TC-LIM-03 | TC-LIM-B09, PERF-LIM-04 | UAT-LIM-09* | SCRUM-27 |
| BR-LIM-10 | — | RULE-LIM-08 | — | REQ-LIM-20 | Báo cáo EOD | — | TC-LIM-B10, SIT-LIM-09 | UAT-LIM-08 | SCRUM-53, 38 |
| NFR-SEC-04 | — | — | — | REQ-LIM-19 | Mọi màn | TC-LIM-04, 22, 25 | SIT-LIM-10 | UAT-LIM-10 | SCRUM-51, 52 |

\* UAT-LIM-02 và UAT-LIM-09 chưa thấy nội dung trong các nguồn hiện có (BAS-UTR-v1.2 chưa có trên Confluence). L07 điền nội dung *đề xuất*; **cần đối chiếu BAS-UTR-v1.2**.

Mã ca backend (TC-LIM-Bxx) ở [L04 §4](L04-test-plan-cases.md); SIT, PERF và UAT ở [L07](L07-sit-perf-uat.md).

## 7. Câu hỏi mở

| # | Câu hỏi | Người trả lời | Ảnh hưởng |
|---|---|---|---|
| 1 | Mã nguồn `limit-service` của SCRUM-27 → 30, 38 nằm ở đâu? Story có đúng trạng thái Testing / Done? | Tech Lead | Kế hoạch SIT ([L07](L07-sit-perf-uat.md)) |
| 2 | Chu kỳ sao kê theo ngày cố định của thẻ hay theo sản phẩm? Boost cấp sát ngày chốt có được kéo sang kỳ sau? | Risk tín dụng | D-LIM-01 |
| 3 | F39 nào dùng cho từ chối fail-safe khi hết thời gian? | Vận hành thẻ | REQ-LIM-02 |
| 4 | Fallback từng phần có áp dụng cho sản phẩm thẻ giai đoạn 1? | Product | REQ-LIM-05 |
| 5 | Dư nợ vượt hạn mức gốc khi Boost hết hạn xử lý thế nào (phí vượt hạn mức?) | Risk tín dụng, Pháp chế | REQ-LIM-09 |
| 6 | Nội dung UAT-LIM-02 và UAT-LIM-09 trong BAS-UTR-v1.2 | QA Lead | RTM §6 |

## 8. Kiểm soát tài liệu

### Lịch sử phiên bản

| Phiên bản | Ngày | Người sửa | Commit | Thay đổi |
|---|---|---|---|---|
| 0.2 | 26/11/2026 | Han Dao | — | Thêm L08 vào bản đồ tài liệu; yêu cầu tuân thủ REQ-LIM-21 → 26 ở L08 §5 chờ duyệt để chuyển vào §4 |
| 0.1 | 25/11/2026 | Han Dao | `273d6b3` | Bản đầu: đánh giá 10 BR, 9 điểm lệch, 20 yêu cầu bổ sung, dữ liệu cần thêm, RTM, câu hỏi mở |

### Phê duyệt

| Vai trò | Người | Ngày | Kết luận |
|---|---|---|---|
| BA (soạn) | Han Dao | 25/11/2026 | Trình duyệt |
| Product Owner | | | |
| Risk tín dụng | | | |
| Vận hành thẻ | | | |
| Tech Lead | | | |
| InfoSec | | | |
