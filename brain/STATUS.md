# STATUS — cập nhật 2026-10-20 19:10

## Đã xong

- Giai đoạn 1–4 xong, 5.1 xong. 5.1b làm dở: 5.1b-1 xong, 5.1b-2…7 chưa.
- 5.1c-1, 2, 4, 5a/5b xong (state machine, màn Ghi nhanh, bàn mini, multiway, bộ chọn bài).
- 5.1c-6a + 6a-fix xong: evaluator 7 lá, side pot, `showdown`, trả cược không ai theo (DEC-050, 051).
- 5.1c-6b xong (DEC-052): một nguồn tính kết quả (`settlePots`), showdown theo bài và từng pot, chọn sai bị khóa Lưu, nhãn "Đối thủ · BTN", sửa action inline (bỏ `Sheet`), panel đứng sau dòng tóm tắt dính, ô gắn tên có "+ Tạo" (offline qua IndexedDB), Toggle thật, số người cho MTT.
- Migration `20261020180000_hand_pot_winners.sql` đã áp lên DB thật (`hands.pot_winners`); bài đối thủ phụ ở `hands.opponents[].cards`.
- Ảnh kiểm tra: `screens/5.1c-6b/` (33 ảnh, 375×667 và 375×550; ngoài git).

## Đang làm

- Không có.

## Bước tiếp theo (tối đa 3, theo thứ tự)

1. Đạt thử tay showdown multiway, sửa chip inline, tạo đối thủ từ ô nhập trên điện thoại thật.
2. Task 5.1c-3 (blind MTT) hoặc 5.2 migrate `legacy/data` (sau đó chạy lại `pnpm recheck:results`).
3. Dọn control style tay còn lại (5.1b-4/5/7): `shorthand-input`, `undo-toast`, `review-form`, `session-form`.

## Vướng / cần Đạt quyết

- Panel thiết lập không còn chiều cao tối đa nên không còn kiểm "vừa trên thanh Lưu" cho panel (vẫn kiểm cho bộ chọn bài, bàn phím số, hàng sửa).
- Hand lưu trước 5.1c-6b không có `pot_winners`: pot chưa rõ người thắng đọc theo `outcome` đã lưu; sửa hand cũ có bài đối thủ mà `outcome` trái bài sẽ bị khóa Lưu cho tới khi sửa.
- Chưa thử tay: server action lưu tổng kết, gọi AI thật, đồng bộ offline mất mạng thật (kể cả hàng đợi đối thủ).
- Trước beta: chính sách quyền riêng tư, tắt huấn luyện trên dữ liệu ở OpenRouter, SMTP riêng, logo thật.
- `CLAUDE.md` có thay đổi chưa commit từ trước phiên (không đụng tới).

## Sức khỏe repo

- test: 758 pass / 0 fail (core 538, web 220) - typecheck: ok - lint: ok (1 cảnh báo cũ `_fix` ở recheck-results.test.ts)
