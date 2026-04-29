# 03 - Hợp Đồng Sự Kiện Realtime

## Mục tiêu

Tài liệu này định nghĩa toàn bộ sự kiện Socket.IO để frontend, realtime và API triển khai thống nhất, không lệch hợp đồng.

## Quy tắc toàn cục

- Quy ước tên: `domain:action` (ví dụ `chat:send`).
- Mọi event do client khởi tạo bắt buộc có:
  - `requestId: string(uuid)`
  - `timestamp: string(iso8601)`
- Xác thực socket chỉ thực hiện tại handshake:
  - Client phải gửi access token ở bước handshake.
  - Event payload không mang `authToken` lặp lại cho mỗi event.
- Mọi phản hồi từ server phải là một trong hai:
  - `system:ack`
  - `system:error`

## Quy tắc bắt buộc theo phạm vi sự kiện

- Các event thuộc nhóm `chat:*`, `call:*`, `key:*` bắt buộc có `conversationId`.
- Event thuộc nhóm `presence:*` không yêu cầu `conversationId`.
- Realtime phải từ chối event với lỗi `PERMISSION_DENIED` nếu `senderUserId` không thuộc conversation mục tiêu.
- `senderUserId` phải được lấy từ phiên đã xác thực ở handshake.
- Nếu client gửi `senderUserId` trong payload, server phải bỏ qua và dùng giá trị từ auth context.

## Envelope chung

```txt
requestId: string(uuid) [required]
eventVersion: number [required]
senderUserId: string(uuid) [required, server-derived-from-auth-context]
senderDeviceId: string(uuid) [required]
timestamp: string(iso8601) [required]
payload: object [required]
```

Lưu ý triển khai:
- Client chỉ gửi payload nghiệp vụ + `requestId` + `timestamp`.
- `senderUserId` và `senderDeviceId` là trường chuẩn hóa do Realtime gắn từ auth context handshake trước khi xử lý quyền hoặc persist.
- Client không được quyền override các trường này.

## Envelope Ack/Error

### system:ack

```txt
requestId: string(uuid) [required]
status: string [required, fixed="ok"]
serverEventId: string(uuid) [required]
serverTimestamp: string(iso8601) [required]
meta: object [optional]
```

### system:error

```txt
requestId: string(uuid) [required]
status: string [required, fixed="error"]
errorCode: string [required]
errorMessage: string [required]
retryable: boolean [required]
details: object [optional]
```

## Nhóm sự kiện `presence`

### presence:subscribe
- Bên gửi: Client
- Bên nhận: Realtime
- Mục đích: đăng ký nhận trạng thái online/offline.

Payload:
```txt
targets: array<string(uuid)> [required]
```

### presence:update
- Bên gửi: Realtime
- Bên nhận: Clients
- Mục đích: đẩy cập nhật online/offline/lastSeen.

Payload:
```txt
userId: string(uuid) [required]
status: string [required, online|offline|away]
lastSeenAt: string(iso8601) [optional]
```

## Nhóm sự kiện `chat`

### chat:send
- Bên gửi: Client
- Bên nhận: Realtime
- Mục đích: gửi tin nhắn đã mã hóa để lưu và chuyển tiếp.

Payload:
```txt
messageId: string(uuid) [required]
ciphertext: string(base64) [required]
nonce: string(base64) [required]
algorithm: string [required, aes-256-gcm]
keyVersion: number [required]
aad: object [optional]
clientMessageSeq: number [required]
```

Hành vi khi thành công:
- Realtime gọi API nội bộ để persist.
- Nếu lưu thành công, realtime gửi `system:ack` cho người gửi rồi phát `chat:message` cho người nhận.

### chat:message
- Bên gửi: Realtime
- Bên nhận: các thành viên trong conversation
- Mục đích: chuyển tiếp ciphertext envelope.

Payload:
```txt
messageId: string(uuid) [required]
conversationId: string(uuid) [required]
senderUserId: string(uuid) [required]
senderDeviceId: string(uuid) [required]
ciphertext: string(base64) [required]
nonce: string(base64) [required]
algorithm: string [required]
keyVersion: number [required]
createdAt: string(iso8601) [required]
```

### chat:delivered
- Bên gửi: Client
- Bên nhận: Realtime -> API -> Participants
- Mục đích: đánh dấu đã nhận.

Payload:
```txt
messageId: string(uuid) [required]
deliveredAt: string(iso8601) [required]
```

### chat:read
- Bên gửi: Client
- Bên nhận: Realtime -> API -> Participants
- Mục đích: đánh dấu đã đọc.

Payload:
```txt
conversationId: string(uuid) [required]
lastReadMessageId: string(uuid) [required]
readAt: string(iso8601) [required]
```

## Nhóm sự kiện `key`

### key:exchange:init

Payload:
```txt
conversationId: string(uuid) [required]
curve: string [required, x25519|p256]
publicKey: string(base64) [required]
sessionProposalId: string(uuid) [required]
```

### key:exchange:response

Payload:
```txt
conversationId: string(uuid) [required]
sessionProposalId: string(uuid) [required]
publicKey: string(base64) [required]
accepted: boolean [required]
```

### key:rotate

Payload:
```txt
conversationId: string(uuid) [required]
newKeyVersion: number [required]
reason: string [required, message_count|time_window|manual]
senderEphemeralPublicKey: string(base64) [required]
```

### key:rekey_required

Payload:
```txt
conversationId: string(uuid) [required]
expectedKeyVersion: number [required]
receivedKeyVersion: number [required]
reason: string [required]
```

## Nhóm sự kiện `call`

### call:start

Payload:
```txt
callId: string(uuid) [required]
conversationId: string(uuid) [required]
callType: string [required, voice|video]
```

### call:incoming

Payload:
```txt
callId: string(uuid) [required]
conversationId: string(uuid) [required]
callerUserId: string(uuid) [required]
callType: string [required]
expiresAt: string(iso8601) [required]
```

### call:accept / call:reject / call:end

Payload:
```txt
callId: string(uuid) [required]
conversationId: string(uuid) [required]
reason: string [optional]
```

### call:offer / call:answer

Payload:
```txt
callId: string(uuid) [required]
sdp: string [required]
sdpType: string [required, offer|answer]
```

### call:ice

Payload:
```txt
callId: string(uuid) [required]
candidate: object [required]
```

## Idempotency và retry

- `requestId + senderDeviceId + conversationId` được dùng làm khóa dedupe cho event từ client.
- Realtime phải trả cùng kết quả `system:ack` cho yêu cầu trùng trong cửa sổ dedupe.
- Với `chat:send`, hệ thống phải từ chối replay nếu trùng cặp `senderDeviceId + conversationId + nonce` trong cùng `keyVersion`.
- Chính sách retry phía client:
  - exponential backoff: 500ms, 1s, 2s, 4s, stop at 5 attempts.
  - stop retry when `retryable=false`.

## Quy tắc xử lý xung đột xoay khóa

- Nếu cả hai bên cùng phát `key:rotate`, chọn bản ghi có:
  1. `newKeyVersion` lớn hơn.
  2. Nếu bằng nhau, ưu tiên `senderUserId` có giá trị UUID nhỏ hơn theo thứ tự từ điển.
- Bên bị loại phải đồng bộ lại khóa và gửi `system:ack` cho rotate được chấp nhận.

## Mã lỗi tối thiểu

- `AUTH_INVALID`
- `PERMISSION_DENIED`
- `CONVERSATION_NOT_FOUND`
- `RATE_LIMITED`
- `MESSAGE_PERSIST_FAILED`
- `KEY_VERSION_MISMATCH`
- `CALL_STATE_CONFLICT`
- `INTERNAL_ERROR`

## Trách nhiệm

- Phụ trách Realtime: triển khai transport và event routing.
- Phụ trách API: triển khai tác vụ lưu trạng thái message/receipt.
- Phụ trách FE: triển khai handler sự kiện và retry phía client.
- System Owner: kiểm tra tương thích hợp đồng và chốt version.

