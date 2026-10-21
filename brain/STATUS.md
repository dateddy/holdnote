# STATUS — cập nhật 2026-10-21 15:55

## Đã xong

- Giai đoạn 1–4, 5.1, 5.1c, 5.1d xong (5.1d-3 gồm cả đổi đơn vị 3 phiên cũ). 5.1b làm dở (5.1b-1 xong; 5.1b-2/3 một phần nhờ 5.1d-3).
- 5.1d-3 (DEC-062, DEC-063): potType + ISO; `actionsFromLegacy`; form phiên dùng chung; 3 tab icon; `<` qua history; vuốt mép iOS; trang chủ gọn; khối "AI phân tích" (chỉ đọc khi có AI review, form "Bạn tự review" khi chưa có, "Chạy lại AI review" hỏi xác nhận trừ 1 lượt).
- 3 phiên cũ đã đổi sang Chip, 1 chip = 1.000 VND; bản sao ở `backups/` (ngoài git); `pnpm recheck:results`: 5 hand, 0 lệch, bb giữ nguyên.
- Ảnh 375px: `screens/5.1d-3/` (`node scripts/screens-5.1d-3.mjs`, mọi kiểm tra ok).

## Đang làm

- Không có.

## Bước tiếp theo (tối đa 3, theo thứ tự)

1. Đạt quyết cách xử lý 16 hand legacy không chuyển được (xem báo cáo), rồi Task 5.2 migrate `legacy/data`.
2. Đạt thử tay trên điện thoại: form phiên, back Android, vuốt mép iOS PWA, InfoTip, khối AI phân tích.
3. Dọn control style tay còn lại (5.1b-4/5/7): `shorthand-input`, `undo-toast`, `summary-form`, `end-form`.

## Vướng / cần Đạt quyết

- 16 hand legacy H/V không chuyển được: 11 `unknown_seat` (4 hand nhãn V1, 5 hand `x`/`fold` không ghi ai, 2 hand tên vị trí không có ở bàn nhỏ), 3 `bad_setup` (tên vị trí cũ ở bàn 6–7 người, cần `legacySeat` trước khi chuyển), 1 `invalid_action`, 1 `out_of_turn`.
- Chưa làm desktop: bảng phiên chưa có cột ⋯; danh sách hand xuyên phiên; "Giải thích thuật ngữ" (5.3).
- Trước beta: chính sách quyền riêng tư, tắt huấn luyện dữ liệu ở OpenRouter, SMTP riêng, logo thật.

## Sức khỏe repo

- test: 1099 pass / 0 fail (core 623, web 476) - typecheck: ok - lint: ok (1 cảnh báo `_fix` chưa dùng trong `recheck-results.test.ts`, có từ trước)
