# STATUS — cập nhật 2026-10-03 01:01

## Đã xong

- Giai đoạn 1 (task 1.1–1.7) xong; 9 commit trên `main`, chưa push.
- poker-core: parser ghi tắt, pot/kết quả/eff/SPR/pot odds; ca vàng −360bb pass; hand thật khớp 43/69 (26 lệch có lý do).
- Supabase: 8 bảng + RLS; đăng nhập Google + magic link; i18n vi/en theo profile.
- `brain/` (DEC-001…027), skill `session-compress` + `db-migration`, hook quét secret (`.githooks/pre-commit`).
- Audit RLS: migration `20261002120000` tách 4 policy, khóa `user_api_keys`; `pnpm test:rls` 15/15 pass.
- Đạt đã xác nhận DEC-020 → DEC-024 (ghi ở DEC-027).

## Đang làm

- Không có. Chưa commit: `brain/DECISIONS.md` (DEC-027), `brain/STATUS.md`.

## Bước tiếp theo (tối đa 3, theo thứ tự)

1. Task 2.1: tạo phiên cash + MTT (nút chọn đơn vị tiền theo phiên), màn Trước phiên.
2. Task 2.2: Ghi nhanh — lưới bài, vị trí, kết quả, stack, lưu.
3. Task 2.3: Ghi nhanh — chế độ nút từng street.

## Vướng / cần Đạt quyết

- TODO(unknown): Đạt đã đổi (rotate) Supabase secret key chưa?
- TODO(unknown): Đạt đã cấu hình Google OAuth (Google Cloud + Supabase) chưa?
- Trước beta cần SMTP riêng (email mặc định Supabase chỉ vài mail/giờ).
- PROPOSED chờ duyệt: thêm `__pycache__/` vào `.gitignore`; `alter default privileges` thu quyền `anon`; thêm `pnpm test:rls` vào README.

## Sức khỏe repo

- test: 305 pass / 0 fail (core 286, web 19); RLS 15/15 (02/10) - typecheck: ok - lint: ok
