# 10 - Roadmap Thực Thi (Theo Owner)

## Mục tiêu

Tài liệu này là kế hoạch thực thi chi tiết theo từng thành viên, dùng trực tiếp để theo dõi tiến độ hằng tuần.

---

## Quy ước theo dõi tiến độ

### Trạng thái

- `Todo`: chưa bắt đầu.
- `In Progress`: đang thực hiện.
- `Blocked`: đang bị chặn.
- `In Review`: đã tạo PR/chờ review.
- `Done`: hoàn thành đủ DoD trong `09-team-raci.md`.

### Mức ước lượng

- `XS`: <= 2 giờ.
- `S`: 0.5 ngày.
- `M`: 1 ngày.
- `L`: 2 ngày.
- `XL`: > 2 ngày.

### Cột deadline

- System Owner chốt mốc sprint theo tuần, từng owner tự điền `Deadline (tự điền)` của task trong khung đó.

---

## Ánh xạ Owner

| Owner | Người phụ trách |
|---|---|
| System Owner | Đình Tiến |
| FE Owner | Bật Tiến |
| API Owner | Minh Tiến |
| Realtime Owner | Lương Thứ |

---

## Mốc kiểm soát 8 tuần (khung)

| Tuần | Mục tiêu kiểm soát | Điều kiện pass |
|---|---|---|
| Tuần 1 | Xong skeleton + docs nền | Docs nền ✓. DevOps infra (compose, nginx, Dockerfiles, env.example, README, CI skeleton) ✓. App boot 3 service: chờ owners |
| Tuần 2 | Freeze contract V1 | `02-api.md` và `03-events.md` FROZEN 1.0.0 (2026-05-16) |
| Tuần 3 | Auth + OTP + Discovery | User onboarding chạy E2E — API backend ~có; blocker: FE-01..06, RT membership wire |
| Tuần 4 | Chat E2EE cơ bản | Gửi/nhận/lưu ciphertext ổn định |
| Tuần 5 | Key lifecycle | Rotate + rekey recovery pass test |
| Tuần 6 | Voice/Video call | Signaling call ổn định trên staging |
| Tuần 7 | Deploy + CI/CD + hardening | CI/CD pass, smoke test pass |
| Tuần 8 | Final inspection | Docs khớp code, sẵn sàng bảo vệ |

---

## Bảng công việc chi tiết - System Owner (Đình Tiến)

| STT | Task ID | Task chi tiết | Phụ thuộc | Ước lượng | Trạng thái | Deadline (tự điền) | Ghi chú |
|---:|---|---|---|---|---|---|---|
| 1 | SYS-01 | Chốt glossary và quy ước naming toàn dự án | Không | S | Done | 2026-05-16 | `docs/00-glossary-and-naming.md` |
| 2 | SYS-02 | Chốt rule freeze cho API/Event contract | SYS-01 | S | Done | 2026-05-16 | `02`/`03` FROZEN; freeze rules trong `09` |
| 3 | SYS-03 | Chốt policy socket auth (handshake-only) | SYS-02,API-09,RT-02 | XS | Done | 2026-05-24 | Policy `06-security.md`; clarify `03-events.md` |
| 4 | SYS-04 | Chốt tiêu chuẩn E2EE envelope + replay rule | SYS-02,API-19,RT-14 | S | Done | 2026-06-13 | Spec trong `05-e2ee.md`; implemented FE + RT |
| 5 | SYS-05 | Chốt threshold rotate (`N`,`T`) + grace window | SYS-04 | XS | Done | 2026-06-13 | N=50 tin, T=30 phút, grace=2 phút — `05-e2ee.md` |
| 6 | SYS-06 | Chốt tie-break khi rotate đồng thời | SYS-05 | XS | Done | 2026-06-13 | `keyRotationStore.ts` realtime-service |
| 7 | SYS-07 | Chốt call state machine voice/video | SYS-02,RT-20,FE-25 | S | Done | 2026-06-14 | State machine + edge cases trong `04-flow.md` |
| 8 | SYS-08 | Chốt TURN fallback policy | SYS-07,RT-22 | XS | Done | 2026-06-14 | Ngưỡng ICE + audio-only trong `04-flow.md` |
| 9 | SYS-09 | Review consistency `02`-`03`-`04`-`05` | SYS-03,SYS-06,SYS-08 | M | Todo |  | Chạy mỗi cuối tuần |
| 10 | SYS-10 | Thiết kế checklist kiểm thử tích hợp E2E | SYS-09 | S | Todo |  | Theo `08-qa-test-plan.md` |
| 11 | SYS-11 | Thiết kế workflow CI | SYS-09,API-28,RT-28,FE-28 | M | Done | 2026-06-13 | CI: compose validate + build 3 service + compose-build + audit lite — `.github/workflows/ci.yml` |
| 12 | SYS-12 | Thiết kế workflow CD + smoke test | SYS-11,API-26,RT-26 | M | Todo |  |  |
| 13 | SYS-13 | Chốt secrets matrix theo môi trường | SYS-11,API-10,RT-02 | S | Done | 2026-05-24 | Bảng secrets + checklist trong `07`; comment `.env.example` |
| 14 | SYS-14 | Triển khai staging | SYS-12,SYS-13 | M | Todo |  |  |
| 15 | SYS-15 | Triển khai production | SYS-14 | M | Todo |  |  |
| 16 | SYS-16 | Chốt runbook demo + rollback | SYS-15 | S | Todo |  |  |
| 17 | SYS-17 | Quản lý blocker escalation toàn team | Không | XS | In Progress |  | Lặp lại mỗi tuần |
| 18 | SYS-18 | Final inspection docs-code consistency | SYS-16,FE-28,API-28,RT-28 | M | Todo |  | Tuần cuối |
| 19 | SYS-19 | Implement cấu hình runtime WebRTC (iceServers, timeout, retry policy) | SYS-08,RT-22,FE-25 | M | Done | 2026-06-14 | `frontend/src/webrtc/config.ts` — rtcConfig, ICE timeouts; `frontend/.env.example` VITE_STUN/TURN_* |
| 20 | SYS-20 | Implement fallback TURN và tiêu chí chuyển audio-only khi mạng yếu | SYS-19,RT-23,FE-23 | M | Done | 2026-06-14 | Constants: `AUDIO_ONLY_FALLBACK_MIN_BITRATE_BPS/HOLD_DURATION_MS` trong `webrtc/config.ts`; policy trong `04-flow.md`; FE-23 implement UI |
| 21 | SYS-21 | Implement orchestration E2EE lifecycle (rotate/rekey conflict handling integration) | SYS-06,RT-18,FE-21,API-19 | L | Todo |  | Task thực thi kỹ thuật |
| 22 | SYS-22 | Implement integration test suite cho WebRTC+E2EE (happy/failure/recovery) | SYS-20,SYS-21,API-28,RT-28,FE-28 | M | Todo |  | Task thực thi kỹ thuật |

---

## Bảng công việc chi tiết - FE Owner (Bật Tiến)

| STT | Task ID | Task chi tiết | Phụ thuộc | Ước lượng | Trạng thái | Deadline (tự điền) | Ghi chú |
|---:|---|---|---|---|---|---|---|
| 1 | FE-01 | Tạo skeleton route auth/chat/call | Không | S | Done |  | React Router, lazy routes |
| 2 | FE-02 | Tạo auth store (user/token/session) | FE-01 | S | Done |  | `AuthContext.tsx`, localStorage |
| 3 | FE-03 | Tạo socket store (connect/reconnect state) | FE-01 | S | Done |  | `socket/manager.ts` |
| 4 | FE-04 | Màn đăng ký + request OTP | FE-02,API-07 | S | Done |  |  |
| 5 | FE-05 | Màn verify OTP + resend cooldown | FE-04,API-08 | S | Done |  |  |
| 6 | FE-06 | Màn login (email/username) | FE-02,API-09 | S | Done |  |  |
| 7 | FE-07 | Xử lý refresh token khi 401 | FE-06,API-10 | S | Done |  | `apiClient.setRefreshHandler` trong `AuthContext` |
| 8 | FE-08 | UI tìm user theo `@username` | FE-06,API-15 | S | In Review |  | UI có; API-15 chưa implement backend |
| 9 | FE-09 | UI tìm user theo email (exact) | FE-06,API-16 | S | In Review |  | UI có; API-16 chưa implement backend |
| 10 | FE-10 | UI tạo conversation direct | FE-08,FE-09,API-17 | S | Done |  |  |
| 11 | FE-11 | Join room theo `conversationId` | FE-10,RT-04 | XS | Done |  | `socketManager.joinConversation()` |
| 12 | FE-12 | Mã hóa plaintext -> AES-GCM envelope | FE-11,SYS-04 | M | Done |  | `crypto/manager.ts` — AES-256-GCM, per-conversation key |
| 13 | FE-13 | Emit `chat:send` với `requestId` | FE-12,RT-09,API-19 | XS | Done |  |  |
| 14 | FE-14 | Queue retry backoff cho gửi tin | FE-13,RT-10 | S | In Review |  | Gửi cơ bản có; chưa có queue/retry logic |
| 15 | FE-15 | Nhận `chat:message` và giải mã | FE-12,RT-12 | S | Done |  | `ChatContext` `decryptMessage()` |
| 16 | FE-16 | Gửi `chat:delivered` | FE-15 | XS | Done |  |  |
| 17 | FE-17 | Gửi `chat:read` | FE-15 | XS | Done |  |  |
| 18 | FE-18 | Hiển thị sent/delivered/read | FE-16,FE-17,API-21,API-22 | S | In Review |  | Partial; status UI chưa đầy đủ |
| 19 | FE-19 | Implement key session state machine | FE-12,RT-15,RT-16 | M | Done |  | `initiateKeyExchange` / `handleIncomingKeyExchangeInit` trong `ChatContext` |
| 20 | FE-20 | Trigger key rotation theo count/time | FE-19,SYS-05,RT-17 | S | Todo |  |  |
| 21 | FE-21 | Rekey flow khi mismatch `keyVersion` | FE-19,RT-19,SYS-21 | S | Todo |  |  |
| 22 | FE-22 | Incoming call modal | FE-03,RT-20 | S | Todo |  |  |
| 23 | FE-23 | Voice call UI + mute/unmute | FE-22,SYS-07 | M | Todo |  |  |
| 24 | FE-24 | Video call UI + camera on/off | FE-22,SYS-07 | M | Todo |  |  |
| 25 | FE-25 | WebRTC offer/answer/ICE handlers | FE-23,FE-24,RT-22,SYS-19 | M | Todo |  |  |
| 26 | FE-26 | Reconnect + resync UI states | FE-14,FE-25,RT-24,API-20 | S | Todo |  |  |
| 27 | FE-27 | Error UX cho auth/socket/call | FE-26 | S | Todo |  |  |
| 28 | FE-28 | Kiểm tra không log plaintext/token | FE-27 | XS | Todo |  | Cổng bảo mật FE |

---

## Bảng công việc chi tiết - API Owner (Minh Tiến)

| STT | Task ID | Task chi tiết | Phụ thuộc | Ước lượng | Trạng thái | Deadline (tự điền) | Ghi chú |
|---:|---|---|---|---|---|---|---|
| 1 | API-01 | Thiết kế schema `users` | Không | S | Done |  | `api-service/src/db/init.sql` |
| 2 | API-02 | Thiết kế schema `conversations` | API-01 | S | Done |  | `init.sql` |
| 3 | API-03 | Thiết kế schema `conversation_members` | API-02 | S | Done |  | `init.sql` |
| 4 | API-04 | Thiết kế schema `messages` (cipher fields) | API-03 | S | Done |  | `init.sql` — ciphertext, nonce, algorithm, key_version |
| 5 | API-05 | Thiết kế schema `receipts` | API-04 | XS | Done |  | `init.sql` — message_receipts |
| 6 | API-06 | Migration baseline PostgreSQL | API-01..API-05 | M | Done |  | `init.sql` chạy qua compose healthcheck |
| 7 | API-07 | Endpoint request OTP | API-06 | S | Done |  | Email qua SMTP; 503 nếu SMTP chưa cấu hình |
| 8 | API-08 | Endpoint verify OTP | API-07 | S | Done |  | scrypt verify; tạo user + session + token |
| 9 | API-09 | Endpoint login (email/username) | API-08,FE-06,RT-02 | S | Done |  | JWT claims `sub`, `sid`, `deviceId` aligned |
| 10 | API-10 | Endpoint refresh token rotation | API-09,FE-07 | S | Done |  | Rotation + replay revoke-chain |
| 11 | API-11 | Endpoint logout + revoke current session | API-10 | XS | Done |  |  |
| 12 | API-12 | Endpoint logout-all + revoke all sessions | API-11 | XS | Done |  |  |
| 13 | API-13 | Rate limit OTP theo IP/email | API-07 | S | Todo |  |  |
| 14 | API-14 | Rate limit search endpoint | API-09 | XS | Todo |  |  |
| 15 | API-15 | Search theo username prefix | API-09 | S | Todo |  | FE client có; backend endpoint chưa implement |
| 16 | API-16 | Search theo email exact | API-09 | S | Todo |  | FE client có; backend endpoint chưa implement |
| 17 | API-17 | Endpoint create/get direct conversation | API-03,FE-10 | S | Done |  | `POST /conversations/direct` |
| 18 | API-18 | Endpoint list conversations (cursor) | API-17 | S | Done |  | `GET /conversations` — ⚠️ shape bug: trả array thẳng, FE expect `{ conversations: [] }` |
| 19 | API-19 | Internal persist message (idempotent) | API-04,RT-09,FE-13 | M | Done |  | `POST /internal/messages/persist`; dedupe `requestId+senderDeviceId` |
| 20 | API-20 | Endpoint message history (cursor) | API-19 | S | Done |  | `GET /conversations/:id/messages` — ⚠️ shape bug: array thẳng |
| 21 | API-21 | Endpoint mark delivered | API-19,FE-16,RT-12 | XS | Done |  | `POST /messages/:id/delivered` |
| 22 | API-22 | Endpoint mark read | API-19,FE-17,RT-12 | XS | Done |  | `POST /conversations/:id/read` |
| 23 | API-23 | Chuẩn hóa error envelope + error codes | API-09 | S | Done |  | `http.ts` fail/ok helpers; error codes chuẩn |
| 24 | API-24 | Session storage cho refresh token hash | API-10 | S | Done |  | SHA-256 hash, lưu PostgreSQL |
| 25 | API-25 | Reuse detection cho refresh replay | API-24 | S | Done |  | Revoke chain khi `revoked_at` bị dùng lại |
| 26 | API-26 | Health/readiness endpoint | API-06 | XS | Done |  | `GET /health`, `GET /ready` |
| 27 | API-27 | Test OTP expiry/attempt/cooldown | API-07,API-08,FE-05 | S | In Review |  | `api.test.ts` có test cơ bản |
| 28 | API-28 | Test refresh rotation/replay revoke-chain | API-10,API-25,FE-07,SYS-10 | S | In Review |  | `api.test.ts` có test cơ bản |

---

## Bảng công việc chi tiết - Realtime Owner (Lương Thứ)

| STT | Task ID | Task chi tiết | Phụ thuộc | Ước lượng | Trạng thái | Deadline (tự điền) | Ghi chú |
|---:|---|---|---|---|---|---|---|
| 1 | RT-01 | Bootstrap Socket.IO server | Không | S | Done |  | `realtime-service/src/index.ts` |
| 2 | RT-02 | Handshake auth middleware | RT-01,API-09,SYS-03 | S | Done |  | `socket/auth.ts` — JWT + dev token |
| 3 | RT-03 | Mapping `userId-deviceId-socketId` | RT-02 | S | Done |  | `connectionStore.ts` |
| 4 | RT-04 | Room join/leave theo `conversationId` | RT-03,API-17,FE-11 | S | Done |  | `joinConversation` handler |
| 5 | RT-05 | `presence:subscribe` handler | RT-04 | XS | Done |  |  |
| 6 | RT-06 | `presence:update` broadcast | RT-05 | XS | Done |  |  |
| 7 | RT-07 | `chat:send` schema validation | RT-04 | S | Done |  |  |
| 8 | RT-08 | Kiểm tra quyền member conversation | RT-07 | XS | Done |  | HTTP call thật tới API internal (`conversationAccess.ts`) |
| 9 | RT-09 | Gọi API internal persist message | RT-07,API-19 | S | Done |  | `messagePersist.ts` |
| 10 | RT-10 | Emit `system:ack` chuẩn | RT-09 | XS | Done |  |  |
| 11 | RT-11 | Emit `system:error` chuẩn | RT-09 | XS | Done |  |  |
| 12 | RT-12 | `chat:message` fanout | RT-10 | S | Done |  |  |
| 13 | RT-13 | Dedupe theo `requestId + senderDeviceId` | RT-10 | S | Done |  | `dedupeStore.ts` — in-memory TTL |
| 14 | RT-14 | Chặn replay theo `senderDeviceId + conversationId + nonce + keyVersion` | RT-13,API-19,SYS-04 | S | Done |  | `nonceReplayStore.ts` — ⚠️ in-memory, không persist qua restart |
| 15 | RT-15 | `key:exchange:init` routing | RT-04 | S | Done |  | Relay tới peer |
| 16 | RT-16 | `key:exchange:response` routing | RT-15 | XS | Done |  | Relay tới initiator |
| 17 | RT-17 | `key:rotate` routing | RT-16 | S | Done |  | Relay tới peer |
| 18 | RT-18 | Tie-break khi rotate đồng thời | RT-17,SYS-06 | S | Done |  | `keyRotationStore.ts` — lưu proposalId để reject bên thua |
| 19 | RT-19 | `key:rekey_required` routing | RT-17 | XS | Done |  | Relay tới sender |
| 20 | RT-20 | `call:start` + `call:incoming` | RT-04,SYS-07 | S | Done |  | `socket/call.ts` |
| 21 | RT-21 | `call:accept/reject/end` | RT-20 | S | Done |  | `socket/call.ts` |
| 22 | RT-22 | `call:offer/answer/ice` relay | RT-21,FE-25,SYS-19 | M | Done |  | `socket/call.ts` — pure signaling relay |
| 23 | RT-23 | Timeout + cleanup state call | RT-22,SYS-08 | S | Done |  | `callStore.ts` + `startCallCleanupInterval` |
| 24 | RT-24 | Reconnect resubscription flow | RT-03,RT-23,FE-26 | S | Todo |  |  |
| 25 | RT-25 | Heartbeat + stale socket cleanup | RT-24 | S | Todo |  |  |
| 26 | RT-26 | Health endpoint + dependency checks | RT-01 | XS | Done |  | `GET /health` + dependency checks trong `readiness.ts` |
| 27 | RT-27 | Test duplicate send/dedupe/replay block | RT-14 | S | Todo |  |  |
| 28 | RT-28 | Test reconnect during call | RT-24,FE-26,SYS-10 | S | Todo |  |  |

---

## Quy tắc phụ thuộc bắt buộc

- Không bắt đầu task implement nếu contract tương ứng chưa freeze.
- Không chuyển `Done` nếu thiếu test hoặc thiếu cập nhật docs.
- Không demo call nếu TURN chưa sẵn sàng.
- Không release nếu smoke test fail.

---

## Breakdown bổ sung cho task `M/L` (để triển khai không mơ hồ)

- `SYS-21`:
  - Chốt interface lifecycle chung giữa FE-RT-API.
  - Implement xử lý conflict rotate/rekey theo tie-break đã chốt.
  - Viết test integration cho nhánh conflict và nhánh recover.
- `SYS-22`:
  - Dựng kịch bản test happy path chat E2EE + call.
  - Dựng kịch bản failure (network drop, key mismatch, timeout call).
  - Dựng kịch bản recovery (reconnect/resync/rekey).
- `FE-12`:
  - Tạo module encrypt/decrypt thuần.
  - Chuẩn hóa envelope theo `05-e2ee.md`.
  - Viết unit test cho nonce/keyVersion/tag validation.
- `FE-25`:
  - Tách call service khỏi UI component.
  - Implement offer/answer/ICE + timeout handling.
  - Kiểm thử chuyển trạng thái call theo state machine.
- `API-06`:
  - Tạo migration base và rollback script.
  - Seed dữ liệu tối thiểu cho local test.
  - Kiểm thử apply migration trên DB trống và DB có dữ liệu mẫu.
- `API-19`:
  - Thiết kế idempotency key storage.
  - Lưu ciphertext + metadata theo transaction.
  - Trả kết quả idempotent thống nhất cho RT (`new`/`duplicate`).
- `RT-22`:
  - Validate schema cho offer/answer/ice.
  - Relay theo conversation room và đối tượng nhận hợp lệ.
  - Cleanup state khi timeout/hangup để tránh socket leak.

