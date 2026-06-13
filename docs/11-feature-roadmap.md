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
| SYS-03 | Chốt policy socket auth (handshake-only) | System Owner | SYS-02,API-09,RT-02 | XS | Done | 2026-05-24 | `06-security.md` + clarify `03-events.md` |
| API-01 | Thiết kế schema `users` | API Owner | Không | S | Done |  | `init.sql` |
| API-02 | Thiết kế schema `conversations` | API Owner | API-01 | S | Done |  | `init.sql` |
| API-03 | Thiết kế schema `conversation_members` | API Owner | API-02 | S | Done |  | `init.sql` |
| API-04 | Thiết kế schema `messages` (cipher fields) | API Owner | API-03 | S | Done |  | `init.sql` |
| API-05 | Thiết kế schema `receipts` | API Owner | API-04 | XS | Done |  | `init.sql` — message_receipts |
| API-06 | Migration baseline PostgreSQL | API Owner | API-01..API-05 | M | Done |  | `init.sql` chạy qua compose |
| RT-01 | Bootstrap Socket.IO server | Realtime Owner | Không | S | Done |  | `realtime-service/src/index.ts` |
| RT-02 | Handshake auth middleware | Realtime Owner | RT-01,API-09,SYS-03 | S | Done |  | `socket/auth.ts` — JWT + dev token |
| RT-03 | Mapping `userId-deviceId-socketId` | Realtime Owner | RT-02 | S | Done |  | `connectionStore.ts` |
| RT-04 | Room join/leave theo `conversationId` | Realtime Owner | RT-03,API-17,FE-11 | S | Done |  | `joinConversation` handler |
| FE-01 | Tạo skeleton route auth/chat/call | FE Owner | Không | S | Done |  | React Router, lazy routes |
| FE-02 | Tạo auth store (user/token/session) | FE Owner | FE-01 | S | Done |  | `AuthContext.tsx`, localStorage |
| FE-03 | Tạo socket store (connect/reconnect state) | FE Owner | FE-01 | S | Done |  | `socket/manager.ts` |

---

## Feature B - Auth, Session, OTP, Discovery

| Task ID | Task | Owner | Phụ thuộc | Ước lượng | Trạng thái | Deadline | Ghi chú |
|---|---|---|---|---|---|---|---|
| API-07 | Endpoint request OTP | API Owner | API-06 | S | Done |  | Email SMTP; 503 nếu SMTP chưa cấu hình |
| API-08 | Endpoint verify OTP | API Owner | API-07 | S | Done |  | scrypt verify; tạo user + session |
| API-09 | Endpoint login (email/username) | API Owner | API-08,FE-06,RT-02 | S | Done |  | JWT claims `sub`, `sid`, `deviceId` aligned |
| API-10 | Endpoint refresh token rotation | API Owner | API-09,FE-07 | S | Done |  | Rotation + replay revoke-chain |
| API-11 | Endpoint logout + revoke current session | API Owner | API-10 | XS | Done |  |  |
| API-12 | Endpoint logout-all + revoke all sessions | API Owner | API-11 | XS | Done |  |  |
| API-24 | Session storage cho refresh token hash | API Owner | API-10 | S | Done |  | SHA-256 hash, PostgreSQL |
| API-13 | Rate limit OTP theo IP/email | API Owner | API-07 | S | Todo |  |  |
| API-14 | Rate limit search endpoint | API Owner | API-09 | XS | Todo |  |  |
| API-15 | Search theo username prefix | API Owner | API-09 | S | Todo |  | FE client có `searchUsers()`; backend chưa implement |
| API-16 | Search theo email exact | API Owner | API-09 | S | Todo |  | FE client có; backend chưa implement |
| API-17 | Endpoint create/get direct conversation | API Owner | API-03,FE-10 | S | Done |  | `POST /conversations/direct` |
| API-18 | Endpoint list conversations (cursor) | API Owner | API-17 | S | Done |  | ⚠️ shape bug: trả array thẳng, FE expect `{ conversations: [] }` |
| FE-04 | Màn đăng ký + request OTP | FE Owner | FE-02,API-07 | S | Done |  |  |
| FE-05 | Màn verify OTP + resend cooldown | FE Owner | FE-04,API-08 | S | Done |  |  |
| FE-06 | Màn login (email/username) | FE Owner | FE-02,API-09 | S | Done |  |  |
| FE-07 | Xử lý refresh token khi 401 | FE Owner | FE-06,API-10 | S | Done |  | `apiClient.setRefreshHandler` trong `AuthContext` |
| FE-08 | UI tìm user theo `@username` | FE Owner | FE-06,API-15 | S | In Review |  | UI có; backend API-15 chưa implement |
| FE-09 | UI tìm user theo email (exact) | FE Owner | FE-06,API-16 | S | In Review |  | UI có; backend API-16 chưa implement |
| FE-10 | UI tạo conversation direct | FE Owner | FE-08,FE-09,API-17 | S | Done |  |  |
| FE-11 | Join room theo `conversationId` | FE Owner | FE-10,RT-04 | XS | Done |  | `socketManager.joinConversation()` |
| RT-05 | `presence:subscribe` handler | Realtime Owner | RT-04 | XS | Done |  |  |
| RT-06 | `presence:update` broadcast | Realtime Owner | RT-05 | XS | Done |  |  |

---

## Feature C - Encrypted Messaging Core

| Task ID | Task | Owner | Phụ thuộc | Ước lượng | Trạng thái | Deadline | Ghi chú |
|---|---|---|---|---|---|---|---|
| API-19 | Internal persist message (idempotent) | API Owner | API-04,RT-09,FE-13 | M | Done |  | `POST /internal/messages/persist`; dedupe `requestId+senderDeviceId` |
| API-20 | Endpoint message history (cursor) | API Owner | API-19 | S | Done |  | ⚠️ shape bug: trả array thẳng, FE expect `{ messages: [] }` |
| API-21 | Endpoint mark delivered | API Owner | API-19,FE-16,RT-12 | XS | Done |  |  |
| API-22 | Endpoint mark read | API Owner | API-19,FE-17,RT-12 | XS | Done |  |  |
| API-23 | Chuẩn hóa error envelope + error codes | API Owner | API-09 | S | Done |  | `http.ts` fail/ok helpers |
| API-25 | Reuse detection cho refresh replay | API Owner | API-24 | S | Done |  | Revoke chain khi `revoked_at` bị dùng lại |
| RT-07 | `chat:send` schema validation | Realtime Owner | RT-04 | S | Done |  |  |
| RT-08 | Kiểm tra quyền member conversation | Realtime Owner | RT-07 | XS | Done |  | HTTP thật tới API internal (`conversationAccess.ts`) |
| RT-09 | Gọi API internal persist message | Realtime Owner | RT-07,API-19 | S | Done |  | `messagePersist.ts` |
| RT-10 | Emit `system:ack` chuẩn | Realtime Owner | RT-09 | XS | Done |  |  |
| RT-11 | Emit `system:error` chuẩn | Realtime Owner | RT-09 | XS | Done |  |  |
| RT-12 | `chat:message` fanout | Realtime Owner | RT-10 | S | Done |  |  |
| RT-13 | Dedupe theo `requestId + senderDeviceId` | Realtime Owner | RT-10 | S | Done |  | `dedupeStore.ts` — in-memory TTL |
| RT-14 | Chặn replay theo `senderDeviceId + conversationId + nonce + keyVersion` | Realtime Owner | RT-13,API-19,SYS-04 | S | Done |  | `nonceReplayStore.ts` — ⚠️ in-memory, mất khi restart |
| FE-12 | Mã hóa plaintext -> AES-GCM envelope | FE Owner | FE-11,SYS-04 | M | Done |  | `crypto/manager.ts` — AES-256-GCM per-conversation key |
| FE-13 | Emit `chat:send` với `requestId` | FE Owner | FE-12,RT-09,API-19 | XS | Done |  |  |
| FE-14 | Queue retry backoff cho gửi tin | FE Owner | FE-13,RT-10 | S | In Review |  | Gửi cơ bản có; chưa có queue/retry logic đầy đủ |
| FE-15 | Nhận `chat:message` và giải mã | FE Owner | FE-12,RT-12 | S | Done |  | `ChatContext` `decryptMessage()` |
| FE-16 | Gửi `chat:delivered` | FE Owner | FE-15 | XS | Done |  |  |
| FE-17 | Gửi `chat:read` | FE Owner | FE-15 | XS | Done |  |  |
| FE-18 | Hiển thị sent/delivered/read | FE Owner | FE-16,FE-17,API-21,API-22 | S | In Review |  | Partial; status UI chưa đầy đủ |

---

## Feature D - E2EE Key Lifecycle

| Task ID | Task | Owner | Phụ thuộc | Ước lượng | Trạng thái | Deadline | Ghi chú |
|---|---|---|---|---|---|---|---|
| SYS-04 | Chốt tiêu chuẩn E2EE envelope + replay rule | System Owner | SYS-02,API-19,RT-14 | S | Done | 2026-06-13 | Spec trong `05-e2ee.md`; implemented FE + RT |
| SYS-05 | Chốt threshold rotate (`N`,`T`) + grace window | System Owner | SYS-04 | XS | Done | 2026-06-13 | N=50, T=30 phút, grace=2 phút — `05-e2ee.md` |
| SYS-06 | Chốt tie-break khi rotate đồng thời | System Owner | SYS-05 | XS | Done | 2026-06-13 | `keyRotationStore.ts` |
| SYS-21 | Implement orchestration E2EE lifecycle (rotate/rekey conflict handling integration) | System Owner | SYS-06,RT-18,FE-21,API-19 | L | Todo |  |  |
| RT-15 | `key:exchange:init` routing | Realtime Owner | RT-04 | S | Done |  | Relay tới peer |
| RT-16 | `key:exchange:response` routing | Realtime Owner | RT-15 | XS | Done |  | Relay tới initiator |
| RT-17 | `key:rotate` routing | Realtime Owner | RT-16 | S | Done |  | Relay tới peer |
| RT-18 | Tie-break khi rotate đồng thời | Realtime Owner | RT-17,SYS-06 | S | Done |  | `keyRotationStore.ts` |
| RT-19 | `key:rekey_required` routing | Realtime Owner | RT-17 | XS | Done |  | Relay tới sender |
| FE-19 | Implement key session state machine | FE Owner | FE-12,RT-15,RT-16 | M | Done |  | `initiateKeyExchange` / `handleIncomingKeyExchangeInit` trong `ChatContext` |
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
| RT-26 | Health endpoint + dependency checks | Realtime Owner | RT-01 | XS | Done |  | `GET /health` + `readiness.ts` |
| RT-27 | Test duplicate send/dedupe/replay block | Realtime Owner | RT-14 | S | Todo |  |  |
| RT-28 | Test reconnect during call | Realtime Owner | RT-24,FE-26,SYS-10 | S | Todo |  |  |
| FE-26 | Reconnect + resync UI states | FE Owner | FE-14,FE-25,RT-24,API-20 | S | Todo |  |  |
| FE-27 | Error UX cho auth/socket/call | FE Owner | FE-26 | S | Todo |  |  |
| FE-28 | Kiểm tra không log plaintext/token | FE Owner | FE-27 | XS | Todo |  | Cổng bảo mật FE |
| API-26 | Health/readiness endpoint | API Owner | API-06 | XS | Done |  | `GET /health`, `GET /ready` |
| API-27 | Test OTP expiry/attempt/cooldown | API Owner | API-07,API-08,FE-05 | S | In Review |  | `api.test.ts` có test cơ bản |
| API-28 | Test refresh rotation/replay revoke-chain | API Owner | API-10,API-25,FE-07,SYS-10 | S | In Review |  | `api.test.ts` có test cơ bản |

---

## Feature G - CI/CD, Release, Governance

| Task ID | Task | Owner | Phụ thuộc | Ước lượng | Trạng thái | Deadline | Ghi chú |
|---|---|---|---|---|---|---|---|
| SYS-09 | Review consistency `02`-`03`-`04`-`05` | System Owner | SYS-03,SYS-06,SYS-08 | M | Todo |  | Lặp theo chu kỳ |
| SYS-10 | Thiết kế checklist kiểm thử tích hợp E2E | System Owner | SYS-09 | S | Todo |  | Theo `08-qa-test-plan.md` |
| SYS-11 | Thiết kế workflow CI | System Owner | SYS-09,API-28,RT-28,FE-28 | M | Done | 2026-06-13 | Build 3 service + compose-build + audit lite — `.github/workflows/ci.yml` |
| SYS-12 | Thiết kế workflow CD + smoke test | System Owner | SYS-11,API-26,RT-26 | M | Todo |  |  |
| SYS-13 | Chốt secrets matrix theo môi trường | System Owner | SYS-11,API-10,RT-02 | S | Done | 2026-05-24 | Secrets matrix `07` + env example comments |
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

