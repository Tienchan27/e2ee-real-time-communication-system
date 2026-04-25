# 09 - RACI và Quy Ước Làm Việc Nhóm

## Mục tiêu

Phân quyền rõ ràng để:
- Tránh nghẽn phụ thuộc.
- Theo dõi tiến độ theo tuần bằng số liệu.
- Đảm bảo mỗi thành viên có đầu việc cụ thể, đo được, nghiệm thu được.

---

## Vai trò trong nhóm

| Ký hiệu vai trò | Người phụ trách |
|---|---|
| System Owner | Đình Tiến |
| FE Owner | Bật Tiến |
| API Owner | Minh Tiến |
| Realtime Owner | Lương Thứ |

---

| Vai trò | Người phụ trách | Trách nhiệm chính | Trách nhiệm phụ |
|---|---|---|---|
| System Owner + DevOps | Đình Tiến | Kiến trúc, E2EE policy, tích hợp, release gate | CI/CD, deploy, rollback |
| FE Owner | Bật Tiến | UI/UX chat-call, client state, WebRTC UI | Xử lý lỗi hiển thị, reconnect UX |
| API Owner | Minh Tiến | Auth, OTP, DB schema, REST API | Logging, migration, idempotency |
| Realtime Owner | Lương Thứ | Socket, presence, signaling, event routing | Dedupe, timeout, cleanup |

---

## Ma trận RACI theo miền công việc

| Miền công việc | R (Responsible) | A (Accountable) | C (Consulted) | I (Informed) |
|---|---|---|---|---|
| Kiến trúc và contract | System Owner | System Owner | API, Realtime, FE | Cả nhóm |
| API + CSDL | API Owner | API Owner | System Owner | FE, Realtime |
| Realtime + signaling | Realtime Owner | Realtime Owner | System Owner, FE | API |
| Frontend integration | FE Owner | FE Owner | System Owner, Realtime | API |
| Bảo mật | System Owner, API Owner | System Owner | Realtime, FE | Cả nhóm |
| CI/CD + Deploy | System Owner | System Owner | API, Realtime, FE | Cả nhóm |

---

## Quyền ra quyết định

| Loại quyết định | Người duyệt bắt buộc | SLA duyệt |
|---|---|---|
| Thay đổi contract API (`02-api.md`) | System Owner + API Owner | < 24h |
| Thay đổi contract event (`03-events.md`) | System Owner + Realtime Owner | < 24h |
| Thay đổi chính sách bảo mật (`05`, `06`) | System Owner + API Owner | < 24h |
| Thay đổi luồng nghiệp vụ (`04-flow.md`) | System Owner + FE Owner + Realtime Owner | < 24h |
| Go/No-Go phát hành | System Owner | Trong buổi release |

---

## Definition of Done (DoD) cho mọi task

Một task chỉ được chuyển `Done` khi đạt đủ 8 điều kiện:

1. Hoàn thành đúng acceptance criteria.
2. Có test tương ứng (unit/integration hoặc checklist thủ công có bằng chứng).
3. Có xử lý lỗi và logging tối thiểu.
4. Không phá vỡ contract hiện tại.
5. Đã cập nhật tài liệu liên quan.
6. PR đã được review và approved.
7. CI pass.
8. Không còn blocker mở liên quan task đó.

---

## Quy tắc đặt mã và trạng thái task

### Mã task

- Định dạng: `W<tuan>-<domain>-<so>`
- Ví dụ:
  - `W3-API-02`
  - `W4-RT-03`
  - `W6-FE-04`

### Trạng thái task

| Trạng thái | Ý nghĩa | Ai được chuyển trạng thái |
|---|---|---|
| Todo | Chưa bắt đầu | Owner / System Owner |
| In Progress | Đang làm | Owner |
| Blocked | Bị chặn phụ thuộc | Owner + báo System Owner |
| In Review | Đã tạo PR/chờ review | Owner |
| Done | Đã đạt DoD | Reviewer/System Owner |

---

## Bảng theo dõi tiến độ chuẩn (dùng cho mọi tuần)

| Task ID | Mô tả ngắn | Owner | Ước lượng | Phụ thuộc | Deadline | Trạng thái | Minh chứng |
|---|---|---|---|---|---|---|---|
| W3-API-01 | Endpoint request OTP | API Owner | 0.5 ngày | W2-API-03 | Thứ 3 | In Progress | PR link + test |
| W3-FE-02 | Màn nhập OTP + countdown | FE Owner | 0.5 ngày | W3-API-01 | Thứ 4 | Todo | Screenshot + PR |

Ghi chú:
- Ước lượng dùng đơn vị `0.5 ngày`, `1 ngày`, `2 ngày`.
- Deadline theo ngày trong tuần (`Thứ 2 -> Thứ 7`).
- Minh chứng bắt buộc có link PR hoặc ảnh test.

---

## Quy tắc PR và review

| Hạng mục | Quy tắc |
|---|---|
| Naming branch | `feature/<domain>-<short-name>` hoặc `fix/<domain>-<short-name>` |
| Kích thước PR mục tiêu | < 500 dòng thay đổi (nếu lớn hơn phải tách) |
| SLA review | Review đầu tiên trong 24 giờ |
| Điều kiện merge | >= 1 approval từ owner hoặc lead, CI pass |

---

## Quy trình xử lý blocker

### Ngưỡng cảnh báo

- Bị chặn > 4 giờ: báo trong nhóm theo mẫu.
- Bị chặn > 24 giờ: escalte System Owner và kích hoạt fallback task.

### Mẫu báo blocker

```txt
Task ID:
Task name:
Blocker:
Dependency:
Đã thử:
Cần hỗ trợ từ ai:
ETA mới:
```

---

## Lịch làm việc cố định hằng tuần

| Buổi | Thời lượng | Mục tiêu đầu ra |
|---|---|---|
| Planning (Thứ 2) | 45 phút | Chốt bảng task tuần + owner + deadline |
| Mid-week Sync (Thứ 4) | 20 phút | Gỡ blocker + cập nhật risk |
| Demo + Retro (Thứ 6) | 45 phút | Demo feature + thống kê hoàn thành + bài học |

---

## Quy tắc giao tiếp và thay đổi tài liệu

- Mọi thay đổi contract phải được ghi vào file tài liệu tương ứng, không chốt bằng lời nói.
- Mọi quyết định kỹ thuật phải nằm trong PR comment hoặc Decision Log.
- Không xóa lịch sử quyết định cũ, chỉ append.

---

## Trách nhiệm cổng chất lượng

| Cổng chất lượng | Người chịu trách nhiệm chính | Tiêu chí pass |
|---|---|---|
| Contract Gate | System Owner + Owner domain | Không có mismatch giữa code và docs |
| Security Gate | System Owner + API Owner | OTP/token/rate-limit đúng baseline |
| Realtime Gate | Realtime Owner | Ack/error/dedupe hoạt động đúng |
| UX Gate | FE Owner | Trạng thái lỗi/reconnect hiển thị đúng |
| Release Gate | System Owner | QA checklist pass + smoke test pass |

