# T01 · Kế hoạch kiểm thử tổng thể – Module 1 eKYC

| | |
|---|---|
| Module | eKYC – mở tài khoản trực tuyến (app khách, Aegis Compliance, `ekyc-service`) |
| Epic | [SCRUM-69](https://baohandao2303.atlassian.net/browse/SCRUM-69) |
| Tài liệu đi kèm | [T02 Bộ test case](T02-test-cases.md) · [T03 Báo cáo kết quả](T03-test-report.md) · [C15 Hiệu năng](../03-quality/C15-performance-test-plan.md) · [C16 SIT](../03-quality/C16-sit-plan.md) · [C17 UAT](../03-quality/C17-uat-pack.md) |
| Cơ sở | BRD/FSD/SRS v1.2 + addendum v1.3 ([C03](../00-governance/C03-requirements-addendum-v1.3.md)), đặc tả C04–C13, giao diện [U01](../10-ui/U01-customer-app-ui-spec.md), [U02](../10-ui/U02-compliance-ui-spec.md), điều khoản [P01](../09-legal/P01-terms-privacy.md) |
| Phiên bản | 1.0 · 23/11/2026 · Han Dao (BA) |

## 1. Mục tiêu

1. Chứng minh mọi BR-EKYC-12 → 21 và RULE-EKYC-09 → 16 được đáp ứng, có bằng chứng.
2. Phát hiện sớm lỗi ở lớp quy tắc bằng test tự động, chạy lại được mỗi lần sửa code.
3. Cung cấp số liệu cho quyết định go-live: tiêu chí ra ở mục 7.

## 2. Phạm vi

| Trong phạm vi | Ngoài phạm vi (lần này) |
|---|---|
| Luồng khách: đồng ý, chọn giấy tờ (CCCD, thẻ Căn cước, hộ chiếu), chụp, OCR, chip, liveness, kết quả, ngoại lệ, tiếp tục phiên, bổ sung, quyền riêng tư | Kết nối thật CIC, AML, Core Banking, Notification (chờ sandbox DEP-01→04, 07 – thuộc SIT C16) |
| Compliance: hàng đợi, SLA, nhận/nhả, yêu cầu bổ sung, Maker-Checker, audit, PII, báo cáo, cấu hình ngưỡng | Đọc chip NFC thật trên web (Safari không hỗ trợ) – kiểm bằng app Aegis Scan (A02) |
| `ekyc-service`: API, quy tắc, job nền, phân quyền, lưu trữ | Liveness/face match tính phía server (chưa có nhà cung cấp) |
| Phi chức năng: bảo mật cơ bản, trợ năng, song ngữ, tương thích trình duyệt | Kiểm thử xâm nhập, tải lớn (C15 riêng) |
| Module 2 Đối soát, 3 Hạn mức | — (tài liệu R01, L01) |

## 3. Cấp độ và loại kiểm thử

| Cấp độ | Nội dung | Ai | Công cụ | Khi nào |
|---|---|---|---|---|
| Unit – quy tắc | Hàm thuần trong `server/src/rules.ts` | Dev | `node:test` | Mỗi lần commit |
| Component – service | Luồng nghiệp vụ trên DB trong bộ nhớ, tua đồng hồ | Dev | `node:test` | Mỗi lần commit |
| API | HTTP thật: mã trạng thái, phân quyền, CORS | Dev/QA | `node:test` + `fetch` | Mỗi lần commit |
| Hệ thống – E2E | Chạy app + backend, đi hết luồng trên trình duyệt và iPhone | QA/BA | Trình duyệt, iOS Simulator, iPhone qua link HTTPS | Mỗi bản phát hành nội bộ |
| SIT | Với sandbox đối tác thật | QA + Dev | Theo C16 | Khi có sandbox |
| UAT | PO + Compliance nghiệm thu | PO, Compliance | Theo C17 | Sau SIT |
| Phi chức năng | Trợ năng, song ngữ, bảo mật, hiệu năng | QA | Checklist T02 §5, C15 | Trước UAT |

## 4. Kỹ thuật thiết kế test case

| Kỹ thuật | Áp dụng cho |
|---|---|
| Bảng quyết định | RULE-09 trùng khách, RULE-10 hạn/tuổi, cây quyết định STP/REFER/REJECTED, RULE-13 cần Checker |
| Phân vùng tương đương + giá trị biên | Tuổi (17/18, đúng ngày sinh nhật), hạn giấy tờ (hôm nay, < 30 ngày), liveness (0.69/0.70/0.85), điểm rủi ro (49.9/50/70/80), SLA (15.9/16/20/24h), 2 lần bổ sung |
| Chuyển trạng thái | Vòng đời phiên C06, trạng thái hồ sơ C03, SLA C09 |
| Kịch bản đầu cuối | 16 hồ sơ mẫu TD-01 → TD-16 |
| Phân quyền | Ma trận vai trò Officer / Trưởng nhóm / CS |
| Kiểm tra theo checklist | Trợ năng, nội dung (không lộ AML/PEP), song ngữ |

## 5. Môi trường và dữ liệu

| Môi trường | Cách dựng | Dùng cho |
|---|---|---|
| Local | `npm run dev:all` (web :5179, backend :8787, SQLite) | Dev, E2E |
| iPhone | Cùng Wi-Fi `http://<IP Mac>:5179/app/` hoặc link HTTPS tạm (Cloudflare Tunnel) để dùng camera | E2E trên thiết bị |
| iOS Simulator | Safari trên iPhone 16 Pro mở `localhost:5179/app/` | E2E, chụp màn hình |
| Demo | GitHub Pages – không backend | Trình diễn giao diện |
| SIT / UAT | Theo C16 / C17 | — |

**Dữ liệu:** hồ sơ mẫu TD-01 → TD-16 (`server/src/personas.ts`, mô tả ở [C17 §4](../03-quality/C17-uat-pack.md)), 8 hồ sơ có sẵn trong hàng đợi, 4 nhân viên mẫu. Đặt lại dữ liệu: `POST /api/dev/reset`. Tua giờ để thử SLA/job: `POST /api/dev/clock/advance`. **Không dùng dữ liệu thật của khách.**

## 6. Tiêu chí vào

| # | Tiêu chí |
|---|---|
| 1 | Đặc tả C04–C13 và giao diện U01/U02 đã được BA xác nhận |
| 2 | Bản build chạy được, `npm run test:server` xanh |
| 3 | Dữ liệu mẫu đã nạp, môi trường kiểm thử sẵn sàng |

## 7. Tiêu chí ra (cho từng vòng)

| # | Tiêu chí | Ngưỡng |
|---|---|---|
| 1 | Test case mức **Cao** đã chạy | 100% |
| 2 | Test case đạt | ≥ 95% tổng số đã chạy |
| 3 | Lỗi mức Nghiêm trọng / Cao còn mở | 0 |
| 4 | Lỗi Trung bình / Thấp còn mở | Có hướng xử lý, PO chấp nhận bằng văn bản |
| 5 | Test tự động backend | 100% đạt |

## 8. Phân loại lỗi

| Mức | Định nghĩa | Ví dụ | Xử lý |
|---|---|---|---|
| Nghiêm trọng | Sai quyết định mở tài khoản, lộ dữ liệu, mất tiền | Duyệt STP khi chỉ có ảnh in trên thẻ | Chặn phát hành, sửa ngay |
| Cao | Chức năng chính không dùng được, sai quy tắc tuân thủ | Maker tự duyệt được hồ sơ PEP | Chặn phát hành |
| Trung bình | Sai một phần, có cách làm khác | Báo cáo SLA tính sai trung vị | Sửa trong vòng phát hành |
| Thấp | Giao diện, chính tả | Nhãn lệch dòng | Đưa vào danh sách tồn |

Vòng đời lỗi: Mới → Đã xác nhận → Đang sửa → Chờ kiểm lại → Đóng (hoặc Mở lại). Lỗi ghi trên Jira, loại Bug, liên kết test case.

## 9. Rủi ro kiểm thử

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Chưa có sandbox đối tác | Không kiểm được tích hợp thật | Adapter giả lập có fixture theo C16; đánh dấu điều kiện UAT |
| Camera chỉ chạy trên HTTPS | Không thử chụp thật qua IP | Link HTTPS tạm; ảnh minh hoạ khi không có camera |
| Web không đọc chip | Bước NFC chỉ mô phỏng | Kiểm bằng app Aegis Scan (A02) trên iPhone có NFC |
| Dữ liệu sinh trắc là số giả lập | Không đánh giá được APCER/BPCER | Spike C14 |

## 10. Lịch và vai trò

| Hoạt động | Người | Đầu ra |
|---|---|---|
| Viết test case | BA | T02 |
| Test tự động | Dev | `server/test` |
| Chạy E2E, ghi kết quả | BA/QA | T03 |
| SIT | QA + Dev + đối tác | Biên bản C16 |
| UAT | PO + Compliance | Biên bản C17 |
| Quyết định go-live | PO | Ký biên bản |
