# C07–C09 · Xử lý hồ sơ REFER: bổ sung giấy tờ, thông báo, SLA

| | |
|---|---|
| Jira | [SCRUM-76](https://baohandao2303.atlassian.net/browse/SCRUM-76) (C07) · [SCRUM-77](https://baohandao2303.atlassian.net/browse/SCRUM-77) (C08) · [SCRUM-78](https://baohandao2303.atlassian.net/browse/SCRUM-78) (C09) |
| BR / FR / RULE | BR-15/16/17 · FR-12/13/14 · RULE-12 |
| UI | App: `Refer`, `RequestInfo` · Compliance: hàng đợi, badge SLA, modal "Yêu cầu bổ sung", chuông thông báo |

Ba ticket gộp một tài liệu vì chúng là **một quy trình liền mạch**: hồ sơ vào hàng đợi → nhân viên xử lý trong SLA → có thể yêu cầu khách bổ sung → khách được thông báo ở mỗi bước.

## 1. Quy trình (swimlane)

```mermaid
flowchart LR
    subgraph SYS["Hệ thống"]
        A["Risk engine chuyển REFER"] --> B["Vào hàng đợi<br/>bắt đầu đếm SLA 24h"]
        N1["Gửi thông báo:<br/>Đang xem xét"]
        J["Job 5 ngày:<br/>quá hạn → REJECTED"]
    end
    subgraph CO["Compliance"]
        C["Nhận xử lý"] --> D{"Đủ thông tin?"}
        D -- "Có" --> E["Phê duyệt / Từ chối<br/>(C10)"]
        D -- "Thiếu" --> F["Yêu cầu bổ sung<br/>chọn hạng mục + lời nhắn"]
    end
    subgraph KH["Khách hàng"]
        G["Nhận SMS + Push<br/>mở deep link"] --> H["Chụp lại đúng hạng mục"]
        K["Nhận kết quả"]
    end
    A --> N1
    B --> C
    F -- "SLA tạm dừng" --> G
    H -- "REFER_RESUBMITTED<br/>ưu tiên đầu hàng đợi" --> C
    F -. "không phản hồi" .-> J
    E --> K
    J --> K
```

## 2. C07 · Yêu cầu bổ sung giấy tờ

### Quy tắc

| # | Quy tắc |
|---|---|
| 1 | Phải chọn ít nhất 1 hạng mục chuẩn: ảnh mặt trước mờ · ảnh mặt sau mờ/MRZ · thiếu mặt sau · OCR khác chip · khác |
| 2 | Tối đa **2 lần** yêu cầu cho một hồ sơ; lần thứ 3 nút bị khoá |
| 3 | Hạn bổ sung **5 ngày** (cấu hình được); quá hạn → REJECTED lý do `NO_RESPONSE` |
| 4 | Trong thời gian chờ khách, **SLA của Compliance tạm dừng** |
| 5 | Lời nhắn **không được** nhắc PEP, AML, CIC |
| 6 | Hồ sơ khách gửi lại đứng **đầu hàng đợi** |

### Trình tự

```mermaid
sequenceDiagram
    autonumber
    actor CO as Compliance
    participant W as Web Compliance
    participant EK as ekyc-service
    participant NS as Notification Service
    actor K as Khách hàng
    participant App
    CO->>W: Yêu cầu bổ sung (hạng mục, lời nhắn)
    W->>EK: POST /cases/{id}/info-requests
    EK->>EK: Kiểm tra request_count < 2
    EK->>EK: status = PENDING_CUSTOMER_INFO, sla_paused_at = now
    EK-->>NS: Sự kiện ekyc.info.requested
    NS->>K: SMS + Push kèm deep link
    K->>App: Mở deep link
    App->>EK: GET /info-requests/{rid}
    App->>K: Màn "Cần bổ sung 1 mục"
    K->>App: Chụp lại mặt sau
    App->>EK: POST /info-requests/{rid}/documents
    EK->>EK: status = REFER_RESUBMITTED, tiếp tục đếm SLA
    EK-->>W: Hồ sơ lên đầu hàng đợi, nhãn "Đã bổ sung"
```

## 3. C08 · Ma trận thông báo

| Sự kiện | Kênh | Mẫu | Nội dung tóm tắt |
|---|---|---|---|
| STP_APPROVED | Push + SMS | `EKYC_APPROVED` | Mở tài khoản thành công |
| Chuyển REFER | Push | `EKYC_UNDER_REVIEW` | Đang xem xét, kết quả trong 24 giờ |
| Compliance APPROVE (hoặc Checker) | Push + SMS | `EKYC_APPROVED` | Mở tài khoản thành công |
| Compliance REJECT | Push + SMS | `EKYC_REJECTED` | Chưa thể mở tài khoản + kênh hỗ trợ |
| Yêu cầu bổ sung | Push + SMS | `EKYC_INFO_REQUESTED` | Cần bổ sung [hạng mục] trước [hạn] + deep link |
| Còn 1 ngày hạn bổ sung | Push | `EKYC_INFO_REMINDER` | Nhắc nhở |
| Quá hạn bổ sung | Push + SMS | `EKYC_EXPIRED` | Hồ sơ đã bị huỷ |

**Quy tắc gửi:** qua Pub/Sub → Notification Service · retry 3 lần (backoff 1s/5s/30s) · thất bại → dead-letter + cảnh báo vận hành · **không rollback** quyết định KYC khi gửi lỗi · log: `session_id`, `template_id`, kênh, thời gian, trạng thái.

## 4. C09 · SLA hàng đợi

### Trạng thái SLA của một hồ sơ

```mermaid
stateDiagram-v2
    direction LR
    [*] --> TRONG_HAN: Vào hàng đợi
    TRONG_HAN --> SAP_QUA_HAN: Đạt 16 giờ
    SAP_QUA_HAN --> QUA_HAN: Đạt 24 giờ
    TRONG_HAN --> TAM_DUNG: Yêu cầu bổ sung
    SAP_QUA_HAN --> TAM_DUNG: Yêu cầu bổ sung
    TAM_DUNG --> TRONG_HAN: Khách gửi lại (tính tiếp thời gian còn lại)
    TRONG_HAN --> DA_XU_LY: Có quyết định
    SAP_QUA_HAN --> DA_XU_LY
    QUA_HAN --> DA_XU_LY: Ghi nhận Breach
    DA_XU_LY --> [*]
```

### RULE-EKYC-12

| Hạng mục | Quy tắc |
|---|---|
| SLA | 24 giờ tính từ lúc vào hàng đợi, **trừ** thời gian tạm dừng |
| Hiển thị | Trong hạn < 16h · Sắp quá hạn 16–24h · Quá SLA > 24h (chữ + icon + màu, không chỉ màu) |
| Nhận xử lý | Một hồ sơ chỉ một người giữ; người khác chỉ xem; tự nhả sau 2 giờ không thao tác |
| Leo thang | 20h → thông báo trưởng nhóm · 24h → đánh dấu Breach trong báo cáo |
| Thứ tự hàng đợi | Đã bổ sung → Sắp quá SLA → Cũ nhất |
| Báo cáo | Số hồ sơ xử lý, % đúng SLA, trung vị thời gian xử lý, số Breach (màn Báo cáo SLA, C18) |

**Câu hỏi mở cho PO:** SLA tính theo giờ lịch (24/7) hay giờ làm việc? Bản mẫu đang tính theo giờ lịch.
