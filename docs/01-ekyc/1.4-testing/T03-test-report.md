# T03 · Báo cáo kết quả kiểm thử – Module 1 eKYC (vòng nội bộ 1–2)

| | |
|---|---|
| Mã tài liệu | AEG-EKYC-T03 |
| Phiên bản | 1.4 |
| Ngày phát hành | 26/11/2026 |
| Trạng thái | ✅ Đạt vòng nội bộ 1 (91 đạt · 0 lỗi mở), hồi quy 25/11 và 26/11 đạt · vòng 2 (26/11): 103 đạt, 4 một phần, 1 chưa chạy · chưa đủ điều kiện UAT · chờ QA Lead, PO duyệt |
| Phân loại | Nội bộ |
| Tác giả | Han Dao (BA) |
| Người duyệt | QA Lead · PO – chưa duyệt |
| Mục đích và phạm vi | Báo cáo kết quả các vòng kiểm thử nội bộ Module 1, lỗi phát hiện và điều kiện vào UAT |
| Chuẩn tham chiếu | ISO/IEC/IEEE 29119-3:2021 (Test Completion Report) – đánh giá ở [Q01](../../00-overview/Q01-standards-conformance.md) |
| Thuật ngữ | [G02 Thuật ngữ và chữ viết tắt](../../00-overview/G02-glossary.md) |
| Vòng | Kiểm thử hệ thống nội bộ, trước SIT |
| Thời gian | 22 – 23/11/2026 · hồi quy 25/11/2026 và 26/11/2026 |
| Mã nguồn | `main` @ commit `a97e848` + bản sửa trong báo cáo này |
| Người thực hiện | Han Dao (BA) |
| Môi trường | macOS, Node 23.11, `ekyc-service` SQLite, Next.js dev; Chrome (trình duyệt tích hợp), iOS Simulator iPhone 16 Pro qua link HTTPS tạm |
| Kế hoạch / test case | [T01](T01-test-plan.md) · [T02](T02-test-cases.md) |

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

**Kết luận:** Module 1 đạt vòng kiểm thử nội bộ. **Chưa đủ điều kiện vào UAT** vì: (1) SIT với sandbox đối tác chưa chạy (C16); (2) 2 test case mức Cao mới đạt một phần (TC-NFR-04 mã hoá cột PII, TC-NFR-11 thử trên iPhone thật); (3) trợ năng mới đo tự động (vòng 2 đạt vùng chạm, tương phản, bàn phím), chưa thử VoiceOver và Android thật.

> **Hồi quy 25/11/2026** (mục 3.5): bộ test case tăng lên **108** (thêm TC-APP-42, TC-CO-32 cho tuổi tối thiểu 16), test tự động backend **57 / 57 đạt**. Hai case mới đạt, không phát sinh lỗi. Kết luận vòng 1 không đổi.

> **Hồi quy 26/11/2026** (mục 3.6): 57 / 57 test tự động đạt; chạy lại luồng TD-01 và Compliance trên backend thật đạt. Tìm và sửa thêm 2 lỗi dữ liệu mẫu (DEF-10, DEF-11) → tổng **11 lỗi, đã sửa cả 11**. Kết luận vòng 1 không đổi.

> **Vòng 2 – 26/11/2026** (mục 3.7): chạy 12 ca còn lại làm được trên máy tính (script `tools/diagrams/m1-round2.mjs`). 10 ca đạt, 2 ca đạt một phần (VoiceOver, Edge/Safari cần thiết bị). Tìm và sửa 2 lỗi trợ năng (DEF-12, DEF-13) → tổng **13 lỗi, đã sửa cả 13**. **Tổng 108 case: 103 đạt · 4 một phần · 1 chưa chạy (TC-NFR-12 Android) · 0 không đạt.**

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
| TC-APP-11 | ✅ Đạt ở vòng 2 (§3.7) | — | — |
| TC-NFR-04 | Một phần | Khoá tra trùng đã băm; số thô vẫn nằm trong dữ liệu OCR, chưa mã hoá cột | Mã hoá cột khi chuyển Postgres |
| TC-NFR-11 | Một phần | Chỉ thử trên iOS Simulator; chưa thử iPhone thật với camera | Chạy trên iPhone qua link HTTPS |
| TC-NFR-13 | Một phần (vòng 2 vẫn chỉ Chrome) | Máy chạy test chưa có Edge, Safari | Thử Edge, Safari |
| TC-APP-35, 36 · TC-CO-03, 24 · TC-NFR-06, 08, 09, 10, 14 | ✅ Đạt ở vòng 2 (§3.7) | — | — |
| TC-NFR-07 | Một phần (vòng 2) | Đã kiểm vùng `aria-live` / `role=status` trên màn NFC, liveness, đang xác minh; chưa nghe thử bằng VoiceOver | Thử VoiceOver trên iPhone |
| TC-NFR-12 | Chưa chạy | Cần máy Android thật | Trước UAT |

### 3.5 Hồi quy 25/11/2026

Chạy lại sau hai thay đổi: bản sửa quyền riêng tư ngày 24/11 (thông báo trùng khách an toàn cho hộ chiếu, Push không kèm số tài khoản, xoá thêm số điện thoại, dữ liệu sinh trắc, CIC và bộ đếm velocity cũ) và tuổi tối thiểu tài khoản thanh toán trực tuyến 15 → 16 (P01 PR-02). Lệnh `npm test` trong `server/`: **57 test, 0 lỗi**.

| File | Số test | Thay đổi so với vòng 1 |
|---|---|---|
| `rules.test.ts` | 7 | Ca tuổi viết lại: tròn 16 đúng ngày được, thiếu 1 ngày và 15 tuổi bị `UNDER_AGE` |
| `customer-flow.test.ts` | 26 | +2: các bản sửa quyền riêng tư 24/11 |
| `compliance.test.ts` | 16 | +1: *P01 PR-02* – đề xuất 15 bị chặn, giá trị 15 cũ trong DB bị bỏ qua |
| `passport.test.ts` | 5 | — |
| `http.test.ts` | 3 | — |

| Mã | Kết quả | Bằng chứng |
|---|---|---|
| TC-APP-42 | ✅ Đạt | `rules.test.ts` – *RULE-EKYC-10* |
| TC-CO-32 | ✅ Đạt | `compliance.test.ts` – *P01 PR-02*; gọi `POST /api/config/changes` trên backend đang chạy với giá trị 15 → 422 "Giá trị phải trong khoảng 16–25" |
| TC-APP-16, TC-CO-27 → 31 | ✅ Vẫn đạt | Cùng bộ test |

Tổng sau hồi quy: 108 case · 93 đạt · 4 một phần · 11 chưa chạy · 0 không đạt. Hồi quy không chạy lại E2E trên giao diện ngoài màn Cấu hình ngưỡng.

### 3.6 Hồi quy và chạy luồng đầu cuối 26/11/2026

Chạy khi rà soát toàn bộ tài liệu 3 module. Môi trường: `ekyc-service` local (cổng 8787) sau `POST /api/dev/reset`, web local (cổng 5179), trình duyệt không cấp quyền camera nên app dùng ảnh minh hoạ.

| Hạng mục | Kết quả |
|---|---|
| Test tự động backend (`npm --prefix server test`) | ✅ 57/57 đạt |
| Kiểm tra kiểu TypeScript toàn web (`tsc --noEmit`) | ✅ Không lỗi |
| Luồng khách TD-01 qua backend thật: Bắt đầu → Đồng ý → CCCD → chụp 2 mặt → xác nhận OCR → quét chip → khuôn mặt → kết quả | ✅ STP, "Mở tài khoản thành công", hồ sơ `EKS-2611-0051`, tài khoản `1903 6688 0001` |
| Chạy lại TD-01 khi chưa đặt lại dữ liệu | ✅ Dừng ở màn "Bạn đã có tài khoản" (C04, UAT-EKYC-12) – hành vi đúng; ghi chú: phải `POST /api/dev/reset` giữa các lượt UAT (T01 §2) |
| Compliance: hàng đợi, nhận hồ sơ `EKS-2611-0050`, phê duyệt có ghi chú | ✅ Che tên, SLA, so sánh OCR/chip đúng dữ liệu hồ sơ, nhật ký ghi "Nhận xử lý", "Phê duyệt" |
| Chuyển sang Module 3 bằng nút "Vào trang chủ" | ⚠️ Mở M1 với thẻ tín dụng mẫu – đã ghi ở L04 (DEF-LIM-08, 10), X01 F-01 |

Tìm thêm 2 lỗi dữ liệu mẫu (DEF-10, DEF-11, §4), đã sửa và chụp lại ảnh U01, U02.

### 3.7 Vòng 2 – 26/11/2026

Chạy các ca còn chưa chạy / một phần ở §3.4 mà làm được trên máy tính. Lệnh: `node tools/diagrams/m1-round2.mjs <thư mục ảnh>` (cần web cổng 5179 và `ekyc-service` cổng 8787; script tự gọi `POST /api/dev/reset`). Trình duyệt: Chrome headless trên macOS, khung app 390 × 844, Compliance 1280 × 860 và 900 × 860.

| Mã | Kết quả | Bằng chứng |
|---|---|---|
| TC-APP-11 | ✅ | Kiểm tra ảnh → Chụp lại về camera mặt trước → chụp → Dùng ảnh này sang mặt sau |
| TC-APP-35 | ✅ | Phiên dở `EKS-2611-0051` → Làm lại từ đầu → bảng `sessions`: `CANCELLED`, `ocr_json`, `chip_json` đã xoá; bấm Tiếp tục lần nữa báo không còn hồ sơ dở |
| TC-APP-36 | ✅ | Thiết bị mới → "Không có hồ sơ đang làm dở trên máy này." |
| TC-CO-03 | ✅ | Của tôi 1 / Đã bổ sung 1 / Chờ Checker 1 – số trên tab khớp số dòng, không dòng nào sai điều kiện |
| TC-CO-24 | ✅ | `EKS-2611-0031`: Tra cứu lại CIC → bỏ cờ `CIC_TIMEOUT`, hiện Nhóm CIC · hồ sơ TD-06 `EKS-2611-0052` (CIC luôn lỗi): "CIC vẫn chưa phản hồi, thử lại sau" (503) |
| TC-NFR-06 | ✅ sau khi sửa DEF-13 | Lượt đầu 44 phần tử < 44 × 44 (nút Quay lại, Hỗ trợ 40 × 40; nút VI/EN 34 × 24; nút phụ 40 cao; nút sao chép 36 × 36). Sau sửa: 0 phần tử trên 10 màn |
| TC-NFR-07 | 🟡 Một phần | Lượt đầu màn NFC không có vùng thông báo khi chưa bấm quét (DEF-12). Sau sửa: NFC 1, liveness 1, đang xác minh 1 vùng. Chưa nghe thử bằng VoiceOver |
| TC-NFR-08 | ✅ | Đo theo công thức WCAG 2.2 trên 10 màn app (nền sáng) và hàng đợi Compliance (nền tối): 0 đoạn chữ dưới 4.5:1 (chữ lớn 3:1). Bỏ qua chữ nằm trên ảnh / nền gradient – cần kiểm bằng mắt |
| TC-NFR-09 | ✅ | 12 lần Tab qua thanh trên và menu, 12/12 có viền focus; Enter trên "Từ chối" mở hộp thoại, Esc đóng |
| TC-NFR-10 | ✅ | `?lang=en` trên 10 màn: 0 dòng chữ giao diện còn tiếng Việt (chỉ còn dữ liệu hồ sơ như quê quán); mở lại không có `?lang` vẫn giữ EN |
| TC-NFR-13 | 🟡 Một phần | Toàn bộ ca Compliance ở trên chạy trên Chrome; chưa có Edge, Safari |
| TC-NFR-14 | ✅ | Compliance 900 px: không còn thanh bên, menu thành thanh ngang, trang không cuộn ngang, bảng cuộn trong khung |

Sau khi đổi cỡ nút dùng chung (nút cỡ vừa 40 → 44 px), chạy lại bộ UI Module 2 (25/25 đạt) và Module 3 (34/36, 2 ca không đạt như cũ) – không hồi quy. Ảnh U01, U02 chụp lại.

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
| DEF-10 | Ảnh minh hoạ thẻ (app khách và màn chi tiết Compliance) in dòng MRZ có số CCCD và ngày sinh cố định của TD-01, nên người duyệt thấy dữ liệu không khớp hồ sơ đang xem | Thấp | E2E 26/11 | ✅ Đã sửa – MRZ minh hoạ chỉ còn ký tự giữ chỗ |
| DEF-11 | Chế độ demo (bản GitHub Pages): mọi hồ sơ trong Compliance hiện cùng số CCCD `089•••••5678` và ngày sinh 15/03; hồ sơ bỏ qua NFC vẫn hiện dữ liệu chip | Thấp | E2E 26/11 | ✅ Đã sửa – dữ liệu demo lấy cùng số CCCD, ngày sinh với `server/src/seed.ts`; không NFC thì cột Chip để trống |
| DEF-12 | Màn quét chip chỉ tạo vùng `aria-live` khi bắt đầu đọc và đọc từng % tiến độ; trình đọc màn hình có thể bỏ qua vùng mới chèn hoặc đọc liên tục | TB | Vòng 2 (TC-NFR-07) | ✅ Đã sửa – vùng `role=status` luôn có sẵn, chỉ đọc 2 mốc "Đang đọc chip", "Đọc chip thành công" |
| DEF-13 | Vùng chạm nhỏ hơn 44 × 44 pt: nút Quay lại, Hỗ trợ (40), VI/EN (34 × 24), nút cỡ vừa (40 cao), nút sao chép số tài khoản (36), nút nhỏ trong cảnh báo bỏ qua NFC (32) | TB | Vòng 2 (TC-NFR-06) | ✅ Đã sửa – nút đầu trang 44, nút cỡ vừa 44 cao (cả web), VI/EN rộng 44 và vùng chạm cao 44, nút trên app không dùng cỡ nhỏ |

## 5. Rủi ro còn lại

| Rủi ro | Mức | Xử lý đề xuất |
|---|---|---|
| CIC, AML, Core Banking, Notification đang là bản giả lập | Cao | SIT theo C16 khi có sandbox (SCRUM-56) |
| Điểm liveness/face match do app gửi lên, chưa tính ở server | Cao | Tích hợp nhà cung cấp sinh trắc; spike C14 |
| Web không đọc được chip NFC | TB | Dùng app Aegis Scan (A02) cho bước chip |
| Dữ liệu chạy SQLite trên máy cá nhân | TB | Chuyển Postgres trên cloud, mã hoá cột PII |
| Văn bản pháp lý chưa được Pháp chế xác minh | Cao | Hoàn tất C02 và P01 §4 trước UAT |

## 6. Đề xuất

1. Còn 5 ca chưa đạt trọn: 4 ca cần thiết bị – TC-NFR-11 (Safari iPhone), TC-NFR-07 (VoiceOver), TC-NFR-12 (Android), TC-NFR-13 (Edge, Safari) – chạy trước UAT; TC-NFR-04 chờ Postgres.
2. Đưa dữ liệu lên Postgres trên cloud và mã hoá cột PII, để đóng TC-NFR-04.
3. Lên lịch SIT (C16) ngay khi có sandbox, rồi mới UAT (C17).

## 7. Sai lệch so với kế hoạch

| Kế hoạch (T01) | Thực tế | Lý do |
|---|---|---|
| Chạy E2E trên iPhone thật | Chỉ chạy trên iOS Simulator | Camera iPhone cần HTTPS; link HTTPS tạm có sau khi đã chạy vòng |
| Thử Chrome, Edge, Safari | Chỉ Chrome | Chưa sắp xếp máy |
| Kiểm trợ năng bằng công cụ | Vòng 2 đo tự động vùng chạm, tương phản, bàn phím; VoiceOver chưa chạy | Đo bằng script; chưa có iPhone thật cho VoiceOver |
| Phạm vi ban đầu chỉ CCCD | Thêm luồng hộ chiếu giữa vòng (TD-14, TD-15, 5 test tự động) | Yêu cầu bổ sung của PO |

## 8. Bài học kinh nghiệm

1. Chạy `next build` khi `next dev` đang chạy làm hỏng thư mục build dùng chung (DEF-08). Build và dev phải dùng thư mục riêng.
2. Viết test case từ đặc tả giúp tìm lỗi trước khi chạy (DEF-01, 03, 04). Nên viết T02 trước khi code xong.
3. Yêu cầu mới (hộ chiếu) được xây trước khi vào C03, nên ma trận truy vết bị thiếu. Yêu cầu mới phải vào C03 trước.

## 9. Đầu ra tái sử dụng được

Bộ hồ sơ mẫu TD-01 → TD-16 (`server/src/personas.ts`), 54 test tự động (57 từ 25/11), API đặt lại dữ liệu và tua giờ (`/api/dev/*`), script chụp màn hình (`tools/diagrams/screens.mjs`).

## 10. Kiểm soát tài liệu

### Tài liệu tham chiếu

| Mã | Tài liệu |
|---|---|
| Q01 | [Q01 · Đối chiếu tài liệu 3 module với chuẩn quốc tế](../../00-overview/Q01-standards-conformance.md) |
| T01 | [T01 · Kế hoạch kiểm thử tổng thể – Module 1 eKYC](T01-test-plan.md) |
| T02 | [T02 · Bộ test case chi tiết – Module 1 eKYC](T02-test-cases.md) |

Chuẩn quốc tế: xem trường *Chuẩn tham chiếu* ở đầu trang.

### Lịch sử phiên bản

| Phiên bản | Ngày | Người sửa | Commit | Thay đổi |
|---|---|---|---|---|
| 0.9 | 23/11/2026 | Han Dao | `95fb7b1` | Bản đầu |
| 1.0 | 23/11/2026 | Han Dao | `a435c61` | Bổ sung theo rà soát chuẩn Q01 (ISO/IEC/IEEE 29119-3, WCAG 2.2) |
| 1.1 | 25/11/2026 | Han Dao | — | Thêm mục 3.5 hồi quy 25/11: 57/57 test tự động, 2 case mới đạt; thêm mục kiểm soát tài liệu (phiên bản, lịch sử, phê duyệt) theo ISO/IEC/IEEE 29148 và 29119-3 |
| 1.2 | 26/11/2026 | Han Dao | — | Thêm mục 3.6: hồi quy 57/57, chạy luồng TD-01 và Compliance trên backend thật; DEF-10, DEF-11 đã sửa |
| 1.3 | 26/11/2026 | Han Dao | — | Thêm mục 3.7 vòng 2: 12 ca, 10 đạt, 2 một phần; DEF-12, DEF-13 đã sửa; tổng 103 đạt / 108 |
| 1.4 | 26/11/2026 | Han Dao | — | Chuẩn hoá cấu trúc theo ISO/IEC/IEEE 15289: khối thuộc tính đầu trang, tài liệu tham chiếu, thuật ngữ dùng chung (G02), mục kiểm soát tài liệu thống nhất |

### Phê duyệt

| Vai trò | Người | Ngày | Kết luận |
|---|---|---|---|
| BA (thực hiện) | Han Dao | 23/11/2026 | Đạt vòng nội bộ 1, chưa đủ điều kiện UAT |
| QA Lead |  |  |  |
| PO |  |  |  |
