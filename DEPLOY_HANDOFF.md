# Handoff — E2EE Realtime Communication System

> File bàn giao để tiếp tục trên thiết bị/chat khác. Gồm: (A) trạng thái dự án, (B) hướng dẫn deploy EC2 chi tiết.

---

## A. Trạng thái dự án (tính đến lần làm gần nhất)

**Kiến trúc**: monorepo Docker Compose — `frontend` (React+Vite, E2EE bằng WebCrypto), `api-service` (Express+Postgres, REST + persist tin mã hoá), `realtime-service` (Socket.IO: chat/presence/key-exchange/call signaling), `coturn` (TURN cho WebRTC), `gateway` (nginx + TLS). E2EE kiểu **g-lite v1** (ECDH P-256 + HKDF, AES-256-GCM) với fallback **socket key exchange**.

**Đã sửa trong các phiên gần đây (đều build xanh: FE `tsc -b && vite build`, api/realtime `tsc`):**
- Sửa giải mã chập chờn: `ensureKeyFromGliteHistory` ưu tiên khóa hiện có + trial-decrypt trước khi derive (không phá khóa đúng của người gửi).
- Heartbeat: server `socket.conn.on("packet")` giữ socket idle khỏi bị ngắt; FE trả `heartbeat:pong`.
- **Đã TẮT key rotation** + dọn sạch dead code (xoá `keyRotationStore.ts`, `RotateAad`, `deriveRotatedKey`, `pruneKeyVersions`...). Mọi tin dùng keyVersion=1.
- Token refresh chủ động ~60s trước hạn + `updateAuthToken` cho auto-reconnect.
- **Outbox bền vững**: tin chờ persist localStorage (`chat/outbox.ts`), tự gửi nền khi peer online (`processOutbox` + `onConnect`).
- Read receipts thật (handler `chat:delivered`/`chat:read` → `message:receipt`, hydrate qua `GET /messages`).
- UI: composer không khóa khi đang thiết lập mã hoá; banner "Đang kết nối lại…"; tin lỗi bấm gửi lại; tab title "E2EE Chat" + đếm unread; bold hội thoại chưa đọc; fix avatar lệch; chuông cuộc gọi (Web Audio); video call fullscreen + PiP; nút gọi nổi bật.

**Còn lại / lưu ý cho phiên sau:**
- **Chưa commit** — toàn bộ thay đổi đang ở working tree trên branch `main` (quy ước: KHÔNG tự commit/push, KHÔNG thêm AI attribution; user tự commit).
- Cần **test E2E** (2 trình duyệt): nhắn + reload nhiều lần; idle 2-3 phút không đứt; gọi voice/video; OTP email.
- Code phần lớn do Codex/Cursor sinh → khi sửa cần đọc kỹ.
- Tắt rotation = chấp nhận mất forward-secrecy (ưu tiên độ tin cậy cho demo 1-1).

**Hạ tầng deploy có sẵn**: `scripts/deploy-ec2.sh` (idempotent), `compose.prod.yaml`, `infra/nginx/nginx.ssl.conf.template`, `infra/coturn/turnserver.conf.template`, các `*.env.example`.

---

## B. Hướng dẫn deploy EC2 (chi tiết)

**Instance đang chạy**: t3.micro (2 vCPU, **1 GiB RAM** → cần swap), Ubuntu 26.04, **Elastic IP `32.195.254.142`**, region `us-east-1`. DNS: domain free ở **Mắt Bão**.

> ⚠️ Bắt buộc HTTPS: app dùng `crypto.subtle` (E2EE) + `getUserMedia` (gọi) → chỉ chạy trong secure context. Phải có domain + TLS, không dùng IP trần/http.

### Bước 1 — DNS ở Mắt Bão
Thêm **A record**: host `chat` (hoặc `@`) → `32.195.254.142`, TTL 300. Kiểm tra: `nslookup chat.<domain-cua-ban>` phải ra đúng IP **trước khi** chạy script (certbot cần domain resolve đúng).

### Bước 2 — Security Group (inbound)
| Type | Proto | Port | Source |
|---|---|---|---|
| SSH | TCP | 22 | My IP |
| HTTP | TCP | 80 | 0.0.0.0/0 |
| HTTPS | TCP | 443 | 0.0.0.0/0 |
| Custom | TCP | 3478 | 0.0.0.0/0 |
| Custom | UDP | 3478 | 0.0.0.0/0 |
| Custom | UDP | 49152–49200 | 0.0.0.0/0 |

(Thiếu 3478/49152-49200 → gọi qua mạng khác nhau không kết nối.)

### Bước 3 — SSH & lấy code
```bash
ssh -i <key>.pem ubuntu@32.195.254.142
sudo apt-get update -y && sudo apt-get install -y git
git clone <URL-repo> e2ee && cd e2ee
```

### Bước 4 — Tạo file cấu hình
Sinh secret: `openssl rand -hex 32` (x4: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, API_INTERNAL_TOKEN, POSTGRES_PASSWORD), `openssl rand -hex 24` (TURN_PASS).

**`.env.prod`** (gốc):
```
BUILD_TARGET=runtime
NGINX_CONF=nginx.ssl.conf
POSTGRES_DB=e2ee_app
POSTGRES_USER=e2ee_user
POSTGRES_PASSWORD=<POSTGRES_PASSWORD>
```
> ⚠️ `BUILD_TARGET=runtime` (KHÔNG phải `production` — Dockerfile chỉ có stage `development`/`runtime`).

**`api-service/.env`**:
```
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL=postgresql://e2ee_user:<POSTGRES_PASSWORD>@postgres:5432/e2ee_app
JWT_ACCESS_SECRET=<JWT_ACCESS_SECRET>
JWT_REFRESH_SECRET=<JWT_REFRESH_SECRET>
API_INTERNAL_TOKEN=<API_INTERNAL_TOKEN>
REALTIME_INTERNAL_BASE_URL=http://realtime-service:4000
CORS_ALLOWED_ORIGINS=https://chat.<domain-cua-ban>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<gmail>@gmail.com
SMTP_PASS=<google-app-password>
SMTP_FROM=<gmail>@gmail.com
```

**`realtime-service/.env`**:
```
PORT=4000
NODE_ENV=production
LOG_LEVEL=info
CLIENT_URL=https://chat.<domain-cua-ban>
SOCKET_CORS_ORIGINS=https://chat.<domain-cua-ban>
API_INTERNAL_BASE_URL=http://api-service:3000
API_INTERNAL_TOKEN=<API_INTERNAL_TOKEN>
JWT_ACCESS_SECRET=<JWT_ACCESS_SECRET>
ALLOW_DEV_MESSAGE_PERSIST=false
CALL_INVITE_TIMEOUT_MS=30000
STALE_CLEANUP_INTERVAL_MS=15000
SOCKET_PING_INTERVAL_MS=25000
SOCKET_PING_TIMEOUT_MS=20000
```

**`frontend/.env`** (VITE nướng lúc build → phải có trước khi build):
```
VITE_API_BASE_URL=/api/v1
VITE_SOCKET_BASE_URL=
VITE_STUN_SERVERS=stun:stun.l.google.com:19302
VITE_TURN_URL=turn:chat.<domain-cua-ban>:3478
VITE_TURN_USERNAME=turnuser
VITE_TURN_CREDENTIAL=<TURN_PASS>
```

**`scripts/deploy.env`**:
```
DOMAIN=chat.<domain-cua-ban>
CERTBOT_EMAIL=<email>
PUBLIC_IP=
TURN_USER=turnuser
TURN_PASS=<TURN_PASS>
```

**Bảng phải KHỚP nhau:**
- `POSTGRES_PASSWORD`: `.env.prod` ⇔ `DATABASE_URL` (api)
- `API_INTERNAL_TOKEN`: api ⇔ realtime
- `JWT_ACCESS_SECRET`: api ⇔ realtime
- TURN user/pass: `frontend/.env` ⇔ `scripts/deploy.env`
- `https://chat.<domain>`: api `CORS_ALLOWED_ORIGINS`, realtime `SOCKET_CORS_ORIGINS`/`CLIENT_URL`

### Bước 5 — Chạy script
```bash
chmod +x scripts/deploy-ec2.sh
./scripts/deploy-ec2.sh
```
Script: cài Docker → swap 2G → render nginx.ssl.conf + coturn → xin TLS (certbot standalone, cần cổng 80 trống + DNS đúng) → build `frontend/dist` → `docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.prod up -d --build` → verify.

> ⚠️ Lần đầu: Docker vừa cài, shell chưa vào group `docker` → có thể `permission denied`. Khắc phục: `exit`, SSH lại, chạy lại script (idempotent); hoặc `newgrp docker`.

### Bước 6 — Kiểm tra
```bash
docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.prod ps
./scripts/smoke-ec2.sh
```
Mở `https://chat.<domain-cua-ban>` → đăng ký 2 tài khoản (OTP email) → nhắn + reload → gọi voice/video (2 mạng khác nhau để test TURN).

### Bước 7 — Vận hành
- **Gia hạn TLS** (90 ngày): cron `certbot renew` + restart gateway (hoặc dùng webroot `/var/www/certbot` để renew không downtime).
- **Update code**: `git pull && ./scripts/deploy-ec2.sh` (cert đã có sẽ bỏ qua).
- **Tiết kiệm RAM**: container `frontend` thừa ở prod (gateway phục vụ dist tĩnh) → `docker compose ... stop frontend`.

### Bước 8 — Troubleshooting
| Triệu chứng | Xử lý |
|---|---|
| certbot fail | DNS chưa trỏ/propagate; cổng 80 chưa mở; cổng 80 bị chiếm |
| build bị kill | OOM 1G — kiểm tra swap (`swapon --show`), build chậm |
| 502 | service chưa healthy → `docker compose ... logs api-service realtime-service` |
| gọi không kết nối | SG thiếu 3478/49152-49200; TURN user/pass lệch; `external-ip` coturn ≠ EIP |
| CORS/socket lỗi | sai `CORS_ALLOWED_ORIGINS`/`SOCKET_CORS_ORIGINS` (phải `https://chat.<domain>`) |
| không nhận OTP | sai Gmail App Password |
| đổi TURN/STUN không ăn | VITE nướng lúc build → build lại FE (`./scripts/deploy-ec2.sh`) |

Log nhanh:
```bash
docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.prod logs -f --tail=100
```

---

## C. Lệnh build/verify khi dev local (cho phiên sau)
```bash
# build kiểm tra (chạy trong từng thư mục service)
cd frontend && npm run build        # tsc -b && vite build  (noUnusedLocals bắt dead code)
cd realtime-service && npm run build # tsc
cd api-service && npm run build      # tsc
# chạy local đầy đủ:
docker compose up    # tự load compose.override.yaml (dev)
```
