# C12 · Rút lại đồng ý & lưu trữ dữ liệu

| | |
|---|---|
| Jira | [SCRUM-81](https://baohandao2303.atlassian.net/browse/SCRUM-81) · bị chặn bởi [SCRUM-71](https://baohandao2303.atlassian.net/browse/SCRUM-71) |
| BR / FR / RULE | BR-20 · FR-17 · RULE-15 · NFR-RET-01 · đáp ứng CR-07, CR-08, CR-12 |

## 1. Vòng đời dữ liệu cá nhân trong eKYC

```mermaid
flowchart LR
    A["Thu thập<br/>ảnh giấy tờ, chip, selfie"] --> B{"Kết quả hồ sơ"}
    B -- "Bỏ dở / hết hạn" --> X1["Xoá sau 7 ngày<br/>giữ metadata ẩn danh"]
    B -- "Rút lại đồng ý khi đang làm" --> X2["Xoá trong 24 giờ"]
    B -- "REJECTED" --> H1["Lưu theo thời hạn PCRT<br/>rồi xoá"]
    B -- "APPROVED" --> H2["Lưu suốt quan hệ khách hàng<br/>+ thời hạn PCRT sau khi đóng TK"]
    H1 --> X3["Job retention xoá<br/>ghi log xoá"]
    H2 --> X3
```

## 2. Chính sách lưu trữ (đề xuất – chờ C02 chốt thời hạn)

| Loại dữ liệu | Tình huống | Thời hạn | Sau thời hạn |
|---|---|---|---|
| Ảnh giấy tờ, dữ liệu chip, selfie | Phiên bỏ dở / EXPIRED | 7 ngày | Xoá file, ẩn danh metadata |
| Ảnh giấy tờ, dữ liệu chip, selfie | REJECTED | Theo PCRT (*cần xác minh*) | Xoá |
| Toàn bộ hồ sơ KYC | APPROVED | Suốt quan hệ + thời hạn PCRT sau đóng TK | Xoá |
| Kết quả AML/PEP/CIC | Mọi trường hợp | Theo PCRT | Xoá; chỉ Compliance truy cập |
| Audit log | Mọi trường hợp | Không ngắn hơn thời hạn hồ sơ liên quan | Xoá theo lô |
| Metadata thống kê (đã ẩn danh) | Mọi trường hợp | Không giới hạn | — |

## 3. RULE-EKYC-15 · Rút lại đồng ý

```mermaid
sequenceDiagram
    autonumber
    actor K as Khách hàng
    participant App
    participant EK as ekyc-service
    participant RT as retention-job
    K->>App: Cài đặt › Quyền riêng tư › Rút lại đồng ý
    App->>EK: POST /consents/withdraw (scope)
    EK->>EK: Ghi ConsentRecord status=WITHDRAWN (bất biến)
    alt Hồ sơ đang làm dở
        EK->>EK: Huỷ phiên
        EK->>RT: Lên lịch xoá dữ liệu tạm (≤ 24h)
        App->>K: Đã rút lại đồng ý, dữ liệu sẽ được xoá trong 24 giờ
    else Đã có tài khoản
        EK->>EK: Ngừng xử lý ngoài mục đích bắt buộc (marketing...)
        App->>K: Giải thích dữ liệu vẫn phải lưu và lý do pháp lý
    end
```

| Scope | Rút lại được? | Hệ quả |
|---|---|---|
| `identity` (bắt buộc) | Được khi chưa có tài khoản | Huỷ hồ sơ, xoá dữ liệu tạm |
| `identity` (bắt buộc) | Đã có tài khoản | Không xoá dữ liệu thuộc nghĩa vụ lưu trữ; giải thích cho khách |
| `screening` (bắt buộc) | Như `identity` | Như `identity` |
| `marketing` (tuỳ chọn) | Luôn được | Ngừng gửi ưu đãi |

## 4. Job retention

| Thuộc tính | Giá trị |
|---|---|
| Lịch | Hằng ngày 03:00 |
| Phạm vi | Bản ghi có `retention_until < hôm nay` |
| Cách xoá | Xoá file trên Storage + xoá/ẩn danh cột PII trong DB |
| Báo cáo | Số bản ghi theo loại, thời gian chạy, lỗi; gửi kênh vận hành |
| Kiểm thử | Tạo dữ liệu có `retention_until` quá khứ → chạy job → kiểm tra file không còn, metadata đã ẩn danh, có log xoá |
