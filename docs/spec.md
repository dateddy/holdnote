# Spec v1 — HoldNote (Sổ Tay Hand)

Bản xuất từ tài liệu spec trên claude.ai ngày 02/10/2026. Khi spec gốc thay đổi, xuất lại file này.

## 0. Tên app
**HoldNote** (Hold'em + note). Bản tiếng Việt giữ phụ đề "Sổ Tay Hand". Domain chính dự kiến: holdnote.app.

## 1. Tổng quan
Web app (PWA) để người chơi poker ghi hand trong dưới 30 giây, rồi được AI review và theo dõi leak qua nhiều phiên. Mỗi người một tài khoản. Thị trường đầu: Việt Nam và châu Á, sau đó châu Âu.

**Định vị:** nhật ký học poker. Không liên kết, không quảng bá sòng hay site tiền thật.

**Người dùng mục tiêu**
| Nhóm | Nhu cầu | Ưu tiên |
|---|---|---|
| Người chơi live, stake thấp–trung bình | Ghi nhanh tại bàn, review khi về nhà | 1 |
| Người chơi online micro stakes, cash và MTT | Ghi hand quan trọng, tìm leak | 1 |
| Người mới học | Được giải thích vì sao sai, bằng ngôn ngữ của mình | 2 |
| Coach và học trò | Học trò cấp quyền cho coach xem phiên/hand; coach viết review và gắn nhãn lỗi trong hand của học trò | Bản 2 |

**Điểm khác biệt:** (1) AI review bằng ngôn ngữ người dùng theo checklist cố định: range, toán, line đề xuất, loại lỗi, EV, bài học. (2) Bảng leak qua nhiều phiên. (3) Hợp thói quen châu Á: chip theo nghìn, straddle, nhiều loại tiền tệ.

**Phạm vi MVP**
| Nhóm | Bản 1 | Bản 2+ |
|---|---|---|
| Tài khoản | Email (magic link), Google; mỗi người một kho dữ liệu riêng. **Bắt buộc đăng nhập, không có chế độ dùng thử.** | Apple, số điện thoại |
| Ghi hand | Lưới chọn bài; nhập bằng nút (mặc định) hoặc ghi tắt H/V; tự tính pot, kết quả, eff stack | Giọng nói, nhập từ ảnh |
| Phiên | Cash và MTT, live và online, stop-loss, tổng kết, tự chấm điểm | Lịch, nhắc trước phiên |
| Review | Ô review tay, nút AI review, giới hạn lượt theo gói | Review cả phiên một lần, chat về hand |
| Thống kê | Bảng leak, kết quả theo phiên, bb/giờ, ROI/ITM cho MTT | Lọc theo vị trí, loại pot, line |
| Đối thủ | Ghi chú, phân loại, nút chạm tên khi ghi hand | AI tổng hợp read |
| Xuất dữ liệu | Text, JSON toàn bộ | Định dạng PokerStars, replayer, chia sẻ link |
| Ngôn ngữ | Việt, Anh | Trung (ưu tiên 1), Thái, Hàn; Nhật sau |
| Thanh toán | Chỉ gói miễn phí và gói tự mang key | Gói trả phí |
| Nền tảng | Web, cài được lên màn hình chính, chạy khi mất mạng | iOS, Android |

## 2. Kiến trúc và stack
Next.js + Supabase + Vercel, một repo. Client đọc/ghi dữ liệu thẳng với Supabase, chặn bởi RLS. Chỉ lệnh gọi AI đi qua server route (giữ key, kiểm quota). Phần tính toán poker chạy trên máy người dùng nên ghi hand được khi mất mạng.

| Lớp | Chọn | Lý do |
|---|---|---|
| Frontend | Next.js App Router, TypeScript, Tailwind | Một codebase cho web và server routes |
| PWA/offline | Service worker, IndexedDB làm hàng đợi | Ghi hand khi sóng yếu, có mạng thì đồng bộ |
| Backend | Supabase: Auth, Postgres, RLS, Vault | Auth và phân quyền có sẵn |
| AI | OpenRouter qua server route | Một API nhiều model |
| i18n | next-intl | Thêm ngôn ngữ = thêm file |
| Hosting | Vercel | Miễn phí khi beta |
| Mobile sau này | React Native (Expo) dùng lại `poker-core` + Supabase | Giữ backend và logic |

## 3. Màn hình (11 màn)
Màn quan trọng nhất là **Ghi nhanh**: người mới phải ghi được một hand trong 60 giây đầu.

**Luồng chính:** đăng ký → onboarding 3 bước → tạo phiên, đọc Trước phiên → ghi hand tại bàn → kết thúc phiên, nhập cash-out → review từng hand (tay/AI), tổng kết phiên → xem bảng leak, mang luật mới vào phiên sau.

### 3.1 Đăng nhập
Google hoặc email magic link. Phải đăng nhập mới dùng được.

### 3.2 Onboarding (3 bước, bỏ qua được)
1. Ngôn ngữ và đơn vị tiền (VND theo nghìn, USD, EUR, KRW, JPY, THB, chip).
2. Chơi chủ yếu: Live/Online · Cash/MTT.
3. Xem một hand mẫu đã review, rồi thử ghi lại chính hand đó có hướng dẫn.

### 3.3 Trang chủ = danh sách phiên (DEC-058)
Tab **Phiên**. Tiêu đề + nút **Phiên mới**; ô tìm theo địa điểm, ghi chú tổng kết, tên giải; bộ lọc: Tất cả | Cash | MTT, Tháng ▾, Địa điểm ▾, Thắng, Thua, Cần xem lại (chip bật/tắt chọn nhiều; Thắng và Thua cùng bật = một trong hai; phiên có hand ⚑ chưa có review được chấp nhận là cần xem lại); bộ lọc nằm trong địa chỉ trang. Ba ô theo bộ lọc: **Phiên** (dòng phụ: tổng giờ), **Net**, **bb/giờ** (mỗi ô có dấu ? giải thích một câu). Net theo bộ lọc loại: Tất cả và MTT hiện tiền (cash + MTT cộng bằng tiền, mỗi đơn vị tiền một số); Cash hiện bb, dòng phụ là tiền. bb/giờ = tổng bb ÷ tổng giờ của phiên cash có giờ kết thúc, InfoTip ghi "Tính trên N phiên có giờ kết thúc"; phiên thiếu giờ ra hiện "—" ở cột bb/giờ; MTT không tính bb/giờ. Phiên mở quá 16 giờ: lần mở app sau hiện thẻ nhắc kết thúc phiên ở đầu trang, chọn giờ ra (mặc định giờ hand cuối + 15 phút, không quá hiện tại), "Để sau" ẩn thẻ trong lần xem đó. Danh sách nhóm theo tháng (tiêu đề tháng kèm net tháng); phiên chưa kết thúc nằm đầu, viền accent, chữ "Đang chơi", chạm vào thì vào bàn (Ghi hand, hoặc Trước phiên nếu chưa Vào bàn). Hàng phiên: ngày · địa điểm · loại (Cash 25/50, MTT + buy-in); thời lượng · số hand · số cần xem lại; bên phải net bb và tiền (MTT: tiền và hạng). Từ 1024px: cột trái lọc + ba ô, cột phải bảng sắp xếp được (Ngày · Loại · Địa điểm · Blind/Buy-in · Thời lượng · Hand · Net · bb/giờ · Xem lại). Leak lặp lại ở tab Thống kê; Đối thủ và Luật là thẻ trong tab Thống kê; số lượt AI còn lại ở Cài đặt.

### 3.4 Tạo phiên và Trước phiên
- Cash: địa điểm/site, stake, BB, straddle, số ghế, buy-in, stop-loss.
- MTT: tên giải, buy-in, loại giải, level vào, stack vào, ante. Cấu trúc blind tùy chọn (DEC-056): danh sách level (số level, SB, BB, ante, loại ante, số phút); thêm từng dòng hoặc dán văn bản, mỗi dòng `level sb/bb ante [phút]` (vd `8 300/600 600 20`, dòng không hợp lệ bị bỏ qua và báo số dòng đọc được). Có cấu trúc thì level vào quyết định SB/BB/ante của phiên; sửa được giữa phiên.
- Điền sẵn giá trị phiên trước.
- Trước phiên: luật của bạn, stop-loss, ghi chú đối thủ quen ở địa điểm đó; bấm **Vào bàn**.

### 3.5 Ghi nhanh (màn lõi)
1. **Bài và board:** 7 ô (2 lá mình, flop, turn, river) dùng chung lưới số + chất; tự nhảy ô; nút "không nhớ chất" (`?`); lá đã chọn bị mờ.
2. **Vị trí:** của mình, đối thủ chính; nút tên đối thủ đã có ghi chú.
3. **Hành động – chế độ nút (mặc định):** *đã được thay bằng `docs/spec-ghi-hand-theo-action.md` (DEC-045, DEC-046); mô tả dưới đây chỉ còn là bản cũ.*  mỗi street một hàng. Chạm người hành động (Mình/Đối thủ/vị trí khác), chạm hành động (check, bet, call, raise, fold, all-in). Bet/raise chọn nhanh 1/3, 1/2, 2/3, pot hoặc gõ số. Pot hiện sau mỗi bước.
4. **Hành động – chế độ ghi tắt:** ô `H o600 V c / ...` có hàng phím nhanh `H V x c b r f ai / ⌫`. Hai chế độ chuyển qua lại, cùng ra một dạng dữ liệu.
5. **Kết quả:** Thắng/Thua/Fold/Chia, số tiền tự tính, sửa tay được. Có showdown thì hiện ô bài đối thủ.
6. **Stack:** stack mình tự cộng trừ sau mỗi hand (hand đầu lấy buy-in); stack đối thủ gõ khi cần; eff stack và SPR tự hiện.
7. Một câu suy nghĩ + cờ ⚑.
8. **Lưu:** khóa nút 2 giây, toast có Hoàn tác; mất mạng vẫn lưu, có mạng tự đồng bộ.

Tối thiểu để lưu: 2 lá bài của mình hoặc cờ ⚑. Thiếu kết quả hoặc eff stack → nhãn **Thiếu dữ liệu**.

### 3.6 Chi tiết phiên và danh sách hand (DEC-060)
Trang `/sessions/[id]` thay cả "danh sách hand" cũ. **Thanh trên:** quay lại, tên phiên (giải MTT hoặc địa điểm), nút ⋯ (Sửa phiên, Sửa cấu trúc blind nếu MTT, Xóa phiên có xác nhận; xóa kéo theo hand và review). **Bốn ô** cao bằng nhau, mỗi ô có ?: Cash: Thời gian · hand, Net (bb, dòng phụ tiền; phiên chưa kết thúc cộng các hand đã ghi), bb/giờ (chỉ khi có giờ kết thúc), Cần xem lại. MTT: Buy-in (dòng phụ re-entry), Hạng, Tiền thưởng (cộng bounty), Cần xem lại. **Nút theo trạng thái:** chưa vào bàn → Trước phiên; đang chơi → Ghi hand + Kết thúc phiên; đã kết thúc chưa tổng kết → Tổng kết (nổi bật); đã tổng kết → Xem tổng kết + Ghi thêm hand (nhỏ). **Bộ lọc hand** (trong địa chỉ trang): Cần xem lại, Showdown, Vị trí ▾ (của mình), Loại pot ▾, (MTT) Giai đoạn ▾, Sắp xếp ▾ (Mới nhất · Thắng nhiều · Thua nhiều · Pot lớn).
**Bảng hand** (`components/hand-list`, dùng chung, có thể thêm cột Phiên cho danh sách xuyên phiên). Điện thoại, mỗi hand: dòng 1 `#, vị trí vs vị trí, loại pot` + kết quả bb; dòng 2 bài mình và board (bộ 4 màu, vạch ngăn flop | turn | river), MTT thêm "Lv · giai đoạn"; dòng 3 chip action mỗi street một dòng (xanh = mình, cam = đối thủ, số = bb); dòng 4 nhãn (Cần xem lại, AI đã review, Thiếu dữ liệu) và trích ghi chú. Desktop (≥1024px) kiểu danh sách–chi tiết (DEC-061). **Chưa chọn hand:** bảng đủ 12 cột rộng hết màn, không cuộn ngang, không khung phải: # · Vị trí · Bài · Board · Loại pot · Preflop · Flop · Turn · River · Pot · Kết quả · Nhãn; ô street chứa chip (màu thay cho chữ Mình/Đối thủ, tên có cho trình đọc màn hình). **Chọn hand** (chạm hàng): bảng thu thành cột trái 420px dùng hàng 4 dòng của bản điện thoại, phần còn lại là replayer (3.7) và khối review; Esc hoặc ✕ đóng, bảng mở lại đủ cột; hand đang mở nằm trong địa chỉ (`?hand=`). Phím: ↑ ↓ đổi hand (khi chưa chọn, ↓ chọn hand đầu), R bật/tắt ⚑, ← → đi từng action. Điện thoại: chạm hàng mở trang Chi tiết hand (Back về đúng bộ lọc). Chip lấy từ `poker-core` (`actionChips`, `potType`, `wentToShowdown`); giao diện không tự tính luật.

### 3.7 Chi tiết hand: replayer và review
**Replayer** (trang `/hands/[id]` và khung phải desktop): kết quả bb thật to (tiền ở dòng phụ); bàn mini theo N người, ghế mình (xanh) và đối thủ (cam), stack bb từng ghế, số bb đã cược trước ghế, board giữa bàn (chỉ lá đã chia tới street hiện tại) cùng pot bb (tiền ở dòng phụ); timeline chip theo street, chạm chip để nhảy tới, nút ‹ › (và phím ← →) đi từng action, bàn cập nhật pot và stack theo từng bước (`replayFrames` của poker-core; MTT theo `level_bb` của hand); mở ra ở kết quả. Ở bước cuối: showdown (bài mình và đối thủ, tên bộ bài, từng pot: pot chính / pot phụ, người thắng; hand không cần showdown thì ghi vậy). Dưới cùng: một câu suy nghĩ, nhãn, nút **Sửa hand** (`/hands/[id]/edit`, màn Ghi hand ở chế độ sửa). Khối review ngay dưới, trình bày là **"Ý kiến thứ hai"** kèm nhãn **"Thử nghiệm"** và dòng nhắc AI chỉ gợi ý.
Khối review: range đối thủ, toán, line đề xuất, loại lỗi (nhãn), EV, ICM (MTT), bài học, đã review. Nút **AI review** (ô AI điền có nhãn "AI" tới khi người dùng sửa/chấp nhận; hiện số lượt còn lại). Nút **Phản biện** (người dùng viết lý do, AI xem lại; tính 1 lượt).

### 3.8 Tổng kết phiên
Hai bước (DEC-044). **Kết thúc phiên** (lúc rời bàn): cash-out (MTT: hạng, tiền thưởng, bounty, giai đoạn bị loại), trạng thái (tỉnh táo/mệt/tilt), hiện kết quả (tiền và bb), bb/giờ, cảnh báo stop-loss; đặt `end_at`. **Tổng kết** (làm sau review hand): tự chấm A/B/C/D, điểm tốt, leak (nhãn), luật phiên sau, ghi chú. Nút **AI tổng kết**.

### 3.9 Đối thủ
Tên/đặc điểm, loại người chơi, địa điểm hay gặp, ghi chú, danh sách hand đã gặp.

### 3.10 Thống kê và leak
Bảng leak (số hand, số phiên mỗi loại lỗi; xu hướng 5 phiên gần nhất). Biểu đồ kết quả cộng dồn, lọc cash/MTT, live/online, địa điểm, stake. MTT: số giải, ROI, ITM%, giai đoạn bị loại nhiều nhất. Kỷ luật: số phiên vi phạm stop-loss, số phiên chơi khi tilt.

### 3.11 Cài đặt
Ngôn ngữ, đơn vị tiền, hiển thị tiền/bb, chế độ nhập mặc định, luật của bạn, gói AI và số lượt, nhập API key riêng, xuất toàn bộ dữ liệu, xóa tài khoản.

## 4. Database
Postgres trên Supabase, 8 bảng. Mọi bảng dữ liệu người dùng có `user_id` và RLS `user_id = auth.uid()`.

**Lưu tiền:** đơn vị của phiên (`sessions.currency`), `numeric(14,2)`. Số bb tính khi hiển thị, trừ MTT lưu `level_bb` mỗi hand.

| Bảng | Trường chính |
|---|---|
| `profiles` | `id` (= auth user), `display_name`, `locale`, `currency`, `display_unit` (money/bb), `entry_mode` (buttons/shorthand), `plan` (free/byok/pro), `onboarded_at` (null = chưa xong onboarding), `play_mode` (live/online), `play_kind` (cash/mtt), `created_at` |
| `sessions` | `id`, `user_id`, `kind` (cash/mtt), `mode` (live/online), `venue`, `date`, `start_at`, `end_at`, `currency` (đơn vị tiền của phiên, mặc định lấy từ profile), `stake_label`, `sb`, `bb`, `straddle`, `ante_mode` (none/each/bb), `ante`, `seats`, `buyin`, `cashout`, `stop_loss`, `table_read` jsonb, `self_state`, `mtt` jsonb (tên giải, loại, re-entry, level vào, `blind_levels` [{level, sb, bb, ante, ante_mode, minutes}], số lần re-entry, hạng, số người, tiền thưởng, giai đoạn bị loại; kết quả MTT = tiền thưởng + bounty − buy-in × (1 + số re-entry)), `summary` jsonb (điểm, điểm tốt, leak tags, luật phiên sau, nhận xét), `created_at`, `updated_at` |
| `hands` | `id`, `user_id`, `session_id`, `num`, `hero_cards`, `board` (≤5 lá), `villain_cards`, `hero_pos`, `villain_pos` (đối thủ chính), `opponent_id`, `opponents` jsonb (mọi đối thủ được chọn, theo thứ tự chọn: `{pos, stack?, opponent_id?, cards?}`), `pot_winners` jsonb (người thắng từng pot khi người dùng chọn: mảng, mỗi phần tử là mảng ghế hoặc null; pot chính trước), `actions` jsonb, `raw_line`, `outcome`, `result`, `pot_final`, `hero_stack`, `villain_stack`, `eff_stack`, `level_bb`, `level` (số level MTT, null = không có/không biết), `ante_mode` (null = theo phiên), `ante`, `players_dealt` (số người được chia bài hand đó, 2–10; vị trí gồm UTG+2), `stage`, `players_left`, `thought`, `question`, `flagged`, `tags` text[], `missing_data`, `created_at`, `updated_at` |
| `reviews` | `id`, `user_id`, `hand_id`, `source` (manual/ai), `model`, `prompt_version` (v1/v2, null = tay/không rõ), `range_text`, `math_text`, `line_text`, `icm_text`, `error_tags` text[], `ev_verdict` (correct/mistake/unsure), `lesson`, `accepted`, `is_current`, `created_at` |
| `opponents` | `id`, `user_id`, `name`, `player_type`, `venue`, `notes`, `updated_at` |
| `user_rules` | `id`, `user_id`, `text`, `source_session_id`, `active`, `sort` |
| `ai_usage` | `id`, `user_id`, `kind` (hand_review/rebuttal/session_summary), `model`, `tokens_in`, `tokens_out`, `cost_usd`, `billed_to` (app/user), `failed` (lượt gọi hỏng: cộng ngân sách app, không trừ lượt), `created_at` |
| `user_api_keys` | `user_id`, `provider`, `model` (null = mặc định), `vault_secret_id` (uuid trỏ tới secret trong Supabase Vault; key không nằm trong bảng), `created_at`. Client không bao giờ đọc lại key. |

Quan hệ: user → nhiều phiên → nhiều hand → nhiều review (chỉ một `is_current = true`). Hand có thể trỏ tới một đối thủ. Xóa phiên thì xóa theo hand và review.

### 4.2 `hands.actions`
```json
[
  {"street": "preflop", "actor": "hero", "pos": "BTN", "act": "raise", "amount": 600},
  {"street": "preflop", "actor": "villain", "pos": "BB", "act": "call", "amount": 600},
  {"street": "flop", "actor": "villain", "pos": "BB", "act": "check"},
  {"street": "flop", "actor": "hero", "pos": "BTN", "act": "bet", "amount": 800}
]
```
`act`: `check | bet | call | raise | fold | all-in`, cộng forced bet `post_ante | post_sb | post_bb | post_straddle` (street `preflop`, đứng đầu mảng, `amount` = số đã đóng) và `dead` (tiền chết "+ tiền khác"). Preflop không có `post_*` (hand cũ, ghi tắt) thì blind/ante tính từ `blinds` của phiên. DEC-045.
`actor`: `hero` | `villain` | `other`. `amount` = tổng tiền người đó đã bỏ vào street đó sau hành động (kiểu "raise to").

### 4.3 Bảng leak
Không cần bảng riêng: view từ `reviews.error_tags` (chỉ review hiện tại) gộp theo phiên + nhãn leak trong `sessions.summary`. Mã lỗi cố định có bản dịch, ví dụ `preflop_too_loose`, `sizing_too_small`, `bluff_multiway`, `tilt`, `read_right_act_wrong`.

### 4.4 Migrate từ Sổ Tay Hand
Script đọc `legacy/data/{sessions,hands,notes}`, đổi tên trường, chuyển `line` → `actions`, đưa `rRange`, `rMath`, `rSolver`, `rErr`, `rEv`, `rLesson`, `rIcm`, `rDone` vào `reviews`, `notes` → `opponents`. Thành tài khoản đầu tiên của chủ dự án.

## 5. AI review
Một lần bấm = một lần gọi model cho một hand, trả JSON theo schema cố định. Toán do code tính sẵn.

### 5.1 Luồng
1. Client `POST /api/review` với `hand_id`.
2. Server kiểm quyền sở hữu và số lượt tháng. Hết lượt → lỗi kèm gợi ý dùng key riêng.
3. Dựng ngữ cảnh: chuỗi hành động có pot sau mỗi bước, toán tính sẵn (pot odds, MDF, SPR, eff stack bb), phiên (stake, live/online, cash/MTT), loại đối thủ + ghi chú, 3 leak hay gặp.
4. Gọi OpenRouter (hoặc key riêng), yêu cầu JSON.
5. Kiểm bằng Zod. Sai → gọi lại 1 lần kèm lỗi; vẫn sai → báo lỗi, không trừ lượt.
6. Lưu `reviews` (`source = ai`, `is_current = true`, review cũ thành lịch sử) + một dòng `ai_usage`.

### 5.2 Tầng model
| Gói | Model | Giới hạn | Ai trả |
|---|---|---|---|
| Miễn phí | Model rẻ hỗ trợ JSON qua OpenRouter | 30 review hand + 4 tổng kết phiên/tháng | Chủ dự án |
| Tự mang key | Người dùng chọn | Không giới hạn, chặn spam 30 lần/giờ | Người dùng |
| Trả phí (bản 2) | Model mạnh | ~200 review/tháng | Người dùng |

Chọn model: benchmark 3–4 model trên ~30 hand đã review kỹ trong `legacy/data`, so độ trùng loại lỗi và EV, tỷ lệ JSON hợp lệ, chi phí/hand, chất lượng tiếng Việt.

### 5.3 Prompt hệ thống
Bản đầy đủ nằm trong code, là nguồn duy nhất: `apps/web/src/lib/ai/prompt.ts` (lõi tiếng Anh, cố định cho mọi người dùng, cache được) và `apps/web/src/lib/ai/languages.ts` (gói ngôn ngữ). DEC-037.

Lõi (tóm tắt): huấn luyện viên review MỘT hand, chấm theo EV, không theo kết quả. Dữ kiện nhận được: hành động có vị trí và pot sau mỗi bước; danh sách quyết định của Hero có % pot của mỗi bet/raise, pot odds, MDF; eff stack bb, SPR; loại game; đối thủ và ghi chú; câu suy nghĩ của người chơi; leak hay gặp.

Quy tắc chính: chỉ dùng dữ kiện đã cho; chấm cả hand từng street (quyết định cuối đúng không làm hand đúng); kiểm size theo bảng chuẩn tham chiếu cho stake thấp (chỉ báo lỗi size khi lệch rõ); nghĩ theo stack bb (≤15bb: shove/fold); so câu suy nghĩ với hành động (misread_range, read_right_act_wrong, tilt); `unsure` khi phụ thuộc read hoặc thiếu thông tin; mã lỗi chỉ lấy trong danh sách cố định; lesson 2–4 ý đánh số, tối đa 100 từ, các ô khác tối đa 80 từ; ngôn ngữ trả lời theo `profiles.locale`.

Gói ngôn ngữ (đặt ở đầu và cuối user message): hướng dẫn viết bằng chính ngôn ngữ đó, ví dụ mẫu, hàm kiểm tra (sai thì gọi lại 1 lần; sai nữa thì báo lỗi, không trừ lượt). Tiếng Việt: gọi "mình" / "đối thủ" / "bạn", giữ thuật ngữ poker tiếng Anh (pair, two pair, set, straight, flush, check back, c-bet, 3-bet, iso, shove, ...). Ngôn ngữ chưa có gói dùng tiếng Anh.

### 5.4 Schema output
```json
{
  "range": "string",
  "math": "string",
  "line": "string",
  "icm": "string (empty for cash)",
  "error_tags": ["sizing_too_small"],
  "ev_verdict": "correct | mistake | unsure",
  "key_mistake_street": "preflop | flop | turn | river | none",
  "repeats_known_leak": true,
  "lesson": "string",
  "missing_info": ["villain stack"]
}
```

### 5.5 Giữ chi phí thấp
Một hand mỗi lần; prompt hệ thống + danh sách mã lỗi đứng đầu, cố định (prompt caching); giới hạn 80 từ/trường (lesson 100 từ); hand chưa sửa từ lần review trước → trả review cũ; ngân sách cứng gói miễn phí $20/tháng, vượt thì khóa AI gói miễn phí tới đầu tháng sau.

### 5.6 AI tổng kết phiên
Input: review hiện tại của phiên (rút gọn), kết quả, trạng thái tự khai. Output: điểm gợi ý, 3 điểm tốt, 3 leak theo thiệt hại, tối đa 4 luật phiên sau. Người dùng sửa rồi mới lưu.

## 6. Logic tính toán (`packages/poker-core`)
| Phần | Input | Output | Ghi chú |
|---|---|---|---|
| Parser ghi tắt | `H o600 V c / V x H b800 V c` | `actions` | Cú pháp: `o lp x b c r 3b 4b 5b l cr ai f d`, số `600`, `1k5`, `2k`, tiền tố vị trí `BTN-o600`, `all-in` = `ai`, `/` tách street, lá board có thể đứng đầu street. Báo lỗi từng token không hiểu. |
| Pot | `actions`, blinds, ante, straddle | Pot sau mỗi hành động và cuối street | Tiền thừa của bên bet lớn nhất được trả lại. BB ante kiểu GG/N8 cho MTT. |
| Kết quả | Pot, tiền hero đã bỏ, outcome | Thắng/thua | Thắng = pot − đã bỏ; Chia = pot/2 − đã bỏ; Thua/Fold = − đã bỏ. Chưa tính side pot. |
| Eff stack, SPR | 2 stack, pot | Eff (tiền, bb), SPR mỗi street | Eff = min. |
| Toán cho AI | `actions` | Pot odds, MDF mỗi lần hero đối mặt bet/raise | |
| Stack tự cập nhật | Stack trước, kết quả | Stack hand sau | Hand đầu lấy buy-in. |
| Bảng leak | Review theo phiên | Số hand/phiên mỗi lỗi, xu hướng 5 phiên | "Lặp lại" = ≥3 trong 5 phiên gần nhất. |
| Thống kê phiên | Phiên | Kết quả, bb/giờ; MTT thêm ROI, ITM% | bb/giờ chỉ khi có giờ bắt đầu và kết thúc. |

Test bắt buộc: hand thật trong `legacy/data` (dòng `line` có H/V) phải ra kết quả khớp `result` đã ghi; ca vàng trong `CLAUDE.md` ra −360bb.

## 7. Lộ trình
Khoảng 8–10 tuần bán thời gian tới beta kín 10–20 người (≈5 người quen ở sòng + nhóm Facebook/Discord).
1. Nền móng (1 tuần): repo, Supabase, auth, `poker-core` + test.
2. Ghi hand (3–4 tuần): Ghi nhanh (nút + ghi tắt), phiên cash và MTT, danh sách, chi tiết, offline, Hoàn tác.
3. AI review (2 tuần): review tay, AI review, quota, benchmark model.
4. Thống kê (1–2 tuần): bảng leak, kết quả, tổng kết phiên, đối thủ, Trước phiên, luật.
5. Chuẩn bị beta (1 tuần): tiếng Anh, onboarding, hand mẫu, migrate dữ liệu.

Cổng beta: người mới ghi được một hand trong 60 giây đầu.
