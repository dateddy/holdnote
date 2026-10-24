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
- [x] **3.5** Sửa chất lượng AI review (DEC-053):
  - [x] 3.5-1 Prompt v1 làm mặc định, giữ v2 (`prompt.ts`, `AI_PROMPT_VERSION`).
  - [x] 3.5-2 Cột `reviews.prompt_version` (migration), nhãn "Prompt cũ (v2)" cho review cũ.
  - [x] 3.5-3 Ngữ cảnh mới: straddle, ante, level/giai đoạn MTT, multiway, side pot, loại pot, cược không ai theo; test.
  - [x] 3.5-4 Prompt v1 mô tả trường mới (tối thiểu, không đổi cách chấm).
  - [x] 3.5-5 Benchmark v1 cũ / v1 + ngữ cảnh mới / v2, báo bảng so sánh.
  - [x] 3.5-6 Ghi DEC-053.
- [x] **3.5b** Giảm nhiễu AI review và benchmark:
  - [x] 3.5b-1 Prompt v1 chỉ thêm dòng mô tả cho trường hand có; hand ghi tắt/hand cũ nhận đúng prompt v1 cũ (test cả hai).
  - [x] 3.5b-2 JSON có cấu trúc (`response_format`), model từ chối thì gọi lại không kèm; Zod lỗi thử lại 1 lần; benchmark tính JSON hỏng riêng.
  - [x] 3.5b-3 Benchmark `BENCH_RUNS`: trung bình và min–max của khớp EV, báo sai nhầm, bỏ sót lỗi.
  - [x] 3.5b-4 Chạy v1 và v2, mỗi bản 3 lần trên 69 hand; ghi kết quả vào DEC-054.

## Giai đoạn 4 — Thống kê
- [x] 4.1 Tổng kết phiên + AI tổng kết.
- [x] 4.2 Bảng leak + xu hướng.
- [x] 4.3 Biểu đồ kết quả, thống kê MTT, kỷ luật.
- [x] 4.4 Đối thủ, luật của bạn, trang chủ.
- [ ] 4.5 Thống kê vị trí gom nhóm sớm / giữa / muộn / blind để cộng được các hand khác số người (hand lưu `players_dealt` từ 5.1c-5).
- [ ] 4.6 Đổi tên và gộp hồ sơ đối thủ trùng (tạo nhanh từ màn Ghi hand dễ sinh trùng).
- [ ] 4.7 Bảng leak ghi rõ nguồn: số hand tự review / số hand AI review, hiển thị riêng từng nguồn.

## Giai đoạn 5 — Beta
- [x] 5.1 Onboarding 3 bước + hand mẫu.
- [ ] **5.1b** Thiết kế lại UI + tối ưu flow (DEC-044). Đã xong: token, thanh dưới, Ghi nhanh theo street, tách Kết thúc phiên/Tổng kết, chi tiết hand dạng đọc. Phần còn lại chia nhỏ (thứ tự: 1 → 2 → 3 → 4 → 5 → 7 → 6):
  - [x] **5.1b-1 Tài liệu thiết kế:** `docs/design.md` (token, thang chữ, spacing, cỡ nút sm/md/lg, luật chỉ dùng `components/ui`) + quy tắc 10 trong CLAUDE.md.
  - [ ] **5.1b-2 Điều hướng** (đã làm ở 5.1d-1, DEC-058: tab Phiên · Ghi hand · Thống kê · Cài đặt, Đối thủ/Luật về Thống kê; còn lại: tab Ghi hand gốc, back của màn con khác): tab gốc không có back; màn con back về tab cha; `BottomNav` sáng đúng tab cha. Đề xuất: Đối thủ và Luật chuyển thành con của Trang chủ (trang chủ đã có thẻ Luật; thêm thẻ Đối thủ), bỏ khỏi Cài đặt — dùng lúc chuẩn bị/ghi phiên, không phải cấu hình; sửa `active` trong `bottom-nav.tsx`. Tab Ghi hand: gốc = Ghi nhanh của phiên đang mở (hoặc Tạo phiên); con = trang phiên, danh sách hand, chi tiết hand, Trước phiên, Kết thúc, Tổng kết. Ghi DEC mới.
  - [ ] **5.1b-3 Icon + TopBar:** thêm `lucide-react` (dependency mới — hỏi Đạt trước, ghi DEC thay phần "không thêm dependency" của DEC-044); component `Icon` (cỡ 20/24, `currentColor`); icon cho 4 tab; `TopBar` variant `tab` (không back, có action phải) và `child` (back dạng icon + nhãn); `Button` thêm size `sm`, đổi `md` h-12→h-11, `INPUT_CLASS` h-12→h-11 theo design.md; thêm `Textarea`, `Field`, `Screen`; TopBar cho trang chủ, Trước phiên, Tổng kết.
  - [ ] **5.1b-4 hand-form:** tách `hand-form.tsx` (~490 dòng) thành các khối (thanh ngữ cảnh, bài + vị trí, action theo street, kết quả, stack, suy nghĩ + ⚑, thanh Lưu); thay control style tay trong `hand-form`, `action-rows`, `card-grid`, `shorthand-input` bằng `components/ui`. Không đổi hành vi; luyện tập onboarding vẫn chạy; test xanh.
  - [ ] **5.1b-5 review-form + summary-form:** như 5.1b-4 cho `review-form.tsx`, `summary-form.tsx`, `end-form.tsx`.
  - [ ] **5.1b-6 Thiết bị thật:** `themeColor` theo tối/sáng (khớp `background`), `theme_color`/`background_color` trong manifest, `statusBarStyle`; `viewport-fit=cover` + `safe-area-inset-top` cho thanh ngữ cảnh dính; bàn phím ảo không che nút Lưu. Thử tay iOS Safari + Android Chrome (đã cài PWA); xong thì đóng 5.1b.
  - [ ] **5.1b-7 Quét phần còn lại** (thêm ngoài danh sách ban đầu): `rules`, `stats`, `session-form`, `opponent-form`, `onboarding`, `ai-key-form`, `login` và lẻ tẻ; bỏ `border-red-700` ở chi tiết đối thủ. Xong khi grep `<button|<input|<textarea|<select` ngoài `components/ui` = 0.
- [x] **5.1c** Ghi hand theo action (spec `docs/spec-ghi-hand-theo-action.md`, thay spec 3.5 chế độ Nút; DEC-045):
  - [x] **5.1c-1 State machine:** `packages/poker-core/src/machine/` (spec mục 4–12, 14): thứ tự hành động, nút hợp lệ, mức phải theo, raise tối thiểu, straddle tới 3 nhà, ante MTT, đóng vòng cược/chuyển street, cảnh báo, hoàn tác/sửa action. Thêm `post_ante/post_sb/post_bb/post_straddle` + `dead` vào `ActKind`; hand cũ không có post vẫn tính theo `Blinds`. 24 ca test mục 15 viết trước; ca vàng −360bb và test cũ giữ xanh. Không đụng UI, không đổi schema.
  - [x] **5.1c-2 UI:** bước ① thiết lập hand (bàn mini, straddle, level/ante/giai đoạn MTT), nút theo tình huống, bàn phím "Lên tới", timeline chip, hoàn tác/sửa; ảnh 375px bằng `pnpm screens` (Playwright). Cấu trúc blind MTT và nút Lên level tách sang 5.1c-3; mọi màn đọc `actions` bỏ qua `post_*`/`dead`. Cập nhật spec 3.5.
  - [x] **5.1c-3 Cấu trúc blind MTT:** `poker-core/src/mtt` (parser dán văn bản `level sb/bb ante [phút]`, `levelAt/nextLevel/prevLevel`, `suggestLevel`, `startRow`; test trước). Cấu trúc nằm trong `sessions.mtt.blind_levels` (tùy chọn khi tạo phiên, sửa giữa phiên ở `/sessions/[id]/structure`); thêm cột `hands.level` (migration `20261020210000`, test RLS). Màn Ghi hand: thanh ngữ cảnh "Lv 8 · 300/600 (600)", nút Lên/Lùi level tự điền SB/BB/ante, gợi ý "Có thể đã sang Lv n" theo thời gian (không tự đổi); không có cấu trúc thì SB/BB/ante điền sẵn theo hand trước (sửa lỗi SB không mang sang). Khi có cấu trúc, level vào quyết định blind/ante của phiên. Kết thúc phiên MTT: thêm dòng chi phí. Ảnh 375×550 bằng `scripts/screens-mtt.mjs` (`screens/5.1c-3/`).
  - [x] **5.1c-4 Bố cục màn Ghi nhanh:** luật board mới (nhập lúc nào cũng được, không chặn action; hàm `boardCheck`, `streetTabs` trong poker-core; sửa spec mục 10.4 và ca test 23). Bố cục: thanh ngữ cảnh → thẻ Board (5 ô liền) → một thẻ Action (tab Preflop/Flop/Turn/River, mở rộng dọc, khu nhập trong thẻ) → kết quả → thanh Lưu dính. Thẻ Board và thẻ Action vừa 375×667 khi đang nhập. Ảnh chụp lại bằng `pnpm screens`.
  - [x] **5.1c-5a Số người 2–10 + multiway (core, schema):** `poker-core`: `tableOrder` 2–10 (tên vị trí theo N, `UTG+2`), heads-up (BTN đóng SB, đi trước preflop, đi sau cùng postflop), straddle tối đa min(3, N−3), `legacySeat` (đổi tên vị trí cũ lúc đọc), `remapSeats`, `listedOnly` (chỉ ghế được chọn được theo dõi; action ghế bỏ chọn và phía sau tô đỏ, không xóa), `primaryOpponent`, `duplicateCards`/`takenSuits`. Migration: `hands.opponents jsonb`, CHECK `UTG+2`. Test viết trước cho N = 2, 3, 4, 6, 9, 10. Cập nhật spec.
  - [x] **5.1c-5b Gộp thiết lập vào màn Ghi hand (UI):** bỏ bước thiết lập; thanh ngữ cảnh + bàn mini trượt (Mình / Đối thủ multiway, bộ đếm N người); thẻ bài 7 ô + CardPicker trượt trong thẻ (khóa lá đã dùng); NumPad trong thẻ Action; danh sách đối thủ hiện tất cả (sửa bug chỉ hiện trùng địa điểm); `Stepper`, `Collapse`; cập nhật `docs/design.md` (pixel mục 4–5); ảnh 375×550 và 375×667 bằng `pnpm screens`.
  - [x] **5.1c-6a Evaluator + side pot (core):** hand evaluator 7 lá (10 loại bộ bài, kicker); side pot theo mức đóng góp (người fold vẫn góp tiền, cược không ai theo trả lại, chip lẻ cho người gần trái BTN nhất theo đơn vị blind); `showdown` xác định người thắng từng pot khi đủ bài, cần chọn khi thiếu; đối thủ chính = đối thủ chưa fold có action cuối. Test viết trước; cập nhật spec.
  - [x] **5.1c-6a-fix Trả cược không ai theo:** người đã fold không bao giờ nhận lại tiền (`computePot` và state machine); test viết trước; script dry-run `pnpm recheck:results` quét hand đã lưu (chỉ đọc), chờ Đạt duyệt danh sách trước khi sửa DB.
  - [x] **5.1c-6b Sửa lỗi sau thử tay (UI):** showdown tự chọn theo bài (chọn khác thì cảnh báo và khóa Lưu), chọn người thắng theo từng pot khi thiếu bài, hiện từng pot; nhãn "Đối thủ · BTN" khi multiway; sửa chip action inline (bỏ sheet); panel thiết lập đứng sau dòng tóm tắt dính; gắn tên đối thủ bằng ô nhập có gợi ý và "+ Tạo"; Toggle straddle, chữ nhắc, nhắc chọn lại ghế mình, bộ đếm số người cho phiên MTT. Ảnh 375×550.
- [x] **5.1d** Màn danh sách và chi tiết phiên (nội dung từng task sẽ bổ sung sau):
  - [x] **5.1d-1 Trang chủ danh sách phiên:** `InfoTip`, `StatTile`, `FilterBar` (`Segmented`, `ChipMenu`, `Chip`), `SortHeader`, `SideNav` trong `components/ui`; `SessionRow`, `SessionTable`, `SessionList` trong `components/session`. Điện thoại: tiêu đề + Phiên mới, ô tìm, bộ lọc cuộn ngang, 3 ô theo bộ lọc (Phiên · giờ, Net (bb), bb/giờ), danh sách theo tháng, phiên đang chơi đầu danh sách. Desktop (≥1024px): cột lọc + 3 ô, bảng sắp xếp theo cột. Tính toán ở `poker-core` (`sessionHours`, `sessionTotals`) và `lib/sessions/list.ts` (lọc, nhóm tháng, sắp xếp, bộ lọc trong URL), test viết trước. Điều hướng: tab Phiên · Ghi hand · Thống kê · Cài đặt (`lib/nav.ts`), Đối thủ và Luật chuyển sang tab Thống kê, back về `/stats` (một phần của 5.1b-2, DEC-058). Ảnh `screens/5.1d-1/` bằng `node scripts/screens-home.mjs`.
  - [x] **5.1d-1b Sửa nhỏ (DEC-059):** Net theo loại, bb/giờ ghi số phiên, nhắc phiên mở quá 16 giờ, nhãn "Phiên", ba ô cao bằng nhau.
  - [x] **5.1d-2 Chi tiết phiên, bảng hand, replayer.** Chia hai phần, duyệt riêng:
    - [x] **5.1d-2a Chi tiết phiên + bảng hand (DEC-060):** `actionChips`, `wentToShowdown` ở poker-core; trang `/sessions/[id]` (bốn ô, nút theo trạng thái, bộ lọc trong địa chỉ), bảng hand dùng chung (điện thoại 4 dòng, desktop 12 cột + khung phải, ↑ ↓ R), Sửa phiên, Xóa phiên có xác nhận. Ảnh `screens/5.1d-2a/` bằng `node scripts/screens-session.mjs`.
    - [x] **5.1d-2b Replayer (DEC-061):** bàn mini theo N người, timeline chip và ‹ › đi từng action (pot, stack tính bằng poker-core), showdown với bài đối thủ, tên bộ bài và từng pot; khối AI review ngay dưới ("Ý kiến thứ hai", nhãn "Thử nghiệm", phiên bản prompt, Phản biện; chưa có thì nút AI review theo quota); một câu suy nghĩ, nhãn, nút Sửa hand. Dùng cho trang Chi tiết hand và khung phải desktop.
  - [x] **5.1d-3 Sửa sau thử tay trên điện thoại** (desktop thử sau):
    - [x] **5.1d-3a potType:** all-in vượt mức cược (hoặc all-in không rõ số tiền) tính là một lần raise; thêm loại `iso` (raise sau limper). Nhãn ngắn SRP · 3bet · 4bet+ · ISO · Limp, không InfoTip. Test trước, gồm hand #1 hiện tại.
    - [x] **5.1d-3b Bộ chuyển ghi tắt → actions:** `actionsFromLegacy` qua state machine (thêm forced bet theo phiên), lý do thất bại cố định; test với hand cũ trong DB và legacy. Sửa hand cũ mở ở chế độ Theo action, chỉ rơi về ghi tắt khi chuyển thất bại (kèm lý do). Dùng lại cho 5.2.
    - [x] **5.1d-3c Đơn vị Chip:** cột `sessions.chip_value`, `chip_currency` (migration); 2 phiên VND (thực chất nghìn đồng) và phiên CHIP sẵn có → CHIP, 1 chip = 1000 VND (script dry-run, Đạt duyệt danh sách). Hiển thị chip + bb, có tỉ giá thì thêm tiền ở dòng phụ.
    - [x] **5.1d-3d Form phiên:** tạo và sửa dùng chung; ngày, giờ vào (mặc định lúc này), giờ ra (trống được); 4 nhóm (Loại & hình thức → Địa điểm & thời gian → Đơn vị & blind → Khác); nút Tạo/Lưu dính đáy; đơn vị Chip mặc định cho Live, ô "1 chip = …"; một dòng tóm tắt cuối form. Tạo xong: không có giờ ra → Ghi hand, có → chi tiết phiên.
    - [x] **5.1d-3e Điều hướng:** bỏ tab Ghi hand, 3 tab Trang chủ · Thống kê · Cài đặt có icon (`lucide-react`); màn con có thanh trên dính và `<` (back qua history); vuốt mép trái để back trên iOS PWA.
    - [x] **5.1d-3f Trang chủ + chi tiết hand:** bỏ nhãn/viền "Đang chơi" (hàng ghi "Chưa kết thúc"), giữ nhắc quá 16 giờ; ⋯ (Sửa · Xóa) mỗi hàng, "+ Hand" ở hàng gần nhất; thanh lọc ẩn thanh cuộn, mờ mép phải; InfoTip tự lật, không tràn; "Cài app" chuyển vào Cài đặt. "AI phân tích" + ! "Mang tính chất tham khảo"; chưa có review chỉ hiện nút + lượt, có review hiện chỉ đọc + "Đã review" + Phản biện; câu "Hand lưu trước bản cập nhật, chưa có dữ liệu chia pot" chỉ khi không tính được pot (heads-up tính lại từ outcome). Ảnh 375px `screens/5.1d-3/`.
  - [x] **5.1d-4 Giao diện desktop (≥1024px, DEC-068):** thay đổi ở component dùng chung áp cả điện thoại.
    - Khung: thanh trên (nút thu/mở menu + HoldNote); menu trái thu/mở (thu còn cột icon), Cài đặt ghim đáy, nhớ trạng thái (localStorage, try/catch); khung nhập liệu chung (nội dung giữa + cột tóm tắt dính bên phải chứa nút chính) cho form phiên và Ghi/Sửa hand.
    - Trang chủ: thẻ phiên còn mở thành dải ngang (mô tả · giờ kết thúc · "Kết thúc phiên" · nút phụ "Để sau"); một hàng lọc trên 3 ô chỉ số xếp ngang (Tìm · Tất cả|Cash|MTT · Tháng · Địa điểm · Kết quả chọn một · Cần xem lại · "✕ Xóa lọc" chỉ khi đang lọc); sửa lỗi Thắng + Thua ra 0 phiên; ô Net: Chip chưa quy đổi hiện bb, trộn đơn vị hai dòng; cả hàng bảng bấm được, cột ⋯ (Sửa · Xóa); "Phiên mới" là nút nổi.
    - Form phiên: 4 khối lưới 2 cột + tóm tắt dính kèm nút; đơn vị "Chip | Tiền tệ ▾", "1 chip = [số] [tiền tệ ▾]" một dòng; sửa lỗi Sửa phiên nạp sai ngày/giờ (test).
    - Ghi/Sửa hand: 3 cột (bàn mini + thiết lập · bài + Action · cột Kết quả dính có nút Lưu); "Kết quả <số>" → "Nhận về", số lời thật "Lời/lỗ"; phím tắt (lá bài, F C X B R O A, số + Enter, Z, ← →, ? xem bảng), không kích hoạt khi đang gõ trong ô chữ (test).
    - design.md: khung desktop, phím tắt, luật "mọi thao tác là nút, link chỉ để điều hướng"; đổi các link-thao tác còn lại sang nút. Ảnh 1440/1024/375px `screens/5.1d-4/`.
- [x] **5.1e Khối AI và review ở Chi tiết hand (DEC-065):** phản biện luôn gọi AI (hand + bài phân tích hiện hành + lập luận), AI trả giữ/sửa + lý do, hiện dạng hội thoại ngay dưới; sửa thì các ô AI cập nhật, bản cũ vào lịch sử; mỗi bài phân tích 1 lần phản biện miễn phí, sau đó trừ 1 lượt, hiện trước khi gửi (bảng `review_rebuttals`, `ai_usage.kind = rebuttal_free`, migration `20261021180000`). Ngữ cảnh AI có bộ bài của Hero từng street (`heroHandByStreet`, `describeRank` ở poker-core). Bỏ nhãn phiên bản prompt; "Có AI phân tích", "Tôi đã xem lại"; "Chạy lại AI review" là nút phụ, chỉ hiện khi hand sửa sau review; thẻ "Bạn tự review" riêng có trạng thái. Ảnh 375px `screens/5.1e/` bằng `node scripts/screens-5.1e.mjs`.
- [x] **5.1f Kiểm lá bài AI nêu + nhãn "Đã xem lại" (DEC-066):** quét lá bài trong review và phản biện (`lib/ai/card-check.ts`); lá gán cho Hero/board không có trong hand → thử lại 1 lần kèm bài đúng, vẫn sai → lưu, màn hand hiện "AI có thể đã đọc sai bài"; chi phí lần thử lại cộng ngân sách app. Nhãn "Đã review" ở bộ lọc/thống kê → "Đã xem lại". Chạy thật 5 hand bằng `node scripts/ai-cards-run.mjs`.
- [x] **5.1g Bộ kiểm ngôn ngữ xét chung (DEC-067):** gộp mọi ô chữ rồi mới đánh giá (tỉ lệ từ có dấu ≥ 15% với tiếng Việt, ≤ 5% với tiếng Anh), không đánh trượt ô chỉ có thuật ngữ poker tiếng Anh; prompt v1 thêm luật 13 dùng đúng tên bộ bài Hero từng street (chỉ khi ngữ cảnh có dòng đó). `scripts/ai-cards-run.mjs` 2 lần: 0 `invalid_output`.
- [ ] 5.2 Script migrate `legacy/data` → tài khoản chủ dự án.
  - Đơn vị (5.1d-3): phiên legacy là nghìn đồng ngầm → nhập là `CHIP`, `chip_value = 1000`, `chip_currency = 'VND'`; chuỗi `line` đổi bằng `actionsFromLegacy` (5.1d-3b).
  - Yêu cầu thêm (DEC-054): hand cũ chỉ có chuỗi ghi tắt (`line`), nên script đổi chuỗi đó thành `actions` qua state machine (kèm blind/ante bắt buộc, vị trí, stack) thay vì chỉ lưu `raw_line`. Mục đích: sau migrate, benchmark đọc hand từ DB và đo được ngữ cảnh mới (straddle, ante, multiway, side pot, loại pot).
  - Giờ phiên (5.1d-1): app cũ lưu `start`/`end` dạng `HH:MM` (1 phiên thiếu `end`, 3 phiên qua nửa đêm). Script ghép `date` + giờ thành `start_at`/`end_at`, cộng một ngày khi `end` < `start`, để bb/giờ và thời lượng ở trang Phiên có số.
  - Sau 5.2: chạy lại benchmark (`BENCH_RUNS=3`, v1 và v2) trên hand đã migrate và ghi kết quả vào DECISIONS.
  - Ghi chú: AI review sẽ hiện "ý kiến thứ hai" và nhãn thử nghiệm trước beta (làm ở 5.1d-2, chưa có trong danh sách).
- [ ] 5.2b Ô "Toán" của review do poker-core điền (pot odds, MDF, SPR, bộ bài Hero từng street); AI không viết ô này nữa. Review cũ giữ nguyên.
- [ ] 5.3 Hoàn thiện bản tiếng Anh, cài đặt, xuất/xóa dữ liệu.
  - Thêm mục "Giải thích thuật ngữ" trong Cài đặt (SRP, 3bet, 4bet+, ISO, Limp, MDF, SPR…); nhãn loại pot trong bảng hand không có InfoTip (5.1d-3).
- [ ] 3.6 Benchmark model Claude — hoãn, làm trước khi chốt gói giá.
- [ ] 5.4 Deploy Vercel + domain holdnote.app.
