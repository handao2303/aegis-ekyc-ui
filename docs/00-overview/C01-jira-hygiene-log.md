# C01 · Nhật ký đồng bộ Jira – Epic eKYC (SCRUM-6)

| | |
|---|---|
| Mã tài liệu | AEG-GEN-C01 |
| Phiên bản | 1.2 |
| Ngày phát hành | 26/11/2026 |
| Trạng thái | ✅ Hoàn tất 6/6 hạng mục · chờ PO, Tech Lead duyệt v1.1 |
| Phân loại | Nội bộ |
| Tác giả | Han Dao (BA) |
| Người duyệt | Product Owner · Tech Lead – chưa duyệt |
| Mục đích và phạm vi | Ghi lại các lần chỉnh Jira Epic eKYC (SCRUM-6) và quy ước đặt tên, liên kết ticket cho cả 3 module |
| Chuẩn tham chiếu | Không có chuẩn bắt buộc (nhật ký); kiểm soát tài liệu theo ISO/IEC/IEEE 29148 – [Q01](Q01-standards-conformance.md) |
| Thuật ngữ | [G02 Thuật ngữ và chữ viết tắt](G02-glossary.md) |
| Jira | [SCRUM-70](https://baohandao2303.atlassian.net/browse/SCRUM-70) |
| Ngày thực hiện | 21/11/2026 |
| Người thực hiện | Han Dao (BA/PO) |
| Kết quả | **Hoàn tất 6/6 hạng mục** |

## Thay đổi đã thực hiện

| # | Ticket | Trước | Sau | Lý do |
|---|---|---|---|---|
| 1 | [SCRUM-57](https://baohandao2303.atlassian.net/browse/SCRUM-57) | Done | **Testing** + comment | Comment 25/08 ghi chưa đủ mẫu (4/20 OCR, 0 NFC). Đo tiếp ở SCRUM-84 (C15) |
| 2 | [SCRUM-37](https://baohandao2303.atlassian.net/browse/SCRUM-37) | Mô tả còn "chưa implement" | Mô tả ghi "✅ Đã xác minh 25/08", AC dạng Given/When/Then | Comment 25/08 đã xác minh code và test TC2-1 |
| 3 | [SCRUM-39](https://baohandao2303.atlassian.net/browse/SCRUM-39) | Mô tả còn "chưa có màn hình" | Mô tả ghi "✅ Đã xác minh 29/08", AC dạng Given/When/Then | Comment 29/08 đã xác minh 3 màn kết quả |
| 4 | [SCRUM-6](https://baohandao2303.atlassian.net/browse/SCRUM-6) | In Progress (quá hạn 31/08) | **Done** + comment chuyển phạm vi | Phạm vi cốt lõi xong; phần còn lại thuộc SCRUM-69 |
| 5 | SCRUM-17 → 21 | AC một dòng, không mã truy vết | AC Given/When/Then + mã UC/BR/RULE; ghi lại AC cũ ở cuối mô tả | Chuẩn truy vết cho UAT |
| 6 | SCRUM-17→21, 37, 39, 41, 42, 43, 46, 47, 48, 57, 58 | Thiếu label | Label `aegis`, `ekyc` | Lọc được toàn bộ eKYC bằng JQL |

## Kiểm tra lại

```
project = SCRUM AND labels = ekyc AND parent = SCRUM-6
```
Trả về đủ ticket con của SCRUM-6.

## Quy ước trạng thái từ nay

| Trạng thái | Ý nghĩa với Story/Task eKYC |
|---|---|
| Idea | Chưa bắt đầu |
| In Progress | Đang làm (đặc tả, UI mẫu hoặc code) |
| Testing | Chờ kiểm thử **hoặc** chờ review/duyệt (với tài liệu) |
| Done | Đạt toàn bộ AC, có bằng chứng trong comment |

## Áp dụng cho Module 2, 3

Quy ước trên áp dụng cho cả Epic Đối soát (SCRUM-7) và Hạn mức (SCRUM-8). Khi rà soát 26/11/2026, SCRUM-27 → 30 đang *Testing* và SCRUM-38 *Done* nhưng repo chưa có mã `limit-service` ([X01](X01-end-to-end-flow-check.md) F-14, [L02 §1](../03-credit-limit/L02-requirements-gap-rtm.md)). Theo quy ước, các story này cần comment bằng chứng (link mã, kết quả test) hoặc chuyển về *In Progress*. Việc chuyển trạng thái do Tech Lead xác nhận, BA không tự đổi.

## Kiểm soát tài liệu

### Tài liệu tham chiếu

| Mã | Tài liệu |
|---|---|
| Q01 | [Q01 · Đối chiếu tài liệu 3 module với chuẩn quốc tế](Q01-standards-conformance.md) |
| X01 | [X01 · Kiểm tra luồng end-to-end và độ đầy đủ tài liệu 3 module](X01-end-to-end-flow-check.md) |
| L02 | [L02 · Hạn mức – yêu cầu bổ sung, điểm lệch baseline & RTM](../03-credit-limit/L02-requirements-gap-rtm.md) |

Chuẩn quốc tế: xem trường *Chuẩn tham chiếu* ở đầu trang.

### Lịch sử phiên bản

| Phiên bản | Ngày | Người sửa | Commit | Thay đổi |
|---|---|---|---|---|
| 1.0 | 21/11/2026 | Han Dao | — | Nhật ký đồng bộ 6 hạng mục Jira Epic eKYC, quy ước trạng thái |
| 1.1 | 26/11/2026 | Han Dao | — | Thêm phần áp dụng cho Module 2, 3 (X01 F-14); thêm kiểm soát tài liệu theo ISO/IEC/IEEE 29148 |
| 1.2 | 26/11/2026 | Han Dao | — | Chuẩn hoá cấu trúc theo ISO/IEC/IEEE 15289: khối thuộc tính đầu trang, tài liệu tham chiếu, thuật ngữ dùng chung (G02), mục kiểm soát tài liệu thống nhất |

### Phê duyệt

| Vai trò | Người | Ngày | Kết luận |
|---|---|---|---|
| BA (soạn) | Han Dao | 26/11/2026 | Trình duyệt |
| Product Owner |  |  |  |
| Tech Lead |  |  |  |
