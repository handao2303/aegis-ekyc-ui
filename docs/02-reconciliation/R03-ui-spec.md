# R03 · Đặc tả giao diện – Aegis Đối soát (REC-01 → REC-06)

| | |
|---|---|
| Người dùng | Chuyên viên đối soát (Maker), Kiểm soát viên (Checker), Trưởng nhóm đối soát, Kế toán trưởng / Quản lý vận hành (xem dashboard) |
| Jira | [SCRUM-49](https://baohandao2303.atlassian.net/browse/SCRUM-49) (FE REC-01 → 06), [SCRUM-50](https://baohandao2303.atlassian.net/browse/SCRUM-50) (truy vết) |
| Bản chạy | [/reconciliation/](https://handao2303.github.io/aegis-ekyc-ui/reconciliation/) – dữ liệu hư cấu, chưa nối backend |
| Mã nguồn | `src/ops/Reconciliation.tsx`, khung dùng chung `src/ops/kit.tsx` |
| Ảnh | 1280 × 860, tiếng Việt, chụp tự động bằng `tools/diagrams/rec-screens.mjs` |
| Phiên bản | 1.2 · 24/11/2026 · Han Dao |

Quy tắc nghiệp vụ và điểm lệch baseline: [R02](R02-requirements-gap-rtm.md). Kết quả chạy thử trên giao diện: [R04](R04-test-plan-cases.md).

## 1. Khung ứng dụng

| Vùng | Nội dung |
|---|---|
| Menu trái | Logo "Aegis Đối soát · Khớp giao dịch & GL" · ô tìm kiếm (⌘K) · Tổng quan · Quy tắc đối soát (số quy tắc chờ duyệt) · Ngoại lệ (số đang mở) · Bút toán GL (số chờ Checker) · thẻ người dùng + vai trò + đăng xuất |
| Thanh trên | Lời chào theo tên · mô tả ngắn · VI/EN · kỳ báo cáo (Hôm nay / 7 ngày / Tháng) · **Xuất** · chuông cảnh báo |
| Cảnh báo mẫu | File ví điện tử bị cách ly · ngoại lệ quá hạn đã leo thang · bút toán > 50 triệu chờ Checker |
| Đăng nhập UAT với vai trò | Ô chọn ngay dưới thanh trên: Lê Hoàng Nam (chuyên viên) · Phạm Thu Trang (Checker) · Đỗ Minh Quân (trưởng nhóm, người tạo MR-002, MR-003). Cũng chọn được qua đường dẫn `?as=trang`, `?as=quan`. Chỉ dùng trên UAT; production lấy vai trò từ SSO |
| Nhãn quy tắc | Mỗi chỗ áp dụng quy tắc có nhãn xám (vd. `RULE-REC-04`, `UAT-REC-09`) để tester và kiểm toán đối chiếu |

### Phân quyền hiển thị (đề xuất – UI mẫu chưa ẩn chức năng theo vai trò, chỉ chặn bằng SoD)

| Chức năng | Chuyên viên | Checker | Trưởng nhóm | Kế toán trưởng / QL vận hành |
|---|---|---|---|---|
| Xem REC-01 | ✅ | ✅ | ✅ | ✅ |
| Tạo / sửa quy tắc (Maker) | ✅ | ✅ | ✅ | — |
| Duyệt quy tắc (khác người tạo) | — | ✅ | ✅ | ✅ |
| Nhận, xử lý ngoại lệ | ✅ | ✅ | ✅ | — |
| Duyệt bút toán > 50 triệu (khác Maker, khác người tạo rule – RULE-REC-05) | — | ✅ | ✅ | ✅ |
| Xem số tài khoản đầy đủ (ghi audit – D-REC-09) | — | — | ✅ | ✅ |

## 2. REC-01 Tổng quan

<img src="../../public/ui/rec-dashboard.png" width="760" alt="REC-01 Tổng quan">

| Mục | Nội dung | Quy tắc |
|---|---|---|
| 4 thẻ chỉ số | Tỷ lệ khớp tự động (mục tiêu ≥ 95%) · MTTR · Giá trị chưa khớp (tổng chênh lệch ngoại lệ đang mở) · Zero-touch. Bấm thẻ MTTR / Giá trị chưa khớp → REC-04; Zero-touch → REC-06 | KPI-03 → 06 |
| Biểu đồ hiệu quả | Đổi giữa "Tỷ lệ" (khớp tự động, zero-touch, đường mục tiêu 95%) và "Ngoại lệ" (mới / đã xử lý) theo kỳ đã chọn | UC-REC-06 |
| Nguyên nhân hàng đầu | Số ngoại lệ trong kỳ theo nguyên nhân AI xếp hạng cao nhất | BR-REC-05 |
| Trạng thái nạp nguồn | Nguồn · kênh · số bản ghi · tỷ lệ khớp · giờ nạp · trạng thái **Đúng lịch / Trễ / Cách ly** kèm ghi chú lý do. Có nhãn "Cập nhật lúc …" | UAT-REC-02, UAT-REC-09 |
| Ngoại lệ cần chú ý | 3 ngoại lệ đang mở có tỷ lệ tuổi / hạn cao nhất; bấm để mở REC-05 | — |

**Còn thiếu so với baseline:** lọc theo nguồn và loại rule, xuất báo cáo (nút Xuất chưa làm gì) – REQ-REC-17; ngưỡng cảnh báo tuỳ chỉnh – REQ-REC-18; xem và nạp lại file bị cách ly – REQ-REC-13; Zero-touch chưa hiện mục tiêu ≥ 30% (D-REC-07).

## 3. REC-02 Quy tắc đối soát

<img src="../../public/ui/rec-rules.png" width="760" alt="REC-02 Quy tắc đối soát">

| Cột | Nội dung |
|---|---|
| Mã · Tên | Mã MR-xxx; dưới tên ghi Maker và Checker |
| Loại | Exact · Fuzzy · N:1 |
| Khoá khớp · Ngưỡng | vd. `ref + amount + date` · `±0,5% · ±1 ngày`; N:1 ghi số giao dịch tối đa mỗi lô |
| Version · Tỷ lệ khớp | Version tăng mỗi lần sửa; tỷ lệ giao dịch khớp bằng rule này |
| Trạng thái | Đang chạy · Chờ duyệt · Nháp. Dòng "Chờ duyệt" có nút **Duyệt** |

| Hành vi | Kết quả |
|---|---|
| Bấm Duyệt quy tắc do chính mình tạo | Chặn, thông báo "Không thể duyệt MR-xxx: bạn là người tạo quy tắc" |
| Bấm Duyệt quy tắc người khác tạo | Chuyển "Đang chạy", ghi Checker, "áp dụng từ lần chạy tiếp theo" |

**Còn thiếu:** từ chối / trả lại quy tắc chờ duyệt, sửa quy tắc đang chạy (tạo version mới), ngừng dùng, sao chép – REQ-REC-09, REQ-REC-12.

## 4. REC-03 Tạo quy tắc

<img src="../../public/ui/rec-rule-form-sod.png" width="620" alt="REC-03 Tạo quy tắc – chặn khi Checker là chính mình">

| Trường | Ràng buộc |
|---|---|
| Tên quy tắc | Bắt buộc, ≥ 4 ký tự |
| Loại khớp | Exact · Fuzzy · N:1. Exact khoá 2 ô ngưỡng; N:1 ẩn 2 ô ngưỡng |
| Khoá khớp | Chọn ít nhất 1: Mã tham chiếu · Số tiền · Ngày giao dịch · Tài khoản · Mã lô |
| Lệch số tiền (%) · Lệch ngày | Chỉ cho Fuzzy |
| Người duyệt (Checker) | Chọn từ danh sách. Chọn chính mình → banner đỏ "Vi phạm phân tách nhiệm vụ", nút **Gửi duyệt** bị khoá |
| Sau khi gửi | Quy tắc mới ở "Chờ duyệt", version 1, có trong REC-02 |

**Lưu ý thiết kế:** baseline gọi Exact là khớp `reference_no + amount + currency` (RULE-REC-02); form chưa có khoá "Tiền tệ". Đề nghị thêm khoá này và mặc định bật cho Exact.

## 5. REC-04 Danh sách ngoại lệ

<img src="../../public/ui/rec-exceptions.png" width="760" alt="REC-04 Danh sách ngoại lệ">

| Mục | Nội dung |
|---|---|
| Bộ lọc | Tìm theo mã / cặp đối soát · trạng thái (Đang mở – mặc định, Tất cả, Đã leo thang, Đã xử lý) |
| Cột | Mã · cặp đối soát · loại (`UNMATCHED` / `PARTIAL` / `DUPLICATE`) · chênh lệch · aging (đỏ khi quá hạn) · gợi ý AI cao nhất kèm % · người xử lý · trạng thái |
| Bấm dòng | Mở REC-05 |

Aging trên UI chia 4 nhóm, BRD chia 3 nhóm – chờ quyết định D-REC-02.

## 6. REC-05 Chi tiết ngoại lệ

<img src="../../public/ui/rec-exception-detail.png" width="760" alt="REC-05 Chi tiết ngoại lệ EXC-1125">

| Vùng | Nội dung | Quy tắc |
|---|---|---|
| Đầu trang | Mã, trạng thái, cặp, loại, aging · nút **Nhận xử lý** (khi chưa có người), **Leo thang** | — |
| Banner quá hạn | "Quá hạn xử lý N giờ – đã leo thang tự động lên trưởng nhóm" | RULE-REC-06 (D-REC-03) |
| So sánh giao dịch | Hai thẻ Nội bộ (CBS) và Đối tác: tham chiếu, thời gian, tài khoản, số tiền; thẻ đối tác trống ghi "Chưa có bản ghi đối ứng". Ô chênh lệch | — |
| Nguyên nhân | Top-3 gợi ý của AI kèm % và thanh mức, cộng lựa chọn **Nguyên nhân khác**: chọn từ danh mục 7 nhóm và ghi chú ≥ 10 ký tự, lưu là override | BR-REC-05, REQ-REC-01 |
| Xử lý ngoại lệ | Chọn 1 trong 3 cách: **Hạch toán điều chỉnh** (mô tả bút toán và ngưỡng 50 triệu) · **Khớp thủ công** (nhập mã tham chiếu đối ứng, ≥ 4 ký tự, không sinh bút toán) · **Yêu cầu chứng từ** (ghi chú ≥ 10 ký tự; ngoại lệ hiện banner "Đang chờ chứng từ bổ sung") | UC-REC-04, REQ-REC-02 |
| Khoá bút toán trùng | Ngoại lệ đã có bút toán đang chờ Checker hoặc bị trả về: cảnh báo vàng chỉ ra bút toán đó, nút **Tạo bút toán điều chỉnh** bị khoá | REQ-REC-08 |
| Truy vết dữ liệu | 4 bước SourceTransaction → MatchResult → ExceptionCase → GLEntry; bước chưa có ghi "Không tìm thấy đối ứng" / "Chưa hạch toán" | FR-REC-11, UAT-REC-10 |

<img src="../../public/ui/rec-exception-locked.png" width="760" alt="REC-05 – ngoại lệ đã có bút toán chờ Checker, nút tạo bút toán bị khoá">

| Kết quả xử lý | Trạng thái ngoại lệ |
|---|---|
| Khớp thủ công | `RESOLVED` ngay, truy vết bước 2 ghi mã đối ứng, bước 4 ghi "Không cần hạch toán" |
| Hạch toán điều chỉnh tới 50 triệu | Bút toán zero-touch `POSTED`, ngoại lệ `RESOLVED` |
| Hạch toán điều chỉnh trên 50 triệu | Bút toán `PENDING`, ngoại lệ **`PENDING_POSTING`** (Chờ hạch toán), vẫn trong danh sách đang mở. Checker duyệt → `RESOLVED`; từ chối hoặc trả về → `IN_PROGRESS` |
| Yêu cầu chứng từ | Ngoại lệ ở `IN_PROGRESS`, có banner chờ chứng từ |

**Còn thiếu:** che số tài khoản nội bộ (D-REC-09).

## 7. REC-06 Bút toán GL

<img src="../../public/ui/rec-gl.png" width="760" alt="REC-06 Bút toán GL">

| Mục | Nội dung | Quy tắc |
|---|---|---|
| Bộ lọc | Tất cả · Chờ duyệt · Zero-touch | — |
| Cột | Bút toán (mã, thời gian, diễn giải) · Nợ / Có · số tiền (màu cam khi > 50 triệu) · nguồn (rule hoặc ngoại lệ) · cơ chế Zero-touch / Maker-Checker kèm Maker · trạng thái | BR-REC-06 |
| Dòng chờ duyệt | Dưới nhãn trạng thái có 3 nút: **Duyệt** · **Trả về** · **Từ chối** | RULE-REC-04 |
| Từ chối | Hộp thoại lý do; nút "Xác nhận từ chối" khoá khi lý do < 10 ký tự. Lý do hiện dưới bút toán; ngoại lệ liên quan mở lại | REQ-REC-05 |
| Trả về | Hộp thoại ghi chú ≥ 10 ký tự; bút toán sang "Trả về Maker", hiện ghi chú của Checker. Maker thấy nút **Trình lại**, bút toán giữ mã, tăng số lần trình | REQ-REC-06 |
| Maker bấm Duyệt / Trả về / Từ chối bút toán của mình | Chặn: "bạn là Maker của bút toán này" | BR-REC-07 |
| Người tạo quy tắc bấm Duyệt bút toán > 50 triệu sinh từ quy tắc đó | Chặn: "bạn là người tạo quy tắc MR-xxx sinh ra giao dịch này". Cột Cơ chế · Maker ghi quy tắc nguồn và người tạo để Checker thấy trước | RULE-REC-05, REQ-REC-07 |
| Chân trang | "Ngưỡng 50 triệu giữ theo baseline vì CR-002 chưa được duyệt" | ASM-07, DEC-01 |

<img src="../../public/ui/rec-gl-reject.png" width="620" alt="REC-06 – hộp thoại lý do từ chối">

<img src="../../public/ui/rec-gl-rule-sod.png" width="760" alt="REC-06 – người tạo quy tắc MR-002 không duyệt được bút toán sinh từ MR-002">

**Còn thiếu:** chuyển cấp duyệt cao hơn (REQ-REC-10).

## 8. Trạng thái và thông điệp

| Đối tượng | Nhãn trên UI | Mã |
|---|---|---|
| Nguồn | Đúng lịch · Trễ · Cách ly | `ok` · `delayed` · `quarantine` |
| Quy tắc | Đang chạy · Chờ duyệt · Nháp | `ACTIVE` · `PENDING` · `DRAFT` |
| Ngoại lệ | Mới · Đang xử lý · Đã leo thang · Chờ hạch toán · Đã xử lý | `OPEN` · `IN_PROGRESS` · `ESCALATED` · `PENDING_POSTING` · `RESOLVED` |
| Bút toán | Đã hạch toán · Chờ Checker · Trả về Maker · Từ chối | `POSTED` · `PENDING` · `RETURNED` · `REJECTED` |

Trạng thái luôn có chữ đi kèm màu, không chỉ dùng màu (WCAG 2.2 tiêu chí 1.4.1). Banner chặn dùng `role="alert"`, thông báo kết quả dùng `role="status"`.

## Lịch sử phiên bản

| Phiên bản | Ngày | Người | Thay đổi |
|---|---|---|---|
| 1.0 | 24/11/2026 | Han Dao | Bản đầu, có ảnh 6 màn, ghi phần còn thiếu so với baseline |
| 1.1 | 24/11/2026 | Han Dao | Cập nhật REC-05, REC-06 sau khi sửa 6 lỗi của R04: 3 cách xử lý, nguyên nhân khác, khoá bút toán trùng, Chờ hạch toán, lý do từ chối, trả về Maker |
| 1.2 | 24/11/2026 | Han Dao | Ô đăng nhập UAT với 3 vai trò; kiểm RULE-REC-05 đúng nghĩa baseline khi duyệt bút toán |
