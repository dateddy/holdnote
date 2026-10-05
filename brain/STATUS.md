# STATUS — cập nhật 2026-10-05

## Đã xong

- Giai đoạn 1 (1.1–1.7) và giai đoạn 2 hết (2.1–2.8); 22 commit trên `main`, chưa push.
- 2.2–2.6 (03/10): Ghi nhanh (lưới bài, vị trí, kết quả, stack, chế độ nút, ghi tắt), danh sách hand + bộ lọc, chi tiết hand + review tay. poker-core thêm `previewNext`, `suggestAmount`, `formatShorthand`.
- 2.7: hàng đợi hand trong IndexedDB (`lib/offline/`): Lưu = ghi máy trước, đồng bộ sau; id hand do client sinh; xung đột `num` tự dời sang số kế; lỗi server từ chối thì đánh dấu `failed`; chỉ đồng bộ hand của tài khoản đang đăng nhập. Toast Hoàn tác 10 giây (gỡ khỏi hàng đợi hoặc xóa trên DB). Dải "n hand chờ đồng bộ" ở màn Ghi nhanh, trang phiên, danh sách.
- 2.8: `manifest.webmanifest`, icon 192/512/maskable + apple-icon (chữ "H" tạm, sinh bằng code), `public/sw.js` viết tay (chỉ đăng ký ở production), nút/hướng dẫn cài ở trang chủ.
- Đã thử: `pnpm --filter web build` qua; chạy `next start` thì manifest, icon, apple-icon, sw.js trả 200 không cần đăng nhập, `/` chuyển về `/login`.
- `brain/` (DEC-001…034), skill `session-compress` + `db-migration`, hook quét secret.

## Đang làm

- Không có.

## Bước tiếp theo (tối đa 3, theo thứ tự)

1. Đạt thử tay (production: `pnpm --filter web build` rồi `pnpm --filter web start`): ghi hand khi tắt mạng (DevTools → Offline), bật lại thấy tự đồng bộ; Hoàn tác; cài lên màn hình chính.
2. Task 3.1: `/api/review` (dựng ngữ cảnh, OpenRouter, Zod, lưu `reviews` + `ai_usage`).
3. Task 3.2: quota gói miễn phí, ngân sách cứng, gói tự mang key (Vault).

## Vướng / cần Đạt quyết

- Chưa thử tay offline/PWA trên trình duyệt thật (cần đăng nhập). Điều hướng offline chỉ hoạt động với trang đã mở trước đó khi còn mạng.
- DEC-032 (trừ điểm 2) và DEC-033 đã được Đạt xác nhận; điểm 2 sửa bằng DEC-034 (ante MTT theo level).
- Icon là chữ "H" tạm; cần logo thật trước beta.
- Trước beta cần SMTP riêng (email mặc định Supabase chỉ vài mail/giờ).
- `pnpm test:rls` chưa chạy lại (không đổi schema).

## Sức khỏe repo

- test: 458 pass / 0 fail (core 365, web 93) - typecheck: ok - lint: ok
