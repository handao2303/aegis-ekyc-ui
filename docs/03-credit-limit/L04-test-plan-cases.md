# L04 · Hạn mức – kế hoạch kiểm thử, test case và kết quả

| | |
|---|---|
| Epic | [SCRUM-8](https://baohandao2303.atlassian.net/browse/SCRUM-8) · story SCRUM-27 → 30, 38, 51 → 54 |
| Khung tài liệu | ISO/IEC/IEEE 29119-3:2021 – gộp Test Plan, Test Case Specification và Test Completion Report cho một module nhỏ |
| Đối tượng kiểm thử | UI mẫu [/credit-limit/](https://handao2303.github.io/aegis-ekyc-ui/credit-limit/) và [/app/?screen=cardHome](https://handao2303.github.io/aegis-ekyc-ui/app/?screen=cardHome) · vòng 1: bản GitHub Pages 25/11/2026 · vòng 2: bản local 26/11/2026 (`WEB=http://localhost:5179`), cùng script `tools/diagrams/lim-screens.mjs` |
| Yêu cầu nguồn | BAS-BRD-v1.2 §2.3, §4.3, §5.3 · [L01](L01-credit-limit-flow.md) · [L02](L02-requirements-gap-rtm.md) · [L03](L03-ui-spec.md) |
| Người thực hiện | Han Dao (BA) |
| Phiên bản | 1.3 · 26/11/2026 (vòng 1, kiểm tra luồng end-to-end, vòng 2 sau khi sửa 4 lỗi) |
| Trạng thái | ✅ Vòng UI đã chạy · ⛔ ca backend chờ `limit-service` |

## 1. Tóm tắt kết quả

| | Vòng 1 (25/11) | Vòng 2 (26/11) |
|---|---|---|
| Ca giao diện đã chạy | 33 (web 23, mobile 10) | 36 (thêm TC-LIM-34, 35, 36) |
| Đạt | **31** | **34** |
| Không đạt | **2** – TC-LIM-07 (reversal), TC-LIM-28 (thời hạn Boost) | **2** – như vòng 1, chờ D-LIM-01, D-LIM-03 |
| Ca backend chưa chạy được | 10 (TC-LIM-B01 → B10) | 10 |
| Lỗi / phát hiện | 8 mở (DEF-LIM-08 thêm khi kiểm tra luồng end-to-end – [X01](../00-overview/X01-end-to-end-flow-check.md) F-02) | 4 đã sửa (DEF-LIM-03, 04, 06, 07) · 2 mới (DEF-LIM-09, 10) · **6 mở** (1 High · 4 Medium · 1 Low) – §5 |

Vòng 2 chạy sau khi sửa 4 lỗi không phụ thuộc quyết định nghiệp vụ. Hai lỗi mới tìm được khi đi hết luồng thật trên app: mở tài khoản TD-01 có backend → "Vào trang chủ" → M1.

**Kết luận:** UI mẫu thể hiện đúng các kiểm soát chính (vòng 2 thêm cột RRN, hộp thoại kết luận khi đóng case): che PAN ở mọi màn, xung đột version khi giao dịch đồng thời, ba trạng thái Smart Fallback, bắt lý do khi mở khoá Boost, gửi lại thông báo thất bại, và nút Nhận Boost khoá tới khi khách xác nhận điều kiện. Hai ca không đạt đều là **lệch baseline** (MTI reversal 0420, thời hạn Boost theo chu kỳ sao kê), cần quyết định D-LIM-01 và D-LIM-03 trước khi sửa. Module 3 **chưa đủ điều kiện vào SIT/UAT** vì chưa có bằng chứng `limit-service` chạy được (L02 §1).

## 2. Kế hoạch

### 2.1 Phạm vi

| Trong phạm vi | Ngoài phạm vi (vòng này) |
|---|---|
| LIM-W1 → W4, danh sách thẻ (G-07), LIM-M1 → M3: hiển thị, điều hướng, quy tắc chặn trên giao diện | Bản tin ISO 8583 thật, khoá đồng thời thật, CASA hold, Notification Service – chưa có backend |
| Che PAN, xung đột version, Boost, gửi lại thông báo, phân luồng gian lận | Hiệu năng p99 thật (PERF-LIM ở [L07](L07-sit-perf-uat.md)) |
| Khả năng tiếp cận cơ bản (nhãn công tắc, tạm dừng nội dung tự cập nhật) | Phân quyền thật theo SSO – UI mẫu chỉ có một người dùng |

### 2.2 Cách làm

| Hạng mục | Cách làm |
|---|---|
| Kỹ thuật thiết kế ca | Theo use case UC-LIM-01 → 06; bảng quyết định cho cây quyết định authorization (L01 §2); chuyển trạng thái cho circuit breaker, Boost, thông báo; giá trị biên cho hạn mức mới < dư nợ và lý do < 10 ký tự |
| Thực thi | Tự động bằng Chrome headless, script `tools/diagrams/lim-screens.mjs` (chạy ca và chụp ảnh cho L03). Chạy lại: `node lim-screens.mjs ../../public/ui > lim-results.json` |
| Dữ liệu | Dữ liệu hư cấu trong UI mẫu: 5 thẻ, 3 giao dịch fallback, 5 Boost, 4 case gian lận; log authorization sinh ngẫu nhiên có hạt giống cố định |
| Môi trường | macOS, Chrome headless; web 1280 × 860, mobile 390 × 844 @2x cảm ứng; tiếng Việt |

### 2.3 Điều kiện vào / ra

| | Tiêu chí |
|---|---|
| Vào vòng UI | Bản UI đã deploy lên GitHub Pages ✅ |
| Ra vòng UI | 100% ca giao diện đã chạy ✅ · mọi lỗi có mã và mức độ ✅ |
| Vào SIT | Có `limit-service` chạy được, simulator ISO 8583 (DEP-05), mock CASA (DEP-06), quyết định D-LIM-01 → 03, 0 lỗi High mở ❌ |

## 3. Test case giao diện và kết quả (vòng 2, 26/11/2026)

Cột "Kết quả thực tế" ghi theo vòng 2. Ca đổi kết quả hoặc thêm mới so với vòng 1: TC-LIM-12, 23, 28 → 30 (ngày giờ tính theo lúc chạy), 34, 35, 36.

| Mã | Màn | Bước | Kết quả mong đợi | Kết quả thực tế | Kết quả | Truy vết |
|---|---|---|---|---|---|---|
| TC-LIM-01 | W1 | Mở trang | Có 4 thẻ: p99, throughput, tỷ lệ chấp thuận, circuit breaker | Đủ 4 thẻ | ✅ | BR-LIM-01, 09 |
| TC-LIM-02 | W1 | Đọc thẻ p99 | p99 < 2 s, nhãn Đạt | p99 = 1,33 s · Đạt | ✅ | RULE-LIM-01, KPI-07 |
| TC-LIM-03 | W1 | Bấm thẻ circuit breaker 3 lần | CLOSED → HALF_OPEN → OPEN → CLOSED | Đúng thứ tự | ✅ | BR-LIM-09 |
| TC-LIM-04 | W1 | Quét toàn bộ chữ trên trang | Không có PAN đủ 16 số | Mọi PAN dạng 4111 •••• •••• 1234 | ✅ | NFR-SEC-04, UAT-LIM-10 |
| TC-LIM-05 | W1 | Bấm Tạm dừng, chờ 3 giây | Không có dòng mới | STAN đầu bảng giữ nguyên 820513 | ✅ | WCAG 2.2.2 |
| TC-LIM-06 | W1 | Bấm Tiếp tục, chờ 2,8 giây | Có dòng mới, STAN tăng | 820513 → 820515 | ✅ | BR-LIM-01 |
| TC-LIM-07 | W1 | Xem cột MTI của log | Có bản tin reversal MTI 0420 | 12 dòng chỉ có 0100. Mã sinh dữ liệu dùng 0400 cho ~2% dòng và gắn quyết định DECLINED | ❌ | BR-LIM-08, UAT-LIM-05 · DEF-LIM-01 |
| TC-LIM-08 | W1 | Đối chiếu quyết định và mã F39 từng dòng | 00 duyệt, 05/51 từ chối, 00·CASA fallback | 12 dòng, 0 dòng lệch | ✅ | UC-LIM-01 bước 3 |
| TC-LIM-09 | Danh sách thẻ | Mở Hồ sơ hạn mức thẻ | Có thẻ tạm khoá và cột version | C-0004 · Tạm khoá · v22 | ✅ | G-07 |
| TC-LIM-10 | Danh sách thẻ | Tìm "1234" | Còn đúng 1 thẻ | 1 dòng – NGUYEN THI MINH THU | ✅ | G-07 |
| TC-LIM-11 | W2 | Mở thẻ ••••1234 | Có version, tạm giữ, Boost, CASA liên kết | v17 · 2,3 tr · +10 tr · 1903 6688 2025 | ✅ | BRD §3.5 |
| TC-LIM-12 | W2 | Xem bảng Smart Fallback | Có HOLD, SETTLED, RELEASED | Đủ 3 trạng thái, cột Trạng thái hiện đủ ở 1280 px (vòng 1 bị cắt – DEF-LIM-04 đã sửa) | ✅ | UAT-LIM-03/04 |
| TC-LIM-13 | W2 | Điều chỉnh hạn mức = 20 triệu (< dư nợ) | Bị chặn | "Hạn mức mới phải lớn hơn dư nợ hiện tại." | ✅ | Giá trị biên |
| TC-LIM-14 | W2 | Điều chỉnh = 90 triệu | Lưu, version tăng | "Đã cập nhật hạn mức, version v18." | ✅ | BR-LIM-02 |
| TC-LIM-15 | W2 | Tick "giao dịch khác cập nhật trước", Lưu | Từ chối, báo xung đột version | "Xung đột phiên bản: hồ sơ đã được cập nhật lên v19…" | ✅ | BR-LIM-02, UAT-LIM-01 |
| TC-LIM-16 | W3 | Mở Boost | 3 tab ACTIVE / LOCKED / EXPIRED có số lượng | "Đang hiệu lực · 2", khoá · 1, hết hạn · 2 | ✅ | UAT-LIM-06 |
| TC-LIM-17 | W3 | Bấm Khoá ở BST-7701 | Chuyển sang tab khoá, có người khoá | Chuyển; "Khoá thủ công bởi Trần Bảo Ngọc". Không hỏi lý do, không gửi thông báo (DEF-LIM-05) | ✅ | D-LIM-08 |
| TC-LIM-18 | W3 | Mở khoá BST-7690: để trống, nhập 4 ký tự, nhập lý do đủ | Nút khoá tới khi ≥ 10 ký tự; mở được | Nút khoá ở 4 ký tự; BST-7690 về Đang hiệu lực | ✅ | Audit |
| TC-LIM-19 | W4 | Mở Giám sát gian lận | Case mở trên, điểm cao trước; case đóng cuối | FR-2201 (92) > FR-2196 (78) > FR-2202 (61), FR-2180 đóng ở cuối | ✅ | UC-LIM-06 |
| TC-LIM-20 | W4 | Đối chiếu điểm và hành động | ≥ 75 khoá Boost, thấp hơn gắn cờ | 92, 78 → Khoá Boost · 61, 55 → Gắn cờ | ✅ | UC-LIM-06 luồng phụ, D-LIM-07 |
| TC-LIM-21 | W4 | Bấm Gửi lại ở FR-2196 (SMS FAILED) | FAILED → PENDING → DELIVERED | Đúng | ✅ | REQ-LIM-14, UAT-LIM-07 |
| TC-LIM-22 | W4 | Xem mẫu thông báo | Ghi rõ nội dung giữ chỗ; PAN che | Có cảnh báo ISS-03 / DEP-07; "****0042" | ✅ | REQ-LIM-15 |
| TC-LIM-23 | W4 | Đóng case FR-2201: chưa chọn kết luận; chọn "Khách xác nhận là mình" + ghi chú 4 ký tự; ghi chú đủ | Nút Đóng case khoá tới khi có kết luận và ghi chú ≥ 10 ký tự; dòng hiện kết luận | Nút khoá ở 2 bước đầu; FR-2201 → "Đã đóng · Khách xác nhận là mình" (vòng 1: đóng ngay không hỏi – DEF-LIM-06) | ✅ | REQ-LIM-17 |
| TC-LIM-24 | M1 | Mở Thẻ của tôi | Khả dụng = hạn mức − đã dùng − tạm giữ | 80.000.000 − 46.250.000 − 2.300.000 = 31.450.000 ₫ | ✅ | BRD §3.5 |
| TC-LIM-25 | M1 | Quét chữ | Không có PAN đầy đủ | 4111 •••• •••• 1234 | ✅ | UAT-LIM-10 |
| TC-LIM-26 | M1 | Bấm công tắc Smart Fallback | Đổi trạng thái, có nhãn cho trình đọc màn hình | `aria-checked` true → false · nhãn "Smart Fallback" | ✅ | BR-LIM-04, WCAG 4.1.2 |
| TC-LIM-27 | M2 | Bấm thẻ lời mời Boost | Có hạn mức mới, hiệu lực, tự trở về, phí; nút Nhận khoá khi chưa tick | Đủ 4 dòng; nút khoá | ✅ | REQ-LIM-11 |
| TC-LIM-28 | M2 | Đọc thời hạn | Hết hạn theo chu kỳ sao kê kế tiếp | "tăng hạn mức trong 72 giờ" · "Ngay bây giờ → 15:43, 29/11/2026" (= lúc chạy + 72 giờ) | ❌ | BR-LIM-06, RULE-LIM-06 · DEF-LIM-02, 03 |
| TC-LIM-29 | M2 | Tick điều kiện, Nhận ưu đãi | Hạn mức mới 90 triệu | "Hạn mức mới 90.000.000 ₫, dùng được ngay đến 15:43, 29/11/2026." | ✅ | UC-LIM-04 |
| TC-LIM-30 | M1 | Về thẻ của tôi | Boost đang hiệu lực, đếm ngược, khả dụng +10 triệu | "Còn 2 ngày 23:59:56" · 41.450.000 ₫ | ✅ | UAT-LIM-06 |
| TC-LIM-31 | M3 | Mở thông báo khoá Boost | Có lý do, nói hạn mức gốc vẫn dùng, 2 lựa chọn | Đủ; có lưu ý không hỏi OTP | ✅ | UC-LIM-06 bước 4 |
| TC-LIM-32 | M3 | Chọn Không phải tôi | Thẻ khoá, hẹn liên hệ | "Thẻ đã được khoá" · 24 giờ | ✅ | D-LIM-05 |
| TC-LIM-33 | M3 | Chọn Đúng, tôi đã thực hiện | Xác nhận, hẹn xem lại | "…mở lại hạn mức tạm thời trong vòng 30 phút" | ✅ | D-LIM-05 |
| TC-LIM-34 | W1 | Xem cột RRN của 12 dòng log | Mỗi dòng có RRN 12 số; cặp STAN + RRN không trùng | 12 dòng, RRN dạng `633012820515`, 12 cặp khác nhau | ✅ | REQ-LIM-01, BR-LIM-03 · DEF-LIM-07 |
| TC-LIM-35 | W2 | Đo bảng Smart Fallback ở cửa sổ 1280 px | Không cuộn ngang, thấy cột Trạng thái | Bảng 532 px trong khung 532 px | ✅ | DEF-LIM-04 |
| TC-LIM-36 | M2 → M1 | Đọc ngày giờ ở M2 (Hiệu lực), màn Đã nâng hạn mức và đồng hồ đếm ngược M1 | Cùng một mốc hết hạn (lệch < 2 phút) | Cả 3 chỗ: 15:43, 29/11/2026 | ✅ | DEF-LIM-03, L05 `expires_at` |

## 4. Test case backend – chưa chạy

Viết sẵn theo thiết kế ở [L05](L05-api-data-dictionary.md). Chạy khi có `limit-service` và simulator ISO 8583.

| Mã | Bước | Kết quả mong đợi | Truy vết |
|---|---|---|---|
| TC-LIM-B01 | Gửi 0100 hợp lệ, đủ hạn mức | 0110 F39 = 00, `available_limit` giảm đúng, có AuthorizationLog với `response_time_ms` | BR-LIM-01, UC-LIM-01 |
| TC-LIM-B02 | Gửi lại cùng STAN + RRN + terminal + F7 | Trả đúng kết quả lần đầu, hạn mức không đổi, log ghi `DUPLICATE` | BR-LIM-03, RULE-LIM-03 |
| TC-LIM-B03 | 2 giao dịch cùng thẻ gửi song song, tổng vượt khả dụng | Đúng một giao dịch được duyệt; không bao giờ `available_limit` < 0 (lặp 1 000 lần) | BR-LIM-02, KPI-08, UAT-LIM-01 |
| TC-LIM-B04 | Khả dụng thiếu, Fallback bật, CASA đủ / thiếu / không active | Đủ: duyệt `00`, FallbackTransaction `HOLD`, bút toán đối ứng · Thiếu hoặc không active: từ chối `51` | BR-LIM-04, UC-LIM-03 |
| TC-LIM-B05 | Gửi 0420 cho giao dịch đã duyệt; gửi 0420 không có gốc | Giải phóng đúng số tiền (kể cả HOLD CASA → `RELEASED`), phát sự kiện · Không có gốc: từ chối xử lý, vào hàng chờ tay | BR-LIM-08, UC-LIM-05, REQ-LIM-03 |
| TC-LIM-B06 | Chạy đánh giá Boost với điểm trên / dưới ngưỡng, thẻ có cờ gian lận | Chỉ thẻ đủ điểm và không có cờ nhận lời mời; số tiền ≤ trần % | BR-LIM-05, 06, REQ-LIM-08, 10 |
| TC-LIM-B07 | Đẩy đồng hồ tới hết chu kỳ sao kê | Boost `EXPIRED`, khả dụng về hạn mức gốc không cần thao tác | RULE-LIM-06, UAT-LIM-06 |
| TC-LIM-B08 | Fraud Engine gửi tín hiệu điểm cao; Notification mock lỗi SMS | Boost `LOCKED_SUSPECTED_FRAUD`, gửi SMS + App cùng lúc, tự gửi lại theo lịch, `delivery_status` cập nhật | BR-LIM-07, CR-003, UAT-LIM-07 |
| TC-LIM-B09 | Mock CASA trễ 3 giây | Breaker CASA mở; giao dịch cần fallback bị từ chối fail-safe trong ngân sách; tổng < 2 s | BR-LIM-09, RULE-LIM-07 |
| TC-LIM-B10 | Gửi lại sự kiện `limit.authorization.processed` trùng `messageId`; chạy EOD | Module 2 không sinh GLEntry trùng; báo cáo lệch = 0 hoặc mọi dòng được giải trình | BR-LIM-10, KPI-09, UAT-LIM-08 · TC-REC-B09 |

## 5. Lỗi và phát hiện

| Mã | Mức | Mô tả | Cách tái hiện | Đề xuất sửa | Trạng thái |
|---|---|---|---|---|---|
| DEF-LIM-01 | High | Reversal ghi MTI 0400 và quyết định DECLINED; baseline dùng 0420 (và 0120). Reversal chỉ chiếm ~2% dòng sinh ngẫu nhiên nên tester gần như không thấy để kiểm UAT-LIM-05 | TC-LIM-07; đọc `makeAuth()` trong `src/ops/CreditLimit.tsx` | Sau D-LIM-03: dùng 0420; thêm cột "Loại" (Authorization / Reversal / Advice) tách khỏi "Quyết định"; dữ liệu mẫu luôn có ít nhất 1 reversal trên trang đầu | Mở – chờ D-LIM-03 |
| DEF-LIM-02 | Medium | Boost hết hạn sau 72 giờ, baseline là sau chu kỳ sao kê kế tiếp | TC-LIM-28 | Sau D-LIM-01: M2 hiện ngày chốt sao kê; M1 đếm ngược tới mốc đó | Mở – chờ D-LIM-01 |
| DEF-LIM-03 | Medium | Thời hạn Boost không nhất quán: M2 ghi cứng hạn 24/11/2026 (đã qua so với ngày chạy 25/11/2026), lời mời ghi 72 giờ, M1 đếm ngược 62 giờ | TC-LIM-28, TC-LIM-30 | Tính ngày hết hạn từ một nguồn duy nhất (`expires_at`) cho cả M1, M2 | ✅ Đã sửa 26/11 – một hằng số `BOOST_EXPIRES_AT` cho M1, M2 và màn Đã nâng; thời lượng `BOOST_HOURS` (72) đổi khi chốt D-LIM-01; TC-LIM-36 |
| DEF-LIM-05 | Medium | Khoá Boost thủ công ở W3 không bắt lý do và không gửi thông báo khách – trái BR-LIM-07 (khoá đi cùng thông báo) | TC-LIM-17 | Hộp thoại lý do ≥ 10 ký tự, gửi cùng mẫu thông báo, ghi audit (D-LIM-08) | Mở |
| DEF-LIM-04 | Low | Bảng Smart Fallback ở W2 bị cắt cột Trạng thái ở cửa sổ 1280 px | Ảnh `lim-card-profile.png` | Bỏ `minWidth` của bảng hoặc thu cột Điểm bán | ✅ Đã sửa 26/11 – bảng `minWidth` 480, cột thẻ 360 px; TC-LIM-35 |
| DEF-LIM-06 | Low | Đóng case gian lận không hỏi kết luận | TC-LIM-23 | Hộp thoại chọn kết luận + ghi chú (REQ-LIM-17) | ✅ Đã sửa 26/11 – TC-LIM-23 vòng 2 |
| DEF-LIM-07 | Low | Log authorization không có RRN, không kiểm được chống trùng trên UI | Xem bảng W1 | Thêm cột RRN (REQ-LIM-01) | ✅ Đã sửa 26/11 – TC-LIM-34 |
| DEF-LIM-08 | Medium | Sau khi mở tài khoản thành công, nút "Vào trang chủ" luôn mở M1 với một thẻ tín dụng đang dùng 46 triệu, kể cả khách chỉ mở tài khoản thanh toán (`product = payment`) | App: hoàn tất eKYC TD-01 → bấm "Vào trang chủ"; xem `src/mobile/screens.tsx` | M1 có trạng thái "chưa có thẻ" (giới thiệu thẻ, không hiện hạn mức); chỉ hiện hạn mức khi đã có hồ sơ hạn mức (L08 REQ-LIM-26) | Mở – chờ X01 F-01 |
| DEF-LIM-09 | Medium | Công tắc Smart Fallback ở M1 bật sẵn, không có điều khoản trích nợ, không lưu bằng chứng đồng ý – trái CR-LIM-04 | TC-LIM-26; mở M1 lần đầu | Mặc định tắt; bật thì hiện điều khoản L08 §4.1 và lưu đồng ý (REQ-LIM-23) | Mở – chờ Pháp chế duyệt điều khoản L08 §4.1 |
| DEF-LIM-10 | Low | Tài khoản CASA dùng cho Smart Fallback ở M1 ghi cứng `1903 6688 2025` (12.480.000 ₫), không phải tài khoản khách vừa mở ở eKYC (`1903 6688 0001`, 0 ₫) | App có backend: mở tài khoản TD-01 → Vào trang chủ | Lấy CASA từ hồ sơ khách; tài khoản số dư 0 không đủ điều kiện fallback (REQ-LIM-07) | Mở – cùng X01 F-01 |

## 6. Độ phủ yêu cầu

| BR | Ca UI | Đạt | Ca backend | Ghi chú |
|---|---|---|---|---|
| BR-LIM-01 | 4 | 4 | 1 | Số đo thật cần PERF-LIM-01 |
| BR-LIM-02 | 2 | 2 | 1 | Cách làm chờ D-LIM-02 |
| BR-LIM-03 | 1 | 1 | 1 | TC-LIM-34 (RRN trên UI) |
| BR-LIM-04 | 4 | 4 | 1 | |
| BR-LIM-05 | 1 | 1 | 1 | |
| BR-LIM-06 | 5 | 4 | 1 | TC-LIM-28 không đạt (chờ D-LIM-01); TC-LIM-36 đạt |
| BR-LIM-07 | 8 | 8 | 1 | DEF-LIM-05 còn mở dù ca đạt; DEF-LIM-06 đã sửa |
| BR-LIM-08 | 1 | 0 | 1 | TC-LIM-07 không đạt |
| BR-LIM-09 | 1 | 1 | 1 | Chỉ mô phỏng |
| BR-LIM-10 | 0 | — | 1 | Thuộc báo cáo EOD |
| NFR-SEC-04 | 3 | 3 | — | SIT-LIM-10 kiểm log và sự kiện |

## 7. Việc tiếp theo

1. PO, Risk, Vận hành thẻ chốt D-LIM-01, 03, 08 ([L02 §3](L02-requirements-gap-rtm.md)); FE sửa DEF-LIM-01, 02, 05 sau quyết định; DEF-LIM-08, 10 sau X01 F-01; DEF-LIM-09 sau khi Pháp chế duyệt L08 §4.1; chạy lại vòng 3 bằng cùng script.
2. Tech Lead xác minh mã `limit-service` (L02 câu hỏi 1); khi có, chạy TC-LIM-B01 → B10.

## 8. Kiểm soát tài liệu

### Lịch sử phiên bản

| Phiên bản | Ngày | Người sửa | Commit | Thay đổi |
|---|---|---|---|---|
| 1.0 | 25/11/2026 | Han Dao | 273d6b3 | Kế hoạch, 33 ca UI đã chạy (31 đạt), 10 ca backend viết sẵn, 7 lỗi / phát hiện |
| 1.1 | 26/11/2026 | Han Dao | f5d9316 | Thêm DEF-LIM-08 (màn sau eKYC luôn hiện thẻ tín dụng) từ X01 F-02 |
| 1.2 | 26/11/2026 | Han Dao | — | Vòng 2: sửa DEF-LIM-04, 06, 07; thêm TC-LIM-34, 35, viết lại TC-LIM-23; 35 ca, 33 đạt. Thêm DEF-LIM-09, 10 từ chạy luồng thật eKYC → M1 |
| 1.3 | 26/11/2026 | Han Dao | — | Sửa DEF-LIM-03 (một mốc hết hạn Boost); thêm TC-LIM-36; 36 ca, 34 đạt, 6 lỗi mở |

### Phê duyệt

| Vai trò | Người | Ngày | Kết luận |
|---|---|---|---|
| BA (soạn) | Han Dao | 25/11/2026 | Trình duyệt |
| QA Lead | | | |
| Product Owner | | | |
| Risk tín dụng | | | |
| Vận hành thẻ | | | |
