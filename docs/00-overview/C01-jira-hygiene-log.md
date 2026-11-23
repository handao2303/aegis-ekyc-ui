# C01 · Nhật ký đồng bộ Jira – Epic eKYC (SCRUM-6)

| | |
|---|---|
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
