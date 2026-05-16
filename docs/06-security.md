# 06 - Baseline Bảo Mật

## Mục tiêu

Thiết lập baseline bảo mật đúng và đủ cho hệ thống có triển khai thực tế: định danh, xác thực, bảo vệ dữ liệu, và chống lạm dụng.

## Định danh và ID

- User ID: UUID v7 preferred (or v4 fallback).
- Conversation ID: UUID.
- Message ID: UUID.
- Request/Event ID: UUID for traceability and idempotency.

Quy tắc:
- ID phải bất biến sau khi tạo.
- ID không được mã hóa thông tin riêng tư.

## Thông tin xác thực và mật khẩu

- Password hash algorithm:
  - Primary: `Argon2id`.
  - Fallback: `bcrypt` cost >= 12 if Argon2 not available.
- Never store plaintext password.
- Enforce password policy:
  - min 8 chars.
  - at least 1 letter and 1 number.

## JWT và phiên đăng nhập

- Access token lifetime: 15 minutes.
- Refresh token lifetime: 7 days.
- Refresh token rotation: enabled.
- Reuse detection: revoke session chain on replay.
- Refresh token chỉ lưu dưới dạng băm trong kho phiên.
- Source of truth cho session và refresh token hash là PostgreSQL.

Baseline claim:
```txt
sub: string(uuid) [required]
sid: string(uuid) [required]
deviceId: string(uuid) [required]
iat: number [required]
exp: number [required]
```

## Bảo mật OTP (đăng ký qua email)

- OTP length: 6 digits.
- OTP expiry: 5 minutes.
- Max attempts: 5.
- Cooldown resend: 60 seconds.
- Per email rate limit and per IP rate limit required.
- Source of truth cho OTP records là PostgreSQL.

## Redis policy (v1)

- Redis không là nguồn dữ liệu chuẩn cho OTP/session/token ở v1.
- Redis chỉ dùng cho dữ liệu tạm:
  - rate-limit counters;
  - cache TTL ngắn;
  - realtime pub/sub adapter khi scale.
- Nếu Redis bị mất dữ liệu, hệ thống vẫn khôi phục được trạng thái nghiệp vụ chính từ PostgreSQL.

## Quyền riêng tư khi tìm người dùng

- Public search trả về:
  - `username`, `displayName`, `avatarUrl`.
- Public search không được trả email raw.
- Exact email search may be allowed but response remains masked/minimal.

## Bảo mật đường truyền

- Chỉ dùng HTTPS ở môi trường không phải local.
- Secure websocket (`wss`) in non-local environments.
- CORS allowlist for known frontend origins.
- Internal API giữa Realtime và API phải có xác thực service-to-service (ví dụ: mTLS hoặc service token xoay vòng).

## Logging và secrets

- Bắt buộc che:
  - email local-part.
  - tokens.
  - OTP.
- Không được log:
  - message plaintext.
  - derived symmetric keys.
  - raw password.

## Chính sách lưu trữ và hủy dữ liệu

- OTP records:
  - giữ tối đa 7 ngày để audit, sau đó xóa mềm hoặc xóa cứng theo chính sách vận hành.
- Session/revocation records:
  - giữ tối thiểu bằng thời gian sống refresh token + 7 ngày.
- Message ciphertext:
  - giữ theo yêu cầu sản phẩm; không tự động xóa ở v1 nếu chưa có policy nghiệp vụ.
- Security logs:
  - giữ tối thiểu 30 ngày.

## Chống lạm dụng

- Rate-limit auth and search endpoints.
- Socket connection throttling per IP/device.
- Basic anti-spam for chat send burst.

## Mô hình đe dọa mức cơ bản

- Đã bao phủ:
  - credential stuffing mitigation basics.
  - token replay via rotation and revoke.
  - transit interception via TLS.
  - accidental sensitive logs.
- Chưa bao phủ đầy đủ:
  - nation-state active attacks.
  - device compromise.
  - full metadata protection.

## Checklist nghiệm thu bảo mật

- Auth endpoints have rate limit.
- Password hashes validated against policy.
- Token rotation test passes.
- OTP expiry/attempt lock tests pass.
- Không lộ plaintext trong log ở flow bình thường.

## Trách nhiệm

- Phụ trách API: kiểm soát auth, OTP, token.
- Phụ trách Realtime: xác thực socket và giới hạn tần suất.
- Phụ trách FE: xử lý token an toàn phía client.
- System Owner: duyệt cổng bảo mật trước phát hành.

