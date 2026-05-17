# 11 - Roadmap Theo Chức Năng

## Mục tiêu

Tài liệu này gom lại toàn bộ task từ `10-roadmap.md` theo chức năng để dễ theo dõi theo feature, nhưng vẫn giữ nguyên task ID và owner.

---

## Quy ước

- Không đổi task ID so với `10-roadmap.md`.
- Không tạo task mới nếu chưa được thêm chính thức ở roadmap theo owner.
- System Owner chốt mốc sprint, từng owner tự điền deadline task trong khung sprint đó.
- Cột `Trạng thái` dùng chung: `Todo | In Progress | Blocked | In Review | Done`.

---

## Feature A - Foundation and Contract Freeze

| Task ID | Task | Owner | Phụ thuộc | Ước lượng | Trạng thái | Deadline | Ghi chú |
|---|---|---|---|---|---|---|---|
| SYS-01 | Chốt glossary và quy ước naming toàn dự án | System Owner | Không | S | Done | 2026-05-16 | `00-glossary-and-naming.md` |
| SYS-02 | Chốt rule freeze cho API/Event contract | System Owner | SYS-01 | S | Done | 2026-05-16 | `02`/`03` v1.0.0 FROZEN |
| SYS-03 | Chốt policy socket auth (handshake-only) | System Owner | SYS-02,API-09,RT-02 | XS | Todo |  |  |
| API-01 | Thiết kế schema `users` | API Owner | Không | S | Todo |  |  |
| API-02 | Thiết kế schema `conversations` | API Owner | API-01 | S | Todo |  |  |
| API-03 | Thiết kế schema `conversation_members` | API Owner | API-02 | S | Todo |  |  |
| API-04 | Thiết kế schema `messages` (cipher fields) | API Owner | API-03 | S | Todo |  |  |
| API-05 | Thiết kế schema `receipts` | API Owner | API-04 | XS | Todo |  |  |
| API-06 | Migration baseline PostgreSQL | API Owner | API-01..API-05 | M | Todo |  |  |
| RT-01 | Bootstrap Socket.IO server | Realtime Owner | Không | S | Todo |  |  |
| RT-02 | Handshake auth middleware | Realtime Owner | RT-01,API-09,SYS-03 | S | Todo |  |  |
| RT-03 | Mapping `userId-deviceId-socketId` | Realtime Owner | RT-02 | S | Todo |  |  |
| RT-04 | Room join/leave theo `conversationId` | Realtime Owner | RT-03,API-17,FE-11 | S | Todo |  |  |
| FE-01 | Tạo skeleton route auth/chat/call | FE Owner | Không | S | Todo |  |  |
| FE-02 | Tạo auth store (user/token/session) | FE Owner | FE-01 | S | Todo |  |  |
| FE-03 | Tạo socket store (connect/reconnect state) | FE Owner | FE-01 | S | Todo |  |  |

---

## Feature B - Auth, Session, OTP, Discovery

| Task ID | Task | Owner | Phụ thuộc | Ước lượng | Trạng thái | Deadline | Ghi chú |
|---|---|---|---|---|---|---|---|
| API-07 | Endpoint request OTP | API Owner | API-06 | S | Todo |  |  |
| API-08 | Endpoint verify OTP | API Owner | API-07 | S | Todo |  |  |
| API-09 | Endpoint login (email/username) | API Owner | API-08,FE-06,RT-02 | S | Todo |  |  |
| API-10 | Endpoint refresh token rotation | API Owner | API-09,FE-07 | S | Todo |  |  |
| API-11 | Endpoint logout + revoke current session | API Owner | API-10 | XS | Todo |  |  |
| API-12 | Endpoint logout-all + revoke all sessions | API Owner | API-11 | XS | Todo |  |  |
| API-24 | Session storage cho refresh token hash | API Owner | API-10 | S | Todo |  |  |
| API-13 | Rate limit OTP theo IP/email | API Owner | API-07 | S | Todo |  |  |
| API-14 | Rate limit search endpoint | API Owner | API-09 | XS | Todo |  |  |
| API-15 | Search theo username prefix | API Owner | API-09 | S | Todo |  |  |
| API-16 | Search theo email exact | API Owner | API-09 | S | Todo |  |  |
| API-17 | Endpoint create/get direct conversation | API Owner | API-03,FE-10 | S | Todo |  |  |
| API-18 | Endpoint list conversations (cursor) | API Owner | API-17 | S | Todo |  |  |
| FE-04 | Màn đăng ký + request OTP | FE Owner | FE-02,API-07 | S | Todo |  |  |
| FE-05 | Màn verify OTP + resend cooldown | FE Owner | FE-04,API-08 | S | Todo |  |  |
| FE-06 | Màn login (email/username) | FE Owner | FE-02,API-09 | S | Todo |  |  |
| FE-07 | Xử lý refresh token khi 401 | FE Owner | FE-06,API-10 | S | Todo |  |  |
| FE-08 | UI tìm user theo `@username` | FE Owner | FE-06,API-15 | S | Todo |  |  |
| FE-09 | UI tìm user theo email (exact) | FE Owner | FE-06,API-16 | S | Todo |  |  |
| FE-10 | UI tạo conversation direct | FE Owner | FE-08,FE-09,API-17 | S | Todo |  |  |
| FE-11 | Join room theo `conversationId` | FE Owner | FE-10,RT-04 | XS | Todo |  |  |
| RT-05 | `presence:subscribe` handler | Realtime Owner | RT-04 | XS | Todo |  |  |
| RT-06 | `presence:update` broadcast | Realtime Owner | RT-05 | XS | Todo |  |  |

---

## Feature C - Encrypted Messaging Core

| Task ID | Task | Owner | Phụ thuộc | Ước lượng | Trạng thái | Deadline | Ghi chú |
|---|---|---|---|---|---|---|---|
| API-19 | Internal persist message (idempotent) | API Owner | API-04,RT-09,FE-13 | M | Todo |  |  |
| API-20 | Endpoint message history (cursor) | API Owner | API-19 | S | Todo |  |  |
| API-21 | Endpoint mark delivered | API Owner | API-19,FE-16,RT-12 | XS | Todo |  |  |
| API-22 | Endpoint mark read | API Owner | API-19,FE-17,RT-12 | XS | Todo |  |  |
| API-23 | Chuẩn hóa error envelope + error codes | API Owner | API-09 | S | Todo |  |  |
| API-25 | Reuse detection cho refresh replay | API Owner | API-24 | S | Todo |  |  |
| RT-07 | `chat:send` schema validation | Realtime Owner | RT-04 | S | Todo |  |  |
| RT-08 | Kiểm tra quyền member conversation | Realtime Owner | RT-07 | XS | Todo |  |  |
| RT-09 | Gọi API internal persist message | Realtime Owner | RT-07,API-19 | S | Todo |  |  |
| RT-10 | Emit `system:ack` chuẩn | Realtime Owner | RT-09 | XS | Todo |  |  |
| RT-11 | Emit `system:error` chuẩn | Realtime Owner | RT-09 | XS | Todo |  |  |
| RT-12 | `chat:message` fanout | Realtime Owner | RT-10 | S | Todo |  |  |
| RT-13 | Dedupe theo `requestId + senderDeviceId` | Realtime Owner | RT-10 | S | Todo |  |  |
| RT-14 | Chặn replay theo `senderDeviceId + conversationId + nonce + keyVersion` | Realtime Owner | RT-13,API-19,SYS-04 | S | Todo |  |  |
| FE-12 | Mã hóa plaintext -> AES-GCM envelope | FE Owner | FE-11,SYS-04 | M | Todo |  |  |
| FE-13 | Emit `chat:send` với `requestId` | FE Owner | FE-12,RT-09,API-19 | XS | Todo |  |  |
| FE-14 | Queue retry backoff cho gửi tin | FE Owner | FE-13,RT-10 | S | Todo |  |  |
| FE-15 | Nhận `chat:message` và giải mã | FE Owner | FE-12,RT-12 | S | Todo |  |  |
| FE-16 | Gửi `chat:delivered` | FE Owner | FE-15 | XS | Todo |  |  |
| FE-17 | Gửi `chat:read` | FE Owner | FE-15 | XS | Todo |  |  |
| FE-18 | Hiển thị sent/delivered/read | FE Owner | FE-16,FE-17,API-21,API-22 | S | Todo |  |  |

---

## Feature D - E2EE Key Lifecycle

| Task ID | Task | Owner | Phụ thuộc | Ước lượng | Trạng thái | Deadline | Ghi chú |
|---|---|---|---|---|---|---|---|
| SYS-04 | Chốt tiêu chuẩn E2EE envelope + replay rule | System Owner | SYS-02,API-19,RT-14 | S | Todo |  |  |
| SYS-05 | Chốt threshold rotate (`N`,`T`) + grace window | System Owner | SYS-04 | XS | Todo |  |  |
| SYS-06 | Chốt tie-break khi rotate đồng thời | System Owner | SYS-05 | XS | Todo |  |  |
| SYS-21 | Implement orchestration E2EE lifecycle (rotate/rekey conflict handling integration) | System Owner | SYS-06,RT-18,FE-21,API-19 | L | Todo |  |  |
| RT-15 | `key:exchange:init` routing | Realtime Owner | RT-04 | S | Todo |  |  |
| RT-16 | `key:exchange:response` routing | Realtime Owner | RT-15 | XS | Todo |  |  |
| RT-17 | `key:rotate` routing | Realtime Owner | RT-16 | S | Todo |  |  |
| RT-18 | Tie-break khi rotate đồng thời | Realtime Owner | RT-17,SYS-06 | S | Todo |  |  |
| RT-19 | `key:rekey_required` routing | Realtime Owner | RT-17 | XS | Todo |  |  |
| FE-19 | Implement key session state machine | FE Owner | FE-12,RT-15,RT-16 | M | Todo |  |  |
| FE-20 | Trigger key rotation theo count/time | FE Owner | FE-19,SYS-05,RT-17 | S | Todo |  |  |
| FE-21 | Rekey flow khi mismatch `keyVersion` | FE Owner | FE-19,RT-19,SYS-21 | S | Todo |  |  |

---

## Feature E - Voice/Video Call Signaling and Media

| Task ID | Task | Owner | Phụ thuộc | Ước lượng | Trạng thái | Deadline | Ghi chú |
|---|---|---|---|---|---|---|---|
| SYS-07 | Chốt call state machine voice/video | System Owner | SYS-02,RT-20,FE-25 | S | Todo |  |  |
| SYS-08 | Chốt TURN fallback policy | System Owner | SYS-07,RT-22 | XS | Todo |  |  |
| SYS-19 | Implement cấu hình runtime WebRTC (iceServers, timeout, retry policy) | System Owner | SYS-08,RT-22,FE-25 | M | Todo |  |  |
| SYS-20 | Implement fallback TURN và tiêu chí chuyển audio-only khi mạng yếu | System Owner | SYS-19,RT-23,FE-23 | M | Todo |  |  |
| RT-20 | `call:start` + `call:incoming` | Realtime Owner | RT-04,SYS-07 | S | Todo |  |  |
| RT-21 | `call:accept/reject/end` | Realtime Owner | RT-20 | S | Todo |  |  |
| RT-22 | `call:offer/answer/ice` relay | Realtime Owner | RT-21,FE-25,SYS-19 | M | Todo |  |  |
| RT-23 | Timeout + cleanup state call | Realtime Owner | RT-22,SYS-08 | S | Todo |  |  |
| FE-22 | Incoming call modal | FE Owner | FE-03,RT-20 | S | Todo |  |  |
| FE-23 | Voice call UI + mute/unmute | FE Owner | FE-22,SYS-07 | M | Todo |  |  |
| FE-24 | Video call UI + camera on/off | FE Owner | FE-22,SYS-07 | M | Todo |  |  |
| FE-25 | WebRTC offer/answer/ICE handlers | FE Owner | FE-23,FE-24,RT-22,SYS-19 | M | Todo |  |  |

---

## Feature F - Reconnect, Resync, Hardening

| Task ID | Task | Owner | Phụ thuộc | Ước lượng | Trạng thái | Deadline | Ghi chú |
|---|---|---|---|---|---|---|---|
| RT-24 | Reconnect resubscription flow | Realtime Owner | RT-03,RT-23,FE-26 | S | Todo |  |  |
| RT-25 | Heartbeat + stale socket cleanup | Realtime Owner | RT-24 | S | Todo |  |  |
| RT-26 | Health endpoint + dependency checks | Realtime Owner | RT-01 | XS | Todo |  |  |
| RT-27 | Test duplicate send/dedupe/replay block | Realtime Owner | RT-14 | S | Todo |  |  |
| RT-28 | Test reconnect during call | Realtime Owner | RT-24,FE-26,SYS-10 | S | Todo |  |  |
| FE-26 | Reconnect + resync UI states | FE Owner | FE-14,FE-25,RT-24,API-20 | S | Todo |  |  |
| FE-27 | Error UX cho auth/socket/call | FE Owner | FE-26 | S | Todo |  |  |
| FE-28 | Kiểm tra không log plaintext/token | FE Owner | FE-27 | XS | Todo |  | Cổng bảo mật FE |
| API-26 | Health/readiness endpoint | API Owner | API-06 | XS | Todo |  |  |
| API-27 | Test OTP expiry/attempt/cooldown | API Owner | API-07,API-08,FE-05 | S | Todo |  |  |
| API-28 | Test refresh rotation/replay revoke-chain | API Owner | API-10,API-25,FE-07,SYS-10 | S | Todo |  |  |

---

## Feature G - CI/CD, Release, Governance

| Task ID | Task | Owner | Phụ thuộc | Ước lượng | Trạng thái | Deadline | Ghi chú |
|---|---|---|---|---|---|---|---|
| SYS-09 | Review consistency `02`-`03`-`04`-`05` | System Owner | SYS-03,SYS-06,SYS-08 | M | Todo |  | Lặp theo chu kỳ |
| SYS-10 | Thiết kế checklist kiểm thử tích hợp E2E | System Owner | SYS-09 | S | Todo |  | Theo `08-qa-test-plan.md` |
| SYS-11 | Thiết kế workflow CI | System Owner | SYS-09,API-28,RT-28,FE-28 | M | In Progress |  | `.github/workflows/ci.yml` — compose validate |
| SYS-12 | Thiết kế workflow CD + smoke test | System Owner | SYS-11,API-26,RT-26 | M | Todo |  |  |
| SYS-13 | Chốt secrets matrix theo môi trường | System Owner | SYS-11,API-10,RT-02 | S | In Progress |  | Root + prod + service `.env.example` |
| SYS-14 | Triển khai staging | System Owner | SYS-12,SYS-13 | M | Todo |  |  |
| SYS-15 | Triển khai production | System Owner | SYS-14 | M | Todo |  |  |
| SYS-16 | Chốt runbook demo + rollback | System Owner | SYS-15 | S | Todo |  |  |
| SYS-17 | Quản lý blocker escalation toàn team | System Owner | Không | XS | In Progress |  | Lặp mỗi tuần |
| SYS-18 | Final inspection docs-code consistency | System Owner | SYS-16,FE-28,API-28,RT-28 | M | Todo |  | Tuần cuối |
| SYS-22 | Implement integration test suite cho WebRTC+E2EE (happy/failure/recovery) | System Owner | SYS-20,SYS-21,API-28,RT-28,FE-28 | M | Todo |  |  |

---

## Kiểm tra truy vết 1:1 với `10-roadmap.md`

- Tổng task `System Owner`: 22
- Tổng task `FE Owner`: 28
- Tổng task `API Owner`: 28
- Tổng task `Realtime Owner`: 28
- Tổng cộng: 106 task

Nếu thêm/sửa task ở `10-roadmap.md`, bắt buộc cập nhật lại file này trong cùng PR.

