# STATUS — cập nhật 2026-10-21 15:10

## Đã xong

- Giai đoạn 1–4, 5.1, 5.1c, 5.1d-1/2 xong. 5.1b làm dở (5.1b-1 xong; 5.1b-2/3 một phần nhờ 5.1d-3: 3 tab, icon, TopBar con, `Field`).
- 5.1d-3 (DEC-062) xong 5 trên 6 phần: a potType + ISO; b `actionsFromLegacy` + sửa hand cũ ở Theo action; d form phiên dùng chung (4 nhóm, giờ, Chip, tỉ giá); e ba tab icon, `<` qua history, vuốt mép iOS; f trang chủ (⋯, + Hand, bỏ "Đang chơi", lọc mờ mép, InfoTip lật, Cài app vào Cài đặt) và khối "AI phân tích" chỉ đọc.
- 5.1d-3c: migration `20261021120000` (`chip_value`, `chip_currency`) đã áp, RLS test xanh; script `scripts/fix-chip-units.mjs` mới chạy dry-run.
- Ảnh 375px: `screens/5.1d-3/` (`node scripts/screens-5.1d-3.mjs`, 45 kiểm tra đều ok).
- `poker-core` mới: `actionsFromLegacy`, `potType` loại `iso`, `StatsSession.chipRate`.

## Đang làm

- 5.1d-3c còn một bước: chờ Đạt duyệt danh sách 3 phiên rồi chạy `node scripts/fix-chip-units.mjs --apply`.

## Bước tiếp theo (tối đa 3, theo thứ tự)

1. Đạt duyệt danh sách đổi đơn vị (3 phiên → Chip, 1 chip = 1000 VND), rồi `--apply`.
2. Đạt thử tay trên điện thoại: form phiên, back Android, vuốt mép iOS PWA, InfoTip, khối AI phân tích.
3. Task 5.2 migrate `legacy/data` (CHIP + 1000 VND, `actionsFromLegacy` cho chuỗi `line`, ghép giờ `HH:MM`).

## Vướng / cần Đạt quyết

- Ca vàng `H lp V o500 H c ...` nay có loại pot ISO (limp rồi đối thủ raise); test chips đã đổi kỳ vọng. Muốn gọi SRP thì nói.
- Trên `legacy/data`: 11 hand H/V không chuyển được vì `V1..V9` không có vị trí; hand #1 trong DB (`H r500 V ai`) thiếu stack nên vẫn mở ghi tắt.
- Chưa làm desktop: bảng phiên chưa có cột ⋯; danh sách hand xuyên phiên; "Giải thích thuật ngữ" (5.3).
- Trước beta: chính sách quyền riêng tư, tắt huấn luyện dữ liệu ở OpenRouter, SMTP riêng, logo thật.

## Sức khỏe repo

- test: 1091 pass / 0 fail (core 623, web 468)  - typecheck: ok  - lint: ok (1 cảnh báo `_fix` chưa dùng trong `recheck-results.test.ts`, có từ trước)
