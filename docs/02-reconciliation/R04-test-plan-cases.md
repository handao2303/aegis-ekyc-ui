# R04 · Đối soát – kế hoạch kiểm thử, test case và kết quả vòng 1

| | |
|---|---|
| Epic | [SCRUM-7](https://baohandao2303.atlassian.net/browse/SCRUM-7) · story SCRUM-22 → 26, 49, 50, 53 |
| Khung tài liệu | ISO/IEC/IEEE 29119-3:2021 – gộp Test Plan, Test Case Specification và Test Completion Report cho một module nhỏ |
| Đối tượng kiểm thử | UI mẫu [/reconciliation/](https://handao2303.github.io/aegis-ekyc-ui/reconciliation/) bản trên GitHub Pages ngày 24/11/2026 |
| Yêu cầu nguồn | BAS-BRD-v1.2 §2.2, §4.2, §5.2 · [R01](R01-reconciliation-flow.md) · [R02](R02-requirements-gap-rtm.md) |
| Người thực hiện | Han Dao (BA) |
| Phiên bản | 1.0 · 24/11/2026 |

## 1. Tóm tắt kết quả

| | Số ca |
|---|---|
| Ca giao diện đã chạy | 20 |
| Đạt | **15** |
| Không đạt | **5** |
| Ca backend chưa chạy được (chưa có `reconciliation-service`) | 9 |
| Lỗi ghi nhận | 6 (2 High · 4 Medium) |

**Kết luận:** UI mẫu thể hiện đúng các kiểm soát chính của baseline: chặn Maker tự duyệt, ngưỡng 50 triệu, cách ly file lỗi, truy vết 4 bước, nhãn thời điểm dữ liệu. Có 2 lỗi High ở luồng xử lý ngoại lệ (DEF-REC-01, 06) cần sửa trước khi dùng UI làm mẫu cho đội backend. Module 2 **chưa đủ điều kiện vào SIT/UAT** vì chưa có backend.

## 2. Kế hoạch

### 2.1 Phạm vi

| Trong phạm vi | Ngoài phạm vi (vòng này) |
|---|---|
| 6 màn REC-01 → REC-06: hiển thị, điều hướng, quy tắc chặn trên giao diện | Nạp file thật, engine khớp, hạch toán vào sổ cái, hiệu năng – chưa có backend |
| Kiểm soát SoD, ngưỡng Maker-Checker, truy vết, trạng thái ngoại lệ | Đối chiếu chéo EOD với Hạn mức (SCRUM-53) |
| | Phân quyền nhiều vai trò – UI mẫu chỉ có một người dùng |

### 2.2 Cách làm

| Hạng mục | Cách làm |
|---|---|
| Kỹ thuật thiết kế ca | Dựa trên use case (UC-REC-01 → 06), bảng quyết định cho ngưỡng 50 triệu, chuyển trạng thái cho ngoại lệ và bút toán |
| Thực thi | Tự động bằng Chrome headless, script `tools/diagrams/rec-screens.mjs` (vừa chạy ca vừa chụp ảnh cho R03). Chạy lại: `node rec-screens.mjs ../../public/ui` |
| Dữ liệu | Dữ liệu hư cấu có sẵn trong UI mẫu (5 nguồn, 5 quy tắc, 5 ngoại lệ, 5 bút toán). Người dùng đăng nhập là "Lê Hoàng Nam" |
| Môi trường | macOS, Chrome headless, cửa sổ 1280 × 860, tiếng Việt |

### 2.3 Điều kiện vào / ra

| | Tiêu chí |
|---|---|
| Vào vòng UI | Bản UI đã deploy lên GitHub Pages ✅ |
| Ra vòng UI | 100% ca giao diện đã chạy ✅ · mọi lỗi có mã và mức độ ✅ |
| Vào SIT | Có `reconciliation-service`, file mẫu Napas (ISS-01), quyết định D-REC-01 → 06 (R02 §3), 0 lỗi High mở ❌ |

## 3. Test case giao diện và kết quả

| Mã | Màn | Bước | Kết quả mong đợi | Kết quả thực tế | KQ | Truy vết |
|---|---|---|---|---|---|---|
| TC-REC-01 | REC-01 | Mở trang | Có 4 thẻ: Tỷ lệ khớp tự động, MTTR, Giá trị chưa khớp, Zero-touch | Đủ 4 thẻ | ✅ | BR-REC-09 |
| TC-REC-02 | REC-01 | Xem bảng nạp nguồn | Có nhãn "Cập nhật lúc HH:MM" | "Cập nhật lúc 10:05 · 21/11/2026" | ✅ | UAT-REC-09 |
| TC-REC-03 | REC-01 | Xem dòng Cổng ví điện tử | Trạng thái Cách ly, có lý do | "Cách ly · File lỗi định dạng – đã cách ly" | ✅ | UAT-REC-02 |
| TC-REC-04 | REC-01 | Xem dòng Visa settlement | Nguồn trễ lịch được đánh dấu | "Trễ · Trễ 3h so với lịch 07:00" | ✅ | UC-REC-01 |
| TC-REC-05 | REC-02 | Bấm Duyệt MR-004 (do chính mình tạo) | Bị chặn, nêu lý do SoD | "Không thể duyệt MR-004: bạn là người tạo quy tắc" | ✅ | REQ-REC-09 |
| TC-REC-06 | REC-03 | Tạo quy tắc, chọn Checker là chính mình | Banner SoD, nút Gửi duyệt bị khoá | Có banner, nút bị khoá | ✅ | UAT-REC-08 |
| TC-REC-07 | REC-03 | Chọn Checker khác, Gửi duyệt | Quy tắc mới ở Chờ duyệt, version 1 | "MR-006 · Chờ duyệt · v1" | ✅ | UC-REC-02 |
| TC-REC-08 | REC-04 | Mở danh sách | Mặc định chỉ hiện ngoại lệ đang mở | 4 ngoại lệ, không có EXC-1120 (đã xử lý) | ✅ | UC-REC-04 |
| TC-REC-09 | REC-04 | Xem cột | Mỗi dòng có aging và gợi ý AI kèm % | Có | ✅ | BR-REC-05 |
| TC-REC-10 | REC-05 | Mở EXC-1125 (52 giờ, hạn 48 giờ) | Cảnh báo quá hạn, trạng thái Leo thang | "Quá hạn xử lý 4 giờ", `ESCALATED` | ✅ | RULE-REC-06 (theo SLA của R01 – xem D-REC-03) |
| TC-REC-11 | REC-05 | Xem truy vết EXC-1125 | 4 bước; bước thiếu đối ứng ghi rõ | FT2611080017 → "Không tìm thấy đối ứng" → EXC-1125 → GL-90313 · PENDING | ✅ | UAT-REC-10 |
| TC-REC-12 | REC-05 | Tìm cách chọn nguyên nhân khác top-3 | Có lựa chọn "Khác" / danh mục chuẩn | Chỉ có 3 gợi ý | ❌ DEF-REC-04 | REQ-REC-01 |
| TC-REC-13 | REC-05 | EXC-1125 (125 triệu) → Xử lý & hạch toán | Bút toán ở trạng thái chờ Checker, không tự post | Bút toán mới `PENDING` | ✅ | UAT-REC-07, RULE-REC-04 |
| TC-REC-14 | REC-05 | EXC-1127 (18.000 ₫) → Xử lý & hạch toán | Bút toán zero-touch `POSTED` | Bút toán mới `POSTED` | ✅ | RULE-REC-04 |
| TC-REC-15 | REC-05 | Tìm cách xử lý khác hạch toán | Có khớp thủ công / yêu cầu chứng từ | Chỉ có "Xử lý & hạch toán" | ❌ DEF-REC-05 | REQ-REC-02 |
| TC-REC-16 | REC-06 | Bấm Duyệt GL-90314 (Maker là mình) | Bị chặn | "Không thể duyệt GL-90314: bạn là Maker của bút toán này" | ✅ | BR-REC-07 |
| TC-REC-17 | REC-06 | Bấm Duyệt GL-90313 (Maker khác) | Đã hạch toán, ghi Checker | "Đã duyệt và hạch toán GL-90313" | ✅ | UC-REC-05 |
| TC-REC-18 | REC-06 | Bấm Từ chối GL-90313 | Bắt nhập lý do | Từ chối ngay, không hỏi lý do | ❌ DEF-REC-02 | REQ-REC-05 |
| TC-REC-19 | REC-06 | Tìm nút trả về Maker | Có "Trả về Maker" kèm ghi chú | Chỉ có Duyệt / Từ chối | ❌ DEF-REC-03 | REQ-REC-06 |
| TC-REC-20 | REC-05 | EXC-1125 đã có GL-90313 chờ duyệt → bấm Xử lý & hạch toán | Không tạo bút toán thứ hai | Tạo thêm bút toán `PENDING` thứ hai cho cùng ngoại lệ | ❌ DEF-REC-01 | REQ-REC-08, BR-REC-06 |

## 4. Test case backend – chưa chạy

Viết sẵn để đội backend dùng khi có `reconciliation-service`. Kết quả: ⏸ chưa chạy.

| Mã | Kịch bản | Kết quả mong đợi | Truy vết |
|---|---|---|---|
| TC-REC-B01 | Nạp file camt.053 hợp lệ | SourceTransaction đủ trường chuẩn hoá, `dq_status = VALID` | US-REC-01, UAT-REC-01 |
| TC-REC-B02 | Nạp cùng file 2 lần; nạp file sai định dạng | Lần 2 không tạo bản ghi mới, log ghi số bản ghi trùng; file sai → `QUARANTINED`, cảnh báo vận hành | REQ-REC-13, 14, UAT-REC-02 |
| TC-REC-B03 | 2 giao dịch trùng `reference_no + amount + currency` | `MATCHED` ngay, không gọi Fuzzy | RULE-REC-02 |
| TC-REC-B04 | Fuzzy: điểm 0.951 / 0.949; 2 ứng viên 0.961 và 0.955 | 0.951 `MATCHED`; 0.949 → ngoại lệ; 2 ứng viên gần nhau → `PARTIAL` | RULE-REC-01, REQ-REC-16 |
| TC-REC-B05 | Lô N:1 200 giao dịch, giới hạn tìm 2 giây | Dừng ≤ 2 giây, tạo ngoại lệ | RULE-REC-03, REQ-REC-15 |
| TC-REC-B06 | Gọi API tạo GLEntry Nợ ≠ Có; UPDATE bút toán đã post | Cả hai bị từ chối | RULE-REC-08, REQ-REC-11 |
| TC-REC-B07 | Người tạo MR-003 duyệt điều chỉnh 80 triệu sinh từ MR-003 | Bị chặn theo RULE-REC-05 | REQ-REC-07, DEC-01 (bút toán 80 triệu) |
| TC-REC-B08 | API truy vết với `entry_id`, `case_id`, `txn_id`; dữ liệu có bản ghi mồ côi | Trả đủ chuỗi; bản ghi thiếu khoá bị báo lỗi | REQ-REC-19, UAT-REC-10 |
| TC-REC-B09 | Gửi lại `limit.authorization.processed` cùng `messageId`; chạy EOD | 0 GLEntry trùng; báo cáo sai lệch = 0 hoặc có người phụ trách, độ trễ < 10 giây | REQ-REC-20, UAT-LIM-08 |

## 5. Lỗi ghi nhận

| Mã | Mức | Mô tả | Cách tái hiện | Đề xuất sửa |
|---|---|---|---|---|
| DEF-REC-01 | High | Một ngoại lệ có thể sinh nhiều bút toán điều chỉnh. Nút "Xử lý & hạch toán" vẫn bấm được khi ngoại lệ đã có bút toán chờ duyệt | TC-REC-20: mở EXC-1125 (đã có GL-90313 `PENDING`) → bấm Xử lý & hạch toán → có thêm một bút toán 125 triệu | Khoá nút và chỉ ra bút toán đang chờ (REQ-REC-08) |
| DEF-REC-06 | High | Ngoại lệ chuyển "Đã xử lý" ngay khi tạo bút toán > 50 triệu, trước khi Checker duyệt. Nếu Checker từ chối, chênh lệch không còn trong danh sách đang mở | Đọc mã `resolve()` trong `src/ops/Reconciliation.tsx`: luôn đặt `status: "RESOLVED"` dù bút toán vừa tạo là `PENDING`. Vì REC-04 mặc định ẩn ngoại lệ đã xử lý, EXC-1125 sẽ rời danh sách đang mở | Thêm trạng thái `PENDING_POSTING`, chỉ đóng khi bút toán `POSTED`; từ chối → mở lại ngoại lệ (R02 §5) |
| DEF-REC-02 | Medium | Từ chối bút toán không bắt nhập lý do | TC-REC-18 | Hộp thoại lý do ≥ 10 ký tự (REQ-REC-05) |
| DEF-REC-03 | Medium | Checker không trả bút toán về Maker được | TC-REC-19 | Nút "Trả về Maker" + ghi chú (REQ-REC-06) |
| DEF-REC-04 | Medium | Không chọn được nguyên nhân ngoài 3 gợi ý của AI | TC-REC-12 | Danh mục chuẩn + "Khác" (REQ-REC-01) |
| DEF-REC-05 | Medium | Mọi ngoại lệ chỉ xử lý được bằng hạch toán điều chỉnh, kể cả `DUPLICATE` và `UNMATCHED` chờ dữ liệu T+1 | TC-REC-15 | Thêm khớp thủ công và yêu cầu chứng từ (REQ-REC-02) |

DEF-REC-06 phát hiện khi đọc mã nguồn và đối chiếu với kết quả TC-REC-13; script chưa có bước kiểm tra riêng cho lỗi này.

## 6. Độ phủ yêu cầu

| BR | Ca UI | Đạt | Ca backend | Ghi chú |
|---|---|---|---|---|
| BR-REC-01 | 2 | 2 | 2 | Chỉ kiểm tra hiển thị trạng thái nạp |
| BR-REC-02 | 3 | 3 | — | |
| BR-REC-03, 04 | 0 | — | 3 | Cần engine khớp |
| BR-REC-05 | 5 | 3 | — | DEF-REC-04, 05 |
| BR-REC-06 | 1 | 0 | 1 | DEF-REC-01 |
| BR-REC-07 | 6 | 4 | — | DEF-REC-02, 03 |
| BR-REC-08 | 0 | — | 1 | RULE-REC-05 đúng nghĩa baseline chưa có trên UI (D-REC-04) |
| BR-REC-09 | 2 | 2 | — | |
| BR-REC-10 | 1 | 1 | 1 | |

## 7. Việc tiếp theo

1. Sửa DEF-REC-01 và DEF-REC-06 trên UI mẫu, chạy lại script.
2. Kế toán trưởng chốt D-REC-01 → 06 (R02 §3) để sửa trạng thái và aging trên UI cho khớp.
3. Khi có `reconciliation-service`: chạy TC-REC-B01 → B09, lập báo cáo vòng 2.

## Lịch sử phiên bản

| Phiên bản | Ngày | Người | Thay đổi |
|---|---|---|---|
| 1.0 | 24/11/2026 | Han Dao | Kế hoạch, 20 ca UI đã chạy (15 đạt), 9 ca backend viết sẵn, 6 lỗi |
