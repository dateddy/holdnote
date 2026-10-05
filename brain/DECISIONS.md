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
