# G01 · Rà soát theo từng vai trò

| | |
|---|---|
| Mã tài liệu | AEG-GEN-G01 |
| Phiên bản | 1.2 |
| Ngày phát hành | 26/11/2026 |
| Trạng thái | ✅ Rà soát nội bộ xong · không thay thế phê duyệt |
| Phân loại | Nội bộ |
| Tác giả | Han Dao (BA) |
| Người duyệt | Product Owner – chưa duyệt |
| Mục đích và phạm vi | Ghi lượt rà soát từ góc nhìn từng vai trò (PO, Compliance, QA, Tech Lead, InfoSec, Kế toán, Risk) để người duyệt thật có sẵn phát hiện |
| Chuẩn tham chiếu | IIBA BABOK v3 §5.5 (Approve Requirements), §7.2 (Verify Requirements) · ISO/IEC/IEEE 29148:2018 §5.2.5 (đặc tính bộ yêu cầu) · ISO/IEC 20246:2017 (review sản phẩm phần mềm) |
| Thuật ngữ | [G02 Thuật ngữ và chữ viết tắt](G02-glossary.md) |
| Phạm vi | Cả 3 module (eKYC, Đối soát, Hạn mức), tài liệu `docs/`, mã `src/`, `server/`, `services/reconciliation/` tại ngày 26/11/2026 |

## 1. Vì sao có tài liệu này

Aegis là dự án cá nhân: một người làm mọi vai. Bảng **Phê duyệt** cuối mỗi tài liệu vẫn **để trống**, vì chính các tài liệu này đặt quy tắc phân tách nhiệm vụ: Maker không tự duyệt (BR-REC-07, RULE-REC-05, RULE-EKYC-13). Tự ký ở mọi vai sẽ mâu thuẫn với quy tắc đó.

Thay vào đó, tài liệu này ghi lại **một lượt rà soát từ góc nhìn từng vai**, người thực hiện là *Han Dao (kiêm nhiệm)*. Mục đích là để người duyệt thật về sau có sẵn danh sách câu hỏi và phát hiện, theo kiểu review của ISO/IEC 20246.

Quy ước kết luận: ✅ chấp nhận · 🟡 chấp nhận có điều kiện · ⛔ chưa chấp nhận. Phát hiện đánh mã `G-<vai>-<số>`.

## 2. Tổng hợp

| Vai | Kết luận | Phát hiện mở | Chặn go-live |
|---|---|---|---|
| Product Owner | 🟡 | 4 | G-PO-01 (Hạn mức chưa có backend) |
| Compliance / Pháp chế | 🟡 | 4 | G-CO-01, G-CO-02 |
| QA Lead | 🟡 | 5 | G-QA-01 (SIT với sandbox thật) |
| Tech Lead / Kiến trúc sư | 🟡 | 4 (+1 chấp nhận có điều kiện) | G-TL-01 |
| InfoSec / DPO | 🟡 | 3 | — (G-SE-01 đã sửa 26/11) |
| Kế toán trưởng | 🟡 | 3 | G-KT-01 (danh mục tài khoản GL) |
| Risk tín dụng / Vận hành thẻ | 🟡 | 3 | G-RK-01 (thời hạn Boost) |

## 3. Product Owner

| Mã | Phát hiện | Bằng chứng | Đề xuất | Trạng thái |
|---|---|---|---|---|
| G-PO-01 | Module 3 Hạn mức chỉ có UI mẫu, chưa có `limit-service`; mọi ca backend L04 đang chờ | L04 trạng thái "⛔ ca backend chờ `limit-service`" | Ưu tiên `limit-service` cho sprint kế tiếp, dùng R05 / service Đối soát làm khuôn | Mở |
| G-PO-02 | Các KPI mục tiêu (khớp tự động ≥ 95%, MTTR ≤ 4 giờ, zero-touch ≥ 30%) mới là đề xuất | R01 §7, R06 | PO chốt mục tiêu trước UAT | Mở |
| G-PO-03 | 9 điểm lệch baseline Đối soát (D-REC-01 → 09) và 9 điểm Hạn mức (D-LIM) chưa có quyết định | R02 §3, L02 §3 | Họp quyết định một lần với Kế toán trưởng, Risk | Mở |
| G-PO-04 | Biểu đồ xu hướng REC-01 vẫn là số mẫu khi đã nối backend (UI có ghi rõ) | Màn REC-01 – nhãn "Xu hướng mẫu" | Thêm API lịch sử KPI theo ngày | Mở |
| — | Module 2 có backend chạy thật, SoD kiểm ở server, 56 test tự động | R04 §4 | — | ✅ |

## 4. Compliance / Pháp chế

| Mã | Phát hiện | Bằng chứng | Đề xuất | Trạng thái |
|---|---|---|---|---|
| G-CO-01 | Còn 3 yêu cầu pháp lý chặn go-live eKYC: CR-02 (nguồn sinh trắc), CR-12 (thời hạn lưu), CR-14 (tuổi tối thiểu, dữ liệu trẻ em) | C02 §2 | Pháp chế trả lời câu hỏi 1 → 3 của C02 | Mở |
| G-CO-02 | Số điều, ngày hiệu lực của văn bản viện dẫn đang đánh dấu *cần xác minh* | C02 §1, P01 mục 0, R08, L08 | Đối chiếu vbpl.vn / sbv.gov.vn trước khi đưa vào BRD | Mở |
| G-CO-03 | Thời hạn lưu chứng từ đối soát và bút toán chưa có căn cứ chốt; service hiện không xoá bút toán, audit | R05 §4.3, README service | Kế toán trưởng + Pháp chế xác nhận theo Luật Kế toán 2015 (*cần xác minh số năm*) | Mở |
| G-CO-04 | Gợi ý nguyên nhân ngoại lệ là luật viết tay, chưa phải AI – cần nói rõ với người dùng khi gọi là "AI gợi ý" | `engine.ts` `suggestCauses` | Đổi nhãn UI thành "Gợi ý" tới khi có mô hình thật, hoặc ghi chú trong R03 | Mở |

## 5. QA Lead

| Mã | Phát hiện | Bằng chứng | Đề xuất | Trạng thái |
|---|---|---|---|---|
| G-QA-01 | Chưa có SIT với sandbox thật (NAPAS, Visa, Mastercard, CIC, AML, CBS) | C16, R07, L07 | Lập lịch SIT khi có DEP-01 → 04 | Mở |
| G-QA-02 | Module 1 còn 2 ca một phần: VoiceOver (NFR-07), Edge / Safari (NFR-13) | T03 §3.7 | Chạy trên iPhone và Safari / Edge | Mở |
| G-QA-03 | Module 3 vòng 2: 34/36 đạt, 6 lỗi mở (1 High · 4 Medium · 1 Low) | L04 | Sửa DEF-LIM High trước UAT | Mở |
| G-QA-04 | Chưa đo hiệu năng engine Đối soát với khối lượng thật; test chỉ chứng minh giới hạn 2 giây của N:1 | R04 §7 mục 4 | Kịch bản k6 / tập 1 triệu giao dịch | Mở |
| G-QA-05 | Kết quả end-to-end qua UI (R04 §4.3) chạy tay, chưa tự động | R04 §4.3 | Thêm script Puppeteer chạy với service thật | Mở |
| — | Bộ test Module 2: UI 25/25, backend 56/56, hồi quy Module 1 không đổi | R04, T03 | — | ✅ |

## 6. Tech Lead / Kiến trúc sư

| Mã | Phát hiện | Bằng chứng | Đề xuất | Trạng thái |
|---|---|---|---|---|
| G-TL-01 | Hai service dùng SQLite (`node:sqlite`, còn experimental) – phù hợp demo, chưa phải production | `server/`, `services/reconciliation/` | Chuyển Cloud SQL Postgres như A01 §2; lược đồ đã giới hạn ở kiểu dùng chung | Mở |
| G-TL-02 | D-LIM-02 (cách kiểm soát đồng thời trừ hạn mức) chưa chốt | L01 §1, L02 §3 | Chốt trước khi viết `limit-service` | Mở |
| G-TL-03 | Engine khớp gán tham lam theo thời gian; chưa tối ưu toàn cục khi nhiều giao dịch nội bộ tranh một đối ứng | `engine.ts` ghi chú đầu file | Chấp nhận cho giai đoạn 1; ca tranh chấp rơi về `PARTIAL` cho người xử lý | Chấp nhận có điều kiện |
| G-TL-04 | Job nền chạy bằng `setInterval` trong tiến trình | `main.ts` hai service | Production dùng Cloud Scheduler gọi từng job | Mở |
| G-TL-05 | Phong bì sự kiện giữa 3 module mới là đề xuất | X01 §4, R05 §5.8, L05 §5.6 | Tech Lead hai đội chốt | Mở |

## 7. InfoSec / DPO

| Mã | Phát hiện | Bằng chứng | Đề xuất | Trạng thái |
|---|---|---|---|---|
| G-SE-01 | **ekyc-service tin header `x-staff-id` và trả CORS cho mọi origin kể cả khi `NODE_ENV=production`** – ai biết mã nhân viên có thể giả danh Compliance Checker | `server/src/http.ts` dòng CORS và `staffId` | Production bắt buộc `GATEWAY_SHARED_SECRET`; `x-staff-id` chỉ được tin khi có `x-gateway-auth` đúng, không thì API nhân viên trả 401; CORS theo `ALLOWED_ORIGINS`. Phiên khách vẫn dùng `x-session-token` | ✅ Đã sửa 26/11 – test "G-SE-01 production" (59/59) |
| — | `reconciliation-service` đã chặn: thiếu bí mật Gateway → không khởi động; thiếu header → 401; CORS theo danh sách | Test "Bảo mật production…" | — | ✅ Đã sửa 26/11 |
| G-SE-02 | Salt băm số định danh có giá trị mặc định trong code (`aegis-dev-salt`) | `server/src/main.ts` | Production bắt buộc biến môi trường, không có giá trị mặc định | Mở |
| G-SE-03 | Phân loại số tài khoản, lịch sử giao dịch theo NĐ 356/2025 chưa có trả lời của DPO | D01 câu hỏi 4, R05 §3 | DPO xác nhận; nếu là dữ liệu nhạy cảm thì mã hoá cột (`enc`) | Mở |
| G-SE-04 | Audit chỉ thêm, bút toán `POSTED` bất biến bằng trigger; nhưng quyền DB role của service chưa tách | `db.ts` trigger | Production thu hồi `UPDATE`/`DELETE` ở DB role (C10 §3) | Mở |

## 8. Kế toán trưởng

| Mã | Phát hiện | Bằng chứng | Đề xuất | Trạng thái |
|---|---|---|---|---|
| G-KT-01 | Mã tài khoản GL (`1131.xx`, `4211.xx`, `6311.xx`) là ví dụ | R05 §3.6, `config.ts` | Cung cấp danh mục và quy tắc định khoản theo loại điều chỉnh | Mở |
| G-KT-02 | Ngưỡng 50 triệu giữ theo baseline vì CR-002 chưa duyệt; đổi ngưỡng đã qua Maker-Checker | RULE-REC-04, test cấu hình | Quyết định CR-002 | Mở |
| G-KT-03 | Bút toán tự động từ sự kiện Hạn mức cũng áp ngưỡng 50 triệu (đề xuất theo hướng an toàn) | README service | Xác nhận hoặc miễn cho bút toán hệ thống | Mở |
| G-KT-04 | Ý nghĩa RULE-REC-05 đã giữ đúng BRD (người tạo / sửa quy tắc không duyệt bút toán lớn sinh từ quy tắc đó) và kiểm ở server | R02 D-REC-04, TC-REC-B07 | — | ✅ |

## 9. Risk tín dụng / Vận hành thẻ

| Mã | Phát hiện | Bằng chứng | Đề xuất | Trạng thái |
|---|---|---|---|---|
| G-RK-01 | Boost hết hạn sau 72 giờ trên UI, baseline là sau chu kỳ sao kê (D-LIM-01) | L01 §4 | Risk chốt | Mở |
| G-RK-02 | Mẫu thông báo khoá Boost là bản giữ chỗ | L01 §5, L08 §4.3 | Risk, Legal, CSKH duyệt nội dung | Mở |
| G-RK-03 | Reversal trên UI mẫu ghi MTI 0400 thay vì 0420 (DEF-LIM-01) | L04 | Sửa khi viết `limit-service` | Mở |

## 10. Việc tiếp theo

1. Viết `limit-service` (G-PO-01), sau khi chốt D-LIM-02 (G-TL-02).
2. Gửi tài liệu này cùng bảng câu hỏi mở cho người duyệt thật khi dự án có người đảm nhiệm các vai.

## 11. Kiểm soát tài liệu

### Tài liệu tham chiếu

Không tham chiếu tài liệu khác trong bộ.

Chuẩn quốc tế: xem trường *Chuẩn tham chiếu* ở đầu trang.

### Lịch sử phiên bản

| Phiên bản | Ngày | Người sửa | Commit | Thay đổi |
|---|---|---|---|---|
| 1.0 | 26/11/2026 | Han Dao | `263a89f` | Bản đầu: rà soát 7 vai, 29 phát hiện (27 mở, 1 chấp nhận có điều kiện, 1 đạt), tổng hợp chặn go-live |
| 1.1 | 26/11/2026 | Han Dao | — | G-SE-01 đã sửa ở ekyc-service; còn 26 phát hiện mở |
| 1.2 | 26/11/2026 | Han Dao | — | Chuẩn hoá cấu trúc theo ISO/IEC/IEEE 15289: khối thuộc tính đầu trang, tài liệu tham chiếu, thuật ngữ dùng chung (G02), mục kiểm soát tài liệu thống nhất |

### Phê duyệt

Để trống có chủ đích – xem §1.

| Vai trò | Người | Ngày | Kết luận |
|---|---|---|---|
| BA (soạn) | Han Dao | 26/11/2026 | Trình duyệt |
| Product Owner |  |  |  |
