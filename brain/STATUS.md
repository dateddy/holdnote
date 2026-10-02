# STATUS — cập nhật 2026-10-03

## Đã xong

- Giai đoạn 1 (task 1.1–1.7) và task 2.1 xong; 13 commit trên `main`, chưa push.
- poker-core: parser ghi tắt, pot/kết quả/eff/SPR/pot odds; ca vàng −360bb pass.
- Supabase: 8 bảng + RLS (đã audit, `pnpm test:rls` 15/15); đăng nhập Google + magic link; i18n vi/en.
- Đạt đã rotate Supabase secret key và cấu hình Google OAuth (03/10).
- Task 2.1: form tạo phiên cash/MTT (đơn vị tiền theo phiên, ante, điền sẵn từ phiên trước), màn Trước phiên, nút Vào bàn, trang phiên tạm, nút Bắt đầu phiên ở trang chủ.
- Đạt thử tay 2.1: chưa thấy lỗi. Đã áp migration thu quyền anon mặc định, thêm `__pycache__/` vào `.gitignore`, `pnpm test:rls` vào README (DEC-029).
- `brain/` (DEC-001…029), skill `session-compress` + `db-migration`, hook quét secret.

## Đang làm

- Không có.

## Bước tiếp theo (tối đa 3, theo thứ tự)

1. Task 2.2: Ghi nhanh — lưới bài + board, vị trí, kết quả, stack, lưu.
2. Task 2.3: Ghi nhanh — chế độ nút từng street.
3. Task 2.4: Ghi nhanh — ghi tắt + hàng phím, chuyển qua lại.

## Vướng / cần Đạt quyết

- Trước beta cần SMTP riêng (email mặc định Supabase chỉ vài mail/giờ).

## Sức khỏe repo

- test: 325 pass / 0 fail (core 286, web 39); RLS 15/15 - typecheck: ok - lint: ok
