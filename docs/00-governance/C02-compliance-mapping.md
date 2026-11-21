# C02 · Compliance Mapping – eKYC

| | |
|---|---|
| Jira | [SCRUM-71](https://baohandao2303.atlassian.net/browse/SCRUM-71) · Spike |
| Trạng thái tài liệu | **Bản nháp v0.1 – chờ Compliance xác nhận** |
| Đầu ra cho | C03 (BRD v1.3), C05, C11, C12 |

> ⚠️ Số hiệu và nội dung văn bản dưới đây là **điểm khởi đầu để rà soát**, viết dựa trên hiểu biết chung về quy định Việt Nam. Trước khi đưa vào BRD, phải đối chiếu bản gốc và tình trạng hiệu lực trên cổng văn bản chính thức (vbpl.vn, sbv.gov.vn). Cột "Cần xác minh" đánh dấu những chỗ chưa chắc chắn.

## 1. Phạm vi văn bản

| Mã | Văn bản | Chủ đề liên quan eKYC | Cần xác minh |
|---|---|---|---|
| L-01 | Quy định NHNN về mở tài khoản thanh toán (vd. Thông tư 17/2024/TT-NHNN) | Mở tài khoản bằng phương thức điện tử, đối chiếu sinh trắc học với dữ liệu chip / CSDL dân cư | Điều khoản cụ thể, ngày hiệu lực, các sửa đổi |
| L-02 | Quy định NHNN về an toàn giao dịch trực tuyến (vd. Quyết định 2345/QĐ-NHNN) | Xác thực sinh trắc học khi giao dịch | Phạm vi áp dụng cho bước mở tài khoản |
| L-03 | Nghị định 13/2023/NĐ-CP và Luật Bảo vệ dữ liệu cá nhân | Đồng ý, rút lại đồng ý, dữ liệu nhạy cảm (sinh trắc học), DPIA | Văn bản nào đang có hiệu lực, thời hạn lưu trữ |
| L-04 | Luật Phòng, chống rửa tiền 2022 và văn bản hướng dẫn | Nhận biết khách hàng, PEP, danh sách cấm, lưu trữ hồ sơ | Thời hạn lưu hồ sơ KYC |
| L-05 | Bộ luật Dân sự (năng lực hành vi) và quy định sản phẩm | Độ tuổi tối thiểu mở tài khoản / dùng sản phẩm tín dụng | Ngưỡng tuổi cho từng sản phẩm |

## 2. Ma trận đối chiếu

Trạng thái: ✅ Đáp ứng · 🟡 Một phần · ❌ Chưa có

| Mã yêu cầu | Nguồn | Yêu cầu (tóm tắt) | Hiện trạng Aegis | Trạng thái | Hành động |
|---|---|---|---|---|---|
| CR-01 | L-01 | Thu thập thông tin định danh từ giấy tờ có chip | OCR + NFC (SCRUM-18) | ✅ | — |
| CR-02 | L-01 | Đối chiếu khuôn mặt với **dữ liệu sinh trắc học gốc** (chip / CSDL dân cư) | So với ảnh in trên thẻ (SCRUM-19) | ❌ | C11 – SCRUM-80 |
| CR-03 | L-01 | Không mở tài khoản tự động khi chưa xác thực được nguồn sinh trắc học | Fallback OCR-only vẫn có thể STP (CR-001) | ❌ | C11 – OCR-only tối đa REFER |
| CR-04 | L-01 | Xác thực tính toàn vẹn của chip (chữ ký số) | `integrity_check` (SCRUM-18) | 🟡 | C11 – lưu `chip_auth_result` |
| CR-05 | L-03 | Đồng ý rõ ràng, theo từng mục đích | ConsentRecord theo scope (SCRUM-17) | ✅ | — |
| CR-06 | L-03 | Đồng ý lại khi điều khoản thay đổi | Re-consent (SCRUM-46) | ✅ | — |
| CR-07 | L-03 | Chủ thể dữ liệu được rút lại đồng ý | Chưa có | ❌ | C12 – SCRUM-81 |
| CR-08 | L-03 | Xoá / ẩn danh dữ liệu khi hết mục đích | Chưa có chính sách | ❌ | C12 + C06 |
| CR-09 | L-03 | Đánh giá tác động xử lý dữ liệu (DPIA) | DPIA (SCRUM-32) | ✅ | Cập nhật cho C11–C13 |
| CR-10 | L-04 | Sàng lọc PEP, danh sách cấm | AML/PEP/Sanction (SCRUM-20) | ✅ | — |
| CR-11 | L-04 | Quyết định với khách rủi ro cao cần cấp có thẩm quyền | Chưa có Maker-Checker | ❌ | C10 – SCRUM-79 |
| CR-12 | L-04 | Lưu hồ sơ nhận biết khách hàng đủ thời hạn | Chưa có retention | ❌ | C12 |
| CR-13 | L-04 | Lưu vết truy cập và quyết định | Audit một phần | 🟡 | C10 |
| CR-14 | L-05 | Kiểm tra độ tuổi theo sản phẩm | Chưa có | ❌ | C05 – SCRUM-74 |
| CR-15 | L-01 | Giấy tờ còn hiệu lực | Chưa kiểm tra hạn | ❌ | C05 |

## 3. Tổng hợp

| Trạng thái | Số yêu cầu |
|---|---|
| ✅ Đáp ứng | 6 |
| 🟡 Một phần | 2 |
| ❌ Chưa có | 7 |

**Ưu tiên chặn go-live:** CR-02, CR-03, CR-07, CR-08, CR-11, CR-12.

## 4. Câu hỏi mở cho Compliance

1. Ngưỡng tuổi tối thiểu cho tài khoản thanh toán và cho sản phẩm hạn mức tín dụng là bao nhiêu?
2. Aegis có được kết nối CSDL dân cư (C06/VNeID) không, hay chỉ dùng ảnh DG2 trong chip?
3. Thời hạn lưu hồ sơ KYC sau khi đóng tài khoản, và với hồ sơ bị từ chối?
4. Thay đổi ngưỡng rủi ro có cần phê duyệt hai người không? (Đề xuất: có – xem C10.)

## 5. Phê duyệt

| Vai trò | Người | Ngày | Kết luận |
|---|---|---|---|
| BA | Han Dao | 21/11/2026 | Soạn bản nháp |
| Compliance | | | |
