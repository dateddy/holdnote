# STATUS — cập nhật 2026-10-02 17:13

## Đã xong

- Giai đoạn 1 (task 1.1–1.7) xong, 7 commit trên `main`, chưa push.
- poker-core: parser ghi tắt, pot/kết quả/eff/SPR/pot odds; ca vàng −360bb pass; hand thật khớp 43/69 (26 lệch có lý do).
- Supabase: 8 bảng + RLS trên project thật; đăng nhập Google + magic link; i18n vi/en theo profile.

## Đang làm

- Dựng `brain/`, skill `session-compress` + `db-migration`, hook quét secret; audit RLS.

## Bước tiếp theo (tối đa 3, theo thứ tự)

1. Audit RLS + test Vitest `pnpm test:rls` (phần B).
2. Task 2.1: tạo phiên cash + MTT (có nút chọn đơn vị tiền theo phiên), màn Trước phiên.
3. Task 2.2: Ghi nhanh — lưới bài, vị trí, kết quả, stack, lưu.

## Vướng / cần Đạt quyết

- TODO(unknown): Đạt đã đổi (rotate) Supabase secret key chưa?
- TODO(unknown): Đạt đã cấu hình Google OAuth trong Google Cloud + Supabase chưa?
- Trước beta cần SMTP riêng (email mặc định của Supabase chỉ vài mail/giờ).
- DEC-020 → DEC-024 chờ Đạt xác nhận.

## Sức khỏe repo

- test: 305 pass / 0 fail (core 286, web 19) - typecheck: ok - lint: ok
