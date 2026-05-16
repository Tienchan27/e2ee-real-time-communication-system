# 02 - Hợp Đồng REST API

## Mục tiêu

Tài liệu này mô tả hợp đồng API thống nhất cho xác thực, tìm người dùng, quản lý cuộc trò chuyện và truy vấn lịch sử tin nhắn.

## Quy ước chung

- Base URL: `/api/v1`
- Xác thực: `Authorization: Bearer <access_token>`
- Kiểu dữ liệu: `application/json`
- ID chuẩn: UUID
- Thời gian: ISO 8601 UTC

## Chuẩn response

### Thành công

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

### Lỗi

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mo ta loi",
    "requestId": "uuid"
  }
}
```

## Xác thực và OTP

### POST `/auth/register/request-otp`

Mục đích: yêu cầu OTP đăng ký qua email.

Request:
```txt
email: string(email) [required]
username: string [required]
password: string [required]
displayName: string [required]
```

Response:
```txt
otpRequestId: string(uuid)
expiresInSec: number
cooldownSec: number
```

Quy tắc:
- Giới hạn tần suất theo IP và theo email.
- Không để lộ email đã tồn tại hay chưa trong thông báo phản hồi.

### POST `/auth/register/verify-otp`

Request:
```txt
otpRequestId: string(uuid) [required]
otpCode: string(6 digits) [required]
```

Response:
```txt
userId: string(uuid)
accessToken: string
refreshToken: string
```

### POST `/auth/login`

Request:
```txt
identifier: string [required, email hoặc username]
password: string [required]
deviceInfo: object [required]
```

Response:
```txt
user: object [required]
accessToken: string [required]
refreshToken: string [required]
expiresInSec: number [required]
```

### POST `/auth/refresh`

Request:
```txt
refreshToken: string [required]
```

Response:
```txt
accessToken: string [required]
refreshToken: string [required, có xoay vòng]
refreshTokenId: string(uuid) [required]
expiresInSec: number [required]
```

### POST `/auth/logout`

Request:
```txt
refreshToken: string [required]
```

Response:
```txt
revoked: boolean [required]
```

### POST `/auth/logout-all`

Mục đích: thu hồi toàn bộ phiên của người dùng hiện tại.

Response:
```txt
revokedSessionCount: number [required]
```

## Tìm người dùng

### GET `/users/search?q=<query>&limit=<n>&cursor=<cursor>`

Hành vi:
- Nếu query bắt đầu bằng `@`, tìm theo tiền tố username.
- Nếu query có định dạng email, chỉ tìm chính xác theo email.

Response item:
```txt
userId: string(uuid) [required]
username: string [required]
displayName: string [required]
avatarUrl: string [optional]
```

Quy tắc riêng tư:
- Không trả email thô trong kết quả tìm kiếm công khai.
- Endpoint tìm kiếm bắt buộc có rate limit.

## Cuộc trò chuyện

### POST `/conversations/direct`

Tạo mới hoặc lấy lại cuộc trò chuyện trực tiếp đã tồn tại.

Request:
```txt
peerUserId: string(uuid) [required]
```

Response:
```txt
conversationId: string(uuid) [required]
type: string [required, DIRECT]
members: array<object> [required]
```

### GET `/conversations`

Lấy danh sách cuộc trò chuyện có phân trang.

Query:
```txt
limit: number [optional]
cursor: string [optional]
```

Response item:
```txt
conversationId: string(uuid) [required]
type: string [required]
lastMessagePreview: object [optional]
unreadCount: number [required]
updatedAt: string(iso8601) [required]
```

## Tin nhắn

### GET `/conversations/{conversationId}/messages`

Request query:
```txt
limit: number [optional]
afterMessageId: string(uuid) [optional]
beforeMessageId: string(uuid) [optional]
```

Response item:
```txt
messageId: string(uuid) [required]
conversationId: string(uuid) [required]
senderUserId: string(uuid) [required]
ciphertext: string(base64) [required]
nonce: string(base64) [required]
algorithm: string [required]
keyVersion: number [required]
createdAt: string(iso8601) [required]
```

### POST `/internal/messages/persist` (chỉ dùng nội bộ)

Dùng cho realtime service gọi API để lưu dữ liệu.

Request:
```txt
requestId: string(uuid) [required]
messageId: string(uuid) [required]
conversationId: string(uuid) [required]
senderUserId: string(uuid) [required]
senderDeviceId: string(uuid) [required]
envelope: object [required]
```

Response:
```txt
stored: boolean [required]
createdAt: string(iso8601) [required]
deduped: boolean [required]
```

Quy tắc bảo mật nội bộ:
- Endpoint này chỉ chấp nhận gọi từ Realtime service đã xác thực service-to-service.
- `senderUserId` và `senderDeviceId` phải là giá trị Realtime suy ra từ auth context handshake, không lấy trực tiếp từ client payload.

## Trạng thái nhận và đọc

### POST `/messages/{messageId}/delivered`

Request:
```txt
deliveredAt: string(iso8601) [required]
```

### POST `/conversations/{conversationId}/read`

Request:
```txt
lastReadMessageId: string(uuid) [required]
readAt: string(iso8601) [required]
```

## Mã lỗi chuẩn

- `VALIDATION_FAILED`
- `AUTH_INVALID_CREDENTIALS`
- `AUTH_TOKEN_EXPIRED`
- `AUTH_REFRESH_REVOKED`
- `AUTH_REFRESH_REPLAY_DETECTED`
- `AUTH_SESSION_REVOKED`
- `OTP_INVALID`
- `OTP_EXPIRED`
- `OTP_RATE_LIMITED`
- `USER_NOT_FOUND`
- `CONVERSATION_NOT_FOUND`
- `PERMISSION_DENIED`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

## Quy tắc idempotency

- Hỗ trợ header `Idempotency-Key` cho endpoint ghi dữ liệu.
- Endpoint persist nội bộ dùng khóa dedupe:
  - `requestId + senderDeviceId`.

## Yêu cầu quản lý phiên và refresh token

- Mỗi lần login phải tạo một `sessionId` riêng.
- Refresh token phải lưu dưới dạng băm trong kho phiên (không lưu plaintext).
- Khi gọi `/auth/refresh`:
  - token cũ bị thu hồi ngay sau khi cấp token mới;
  - nếu token cũ bị dùng lại, hệ thống trả `AUTH_REFRESH_REPLAY_DETECTED` và thu hồi cả chuỗi phiên liên quan.
- `/auth/logout` thu hồi phiên hiện tại.
- `/auth/logout-all` thu hồi toàn bộ phiên của user.

## Chính sách Redis cho auth/OTP (v1)

- Nguồn dữ liệu chuẩn (source of truth) cho OTP, session, refresh token hash là PostgreSQL.
- Redis không dùng làm storage chính cho OTP/session ở v1.
- Redis chỉ dùng cho:
  - counter rate limit theo IP/email;
  - cache TTL ngắn để giảm tải truy vấn lặp;
  - dữ liệu tạm có thể tái dựng từ PostgreSQL khi Redis mất dữ liệu.

## Trách nhiệm

- API Owner phải giữ tương thích khi thay đổi version.
- Realtime Owner chỉ dùng endpoint nội bộ đã được công bố.
- FE Owner phải xử lý đầy đủ các mã lỗi chuẩn.
- System Owner duyệt mọi thay đổi breaking change.

