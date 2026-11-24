# R01 · Đối soát giao dịch – luồng, trạng thái và kiểm soát

| | |
|---|---|
| Epic | [SCRUM-7](https://baohandao2303.atlassian.net/browse/SCRUM-7) · Reconciliation Capability |
| Story | SCRUM-22 → 26 (backend), [SCRUM-49](https://baohandao2303.atlassian.net/browse/SCRUM-49) (FE REC-01 → 06), [SCRUM-50](https://baohandao2303.atlassian.net/browse/SCRUM-50) (truy vết) |
| UI mẫu | [/reconciliation/](https://handao2303.github.io/aegis-ekyc-ui/reconciliation/) · mã nguồn `src/ops/Reconciliation.tsx` |
| Quy tắc chính | RULE-REC-04 (ngưỡng GL), RULE-REC-05 (phân tách nhiệm vụ), RULE-REC-06 (leo thang), FR-REC-11 (truy vết) |
| Tài liệu đi kèm | [R02](R02-requirements-gap-rtm.md) yêu cầu bổ sung & RTM · [R03](R03-ui-spec.md) đặc tả giao diện · [R04](R04-test-plan-cases.md) kiểm thử |

> ⚠️ Một số trạng thái và quy tắc trong tài liệu này khác BAS-BRD-v1.2 (trạng thái ngoại lệ, aging, điều kiện leo thang, ý nghĩa RULE-REC-05, trạng thái quy tắc, loại `DUPLICATE`). Danh sách và đề xuất xử lý: [R02 §3](R02-requirements-gap-rtm.md). Tài liệu này giữ nguyên tới khi Kế toán trưởng quyết định.

## 1. Luồng tổng thể

Từ lúc file/API của các nguồn về tới khi có bút toán GL và báo cáo.

```mermaid
flowchart TB
    subgraph SRC["Nguồn dữ liệu"]
        CBS["Core Banking"]
        NAP["NAPAS 247"]
        CARD["Visa / Mastercard settlement"]
        WAL["Cổng ví điện tử"]
    end
    SRC --> ING["Nạp & chuẩn hoá<br/>(SCRUM-22)"]
    ING --> VAL{"File hợp lệ?"}
    VAL -- "Không" --> QUA["Cách ly file<br/>báo lỗi nguồn"]
    VAL -- "Có" --> ENG["Engine khớp<br/>Exact / Fuzzy / N:1<br/>(SCRUM-24)"]
    RULES[("MatchingRule<br/>đang ACTIVE")] --> ENG
    ENG -- "Khớp" --> MR["MatchResult"]
    ENG -- "Không khớp / một phần / trùng" --> EX["ExceptionCase<br/>+ gợi ý AI (SCRUM-25)"]
    MR --> GL{"Số tiền điều chỉnh<br/>> 50 triệu?"}
    EX -- "Xử lý xong" --> GL
    GL -- "Không" --> ZT["Hạch toán zero-touch"]
    GL -- "Có" --> MC["Chờ Checker duyệt<br/>(SCRUM-26)"]
    ZT --> LED[("GLEntry")]
    MC --> LED
    LED --> DASH["Dashboard REC-01<br/>& báo cáo"]
```

## 2. Trạng thái quy tắc đối soát (REC-02, REC-03)

Mọi thay đổi quy tắc đều cần người thứ hai duyệt. Người tạo không được tự duyệt.

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Maker lưu nháp
    DRAFT --> PENDING: Gửi duyệt<br/>(chọn Checker khác Maker)
    PENDING --> ACTIVE: Checker duyệt
    PENDING --> DRAFT: Checker trả lại
    ACTIVE --> PENDING: Sửa quy tắc → version + 1
    ACTIVE --> RETIRED: Ngừng dùng
    RETIRED --> [*]
    note right of PENDING
        RULE-REC-05: chặn khi Checker = Maker,
        cả ở form gửi lẫn nút Duyệt
    end note
```

| Kiểm tra | Nơi chặn | Thông báo cho người dùng |
|---|---|---|
| Chọn chính mình làm Checker | Form REC-03, nút "Gửi duyệt" bị khoá | "Vi phạm phân tách nhiệm vụ… RULE-REC-05" |
| Bấm Duyệt quy tắc do mình tạo | Danh sách REC-02 | "Không thể duyệt MR-xxx: bạn là người tạo quy tắc" |
| Tên quy tắc < 4 ký tự hoặc không có khoá khớp | Form REC-03 | Nút gửi bị khoá |

## 3. Trạng thái ngoại lệ (REC-04, REC-05)

```mermaid
stateDiagram-v2
    [*] --> OPEN: Engine tạo ngoại lệ
    OPEN --> IN_PROGRESS: Nhân viên nhận xử lý
    OPEN --> ESCALATED: Quá SLA (RULE-REC-06)
    IN_PROGRESS --> ESCALATED: Quá SLA hoặc bấm Leo thang
    IN_PROGRESS --> RESOLVED: Chọn nguyên nhân + hạch toán điều chỉnh
    ESCALATED --> RESOLVED: Trưởng nhóm xử lý
    RESOLVED --> [*]
```

| Thuộc tính | Ý nghĩa |
|---|---|
| Loại | `UNMATCHED` (không có đối ứng), `PARTIAL` (lệch số tiền), `DUPLICATE` (trùng) |
| Aging bucket | 0–1d, 1–3d, 3–7d, >7d – tính từ lúc tạo |
| SLA | Theo loại và giá trị (mẫu: 24h / 48h / 72h). Quá hạn → banner đỏ và leo thang |
| Gợi ý AI | Top 3 nguyên nhân kèm %. Người xử lý chọn 1 nguyên nhân trước khi hạch toán |

## 4. Hạch toán GL và Maker-Checker (REC-06)

```mermaid
sequenceDiagram
    autonumber
    actor MK as Maker
    participant UI as Aegis Đối soát
    participant SVC as reconciliation-service
    actor CK as Checker
    MK->>UI: Xử lý ngoại lệ, chọn nguyên nhân
    UI->>SVC: Tạo bút toán điều chỉnh
    alt Số tiền ≤ 50 triệu
        SVC-->>UI: POSTED (zero-touch)
    else Số tiền > 50 triệu (RULE-REC-04)
        SVC-->>UI: PENDING – chờ Checker
        CK->>UI: Mở danh sách "Chờ duyệt"
        alt Checker = Maker
            UI-->>CK: Chặn: bạn là Maker của bút toán này
        else Checker khác Maker
            CK->>SVC: Duyệt hoặc Từ chối
            SVC-->>UI: POSTED hoặc REJECTED
        end
    end
    SVC->>SVC: Ghi audit log (ai, khi nào, giá trị cũ/mới)
```

Ngưỡng 50 triệu giữ theo baseline vì CR-002 (đề xuất nâng ngưỡng) chưa được duyệt.

## 5. Truy vết dữ liệu (FR-REC-11, SCRUM-50)

Mỗi bút toán phải lần ngược được về giao dịch gốc. Không bản ghi trung gian nào được thiếu khoá liên kết.

```mermaid
erDiagram
    SOURCE_TRANSACTION ||--o{ MATCH_RESULT : "txn_ids[]"
    MATCH_RESULT ||--o| EXCEPTION_CASE : "khi UNMATCHED/PARTIAL"
    MATCH_RESULT ||--o{ GL_ENTRY : "source_match_id"
    EXCEPTION_CASE ||--o{ GL_ENTRY : "bút toán điều chỉnh"
    MATCHING_RULE ||--o{ MATCH_RESULT : "rule_id + version"
    SOURCE_TRANSACTION {
        string txn_id PK
        string source
        string ref
        decimal amount
        datetime txn_at
    }
    MATCH_RESULT {
        string match_id PK
        string rule_id FK
        string status
    }
    EXCEPTION_CASE {
        string case_id PK
        string match_id FK
        string kind
        string status
        string owner
    }
    GL_ENTRY {
        string entry_id PK
        string source_match_id FK
        decimal amount
        string mode
        string maker
        string checker
        string status
    }
    MATCHING_RULE {
        string rule_id PK
        int version
        string type
        string status
    }
```

Màn REC-05 hiển thị chuỗi 4 bước SourceTransaction → MatchResult → ExceptionCase → GLEntry. Bước chưa có dữ liệu ghi rõ "Không tìm thấy đối ứng" hoặc "Chưa hạch toán".

## 6. Bản đồ màn hình

```mermaid
flowchart LR
    D["REC-01 Tổng quan<br/>KPI · nguồn dữ liệu"] --> R["REC-02 Quy tắc"]
    R --> F["REC-03 Tạo quy tắc<br/>(kiểm tra SoD)"]
    D --> E["REC-04 Ngoại lệ"]
    E --> X["REC-05 Chi tiết<br/>so sánh · AI · truy vết"]
    X -- "Xử lý & hạch toán" --> G["REC-06 Bút toán GL"]
    D --> G
```

## 7. Chỉ số trên REC-01

| Chỉ số | Định nghĩa | Mục tiêu |
|---|---|---|
| Tỷ lệ khớp tự động | Giao dịch khớp không cần người ÷ tổng giao dịch | ≥ 95% |
| MTTR | Thời gian trung bình từ lúc tạo đến khi xử lý xong ngoại lệ | ≤ 4h |
| Giá trị chưa khớp | Tổng chênh lệch của ngoại lệ đang mở | Theo dõi |
| Zero-touch | Bút toán tự hạch toán ÷ tổng bút toán | ≥ 30% giai đoạn đầu (KPI-05) |
| Trạng thái nạp nguồn | Đúng lịch / Trễ / Cách ly, kèm `last_updated_at` | UAT-REC-02, UAT-REC-09 |

## 8. Truy vết UAT

| UAT | Kiểm tra trên UI mẫu |
|---|---|
| UAT-REC-02 | Nguồn ví điện tử bị cách ly, có ghi chú lỗi |
| UAT-REC-07 | Bút toán > 50 triệu ở trạng thái "Chờ Checker" |
| UAT-REC-08 | Không gửi được quy tắc khi Checker = Maker |
| UAT-REC-09 | Bảng nguồn có thời điểm cập nhật |
| UAT-REC-10 | Chuỗi truy vết 4 bước ở REC-05 |
