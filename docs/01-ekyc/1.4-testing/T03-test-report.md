# T03 · Báo cáo kết quả kiểm thử – Module 1 eKYC (vòng nội bộ 1)

| | |
|---|---|
| Vòng | Kiểm thử hệ thống nội bộ, trước SIT |
| Thời gian | 22 – 23/11/2026 |
| Phiên bản | `main` @ commit `a97e848` + bản sửa trong báo cáo này |
| Người thực hiện | Han Dao (BA) |
| Môi trường | macOS, Node 23.11, `ekyc-service` SQLite, Next.js dev; Chrome (trình duyệt tích hợp), iOS Simulator iPhone 16 Pro qua link HTTPS tạm |
| Kế hoạch / test case | [T01](T01-test-plan.md) · [T02](T02-test-cases.md) |
| Chuẩn tham chiếu | ISO/IEC/IEEE 29119-3:2021 (Test Completion Report) – đánh giá ở [Q01](../../00-overview/Q01-standards-conformance.md) |

## 1. Tóm tắt

| Chỉ số | Kết quả |
|---|---|
| Test case | 106 |
| Đạt | **91** (86%) |
| Đạt một phần | 4 |
| Không đạt | **0** |
| Chưa chạy | 11 |
| Test tự động backend | **54 / 54 đạt** |
| Hồ sơ mẫu chạy qua backend | 15 / 15 cho kết quả đúng kỳ vọng |
| Lỗi phát hiện | 9 – **đã sửa cả 9**, kiểm lại đạt |

**Kết luận:** Module 1 đạt vòng kiểm thử nội bộ. **Chưa đủ điều kiện vào UAT** vì: (1) SIT với sandbox đối tác chưa chạy (C16); (2) 2 test case mức Cao mới đạt một phần (TC-NFR-04 mã hoá cột PII, TC-NFR-11 thử trên iPhone thật); (3) trợ năng chưa được kiểm bằng công cụ.

## 2. Kết quả theo nhóm

| Nhóm | Tổng | Đạt | Một phần | Chưa chạy | Không đạt |
|---|---|---|---|---|---|
| App khách (TC-APP) | 41 | 38 | 1 | 2 | 0 |
| Compliance (TC-CO) | 31 | 29 | 0 | 2 | 0 |
| API (TC-API) | 12 | 12 | 0 | 0 | 0 |
| Job nền (TC-JOB) | 6 | 6 | 0 | 0 | 0 |
| Phi chức năng (TC-NFR) | 16 | 6 | 3 | 7 | 0 |
| **Tổng** | **106** | **91** | **4** | **11** | **0** |

## 3. Chi tiết

### 3.1 Test tự động backend

Lệnh `npm run test:server` – 54 test, 0 lỗi, khoảng 0,4 giây. Nhóm test:

| File | Số test | Nội dung |
|---|---|---|
| `rules.test.ts` | 7 | Chuẩn hoá số, hạn/tuổi, trùng khách, cây quyết định, cần Checker, SLA, che tên |
| `customer-flow.test.ts` | 24 | UAT-EKYC-01 → 07, 10 → 15, 20 → 22, OCR ≠ chip, velocity, từng bị từ chối, token, sắp hết hạn |
| `compliance.test.ts` | 15 | Hàng đợi, UAT-08, 09, 16, 18, 19, 23, giới hạn bổ sung, hết hạn bổ sung, tự nhả, Checker trả lại, từ chối, audit bất biến, báo cáo |
| `passport.test.ts` | 5 | UAT-25, 26, trùng qua hộ chiếu, hộ chiếu không hợp lệ, số hộ chiếu lệch chip |
| `http.test.ts` | 3 | Luồng HTTP đầy đủ, phân quyền, CORS |

### 3.2 Chạy hồ sơ mẫu qua backend thật

Chạy 23/11/2026 trên dữ liệu vừa đặt lại; thời gian là của lời gọi ra quyết định (`POST …/liveness`).

| Hồ sơ | Kỳ vọng | Thực tế | Lý do (Compliance thấy) | ms | KQ |
|---|---|---|---|---|---|
| TD-01 | STP_APPROVED | STP_APPROVED | — | 2 | ✅ |
| TD-02 | REFER | REFER | NFC_SKIPPED | 1 | ✅ |
| TD-03 | REFER | REFER | LIVENESS_BORDERLINE | 2 | ✅ |
| TD-04 | REFER → Maker-Checker | REFER | PEP_MATCH | 1 | ✅ |
| TD-05 | REJECTED | REJECTED (lý do chung) | — | 2 | ✅ |
| TD-06 | REFER | REFER | CIC_TIMEOUT | 1 | ✅ |
| TD-07 | Lỗi chụp 3 lần → REFER | REFER | OCR_UNREADABLE | — | ✅ |
| TD-08 | STOPPED_DUPLICATE | STOPPED_DUPLICATE | — | — | ✅ |
| TD-09 | REJECTED DOC_EXPIRED | REJECTED DOC_EXPIRED | — | — | ✅ |
| TD-10 | REJECTED UNDER_AGE | REJECTED UNDER_AGE | — | — | ✅ |
| TD-12 | REFER | REFER | CHIP_AUTH_FAILED | 1 | ✅ |
| TD-13 | REFER | REFER | DEVICE_MULTI_IDENTITY | 1 | ✅ |
| TD-14 | STP_APPROVED | STP_APPROVED | — | 3 | ✅ |
| TD-15 | REFER | REFER | FOREIGN_NATIONAL | 1 | ✅ |
| TD-16 | STP + cảnh báo sắp hết hạn | STP, `warnings = DOC_EXPIRING_SOON` (test tự động) | — | — | ✅ |

TD-11 là hồ sơ có sẵn trong hàng đợi (tạo lùi thời gian) để thử SLA – kiểm qua TC-CO-05 và UAT-EKYC-18.

### 3.3 Kiểm thử đầu cuối (E2E) đã chạy

| Kịch bản | Test case | Bằng chứng | KQ |
|---|---|---|---|
| TD-01 đi hết 12 màn trên app → số TK 1903 6688 0001, hồ sơ EKS-2611-0051 | APP-01, 02, 07, 09 → 12, 19, 23, 24 | Log backend: `POST /api/sessions` → `…/liveness 200` | ✅ |
| TD-15 hộ chiếu Anh: chụp 1 trang → OCR → chip → REFER | APP-08, 13, 31 | Màn eKYC-05 hiện 533415151 / GBR; Compliance thấy "Hộ chiếu · GBR", số `5•••151` | ✅ |
| TD-04: Minh Anh làm Maker → Minh Anh bấm Checker bị chặn → đổi Hải Yến duyệt → tạo TK | CO-19, 20, 21 | Thông báo "Checker phải là người khác Maker"; "Đã phê duyệt · Trần Hải Yến" | ✅ |
| TD-03: Compliance yêu cầu bổ sung → app "Kiểm tra kết quả" → eKYC-11 → chụp lại → eKYC-09 "Đã nhận ảnh bổ sung" → hồ sơ lên đầu hàng đợi, SLA 0h | APP-32, 37, 38; CO-13 | API hàng đợi: EKS-2611-0057 `REFER_RESUBMITTED` | ✅ |
| Hải Yến đề xuất SLA 24 → 20h; Lê Quang Huy duyệt → áp dụng | CO-27, 31 | "Đã phê duyệt – áp dụng ngay"; SLA hiện tại 20h | ✅ |
| Hộp thoại điều khoản, chọn ưu đãi, rút đồng ý định danh | APP-03, 04, 39 | Bảng `consents` có `marketing`; "Đã rút lại đồng ý. Dữ liệu sẽ được xoá trong 24 giờ" | ✅ |
| TD-16 cảnh báo giấy tờ sắp hết hạn ở màn quét chip | APP-15 | Chữ "Giấy tờ sắp hết hạn" trên eKYC-03B | ✅ |
| Lỗi API: JSON sai, quá 1 MB, sai thứ tự bước, CCCD 11 số, health | API-04, 05, 09, 10, 12 | 400 · 413 · 409 `INVALID_STATE` · 422 · 200 | ✅ |
| Mở chi tiết 4 lần trong 1 phút | CO-10 | Chỉ 1 `CASE_VIEW` + 1 `VIEW_SENSITIVE` | ✅ |
| App trên iOS Simulator qua link HTTPS tạm | NFR-11 (một phần) | Màn đầu hiện ô hồ sơ mẫu → kết nối backend qua proxy | 🟡 |
| Bản GitHub Pages không backend | NFR-16 | Chạy chế độ demo, không lỗi console | ✅ |

### 3.4 Đạt một phần / chưa chạy

| Mã | Trạng thái | Lý do | Việc cần làm |
|---|---|---|---|
| TC-APP-11 | Một phần | Đã thử "Dùng ảnh này"; chưa thử "Chụp lại" | Chạy lại |
| TC-NFR-04 | Một phần | Khoá tra trùng đã băm; số thô vẫn nằm trong dữ liệu OCR, chưa mã hoá cột | Mã hoá cột khi chuyển Postgres |
| TC-NFR-11 | Một phần | Chỉ thử trên iOS Simulator; chưa thử iPhone thật với camera | Chạy trên iPhone qua link HTTPS |
| TC-NFR-13 | Một phần | Chỉ thử Chrome | Thử Edge, Safari |
| TC-APP-35, 36 | Chưa chạy | Ưu tiên thấp/TB | Vòng 2 |
| TC-CO-03, 24 | Chưa chạy | Ưu tiên TB | Vòng 2 |
| TC-NFR-06 → 10, 12, 14 | Chưa chạy | Cần thiết bị Android, VoiceOver, công cụ đo tương phản | Vòng 2 trước UAT |

## 4. Lỗi phát hiện

| Mã | Mô tả | Mức | Phát hiện bởi | Trạng thái |
|---|---|---|---|---|
| DEF-01 | Nút "Điều khoản và điều kiện" không mở gì; phiên bản hiển thị (3.2) lệch phiên bản backend kiểm tra (2026.11) | TB | Rà soát giao diện | ✅ Đã sửa – hộp thoại 8 mục, phiên bản lấy chung một nguồn |
| DEF-02 | Khách chọn "Nhận ưu đãi" nhưng không gửi về backend | TB | Rà soát code | ✅ Đã sửa |
| DEF-03 | Không có màn rút lại đồng ý dù màn Đồng ý nhắc tới (CR-07) | Cao | Rà soát yêu cầu | ✅ Đã sửa – màn eKYC-14 |
| DEF-04 | Cảnh báo "giấy tờ sắp hết hạn" (C05 #2) không hiện trên app | Thấp | Viết test case | ✅ Đã sửa |
| DEF-05 | Phiên hết hạn (EXPIRED) chưa xoá ảnh/dữ liệu chip ngay (C06) | Cao | Test tự động | ✅ Đã sửa |
| DEF-06 | Tải lại chi tiết hồ sơ ghi trùng audit "Mở chi tiết" | Thấp | E2E | ✅ Đã sửa – không ghi trùng trong 1 phút |
| DEF-07 | Hồ sơ đã quyết định vẫn hiện nhãn "Mới · Trong hạn" | Thấp | E2E | ✅ Đã sửa |
| DEF-08 | Chạy deploy làm hỏng dev server (lỗi 500 trên link test) | TB | E2E | ✅ Đã sửa – build dùng thư mục riêng |
| DEF-09 | Tên trong dòng MRZ của hộ chiếu nước ngoài sai thứ tự họ/tên | Thấp | E2E | ✅ Đã sửa |

## 5. Rủi ro còn lại

| Rủi ro | Mức | Xử lý đề xuất |
|---|---|---|
| CIC, AML, Core Banking, Notification đang là bản giả lập | Cao | SIT theo C16 khi có sandbox (SCRUM-56) |
| Điểm liveness/face match do app gửi lên, chưa tính ở server | Cao | Tích hợp nhà cung cấp sinh trắc; spike C14 |
| Web không đọc được chip NFC | TB | Dùng app Aegis Scan (A02) cho bước chip |
| Dữ liệu chạy SQLite trên máy cá nhân | TB | Chuyển Postgres trên cloud, mã hoá cột PII |
| Văn bản pháp lý chưa được Pháp chế xác minh | Cao | Hoàn tất C02 và P01 §4 trước UAT |

## 6. Đề xuất

1. Chạy vòng 2: 11 case chưa chạy và 4 case một phần, ưu tiên TC-NFR-11 trên iPhone thật.
2. Đưa dữ liệu lên Postgres trên cloud và mã hoá cột PII, để đóng TC-NFR-04.
3. Lên lịch SIT (C16) ngay khi có sandbox, rồi mới UAT (C17).

## 7. Sai lệch so với kế hoạch

| Kế hoạch (T01) | Thực tế | Lý do |
|---|---|---|
| Chạy E2E trên iPhone thật | Chỉ chạy trên iOS Simulator | Camera iPhone cần HTTPS; link HTTPS tạm có sau khi đã chạy vòng |
| Thử Chrome, Edge, Safari | Chỉ Chrome | Chưa sắp xếp máy |
| Kiểm trợ năng bằng công cụ | Chưa chạy | Chưa có công cụ đo tương phản, VoiceOver |
| Phạm vi ban đầu chỉ CCCD | Thêm luồng hộ chiếu giữa vòng (TD-14, TD-15, 5 test tự động) | Yêu cầu bổ sung của PO |

## 8. Bài học kinh nghiệm

1. Chạy `next build` khi `next dev` đang chạy làm hỏng thư mục build dùng chung (DEF-08). Build và dev phải dùng thư mục riêng.
2. Viết test case từ đặc tả giúp tìm lỗi trước khi chạy (DEF-01, 03, 04). Nên viết T02 trước khi code xong.
3. Yêu cầu mới (hộ chiếu) được xây trước khi vào C03, nên ma trận truy vết bị thiếu. Yêu cầu mới phải vào C03 trước.

## 9. Đầu ra tái sử dụng được

Bộ hồ sơ mẫu TD-01 → TD-16 (`server/src/personas.ts`), 54 test tự động, API đặt lại dữ liệu và tua giờ (`/api/dev/*`), script chụp màn hình (`tools/diagrams/screens.mjs`).

## 10. Phê duyệt

| Vai trò | Người | Ngày | Kết luận |
|---|---|---|---|
| BA (thực hiện) | Han Dao | 23/11/2026 | Đạt vòng nội bộ 1, chưa đủ điều kiện UAT |
| QA Lead | | | |
| PO | | | |
