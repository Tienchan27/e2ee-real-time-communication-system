# 10 - Lộ Trình 8 Tuần (Chi Tiết Theo Task)

## Mục tiêu

Tài liệu này là backlog thực thi chi tiết để theo dõi tiến độ theo tuần, theo người và theo task.

---

## Quy ước chung để theo dõi

### Ánh xạ Owner theo thành viên

| Owner | Người phụ trách |
|---|---|
| System Owner | Đình Tiến |
| FE Owner | Bật Tiến |
| API Owner | Minh Tiến |
| Realtime Owner | Lương Thứ |

---

### Mã task

- Định dạng: `W<tuan>-<domain>-<so>`
- Domain:
  - `SYS`: điều phối, kiến trúc, devops (System Owner)
  - `API`: backend API + DB
  - `RT`: realtime/signaling
  - `FE`: frontend/client
  - `QA`: kiểm thử tích hợp

### Trạng thái

- `Todo`
- `In Progress`
- `Blocked`
- `In Review`
- `Done`

---

## Mẫu bảng cập nhật tiến độ mỗi tuần

| Task ID | Mô tả | Owner | Ước lượng | Phụ thuộc | Deadline | Trạng thái | PR/Bằng chứng |
|---|---|---|---|---|---|---|---|
| W3-API-01 | Endpoint request OTP | API Owner | 0.5 ngày | W2-API-02 | Thứ 3 | Todo |  |
| W3-FE-02 | Màn OTP + countdown | FE Owner | 0.5 ngày | W3-API-01 | Thứ 4 | Todo |  |

---

## Tuần 1 - Nền tảng và khung tài liệu

### Mục tiêu tuần

- Có skeleton kỹ thuật 3 service.
- Có bộ docs nền tảng để khóa contract tuần 2.

### Backlog tuần 1

| Task ID | Mô tả chi tiết | Owner | Ước lượng | Phụ thuộc | Deadline | Output bắt buộc |
|---|---|---|---|---|---|---|
| W1-SYS-01 | Chốt glossary thuật ngữ (conversation, receipt, keyVersion, callType, requestId) | System Owner | 0.5 ngày | Không | Thứ 2 | Mục glossary trong docs |
| W1-SYS-02 | Chốt chuẩn tên file tài liệu và thứ tự đọc | System Owner | 0.5 ngày | W1-SYS-01 | Thứ 2 | Danh mục docs |
| W1-API-01 | Tạo skeleton API service + cấu trúc module auth/users/conversations/messages | API Owner | 1 ngày | Không | Thứ 3 | Cấu trúc thư mục + chạy được local |
| W1-API-02 | Tạo migration baseline cho PostgreSQL (users, conversations, conversation_members, messages, receipts) | API Owner | 1 ngày | W1-API-01 | Thứ 4 | Migration đầu tiên |
| W1-RT-01 | Tạo skeleton realtime service (socket init, namespace, middleware auth) | Realtime Owner | 1 ngày | Không | Thứ 3 | Realtime chạy local |
| W1-RT-02 | Tạo base event map (chat/call/key/presence/system) | Realtime Owner | 0.5 ngày | W1-RT-01 | Thứ 4 | Danh sách event |
| W1-FE-01 | Tạo skeleton FE app + route auth/chat | FE Owner | 1 ngày | Không | Thứ 3 | FE chạy local |
| W1-FE-02 | Tạo store cơ bản auth/socket/chat (typed) | FE Owner | 0.5 ngày | W1-FE-01 | Thứ 4 | Store file + types |
| W1-SYS-03 | Review chéo skeleton và chốt blocker tuần 1 | System Owner | 0.5 ngày | Toàn bộ task tuần 1 | Thứ 6 | Biên bản review |

### Điều kiện hoàn thành tuần 1

- Tất cả service chạy local.
- Docs `01`, `02`, `03`, `04`, `06`, `09` có draft.

---

## Tuần 2 - Đóng băng contract V1

### Mục tiêu tuần

- Khóa API contract và event contract.
- Không cho phép thay đổi breaking sau khi freeze.

### Backlog tuần 2

| Task ID | Mô tả chi tiết | Owner | Ước lượng | Phụ thuộc | Deadline | Output bắt buộc |
|---|---|---|---|---|---|---|
| W2-SYS-01 | Tổ chức buổi contract freeze (API + Events) | System Owner | 0.5 ngày | W1-SYS-03 | Thứ 2 | Biên bản freeze |
| W2-API-01 | Hoàn tất schema request/response auth + OTP | API Owner | 0.5 ngày | W1-API-02 | Thứ 2 | Mục auth trong `02-api.md` |
| W2-API-02 | Hoàn tất schema users search + conversations + messages | API Owner | 1 ngày | W2-API-01 | Thứ 3 | Mục endpoint đầy đủ |
| W2-RT-01 | Hoàn tất payload `chat:*`, `presence:*`, `system:*` | Realtime Owner | 1 ngày | W1-RT-02 | Thứ 3 | Mục events tương ứng |
| W2-RT-02 | Hoàn tất payload `key:*`, `call:*` + error codes | Realtime Owner | 1 ngày | W2-RT-01 | Thứ 4 | `03-events.md` hoàn chỉnh |
| W2-FE-01 | Sinh type model từ contract API | FE Owner | 0.5 ngày | W2-API-02 | Thứ 4 | File types FE |
| W2-FE-02 | Sinh type model từ contract events | FE Owner | 0.5 ngày | W2-RT-02 | Thứ 4 | File types FE |
| W2-SYS-02 | Chốt version contract `v1` và cấm breaking change | System Owner | 0.5 ngày | W2-API-02, W2-RT-02 | Thứ 5 | Decision log |
| W2-QA-01 | Review đầy đủ mismatch contract giữa 3 bên | System Owner + 3 Owner | 0.5 ngày | Toàn bộ task tuần 2 | Thứ 6 | Checklist contract pass |

### Điều kiện hoàn thành tuần 2

- `02-api.md` và `03-events.md` ở trạng thái ổn định.
- Tất cả owner ký xác nhận freeze.

---

## Tuần 3 - Auth, OTP, tìm người dùng, tạo conversation

### Mục tiêu tuần

- Hoàn thành onboarding user: đăng ký, OTP, đăng nhập, tìm user và bắt đầu chat.

### Backlog tuần 3

| Task ID | Mô tả chi tiết | Owner | Ước lượng | Phụ thuộc | Deadline | Output bắt buộc |
|---|---|---|---|---|---|---|
| W3-API-01 | Implement `POST /auth/register/request-otp` | API Owner | 0.5 ngày | W2-API-01 | Thứ 2 | Endpoint + test |
| W3-API-02 | Implement `POST /auth/register/verify-otp` | API Owner | 0.5 ngày | W3-API-01 | Thứ 2 | Endpoint + test |
| W3-API-03 | Implement `POST /auth/login` + `POST /auth/refresh` | API Owner | 1 ngày | W3-API-02 | Thứ 3 | Endpoint + test |
| W3-API-04 | Implement `GET /users/search` (username/email) + rate limit | API Owner | 1 ngày | W3-API-03 | Thứ 4 | Endpoint + test |
| W3-API-05 | Implement `POST /conversations/direct` | API Owner | 0.5 ngày | W3-API-04 | Thứ 4 | Endpoint + test |
| W3-FE-01 | Màn đăng ký + request OTP | FE Owner | 0.5 ngày | W3-API-01 | Thứ 2 | UI + gọi API |
| W3-FE-02 | Màn verify OTP + resend cooldown | FE Owner | 0.5 ngày | W3-API-02 | Thứ 3 | UI + state handling |
| W3-FE-03 | Màn login + refresh token flow cơ bản | FE Owner | 1 ngày | W3-API-03 | Thứ 3 | UI + store cập nhật |
| W3-FE-04 | UI tìm user theo `@username` và email | FE Owner | 0.5 ngày | W3-API-04 | Thứ 4 | UI + gọi API |
| W3-FE-05 | UI tạo conversation direct | FE Owner | 0.5 ngày | W3-API-05 | Thứ 4 | UI + chuyển chat |
| W3-RT-01 | Socket auth middleware theo access token | Realtime Owner | 0.5 ngày | W3-API-03 | Thứ 3 | Middleware chạy |
| W3-RT-02 | Implement `presence:subscribe` và `presence:update` | Realtime Owner | 1 ngày | W3-RT-01 | Thứ 4 | Event chạy test |
| W3-SYS-01 | Review security: OTP attempts, cooldown, token TTL | System Owner | 0.5 ngày | W3-API-03 | Thứ 5 | Security checklist |
| W3-QA-01 | E2E: register -> verify -> login -> search -> create conversation | System Owner + FE/API | 0.5 ngày | Toàn bộ tuần 3 | Thứ 6 | Biên bản test |

### Điều kiện hoàn thành tuần 3

- Luồng onboarding hoạt động đầy đủ trên staging.

---

## Tuần 4 - Chat E2EE cơ bản

### Mục tiêu tuần

- Gửi/nhận tin mã hóa, lưu ciphertext vào DB, có ack/error và retry.

### Backlog tuần 4

| Task ID | Mô tả chi tiết | Owner | Ước lượng | Phụ thuộc | Deadline | Output bắt buộc |
|---|---|---|---|---|---|---|
| W4-API-01 | Implement `POST /internal/messages/persist` + dedupe | API Owner | 1 ngày | W2-API-02 | Thứ 2 | Endpoint + test |
| W4-API-02 | Implement `GET /conversations/{id}/messages` (pagination) | API Owner | 0.5 ngày | W4-API-01 | Thứ 3 | Endpoint + test |
| W4-API-03 | Implement receipt endpoint delivered/read | API Owner | 0.5 ngày | W4-API-01 | Thứ 3 | Endpoint + test |
| W4-RT-01 | Implement `chat:send` -> gọi API internal persist | Realtime Owner | 1 ngày | W4-API-01 | Thứ 3 | Event chạy ổn định |
| W4-RT-02 | Implement `system:ack` / `system:error` chuẩn | Realtime Owner | 0.5 ngày | W4-RT-01 | Thứ 3 | Event phản hồi chuẩn |
| W4-RT-03 | Implement `chat:message` fanout + dedupe map | Realtime Owner | 0.5 ngày | W4-RT-01 | Thứ 4 | Event fanout |
| W4-FE-01 | Implement mã hóa AES-GCM envelope trước khi gửi | FE Owner | 1 ngày | W2-FE-02 | Thứ 3 | Luồng gửi mã hóa |
| W4-FE-02 | Implement giải mã khi nhận `chat:message` | FE Owner | 1 ngày | W4-FE-01 | Thứ 4 | Luồng nhận giải mã |
| W4-FE-03 | Implement queue retry theo `requestId` | FE Owner | 0.5 ngày | W4-RT-02 | Thứ 4 | Retry hoạt động |
| W4-FE-04 | Hiển thị trạng thái sent/delivered/read | FE Owner | 0.5 ngày | W4-API-03 | Thứ 5 | UI trạng thái |
| W4-SYS-01 | So khớp code với `04-flow.md` và `03-events.md` | System Owner | 0.5 ngày | Toàn bộ task tuần 4 | Thứ 5 | Báo cáo mismatch |
| W4-QA-01 | Test duplicate send, reconnect send, persist fail | System Owner + FE/RT/API | 0.5 ngày | Toàn bộ tuần 4 | Thứ 6 | Báo cáo test |

### Điều kiện hoàn thành tuần 4

- Chat E2EE gửi/nhận ổn định, ciphertext được lưu và truy vấn được.

---

## Tuần 5 - Vòng đời khóa và khôi phục

### Mục tiêu tuần

- Có key exchange, key rotation hybrid, rekey recovery khi lệch keyVersion.

### Backlog tuần 5

| Task ID | Mô tả chi tiết | Owner | Ước lượng | Phụ thuộc | Deadline | Output bắt buộc |
|---|---|---|---|---|---|---|
| W5-SYS-01 | Chốt ngưỡng xoay khóa (`N`, `T`) và grace window | System Owner | 0.5 ngày | W4-SYS-01 | Thứ 2 | Decision log |
| W5-RT-01 | Implement `key:exchange:init` và `key:exchange:response` | Realtime Owner | 1 ngày | W2-RT-02 | Thứ 3 | Event chạy test |
| W5-RT-02 | Implement `key:rotate` và `key:rekey_required` | Realtime Owner | 1 ngày | W5-RT-01 | Thứ 4 | Event chạy test |
| W5-FE-01 | Implement state machine key session theo conversation | FE Owner | 1 ngày | W5-RT-01 | Thứ 3 | State hoạt động |
| W5-FE-02 | Trigger rotate theo count/time | FE Owner | 0.5 ngày | W5-FE-01, W5-SYS-01 | Thứ 4 | Rotate thành công |
| W5-FE-03 | Xử lý rekey khi mismatch keyVersion | FE Owner | 0.5 ngày | W5-RT-02 | Thứ 4 | Recovery thành công |
| W5-API-01 | Hỗ trợ query theo `keyVersion` và metadata cần thiết | API Owner | 0.5 ngày | W4-API-02 | Thứ 4 | Endpoint/query |
| W5-SYS-02 | Duyệt acceptance criteria cho key recovery | System Owner | 0.5 ngày | W5-FE-03, W5-RT-02 | Thứ 5 | Checklist pass |
| W5-QA-01 | Test rotate do count/time + test rekey recovery | System Owner + FE/RT | 0.5 ngày | Toàn bộ tuần 5 | Thứ 6 | Biên bản test |

### Điều kiện hoàn thành tuần 5

- Rotation và rekey chạy được trên staging với test case rõ ràng.

---

## Tuần 6 - Cuộc gọi thoại và video

### Mục tiêu tuần

- Hoàn thiện signaling call 1-1 cho cả voice và video, có timeout và fallback.

### Backlog tuần 6

| Task ID | Mô tả chi tiết | Owner | Ước lượng | Phụ thuộc | Deadline | Output bắt buộc |
|---|---|---|---|---|---|---|
| W6-RT-01 | Implement `call:start`, `call:incoming`, `call:accept`, `call:reject` | Realtime Owner | 1 ngày | W2-RT-02 | Thứ 2 | Signaling cơ bản |
| W6-RT-02 | Implement `call:offer`, `call:answer`, `call:ice` | Realtime Owner | 1 ngày | W6-RT-01 | Thứ 3 | Signaling SDP/ICE |
| W6-RT-03 | Implement `call:end`, timeout và cleanup state | Realtime Owner | 0.5 ngày | W6-RT-02 | Thứ 4 | Cleanup ổn định |
| W6-FE-01 | UI incoming call + accept/reject | FE Owner | 0.5 ngày | W6-RT-01 | Thứ 3 | UI hoạt động |
| W6-FE-02 | Voice call screen + mute/unmute | FE Owner | 1 ngày | W6-RT-02 | Thứ 4 | Voice call demo |
| W6-FE-03 | Video call screen + camera on/off | FE Owner | 1 ngày | W6-RT-02 | Thứ 5 | Video call demo |
| W6-SYS-01 | Cấu hình TURN và tiêu chí fallback P2P -> relay | System Owner | 0.5 ngày | W6-RT-02 | Thứ 4 | Cấu hình + guideline |
| W6-API-01 | Endpoint metadata cuộc gọi (tùy chọn cho chẩn đoán) | API Owner | 0.5 ngày | W6-RT-03 | Thứ 5 | Endpoint hoặc bỏ có lý do |
| W6-QA-01 | Test accept/reject/timeout/reconnect trong call | System Owner + FE/RT | 0.5 ngày | Toàn bộ tuần 6 | Thứ 6 | Báo cáo test |

### Điều kiện hoàn thành tuần 6

- Voice/video call signaling chạy ổn định ở staging.

---

## Tuần 7 - CI/CD, deploy và hardening

### Mục tiêu tuần

- Có pipeline CI/CD chạy thật và hệ thống đủ ổn định cho demo.

### Backlog tuần 7

| Task ID | Mô tả chi tiết | Owner | Ước lượng | Phụ thuộc | Deadline | Output bắt buộc |
|---|---|---|---|---|---|---|
| W7-SYS-01 | Viết workflow CI: lint, typecheck, test, build | System Owner | 1 ngày | Toàn bộ tuần 6 | Thứ 2 | CI chạy pass |
| W7-SYS-02 | Viết workflow CD staging/prod + smoke test | System Owner | 1 ngày | W7-SYS-01 | Thứ 3 | CD chạy được |
| W7-SYS-03 | Deploy miễn phí và cấu hình secrets | System Owner | 1 ngày | W7-SYS-02 | Thứ 4 | Staging + prod online |
| W7-RT-01 | Harden reconnect/resync + heartbeat | Realtime Owner | 1 ngày | W6-RT-03 | Thứ 4 | Kịch bản reconnect pass |
| W7-API-01 | Fix defect auth/persist từ integration tests | API Owner | 1 ngày | W7-QA-01 | Thứ 5 | Defect list giảm |
| W7-FE-01 | Harden UX lỗi mạng/token hết hạn/reconnect | FE Owner | 1 ngày | W7-RT-01 | Thứ 5 | UX ổn định |
| W7-QA-01 | Smoke test full flow trên staging | System Owner + cả nhóm | 0.5 ngày | W7-SYS-03 | Thứ 5 | Checklist smoke |
| W7-SYS-04 | Chốt runbook demo và rollback | System Owner | 0.5 ngày | W7-QA-01 | Thứ 6 | Runbook hoàn chỉnh |

### Điều kiện hoàn thành tuần 7

- CI/CD pass, staging/prod chạy ổn, smoke test pass.

---

## Tuần 8 - Chốt chất lượng và chuẩn bị bảo vệ

### Mục tiêu tuần

- Chốt chất lượng sản phẩm, chốt tài liệu, rehearsal bảo vệ.

### Backlog tuần 8

| Task ID | Mô tả chi tiết | Owner | Ước lượng | Phụ thuộc | Deadline | Output bắt buộc |
|---|---|---|---|---|---|---|
| W8-SYS-01 | Chạy inspection vòng cuối toàn bộ docs | System Owner | 0.5 ngày | W7-SYS-04 | Thứ 2 | Biên bản review |
| W8-ALL-01 | Sửa toàn bộ lỗi P1/P2 còn mở | Cả nhóm | 1.5 ngày | W8-SYS-01 | Thứ 4 | Defect board sạch |
| W8-ALL-02 | Đồng bộ docs với code thực tế | Cả nhóm | 1 ngày | W8-ALL-01 | Thứ 5 | Docs nhất quán |
| W8-ALL-03 | Rehearsal bảo vệ: demo + hỏi đáp kiến trúc | Cả nhóm | 0.5 ngày | W8-ALL-02 | Thứ 6 | Script bảo vệ |
| W8-SYS-02 | Chốt gói nộp cuối và checklist bàn giao | System Owner | 0.5 ngày | W8-ALL-03 | Thứ 6 | Gói nộp hoàn chỉnh |

### Điều kiện hoàn thành tuần 8

- Hệ thống demo ổn định.
- Tài liệu khớp code.
- Nhóm sẵn sàng bảo vệ.

---

## Checklist vi mô cố định theo từng người (áp dụng mỗi tuần)

### System Owner

| Mục kiểm | Đạt/Không đạt | Ghi chú |
|---|---|---|
| Quyết định kiến trúc mới đã ghi vào docs |  |  |
| Contract thay đổi đã có phê duyệt đúng quy trình |  |  |
| Risk log tuần đã cập nhật |  |  |
| Demo checklist tuần đã chạy |  |  |

### FE Owner

| Mục kiểm | Đạt/Không đạt | Ghi chú |
|---|---|---|
| Type model FE đồng bộ `02-api.md` và `03-events.md` |  |  |
| UI có trạng thái loading/error/empty/retry |  |  |
| Không log plaintext/tokens ở client |  |  |
| Có bằng chứng test thủ công hoặc tự động |  |  |

### API Owner

| Mục kiểm | Đạt/Không đạt | Ghi chú |
|---|---|---|
| Migration an toàn và có rollback plan |  |  |
| Endpoint có validate input + error code chuẩn |  |  |
| Rate limit/OTP/token policy đúng baseline |  |  |
| Idempotency cho endpoint ghi dữ liệu |  |  |

### Realtime Owner

| Mục kiểm | Đạt/Không đạt | Ghi chú |
|---|---|---|
| Event payload đúng contract docs |  |  |
| Có ack/error cho event quan trọng |  |  |
| Dedupe request hoạt động đúng |  |  |
| Timeout và cleanup trạng thái call đúng |  |  |

---

## Quy tắc phụ thuộc bắt buộc

- Không bắt đầu task implement nếu contract tương ứng chưa freeze.
- Không chuyển `Done` nếu thiếu test hoặc thiếu cập nhật docs.
- Không demo call nếu TURN chưa sẵn sàng.
- Không release nếu smoke test fail.

