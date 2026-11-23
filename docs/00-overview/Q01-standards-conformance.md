# Q01 · Đối chiếu tài liệu Module 1 với chuẩn quốc tế

| | |
|---|---|
| Phạm vi | 22 tài liệu trong `00-overview/` và `01-ekyc/` |
| Người rà soát | Han Dao (BA) |
| Ngày | 23/11/2026 |
| Phiên bản | 1.0 |
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
| Quyền riêng tư | ISO/IEC 29100, Nghị định 13/2023/NĐ-CP | P01, C12 |

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
| P01 Điều khoản, quyền riêng tư | ISO 29100, NĐ 13 | 🟡 | Đồng ý theo mục đích, quyền rút lại, thời hạn lưu, bảo mật, liên hệ | (1) Danh sách bên nhận dữ liệu (CIC, nhà cung cấp AML, sinh trắc); (2) chuyển dữ liệu ra nước ngoài, nếu đặt database ngoài Việt Nam thì phải có hồ sơ đánh giá tác động chuyển dữ liệu; (3) đầu mối bảo vệ dữ liệu; (4) thời hạn trả lời yêu cầu của chủ thể dữ liệu | Thêm vào câu hỏi cho Pháp chế |
| C01, C18 | — | — | Nhật ký và từ điển chỉ số, không có chuẩn bắt buộc | — | — |

Cột "Mức" là sau khi sửa: **4 ✅ · 9 🟡 · 0 ❌**. Không còn mục nào thiếu hoàn toàn.

## 3. Việc còn lại

| # | Việc | Tài liệu | Ưu tiên |
|---|---|---|---|
| 1 | Viết lại FR theo dạng "Hệ thống phải…", mỗi FR một yêu cầu kiểm chứng được; tách FR-11, FR-14 | C03 | Cao |
| 2 | Thêm phần thuật ngữ, giả định, ràng buộc, phụ thuộc | C03 | TB |
| 3 | Thêm khối kiểm soát tài liệu (phiên bản · trạng thái · người soạn · người duyệt) cho C04–C13, C15, C18, A02 | Nhiều | TB |
| 4 | Thêm tiêu chí nghiệm thu dạng Given/When/Then cho từng RULE | C06–C13 | TB |
| 5 | Vẽ lại sơ đồ quy trình bằng công cụ BPMN (bpmn.io / Camunda Modeler) cho C07 và C10 | C07, C10 | Thấp |
| 6 | Thêm chú giải C4 và bảng bên liên quan | A01 | Thấp |
| 7 | Ghi kết quả thực tế cho từng test case vòng 2 (nhật ký chạy) | T02/T03 | TB |
| 8 | Bổ sung mục chuyển dữ liệu ra nước ngoài và danh sách bên nhận sau khi Pháp chế trả lời | P01 | Cao, trước khi chọn nơi đặt database |

## 4. Quy ước từ nay

Mỗi tài liệu mới hoặc sửa lớn phải có dòng **Chuẩn tham chiếu** trong bảng đầu tài liệu, và chỉ ghi "đạt" sau khi đã đối chiếu theo bảng ở mục 2.
