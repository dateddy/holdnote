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
- [x] 2.1 Tạo phiên cash + MTT, màn Trước phiên.
- [x] 2.2 Ghi nhanh: lưới bài + board, vị trí, kết quả, stack, lưu.
- [x] 2.3 Ghi nhanh: chế độ nút từng street.
- [x] 2.4 Ghi nhanh: chế độ ghi tắt + hàng phím, chuyển qua lại với chế độ nút.
- [x] 2.5 Danh sách hand + bộ lọc + nhãn Thiếu dữ liệu.
- [x] 2.6 Chi tiết hand + khối review tay.
- [x] 2.7 Offline: hàng đợi IndexedDB, đồng bộ lại, Hoàn tác.
- [x] 2.8 PWA: manifest, icon, cài lên màn hình chính.

## Giai đoạn 3 — AI review
- [x] 3.1 `/api/review`: dựng ngữ cảnh, gọi OpenRouter, Zod, lưu `reviews` + `ai_usage`.
- [x] 3.2 Quota gói miễn phí, ngân sách cứng, gói tự mang key (Vault).
- [x] 3.3 Nút AI review, nhãn "AI", Phản biện.
- [x] 3.4 Script benchmark model trên hand đã review trong `legacy/data`.

## Giai đoạn 4 — Thống kê
- [x] 4.1 Tổng kết phiên + AI tổng kết.
- [x] 4.2 Bảng leak + xu hướng.
- [x] 4.3 Biểu đồ kết quả, thống kê MTT, kỷ luật.
- [x] 4.4 Đối thủ, luật của bạn, trang chủ.
- [ ] 4.5 Thống kê vị trí gom nhóm sớm / giữa / muộn / blind để cộng được các hand khác số người (hand lưu `players_dealt` từ 5.1c-5).
- [ ] 4.6 Đổi tên và gộp hồ sơ đối thủ trùng (tạo nhanh từ màn Ghi hand dễ sinh trùng).

## Giai đoạn 5 — Beta
- [x] 5.1 Onboarding 3 bước + hand mẫu.
- [ ] **5.1b** Thiết kế lại UI + tối ưu flow (DEC-044). Đã xong: token, thanh dưới, Ghi nhanh theo street, tách Kết thúc phiên/Tổng kết, chi tiết hand dạng đọc. Phần còn lại chia nhỏ (thứ tự: 1 → 2 → 3 → 4 → 5 → 7 → 6):
  - [x] **5.1b-1 Tài liệu thiết kế:** `docs/design.md` (token, thang chữ, spacing, cỡ nút sm/md/lg, luật chỉ dùng `components/ui`) + quy tắc 10 trong CLAUDE.md.
  - [ ] **5.1b-2 Điều hướng:** tab gốc không có back; màn con back về tab cha; `BottomNav` sáng đúng tab cha. Đề xuất: Đối thủ và Luật chuyển thành con của Trang chủ (trang chủ đã có thẻ Luật; thêm thẻ Đối thủ), bỏ khỏi Cài đặt — dùng lúc chuẩn bị/ghi phiên, không phải cấu hình; sửa `active` trong `bottom-nav.tsx`. Tab Ghi hand: gốc = Ghi nhanh của phiên đang mở (hoặc Tạo phiên); con = trang phiên, danh sách hand, chi tiết hand, Trước phiên, Kết thúc, Tổng kết. Ghi DEC mới.
  - [ ] **5.1b-3 Icon + TopBar:** thêm `lucide-react` (dependency mới — hỏi Đạt trước, ghi DEC thay phần "không thêm dependency" của DEC-044); component `Icon` (cỡ 20/24, `currentColor`); icon cho 4 tab; `TopBar` variant `tab` (không back, có action phải) và `child` (back dạng icon + nhãn); `Button` thêm size `sm`, đổi `md` h-12→h-11, `INPUT_CLASS` h-12→h-11 theo design.md; thêm `Textarea`, `Field`, `Screen`; TopBar cho trang chủ, Trước phiên, Tổng kết.
  - [ ] **5.1b-4 hand-form:** tách `hand-form.tsx` (~490 dòng) thành các khối (thanh ngữ cảnh, bài + vị trí, action theo street, kết quả, stack, suy nghĩ + ⚑, thanh Lưu); thay control style tay trong `hand-form`, `action-rows`, `card-grid`, `shorthand-input` bằng `components/ui`. Không đổi hành vi; luyện tập onboarding vẫn chạy; test xanh.
  - [ ] **5.1b-5 review-form + summary-form:** như 5.1b-4 cho `review-form.tsx`, `summary-form.tsx`, `end-form.tsx`.
  - [ ] **5.1b-6 Thiết bị thật:** `themeColor` theo tối/sáng (khớp `background`), `theme_color`/`background_color` trong manifest, `statusBarStyle`; `viewport-fit=cover` + `safe-area-inset-top` cho thanh ngữ cảnh dính; bàn phím ảo không che nút Lưu. Thử tay iOS Safari + Android Chrome (đã cài PWA); xong thì đóng 5.1b.
  - [ ] **5.1b-7 Quét phần còn lại** (thêm ngoài danh sách ban đầu): `rules`, `stats`, `session-form`, `opponent-form`, `onboarding`, `ai-key-form`, `login` và lẻ tẻ; bỏ `border-red-700` ở chi tiết đối thủ. Xong khi grep `<button|<input|<textarea|<select` ngoài `components/ui` = 0.
- [ ] **5.1c** Ghi hand theo action (spec `docs/spec-ghi-hand-theo-action.md`, thay spec 3.5 chế độ Nút; DEC-045):
  - [x] **5.1c-1 State machine:** `packages/poker-core/src/machine/` (spec mục 4–12, 14): thứ tự hành động, nút hợp lệ, mức phải theo, raise tối thiểu, straddle tới 3 nhà, ante MTT, đóng vòng cược/chuyển street, cảnh báo, hoàn tác/sửa action. Thêm `post_ante/post_sb/post_bb/post_straddle` + `dead` vào `ActKind`; hand cũ không có post vẫn tính theo `Blinds`. 24 ca test mục 15 viết trước; ca vàng −360bb và test cũ giữ xanh. Không đụng UI, không đổi schema.
  - [x] **5.1c-2 UI:** bước ① thiết lập hand (bàn mini, straddle, level/ante/giai đoạn MTT), nút theo tình huống, bàn phím "Lên tới", timeline chip, hoàn tác/sửa; ảnh 375px bằng `pnpm screens` (Playwright). Cấu trúc blind MTT và nút Lên level tách sang 5.1c-3; mọi màn đọc `actions` bỏ qua `post_*`/`dead`. Cập nhật spec 3.5.
  - [ ] **5.1c-3 Cấu trúc blind MTT:** nhập danh sách level (SB, BB, ante) khi tạo phiên MTT, lưu `sessions.mtt.blind_levels`; nút "Lên level" ở bước Thiết lập tự điền SB/BB/ante (spec mục 5).
  - [x] **5.1c-4 Bố cục màn Ghi nhanh:** luật board mới (nhập lúc nào cũng được, không chặn action; hàm `boardCheck`, `streetTabs` trong poker-core; sửa spec mục 10.4 và ca test 23). Bố cục: thanh ngữ cảnh → thẻ Board (5 ô liền) → một thẻ Action (tab Preflop/Flop/Turn/River, mở rộng dọc, khu nhập trong thẻ) → kết quả → thanh Lưu dính. Thẻ Board và thẻ Action vừa 375×667 khi đang nhập. Ảnh chụp lại bằng `pnpm screens`.
  - [x] **5.1c-5a Số người 2–10 + multiway (core, schema):** `poker-core`: `tableOrder` 2–10 (tên vị trí theo N, `UTG+2`), heads-up (BTN đóng SB, đi trước preflop, đi sau cùng postflop), straddle tối đa min(3, N−3), `legacySeat` (đổi tên vị trí cũ lúc đọc), `remapSeats`, `listedOnly` (chỉ ghế được chọn được theo dõi; action ghế bỏ chọn và phía sau tô đỏ, không xóa), `primaryOpponent`, `duplicateCards`/`takenSuits`. Migration: `hands.opponents jsonb`, CHECK `UTG+2`. Test viết trước cho N = 2, 3, 4, 6, 9, 10. Cập nhật spec.
  - [x] **5.1c-5b Gộp thiết lập vào màn Ghi hand (UI):** bỏ bước thiết lập; thanh ngữ cảnh + bàn mini trượt (Mình / Đối thủ multiway, bộ đếm N người); thẻ bài 7 ô + CardPicker trượt trong thẻ (khóa lá đã dùng); NumPad trong thẻ Action; danh sách đối thủ hiện tất cả (sửa bug chỉ hiện trùng địa điểm); `Stepper`, `Collapse`; cập nhật `docs/design.md` (pixel mục 4–5); ảnh 375×550 và 375×667 bằng `pnpm screens`.
  - [x] **5.1c-6a Evaluator + side pot (core):** hand evaluator 7 lá (10 loại bộ bài, kicker); side pot theo mức đóng góp (người fold vẫn góp tiền, cược không ai theo trả lại, chip lẻ cho người gần trái BTN nhất theo đơn vị blind); `showdown` xác định người thắng từng pot khi đủ bài, cần chọn khi thiếu; đối thủ chính = đối thủ chưa fold có action cuối. Test viết trước; cập nhật spec.
  - [x] **5.1c-6a-fix Trả cược không ai theo:** người đã fold không bao giờ nhận lại tiền (`computePot` và state machine); test viết trước; script dry-run `pnpm recheck:results` quét hand đã lưu (chỉ đọc), chờ Đạt duyệt danh sách trước khi sửa DB.
  - [ ] **5.1c-6b Sửa lỗi sau thử tay (UI):** showdown tự chọn theo bài (chọn khác thì cảnh báo và khóa Lưu), chọn người thắng theo từng pot khi thiếu bài, hiện từng pot; nhãn "Đối thủ · BTN" khi multiway; sửa chip action inline (bỏ sheet); panel thiết lập đứng sau dòng tóm tắt dính; gắn tên đối thủ bằng ô nhập có gợi ý và "+ Tạo"; Toggle straddle, chữ nhắc, nhắc chọn lại ghế mình, bộ đếm số người cho phiên MTT. Ảnh 375×550.
- [ ] 5.2 Script migrate `legacy/data` → tài khoản chủ dự án.
- [ ] 5.3 Hoàn thiện bản tiếng Anh, cài đặt, xuất/xóa dữ liệu.
- [ ] 5.4 Deploy Vercel + domain holdnote.app.
