# Tài liệu Aegis – eKYC, Đối soát, Hạn mức

Bộ tài liệu cho 18 hạng mục của Epic [SCRUM-69 – eKYC Completion & Production Readiness](https://baohandao2303.atlassian.net/browse/SCRUM-69), cùng 2 phân hệ [Đối soát (SCRUM-7)](https://baohandao2303.atlassian.net/browse/SCRUM-7), [Hạn mức (SCRUM-8)](https://baohandao2303.atlassian.net/browse/SCRUM-8) và app iPhone quét giấy tờ.
Tổng quan và kế hoạch: [Gap Analysis & Delivery Plan (Confluence)](https://baohandao2303.atlassian.net/wiki/spaces/SCRUM/pages/15106049).

Các diagram viết bằng Mermaid, GitHub tự hiển thị. Tổng cộng 45 diagram, tất cả đã được kiểm tra cú pháp.

**Bắt đầu từ đây:** [A01 Tổng quan giải pháp](05-architecture/A01-solution-overview.md) – bối cảnh hệ thống, thành phần, luồng end-to-end, cây quyết định, bản đồ màn hình và cách triển khai UI.

## Bức tranh tổng thể

```mermaid
flowchart LR
    subgraph G["00 · Quản trị"]
        C01["C01 Đồng bộ Jira"]
        C02["C02 Compliance Mapping"]
        C03["C03 BRD/FSD/SRS v1.3 + RTM"]
    end
    subgraph B["01 · Nghiệp vụ"]
        C0405["C04–C05 Trùng KH & hợp lệ giấy tờ"]
        C06["C06 Vòng đời phiên"]
        C0709["C07–C09 Xử lý REFER"]
        C10["C10 Maker-Checker & Audit"]
    end
    subgraph P["02 · Tuân thủ & gian lận"]
        C11["C11 Nguồn sinh trắc học"]
        C12["C12 Đồng ý & lưu trữ"]
        C1314["C13–C14 Chống gian lận"]
    end
    subgraph Q["03 · Chất lượng"]
        C15["C15 Hiệu năng"]
        C16["C16 SIT"]
        C17["C17 UAT"]
    end
    subgraph A["04 · Đo lường"]
        C18["C18 KPI"]
    end
    subgraph X["05 · Kiến trúc"]
        A01["A01 Tổng quan giải pháp"]
        A02["A02 App iPhone quét giấy tờ"]
    end
    subgraph RC["06 · Đối soát"]
        R01["R01 Luồng & kiểm soát"]
    end
    subgraph LM["07 · Hạn mức"]
        L01["L01 Authorization, Boost, gian lận"]
    end
    C02 --> C03
    C02 --> C11
    C02 --> C12
    C03 --> B
    C03 --> P
    B --> C16
    P --> C16
    C16 --> C17
    C03 --> C17
    C15 --> C17
    B --> C18
    A01 --> A02
    A01 --> R01
    A01 --> L01
    C11 --> A02
    L01 -. "limit.authorization.processed" .-> R01
```

## Mục lục

| Nhóm | Tài liệu | Jira | Diagram | Trạng thái |
|---|---|---|---|---|
| 00 · Quản trị | [C01 Nhật ký đồng bộ Jira](00-governance/C01-jira-hygiene-log.md) | SCRUM-70 | — | ✅ Hoàn tất |
| | [C02 Compliance Mapping](00-governance/C02-compliance-mapping.md) | SCRUM-71 | Flowchart (truy vết) | 📝 Chờ Compliance xác nhận |
| | [C03 Requirements Addendum v1.3 & RTM](00-governance/C03-requirements-addendum-v1.3.md) | SCRUM-72 | State | 📝 Chờ PO & Compliance duyệt |
| 01 · Nghiệp vụ | [C04–C05 Trùng khách hàng & hợp lệ giấy tờ](01-business/C04-C05-identity-validation.md) | SCRUM-73, 74 | Flowchart | ✅ Đặc tả + UI + backend mẫu ([server/](../server/README.md)), có test UAT |
| | [C06 Vòng đời phiên](01-business/C06-session-lifecycle.md) | SCRUM-75 | State, Sequence | ✅ Đặc tả + UI + backend mẫu ([server/](../server/README.md)), có test UAT |
| | [C07–C09 Xử lý hồ sơ REFER](01-business/C07-C09-refer-handling.md) | SCRUM-76, 77, 78 | Swimlane, Sequence, State | ✅ Đặc tả + UI + backend mẫu ([server/](../server/README.md)), có test UAT |
| | [C10 Maker-Checker & Audit](01-business/C10-maker-checker-audit.md) | SCRUM-79 | Flowchart, ERD | ✅ Đặc tả + UI + backend mẫu ([server/](../server/README.md)), có test UAT |
| 02 · Tuân thủ | [C11 Nguồn ảnh sinh trắc học](02-compliance/C11-biometric-source.md) | SCRUM-80 | Flowchart | 🔧 Đặc tả xong, chờ C02 |
| | [C12 Rút lại đồng ý & lưu trữ](02-compliance/C12-consent-retention.md) | SCRUM-81 | Flowchart, Sequence | 🔧 Đặc tả xong, chờ C02 |
| | [C13–C14 Chống gian lận](02-compliance/C13-C14-fraud-controls.md) | SCRUM-82, 83 | Flowchart, Sequence | 🔧 Đặc tả + kế hoạch spike xong |
| 03 · Chất lượng | [C15 Kế hoạch hiệu năng](03-quality/C15-performance-test-plan.md) | SCRUM-84 | Flowchart | 🔧 Kế hoạch xong, chờ thiết bị/môi trường |
| | [C16 Kế hoạch SIT](03-quality/C16-sit-plan.md) | SCRUM-85 | Flowchart, Sequence | ⛔ Kế hoạch xong, bị chặn bởi SCRUM-56 |
| | [C17 Bộ UAT & biên bản](03-quality/C17-uat-pack.md) | SCRUM-86 | Flowchart | ⛔ Bộ case xong, chờ C03 + C16 |
| 04 · Đo lường | [C18 KPI & từ điển chỉ số](04-analytics/C18-kpi-metric-dictionary.md) | SCRUM-87 | Flowchart | 🔧 Đặc tả + màn Báo cáo SLA mẫu xong |
| 05 · Kiến trúc | [A01 Tổng quan giải pháp](05-architecture/A01-solution-overview.md) | SCRUM-69 | Context, Container, Sequence, Flowchart ×4 | ✅ Hoàn tất |
| | [A02 App iPhone quét giấy tờ](05-architecture/A02-ios-document-scan.md) | SCRUM-18, 80 | Flowchart ×2, Sequence, State | 🔧 Bản mẫu chạy được, chưa có CSCA & liveness |
| 06 · Đối soát | [R01 Luồng, trạng thái & kiểm soát](06-reconciliation/R01-reconciliation-flow.md) | SCRUM-7, 49, 50 | Flowchart ×2, State ×2, Sequence, ERD | 🔧 Đặc tả + UI mẫu xong, chờ backend |
| 07 · Hạn mức | [L01 Authorization, Boost & gian lận](07-credit-limit/L01-credit-limit-flow.md) | SCRUM-8, 51, 52, 54 | Sequence ×2, Flowchart ×2, State ×2 | 🔧 Đặc tả + UI mẫu xong, chờ Notification thật |

## Việc còn lại ngoài tài liệu

| Việc | Ai | Chặn |
|---|---|---|
| Xác minh văn bản pháp lý, trả lời 4 câu hỏi mở | Compliance | C03, C05, C11, C12 |
| Duyệt BRD/FSD/SRS v1.3 | PO + Compliance | C17 |
| Thay adapter giả lập bằng kết nối thật CIC/AML/CBS/Notification; Postgres, SSO | Dev | C16 |
| Sandbox đối tác DEP-01→04, 07–09 | Solution Owner | C16 |
| Thiết bị NFC thứ hai để đo hiệu năng | Dev/QA | C15 |
| Master list CSCA, tài khoản Apple Developer để đọc chip | Dev | A02 |
| Duyệt mẫu SMS/App khoá Boost, Notification Service thật | Risk/Legal/CSKH, Solution Owner | L01 (SCRUM-54) |
| Backend reconciliation-service: lineage API (SCRUM-50), EOD cross-ledger (SCRUM-53) | Dev | R01, L01 |
