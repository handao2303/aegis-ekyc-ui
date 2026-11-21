# C06 · Vòng đời phiên eKYC

| | |
|---|---|
| Jira | [SCRUM-75](https://baohandao2303.atlassian.net/browse/SCRUM-75) |
| BR / FR / RULE | BR-14 · FR-11 · RULE-11 |
| UI | `Resume`, `Consent` (chế độ re-consent) |

## 1. Sơ đồ trạng thái phiên

Phần "trong quá trình làm" của hồ sơ. Kết quả quyết định nằm ở sơ đồ tổng trong [C03](../00-governance/C03-requirements-addendum-v1.3.md).

```mermaid
stateDiagram-v2
    direction LR
    [*] --> CREATED: Mở app, bấm Bắt đầu
    CREATED --> CONSENTED
    CONSENTED --> DOC_CAPTURED
    DOC_CAPTURED --> LIVENESS_DONE
    LIVENESS_DONE --> SCREENING
    SCREENING --> DECIDED
    DECIDED --> [*]

    state "ABANDONED" as AB
    CREATED --> AB: 30 phút không thao tác
    CONSENTED --> AB
    DOC_CAPTURED --> AB
    LIVENESS_DONE --> AB
    AB --> CONSENTED: Tiếp tục, bước cuối = Consent
    AB --> DOC_CAPTURED: Tiếp tục, bước cuối = Giấy tờ
    AB --> EXPIRED: Quá 7 ngày
    EXPIRED --> [*]: Xoá ảnh và dữ liệu chip
```

## 2. RULE-EKYC-11

| Tham số | Mặc định | Cấu hình được |
|---|---|---|
| T1 – không thao tác → ABANDONED | 30 phút | Có |
| T2 – ABANDONED → EXPIRED | 7 ngày | Có |
| Bước được giữ khi tiếp tục | Bước cuối cùng đã hoàn tất | — |
| Liveness | **Luôn làm lại** khi tiếp tục | Không |
| Điều khoản đổi trong lúc phiên dở | Bắt buộc re-consent trước khi đi tiếp | Không |

**Vì sao Liveness luôn làm lại:** kết quả liveness chỉ chứng minh có người thật **tại thời điểm đó**. Dùng lại kết quả cũ cho phép người khác cầm máy hoàn tất hồ sơ.

## 3. Luồng tiếp tục phiên

```mermaid
sequenceDiagram
    autonumber
    actor K as Khách hàng
    participant App
    participant EK as ekyc-service
    participant CMS as CMS Điều khoản
    K->>App: Mở lại app
    App->>EK: GET /sessions/active (device_id + CCCD hash)
    EK-->>App: Phiên ABANDONED, last_step = DOC_CAPTURED
    App->>CMS: Lấy latest_terms_version
    alt Điều khoản đã đổi
        App->>K: Màn Đồng ý lại điều khoản
        K->>App: Đồng ý
        App->>EK: POST /sessions/{id}/consent (ConsentRecord mới)
    end
    App->>K: Màn "Tiếp tục hồ sơ đang làm dở?"
    alt Tiếp tục
        K->>App: Tiếp tục từ bước 4
        App->>EK: PATCH status → DOC_CAPTURED, liveness = reset
        App->>K: Màn Xác thực khuôn mặt
    else Làm lại từ đầu
        K->>App: Làm lại
        App->>EK: POST /sessions/{id}/cancel
        EK->>EK: Xoá dữ liệu tạm
        App->>K: Màn Giới thiệu
    end
```

## 4. Job nền

| Job | Lịch | Việc làm | Ghi nhận |
|---|---|---|---|
| `session-abandon-scan` | Mỗi 5 phút | Phiên quá T1 không thao tác → ABANDONED | Sự kiện `ekyc.session.abandoned` cho funnel (C18) |
| `session-expire` | Hằng ngày 02:00 | ABANDONED quá T2 → EXPIRED, gọi retention (C12) xoá ảnh/chip | Số phiên hết hạn, số file xoá |

## 5. Ngoại lệ

| Tình huống | Xử lý |
|---|---|
| Khách đổi thiết bị | Tìm phiên theo CCCD hash sau khi chụp giấy tờ; nếu thấy phiên trên thiết bị khác → hỏi khách, đồng thời tăng bộ đếm velocity (C13) |
| CMS không trả `latest_terms_version` | Không cho đi tiếp (theo IF-02), hiển thị lỗi thử lại |
