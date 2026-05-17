# 07 - Triển Khai và CI/CD

## Mục tiêu

Cung cấp kế hoạch triển khai free-tier và pipeline CI/CD có thể chạy thật đến giai đoạn demo/chấm điểm.

## Stack triển khai miễn phí mục tiêu

- Frontend: Vercel free.
- API Service: Render/Railway-like free web service.
- Realtime Service: Render/Railway-like free web service.
- PostgreSQL: Neon/Supabase free tier.
- Redis: Upstash/Redis free tier (optional v1, bật khi cần rate-limit/cache/socket scale).
- TURN: coturn on always-free VM.

## Môi trường

- `local`: Docker Compose — một cổng vào `http://localhost` (service `gateway` :80). Dev: copy `.env.example` → `.env`, `docker compose up --build` (tự load `compose.override.yaml` cho bind-mount + hot reload). Biến: `BUILD_TARGET=development`, `NGINX_CONF=nginx.dev.conf` (proxy Vite qua gateway).
- `staging`: integration testing environment.
- `prod`: `docker compose -f compose.yaml --env-file .env.prod up --build -d` (không dùng override). `BUILD_TARGET=runtime`, `NGINX_CONF=nginx.conf` (static SPA từ `frontend/dist`).

## Biến môi trường bắt buộc

### Shared
- `NODE_ENV`
- `LOG_LEVEL`
- `CORS_ALLOWED_ORIGINS`

### API
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

### Realtime
- `API_INTERNAL_BASE_URL`
- `API_INTERNAL_TOKEN`
- `SOCKET_CORS_ORIGINS`
- `REDIS_URL` (optional v1, required when scaling)

## Chính sách lưu trữ OTP/session/token

- PostgreSQL là source of truth cho OTP records, session và refresh token hash.
- Redis chỉ dùng cho lớp hiệu năng (rate-limit counters, cache TTL ngắn, Socket.IO adapter/pub-sub).
- Không dùng Redis làm storage chính cho OTP/session ở v1 để giữ audit trail và replay-detection ổn định.

### Frontend
- `VITE_API_BASE_URL`
- `VITE_SOCKET_BASE_URL`
- `VITE_STUN_SERVERS`
- `VITE_TURN_URL`
- `VITE_TURN_USERNAME`
- `VITE_TURN_CREDENTIAL`

## Tiến độ hạ tầng local (System Owner)

- [x] `compose.yaml` + `compose.override.yaml` (dev bind-mount / hot reload)
- [x] Gateway nginx: `infra/nginx/nginx.dev.conf` + `infra/nginx/nginx.conf`
- [x] Dockerfiles dual-stage (`development` / `runtime`) cho 3 service
- [x] `.env.example`, `.env.prod.example`, env mẫu từng service
- [x] `README.md` boot contract + lệnh dev/prod
- [x] CI skeleton: `docker compose config` dev/prod (`.github/workflows/ci.yml`)
- [ ] `docker compose up --build` pass healthcheck đủ 5 service (chờ owners: `package.json`, `/health`, Vite app)
- [ ] CD staging/prod free-tier + smoke test tự động

## Pipeline CI (cổng kiểm tra PR)

Trigger:
- pull_request to `develop` and `main`.

Jobs (mục tiêu đầy đủ):
1. `lint`
2. `typecheck`
3. `test`
4. `build`
5. `security-scan-lite` (dependency audit baseline)

Hiện tại trong repo: validate `docker compose config` (dev + prod env). Các job trên bổ sung khi từng service có code + test.

Quy tắc:
- Tất cả kiểm tra phải pass trước khi merge.

## Pipeline CD

### Triển khai Staging

Trigger:
- merge into `develop`.

Steps:
1. Deploy API and realtime.
2. Deploy frontend.
3. Run smoke test:
   - health endpoints.
   - socket connect.
   - basic auth and message path.

### Triển khai Production

Trigger:
- merge/tag release from `main`.

Steps:
1. Deploy API then realtime then frontend.
2. Run smoke test and quick call setup check.
3. Publish release notes with known limitations.

## Health và Readiness

- API: `/health` and `/ready`.
- Realtime: `/health` and socket handshake check endpoint.

Kiểm tra tối thiểu:
- DB connectivity (API).
- Internal API reachability (Realtime).
- TURN reachability test (scheduled check or pre-demo manual check).

## Chiến lược rollback

- Keep last known good deployment.
- Rollback order:
  1. frontend
  2. realtime
  3. api
- If DB migration is incompatible:
  - use expand/contract migration model only.

## Runbook trước demo (30 phút)

1. Verify all service health endpoints.
2. Verify login and OTP test mailbox.
3. Verify socket connect and chat send.
4. Verify voice call setup.
5. Verify video call setup with TURN fallback enabled.
6. Keep one backup scenario: audio-only fallback demo.

## Rủi ro vận hành

- Free-tier cold starts increase first-response latency.
- TURN relay bandwidth may be limited.
- Staging and prod may drift without env discipline.

Giảm thiểu:
- Warmup checks before demo.
- Environment matrix document and secret sync checklist.
- Automated smoke tests on every deploy.

