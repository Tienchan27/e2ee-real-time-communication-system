# 06 - Baseline Bảo Mật

## Mục tiêu

Thiết lập baseline bảo mật đúng và đủ cho hệ thống có triển khai thực tế: định danh, xác thực, bảo vệ dữ liệu, và chống lạm dụng.

## Định danh và ID

- Mọi ID public (`userId`, `conversationId`, `messageId`, `requestId`, `sessionId`, `deviceId`, `callId`, …): **UUID v7** (RFC 9562). Chi tiết: [`00-glossary-and-naming.md`](00-glossary-and-naming.md).
- Request/Event ID: UUID v7 cho traceability và idempotency.

Quy tắc:
- ID phải bất biến sau khi tạo.
- ID không được mã hóa thông tin riêng tư.
- Không dùng integer sequential làm public identifier.

## Thông tin xác thực và mật khẩu

- Password hash algorithm: `scrypt` (Node.js built-in `crypto.scryptSync`, N=16384, r=8, p=1, keyLen=64 bytes). Salt: 16 random bytes. Stored as `scrypt:<salt>:<hash>` (base64url).
- Never store plaintext password.
- Enforce password policy:
  - min 8 chars.
  - at least 1 letter and 1 number.

## JWT và phiên đăng nhập

- Access token lifetime: 15 minutes.
- Refresh token lifetime: 30 ngày (mặc định; cấu hình qua `REFRESH_TOKEN_TTL_SEC`).
- Refresh token rotation: enabled.
- Reuse detection: revoke session chain on replay.
- Refresh token chỉ lưu dưới dạng băm trong kho phiên.
- Source of truth cho session và refresh token hash là PostgreSQL.

Baseline claim:
```txt
sub: string(uuid-v7) [required]
sid: string(uuid-v7) [required]
deviceId: string(uuid-v7) [required]
iat: number [required]
exp: number [required]
```

Issuer: **API Service**. Trên wire, claim phiên là `sid` (không alias `sessionId` trong JWT payload).

## Bảo mật OTP (đăng ký qua email)

- OTP length: 6 digits.
- OTP expiry: 10 minutes (code: `NOW() + INTERVAL '10 minutes'`).
- Max attempts: 5.
- Cooldown resend: 60 seconds.
- OTP gửi qua email bằng SMTP (Nodemailer). SMTP bắt buộc cấu hình đủ 5 biến: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — thiếu → endpoint trả 503.
- OTP code dùng `crypto.randomInt` (CSPRNG). Hash bằng `scrypt` trước khi lưu DB.
- Trong `NODE_ENV=development`, response còn trả thêm `otpCode` để test không cần mailbox thật (chỉ khi email đã gửi thành công).
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

## Socket authentication (handshake-only)

Policy SYS-03 — chi tiết triển khai khớp [`03-events.md`](03-events.md) và Realtime `socket/auth`.

| Quy tắc | Chi tiết |
|---------|----------|
| Thời điểm auth | Chỉ tại Socket.IO handshake; payload event **không** mang token |
| Client field | `socket.handshake.auth.accessToken` (canonical) |
| JWT | HS256; claims `sub`, `sid`, `deviceId`, `exp` — khớp JWT baseline ở trên |
| Server context | `userId` ← `sub`; `deviceId`, `sessionId` ← claims; `senderUserId` server-derived |
| Test-only | `Authorization: Bearer` header — chỉ tooling/script, không dùng production FE |
| Dev token | `dev:<userId>:<deviceId>:<sessionId>` — **chỉ** khi `NODE_ENV !== production` |
| Production | Cấm dev token; thiếu `JWT_ACCESS_SECRET` → từ chối handshake |
| Lỗi | `AUTH_INVALID`, `AUTH_TOKEN_EXPIRED` — không leak chi tiết JWT |

Quy tắc bổ sung:

- `JWT_ACCESS_SECRET` phải **khớp** giữa API Service và Realtime Service.
- Dev bypass `ALLOW_DEV_MESSAGE_PERSIST` chỉ bật local; staging/prod phải tắt. (`ALLOW_DEV_CONVERSATION_ACCESS` đã bị xóa — membership check hiện dùng HTTP thật tới API internal.)
- Không log access token, dev token, hoặc JWT payload trong log thường.

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

### Giới hạn tần suất (Rate Limiting)

Giới hạn tần suất được dùng để chống credential stuffing, brute-force, spam và lạm dụng API.

**Hiện trạng trong `api-service`:**
- Code hiện tại chưa implement middleware rate limiting cho các endpoint HTTP.
- Chưa có Redis-backed sliding window counter hoặc header `Retry-After`.
- Xác minh OTP có giới hạn số lần thử trên từng OTP request: tối đa 5 lần trước khi OTP bị coi là không hợp lệ.
- Endpoint đăng ký trả về `cooldownSec: 60` trong response OTP, nhưng code hiện tại chưa enforce resend cooldown/rate limit ở server.

**Mục tiêu/chính sách chưa implement trong `api-service`:**
- Đăng nhập: 5 lần mỗi 15 phút trên mỗi IP.
- Đăng ký: 3 lần mỗi giờ trên mỗi IP.
- Xác minh OTP: 5 lần mỗi 10 phút trên mỗi email.
- Gửi lại OTP: 1 lần mỗi 60 giây trên mỗi email.
- Yêu cầu đặt lại mật khẩu: 3 lần mỗi giờ trên mỗi email.
- Tìm kiếm người dùng: 30 yêu cầu mỗi phút trên mỗi người dùng.
- Gửi tin nhắn: 100 tin nhắn mỗi phút trên mỗi người dùng.
- Danh sách cuộc trò chuyện: 50 yêu cầu mỗi phút trên mỗi người dùng.
- Số lượng kết nối đồng thời tối đa trên mỗi người dùng: 5 thiết bị.
- Điều chế nỗ lực kết nối: 10 lần mỗi phút trên mỗi IP.
- Điều chế sự kiện tin nhắn: 100 lần mỗi phút trên mỗi kết nối.
- Redis-backed sliding window counter (SlidingWindowRateLimiter).
- Tự động xóa TTL sau khi window hết hạn.
- Trả về `429 Too Many Requests` với header `Retry-After`.
- Ghi lại vi phạm giới hạn tần suất để giám sát.

### Mã hóa mật khẩu (Password Hashing)

**Thuật toán: Scrypt (không phải bcrypt)**

Code hiện tại dùng `crypto.scryptSync()` trong `api-service/src/security.ts`; không dùng bcrypt.

Lý do chọn scrypt thay bcrypt theo thiết kế:
- Scrypt: chi phí bộ nhớ cao (N=16384), chống tấn công GPU/ASIC hiệu quả hơn.
- Bcrypt: không được sử dụng trong code hiện tại.

**Cấu hình:**
- Thuật toán: `scrypt`
- N: 16384 (mặc định của Node.js `scryptSync`)
- r: 8 (mặc định của Node.js `scryptSync`)
- p: 1 (mặc định của Node.js `scryptSync`)
- keyLen: 64 bytes
- Salt: 16 bytes ngẫu nhiên (`crypto.randomBytes(16)`)
- Định dạng lưu trữ: `scrypt:<base64url-salt>:<base64url-hash>`
- So sánh hash bằng `timingSafeEqual` sau khi kiểm tra độ dài buffer.

**Chính sách mật khẩu:**
- Tối thiểu 8 ký tự.
- Code hiện tại chưa enforce yêu cầu ít nhất 1 chữ cái VÀ 1 chữ số.
- Code hiện tại chưa kiểm tra từ điển/common password ở server.
- Không lưu mật khẩu plaintext: khi request OTP đăng ký, mật khẩu được băm ngay trước khi lưu vào bảng `otp_requests`; khi verify OTP thành công, hash được chuyển sang bảng `users`.

### Điều chế kết nối Socket

Code hiện tại trong `api-service` không triển khai websocket/socket server.

**Mục tiêu/chính sách chưa implement trong `api-service`:**
- Mỗi IP: tối đa 10 nỗ lực kết nối mỗi phút.
- Mỗi thiết bị/người dùng: tối đa 5 kết nối websocket hoạt động.
- Timeout handshake: 10 giây.
- Trả về lỗi `AUTH_RATE_LIMITED` nếu vượt quá giới hạn.

### Chống spam trong chat

**Hiện trạng trong `api-service`:**
- Endpoint internal `/api/v1/internal/messages/persist` xác thực envelope tin nhắn mã hóa: UUID, `ciphertext`, `nonce`, `algorithm = aes-256-gcm`, `keyVersion >= 1`, `clientMessageSeq >= 0`.
- Chống ghi trùng tin nhắn bằng `request_id` + `sender_device_id` và xử lý duplicate idempotent.
- Code hiện tại chưa có rate limit 100 tin nhắn/phút theo người dùng hoặc kết nối.
- Code hiện tại chưa kiểm tra ký tự lặp lại (>10 lần lặp).
- Code hiện tại chưa giới hạn độ dài ciphertext/tin nhắn 10,000 ký tự ở `api-service`.

## Xác thực đầu vào và Chống tiêm nhiễm

### Bảo vệ đầu vào không đúng định dạng

**Phân tích JSON:**
- `api-service` dùng `express.json({ limit: "1mb" })`.
- Kích thước body JSON tối đa hiện được hard-code là `1mb`; code hiện tại chưa cấu hình qua `MAX_BODY_SIZE`.
- JSON malformed bị Express JSON parser từ chối trước khi vào route.
- Code hiện tại chưa có schema JSON tập trung/nghiêm ngặt cho tất cả body yêu cầu.
- Code hiện tại chưa có request timeout 30 giây ở tầng Express app.

**Middleware Bảo vệ Đầu vào:**
- Code hiện tại chưa có middleware bảo vệ đầu vào tập trung.
- Validation đang được thực hiện thủ công trong từng route bằng `typeof`, regex, `isUuid()`, `isIsoDate()` và `parseLimit()`.
- Một số trường chuỗi được trim/normalize: email, username, identifier, displayName và query tìm kiếm.
- Extra fields trong JSON body hiện bị bỏ qua bởi route, chưa bị từ chối theo whitelist.
- Code hiện tại chưa có kiểm tra byte null/ký tự điều khiển tập trung.

### Chống tiêm nhiễm SQL

**Phương pháp: Truy vấn tham số hóa (prepared statements)**
- Các truy vấn trong `api-service` dùng thư viện `pg` với placeholder `$1, $2, ...` cho dữ liệu từ người dùng.
- Các đoạn SQL động hiện có (`ORDER BY`, comparator) được chọn từ logic server sau khi validate cursor, không lấy trực tiếp từ input.
- UUID được validate bằng regex chấp nhận UUID version 1-8; code hiện tại chưa giới hạn riêng RFC 9562 v7 cho mọi input.
- Integer/query limit được kiểm tra phạm vi bằng `parseLimit()`.
- Email đăng ký/login dùng regex đơn giản `^[^\s@]+@[^\s@]+\.[^\s@]+$`; code hiện tại chưa enforce RFC 5322 đầy đủ hoặc tối đa 254 ký tự.
- Một số string có giới hạn độ dài theo route, ví dụ `username` 3-50 ký tự và query tìm kiếm tối đa 100 ký tự; code hiện tại chưa có giới hạn độ dài thống nhất cho mọi string.

### Chống XSS (Frontend)

Phần này thuộc frontend; trong `api-service` chỉ thấy API trả JSON và sử dụng `helmet()` cho HTTP security headers.

**Mục tiêu/chính sách chưa implement trong `api-service`:**
- Không có xử lý React JSX trong `api-service`.
- Không có `dangerouslySetInnerHTML` trong `api-service`.
- Code hiện tại chưa escape ký tự đặc biệt tập trung cho các trường nhập liệu.
- `displayName` chỉ được trim và yêu cầu không rỗng khi đăng ký; code hiện tại chưa giới hạn tối đa 100 ký tự hoặc whitelist ký tự.

### Bảo vệ CSRF

- `api-service` xác thực API bằng Bearer access token trong header `Authorization`.
- Code hiện tại không set cookie phiên đăng nhập và không phục vụ biểu mẫu HTML.
- CORS được cấu hình bằng `config.corsOrigins` và `credentials: true`.
- Code hiện tại chưa implement CSRF token.
- Code hiện tại chưa set cookie `SameSite=Strict` vì không dùng cookie auth trong `api-service`.

### Chống tiêm nhiễm Email

- Email đăng ký được `trim().toLowerCase()` và validate bằng regex không cho whitespace: `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
- Regex hiện tại loại newline/tab vì chúng thuộc `\s`.
- Email người dùng được truyền vào trường `to` của `nodemailer.sendMail()`.
- `from` lấy từ cấu hình SMTP, `subject` là hằng số, nội dung email chỉ chứa OTP do server sinh.
- Code hiện tại chưa enforce local-part chỉ alphanumeric/dấu chấm/gạch ngang.
- Code hiện tại chưa enforce độ dài email tối đa 254 ký tự.

### Chống tiêm nhiễm Header

- `api-service` đọc header `Authorization` cho Bearer token và internal token.
- Code hiện tại chưa có middleware whitelist header từ client.
- Code hiện tại chưa tự kiểm tra `\n`/`\r` trong giá trị header.
- Code hiện tại chưa ghi log riêng cho nỗ lực tiêm nhiễm header.

### Chống tiêm nhiễm Command

- Không tìm thấy việc sử dụng `child_process.exec()`, `execFile()` hoặc `spawn()` trong `api-service/src`.
- Script Docker entrypoint chỉ chạy `node scripts/migrate.js` rồi `node dist/index.js`, không nhận input từ người dùng.
- Nếu sau này cần chạy quy trình bên ngoài, ưu tiên `child_process.execFile()` + mảng đối số và không truyền trực tiếp đầu vào người dùng làm đối số lệnh.

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

