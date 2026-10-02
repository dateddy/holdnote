# Tasks — HoldNote bản 1

Mỗi task cỡ một phiên làm việc. Làm theo thứ tự trừ khi chủ dự án chỉ định khác. Xong task thì đánh dấu `[x]` và commit.

## Giai đoạn 1 — Nền móng
- [x] **1.1 Monorepo:** pnpm workspace, `apps/web` (Next.js App Router + TS + Tailwind), `packages/poker-core` (TS + Vitest), ESLint/Prettier, script `dev/test/lint/typecheck` ở root, `.env.example`, README ngắn.
- [x] **1.2 Types core:** `Card`, `Street`, `Action` (đúng spec 4.2), `HandInput`, `Blinds`. Hàm `parseCards`, `parseAmount` (`600`, `1k5`, `2k`, `0.06`) kèm test.
- [x] **1.3 Parser ghi tắt:** `parseShorthand(line, ctx) → { actions, boardFromLine, errors }`. Tham chiếu `legacy/sotay-index.html` (`tokenize`, `parseLine`). Test từ các `line` có H/V trong `legacy/data/hands`.
- [x] **1.4 Pot / kết quả / eff / SPR:** `computePot`, `computeResult`, `computeEff`, `computeSpr`, `potOddsAtDecisions`. Ca vàng −360bb phải pass. Test đối chiếu `result` các hand thật (ghi rõ hand nào không khớp và vì sao).
- [x] **1.5 Supabase:** `supabase/` init, migration đủ 8 bảng spec mục 4 + RLS + view leak; client server/browser trong `apps/web`; hướng dẫn chủ dự án điền key.
- [x] **1.6 Auth:** đăng nhập Google + email magic link, middleware chặn mọi route khi chưa đăng nhập, tạo `profiles` khi user mới.
- [x] **1.7 i18n:** next-intl, `vi` + `en`, chọn ngôn ngữ theo profile.

## Giai đoạn 2 — Ghi hand
- [ ] 2.1 Tạo phiên cash + MTT, màn Trước phiên.
- [ ] 2.2 Ghi nhanh: lưới bài + board, vị trí, kết quả, stack, lưu.
- [ ] 2.3 Ghi nhanh: chế độ nút từng street.
- [ ] 2.4 Ghi nhanh: chế độ ghi tắt + hàng phím, chuyển qua lại với chế độ nút.
- [ ] 2.5 Danh sách hand + bộ lọc + nhãn Thiếu dữ liệu.
- [ ] 2.6 Chi tiết hand + khối review tay.
- [ ] 2.7 Offline: hàng đợi IndexedDB, đồng bộ lại, Hoàn tác.
- [ ] 2.8 PWA: manifest, icon, cài lên màn hình chính.

## Giai đoạn 3 — AI review
- [ ] 3.1 `/api/review`: dựng ngữ cảnh, gọi OpenRouter, Zod, lưu `reviews` + `ai_usage`.
- [ ] 3.2 Quota gói miễn phí, ngân sách cứng, gói tự mang key (Vault).
- [ ] 3.3 Nút AI review, nhãn "AI", Phản biện.
- [ ] 3.4 Script benchmark model trên hand đã review trong `legacy/data`.

## Giai đoạn 4 — Thống kê
- [ ] 4.1 Tổng kết phiên + AI tổng kết.
- [ ] 4.2 Bảng leak + xu hướng.
- [ ] 4.3 Biểu đồ kết quả, thống kê MTT, kỷ luật.
- [ ] 4.4 Đối thủ, luật của bạn, trang chủ.

## Giai đoạn 5 — Beta
- [ ] 5.1 Onboarding 3 bước + hand mẫu.
- [ ] 5.2 Script migrate `legacy/data` → tài khoản chủ dự án.
- [ ] 5.3 Hoàn thiện bản tiếng Anh, cài đặt, xuất/xóa dữ liệu.
- [ ] 5.4 Deploy Vercel + domain holdnote.app.
