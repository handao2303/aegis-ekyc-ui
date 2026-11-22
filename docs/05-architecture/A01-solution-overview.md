# A01 · Tổng quan giải pháp eKYC – kiến trúc, luồng và điều hướng UI

| | |
|---|---|
| Epic | [SCRUM-69](https://baohandao2303.atlassian.net/browse/SCRUM-69) · nền tảng cho C04–C18 |
| UI | [Bản chạy thật](https://handao2303.github.io/aegis-ekyc-ui/) · mã nguồn `src/` |
| Mục đích | Một chỗ nhìn toàn cảnh trước khi đọc từng tài liệu C-xx, R01, L01, A02 |

## 1. Bối cảnh hệ thống (System Context)

Ai dùng hệ thống, hệ thống nói chuyện với bên ngoài nào.

```mermaid
flowchart LR
    KH(["Khách hàng<br/>App Aegis"])
    CO(["Nhân viên Compliance<br/>Maker / Checker"])
    PO(["PO / Quản lý<br/>Báo cáo"])

    subgraph AEGIS["Aegis eKYC"]
        SYS["Nền tảng eKYC<br/>mở tài khoản trực tuyến"]
    end

    KH -- "Đồng ý, chụp giấy tờ,<br/>NFC, khuôn mặt" --> SYS
    CO -- "Xét duyệt hồ sơ REFER" --> SYS
    PO -- "Xem KPI, SLA" --> SYS

    SYS -- "So khớp khuôn mặt,<br/>liveness" --> FV["Nhà cung cấp<br/>sinh trắc học"]
    SYS -- "Tra cứu tín dụng" --> CIC["CIC"]
    SYS -- "Sàng lọc AML / PEP<br/>/ danh sách cấm" --> AML["Dịch vụ AML"]
    SYS -- "Tạo tài khoản" --> CORE["Core Banking"]
    SYS -- "SMS / Push / Email" --> NOTI["Notification<br/>Service"]
```

## 2. Thành phần (Container)

```mermaid
flowchart TB
    subgraph CLIENT["Kênh"]
        MOB["Mobile app<br/>React Native / Expo bare<br/>OCR SDK · NFC · Liveness"]
        IOS["Aegis Scan (iOS, Swift)<br/>MRZ + chip NFC<br/>bản mẫu – A02"]
        WEB["Web vận hành (Next.js)<br/>Compliance · Đối soát · Hạn mức"]
    end

    subgraph GCP["Google Cloud"]
        GW["API Gateway<br/>OAuth2 · mTLS"]
        EK["ekyc-service<br/>Cloud Run"]
        LIM["limit-service<br/>Cloud Run"]
        REC["reconciliation-service<br/>Cloud Run"]
        PS[["Pub/Sub<br/>ekyc.session.*<br/>ekyc.decision.completed"]]
        DB[("Cloud SQL Postgres<br/>sessions · documents<br/>kyc_decisions · audit_event")]
        GCS[("Cloud Storage<br/>ảnh giấy tờ, selfie<br/>mã hoá, có TTL")]
        DWH[("BigQuery DWH<br/>fact_ekyc_*")]
    end

    MOB --> GW
    IOS -. "kế hoạch" .-> GW
    WEB --> GW
    GW --> REC
    GW --> LIM
    LIM -- "limit.authorization.processed" --> REC
    GW --> EK
    EK --> DB
    EK --> GCS
    EK -- "publish" --> PS
    PS -- "push" --> LIM
    PS --> DWH
    DB -- "CDC" --> DWH
    EK --> EXT["CIC · AML · Biometric<br/>(qua adapter, circuit breaker)"]
```

Chi tiết từng phần: vòng đời phiên ở [C06](../01-business/C06-session-lifecycle.md), audit ở [C10](../01-business/C10-maker-checker-audit.md), đo lường ở [C18](../04-analytics/C18-kpi-metric-dictionary.md), đối soát ở [R01](../06-reconciliation/R01-reconciliation-flow.md), hạn mức ở [L01](../07-credit-limit/L01-credit-limit-flow.md), app quét giấy tờ ở [A02](A02-ios-document-scan.md).

## 3. Luồng end-to-end – mở tài khoản thành công (STP)

```mermaid
sequenceDiagram
    autonumber
    actor KH as Khách hàng
    participant APP as Mobile app
    participant EK as ekyc-service
    participant BIO as Biometric
    participant RISK as CIC + AML
    participant PS as Pub/Sub
    participant LIM as limit-service
    participant CORE as Core Banking

    KH->>APP: Mở app, đồng ý điều khoản
    APP->>EK: POST /sessions (consent_scope, terms_version)
    EK-->>APP: session_id
    KH->>APP: Chụp mặt trước / sau
    APP->>EK: POST /sessions/:id/ocr
    EK->>EK: Kiểm tra trùng KH (C04), hạn giấy tờ, tuổi (C05)
    KH->>APP: Áp thẻ vào máy (NFC)
    APP->>EK: POST /sessions/:id/nfc (DG1, DG2, SOD)
    EK->>EK: Xác thực chữ ký số chip (C11)
    KH->>APP: Làm liveness
    APP->>EK: POST /sessions/:id/liveness
    EK->>BIO: So khớp selfie với ảnh chip
    BIO-->>EK: face_match, liveness_score
    EK->>RISK: Sàng lọc
    RISK-->>EK: risk_score, cờ PEP / sanction
    EK->>EK: Quyết định STP_APPROVED
    EK->>CORE: Tạo tài khoản (idempotency key)
    CORE-->>EK: account_no
    EK->>PS: ekyc.decision.completed
    PS->>LIM: Khởi tạo hạn mức
    EK-->>APP: Kết quả + số tài khoản
    APP-->>KH: Màn "Thành công"
```

Nhánh REFER và REJECTED: xem [C07–C09](../01-business/C07-C09-refer-handling.md).

## 4. Cây quyết định tổng

```mermaid
flowchart TD
    A["Đủ dữ liệu phiên"] --> B{"Đã có tài khoản?<br/>(C04)"}
    B -- "Có" --> X1["Dừng · mời đăng nhập"]
    B -- "Không" --> C{"Giấy tờ hợp lệ,<br/>đủ tuổi? (C05)"}
    C -- "Không" --> R1["REJECTED<br/>DOC_EXPIRED / UNDER_AGE"]
    C -- "Có" --> D{"Nguồn ảnh<br/>so khớp (C11)"}
    D -- "OCR-only" --> RF["REFER"]
    D -- "Chip hợp lệ" --> E{"Liveness &<br/>face match"}
    E -- "Vùng biên" --> RF
    E -- "Đạt" --> F{"Rủi ro<br/>CIC + AML"}
    F -- "Cao" --> R2["REJECTED"]
    F -- "PEP / trung bình" --> RF
    F -- "Thấp" --> G{"Velocity / thiết bị<br/>(C13)"}
    G -- "Nghi vấn" --> RF
    G -- "Sạch" --> OK["STP_APPROVED"]
    RF --> Q["Hàng đợi Compliance<br/>SLA 24h (C09)"]
```

## 5. Bản đồ màn hình – App khách hàng

22 màn hình (19 eKYC + 3 Hạn mức thẻ), mã khớp với cột "Mã" trong UI Kit.

```mermaid
flowchart TB
    I["eKYC-00<br/>Giới thiệu"] --> C["eKYC-01<br/>Đồng ý"]
    C --> DT["eKYC-02<br/>Chọn giấy tờ"]
    DT --> CF["eKYC-03<br/>Chụp mặt trước"]
    CF --> RF["eKYC-04<br/>Kiểm tra ảnh"]
    RF -- "Chụp lại" --> CF
    RF --> CB["eKYC-03b<br/>Chụp mặt sau"]
    CB --> OR["eKYC-05<br/>Kiểm tra thông tin"]
    OR --> N["eKYC-03B<br/>NFC"]
    N --> L["eKYC-06<br/>Khuôn mặt"]
    L --> V["eKYC-06b<br/>Đang xác minh"]
    V --> AP["eKYC-07<br/>Thành công"]
    V --> RE["eKYC-09<br/>Đang xem xét"]
    V --> RJ["eKYC-08<br/>Từ chối"]

    CF -. "Lỗi đọc" .-> UR["eKYC-03C<br/>Không đọc được"]
    UR -. "Thử lại" .-> CF
    OR -. "Đã có TK" .-> DU["eKYC-12<br/>Đã có tài khoản"]
    OR -. "Hết hạn" .-> EX["eKYC-13<br/>Giấy tờ hết hạn"]
    RE -. "Compliance yêu cầu" .-> RQ["eKYC-11<br/>Bổ sung hồ sơ"]
    RS["eKYC-10<br/>Tiếp tục phiên"] -.-> L
    RC["eKYC-01R<br/>Đồng ý lại"] -.-> C
    AP --> M1["LIM-M1<br/>Thẻ của tôi"]
    M1 --> M2["LIM-M2<br/>Ưu đãi Boost"]
    M1 -.-> M3["LIM-M3<br/>Khoá Boost"]
```

Nét liền: luồng chính. Nét đứt: ngoại lệ. Sau khi mở tài khoản thành công, "Vào trang chủ" dẫn sang nhóm Hạn mức thẻ (22 màn tổng cộng). Chi tiết Hạn mức ở [L01](../07-credit-limit/L01-credit-limit-flow.md).

## 6. Bản đồ màn hình – Aegis Compliance

```mermaid
flowchart LR
    LOGIN["Đăng nhập SSO"] --> Q["Hàng đợi<br/>lọc · tìm · SLA"]
    Q --> CD["Chi tiết hồ sơ"]
    CD -- "Duyệt / Từ chối" --> DEC{"Cần<br/>Maker-Checker?"}
    DEC -- "Không" --> DONE["Đã xử lý"]
    DEC -- "PEP / rủi ro cao" --> CK["Chờ Checker"]
    CK --> DONE
    CD -- "Yêu cầu bổ sung" --> WAIT["Chờ khách<br/>SLA tạm dừng"]
    WAIT --> Q
    Q -.-> SLA["Báo cáo SLA"]
    Q -.-> CFG["Cấu hình ngưỡng<br/>(cần người thứ 2 duyệt)"]
```

## 7. Triển khai UI

```mermaid
flowchart LR
    DEV["npm run deploy"] --> B["next build<br/>BASE_PATH=/aegis-ekyc-ui"]
    B --> OUT["Static export<br/>out/"]
    OUT --> BR["Nhánh gh-pages"]
    BR --> GP["GitHub Pages<br/>handao2303.github.io/aegis-ekyc-ui"]
```

| Trang | Đường dẫn |
|---|---|
| UI Kit & tài liệu thiết kế | `/` |
| App khách hàng | `/app/` |
| Aegis Compliance | `/compliance/` |
| Aegis Đối soát (REC-01 → 06) | `/reconciliation/` |
| Aegis Hạn mức (LIM-W1 → W4) | `/credit-limit/` |
| App iPhone native – quét CCCD/hộ chiếu | `ios/AegisScan` (cài qua Xcode) |

Bản demo dùng dữ liệu giả, không gọi API thật. Hướng đi khi nối backend:

| Phần | Hướng đi |
|---|---|
| Web vận hành (Compliance, Đối soát, Hạn mức) | Giữ Next.js, thay dữ liệu mẫu bằng API qua API Gateway |
| App khách hàng | `mobile-app` (React Native / Expo bare) dùng lại token Aurora và cấu trúc màn hình của bản web |
| Đọc chip CCCD / hộ chiếu | Logic MRZ + NFC của Aegis Scan (A02) đưa vào app thật dưới dạng native module, hoặc thay bằng SDK eKYC của đối tác |
