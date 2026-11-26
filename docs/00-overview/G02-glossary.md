# G02 · Thuật ngữ và chữ viết tắt

| | |
|---|---|
| Mã tài liệu | AEG-GEN-G02 |
| Phiên bản | 1.0 |
| Ngày phát hành | 26/11/2026 |
| Trạng thái | ✅ Dùng chung cho mọi tài liệu `docs/` |
| Phân loại | Nội bộ |
| Tác giả | Han Dao (BA) |
| Người duyệt | Product Owner – chưa duyệt |
| Mục đích và phạm vi | Định nghĩa thuật ngữ, chữ viết tắt, mã yêu cầu và ký hiệu trạng thái dùng chung cho mọi tài liệu |
| Chuẩn tham chiếu | ISO/IEC/IEEE 24765:2017 (từ vựng kỹ thuật hệ thống và phần mềm) · ISO/IEC/IEEE 15289:2019 §7 (mục thuật ngữ của tài liệu) |

Mỗi tài liệu dẫn tới bảng này thay vì lặp lại thuật ngữ. Mã yêu cầu (BR-, FR-, RULE-, REQ-, NFR-, UAT-, TC-) giải thích ở §3.

## 1. Nghiệp vụ và sản phẩm

| Thuật ngữ | Nghĩa trong dự án | Dùng ở |
|---|---|---|
| eKYC | Định danh khách hàng điện tử: mở tài khoản từ xa bằng giấy tờ, chip và khuôn mặt | Module 1 |
| STP (Straight-Through Processing) | Hồ sơ được duyệt tự động, không cần người xem | C03, A01 §4 |
| REFER | Hồ sơ chuyển hàng đợi để Compliance duyệt tay | C07–C09 |
| PEP | Người có ảnh hưởng chính trị – luôn REFER | C03 RULE-EKYC-04 |
| AML / Sanction | Phòng chống rửa tiền / danh sách cấm vận | C02, C16 |
| CIC | Trung tâm Thông tin tín dụng quốc gia – tra lịch sử nợ | C16 |
| Maker-Checker | Một người tạo, người khác duyệt; người tạo không tự duyệt | C10, R01 §4 |
| SoD (Segregation of Duties) | Phân tách nhiệm vụ. Đối soát có SoD-1/2/3 (R05 §1.1) | R05, G01 |
| Đối soát (Reconciliation) | So khớp giao dịch nội bộ với dữ liệu đối tác để phát hiện lệch | Module 2 |
| Ngoại lệ (Exception) | Giao dịch không khớp, khớp một phần hoặc trùng – cần người xử lý | R01 §3 |
| Bút toán GL (GL entry) | Ghi sổ cái kế toán; mỗi bút toán có tổng Nợ = tổng Có | R01 §4 |
| Zero-touch | Bút toán ≤ ngưỡng tự hạch toán, không cần Checker | RULE-REC-04 |
| EXACT / FUZZY / N:1 | Ba kiểu khớp: tuyệt đối theo khoá; gần đúng theo điểm; một giao dịch nội bộ với nhiều giao dịch đối tác | R01, R05 |
| EOD (End of Day) | Đối chiếu cuối ngày giữa Hạn mức và sổ cái | REQ-REC-20 |
| MTTR | Thời gian trung bình từ lúc mở tới lúc đóng ngoại lệ | R06 |
| Hạn mức thời gian thực | Kiểm tra và trừ hạn mức thẻ trong lúc cấp phép giao dịch | Module 3 |
| Boost (Temporary Limit Boost) | Nâng hạn mức tạm thời, tự trở về khi hết hạn | L01 §4 |
| Smart Fallback | Dùng tiền tài khoản thanh toán (CASA) khi hạn mức thẻ không đủ | L01 |
| CASA | Tài khoản thanh toán và tiết kiệm không kỳ hạn | L01 |
| SLA | Thời hạn cam kết xử lý (hồ sơ REFER: 24 giờ) | C09 |

## 2. Kỹ thuật

| Thuật ngữ | Nghĩa | Dùng ở |
|---|---|---|
| OCR | Nhận dạng chữ từ ảnh giấy tờ | U01, A02 |
| MRZ | Vùng đọc bằng máy trên giấy tờ (TD1 CCCD 3 dòng, TD3 hộ chiếu 2 dòng) | A02 |
| NFC | Giao tiếp tầm gần – đọc chip CCCD / hộ chiếu | A02, C11 |
| DG1 / DG2 / SOD | Nhóm dữ liệu trên chip theo ICAO 9303: thông tin, ảnh khuôn mặt, chữ ký số | C11 |
| CSCA | Chứng thư gốc của cơ quan cấp giấy tờ, dùng xác minh chữ ký chip | C11, A02 |
| Liveness | Kiểm tra người thật trước camera (chống ảnh in, video, mặt nạ) | C14 |
| PAD / APCER / BPCER | Phát hiện giả mạo sinh trắc; tỷ lệ chấp nhận nhầm tấn công / từ chối nhầm người thật (ISO/IEC 30107-3) | C14 |
| ISO 8583 / MTI | Chuẩn thông điệp giao dịch thẻ; mã loại thông điệp (0100 cấp phép, 0420 huỷ) | L01 |
| ISO 20022 camt.053 / 054 | Chuẩn sao kê / thông báo ghi nợ-có giữa ngân hàng | R05, services/reconciliation |
| TC33 / IPM | Định dạng file quyết toán của Visa / Mastercard | R05 |
| PAN | Số thẻ đầy đủ – không bao giờ lưu dạng rõ (PCI DSS) | R05, L05 |
| Idempotency-Key | Khoá chống gọi lặp: gọi lại cùng khoá trả kết quả lần đầu | A03, R05 |
| Circuit breaker | Ngắt mạch khi hệ thống ngoài lỗi liên tục, tránh treo luồng | L01 §3, C16 |
| API Gateway | Cổng vào duy nhất, xác thực SSO rồi chuyển tiếp danh tính cho service | G01 G-SE-01 |
| Pub/Sub | Hàng đợi sự kiện giữa các module | A01 §2, X01 |

## 3. Quản lý yêu cầu và kiểm thử

| Mã / thuật ngữ | Nghĩa | Chuẩn |
|---|---|---|
| BRD / FSD / SRS | Tài liệu yêu cầu nghiệp vụ / đặc tả chức năng / đặc tả yêu cầu phần mềm | ISO/IEC/IEEE 29148 |
| BR- / FR- / NFR- | Yêu cầu nghiệp vụ / chức năng / phi chức năng | ISO/IEC/IEEE 29148 |
| RULE- | Quy tắc nghiệp vụ | BABOK v3 §10.9 |
| REQ- | Yêu cầu bổ sung phát hiện khi đối chiếu baseline (Module 2, 3) | R02, L02 |
| RTM | Ma trận truy vết yêu cầu → thiết kế → test | ISO/IEC/IEEE 29148 §6.6 |
| UC- / US- | Use case / user story | UML 2.5 · BABOK |
| TC- / UAT- / SIT- | Test case / kịch bản nghiệm thu / kịch bản tích hợp | ISO/IEC/IEEE 29119-3 |
| D-REC- / D-LIM- | Điểm lệch baseline chờ quyết định | R02 §3, L02 §3 |
| DEF- | Lỗi phát hiện khi kiểm thử | 29119-3 (incident report) |
| G-<vai>- | Phát hiện khi rà soát theo vai | G01 |
| RAID | Rủi ro, giả định, vấn đề, phụ thuộc | — |
| DPIA | Đánh giá tác động xử lý dữ liệu cá nhân | ISO/IEC 29134 · Luật 91/2025 |
| DPO | Người phụ trách bảo vệ dữ liệu cá nhân | ISO/IEC 29100 |

## 4. Ký hiệu trạng thái trong tài liệu

| Ký hiệu | Nghĩa |
|---|---|
| ✅ | Xong / đạt |
| 🟡 | Một phần / chấp nhận có điều kiện |
| 🔧 | Đang làm |
| 📝 | Bản nháp |
| ⛔ | Bị chặn / chưa chấp nhận |
| ❌ | Không đạt / chưa có |
| *cần xác minh* | Dữ kiện pháp lý chưa đối chiếu với văn bản gốc |
| *đề xuất* | Giá trị do BA đề xuất, chờ người có thẩm quyền chốt |

## 5. Kiểm soát tài liệu

### Tài liệu tham chiếu

Không tham chiếu tài liệu khác trong bộ.

Chuẩn quốc tế: xem trường *Chuẩn tham chiếu* ở đầu trang.

### Lịch sử phiên bản

| Phiên bản | Ngày | Người sửa | Commit | Thay đổi |
|---|---|---|---|---|
| 1.0 | 26/11/2026 | Han Dao | — | Bản đầu: thuật ngữ nghiệp vụ, kỹ thuật, mã yêu cầu và ký hiệu trạng thái dùng chung cho 3 module |

### Phê duyệt

| Vai trò | Người | Ngày | Kết luận |
|---|---|---|---|
| BA (soạn) | Han Dao | 26/11/2026 | Trình duyệt |
| Product Owner |  |  |  |
