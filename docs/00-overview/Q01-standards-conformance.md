# Q01 · Đối chiếu tài liệu 3 module với chuẩn quốc tế

| | |
|---|---|
| Mã tài liệu | AEG-GEN-Q01 |
| Phiên bản | 1.2 |
| Ngày phát hành | 26/11/2026 |
| Trạng thái | ✅ Tự đánh giá v1.1 · chờ QA Lead, PO xem xét |
| Phân loại | Nội bộ |
| Tác giả | Han Dao (BA) |
| Người duyệt | QA Lead · Product Owner – chưa duyệt |
| Mục đích và phạm vi | Đối chiếu từng loại tài liệu của 3 module với chuẩn quốc tế áp dụng và ghi mức đạt, việc còn thiếu |
| Chuẩn tham chiếu | — |
| Thuật ngữ | [G02 Thuật ngữ và chữ viết tắt](G02-glossary.md) |
| Phạm vi | 22 tài liệu Module 1 (`00-overview/`, `01-ekyc/`) – §2; 16 tài liệu Module 2, 3 (`02-reconciliation/`, `03-credit-limit/`) và X01 – §2.2 (thêm 26/11/2026) |
| Người rà soát | Han Dao (BA) |
| Cách làm | Đối chiếu từng tài liệu với danh mục nội dung của chuẩn tương ứng. Kết quả là **tự đánh giá**, không phải chứng nhận |

> Các chuẩn ISO là tài liệu có bản quyền. Danh mục dưới đây tóm tắt các mục chính của chuẩn theo hiểu biết chung, chưa đối chiếu với bản gốc. Khi cần chứng nhận hoặc audit, phải dùng bản chuẩn chính thức.

## 1. Chuẩn áp dụng

| Loại tài liệu | Chuẩn | Tài liệu áp dụng |
|---|---|---|
| Yêu cầu nghiệp vụ, hệ thống, truy vết | ISO/IEC/IEEE 29148:2018, IIBA BABOK v3 | C03, C04–C13 |
| Kỹ thuật phân tích | BABOK v3 (bảng quyết định, mô hình trạng thái, mô hình quy trình, phân quyền) | C04–C13 |
| Kế hoạch, test case, báo cáo kiểm thử | ISO/IEC/IEEE 29119-3:2021, thuật ngữ ISTQB | T01–T03, C15–C17 |
| Kiến trúc | Mô hình C4, ISO/IEC/IEEE 42010 | A01, A02 |
| Sơ đồ | BPMN 2.0 (quy trình), UML 2.5 (trạng thái, tuần tự) | Mọi tài liệu có diagram |
| Giao diện và trợ năng | WCAG 2.2 mức AA, ISO 9241-110 | U01, U02 |
| Quyền riêng tư | ISO/IEC 29100, Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15, Nghị định 356/2025/NĐ-CP (thay NĐ 13/2023 từ 01/01/2026) | P01, C12, R08, L08 |
| Chất lượng sản phẩm (NFR) | ISO/IEC 25010:2023 | R06, L06 |
| Dữ liệu thẻ | PCI DSS v4.0 | L05, L06, L08, R08 |
| API | OpenAPI 3.1, RFC 9110 | A03, R05, L05 |
| Bản tin thẻ | ISO 8583 | L01, L05 |

## 2. Kết quả tổng hợp

Mức đánh giá: ✅ Đạt · 🟡 Đạt một phần · ❌ Thiếu

| Tài liệu | Chuẩn | Mức | Đã có | Thiếu | Đã sửa ngày 23/11 |
|---|---|---|---|---|---|
| C03 Yêu cầu v1.3 + RTM | 29148, BABOK | 🟡 | Mã yêu cầu duy nhất; nguồn; ưu tiên MoSCoW; truy vết BR → FR → RULE → Story → UI → UAT; mô hình trạng thái; nhật ký thay đổi | (1) Không có yêu cầu cho hộ chiếu và người nước ngoài dù đã xây xong; (2) BR-12 và FR-09 chỉ nói "số CCCD"; (3) một số FR gộp nhiều yêu cầu (FR-11, FR-14), chưa "đơn nhất"; (4) thiếu cột cách kiểm chứng; (5) RTM chưa có NFR và test case T02; (6) thiếu phần thuật ngữ, giả định, ràng buộc | (1), (2), (4), (5) |
| C04–C13 Đặc tả nghiệp vụ | BABOK | 🟡 | Bảng quyết định, sơ đồ trạng thái, swimlane, ma trận phân quyền, ngoại lệ | Chỉ C04–C05 có tiêu chí nghiệm thu; hầu hết thiếu phiên bản, trạng thái và người duyệt ở đầu tài liệu | — |
| T01 Kế hoạch kiểm thử | 29119-3 | ✅ | Phạm vi, cấp độ, kỹ thuật thiết kế, môi trường, dữ liệu, tiêu chí vào/ra, phân loại lỗi, rủi ro, vai trò | Danh sách đối tượng kiểm thử kèm phiên bản; danh sách đầu ra; tiêu chí tạm dừng / tiếp tục; chiến lược kiểm thử lại và hồi quy; chỉ số theo dõi; lịch có ngày; phê duyệt | Thêm cả 7 mục |
| T02 Test case | 29119-3 | ✅ | Mã, mục tiêu, tiền điều kiện, dữ liệu, bước, kết quả mong đợi, ưu tiên, truy vết, cách chạy | Kết quả thực tế ghi gộp ở T03, chưa có nhật ký chạy cho từng case | — |
| T03 Báo cáo kiểm thử | 29119-3 | 🟡 | Tóm tắt, số liệu, chi tiết, lỗi, rủi ro còn lại, đề xuất | Sai lệch so với kế hoạch; bài học kinh nghiệm; đầu ra có thể tái sử dụng; phê duyệt. Lỗi chưa tách mức nghiêm trọng với mức ưu tiên và chưa có ngày | Thêm 4 mục đầu |
| C15 Kế hoạch hiệu năng | 29119-3 | 🟡 | Điểm đo, kịch bản, quy tắc đánh giá, mẫu báo cáo | Tiêu chí vào/ra, môi trường, vai trò | — |
| C16 SIT, C17 UAT | 29119-3 | ✅ | Kịch bản, điều kiện vào/ra, dữ liệu, mẫu ghi kết quả, biên bản ký | — | — |
| A01 Tổng quan giải pháp | C4 | 🟡 | Sơ đồ Context và Container, luồng end-to-end | Chưa có chú giải ký hiệu; container chưa ghi công nghệ thống nhất; chưa nêu các bên liên quan và mối quan tâm của họ (42010) | — |
| Sơ đồ quy trình (C07, C10, C12…) | BPMN 2.0 | 🟡 | Có làn theo vai trò, điểm quyết định | Vẽ bằng Mermaid nên không có ký hiệu BPMN chuẩn (sự kiện bắt đầu/kết thúc, gateway, thông điệp) | — |
| Sơ đồ trạng thái, tuần tự | UML 2.5 | ✅ | Đúng ký hiệu | — | — |
| U01 App khách | WCAG 2.2 AA | 🟡 | Vùng chạm, tương phản, trình đọc màn hình, chuyển động | (1) Giới hạn thời gian: phiên hết hạn sau 30 phút và thử thách liveness không báo trước, không cho kéo dài (SC 2.2.1); (2) phóng to chữ 200% (SC 1.4.4); (3) báo lỗi bằng chữ (SC 3.3.1); (4) khai báo ngôn ngữ trang (SC 3.1.1); (5) cách xác thực thay thế khi khách không làm được liveness (SC 3.3.8) | Thêm (1)–(5) vào quy ước |
| U02 Compliance | WCAG 2.2 AA | 🟡 | Bàn phím, nhãn có chữ kèm màu | Thứ tự focus, vùng thông báo `aria-live` cho kết quả thao tác | — |
| P01 Điều khoản, quyền riêng tư | ISO 29100, Luật 91/2025, NĐ 356/2025 | 🟡 | Đồng ý theo mục đích, quyền rút lại, thời hạn lưu, bảo mật, liên hệ | (1) Danh sách bên nhận dữ liệu (CIC, nhà cung cấp AML, sinh trắc); (2) chuyển dữ liệu ra nước ngoài, nếu đặt database ngoài Việt Nam thì phải có hồ sơ đánh giá tác động chuyển dữ liệu; (3) đầu mối bảo vệ dữ liệu; (4) thời hạn trả lời yêu cầu của chủ thể dữ liệu | Thêm vào câu hỏi cho Pháp chế |
| C01, C18 | — | — | Nhật ký và từ điển chỉ số, không có chuẩn bắt buộc | — | — |

Cột "Mức" là sau khi sửa: **4 ✅ · 9 🟡 · 0 ❌**. Không còn mục nào thiếu hoàn toàn.

### 2.2 Module 2 Đối soát và Module 3 Hạn mức (26/11/2026)

Hai module viết sau khi đã có quy ước ở §4, nên mỗi tài liệu đều có dòng *Chuẩn tham chiếu* và mục kiểm soát tài liệu (phiên bản, lịch sử, phê duyệt). Đánh giá theo cùng cách với §2.

| Tài liệu | Chuẩn | Mức | Đã có | Thiếu |
|---|---|---|---|---|
| R01, L01 Luồng | BPMN 2.0, UML 2.5, BABOK | 🟡 | Sequence, state, flowchart đúng ký hiệu UML; bảng quy tắc | Như Module 1: quy trình vẽ Mermaid, không có ký hiệu BPMN chuẩn |
| R02, L02 Yêu cầu, điểm lệch, RTM | 29148, BABOK | ✅ | Đánh giá từng BR so baseline; điểm lệch có người quyết; yêu cầu "Hệ thống phải…" một ý, có nguồn, MoSCoW; dữ liệu cần thêm; RTM BR → UC → RULE → US → REQ → màn → ca kiểm thử → UAT → Jira; câu hỏi mở | — |
| R03, L03 Giao diện | WCAG 2.2 AA | 🟡 | Ảnh từng màn chụp tự động, bảng mục / quy tắc / ghi chú, phân quyền hiển thị; L03 có mục WCAG | R03 chưa có mục WCAG riêng; tương phản nhãn xám chưa đo |
| R04, L04 Kiểm thử UI | 29119-3 | ✅ | Phạm vi, kỹ thuật thiết kế ca, môi trường, tiêu chí vào / ra, ca có bước – mong đợi – thực tế – truy vết, kết quả chạy thật, lỗi có mức và cách tái hiện, độ phủ, phê duyệt | Chưa tách mức nghiêm trọng với mức ưu tiên (như T03) |
| R05, L05 API, dữ liệu | OpenAPI 3.1, BABOK §10.15, PCI DSS | 🟡 | Quy ước, vai trò, SoD, ERD, từ điển trường có nguồn và mức PII, vòng đời, API, mã lỗi, sự kiện, ánh xạ UI → API | Chưa xuất file OpenAPI (`.yaml`) như mô tả bảng; thời hạn lưu còn là *đề xuất* |
| R06, L06 NFR, KPI | 25010, 29148 | ✅ | NFR nhóm theo đặc tính 25010, ngưỡng đo được, nguồn baseline / đề xuất, cách kiểm; KPI theo BRD §1.9 có công thức và truy vấn kiểm chứng | — |
| R07, L07 SIT, hiệu năng, UAT | 29119-3 | ✅ | Bản đồ tích hợp, kịch bản, tiêu chí vào / ra, mô hình tải, dữ liệu UAT, vai trò, biên bản ký, rủi ro kiểm thử | Chưa chạy được (chờ backend) – không phải thiếu tài liệu |
| R08, L08 Tuân thủ, điều khoản | ISO 29100, Luật 91/2025, PCI DSS | 🟡 | Phạm vi văn bản có cột *cần xác minh*, ma trận yêu cầu ↔ hiện trạng, phạm vi đồng ý, bên nhận dữ liệu, dự thảo điều khoản, câu hỏi Pháp chế | Toàn bộ số hiệu văn bản chưa được Pháp chế đối chiếu bản gốc |
| X01 Kiểm tra luồng | 29148 §5.2.5, BABOK *Verify Requirements* | ✅ | Ma trận độ đầy đủ, hành trình 14 chặng, điểm lệch có bằng chứng và trạng thái | — |

Kết quả Module 2, 3: **5 nhóm ✅ · 4 nhóm 🟡 · 0 ❌**.

## 3. Việc còn lại

| # | Việc | Tài liệu | Ưu tiên |
|---|---|---|---|
| 1 | ~~Viết lại FR theo dạng "Hệ thống phải…", mỗi FR một yêu cầu kiểm chứng được; tách FR-11, FR-14~~ ✅ 24/11 (C03 draft3) | C03 | Cao |
| 2 | Thêm phần thuật ngữ, giả định, ràng buộc, phụ thuộc | C03 | TB |
| 3 | Thêm khối kiểm soát tài liệu (phiên bản · trạng thái · người soạn · người duyệt) cho C04–C13, C15, C18, A02 | Nhiều | TB |
| 4 | Thêm tiêu chí nghiệm thu dạng Given/When/Then cho từng RULE | C06–C13 | TB |
| 5 | Vẽ lại sơ đồ quy trình bằng công cụ BPMN (bpmn.io / Camunda Modeler) cho C07 và C10 | C07, C10 | Thấp |
| 6 | Thêm chú giải C4 và bảng bên liên quan | A01 | Thấp |
| 7 | Ghi kết quả thực tế cho từng test case vòng 2 (nhật ký chạy) | T02/T03 | TB |
| 8 | Bổ sung mục chuyển dữ liệu ra nước ngoài và danh sách bên nhận sau khi Pháp chế trả lời. 🟡 24/11: đã lập dự thảo P01 §4.1 (7 bên nhận, 2 phương án nơi đặt dữ liệu); còn chờ Pháp chế trả lời câu 6–8 | P01 | Cao, trước khi chọn nơi đặt database |
| 9 | ~~Lập đặc tả API kèm mã lỗi~~ ✅ 24/11 (A03) | A03 | Cao |
| 10 | ~~Lập từ điển dữ liệu, phân loại mức nhạy cảm và thời hạn lưu~~ ✅ 24/11 (D01) | D01 | Cao |
| 11 | Thêm mục WCAG 2.2 cho R03 (như L03 §7) | R03 | TB |
| 12 | Xuất OpenAPI `.yaml` từ R05, L05 (và A03) để dev sinh code / test hợp đồng | A03, R05, L05 | TB |
| 13 | Pháp chế đối chiếu bản gốc các văn bản ở R08 §1, L08 §1 | R08, L08 | Cao, trước go-live |

## 4. Quy ước từ nay

Mỗi tài liệu mới hoặc sửa lớn phải có dòng **Chuẩn tham chiếu** trong bảng đầu tài liệu, và chỉ ghi "đạt" sau khi đã đối chiếu theo bảng ở mục 2.

## 5. Kiểm soát tài liệu

### Tài liệu tham chiếu

Không tham chiếu tài liệu khác trong bộ.

Chuẩn quốc tế: xem trường *Chuẩn tham chiếu* ở đầu trang.

### Lịch sử phiên bản

| Phiên bản | Ngày | Người sửa | Commit | Thay đổi |
|---|---|---|---|---|
| 1.0 | 23/11/2026 | Han Dao | — | Đánh giá 22 tài liệu Module 1 |
| 1.1 | 26/11/2026 | Han Dao | — | Thêm §2.2 đánh giá Module 2, 3 và X01; thêm chuẩn 25010, PCI DSS, OpenAPI, ISO 8583 vào §1; việc 11 → 13 |
| 1.2 | 26/11/2026 | Han Dao | — | Chuẩn hoá cấu trúc theo ISO/IEC/IEEE 15289: khối thuộc tính đầu trang, tài liệu tham chiếu, thuật ngữ dùng chung (G02), mục kiểm soát tài liệu thống nhất |

### Phê duyệt

| Vai trò | Người | Ngày | Kết luận |
|---|---|---|---|
| BA (tự đánh giá) | Han Dao | 26/11/2026 | Trình xem xét |
| QA Lead |  |  |  |
| Product Owner |  |  |  |
