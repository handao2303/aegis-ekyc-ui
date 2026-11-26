# T02 · Bộ test case chi tiết – Module 1 eKYC

| | |
|---|---|
| Phiên bản | 1.1 · 25/11/2026 · Han Dao (BA) |
| Trạng thái | ✅ Bộ 108 case · chờ QA Lead duyệt |
| Kế hoạch | [T01](T01-test-plan.md) · kết quả chạy: [T03](T03-test-report.md) |
| Dữ liệu | Hồ sơ mẫu TD-01 → TD-16 (`server/src/personas.ts`), nhân viên `u-anh`, `u-yen` (Officer), `u-huy` (Trưởng nhóm), `u-trang` (CS) |
| Môi trường | `npm run dev:all`; app `/app/`, Compliance `/compliance/`; đặt lại dữ liệu `POST /api/dev/reset` |
| Tổng | 42 app khách · 32 Compliance · 12 API · 6 job nền · 16 phi chức năng = **108 test case** (25/11: thêm TC-APP-42, TC-CO-32 cho tuổi tối thiểu 16) |
| Chuẩn tham chiếu | ISO/IEC/IEEE 29119-3:2021 (Test Case Specification), ISO/IEC/IEEE 29119-4 (kỹ thuật thiết kế) – đánh giá ở [Q01](../../00-overview/Q01-standards-conformance.md) |

**Ưu tiên:** C = Cao (chặn phát hành) · TB = Trung bình · T = Thấp.
**Cách chạy:** **Tự động** = có test trong `server/test` (tên test ghi trong cột) · **E2E** = chạy tay trên app/trình duyệt · **Cả hai**.

## 1. App khách hàng (TC-APP)

### 1.1 Đồng ý điều khoản – eKYC-01

| Mã | Kịch bản | Dữ liệu / tiền điều kiện | Bước | Kết quả mong đợi | ƯT | Truy vết | Cách chạy |
|---|---|---|---|---|---|---|---|
| TC-APP-01 | Chưa chọn đủ mục bắt buộc | Mở `/app/`, bấm Bắt đầu | 1. Chỉ chọn 1 mục bắt buộc | Nút chính bị khoá, chữ "Chọn 2 mục bắt buộc" | C | SCRUM-17 | E2E |
| TC-APP-02 | Đồng ý đủ mục bắt buộc | TD-01 | 1. Chọn 2 mục bắt buộc 2. Đồng ý và tiếp tục | Sang eKYC-02; backend tạo phiên `CREATED → CONSENTED`, lưu 2 bản ghi đồng ý | C | SCRUM-17 | Cả hai (*HTTP · TD-01 đi hết luồng*) |
| TC-APP-03 | Chọn thêm mục ưu đãi | TD-03 | 1. Chọn cả 3 mục 2. Đồng ý | Bảng `consents` có thêm `marketing = GRANTED` | TB | CR-05 | E2E |
| TC-APP-04 | Xem điều khoản | — | 1. Bấm "Điều khoản và điều kiện" 2. Bấm Đã đọc / phím Esc | Hộp thoại 8 mục, phiên bản 2026.11, hiệu lực 01/11/2026; đóng được | TB | P01 | E2E |
| TC-APP-05 | Gọi API thiếu mục bắt buộc | Phiên mới | `POST /consent` chỉ có `identity` | 422 `CONSENT_REQUIRED` | C | CR-05 | Tự động (*Consent: thiếu mục bắt buộc → 422*) |
| TC-APP-06 | Điều khoản đổi khi phiên đang dở | TD-01 đã đồng ý; đổi `terms_version` | 1. Bỏ dở > 30 phút 2. Tiếp tục hồ sơ | Màn eKYC-01R; đồng ý lại xong quay về đúng bước | C | SCRUM-46, UAT-03 | Tự động (*UAT-EKYC-03*) |

### 1.2 Giấy tờ – eKYC-02 → 05

| Mã | Kịch bản | Dữ liệu | Bước | Kết quả mong đợi | ƯT | Truy vết | Cách chạy |
|---|---|---|---|---|---|---|---|
| TC-APP-07 | Màn chọn giấy tờ | — | Mở eKYC-02 | 3 lựa chọn, mặc định CCCD gắn chip; ghi chú CMND/CCCD không chip ra quầy | TB | SCRUM-47 | E2E |
| TC-APP-08 | Luồng hộ chiếu | TD-15 | 1. Chọn Hộ chiếu gắn chip 2. Chụp 3. Dùng ảnh | Hiện ghi chú người nước ngoài; tiêu đề "Trang thông tin hộ chiếu"; **không** có bước mặt sau, sang thẳng eKYC-05 | C | C05 | E2E |
| TC-APP-09 | Camera bị chặn / không có | Trình duyệt chặn camera hoặc mở qua HTTP | Mở eKYC-03 | Thông báo "Chưa có quyền dùng camera…", nút Thử lại, ảnh minh hoạ; vẫn chụp và đi tiếp được | C | SCRUM-18 | E2E |
| TC-APP-10 | Nút chụp chờ căn chỉnh | — | Mở eKYC-03 | Nút chụp khoá đến khi nhãn "Đã căn chỉnh – có thể chụp" hiện | TB | SCRUM-18 | E2E |
| TC-APP-11 | Kiểm tra ảnh | — | 1. Chụp 2. Bấm Chụp lại 3. Chụp 4. Dùng ảnh này | Chụp lại → về camera; Dùng ảnh: CCCD → mặt sau, hộ chiếu → eKYC-05 | TB | G-04 | E2E |
| TC-APP-12 | Hiển thị OCR – CCCD | TD-01 | Đến eKYC-05 | Họ tên NGUYỄN THỊ MINH THƯ, số 089 192 005 678, ngày sinh 15/03/1992…; không có ô sửa | C | SCRUM-18 | E2E |
| TC-APP-13 | Hiển thị OCR – hộ chiếu | TD-15 | Đến eKYC-05 | Số hộ chiếu 533415151, quốc tịch GBR, nơi sinh London; không có dòng số định danh | C | C05 | E2E |
| TC-APP-14 | Giấy tờ hết hạn | TD-09 (hết hạn 15/03/2025) | Xác nhận thông tin | eKYC-13, ngày hết hạn tô đỏ; phiên `REJECTED`, lý do `DOC_EXPIRED` | C | RULE-10, UAT-13 | Cả hai (*UAT-EKYC-13*) |
| TC-APP-15 | Còn hạn dưới 30 ngày | TD-16 | Xác nhận thông tin | Vẫn sang eKYC-03B, có cảnh báo "Giấy tờ sắp hết hạn"; kết quả cuối STP | TB | RULE-10 #2 | Cả hai (*C05 #2 · CCCD còn hạn dưới 30 ngày*) |
| TC-APP-16 | Chưa đủ tuổi – sản phẩm tín dụng | TD-10 (sinh 20/05/2009) | Xác nhận thông tin | eKYC-08 lý do "Chưa đủ điều kiện độ tuổi"; `UNDER_AGE` | C | RULE-10, UAT-14 | Tự động (*UAT-EKYC-14*) |
| TC-APP-42 | Tuổi tối thiểu tài khoản thanh toán trực tuyến (16) | Ngày sinh 22/11/2010 (tròn 16), 23/11/2010 (thiếu 1 ngày), 01/03/2011 (15 tuổi); hệ thống ngày 22/11/2026 | Xác nhận thông tin, sản phẩm `payment` | Tròn 16 → đi tiếp; thiếu 1 ngày và 15 tuổi → eKYC-08 "Chưa đủ điều kiện độ tuổi", `UNDER_AGE` | C | RULE-10, P01 PR-02, UAT-27 | Tự động (*RULE-EKYC-10*) |
| TC-APP-17 | Đã có tài khoản | TD-08 | Xác nhận thông tin | eKYC-12, số đã che; không gọi được bước liveness | C | RULE-09, UAT-12 | Tự động (*UAT-EKYC-12*) |
| TC-APP-18 | Hộ chiếu VN của người đã có TK bằng CCCD | TD-14 với số định danh của TD-08 | Xác nhận thông tin | `STOPPED_DUPLICATE` | C | RULE-09 | Tự động (*C04 · hộ chiếu Việt Nam…*) |

### 1.3 Chip NFC – eKYC-03B

| Mã | Kịch bản | Dữ liệu | Bước | Kết quả mong đợi | ƯT | Truy vết | Cách chạy |
|---|---|---|---|---|---|---|---|
| TC-APP-19 | Đọc chip thành công | TD-01 | Bắt đầu quét → Tiếp tục | Thanh % chạy tới 100, "Chữ ký số trên chip hợp lệ"; `match_source = CHIP_DG2` | C | SCRUM-80 | E2E |
| TC-APP-20 | Bỏ qua NFC | TD-02 | "Điện thoại không có NFC?" → Vẫn bỏ qua | Cảnh báo duyệt thủ công; kết quả REFER `NFC_SKIPPED`, nguồn `OCR_FRONT` | C | RULE-14, UAT-02 | Tự động (*UAT-EKYC-02*) |
| TC-APP-21 | Chip sai chữ ký số | TD-12 | Quét chip | REFER `CHIP_AUTH_FAILED` | C | UAT-20 | Tự động (*UAT-EKYC-20*) |
| TC-APP-22 | OCR khác chip | TD-01 sửa ngày sinh trong chip; TD-14 sửa số hộ chiếu | Quét chip | `mismatch = [dob]` / `[passport_no]`, REFER `DOC_DATA_MISMATCH` | C | RULE-10 #5 | Tự động (*C05 #5* ×2) |

### 1.4 Khuôn mặt và kết quả – eKYC-06 → 09

| Mã | Kịch bản | Dữ liệu | Bước | Kết quả mong đợi | ƯT | Truy vết | Cách chạy |
|---|---|---|---|---|---|---|---|
| TC-APP-23 | Liveness | — | Tôi đã sẵn sàng | 4 thử thách lần lượt, vòng tiến trình, tự sang eKYC-06b | TB | SCRUM-19 | E2E |
| TC-APP-24 | Duyệt tự động CCCD | TD-01 | Đi hết luồng | eKYC-07: số TK `1903…`, chủ TK, giờ duyệt, mã hồ sơ; khách nhận `EKYC_APPROVED` (Push + SMS) | C | UAT-01 | Cả hai (*UAT-EKYC-01*) |
| TC-APP-25 | Duyệt tự động hộ chiếu VN | TD-14 | Đi hết luồng | STP_APPROVED | C | UAT-25 | Cả hai (*UAT-EKYC-25*) |
| TC-APP-26 | Liveness vùng biên | TD-03 (0.74) | Đi hết luồng | eKYC-09; REFER `LIVENESS_BORDERLINE` | C | UAT-04 | Tự động (*UAT-EKYC-04*) |
| TC-APP-27 | Trùng PEP, điểm thấp | TD-04 | Đi hết luồng | REFER `PEP_MATCH` dù điểm 45 | C | RULE-04, UAT-05 | Tự động (*UAT-EKYC-05*) |
| TC-APP-28 | Rủi ro cao | TD-05 (88) | Đi hết luồng | eKYC-08 lý do chung; thông báo không chứa RISK/CIC/AML/PEP | C | UAT-06 | Tự động (*UAT-EKYC-06*) |
| TC-APP-29 | CIC quá thời gian | TD-06 | Đi hết luồng | REFER `CIC_TIMEOUT`, không treo | C | UAT-07 | Tự động (*UAT-EKYC-07*) |
| TC-APP-30 | Một máy hai CCCD | TD-13 | Đi hết luồng | REFER `DEVICE_MULTI_IDENTITY` | C | RULE-16, UAT-22 | Tự động (*UAT-EKYC-22*) |
| TC-APP-31 | Hộ chiếu nước ngoài | TD-15 | Đi hết luồng | eKYC-09; REFER `FOREIGN_NATIONAL` | C | UAT-26 | Cả hai (*UAT-EKYC-26*) |
| TC-APP-32 | Màn đang xem xét | Hồ sơ REFER | 1. Xem dòng thời gian 2. Compliance duyệt 3. Bấm Kiểm tra kết quả | Hạn dự kiến = giờ vào hàng đợi + 24h; sau khi duyệt chuyển sang eKYC-07 | TB | SCRUM-77 | E2E |

### 1.5 Ngoại lệ – eKYC-03C, 10, 11, 14

| Mã | Kịch bản | Dữ liệu | Bước | Kết quả mong đợi | ƯT | Truy vết | Cách chạy |
|---|---|---|---|---|---|---|---|
| TC-APP-33 | Chụp lỗi 3 lần | TD-07 | Bấm "Gặp sự cố?" 3 lần | Lần 1–2 còn lượt; lần 3 REFER `OCR_UNREADABLE` | TB | RULE-07, UAT-10 | Tự động (*UAT-EKYC-10*) |
| TC-APP-34 | Tiếp tục phiên dở | TD-01 dừng sau bước chip | 1. Chờ > 30 phút 2. Tiếp tục hồ sơ đang dở | eKYC-10 "đã xong 3/5 bước"; Tiếp tục → eKYC-06, điểm liveness cũ bị xoá | C | RULE-11, UAT-15 | Tự động (*UAT-EKYC-15*) |
| TC-APP-35 | Làm lại từ đầu | Phiên dở | Làm lại từ đầu | Phiên `CANCELLED`, dữ liệu tạm bị xoá | TB | C06 | E2E |
| TC-APP-36 | Không có hồ sơ dở | Thiết bị mới | Tiếp tục hồ sơ đang dở | Thông báo "Không có hồ sơ đang làm dở trên máy này" | T | C06 | E2E |
| TC-APP-37 | Nhận yêu cầu bổ sung | TD-03 REFER; Compliance yêu cầu "mặt sau mờ" | Kiểm tra kết quả | eKYC-11: hạng mục, lời nhắn, hạn (+5 ngày) | C | C07, UAT-16 | E2E |
| TC-APP-38 | Gửi bổ sung | Tiếp TC-APP-37 | Chụp lại mặt sau | Về eKYC-09 "Đã nhận ảnh bổ sung"; hồ sơ `REFER_RESUBMITTED` | C | C07, UAT-16 | Cả hai (*UAT-EKYC-16*) |
| TC-APP-39 | Rút đồng ý định danh khi chưa có TK | Phiên đang dở | eKYC-14 → Rút lại (định danh) → Xác nhận | "Đã rút lại đồng ý. Dữ liệu sẽ được xoá trong 24 giờ"; phiên `CANCELLED`; job xoá sau 24h | C | RULE-15, UAT-21 | Cả hai (*UAT-EKYC-21*) |
| TC-APP-40 | Rút đồng ý khi đã có TK | TD-01 đã STP | Rút lại (định danh) | `RETAINED`, giải thích nghĩa vụ lưu trữ, không xoá | C | RULE-15 | Tự động (*C12 · đã có tài khoản…*) |
| TC-APP-41 | Rút đồng ý ưu đãi | Bất kỳ | Rút lại (ưu đãi) | "Đã ngừng gửi ưu đãi."; hồ sơ không bị ảnh hưởng | T | RULE-15 | Tự động (*C12*) |

## 2. Aegis Compliance (TC-CO)

### 2.1 Hàng đợi

| Mã | Kịch bản | Dữ liệu | Bước | Kết quả mong đợi | ƯT | Truy vết | Cách chạy |
|---|---|---|---|---|---|---|---|
| TC-CO-01 | Số liệu đầu trang | Dữ liệu mẫu | Mở hàng đợi | 4 thẻ: đang chờ, sắp quá SLA, quá SLA, chờ Checker khớp danh sách | TB | SCRUM-78 | E2E |
| TC-CO-02 | Thứ tự ưu tiên | Dữ liệu mẫu | Mở tab Tất cả | Đã bổ sung → Sắp/Quá SLA → cũ nhất | C | RULE-12 | Tự động (*Hàng đợi mẫu: thứ tự…*) |
| TC-CO-03 | Tab lọc | `u-anh` | Bấm Của tôi / Đã bổ sung / Chờ Checker | Chỉ hiện hồ sơ đúng điều kiện, số trên tab khớp | TB | SCRUM-78 | E2E |
| TC-CO-04 | Tìm kiếm | — | Gõ "0052" hoặc một phần họ tên | Lọc đúng hồ sơ | T | SCRUM-48 | E2E |
| TC-CO-05 | Nhãn SLA | Hồ sơ 10h / 17h / 26h | Xem cột SLA | Trong hạn (xanh) / Sắp quá hạn (hổ phách) / Quá SLA (đỏ), có chữ kèm màu | C | RULE-12 | Cả hai (*RULE-EKYC-12: trạng thái SLA*) |
| TC-CO-06 | Hồ sơ mới từ app | Chạy TD-04 trên app | Chờ ≤ 20 giây hoặc bấm Làm mới | Hồ sơ mới xuất hiện | TB | — | E2E |

### 2.2 Nhận xử lý và xem hồ sơ

| Mã | Kịch bản | Dữ liệu | Bước | Kết quả mong đợi | ƯT | Truy vết | Cách chạy |
|---|---|---|---|---|---|---|---|
| TC-CO-07 | Nhận xử lý | Hồ sơ chưa ai nhận | Bấm Nhận | Người xử lý = mình, trạng thái Đang xử lý; audit `CASE_CLAIM` | C | RULE-12 | E2E |
| TC-CO-08 | Hồ sơ người khác giữ | `u-anh` giữ | `u-yen` bấm Nhận | 409 "Hồ sơ đang do người khác xử lý"; màn chi tiết chỉ xem | C | RULE-12 | Tự động (*RULE-EKYC-12 · một hồ sơ một người giữ*) |
| TC-CO-09 | Tự nhả sau 2 giờ | Hồ sơ đã nhận | Tua 2 giờ, chạy job | Người xử lý trống; audit `CASE_RELEASE` (system) | TB | RULE-12 | Tự động (cùng test) |
| TC-CO-10 | Ghi audit khi xem | `u-anh` | Mở chi tiết, mở lại trong 1 phút | `CASE_VIEW` + `VIEW_SENSITIVE` ghi 1 lần | C | C10 §3 | Cả hai (*C10 · xem chi tiết và PII…*) |
| TC-CO-11 | Xem họ tên đầy đủ | `u-anh` | Bấm Xem họ tên đầy đủ | Hiện tên thật; audit `VIEW_PII`; dòng "Đã ghi nhật ký" | C | C10 §3 | Tự động (cùng test) |
| TC-CO-12 | Vai trò CS | `u-trang` | Mở hàng đợi và chi tiết | Không có điểm rủi ro; thẻ sàng lọc khoá; không có nút Nhận/Xem họ tên; API PII → 403 | C | UAT-09 | Tự động (*UAT-EKYC-09*) |

### 2.3 Yêu cầu bổ sung

| Mã | Kịch bản | Dữ liệu | Bước | Kết quả mong đợi | ƯT | Truy vết | Cách chạy |
|---|---|---|---|---|---|---|---|
| TC-CO-13 | Yêu cầu hợp lệ | Hồ sơ đã nhận | Chọn "mặt sau mờ", lời nhắn → Gửi | `PENDING_CUSTOMER_INFO`; SLA Tạm dừng; khách nhận `EKYC_INFO_REQUESTED` có deep link | C | C07, UAT-16 | Cả hai (*UAT-EKYC-16*) |
| TC-CO-14 | Lời nhắn nhắc PEP/AML/CIC | — | Lời nhắn "Kết quả CIC chưa rõ" | Bị chặn "Lời nhắn không được nhắc PEP, AML, CIC" | C | C07 #5 | Tự động (cùng test) |
| TC-CO-15 | Không chọn hạng mục | — | Bấm Gửi | Nút khoá; API 422 | TB | C07 #1 | Tự động (cùng test) |
| TC-CO-16 | Quá 2 lần | Đã yêu cầu 2 lần | Yêu cầu lần 3 | Nút khoá; API 409 `LIMIT_REACHED` | TB | C07 #2 | Tự động (*C07 #2*) |
| TC-CO-17 | Khách không phản hồi | Đã yêu cầu | Tua 4 ngày rồi 5 ngày | Ngày 4: `EKYC_INFO_REMINDER`; ngày 5: REJECTED `NO_RESPONSE` | C | C07 #3 | Tự động (*C07 #3*) |

### 2.4 Quyết định và Maker-Checker

| Mã | Kịch bản | Dữ liệu | Bước | Kết quả mong đợi | ƯT | Truy vết | Cách chạy |
|---|---|---|---|---|---|---|---|
| TC-CO-18 | Duyệt hồ sơ thường | TD-03, `u-anh` | Nhận → Phê duyệt | APPROVED, có số TK; `kyc_decisions.maker_id = u-anh`, không có Checker | C | UAT-08 | Tự động (*UAT-EKYC-08*) |
| TC-CO-19 | Duyệt hồ sơ PEP | TD-04, `u-anh` | Nhận → Phê duyệt · gửi Checker | `PENDING_CHECKER`, chưa có số TK | C | RULE-13, UAT-19 | Cả hai (*UAT-EKYC-19*) |
| TC-CO-20 | Maker tự làm Checker | Tiếp TC-CO-19 | `u-anh` bấm Checker phê duyệt | 403 "Checker phải là người khác Maker"; audit `CHECKER_BLOCKED_SAME_PERSON` | C | RULE-13 | Cả hai |
| TC-CO-21 | Checker khác duyệt | Tiếp TC-CO-19 | Đổi sang `u-yen` → Checker phê duyệt | APPROVED; ghi cả `maker_id`, `checker_id`; khách nhận thông báo | C | RULE-13 | Cả hai |
| TC-CO-22 | Checker trả lại | Hồ sơ mẫu EKS-2611-0036 | `u-anh` → Trả lại Maker (có lý do) | Về REFER, giao lại Maker `u-yen` | C | C10 | Tự động (*C10 · Checker trả lại*) |
| TC-CO-23 | Từ chối | Hồ sơ đã nhận | Từ chối không chọn lý do; rồi chọn lý do | Không lý do: bị chặn. Có lý do: REJECTED; khách thấy lý do chung | C | C10 | Tự động (*C10 · Từ chối cần lý do…*) |
| TC-CO-24 | Tra cứu lại CIC | Hồ sơ `CIC_TIMEOUT` | Bấm Tra cứu lại CIC | Thành công: cập nhật nhóm CIC, bỏ cờ; CIC vẫn lỗi: 503 "CIC vẫn chưa phản hồi" | TB | SCRUM-42 | E2E |

### 2.5 Báo cáo và cấu hình

| Mã | Kịch bản | Dữ liệu | Bước | Kết quả mong đợi | ƯT | Truy vết | Cách chạy |
|---|---|---|---|---|---|---|---|
| TC-CO-25 | Báo cáo SLA | 1 hồ sơ duyệt sau 2 giờ | Mở Báo cáo SLA | Đã xử lý 1, đúng SLA 100%, trung vị 2g | TB | C09, C18 | Tự động (*Báo cáo SLA và KPI…*) |
| TC-CO-26 | KPI | TD-01, TD-05, TD-02 + 8 hồ sơ mẫu | Gọi `/api/reports/kpi` | STP rate 1/11, tỷ lệ dùng ảnh in 2/11 | TB | C18 | Tự động (cùng test) |
| TC-CO-27 | Đề xuất đổi ngưỡng | `u-anh` | Sửa SLA 24 → 20, lý do ≥ 10 ký tự → Gửi | Đề xuất PENDING; giá trị vẫn 24 | C | NFR-SEC-05, UAT-23 | Tự động (*UAT-EKYC-23*) |
| TC-CO-28 | Giá trị/ lý do không hợp lệ | — | SLA = 500; lý do "ngắn" | 422 ngoài khoảng / lý do tối thiểu 10 ký tự | TB | NFR-SEC-05 | Tự động (cùng test) |
| TC-CO-29 | Người đề xuất tự duyệt | `u-huy` đề xuất | `u-huy` bấm Phê duyệt | Nút khoá; API 403 | C | NFR-SEC-05 | Tự động (cùng test) |
| TC-CO-30 | Officer duyệt | `u-yen` | Phê duyệt đề xuất | 403 "Chỉ trưởng nhóm…" | C | NFR-SEC-05 | Tự động (cùng test) |
| TC-CO-31 | Trưởng nhóm khác duyệt | `u-anh` đề xuất, `u-huy` duyệt | Phê duyệt | Áp dụng ngay; audit REQUESTED → APPROVED; lịch sử thay đổi cập nhật | C | NFR-SEC-05 | Cả hai |
| TC-CO-32 | Không hạ tuổi thanh toán dưới 16 | `u-anh` | Đề xuất `min_age_payment` = 15; DB cũ đang lưu 15 | 422 `OUT_OF_RANGE` "Giá trị phải trong khoảng 16–25"; giá trị 15 cũ bị bỏ qua, hệ thống dùng 16 | C | NFR-SEC-05, P01 PR-02 | Tự động (*P01 PR-02*) |

## 3. API (TC-API)

| Mã | Kịch bản | Bước | Kết quả mong đợi | ƯT | Cách chạy |
|---|---|---|---|---|---|
| TC-API-01 | Phiên của người khác | Gọi API phiên với token sai / thiếu | 403 | C | Tự động (*Khách không thao tác được phiên của người khác*, *HTTP · TD-01*) |
| TC-API-02 | Thiếu xác thực nhân viên | `GET /api/cases` không có `x-staff-id` | 401 | C | Tự động (*HTTP · API nhân viên cần x-staff-id*) |
| TC-API-03 | API không tồn tại | `GET /api/nope` | 404 | T | Tự động (cùng test) |
| TC-API-04 | JSON sai | `POST /api/sessions` với `{bad` | 400 `BAD_JSON` | TB | E2E (curl) |
| TC-API-05 | Dữ liệu quá lớn | Body > 1 MB | 413 | TB | E2E (curl) |
| TC-API-06 | Quá ngưỡng phiên / thiết bị | Tạo 4 phiên cùng `device_id` trong 24h | Lần 4: 429 "Vui lòng thử lại sau"; sự kiện `ekyc.fraud.velocity_hit` | C | Tự động (*C13 · quá 3 phiên…*) |
| TC-API-07 | Tạo tài khoản idempotent | Gọi tạo TK 2 lần cùng phiên | 1 tài khoản | C | Tự động (*UAT-EKYC-11*) |
| TC-API-08 | CORS | Preflight từ `http://192.168.x.x:5179` | 204, `Access-Control-Allow-Origin` đúng origin | TB | Tự động (*HTTP · CORS preflight*) |
| TC-API-09 | Sai thứ tự bước | Gửi giấy tờ khi chưa đồng ý | 409 `INVALID_STATE` | TB | E2E (curl) |
| TC-API-10 | Số CCCD sai | 11 chữ số | 422 "Số CCCD phải đủ 12 chữ số" | TB | E2E (curl) |
| TC-API-11 | Hộ chiếu sai | VNM thiếu số định danh; số "C1-23"; quốc tịch "VN" | 422 tương ứng | TB | Tự động (*C05 · hộ chiếu không hợp lệ…*) |
| TC-API-12 | Health check | `GET /health` | 200 `{ok: true}` | T | E2E |

## 4. Job nền (TC-JOB)

| Mã | Job | Bước | Kết quả mong đợi | ƯT | Cách chạy |
|---|---|---|---|---|---|
| TC-JOB-01 | `session-abandon-scan` | Phiên không thao tác 31 phút | `ABANDONED`, sự kiện `ekyc.session.abandoned` | C | Tự động (*UAT-EKYC-15*) |
| TC-JOB-02 | `session-expire` | `ABANDONED` quá 7 ngày | `EXPIRED`, xoá OCR/chip/họ tên | C | Tự động (*C06 · phiên bỏ dở quá 7 ngày*) |
| TC-JOB-03 | `info-request-deadline` | Hạn bổ sung còn 1 ngày / quá hạn | Nhắc / REJECTED `NO_RESPONSE` | C | Tự động (*C07 #3*) |
| TC-JOB-04 | `claim-auto-release` | Giữ hồ sơ 2 giờ không thao tác | Tự nhả | TB | Tự động (*RULE-EKYC-12*) |
| TC-JOB-05 | `sla-escalation` | Hồ sơ 20h / 25h | Báo trưởng nhóm / ghi Breach | C | Tự động (*UAT-EKYC-18*) |
| TC-JOB-06 | `retention` | Quá `retention_until` | Xoá/ẩn danh PII, audit `DATA_PURGED` | C | Tự động (*UAT-EKYC-21*) |

## 5. Phi chức năng (TC-NFR)

| Mã | Hạng mục | Kiểm tra | Kết quả mong đợi | ƯT | Cách chạy |
|---|---|---|---|---|---|
| TC-NFR-01 | Audit bất biến | `UPDATE/DELETE` trực tiếp `audit_event`, `kyc_decisions` | DB từ chối (trigger) | C | Tự động (*NFR-AUD-03*) |
| TC-NFR-02 | Không lộ thông tin rủi ro cho khách | Thông báo và màn kết quả của TD-05 | Không chứa RISK, CIC, AML, PEP | C | Tự động (*UAT-EKYC-06*) |
| TC-NFR-03 | PII che mặc định | Hàng đợi, chi tiết | Tên dạng "L* V** P***", số giấy tờ che giữa | C | Tự động (*Che họ tên*, *UAT-EKYC-26*) |
| TC-NFR-04 | Lưu số định danh | Bảng `sessions` | Khoá tra trùng là SHA-256 + salt; số thô chỉ trong dữ liệu OCR (production phải mã hoá cột) | C | Rà soát code |
| TC-NFR-05 | Lỗi hệ thống | Gây lỗi 500 | Trả "Lỗi hệ thống", không lộ stack trace | TB | Rà soát code |
| TC-NFR-06 | Vùng chạm | Đo nút trên app | ≥ 44 × 44 pt | TB | E2E |
| TC-NFR-07 | Trình đọc màn hình | VoiceOver trên liveness, NFC | Hướng dẫn và tiến độ được đọc (`aria-live`) | TB | E2E |
| TC-NFR-08 | Tương phản | Công cụ đo tương phản | Chữ ≥ 4.5:1 | TB | E2E |
| TC-NFR-09 | Bàn phím (Compliance) | Tab qua nút, Esc đóng hộp thoại | Điều khiển được không cần chuột | T | E2E |
| TC-NFR-10 | Song ngữ | Đổi VI ↔ EN trên mọi màn | Toàn bộ chữ đổi, lựa chọn được nhớ; `?lang=en` có ưu tiên | TB | E2E |
| TC-NFR-11 | Safari iPhone | iOS 17+ qua link HTTPS | Đi hết luồng; camera xin quyền | C | E2E |
| TC-NFR-12 | Chrome Android | Android 13+ | Đi hết luồng | TB | E2E |
| TC-NFR-13 | Trình duyệt máy tính | Chrome, Edge, Safari bản mới | Compliance hiển thị và thao tác đúng | TB | E2E |
| TC-NFR-14 | Màn hình hẹp (Compliance) | Rộng < 1024px | Menu chuyển thành thanh ngang, bảng cuộn ngang | T | E2E |
| TC-NFR-15 | Thời gian quyết định | Đo `POST …/liveness` | Local < 100 ms; production P95 < 3s theo C15 | TB | E2E (đo) |
| TC-NFR-16 | Chế độ demo | Mở bản GitHub Pages | Chạy không cần backend, không lỗi console | T | E2E |

## 6. Kiểm soát tài liệu

### Lịch sử phiên bản

| Phiên bản | Ngày | Người sửa | Commit | Thay đổi |
|---|---|---|---|---|
| 1.0 | 23/11/2026 | Han Dao | `95fb7b1` | Bản đầu |
| 1.1 | 25/11/2026 | Han Dao | — | Thêm TC-APP-42, TC-CO-32 (tuổi tối thiểu 16); tổng 108 case; thêm mục kiểm soát tài liệu (phiên bản, lịch sử, phê duyệt) theo ISO/IEC/IEEE 29148 và 29119-3 |

### Phê duyệt

| Vai trò | Người | Ngày | Kết luận |
|---|---|---|---|
| BA (soạn) | Han Dao | 25/11/2026 | Trình duyệt |
| QA Lead | | | |
| Product Owner | | | |
