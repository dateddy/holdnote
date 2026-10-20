# STATUS — cập nhật 2026-10-21

## Đã xong

- Giai đoạn 1–4 xong, 5.1 xong. 5.1b làm dở: 5.1b-1 xong, 5.1b-2…7 chưa.
- 5.1c xong toàn bộ (1, 2, 3, 4, 5a/5b, 6a, 6a-fix, 6b): state machine, màn Ghi nhanh, bàn mini, multiway, evaluator, side pot, showdown (DEC-045…052).
- 5.1c-3 (DEC-056): cấu trúc blind MTT trong `sessions.mtt.blind_levels` (`poker-core/src/mtt`, trang `/sessions/[id]/structure`), Lên/Lùi level, gợi ý level theo giờ, SB mang sang hand sau. Migration `20261020210000` (`hands.level`) đã áp lên DB thật; test RLS 22 pass.
- DEC-055: review/tóm tắt AI hỏng không trừ lượt, chuẩn hóa enum trước Zod (`lib/ai/normalize.ts`), nút Thử lại ở màn review.
- Ảnh kiểm tra: `screens/5.1c-6b/`, `screens/5.1c-3/` (375×550; ngoài git; `node scripts/screens-mtt.mjs`).
- 5.1d-1 (DEC-058): trang chủ là danh sách phiên, 4 tab Phiên · Ghi hand · Thống kê · Cài đặt, bảng desktop từ 1024px. Ảnh: `screens/5.1d-1/` (`node scripts/screens-home.mjs`).
- DEC-057: lượt AI hỏng cộng vào ngân sách app (`ai_usage.failed`, migration `20261021100000` đã áp, test RLS 23 pass). Task 3.6 hoãn xuống trước 5.4.

## Đang làm

- Không có.

## Bước tiếp theo (tối đa 3, theo thứ tự)

1. Đạt thử tay trên điện thoại: cấu trúc blind MTT (dán văn bản, Lên level, gợi ý level), showdown multiway, sửa chip inline, tạo đối thủ từ ô nhập.
2. Task 5.2 migrate `legacy/data` (ghép giờ `HH:MM` thành `start_at`/`end_at`; rồi `pnpm recheck:results` và benchmark v1/v2), hoặc 5.1d-2 khi Đạt gửi nội dung.
3. Dọn control style tay còn lại (5.1b-4/5/7): `shorthand-input`, `undo-toast`, `review-form`, `session-form`, `end-form`.

## Vướng / cần Đạt quyết

- `CLAUDE.md` có luật số 10 (UI chỉ dùng `components/ui`) chưa commit: chờ Đạt quyết commit hay bỏ.
- Hand MTT lưu trước 5.1c-3 không có `level`: nút Lên level suy ra level theo BB trùng cấu trúc. Sửa cấu trúc giữa phiên không đổi hand đã lưu (có test); ngữ cảnh AI hand MTT có level, blind/ante, giai đoạn, stack bb.
- Hand lưu trước 5.1c-6b không có `pot_winners`: sửa hand cũ có bài đối thủ mà `outcome` trái bài sẽ bị khóa Lưu cho tới khi sửa.
- Chưa thử tay: server action lưu tổng kết, gọi AI thật, đồng bộ offline mất mạng thật.
- Trước beta: chính sách quyền riêng tư, tắt huấn luyện trên dữ liệu ở OpenRouter, SMTP riêng, logo thật.

## Sức khỏe repo

- test: 890 pass / 0 fail (core 577, web 313) - typecheck: ok - lint: ok (1 cảnh báo cũ `_fix` ở recheck-results.test.ts)
