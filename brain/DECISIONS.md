# DECISIONS — HoldNote

Append-only. Không sửa, không xóa mục cũ. Muốn đảo một quyết định thì thêm mục mới ghi `Supersedes: DEC-xxx`.

## DEC-001 — Tên app là HoldNote

- Ngày: 2026-10-02
- Quyết định: Tên app là **HoldNote**, bản tiếng Việt giữ phụ đề "Sổ Tay Hand". Domain chính dự kiến holdnote.app.
- Lý do: holdnote.app còn trống khi kiểm tra 02/10/2026. Đã loại: FeltNote (feltnote.app là app ghi hand poker), RiverStack (thương hiệu đồ poker ở Pháp), ShowdownNotes (gần app "Showdown: Poker Stats Tracker"), Leakly (app subscription trùng tên), Rangewise (.com và .app đều đã có chủ).
- Ai quyết: Đạt

## DEC-002 — Định vị nhật ký học poker

- Ngày: 2026-10-02
- Quyết định: Định vị là nhật ký học poker; không liên kết, không quảng bá sòng hay site tiền thật.
- Lý do: Tránh rủi ro pháp lý và rủi ro bị app store từ chối.
- Ai quyết: Đạt

## DEC-003 — Stack

- Ngày: 2026-10-02
- Quyết định: Next.js + Supabase + Vercel, monorepo pnpm, `packages/poker-core` dùng chung.
- Lý do: Có sẵn auth/RLS, miễn phí khi beta, sau này dùng lại cho mobile (Expo).
- Ai quyết: Đạt

## DEC-004 — Bắt buộc đăng nhập

- Ngày: 2026-10-02
- Quyết định: Bắt buộc đăng nhập, không có chế độ dùng thử.
- Lý do: Bỏ được phần code chuyển dữ liệu từ máy lên tài khoản.
- Ai quyết: Đạt

## DEC-005 — MTT trong bản 1

- Ngày: 2026-10-02
- Quyết định: MTT nằm trong bản 1.
- Lý do: Chủ dự án chơi cả cash và MTT; lộ trình +1 tuần (8–10 tuần).
- Ai quyết: Đạt

## DEC-006 — Chế độ nhập mặc định

- Ngày: 2026-10-02
- Quyết định: Chế độ nhập mặc định là bấm nút; ghi tắt H/V là tùy chọn.
- Lý do: Ghi tắt là rào cản lớn nhất với người mới.
- Ai quyết: Đạt

## DEC-007 — Gói AI và giới hạn

- Ngày: 2026-10-02
- Quyết định: Gói miễn phí: 30 review hand + 4 tổng kết phiên mỗi tháng, ngân sách cứng $20/tháng. Gói tự mang key không giới hạn (chặn spam 30 lần/giờ). Gói trả phí để bản 2.
- Lý do: 10 lượt chỉ đủ 1–2 phiên; trần ngân sách giữ chi phí cố định.
- Ai quyết: Đạt

## DEC-008 — AI qua server, toán do poker-core

- Ngày: 2026-10-02
- Quyết định: AI qua OpenRouter, gọi chỉ từ server route; toán do `poker-core` tính, không để AI tính.
- Lý do: Đổi model không cần sửa code; AI hay tính sai.
- Ai quyết: Đạt

## DEC-009 — Ngôn ngữ

- Ngày: 2026-10-02
- Quyết định: Việt và Anh trong bản 1; tiếng Trung là ưu tiên số 1 tiếp theo, rồi Thái và Hàn.
- Lý do: Theo thị trường mục tiêu.
- Ai quyết: Đạt

## DEC-010 — Region và tài khoản hosting

- Ngày: 2026-10-02
- Quyết định: Supabase đặt ở region Singapore; Vercel đăng ký qua GitHub `dateddy`.
- Lý do: Gần Việt Nam nhất; Vercel deploy thẳng từ repo.
- Ai quyết: Đạt

## DEC-011 — Không commit dữ liệu thật

- Ngày: 2026-10-02
- Quyết định: `legacy/data/` (dữ liệu thật từ Sổ Tay Hand) không commit.
- Lý do: Có tên đối thủ thật.
- Ai quyết: Đạt

## DEC-012 — Beta kín

- Ngày: 2026-10-02
- Quyết định: Beta kín 10–20 người: khoảng 5 người quen ở sòng + nhóm poker Việt Nam trên Facebook/Discord.
- Lý do: Một nhóm test ghi hand live, một nhóm test onboarding với người lạ.
- Ai quyết: Đạt

## DEC-013 — Ante: không có / từng người / theo BB, số người theo từng hand

- Ngày: 2026-10-02
- Quyết định: Người dùng chọn có ante hay không; nếu có thì chọn ante từng người (`each`) hoặc ante theo BB (`bb`) và nhập số. Ante từng người tính theo số người được chia bài **của từng hand** (`players_dealt`), vì số người đổi khi có người ra vào bàn. Thêm cột `sessions.ante_mode`, `sessions.ante`, `hands.ante_mode`, `hands.players_dealt` (khác spec mục 4; spec đã cập nhật).
- Lý do: Dữ liệu thật (MTT N8, cash NLHA ante 0.01) chỉ khớp kết quả khi tính ante từng người × số người được chia.
- Ai quyết: Đạt

## DEC-014 — Đơn vị tiền theo từng phiên

- Ngày: 2026-10-02
- Quyết định: Thêm `sessions.currency`; mỗi phiên tự chọn đơn vị tiền (nút chọn ở task 2.1), mặc định lấy từ profile.
- Lý do: Spec lưu tiền theo đơn vị của phiên nhưng phiên không có cột tiền tệ; phiên live VND và online USD sẽ lẫn nhau.
- Ai quyết: Đạt

## DEC-015 — user_api_keys lưu tham chiếu Vault

- Ngày: 2026-10-02
- Quyết định: `user_api_keys.vault_secret_id` (uuid trỏ secret trong Supabase Vault) thay cho `key_encrypted`.
- Lý do: Key thật nằm trong Vault, bảng chỉ giữ tham chiếu.
- Ai quyết: Đạt

## DEC-016 — Parser ghi tắt nhận alias

- Ngày: 2026-10-02
- Quyết định: Ngoài cú pháp spec, parser nhận `limp`, `iso`, `sq`, `shove`, `allin`, `call`, `fold`, `check`, `bet`, `raise` và `V1..V9` (người chơi khác không rõ vị trí).
- Lý do: Dữ liệu thật dùng các ký hiệu này; chuẩn hóa về cùng dạng `actions`.
- Ai quyết: Đạt

## DEC-017 — Không tính rake

- Ngày: 2026-10-02
- Quyết định: Kết quả theo đúng công thức spec (Thắng = pot − đã bỏ), không có tham số rake. Hand thắng cash cũ lệch do rake được ghi là "không khớp" trong test.
- Lý do: Rake nằm ngoài spec.
- Ai quyết: Đạt

## DEC-018 — Test hand thật đọc thẳng legacy/data

- Ngày: 2026-10-02
- Quyết định: Test đối chiếu hand thật đọc `legacy/data/` lúc chạy; máy không có thư mục này thì tự bỏ qua. Không commit fixture.
- Lý do: Giữ DEC-011.
- Ai quyết: Đạt

## DEC-019 — Áp migration bằng Supabase CLI

- Ngày: 2026-10-02
- Quyết định: Supabase CLI là devDependency ở root; migration áp thẳng lên project đã link (`pnpm db:push`), types sinh bằng `pnpm db:types`.
- Lý do: Máy không có Docker nên không chạy Supabase local.
- Ai quyết: Đạt

## DEC-020 — Action có thêm verb, who và act all-in

- Ngày: 2026-10-02
- Quyết định: `Action` (spec 4.2) thêm trường tùy chọn `verb` (open, limp, 3bet, check-raise…, giữ sắc thái ghi tắt cho AI) và `who` (nhãn như `V1`). `act` gồm `check | bet | call | raise | fold | all-in`.
- Lý do: Không mất thông tin khi chuyển ghi tắt sang `actions`; không ảnh hưởng tính toán.
- Ai quyết: Claude Code (chờ Đạt xác nhận)

## DEC-021 — proxy.ts và một .env.local ở gốc

- Ngày: 2026-10-02
- Quyết định: Next.js 16 nên chặn route bằng `src/proxy.ts` (thay `middleware`). Một `.env.local` ở gốc repo, `next.config.ts` tự nạp. Tên biến theo key mới của Supabase: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
- Lý do: Next 16 đổi tên `middleware`; một file env dùng chung cho web, script và CLI.
- Ai quyết: Claude Code (chờ Đạt xác nhận)

## DEC-022 — Ràng buộc trong database

- Ngày: 2026-10-02
- Quyết định: Khóa ngoại kép `(id, user_id)` để hand/review/luật chỉ trỏ tới dữ liệu của chính user. Cột kiểu text có `check` thay cho enum. Quyền theo cột trên `profiles`: user không tự đổi `plan`. `anon` không có quyền gì.
- Lý do: Chặn gắn dữ liệu vào phiên người khác khi đoán được uuid; thêm giá trị mới dễ hơn enum; tránh tự nâng gói.
- Ai quyết: Claude Code (chờ Đạt xác nhận)

## DEC-023 — Chọn ngôn ngữ không qua URL

- Ngày: 2026-10-02
- Quyết định: next-intl không đưa locale vào URL. Thứ tự: `profiles.locale` → cookie `NEXT_LOCALE` → `Accept-Language` → `vi`.
- Lý do: Spec yêu cầu chọn ngôn ngữ theo profile; app bắt buộc đăng nhập nên không cần URL theo ngôn ngữ.
- Ai quyết: Claude Code (chờ Đạt xác nhận)

## DEC-024 — Thiếu số người được chia

- Ngày: 2026-10-02
- Quyết định: Ante từng người mà thiếu `players_dealt`: hand thua/fold vẫn có kết quả (chỉ cần tiền mình bỏ), hand thắng/chia không có kết quả và gắn "Thiếu dữ liệu".
- Lý do: Không đoán bừa số người; vẫn giữ được kết quả chắc chắn.
- Ai quyết: Claude Code (chờ Đạt xác nhận)

## DEC-025 — Tách policy for all thành 4 policy

- Ngày: 2026-10-02
- Quyết định: `sessions`, `hands`, `reviews`, `opponents`, `user_rules` dùng 4 policy riêng select/insert/update/delete (`<bảng>_<lệnh>_own`) thay cho một policy `for all`. Migration `20261002120000_split_policies_lock_api_keys.sql`.
- Lý do: Cùng hiệu lực, nhưng khớp checklist skill db-migration và dễ audit.
- Ai quyết: Đạt

## DEC-026 — Client không đọc user_api_keys

- Ngày: 2026-10-02
- Quyết định: Bỏ policy select và mọi quyền của `authenticated`/`anon` trên `user_api_keys`. Màn Cài đặt hỏi server route để biết đã có key hay chưa (task 3.2).
- Lý do: Đúng spec "client không bao giờ đọc lại key" và checklist audit.
- Ai quyết: Đạt

## DEC-027 — Xác nhận DEC-020 → DEC-024

- Ngày: 2026-10-02
- Quyết định: Đạt xác nhận các quyết định kỹ thuật DEC-020, DEC-021, DEC-022, DEC-023, DEC-024 (trước đó ghi "Claude Code (chờ Đạt xác nhận)"). Từ nay coi như đã chốt.
- Lý do: Đạt duyệt sau báo cáo audit ngày 02/10/2026.
- Ai quyết: Đạt

## DEC-028 — Tiền tệ MTT và phiên đang mở

- Ngày: 2026-10-03
- Quyết định: Phiên MTT dùng `sessions.currency` cho buy-in và tiền thưởng; blind và stack tính bằng chip. Phiên "đang mở" là `start_at` có giá trị và `end_at` còn trống; phiên mới tạo chưa bấm Vào bàn có `start_at` null. Tên giải, loại (regular/bounty/turbo/satellite), re-entry, level vào, stack vào lưu trong `sessions.mtt`; blind và ante của level vào lưu ở `sb/bb/ante_mode/ante`.
- Lý do: Spec 3.4 và DEC-013/014 chưa nói rõ; khớp dữ liệu MTT thật trong legacy (buy-in $1.08, stack 10k chip).
- Ai quyết: Đạt

## DEC-029 — Thu quyền mặc định của anon, .gitignore, README

- Ngày: 2026-10-03
- Quyết định: Migration `20261003120000` thu mặc định quyền `anon` trên bảng, sequence, function mới trong `public` (không đổi bảng nào). Thêm `__pycache__/` vào `.gitignore`; thêm `pnpm test:rls` vào README.
- Lý do: Bắt buộc đăng nhập (DEC-004): bảng tạo sau này không được vô tình mở cho `anon`. Ba mục PROPOSED trong STATUS ngày 02/10.
- Ai quyết: Đạt

## DEC-030 — Bộ mã loại lỗi cố định

- Ngày: 2026-10-03
- Quyết định: 14 mã + `none`: `preflop_too_loose`, `preflop_too_tight`, `sizing_too_small`, `sizing_too_large`, `missed_value`, `bad_bluff`, `bluff_multiway`, `call_too_loose`, `fold_too_much`, `passive_short`, `misread_range`, `read_right_act_wrong`, `math_error`, `tilt`, `none`. Nằm ở `apps/web/src/lib/review/review.ts`; AI review (3.1) dùng chung danh sách này. `none` đứng một mình.
- Lý do: Spec 4.3 chỉ có ví dụ. Gộp từ ví dụ spec và nhóm lỗi trong app cũ (Preflop, Sizing, Đọc sai range, Cảm xúc, Toán, Không lỗi).
- Ai quyết: Đạt

## DEC-031 — Danh sách hand theo phiên

- Ngày: 2026-10-03
- Quyết định: Danh sách hand ở `/sessions/[id]/hands`; thanh trên tính trong phạm vi một phiên. Danh sách toàn bộ để task thống kê.
- Lý do: Tổng bb cộng nhiều phiên khác BB/tiền tệ dễ sai.
- Ai quyết: Đạt

## DEC-032 — Quy ước màn Ghi nhanh và review tay

- Ngày: 2026-10-03
- Quyết định: (1) "Đã review" = review hiện tại có `accepted = true`. (2) Phiên MTT: BB của hand là ô "BB của level" (mặc định hand trước), SB = BB/2 trừ khi BB bằng BB phiên (dùng SB phiên); ante giữ theo phiên; `level_bb` chỉ lưu cho MTT. (3) Ghi/sửa hand và review bằng browser client (client ghi thẳng, RLS chặn) để task 2.7 bọc hàng đợi offline. (4) Kết quả gõ tay giữ làm ghi đè; khi mở lại hand chỉ giữ ghi đè nếu khác số tính được. (5) Tối thiểu để lưu: đủ 2 lá mình hoặc cờ ⚑; thiếu kết quả hoặc eff stack thì `missing_data = true`. (6) Lưu `raw_line` chỉ khi đang ở chế độ ghi tắt; `actions` luôn là bản đã điền số tiền của call/all-in.
- Lý do: Spec 3.5–3.7 chưa nói rõ các điểm này.
- Ai quyết: Claude Code (chờ Đạt xác nhận)

## DEC-033 — Offline và PWA

- Ngày: 2026-10-05
- Quyết định: (1) Offline chỉ cho hand mới ở màn Ghi nhanh; sửa hand và lưu review cần mạng. (2) Mọi lần Lưu ghi vào hàng đợi IndexedDB trước rồi mới đồng bộ; `hands.id` do client sinh (`crypto.randomUUID()`) nên chèn lặp không tạo trùng và Hoàn tác biết xóa gì. (3) Xung đột `unique(session_id, num)` thì đọc max + 1 rồi chèn lại; trùng khóa chính coi như đã đồng bộ; lỗi 4xx khác thì đánh dấu `failed` và báo, không thử vô hạn. (4) Mỗi mục ghi `user_id`, chỉ đồng bộ mục của tài khoản đang đăng nhập. (5) Không thêm dependency: IndexedDB thô, service worker viết tay `public/sw.js` (cache-first cho `/_next/static` và `/icons`, điều hướng network-first có cache dự phòng; không đụng `/api`, `/auth`, Supabase; cache trang bị xóa khi tới `/login`), chỉ đăng ký ở production. (6) Icon là chữ "H" trên nền xanh, sinh bằng `ImageResponse`, là bản tạm.
- Lý do: Spec 3.5 "mất mạng vẫn lưu, có mạng tự đồng bộ", Hoàn tác trong toast; CLAUDE.md quy tắc 7 hạn chế thêm dependency; iOS không có Background Sync nên đồng bộ chạy khi app mở (mở trang, sự kiện `online`, 30 giây một lần).
- Ai quyết: Claude Code (chờ Đạt xác nhận)

## DEC-034 — Xác nhận DEC-032, DEC-033; sửa ante phiên MTT

- Ngày: 2026-10-05
- Quyết định: Đạt xác nhận DEC-033 và DEC-032, trừ điểm (2) về MTT. Điểm (2) đổi thành: (a) phiên MTT online có ante theo từng level (nhập "Ante của level" mỗi hand, mặc định lấy hand trước, hand đầu lấy ante phiên; lưu `hands.ante_mode` và `hands.ante`); (b) nếu ante kiểu BB (`ante_mode = bb`) thì ante = BB của level, tự tính, không cần nhập; (c) MTT live giữ ante theo phiên. BB và SB của level vẫn như DEC-032 (2). Cash không đổi.
- Lý do: Online ante tăng theo level; ante BB luôn bằng BB nên không để người dùng nhập sai.
- Ai quyết: Đạt
- Supersedes: DEC-032 (2), phần "ante giữ theo phiên"

## DEC-035 — Cột và hàm cho AI review

- Ngày: 2026-10-05
- Quyết định: Thêm `ai_usage.billed_to` (`app`/`user`, mặc định `app`) để ngân sách $20 chỉ tính tiền app trả; thêm `user_api_keys.model` (null = model mặc định); hàm Vault `set/get/delete_user_api_key` (security definer, chỉ `service_role`); `replace_current_review` (security invoker, `authenticated`) đổi review hiện tại trong một giao dịch; `ai_app_spend_since` (chỉ `service_role`) cộng chi phí app. Migration `20261005170000` và `20261005171000`.
- Lý do: Spec 5.5 cần ngân sách cứng chỉ tính phần app trả; spec 5.2 cho người dùng chọn model; Vault không truy cập được từ API.
- Ai quyết: Đạt

## DEC-036 — Quy ước AI review

- Ngày: 2026-10-05
- Quyết định: (1) Sửa review AI rồi Lưu thì tạo dòng `manual` mới, bản AI thành lịch sử; chỉ tick "Đã review" thì cập nhật `accepted` trên dòng AI. (2) Hand chưa đổi (review AI tạo sau `hands.updated_at`) thì trả lại review cũ, không trừ lượt. (3) Phản biện tính 1 lượt, chung hạn mức 30/tháng với review. (4) `missing_info` ghép cuối `math_text` ("Missing: …"); `key_mistake_street`, `repeats_known_leak` chỉ trả về client, không lưu. (5) Tháng tính theo UTC. (6) Ngữ cảnh gửi AI dùng bb và không có kết quả thắng/thua. (7) Thêm dependency `zod`. (8) `/api/*` chưa đăng nhập trả 401 JSON.
- Lý do: Spec 3.7, 5.1, 5.5 chưa nói rõ các điểm này.
- Ai quyết: Claude Code (chờ Đạt xác nhận)

## DEC-037 — Prompt AI review v2, gói ngôn ngữ, model mặc định

- Ngày: 2026-10-13
- Quyết định: (1) Model gói miễn phí: `google/gemini-3.5-flash-lite` (đặt qua `OPENROUTER_MODEL`), mức suy luận `low`, `max_tokens` 4000. (2) Prompt lõi tiếng Anh cố định (`lib/ai/prompt.ts`) + gói ngôn ngữ `vi`/`en` (`lib/ai/languages.ts`) đặt ở đầu và cuối user message; sai ngôn ngữ thì gọi lại 1 lần, sai nữa thì báo lỗi, không trừ lượt; đổi ngôn ngữ trong hồ sơ thì review AI cũ không được dùng lại (gọi lại, tính 1 lượt). Ngôn ngữ chưa có gói dùng tiếng Anh. (3) Prompt v2: chấm cả hand từng street, bảng chuẩn size cho stake thấp, nghĩ theo stack bb, so câu suy nghĩ với hành động, lesson 2–4 ý đánh số tối đa 100 từ. (4) Tiếng Việt: gọi "mình"/"đối thủ"/"bạn", giữ thuật ngữ bài tiếng Anh (pair, two pair, flush...). (5) Ngữ cảnh gửi AI thêm vị trí từng hành động, danh sách quyết định của Hero có % pot và số limper. (6) Bản prompt đầy đủ nằm trong code; spec 5.3 chỉ tóm tắt.
- Lý do: Benchmark 69 hand (legacy). Gemini cũ viết 60% ô bằng tiếng Anh/không dấu; sau khi sửa 0%. Trên 34 hand đo riêng, bắt lỗi Sizing 1/12 → 5/11, Preflop 4/7 → 5/6, nhưng báo "sai" nhầm hand Đạt chấm "Đúng" 1/17 → 10/18 và khớp EV 64% → 45%. Đạt chọn giữ prompt v2.
- Ai quyết: Đạt

## DEC-038 — Xác nhận DEC-035, DEC-036, DEC-037

- Ngày: 2026-10-13
- Quyết định: Đạt xác nhận DEC-035 (cột và hàm cho AI review), DEC-036 (quy ước AI review) và DEC-037 (prompt v2, gói ngôn ngữ, model Gemini mặc định). Từ nay coi như đã chốt.
- Lý do: Đạt duyệt sau báo cáo benchmark và chốt phiên 13/10/2026.
- Ai quyết: Đạt

## DEC-039 — Hình dạng tổng kết phiên và kết quả MTT

- Ngày: 2026-10-14
- Quyết định: (1) `sessions.summary` = `{grade: A|B|C|D|null, good: string[≤3], leak_tags: mã lỗi[], rules: string[≤4], notes}`; `leak_tags` phẳng vì view `leak_stats` đọc như vậy; không nhận mã `none`. (2) `sessions.self_state` = `clear|tired|tilt` (kiểm bằng TS, không thêm check SQL). (3) Kết quả MTT nằm trong `sessions.mtt` cạnh thông tin vào giải: `reentries` (số lần đã dùng), `place`, `entries`, `prize`, `bounty`, `bust_stage` (`early|mid|bubble|itm|final_table`). (4) Kết quả: cash = cashout − buyin; MTT = prize + bounty − buyin × (1 + reentries); MTT không có bb. ROI = (nhận về − chi) / chi; ITM = `prize > 0`; vi phạm stop-loss = lỗ > stop-loss (lỗ bằng stop-loss không tính). (5) Lưu tổng kết đặt `end_at = now()` nếu phiên còn mở; luật phiên sau thêm vào `user_rules` (`source_session_id`), sửa lại thì giữ luật trùng chữ, xóa luật bị bỏ, thêm luật mới. (6) AI tổng kết: `POST /api/summary` chỉ trả bản nháp, không lưu; 4 lượt/tháng gói miễn phí, tách khỏi 30 lượt review; JSON hoặc ngôn ngữ sai thì gọi lại 1 lần, vẫn sai thì không trừ lượt; cần ít nhất 1 hand trong phiên. Không đổi schema SQL.
- Lý do: Spec 3.8, 5.6 và 6 chưa nói rõ các điểm này; không cần migration vì đều là jsonb/text.
- Ai quyết: Claude Code (chờ Đạt xác nhận)

## DEC-040 — Trang thống kê

- Ngày: 2026-10-14
- Quyết định: (1) `/stats` một trang: bảng leak, kết quả cộng dồn, giải đấu, kỷ luật. (2) Bảng leak lấy mọi phiên (không lọc), gộp `leak_stats` nguồn review và summary; "5 phiên gần nhất" tính theo `sessions.date`; một phiên có mã lỗi nếu có trong review hiện tại hoặc trong `summary.leak_tags`; "Lặp lại" = có mặt ≥3 trong 5 phiên gần nhất. (3) Biểu đồ: SVG tự vẽ, không thêm thư viện; mặc định cash theo bb (MTT không có bb); chế độ tiền chỉ cộng một loại tiền (DEC-014): chọn tiền tệ, nếu không chọn thì lấy loại có nhiều phiên nhất. (4) Bộ lọc loại/hình thức/địa điểm (không phân biệt hoa thường)/stake/tiền tệ/đơn vị là form GET, không cần JS; bộ lọc áp dụng cho biểu đồ, giải đấu và kỷ luật, không áp dụng cho bảng leak. (5) Phiên chưa có kết quả không vào biểu đồ, hiện số phiên bị bỏ. (6) Kỷ luật: số phiên vượt stop-loss, số phiên `self_state = tilt`. (7) Tính toán nằm trong `poker-core/src/stats`.
- Lý do: Spec 3.10 và 6 chưa nói rõ các điểm này.
- Ai quyết: Claude Code (chờ Đạt xác nhận)

## DEC-041 — Xác nhận DEC-039, DEC-040

- Ngày: 2026-10-14
- Quyết định: Đạt xác nhận DEC-039 (hình dạng tổng kết phiên và kết quả MTT) và DEC-040 (trang thống kê). Từ nay coi như đã chốt.
- Lý do: Đạt duyệt sau khi xong task 4.1–4.3.
- Ai quyết: Đạt

## DEC-042 — Onboarding: cột profiles và hand mẫu không lưu

- Ngày: 2026-10-14
- Quyết định: (1) Thêm `profiles.onboarded_at` (timestamptz, null = chưa xong), `profiles.play_mode` (`live|online`), `profiles.play_kind` (`cash|mtt`), cấp quyền select/update theo cột cho `authenticated`. Migration `20261014120000_profiles_onboarding.sql`. Không điền sẵn cho tài khoản cũ: họ thấy onboarding một lần và bỏ qua được. (2) Trang chủ chuyển sang `/onboarding` khi `onboarded_at` null; bỏ qua hay hoàn tất đều đặt `onboarded_at`. (3) Bước 2 điền sẵn loại phiên (cash/MTT) và live/online cho phiên đầu tiên; có phiên trước thì vẫn lấy theo phiên trước. (4) Bước 3: hand mẫu cố định (cash live 25/50, A♠Q♠ BTN vs BB, thua −11bb, lỗi `call_too_loose`); lời review nằm trong file ngôn ngữ. Ghi lại hand mẫu dùng màn Ghi nhanh ở chế độ luyện tập, không lưu gì, so từng phần (bài, board, vị trí, hành động, kết quả).
- Lý do: Spec 3.2 cần nhớ trạng thái onboarding qua nhiều máy; hand ghi thử không nên thành dữ liệu rác.
- Ai quyết: Đạt (thêm cột, không lưu hand thử); chi tiết còn lại Claude Code (chờ Đạt xác nhận)

## DEC-043 — Xác nhận DEC-042

- Ngày: 2026-10-14
- Quyết định: Đạt xác nhận toàn bộ DEC-042 (cột onboarding trong `profiles`, chuyển hướng tới `/onboarding`, điền sẵn phiên đầu, hand mẫu luyện tập không lưu). Từ nay coi như đã chốt.
- Lý do: Đạt duyệt sau khi xong task 4.4 và 5.1.
- Ai quyết: Đạt

## DEC-044 — Thiết kế lại UI và flow (task 5.1b)

- Ngày: 2026-10-14
- Quyết định: (1) Phong cách tối giản + một màu chủ đạo xanh lục, mặc định tối, có bản sáng; token màu cho thắng/thua/cảnh báo. (2) Thanh điều hướng dưới 4 tab: Trang chủ · Ghi hand · Thống kê · Cài đặt; đăng xuất và đổi ngôn ngữ chuyển vào Cài đặt. (3) Tách **Kết thúc phiên** (cash-out hoặc kết quả MTT + trạng thái, đặt `end_at`) khỏi **Tổng kết** (chấm điểm, điểm tốt, leak, luật, ghi chú, AI; làm sau review). (4) Ghi nhanh: board của mỗi street nằm trong hàng action của street đó, thanh ngữ cảnh và nút Lưu dính. (5) Chi tiết hand mở ở dạng đọc, form sửa thu gọn. (6) Vào bàn đi thẳng tới Ghi nhanh. Không đổi schema, không thêm dependency. Chưa làm: danh sách mọi phiên, hand xuyên phiên, nút "hand tiếp theo".
- Lý do: Audit flow ngày 2026-10-14: Ghi nhanh phải kéo lên xuống, điều hướng thiếu, Kết thúc phiên gộp với Tổng kết nên rời bàn chậm.
- Supersedes: DEC-039 mục (5) (lưu tổng kết đặt `end_at`); nay `end_at` đặt ở bước Kết thúc phiên. Spec 3.8 cần cập nhật theo.
- Ai quyết: Đạt

## DEC-045 — Forced bet nằm trong `actions`

- Ngày: 2026-10-19
- Quyết định: Ante, SB, BB, straddle đi vào chính mảng `hands.actions` dưới dạng `post_ante`, `post_sb`, `post_bb`, `post_straddle` (street `preflop`, đứng đầu mảng); khoản tiền lạ ("+ tiền khác") là `dead`. Không thêm cột straddle. Nút O = `raise` + `verb: open`, A = `all-in` (giữ nguyên giá trị cũ, không migrate). `computePot` chỉ tự đặt blind/ante từ `Blinds` khi preflop không có action `post_*`, nên hand cũ và ghi tắt giữ nguyên kết quả. Nhãn giai đoạn giải dùng `hands.stage`, loại ante dùng `ante_mode`, cấu trúc blind đặt trong `sessions.mtt` (jsonb): chưa cần cột mới.
- Lý do: Spec ghi hand theo action (19/10/2026) cần mọi khoản bắt buộc có mặt trong một dãy để replay/sửa action cũ; hai chế độ nhập vẫn ra cùng một mảng (CLAUDE.md luật 4).
- Supersedes: một phần spec 4.2 (thêm kiểu `act`) và spec 3.5 mục 3.
- Ai quyết: Đạt

## DEC-046 — Màn Ghi nhanh theo action (task 5.1c-2)

- Ngày: 2026-10-19
- Quyết định: (1) Màn Ghi nhanh có một thanh dính duy nhất (Pot · Stack · Lưu hand, nền đặc, safe-area); thanh tab dưới **ẩn** ở `/sessions/[id]/record`. (2) `HandDraft.actions` chỉ giữ action của người chơi; forced bet thêm bằng `forcedBets(setup)` khi tính và khi lưu (`hands.actions` có `post_*`). Hand lưu trước DEC-045 (không có `post_*`) đánh dấu `legacy`, mở ở chế độ ghi tắt, tính theo blind của phiên. (3) Kết quả tính bằng `computeResult` trên các action còn hợp lệ; action bị state machine đánh dấu `invalid` không vào tiền. Hết hand do fold thì kết quả tự có, không cần chọn người thắng. (4) Sửa tay kết quả giữ số đã nhập và gắn tag `manual_result` vào `hands.tags`; giai đoạn giải lưu vào `hands.stage`. (5) Vị trí hand sau xoay tiến một ghế theo `tableOrder`; straddle, giai đoạn lấy từ hand trước. (6) Chữ tiếng Việt trên màn không viết tắt ("Đối thủ"); nút action ghi đủ chữ. (7) Thêm devDependency `playwright-core` ở root cho `pnpm screens`. (8) Cấu trúc blind MTT và nút "Lên level" tách thành task 5.1c-3.
- Lý do: Spec ghi hand theo action; một thanh dính tránh hai thanh chồng nhau ở đáy màn hình điện thoại.
- Supersedes: spec 3.5 mục 3 (chế độ Nút).
- Ai quyết: Đạt (duyệt kế hoạch ngày 2026-10-19)

## DEC-047 — Board không chặn action; màn Ghi nhanh gồm thẻ Board và một thẻ Action (task 5.1c-4)

- Ngày: 2026-10-20
- Quyết định: (1) Board nhập lúc nào cũng được, không chặn action: state machine bỏ phase `board`, `BoardInput.skipped`, cảnh báo `board_skipped`. `boardCheck` cho biết từng ô `locked` / `open` / `missing` / `extra` theo street cuối mà action đã tới (all-in được theo thì mở cả 5 ô); `streetTabs` cho trạng thái tab Preflop/Flop/Turn/River (`current`, `done`, `invalid`, `locked`). Lưu với board thiếu → nhãn Thiếu dữ liệu; board thừa → cảnh báo, vẫn lưu. (2) Màn Ghi nhanh: thanh ngữ cảnh → thẻ Board (5 ô liền) → một thẻ Action (tab street, chế độ mở rộng, khu nhập trong thẻ) → kết quả (chỉ khi hand xong) → thanh Lưu dính. Bàn mini chỉ ở bước thiết lập và trong sheet "Thêm người". (3) Chọn board qua sheet bộ chọn bài, tự sang ô trống kế tiếp. (4) Ô sửa tay số tiền giấu sau link "Sửa tay". (5) Màn Ghi dùng `gap-3` và `Card tight` (ngoại lệ trong design.md).
- Lý do: Thẻ riêng cho từng street đẩy nút bấm xuống dưới, phải cuộn khi đang nhập; chặn action chờ board làm chậm ghi hand tại bàn.
- Supersedes: một phần DEC-046 (board theo street trong hàng action, bàn mini ở bước action); spec mục 10.4 và ca test 23.
- Ai quyết: Đạt (duyệt kế hoạch ngày 2026-10-20)

## DEC-048 — Số người 2–10, tên vị trí theo N, đối thủ multiway (task 5.1c-5a)

- Ngày: 2026-10-20
- Quyết định: (1) Số người N từ 2 tới 10; tên vị trí theo N (bỏ dần ghế đầu, BTN/SB/BB luôn có), thêm vị trí `UTG+2`; heads-up: BTN đóng SB, đi trước preflop, đi sau cùng postflop. Straddle tối đa min(3, N−3). (2) Migration `20261020120000`: thêm `hands.opponents jsonb` (mọi đối thủ được chọn, theo thứ tự chọn; `villain_*` giữ đối thủ chính) và mở CHECK `hero_pos`/`villain_pos` cho `UTG+2`; N lưu ở `players_dealt` có sẵn. (3) Hand đã lưu theo tên vị trí cũ **không sửa dữ liệu**: `legacySeat(N, pos)` đổi tên lúc đọc. (4) State machine có `listedOnly`: chỉ ghế được chọn được theo dõi; action của ghế không còn được chọn (bỏ chọn, đổi vị trí mình, giảm N) và mọi action sau đó thành `invalid` (tô đỏ, không xóa). (5) Đối thủ chính = người chọn đầu tiên chưa fold (`primaryOpponent`).
- Lý do: Hand tại bàn nhiều hơn 2 người và không phải lúc nào cũng 6/9 người; lưu một bộ villain_* làm mất dữ liệu multiway.
- Supersedes: spec ghi hand theo action mục 1, 3, 4, 6 (đã sửa); spec 4 (thêm cột `opponents`).
- Ai quyết: Đạt (duyệt kế hoạch ngày 2026-10-20)

## DEC-049 — Gộp thiết lập vào màn Ghi hand; bộ chọn bài và bàn phím số trượt trong thẻ (task 5.1c-5b)

- Ngày: 2026-10-20
- Quyết định: (1) Bỏ bước thiết lập riêng và nút "Bắt đầu ghi": thanh ngữ cảnh dính ở đầu màn (chip vị trí, N người, stack, straddle/level) mở bàn mini trượt ra; hand mới có bàn mini tự mở ở thanh Đối thủ. (2) Chọn nhiều đối thủ (multiway): ghế được chọn là người được theo dõi (`listedOnly`), ghế khác tự fold; bỏ nút/sheet "Thêm người". `HandDraft.opponents` giữ mọi đối thủ theo thứ tự chọn, `villPos/villStack/opponentId` là bản sao của người chọn đầu; lúc tính và lưu, đối thủ chính (`primaryOpponent`) mới là `villain` trong `actions`, `villain_*`. (3) Danh sách đối thủ hiện tất cả, người trùng địa điểm phiên xếp lên đầu (sửa lỗi cũ chỉ hiện người trùng địa điểm). (4) Thẻ bài 7 ô (Bài mình | Flop | Turn | River) dùng một `CardPicker` bố cục xen kẽ, trượt ra trong thẻ; khóa lá đã dùng; bàn phím số cũng trượt trong thẻ Action. Không còn `Sheet` cho chọn bài/số tiền (chỉ giữ cho sửa action). (5) Bộ đếm N người nằm trong một hàng riêng ngay trên bàn mini (bên phải) thay vì đè lên góc bàn, vì ở bàn 9–10 người nó che ghế. (6) Trang chỉ cuộn tới phần đang mở bằng `revealAboveBar` (không dùng `scrollIntoView`, trình duyệt bỏ qua khi phần tử đã hiện một phần). (7) Số người của phiên (cash) chọn bằng Stepper 2–10; MTT chưa có trường này.
- Lý do: Ghi hand tại bàn phải vào là nhập được ngay; chọn bài bằng sheet làm tối màn và che action.
- Supersedes: DEC-046 mục "bước ① thiết lập", DEC-047 mục "bàn mini chỉ ở bước thiết lập và trong sheet Thêm người", "chọn board qua sheet".
- Ai quyết: Đạt (duyệt kế hoạch ngày 2026-10-20)

## DEC-050 — Hand evaluator, side pot, đối thủ chính mới (task 5.1c-6a)

- Ngày: 2026-10-20
- Quyết định: (1) `poker-core` có hand evaluator 7 lá (`evaluate`, `compareRanks`; null khi thiếu lá, trùng lá hoặc lá không rõ chất) và side pot (`buildPots`, `splitPot`, `chipUnit`, `showdown`). Người thắng từng pot theo bài khi đủ bài, chọn theo từng pot khi thiếu; chọn khác bài đã nhập thì `mismatch`. (2) Chip lẻ: đơn vị 1 nếu mọi số nguyên, ngược lại 0.01; phần dư cho người thắng gần bên trái BTN nhất. (3) Đối thủ chính = đối thủ chưa fold có action cuối cùng (thay "người chọn đầu tiên"); mọi đối thủ fold thì người fold cuối. (4) Cược không ai theo đã được trả lại ở `computePot` và state machine; chỉ bổ sung test. (5) `computeResult` giữ cho ghi tắt và hand cũ; UI chuyển sang `showdown` ở 5.1c-6b.
- Lý do: Kết quả multiway sai khi có all-in lệch stack; người dùng phải tự chọn người thắng dù đã nhập đủ bài.
- Supersedes: DEC-048 mục (5) (đối thủ chính = người chọn đầu chưa fold); spec mục 1 ("side pot ngoài phạm vi").
- Ai quyết: Đạt (duyệt kế hoạch ngày 2026-10-20)

## DEC-051 — Không trả cược không ai theo cho người đã fold (task 5.1c-6a-fix)

- Ngày: 2026-10-20
- Quyết định: Lúc đóng street, `computePot` và state machine (`closeStreet`) chỉ trả phần vượt mức đóng lớn thứ hai cho người đóng nhiều nhất khi người đó còn trong hand. Người đã fold và ghế không được chọn (coi như fold) không nhận lại tiền. Lỗi cũ xảy ra khi người đóng nhiều nhất là ghế đã fold bằng cược bắt buộc (BB, straddle): hand kết thúc mà mình chưa bỏ thêm tiền vượt cược bắt buộc đó (mọi đối thủ fold trước lượt mình ở bất kỳ ghế nào, hoặc straddle của người ngoài hand) làm mất phần vượt SB của BB (+50 thay vì +75) hoặc phần straddle vượt BB. Ca mình open/3bet rồi đối thủ fold, walk tới BB còn trong hand, và mọi hand có người theo (ca vàng) không bị ảnh hưởng. Với ghi tắt chỉ có "H f" (không ai khác action), ghế giữ cược bắt buộc lớn nhất vẫn được coi là người thắng walk.
- Lý do: Người đã fold không thể nhận tiền; kết quả và `pot_final` phải khớp luật.
- Supersedes: cách đóng street trong 5.1c-1 (spec mục 11).
- Ai quyết: Đạt

## DEC-052 — Showdown theo bài và từng pot, sửa action inline, panel trong luồng trang (task 5.1c-6b)

- Ngày: 2026-10-20
- Quyết định: (1) Một nguồn tính kết quả: `settlePots` (poker-core) xây và chia pot; `showdown`, `computeResult` (ghi tắt, hand cũ) và `settle` đều gọi nó; `deriveHand` dùng `showdown` ở chế độ nút. Bỏ cảnh báo `side_pot`. (2) Thêm cột `hands.pot_winners jsonb` (người thắng từng pot khi người dùng chọn) và khóa `cards` trong từng phần tử `hands.opponents` (bài đối thủ phụ); `villain_cards` vẫn là bài đối thủ chính. (3) Chọn khác bài đã nhập thì tiền vẫn tính nhưng khóa nút Lưu ("Kết quả không khớp bài"); "Sửa tay" không mở khóa. (4) Bỏ `Sheet`: sửa action bằng hàng trượt ngay dưới chip (`EditRow`). (5) Khối sticky chỉ chứa dòng tóm tắt; panel thiết lập là phần tử đứng sau, trôi theo trang. (6) Ô nhập tên đối thủ có gợi ý bỏ dấu và "+ Tạo"; đối thủ tạo offline vào hàng đợi IndexedDB (store `opponents`, DB version 2) và được gửi trước hand. (7) Mọi đối thủ đã chọn ghi "Đối thủ", từ 2 người thêm vị trí. (8) Phiên MTT cũng có số người (cột `seats` đã có). Hand lưu trước đây không có `pot_winners` thì pot chưa có người thắng đọc theo `outcome` đã lưu.
- Lý do: Kết quả multiway/side pot phải đúng không cần người dùng tự tính; sheet phủ màn và nhiều nơi tính kết quả riêng gây lệch.
- Supersedes: DEC-049 mục (4) "chỉ giữ Sheet cho sửa action", mục (7) "MTT chưa có số người"; DEC-050 mục (5) "UI chuyển sang showdown ở 5.1c-6b" (đã làm).
- Ai quyết: Đạt (duyệt kế hoạch ngày 2026-10-20)

## DEC-053 — Prompt v1 mặc định, lưu phiên bản prompt, ngữ cảnh đầy đủ sau 5.1c (task 3.5)

- Ngày: 2026-10-20
- Quyết định: (1) Prompt v1 là mặc định (`DEFAULT_PROMPT_VERSION`); v2 giữ trong `prompt.ts` để thử, chọn bằng `AI_PROMPT_VERSION`. v1 chỉ thêm 4 dòng mô tả trường mới vào mục "Context you receive", không đổi luật chấm. (2) Cột `reviews.prompt_version` (`v1`/`v2`, null = review tay); migration `20261020200000`; 3 review AI cũ gắn `v2`, không chạy lại; màn hand hiện nhãn "Prompt cũ (v2)" trên review AI làm bằng v2. Review cũ vẫn được trả lại khi hand chưa đổi, bất kể phiên bản. (3) Ngữ cảnh thêm (số do poker-core tính: `potType`, `playersByStreet`, `StreetSummary.uncalled`, pot từ `showdown`): straddle, ante (loại + mức), level MTT, loại pot, số người còn lại mỗi street, mọi đối thủ (stack, loại/ghi chú, bài đã lật), từng pot với người đủ điều kiện, cược không ai theo đã trả. Không gửi người thắng pot hay kết quả (giữ DEC-036 (6)). Hand ghi tắt hoặc hand cũ không có state machine thì không có các dòng này; hand ghi tắt cũng không có dòng pot. (4) Sửa kèm: bội số raise ("3x the bet it faces") tính theo bet đã đối mặt chứ không theo level sau raise; blind/ante bắt buộc không còn nằm trong danh sách quyết định của Hero.
- Lý do: Benchmark DEC-037 cho thấy v2 báo "sai" nhầm nhiều (10/18 hand Đạt chấm Đúng, v1 1/17 trên nửa test). Chạy lại ngày 2026-10-20 (gemini-3.5-flash-lite, 69 hand, $0.40): khớp EV / báo sai nhầm / bỏ sót lỗi — v1 cũ 54% / 11/37 / 9/18; v1 + ngữ cảnh mới 43% / 13/35 / 13/19; v2 46% / 18/35 / 5/18. Nửa test (34 hand): 52% / 6/18 / 4/9; 45% / 6/18 / 6/9; 42% / 9/17 / 3/9. Kết luận trung thực: v2 vẫn báo sai nhầm nhiều nhất và bắt lỗi nhiều nhất; v1 không còn đạt 64% của lần đo trước (chạy đơn, mô hình không tất định, gói ngôn ngữ đã đổi từ DEC-037, 6% lần v1/v2 trả JSON không hợp lệ). Chênh lệch khớp EV giữa ba cấu hình nằm trong sai số của 69 hand. 69 hand legacy đều ghi tắt nên không có dòng ngữ cảnh mới; chênh v1 cũ và v1 chỉ đến từ 4 dòng prompt và `sizingNote`.
- Chưa làm: tách ảnh hưởng của 4 dòng prompt và `sizingNote` (chạy thêm một cấu hình, ~$0.12); hand multiway thật chưa có bộ chấm của Đạt nên ngữ cảnh mới chỉ kiểm bằng test đơn vị.
- Supersedes: DEC-037 mục (3) "Prompt v2" làm mặc định.
- Ai quyết: Đạt (duyệt kế hoạch ngày 2026-10-20)

## DEC-054 — Prompt v1 theo trường của hand, JSON có cấu trúc, benchmark nhiều lần (task 3.5b)

- Ngày: 2026-10-20
- Quyết định: (1) Prompt v1 là văn bản cũ nguyên vẹn (`SYSTEM_PROMPT_V1_BASE`); chỉ thêm một dòng cho mỗi trường hand có (loại pot và số người mỗi street, straddle, ante, level MTT, multiway, side pot, cược không ai theo). Hand ghi tắt và hand cũ (không có state machine) nhận đúng prompt cũ. Hệ quả: system prompt có vài biến thể thay vì một bản cố định, cache theo biến thể. Sửa DEC-053 (1) "4 dòng cố định". (2) `response_format: json_schema` vốn đã bật; thêm: model/nhà cung cấp trả 400/404 thì gọi lại một lần không kèm `response_format`; Zod lỗi vẫn thử lại 1 lần rồi báo lỗi. (3) Benchmark: `BENCH_RUNS=n`, báo trung bình và min–max; JSON hỏng tính riêng, ba tỉ lệ còn lại chỉ tính trên reply hợp lệ. (4) Yêu cầu cho 5.2: đổi chuỗi ghi tắt của hand cũ thành `actions` qua state machine; chạy lại benchmark sau 5.2. Ghi chú 5.1d-2: "ý kiến thứ hai" và nhãn thử nghiệm trước beta.
- Lý do: 3 lần chạy 69 hand (gemini-3.5-flash-lite, $0.82), trung bình (min–max): v1 khớp EV 51% (46–53), báo sai nhầm 33% (29–42), bỏ sót lỗi 50% (47–53), JSON hỏng 5% (3–7); v2 khớp EV 48% (45–52), báo sai nhầm 50% (47–52), bỏ sót lỗi 25% (17–32), JSON hỏng 7% (4–9). Kết luận: về khớp EV hai bản không phân biệt được (khoảng chồng nhau). v2 báo sai nhầm nhiều hơn rõ (khoảng không chồng) và bỏ sót ít hơn rõ; đây là đánh đổi, không phải bản nào hơn hẳn. JSON hỏng vẫn 5–7% dù có `json_schema`: lỗi nằm ở nội dung (sai ngôn ngữ hoặc enum), không chỉ cú pháp. 69 hand legacy đều ghi tắt nên v1 ở đây chính là prompt cũ; dòng ngữ cảnh mới chưa được đo (chờ 5.2).
- Supersedes: DEC-053 (1) về 4 dòng cố định.
- Ai quyết: Đạt

## DEC-055 — Chuẩn hóa enum trước Zod, nút Thử lại cho review hỏng (task 5.1c-3, phần A)

- Ngày: 2026-10-20
- Quyết định: (1) Review/tóm tắt AI hỏng sau lần thử lại **không trừ lượt**: lượt là số dòng `ai_usage`, chỉ ghi sau khi `runReview`/`runSummary` thành công và review đã lưu; kiểm lại bằng đọc code `/api/review`, `/api/summary`. (2) Thêm `lib/ai/normalize.ts` chạy giữa `JSON.parse` và Zod: enum sai hoa thường/khoảng trắng/gạch nối hoặc đồng nghĩa gần (`wrong`→`mistake`, `pre-flop`→`preflop`, `null`→`none`, `"true"`→`true`, hạng `b+`→`B`) được map về mã chuẩn; tag không map được thì bỏ (không bỏ cả review); giá trị đơn không map được giữ nguyên để Zod báo lỗi và chạy thử lại. (3) Giữ một lần thử lại chung cho Zod và sai ngôn ngữ (DEC-054). (4) Màn review: lỗi có thể thử lại hiện nút "Thử lại" gọi lại đúng request cuối (kể cả phản bác); thông báo ghi rõ "Không trừ lượt"; thêm mã `upstream_error`, `save_failed`.
- Chưa làm: chi phí hai lần gọi hỏng không cộng vào ngân sách app $20/tháng (~5–7% lần gọi, vài cent). Xem lại trước beta.
- Ai quyết: Đạt (duyệt kế hoạch 2026-10-20)

## DEC-056 — Cấu trúc blind MTT, cột hands.level, thông tin phiên MTT (task 5.1c-3)

- Ngày: 2026-10-20
- Quyết định: (1) Cấu trúc blind lưu trong `sessions.mtt.blind_levels` (jsonb): `{level, sb, bb, ante, ante_mode (none/each/bb), minutes|null}`, đọc phòng thủ bằng `readBlindLevels` (bỏ dòng sai, sắp theo level, level trùng lấy dòng sau); không thêm cột. `readMtt` giữ `blind_levels` để Kết thúc phiên không làm mất nó. (2) Thêm cột `hands.level smallint check (level > 0)` (migration `20261020210000`, null cho cash và hand cũ; RLS của `hands` đã áp, thêm ca test) để thanh ngữ cảnh và nút Lên/Lùi level biết hand ở level nào mà không đoán. `level_bb` vẫn là nguồn quy ra bb. (3) Định dạng dán: `level sb/bb [ante] [phút]`, có `k` và dấu phân cách nghìn; ante > 0 lấy loại ante của phiên, phiên không có ante thì ante = BB là `bb`, khác là `each`; dòng không hợp lệ bỏ qua và báo số dòng đọc được. (4) Khi có cấu trúc, level vào (hoặc level đầu) quyết định SB/BB/ante của phiên: giá trị điền sẵn từ phiên trước hoặc gõ tay không được dùng, form ẩn ô blind/ante. (5) Ghi hand: có cấu trúc thì ante theo level (`draft.anteMode` không rỗng đè quy tắc DEC-034, vẫn lưu `hands.ante_mode/ante`); hand sau mang level, SB, BB, ante của hand trước như đã chơi, nút Lên/Lùi level điền lại từ cấu trúc, gõ tay BB không đổi số level và SB đi theo BB nếu trước đó chỉ bằng nửa BB cũ. Không có cấu trúc: SB cũng được mang sang (trước đây chỉ BB; SB trống làm hand sau lệch). (6) Gợi ý level theo thời gian (`suggestLevel`: cộng số phút từ level vào, null nếu thiếu số phút) chỉ là dòng chữ, không tự đổi. (7) Kết quả MTT giữ công thức DEC-039 (tiền thưởng + bounty − buy-in × (1 + re-entry)); màn Kết thúc thêm dòng chi phí. Tên giải, buy-in nhập lúc tạo phiên; re-entry, hạng, số người, tiền thưởng lúc Kết thúc phiên (đã có từ trước).
- Lý do: spec 5 (spec-ghi-hand-theo-action) và DEC-045/046 đã chốt cấu trúc nằm trong `sessions.mtt`; chỉ thiếu số level theo hand. Lỗi SB không mang sang thấy khi đọc `nextHandDefaults`.
- Chưa làm: hand cũ lưu trước 5.1c-3 không có `level` (nút Lên level suy ra level theo BB trùng); sửa cấu trúc giữa phiên không đổi hand đã lưu; ngữ cảnh AI chưa dùng `level`.
- Ai quyết: Đạt (duyệt kế hoạch và SQL migration 2026-10-20)

## DEC-057 — Lượt gọi AI hỏng cộng vào ngân sách app, không trừ lượt (cột ai_usage.failed)

- Ngày: 2026-10-21
- Quyết định: (1) Thêm cột `ai_usage.failed boolean not null default false` (migration `20261021100000`). (2) Mọi lượt gọi model thật mà hỏng (JSON sai sau thử lại, trả rỗng, timeout, lỗi nhà cung cấp, key bị từ chối) ghi một dòng `failed = true` với token và chi phí đã tiêu: `spentOn(e)` cộng cả lần gọi đầu đã trả tiền khi lần thử lại hỏng (`OpenRouterError.paid`), cộng chi phí trả rỗng; timeout/mạng/5xx = 0 vì không biết giá. Nút Thử lại là request mới nên mỗi lần hỏng một dòng. (3) `ai_app_spend_since` giữ nguyên (cộng mọi dòng `billed_to = 'app'`) nên ngân sách tính cả lượt hỏng; `loadUsage` đếm lượt tháng, lượt tóm tắt và lượt theo giờ chỉ với `failed = false`, nên người dùng không mất lượt. (4) Client không ghi/sửa được `ai_usage` (đã có, thêm ca test RLS).
- Thay thế phần "Chưa làm" của DEC-055.
- Ai quyết: Đạt (chọn cột `failed`, 2026-10-21)
