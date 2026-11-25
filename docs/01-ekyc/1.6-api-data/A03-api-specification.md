# A03 · Đặc tả API & mã lỗi – Module 1 eKYC

| | |
|---|---|
| Phiên bản | 1.2 |
| Trạng thái | 📝 Bản nháp, chờ Tech Lead xác nhận |
| Người soạn | Han Dao (BA) |
| Ngày | 25/11/2026 |
| Jira | [SCRUM-69](https://baohandao2303.atlassian.net/browse/SCRUM-69), [SCRUM-85](https://baohandao2303.atlassian.net/browse/SCRUM-85) (SIT) |
| Nguồn | Code `server/src/http.ts`, `service.ts`, `config.ts` (ekyc-service), đối chiếu ngày 24/11/2026 |
| Chuẩn tham chiếu | Cấu trúc theo OpenAPI 3.1 (đường dẫn, tham số, thân, phản hồi); ngữ nghĩa mã HTTP theo RFC 9110 |
| Liên quan | [A01](../../00-overview/A01-solution-overview.md) (kiến trúc), [C03](../../00-overview/C03-requirements-addendum-v1.3.md) (FR), [D01](D01-data-dictionary.md) (dữ liệu), [C16](../1.4-testing/C16-sit-plan.md) (SIT) |

Tài liệu mô tả **hợp đồng giao tiếp** giữa app khách, Aegis Compliance và `ekyc-service`. Dev dùng để tích hợp, QA dùng để viết case SIT và API test (TC-API trong T02).

## 1. Quy ước chung

| Mục | Quy ước |
|---|---|
| Base URL | Dev: `http://localhost:8787`. Production: sau API Gateway, chưa chốt |
| Định dạng | JSON UTF-8, cả request lẫn response. Body tối đa 1 MB |
| Thời gian | Trường `*_at` là epoch mili-giây (UTC). Ngày sinh, ngày hết hạn là chuỗi `YYYY-MM-DD` |
| Phương thức | Chỉ `GET` (đọc) và `POST` (ghi). Không có `PUT`/`DELETE`: dữ liệu quyết định và audit không được sửa, xoá |
| Cache | Mọi response có `cache-control: no-store` (dữ liệu cá nhân) |
| Che dữ liệu | Họ tên, số định danh, số hộ chiếu mặc định đã che. Chỉ `GET /api/cases/:id?pii=1` trả bản đầy đủ và ghi audit `VIEW_PII` |
| Lý do với khách | API phía khách không bao giờ trả lý do nội bộ (PEP, AML, CIC). Chỉ trả `reason.code` an toàn ở §5.3 (BR-16) |

### 1.1 Xác thực

| Bên gọi | Header | Có được khi | Production |
|---|---|---|---|
| App khách | `x-session-token` | Nhận trong response `POST /api/sessions`. Chỉ thao tác được phiên của chính mình | Giữ nguyên, thêm ràng buộc thiết bị (device binding) |
| Nhân viên | `x-staff-id` | Mã nhân viên (bản dev) | Thay bằng SSO/OAuth2 ở API Gateway, Gateway chuyển danh tính xuống service |

### 1.2 Phân quyền theo vai trò nhân viên

| API | `OFFICER` | `LEAD` | `CS` |
|---|---|---|---|
| Xem hàng đợi, chi tiết hồ sơ (đã che) | ✅ | ✅ | ✅ (không thấy điểm rủi ro, sàng lọc) |
| Xem PII đầy đủ (`?pii=1`) | ✅ | ✅ | ❌ |
| Nhận / nhả / yêu cầu bổ sung / quyết định Maker | ✅ | ✅ | ❌ |
| Quyết định Checker | ✅ (khác Maker) | ✅ (khác Maker) | ❌ |
| Đề xuất đổi cấu hình | ✅ | ✅ | ❌ |
| Duyệt đổi cấu hình | ❌ | ✅ (khác người đề xuất) | ❌ |
| Báo cáo SLA, KPI | ✅ | ✅ | ❌ |

### 1.3 Cấu trúc lỗi

Mọi lỗi trả về cùng một dạng:

```json
{ "error": { "code": "INVALID_STATE", "message": "Không đọc chip được ở trạng thái CONSENTED" } }
```

Một số mã có thêm trường (`terms_version`, `missing`), ghi ở §4. `message` là tiếng Việt, hiển thị được cho nhân viên. App khách **hiển thị theo `code`**, không hiển thị `message` thô.

## 2. API phía khách hàng

### 2.1 Danh sách

| # | Phương thức | Đường dẫn | Trạng thái trước | Trạng thái sau | FR / RULE |
|---|---|---|---|---|---|
| API-01 | POST | `/api/sessions` | — | `CREATED` | FR-18, RULE-16 |
| API-02 | POST | `/api/sessions/:id/consent` | `CREATED` (hoặc phiên dở cần đồng ý lại) | `CONSENTED` | SCRUM-17, 46 |
| API-03 | POST | `/api/sessions/:id/document` | `CONSENTED`, `DOC_CAPTURED` | `DOC_CAPTURED` / `REJECTED` / `STOPPED_DUPLICATE` / `CANCELLED` | FR-09, FR-10, FR-19 |
| API-04 | POST | `/api/sessions/:id/capture-failures` | bất kỳ phiên đang chạy | giữ nguyên; lần thứ 3 → `REFER` | RULE-07 |
| API-05 | POST | `/api/sessions/:id/chip` | `DOC_CAPTURED` | `DOC_CAPTURED` (ghi nguồn so khớp) | FR-16, RULE-14 |
| API-06 | POST | `/api/sessions/:id/liveness` | `DOC_CAPTURED` đã qua bước chip | `STP_APPROVED` / `REFER` / `REJECTED` | A01 §4 |
| API-07 | GET | `/api/sessions/:id` | bất kỳ | — | — |
| API-08 | GET | `/api/sessions/resume?device_id=` | — | — | FR-11b |
| API-09 | POST | `/api/sessions/:id/resume` | `ABANDONED` hoặc đang chạy | bước đã lưu (liveness làm lại) | FR-11b, RULE-11 |
| API-10 | POST | `/api/sessions/:id/cancel` | chưa gửi xét duyệt | `CANCELLED` | FR-11c |
| API-11 | POST | `/api/sessions/:id/consents/withdraw` | bất kỳ | `CANCELLED` nếu chưa có TK | FR-17, RULE-15 |
| API-12 | GET | `/api/sessions/:id/notifications` | bất kỳ | — | FR-13 |
| API-13 | POST | `/api/sessions/:id/info-request/submit` | `PENDING_CUSTOMER_INFO` | `REFER_RESUBMITTED` | FR-12 |

### 2.2 Chi tiết

**API-01 · Tạo phiên** – kiểm tra velocity trước khi tạo.

| Trường request | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `device_id` | string | Có | Mã thiết bị ổn định |
| `device_model` | string | Không | Hiển thị cho Compliance |
| `device_rooted` | boolean | Không | `true` → cờ `DEVICE_RISK` |
| `phone` | string | Không | Dùng cho velocity theo số điện thoại và gửi thông báo |
| `product` | `payment` \| `credit` | Không | Mặc định `payment`. Quyết định tuổi tối thiểu |

Response `200`: `{ "session_id": "EKS-2611-0001", "token": "…", "terms_version": "2026.11" }`
Lỗi: `VALIDATION` (thiếu `device_id`), `TRY_LATER` (chạm velocity – khách không được biết quy tắc nào).

**API-02 · Đồng ý điều khoản**

| Trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `scopes` | string[] | Có | Phải có `identity` và `screening`; `marketing` tuỳ chọn |
| `terms_version` | string | Có | Phải bằng phiên bản hiện hành |

Response: `{ "status": "CONSENTED", "next": "DOC" }`. Lỗi: `TERMS_OUTDATED` (kèm `terms_version` mới), `CONSENT_REQUIRED`, `SESSION_CLOSED`.

**API-03 · Gửi dữ liệu giấy tờ (OCR)**

| Trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `doc_type` | `CCCD` \| `PASSPORT` | Không | Mặc định `CCCD` |
| `full_name` | string | Có | |
| `id_number` | string | CCCD: có. Hộ chiếu VN: có | 12 chữ số, bỏ khoảng trắng |
| `passport_no` | string | Hộ chiếu: có | 6–9 ký tự A–Z, 0–9 (ICAO 9303) |
| `nationality` | string | Hộ chiếu: có | Mã 3 chữ ISO 3166-1 alpha-3 |
| `dob`, `expiry` | `YYYY-MM-DD` | Có | |
| `sex`, `issued`, `origin` | string | Không | |

Thứ tự kiểm tra: định dạng → hạn giấy tờ và tuổi (RULE-10) → trùng khách (RULE-09) → velocity nhiều danh tính trên một thiết bị.

| Kết quả | `status` | `next` | Trường thêm |
|---|---|---|---|
| Hợp lệ | `DOC_CAPTURED` | `NFC` | `warnings` (vd. sắp hết hạn) |
| Hết hạn / chưa đủ tuổi | `REJECTED` | `EXPIRED_DOC` / `REJECTED` | `reason`, `expiry` |
| Đã có tài khoản | `STOPPED_DUPLICATE` | `DUPLICATE` | `reason` |
| Có phiên dở của cùng người | `CANCELLED` | `RESUME` | `resume_session_id`, `resume_token` (chỉ khi cùng thiết bị) |

Lỗi: `INVALID_STATE`, `VALIDATION`.

**API-04 · Báo đọc giấy tờ thất bại** – không có body. Response `{ capture_failures, remaining, next: "RETRY" }`. Lần thứ `max_capture_failures` (mặc định 3): `{ status: "REFER", next: "REFER" }`.

**API-05 · Kết quả đọc chip**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `skipped` | boolean | `true` khi khách bỏ qua NFC → cờ `NFC_SKIPPED`, so khớp bằng ảnh OCR |
| `dg1` | object | `full_name`, `id_number` / `passport_no`, `nationality`, `dob`, `expiry` |
| `sod_valid` | boolean | `false` → cờ `CHIP_AUTH_FAILED` |
| `chip_auth` | boolean | Kết quả Chip/Active Authentication (ghi lại, chưa dùng để quyết định) |

Response: `{ chip_verified, match_source: "CHIP_DG2" | "OCR_FRONT", mismatch: string[], next: "LIVENESS" }`. Lệch OCR–chip → cờ `DOC_DATA_MISMATCH`.

**API-06 · Kết quả liveness và face match**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `liveness` | number 0–1 | Bản hiện tại nhận điểm từ SDK trên máy; production phải tính ở server (xem §7) |
| `face_match` | number 0–1 | |

Server gọi CIC, AML rồi chạy cây quyết định (A01 §4). Response giống API-07. Lỗi: `INVALID_STATE`, `VALIDATION`.

**API-07 · Trạng thái phiên** – response:

```json
{ "session_id": "EKS-2611-0001", "status": "REFER", "outcome": "refer", "last_step": "LIVENESS_DONE",
  "account_no": null, "holder": null, "reason": null, "queued_at": 1764000000000, "decided_at": null,
  "info_request": null }
```

`outcome`: `approved` | `rejected` | `refer` | `null` (đang làm). `info_request` có `items`, `message`, `deadline_at` khi chờ bổ sung.

**API-08 · Tìm phiên dở** – response `{ session_id, token, status, last_step, resume_screen, reconsent_required, expires_at }` hoặc `{ session_id: null }`.

**API-09 · Tiếp tục phiên** – liveness luôn làm lại (RULE-11). Lỗi: `INVALID_STATE`, `TERMS_OUTDATED`.

**API-10 · Huỷ phiên** – xoá dữ liệu tạm ngay. Lỗi `INVALID_STATE` nếu hồ sơ đã gửi xét duyệt hoặc đã kết thúc.

**API-11 · Rút lại đồng ý** – body `{ "scope": "identity" | "screening" | "marketing" }`.

| Tình huống | `result` | Hệ quả |
|---|---|---|
| `marketing` | `WITHDRAWN` | Ngừng gửi ưu đãi |
| Đã có tài khoản | `RETAINED` | Giữ dữ liệu theo nghĩa vụ PCRT, ngừng xử lý ngoài mục đích bắt buộc |
| Chưa có tài khoản | `CANCELLED` | Huỷ hồ sơ, xoá trong `retention_withdrawn_hours` (24 giờ), trả `delete_by` |

**API-13 · Gửi bổ sung** – body `{ "items": ["FRONT_BLURRY", …] }`, phải đủ mọi hạng mục đã yêu cầu. Lỗi `MISSING_ITEMS` kèm `missing`.

## 3. API phía Compliance

| # | Phương thức | Đường dẫn | Vai trò | Điều kiện | FR / RULE |
|---|---|---|---|---|---|
| API-20 | GET | `/api/me` | mọi vai trò | — | — |
| API-21 | GET | `/api/cases?view=queue\|checker\|mine\|done` | mọi vai trò | — | FR-14b, RULE-12 |
| API-22 | GET | `/api/cases/:id[?pii=1]` | mọi vai trò; `pii=1` trừ CS | Hồ sơ từng vào hàng đợi | FR-15 |
| API-23 | POST | `/api/cases/:id/claim` | OFFICER, LEAD | `REFER` / `REFER_RESUBMITTED`, chưa ai giữ | FR-14c |
| API-24 | POST | `/api/cases/:id/release` | người giữ hoặc LEAD | — | FR-14c |
| API-25 | POST | `/api/cases/:id/info-requests` | người giữ | Chưa quá `max_info_requests` | FR-12 |
| API-26 | POST | `/api/cases/:id/decision` | người giữ (Maker) | `REFER` / `REFER_RESUBMITTED` | FR-15, RULE-13 |
| API-27 | POST | `/api/cases/:id/checker` | OFFICER, LEAD, khác Maker | `PENDING_CHECKER` | FR-15, RULE-13 |
| API-28 | POST | `/api/cases/:id/cic-retry` | OFFICER, LEAD | Lần đầu CIC quá thời gian | — |
| API-29 | GET | `/api/config` | mọi vai trò | — | NFR-SEC-05 |
| API-30 | POST | `/api/config/changes` | OFFICER, LEAD | Giá trị trong giới hạn | NFR-SEC-05 |
| API-31 | POST | `/api/config/changes/:cid/approve` · `/reject` | LEAD, khác người đề xuất | Đề xuất đang `PENDING` | NFR-SEC-05 |
| API-32 | GET | `/api/reports/sla?days=7` | OFFICER, LEAD | — | C09 |
| API-33 | GET | `/api/reports/kpi?days=30` | OFFICER, LEAD | — | C18 |

**Thân request chính**

| API | Trường | Ràng buộc |
|---|---|---|
| API-25 | `items`: mảng trong `FRONT_BLURRY`, `BACK_BLURRY_MRZ`, `BACK_MISSING`, `OCR_CHIP_MISMATCH`, `OTHER`; `message` | Ít nhất 1 hạng mục. `OTHER` bắt buộc `message`. `message` không được chứa PEP, AML, CIC, sanction, "danh sách cấm", "chính trị" |
| API-26 | `decision`: `APPROVE` \| `REJECT`; `reason`; `note` | `REJECT` bắt buộc `reason`. `APPROVE` rơi vào điều kiện Checker → `PENDING_CHECKER` |
| API-27 | `decision`: `APPROVE` \| `RETURN`; `reason` | `RETURN` bắt buộc `reason`, trả hồ sơ về Maker |
| API-30 | `key`, `value`, `reason` | `key` phải có trong D01 §4; số phải trong giới hạn; `reason` ≥ 10 ký tự; khác giá trị hiện tại |

**Thứ tự hàng đợi (API-21):** hồ sơ khách đã bổ sung → sắp quá hoặc đã quá SLA → chờ lâu nhất. Response có `stats: { open, due_soon, breached, checker }`.

## 4. Danh mục mã lỗi

| HTTP | `code` | Ý nghĩa | Phát sinh ở | App / màn hình xử lý |
|---|---|---|---|---|
| 400 | `BAD_JSON` | Body không phải JSON hợp lệ | Mọi POST | Lỗi kỹ thuật, ghi log, báo "Có lỗi, thử lại" |
| 400 | `UNSUPPORTED` | Thao tác không hỗ trợ ở môi trường này | `/api/dev/reset` | Chỉ dev |
| 401 | `UNAUTHENTICATED` | Thiếu hoặc sai danh tính nhân viên | API Compliance | Chuyển về đăng nhập |
| 403 | `FORBIDDEN` | Sai token phiên, hoặc vai trò không đủ quyền | Mọi API | Khách: quay về màn đầu. Nhân viên: ẩn nút, báo không đủ quyền |
| 403 | `NOT_ASSIGNEE` | Thao tác hồ sơ khi chưa nhận xử lý | API-25, 26 | Gợi ý bấm "Nhận xử lý" |
| 403 | `MAKER_CHECKER_SAME` | Checker trùng Maker, hoặc tự duyệt đề xuất cấu hình | API-27, 31 | Báo "Cần người khác phê duyệt"; ghi audit `CHECKER_BLOCKED_SAME_PERSON` |
| 404 | `NOT_FOUND` | Không có API, hồ sơ, hoặc đề xuất cấu hình | Mọi API | Báo không tìm thấy |
| 409 | `INVALID_STATE` | Thao tác không hợp lệ ở trạng thái hiện tại | API-03 → 06, 09, 10, 13, 23, 25 → 27 | Tải lại trạng thái (API-07 / API-22) rồi điều hướng đúng màn |
| 409 | `TERMS_OUTDATED` | Điều khoản đã đổi; kèm `terms_version` | API-02, 09 | Hiện lại màn Điều khoản (eKYC-01) |
| 409 | `SESSION_CLOSED` | Phiên đã kết thúc | API-02 | Màn kết quả |
| 409 | `ALREADY_CLAIMED` | Hồ sơ đang do người khác giữ | API-23 | Báo tên người giữ, làm mới hàng đợi |
| 409 | `LIMIT_REACHED` | Đã yêu cầu bổ sung tối đa | API-25 | Khoá nút "Yêu cầu bổ sung" |
| 413 | `TOO_LARGE` | Body > 1 MB | Mọi POST | Lỗi kỹ thuật (ảnh không gửi qua JSON) |
| 422 | `VALIDATION` | Thiếu trường hoặc sai định dạng | Nhiều API | Hiện lỗi cạnh trường (WCAG 3.3.1) |
| 422 | `CONSENT_REQUIRED` | Chưa chọn đủ 2 mục bắt buộc | API-02 | Đánh dấu ô bắt buộc |
| 422 | `MISSING_ITEMS` | Thiếu hạng mục bổ sung; kèm `missing` | API-13 | Đánh dấu hạng mục còn thiếu |
| 422 | `FORBIDDEN_CONTENT` | Lời nhắn có từ bị cấm | API-25 | Báo ngay trong ô lời nhắn |
| 422 | `OUT_OF_RANGE` | Giá trị cấu hình ngoài giới hạn (vd. `min_age_payment` 16–25) | API-30 | Hiện giới hạn hợp lệ |
| 429 | `TRY_LATER` | Chạm velocity | API-01 | Thông điệp chung "Vui lòng thử lại sau", không nói lý do (C13) |
| 500 | `INTERNAL` | Lỗi không lường trước | Mọi API | Báo lỗi chung, ghi log có mã truy vết |
| 503 | `CIC_UNAVAILABLE` | CIC vẫn chưa phản hồi khi thử lại | API-28 | Giữ hồ sơ ở `CIC_TIMEOUT`, cho thử lại sau |

> Lỗi của hệ thống ngoài (CIC, AML, Core Banking) **không** trả thẳng cho khách. CIC quá thời gian → hồ sơ REFER với lý do `CIC_TIMEOUT`; tra trùng ở Core Banking lỗi → cờ `DEDUP_UNAVAILABLE` (REFER).

## 5. Bảng mã nghiệp vụ dùng trong response

### 5.1 Trạng thái phiên (`status`)

`CREATED` → `CONSENTED` → `DOC_CAPTURED` → `LIVENESS_DONE` → `SCREENING` → `STP_APPROVED` / `REFER` / `REJECTED`.
Hàng đợi: `REFER`, `REFER_RESUBMITTED`, `PENDING_CHECKER`, `PENDING_CUSTOMER_INFO`. Kết thúc: `STP_APPROVED`, `APPROVED`, `REJECTED`, `STOPPED_DUPLICATE`, `EXPIRED`, `CANCELLED`. Khác: `ABANDONED`. Sơ đồ đầy đủ: C03 §1.

### 5.2 Cờ và lý do REFER (`reasons`)

| Mã | Nguồn |
|---|---|
| `DOC_DATA_MISMATCH`, `CHIP_AUTH_FAILED`, `NFC_SKIPPED` | Bước chip (C11) |
| `PRIOR_REJECTION`, `IDENTITY_MISMATCH`, `DEDUP_UNAVAILABLE` | Tra trùng (C04) |
| `DEVICE_MULTI_IDENTITY`, `DEVICE_RISK` | Thiết bị (C13) |
| `OCR_UNREADABLE` | Đọc giấy tờ lỗi 3 lần |
| `FOREIGN_NATIONAL` | Hộ chiếu nước ngoài (RULE-17) |
| `LIVENESS_BORDERLINE`, `PEP_MATCH`, `SANCTION_MATCH`, `CIC_TIMEOUT`, `RISK_MEDIUM` | Cây quyết định (A01 §4) |

### 5.3 Lý do gửi khách (`reason.code`)

| `code` | Khi nào | Thông điệp |
|---|---|---|
| `DOC_EXPIRED` | Giấy tờ hết hạn | Giấy tờ đã hết hạn. Vui lòng cập nhật giấy tờ mới. |
| `UNDER_AGE` | Chưa đủ tuổi | Chưa đủ điều kiện độ tuổi cho sản phẩm này. |
| `STOPPED_DUPLICATE` | Đã có tài khoản | Giấy tờ này đã được dùng để mở tài khoản. Vui lòng đăng nhập. |
| `NO_RESPONSE` | Quá hạn bổ sung | Hồ sơ đã bị huỷ do quá hạn bổ sung. |
| `GENERAL` | Mọi lý do còn lại, gồm `RISK_HIGH`, `SANCTION_MATCH`, `LIVENESS_FAILED`, `FACE_MISMATCH`, `MANUAL_REJECT` | Hiện chưa thể mở tài khoản trực tuyến… liên hệ quầy hoặc 1900 6868. |

> ✅ 24/11: thông điệp `STOPPED_DUPLICATE` trước đây nói "Số CCCD" cả khi khách dùng hộ chiếu, đã đổi thành "Giấy tờ này". Màn eKYC-12 trên app hiện "Hộ chiếu" hoặc "CCCD" theo loại giấy tờ.

## 6. Sự kiện phát ra (cho Notification, Đối soát, Hạn mức)

| Sự kiện | Khi nào | Payload chính |
|---|---|---|
| `ekyc.session.created` | Tạo phiên | — |
| `ekyc.session.abandoned` / `expired` / `stopped_duplicate` | Job T1/T2, trùng khách | — |
| `ekyc.decision.referred` | Vào hàng đợi | `reasons` |
| `ekyc.decision.completed` | Có quyết định cuối | `decision`, `account_no`, `product` |
| `ekyc.info.requested` / `resubmitted` | Yêu cầu và gửi bổ sung | `items` |
| `ekyc.consent.withdrawn` | Rút lại đồng ý | — |
| `ekyc.fraud.velocity_hit` | Chạm velocity | `rule`, `device_id` |
| `ops.notification.dead_letter` | Gửi thông báo thất bại 3 lần | `template` |

Tài khoản Core Banking được tạo **trước** khi phát `ekyc.decision.completed`, khoá idempotency là `session_id` (SIT-10).

Thông báo `EKYC_APPROVED` gửi thành 2 bản: Push **không** có số tài khoản (đi qua APNs/FCM ở nước ngoài, P01 §4.1), SMS có số tài khoản (chờ Pháp chế xác nhận).

## 7. Chưa có, cần trước production

| # | Việc | Lý do |
|---|---|---|
| 1 | Xuất file OpenAPI 3.1 (`openapi.yaml`) từ bảng này | Dev sinh client và mock tự động |
| 2 | Lỗi theo RFC 9457 (`application/problem+json`) hoặc giữ dạng hiện tại – Tech Lead chốt | Chuẩn hoá giữa các service |
| 3 | Đánh phiên bản API (`/api/v1/…`) | Đổi hợp đồng không làm vỡ app cũ |
| 4 | Header `Idempotency-Key` cho API-06, 26, 27 | Chống bấm hai lần khi mạng chập chờn |
| 5 | Mã truy vết (`x-request-id`) trong mọi response lỗi | Dò log khi khách gọi tổng đài |
| 6 | Tính liveness, face match ở server thay vì nhận điểm từ máy | Điểm gửi từ máy có thể bị giả mạo |
| 7 | Giới hạn tần suất (rate limit) ở Gateway ngoài velocity nghiệp vụ | Chống dò API |
| 8 | Bỏ `/api/dev/*` khỏi bản build production | Chỉ dùng cho test |

## 8. Nhật ký thay đổi

| Phiên bản | Ngày | Người | Nội dung |
|---|---|---|---|
| 1.0 | 24/11/2026 | Han Dao | Bản đầu, lập từ code ekyc-service |
| 1.1 | 24/11/2026 | Han Dao | Sửa thông điệp `STOPPED_DUPLICATE` cho hộ chiếu; tách Push / SMS của `EKYC_APPROVED` |
| 1.2 | 25/11/2026 | Han Dao | Ghi giới hạn `min_age_payment` 16–25 ở mã lỗi `OUT_OF_RANGE`; thêm mục phê duyệt |

## 9. Phê duyệt

| Vai trò | Người | Ngày | Kết luận |
|---|---|---|---|
| BA (soạn) | Han Dao | 25/11/2026 | Trình duyệt |
| Tech Lead | | | |
| QA Lead | | | |
