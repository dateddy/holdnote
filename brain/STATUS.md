# STATUS — cập nhật 2026-10-20 21:30

## Đã xong

- Giai đoạn 1–4 xong, 5.1 xong. 5.1b làm dở: 5.1b-1 xong, 5.1b-2…7 chưa.
- 5.1c-1, 2, 4, 5a/5b xong (state machine, màn Ghi nhanh, bàn mini, multiway, bộ chọn bài).
- 5.1c-6a + 6a-fix xong: evaluator 7 lá, side pot, `showdown`, trả cược không ai theo (DEC-050, 051).
- 5.1c-6b xong (DEC-052): một nguồn tính kết quả (`settlePots`), showdown theo bài và từng pot, chọn sai bị khóa Lưu, nhãn "Đối thủ · BTN", sửa action inline (bỏ `Sheet`), panel đứng sau dòng tóm tắt dính, ô gắn tên có "+ Tạo" (offline qua IndexedDB), Toggle thật, số người cho MTT.
- Migration `20261020180000_hand_pot_winners.sql` đã áp lên DB thật (`hands.pot_winners`); bài đối thủ phụ ở `hands.opponents[].cards`.
- `pnpm recheck:results` luôn in số đã quét và số lệch, báo lỗi nếu quét 0 hand: hiện "Đã quét 6 hand · 0 hand lệch" (DB mới có 6 hand, chưa migrate legacy).
- Ảnh kiểm tra: `screens/5.1c-6b/` (33 ảnh, 375×667 và 375×550; ngoài git).
- DEC-055: review/tóm tắt AI hỏng không trừ lượt, chuẩn hóa enum trước Zod (`lib/ai/normalize.ts`), nút Thử lại ở màn review.
- 5.1c-3 xong (DEC-056): cấu trúc blind MTT (`poker-core/src/mtt`, `sessions.mtt.blind_levels`, trang `/sessions/[id]/structure`), cột `hands.level` (migration `20261020210000` đã áp lên DB thật), Lên/Lùi level, gợi ý level theo giờ, SB mang sang hand sau. Ảnh: `screens/5.1c-3/` (`node scripts/screens-mtt.mjs`).

## Đang làm

- Không có.

## Bước tiếp theo (tối đa 3, theo thứ tự)

1. Đạt thử tay showdown multiway, sửa chip inline, tạo đối thủ từ ô nhập trên điện thoại thật.
2. Thử tay cấu trúc blind MTT trên điện thoại (dán văn bản, Lên level, gợi ý level). Rồi 5.2 migrate `legacy/data` (sau đó chạy lại `pnpm recheck:results`), hoặc 5.1d (nội dung chờ Đạt gửi).
3. Dọn control style tay còn lại (5.1b-4/5/7): `shorthand-input`, `undo-toast`, `review-form`, `session-form`.

## Vướng / cần Đạt quyết

- Panel thiết lập không còn chiều cao tối đa nên không còn kiểm "vừa trên thanh Lưu" cho panel (vẫn kiểm cho bộ chọn bài, bàn phím số, hàng sửa).
- Hand lưu trước 5.1c-6b không có `pot_winners`: pot chưa rõ người thắng đọc theo `outcome` đã lưu; sửa hand cũ có bài đối thủ mà `outcome` trái bài sẽ bị khóa Lưu cho tới khi sửa.
- Chưa thử tay: server action lưu tổng kết, gọi AI thật, đồng bộ offline mất mạng thật (kể cả hàng đợi đối thủ).
- Trước beta: chính sách quyền riêng tư, tắt huấn luyện trên dữ liệu ở OpenRouter, SMTP riêng, logo thật.
- `CLAUDE.md` có luật số 10 (UI chỉ dùng `components/ui`) chưa commit: chờ Đạt quyết commit hay bỏ.
- Hand MTT lưu trước 5.1c-3 không có `level`: nút Lên level suy ra level theo BB trùng với cấu trúc. Sửa cấu trúc giữa phiên không đổi hand đã lưu; ngữ cảnh AI chưa dùng `level`.
- Chi phí các lần gọi AI hỏng (DEC-055) chưa tính vào ngân sách app; xem lại trước beta.

## Sức khỏe repo

- test: 890 pass / 0 fail (core 577, web 313) - RLS: 22 pass - typecheck: ok - lint: ok (1 cảnh báo cũ `_fix` ở recheck-results.test.ts)
