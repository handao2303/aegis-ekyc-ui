# L01 · Hạn mức tín dụng thời gian thực – authorization, Boost và gian lận

| | |
|---|---|
| Epic | [SCRUM-8](https://baohandao2303.atlassian.net/browse/SCRUM-8) · Real-time Credit Limit |
| Story | SCRUM-27 → 30, 38 (backend), [SCRUM-51](https://baohandao2303.atlassian.net/browse/SCRUM-51) (FE mobile LIM-M1 → M3), [SCRUM-52](https://baohandao2303.atlassian.net/browse/SCRUM-52) (FE web LIM-W1 → W4), SCRUM-53 (đối chiếu EOD), SCRUM-54 (Notification) |
| UI mẫu | Web: [/credit-limit/](https://handao2303.github.io/aegis-ekyc-ui/credit-limit/) · Mobile: [/app/?screen=cardHome](https://handao2303.github.io/aegis-ekyc-ui/app/?screen=cardHome) |
| Quy tắc chính | BR-LIM-02 (kiểm soát đồng thời), BR-LIM-07 (khoá Boost), SLA p99 < 2s, NFR-SEC-04 (che PAN) |
| Baseline | BAS-BRD-v1.2 §2.3 (BR-LIM-01 → 10), §3.5 (5 entity), §4.3 (UC-LIM-01 → 06), §5.3 (RULE-LIM-01 → 08), §6.3 (US-LIM-01 → 06) · BAS-RAID-v1.2 |
| Bộ tài liệu | L01 luồng · [L02](L02-requirements-gap-rtm.md) yêu cầu, điểm lệch, RTM · [L03](L03-ui-spec.md) giao diện · [L04](L04-test-plan-cases.md) kiểm thử UI · [L05](L05-api-data-dictionary.md) API, dữ liệu · [L06](L06-nfr-kpi.md) NFR, KPI · [L07](L07-sit-perf-uat.md) SIT, hiệu năng, UAT |
| Phiên bản | 1.1 · 25/11/2026 · Han Dao (BA) |
| Trạng thái | 🔧 Luồng mục tiêu. Có 9 điểm lệch với baseline chờ quyết định ở [L02 §3](L02-requirements-gap-rtm.md) |

## 1. Xử lý một giao dịch thẻ (ISO 8583)

Mỗi yêu cầu authorization phải trả lời trong 2 giây (p99), không bị trừ hạn mức 2 lần khi tổ chức thẻ gửi lại, và không vượt hạn mức khi 2 giao dịch đến cùng lúc.

```mermaid
sequenceDiagram
    autonumber
    participant SCH as Tổ chức thẻ
    participant LIM as limit-service
    participant DB as CardLimitProfile
    participant CASA as Core Banking (CASA)
    SCH->>LIM: 0100 Authorization (STAN, RRN, số tiền)
    LIM->>LIM: Đã xử lý STAN/RRN này chưa? (SCRUM-28)
    alt Gửi lại (trùng)
        LIM-->>SCH: 0110 trả lại kết quả cũ, không trừ lần 2
    else Giao dịch mới
        LIM->>DB: Đọc hạn mức + version
        alt Đủ hạn mức (gồm Boost nếu có)
            LIM->>DB: UPDATE ... WHERE version = v (BR-LIM-02)
            alt Ghi thành công
                LIM-->>SCH: 0110 APPROVED (mã 00)
            else Version đã đổi (giao dịch khác vừa ghi)
                LIM->>DB: Đọc lại và tính lại
            end
        else Thiếu hạn mức, Smart Fallback đang bật
            LIM->>CASA: Tạm giữ phần thiếu (SCRUM-29)
            CASA-->>LIM: HOLD thành công
            LIM-->>SCH: 0110 APPROVED (00·CASA)
        else Thiếu hạn mức, không fallback
            LIM-->>SCH: 0110 DECLINED (mã 51)
        end
    end
    LIM->>LIM: Ghi AuthorizationLog (PAN đã che, độ trễ ms)
    LIM-)LIM: Phát limit.authorization.processed → đối soát EOD (SCRUM-53)
```

Huỷ giao dịch (MTI **0420** – reversal, hoặc 0120 – advice; BR-LIM-08, UC-LIM-05) giải phóng đúng số đã trừ, kể cả phần tạm giữ ở CASA (UAT-LIM-05). UI mẫu đang ghi reversal là 0400 kèm quyết định DECLINED – lệch baseline, xem DEF-LIM-01 ở [L04](L04-test-plan-cases.md).

> ⚠️ **Kiểm soát đồng thời.** Sơ đồ trên vẽ cách ghi có điều kiện version (optimistic). Baseline UC-LIM-02 lấy khoá dòng hoặc khoá phân tán + trừ nguyên tử (CAS) làm luồng chính, optimistic chỉ là luồng phụ khi tải thấp. Cách chọn chờ Tech Lead chốt ở D-LIM-02 ([L02 §3](L02-requirements-gap-rtm.md)). Dù chọn cách nào, quá thời gian chờ khoá thì từ chối fail-safe (RULE-LIM-01).

## 2. Cây quyết định

```mermaid
flowchart TD
    A["Nhận 0100"] --> B{"Thẻ đang khoá?"}
    B -- "Có" --> D1["DECLINED · 05"]
    B -- "Không" --> C{"Số tiền ≤ khả dụng<br/>(hạn mức + Boost − đã dùng − tạm giữ)?"}
    C -- "Có" --> OK["APPROVED · 00"]
    C -- "Không" --> F{"Smart Fallback bật<br/>và CASA đủ tiền?"}
    F -- "Có" --> FB["APPROVED · 00·CASA<br/>FallbackTransaction = HOLD"]
    F -- "Không" --> D2["DECLINED · 51"]
    FB --> S{"Quyết toán"}
    S -- "Settle" --> ST["SETTLED"]
    S -- "Huỷ / hết hạn giữ" --> RL["RELEASED"]
```

## 3. Ngắt mạch kết nối Core Banking (circuit breaker)

```mermaid
stateDiagram-v2
    [*] --> CLOSED
    CLOSED --> OPEN: Lỗi / timeout vượt ngưỡng
    OPEN --> HALF_OPEN: Hết thời gian chờ
    HALF_OPEN --> CLOSED: Gọi thử thành công
    HALF_OPEN --> OPEN: Gọi thử thất bại
    note right of OPEN
        Không gọi CBS; giao dịch cần CASA
        bị từ chối nhanh thay vì treo
    end note
```

## 4. Vòng đời Temporary Limit Boost

```mermaid
stateDiagram-v2
    [*] --> OFFERED: Behavioral score đạt ngưỡng
    OFFERED --> ACTIVE: Khách nhận (LIM-M2)
    OFFERED --> DECLINED: Khách chọn "Để sau"
    ACTIVE --> EXPIRED: Hết thời hạn (tự động, UAT-LIM-06)
    ACTIVE --> LOCKED: Nghi vấn gian lận cao (BR-LIM-07)
    LOCKED --> ACTIVE: Khách xác nhận / Risk mở khoá có lý do
    LOCKED --> EXPIRED: Hết thời hạn khi đang khoá
    DECLINED --> [*]
    EXPIRED --> [*]
```

| Quy tắc | Chi tiết |
|---|---|
| Thời hạn | Boost luôn có giờ kết thúc (UI mẫu: 72 giờ, baseline: chu kỳ sao kê – xem dưới). Hết hạn thì tự trở về hạn mức gốc, không cần thao tác |
| Hiển thị cho khách | Hạn mức mới, thời hạn, tự trở về, phí. Phải tick "hiểu điều kiện khoá" mới nhận được |
| Mở khoá phía ngân hàng | Bắt buộc nhập lý do (≥ 10 ký tự), ghi audit |
| Trạng thái theo baseline | Entity TemporaryLimitBoost (BRD §3.5) chỉ có `ACTIVE`, `EXPIRED`, `LOCKED_SUSPECTED_FRAUD`. `OFFERED` và `DECLINED` là trạng thái của **lời mời** (đề xuất bảng `boost_offers` ở [L05](L05-api-data-dictionary.md)), không phải của Boost. `LOCKED` trên sơ đồ = `LOCKED_SUSPECTED_FRAUD` |
| Thời hạn theo baseline | BR-LIM-06, RULE-LIM-06: hết hiệu lực **sau chu kỳ sao kê kế tiếp**, trần theo % hạn mức gốc. UI mẫu đang dùng 72 giờ – điểm lệch D-LIM-01 |

## 5. Phát hiện bất thường → khoá Boost → báo khách

```mermaid
sequenceDiagram
    autonumber
    participant FE as Fraud Engine
    participant LIM as limit-service
    participant NS as Notification Service
    actor KH as Khách hàng
    actor RK as Risk (LIM-W4)
    FE->>LIM: Tín hiệu (velocity, vị trí lệch, thiết bị mới) + điểm
    alt Điểm cao
        LIM->>LIM: Boost → LOCKED
        LIM->>NS: Gửi SMS + App push (mẫu đã duyệt)
        NS-->>LIM: delivery_status
        alt SMS thất bại
            LIM->>NS: Gửi lại (tự động hoặc Risk bấm "Gửi lại")
        end
        NS->>KH: "Hạn mức tạm thời đã tạm khoá…"
        KH->>LIM: LIM-M3: "Đúng là tôi" hoặc "Không phải tôi"
        alt Không phải tôi
            LIM->>LIM: Khoá thẻ, mở tra soát
        else Đúng là tôi
            LIM->>RK: Đưa vào hàng chờ mở khoá
        end
    else Điểm thấp
        LIM->>RK: Chỉ gắn cờ theo dõi, không khoá
    end
```

Nội dung SMS/App hiện là bản giữ chỗ, chờ Risk/Legal/CSKH duyệt; Notification Service thật chưa sẵn sàng (DEP-07, SCRUM-54).

## 6. Bản đồ màn hình

```mermaid
flowchart LR
    subgraph WEB["Web vận hành (LIM-W)"]
        W1["W1 Giám sát Authorization<br/>p99 · throughput · circuit breaker · log"]
        WL["Danh sách thẻ (G-07)"]
        W2["W2 Hồ sơ hạn mức<br/>version · Smart Fallback"]
        W3["W3 Boost<br/>ACTIVE / LOCKED / EXPIRED"]
        W4["W4 Giám sát gian lận<br/>SMS / App delivery"]
        WL --> W2
    end
    subgraph MOB["App khách hàng (LIM-M)"]
        M1["M1 Thẻ của tôi<br/>hạn mức · Fallback"]
        M2["M2 Ưu đãi Boost"]
        M3["M3 Thông báo khoá Boost"]
        M1 --> M2
        M1 --> M3
    end
    OK["eKYC: Mở tài khoản<br/>thành công"] --> M1
    W4 -. "khoá Boost" .-> M3
```

## 7. Truy vết UAT

| UAT | Kiểm tra trên UI mẫu |
|---|---|
| UAT-LIM-01 | Màn W2 báo xung đột version khi giao dịch khác cập nhật trước |
| UAT-LIM-03/04 | Lịch sử FallbackTransaction HOLD / SETTLED / RELEASED; công tắc Smart Fallback ở M1 |
| UAT-LIM-05 | Log phải có reversal MTI 0420 – UI mẫu chưa đạt (TC-LIM-07, DEF-LIM-01) |
| UAT-LIM-06 | M1 đếm ngược tới lúc Boost hết hạn; W3 có tab EXPIRED |
| UAT-LIM-07 | W4 có trạng thái gửi SMS/App và gửi lại; M3 cho khách xác nhận |
| UAT-LIM-10 | PAN luôn che ở mọi màn |

Ca kiểm thử chi tiết và kết quả chạy trên UI mẫu (31/33 đạt): [L04](L04-test-plan-cases.md). Kịch bản UAT đầy đủ: [L07 §3](L07-sit-perf-uat.md).

## 8. Kiểm soát tài liệu

### Lịch sử phiên bản

| Phiên bản | Ngày | Người sửa | Commit | Thay đổi |
|---|---|---|---|---|
| 0.1 | 21/11/2026 | Han Dao | `b8931f8` | Bản đầu cùng UI mẫu web và mobile: ISO 8583, cây quyết định, circuit breaker, Boost, gian lận |
| 1.0 | 23/11/2026 | Han Dao | `792bbfa` | Chuyển vào `docs/03-credit-limit`, thêm bản đồ màn hình và truy vết UAT |
| 1.1 | 25/11/2026 | Han Dao | — | Đối chiếu BAS-BRD-v1.2: reversal MTI 0420/0120, cách kiểm soát đồng thời của UC-LIM-02, trạng thái và thời hạn Boost theo baseline; liên kết bộ L02 → L07; thêm mục kiểm soát tài liệu (ISO/IEC/IEEE 29148) |

### Phê duyệt

| Vai trò | Người | Ngày | Kết luận |
|---|---|---|---|
| BA (soạn) | Han Dao | 25/11/2026 | Trình duyệt |
| Product Owner | | | |
| Risk tín dụng | | | |
| Vận hành thẻ | | | |
| Tech Lead | | | |
