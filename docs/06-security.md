# 06 - Baseline Bảo Mật

## Mục tiêu

Thiết lập baseline bảo mật đúng và đủ cho hệ thống có triển khai thực tế: định danh, xác thực, bảo vệ dữ liệu, và chống lạm dụng.

## Định danh và ID

- User ID: UUID v7 preferred (or v4 fallback).
- Conversation ID: UUID.
- Message ID: UUID.
- Request/Event ID: UUID for traceability and idempotency.

Rules:
- IDs must be immutable.
- IDs must not encode private information.

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

Claims baseline:
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

## Quyền riêng tư khi tìm người dùng

- Public search returns:
  - `username`, `displayName`, `avatarUrl`.
- Public search MUST NOT return raw email.
- Exact email search may be allowed but response remains masked/minimal.

## Bảo mật đường truyền

- HTTPS only in non-local environments.
- Secure websocket (`wss`) in non-local environments.
- CORS allowlist for known frontend origins.

## Logging và secrets

- MUST mask:
  - email local-part.
  - tokens.
  - OTP.
- MUST NOT log:
  - message plaintext.
  - derived symmetric keys.
  - raw password.

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
- No plaintext leaked in logs in normal flows.

## Trách nhiệm

- Phụ trách API: kiểm soát auth, OTP, token.
- Phụ trách Realtime: xác thực socket và giới hạn tần suất.
- Phụ trách FE: xử lý token an toàn phía client.
- System Owner: duyệt cổng bảo mật trước phát hành.

