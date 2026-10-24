# STATUS — cập nhật 2026-10-24

## Đã xong

- 5.1e, 5.1f, 5.1g (DEC-065, 066, 067): phản biện dạng hội thoại, kiểm lá bài AI nêu, bộ kiểm ngôn ngữ xét chung.
- 5.1d-4 (DEC-068): giao diện desktop: `AppShell` menu thu/mở, hàng lọc ngang, lọc kết quả chọn một, ô Net nhiều dòng, bảng phiên bấm cả hàng + ⋯, `Fab`, form phiên 2 cột, Ghi/Sửa hand 3 cột (2 cột ở 1024px) + phím tắt, nhãn Nhận về / Lời/lỗ. Ảnh `screens/5.1d-4/` bằng `node scripts/screens-5.1d-4.mjs`.
- Giai đoạn 1–4, 5.1, 5.1c, 5.1d xong (5.1d-3 gồm đổi đơn vị 3 phiên cũ sang Chip, 1 chip = 1.000 VND). 5.1b làm dở (5.1b-1 xong; 5.1b-2/3 một phần nhờ 5.1d-3).
- 5.1d-3 (DEC-062, 063, 064): potType + ISO; `actionsFromLegacy`; form phiên dùng chung; 3 tab icon; `<` qua history; vuốt mép iOS; trang chủ gọn; khối "AI phân tích" cạnh "Bạn tự review" (cùng hiện hành, dòng lệch EV), "Chạy lại AI review" hỏi xác nhận trừ 1 lượt.
- DB: `chip_value`/`chip_currency`; review hiện hành theo từng loại (`reviews_one_current` trên `(hand_id, source)`), `leak_stats` ưu tiên review tay. `pnpm recheck:results`: 5 hand, 0 lệch.
- `manualLabel` (bench.ts): nhãn benchmark từ review tay, dùng khi benchmark đọc từ DB sau 5.2.

## Đang làm

- Không có. Task 5.2b (ô Toán do poker-core điền) đã mở trong tasks.md, chưa làm.

## Bước tiếp theo (tối đa 3, theo thứ tự)

1. Đạt quyết cách xử lý 16 hand legacy không chuyển được (gợi ý: đổi tên vị trí cũ bằng `legacySeat` trước khi chuyển), rồi Task 5.2 migrate `legacy/data`.
2. Đạt thử tay trên điện thoại: form phiên, back Android, vuốt mép iOS PWA, InfoTip, khối AI + tự review.
3. Dọn control style tay còn lại (5.1b-4/5/7): `shorthand-input`, `undo-toast`, `summary-form`, `end-form`.

## Vướng / cần Đạt quyết

- 16 hand legacy H/V không chuyển được: 11 `unknown_seat` (4 nhãn V1, 5 `x`/`fold` không ghi ai, 2 tên vị trí không có ở bàn nhỏ), 3 `bad_setup` (tên vị trí cũ ở bàn 6–7 người), 1 `invalid_action`, 1 `out_of_turn`.
- Chưa làm desktop: bảng phiên chưa có cột ⋯; danh sách hand xuyên phiên; "Giải thích thuật ngữ" (5.3).
- Trước beta: chính sách quyền riêng tư, tắt huấn luyện dữ liệu ở OpenRouter, SMTP riêng, logo thật.

## Sức khỏe repo

- test: 1099 pass / 0 fail (core 623, web 476) - typecheck: ok - lint: ok (1 cảnh báo `_fix` chưa dùng trong `recheck-results.test.ts`, có từ trước)
