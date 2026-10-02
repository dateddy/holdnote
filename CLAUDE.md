# HoldNote — hướng dẫn cho Claude Code

HoldNote (bản tiếng Việt: "Sổ Tay Hand") là web app (PWA) giúp người chơi poker ghi hand trong dưới 30 giây, được AI review và theo dõi leak qua nhiều phiên. Mỗi người một tài khoản. Thị trường đầu: Việt Nam và châu Á, sau đó châu Âu. Định vị: **nhật ký học poker** — không liên kết, không quảng bá sòng hay site tiền thật.

Chủ dự án: Đạt (dateddy). Trao đổi với chủ dự án bằng **tiếng Việt**, ngắn, thẳng. Code, tên biến, commit message bằng **tiếng Anh**.

## Tài liệu bắt buộc đọc
- `docs/spec.md` — spec đầy đủ (màn hình, database, AI review, logic tính toán). Là nguồn yêu cầu duy nhất. Không tự ý làm tính năng ngoài spec.
- `docs/tasks.md` — danh sách task theo giai đoạn. Làm đúng task được giao, xong thì đánh dấu `[x]`.
- `legacy/sotay-index.html` — app cũ (một file HTML). Parser ghi tắt, cách tính pot/kết quả/eff stack nằm trong phần `parseLine`, `tokenize`, `parseAmt`, `cardList`. Dùng làm tham chiếu khi viết `packages/poker-core`, **không copy nguyên xi** — viết lại bằng TypeScript có kiểu.
- `legacy/data/{sessions,hands,notes}/*.json` — dữ liệu thật từ app cũ (8 phiên, 79 hand, 6 ghi chú). Dùng làm fixture test và cho script migrate. **Thư mục này nằm trong .gitignore, không commit** (có tên đối thủ thật).

## Stack
- Monorepo pnpm: `apps/web` (Next.js App Router, TypeScript, Tailwind), `packages/poker-core` (TypeScript thuần, không phụ thuộc React).
- Supabase: Auth (Google + email magic link), Postgres, RLS, Vault. Migration SQL trong `supabase/migrations/`.
- AI: OpenRouter, gọi **chỉ từ server route** (`/api/review`, `/api/summary`). Output JSON kiểm bằng Zod.
- i18n: next-intl, tiếng Việt + tiếng Anh trước; tiếng Trung là ngôn ngữ thứ ba.
- Hosting: Vercel. Test: Vitest. Lint: ESLint + Prettier.

## Quy tắc
1. **Không có chế độ dùng thử không cần tài khoản.** Mọi màn hình trừ đăng nhập đều cần auth.
2. Mọi bảng dữ liệu người dùng có `user_id` và bật RLS `user_id = auth.uid()`. Không tạo bảng nào thiếu RLS.
3. Tiền lưu bằng đơn vị của phiên, kiểu `numeric(14,2)` (NL2 có số lẻ như 0.25). Số bb tính lúc hiển thị; MTT lưu `level_bb` từng hand.
4. Hai chế độ nhập (nút / ghi tắt H/V) đều ra cùng một mảng `actions` (spec 4.2).
5. Toán poker (pot odds, MDF, SPR, eff stack) do `poker-core` tính, không để AI tính.
6. Không commit secret. Key nằm trong `.env.local` (đã gitignore); thêm biến mới thì cập nhật `.env.example`.
7. **Hỏi chủ dự án trước khi:** đổi schema database đã chốt, thêm dependency lớn, đổi stack, hoặc làm việc ngoài task được giao.
8. `poker-core`: viết test trước, code sau. Mọi thay đổi phải giữ test xanh.
9. Commit nhỏ sau mỗi task chạy được, message dạng `feat(core): parse shorthand actions`.

## Lệnh
- `pnpm install` — cài.
- `pnpm dev` — chạy web (apps/web).
- `pnpm test` — chạy toàn bộ test.
- `pnpm --filter poker-core test` — test riêng core.
- `pnpm lint`, `pnpm typecheck`.

## Ca test vàng (bắt buộc pass)
Phiên BB = 50, stack mình 18000, đối thủ 20000, mình MP, đối thủ BTN, kết quả Thua:
`H lp V o500 H c / H x V b500 H c / H x V b1k H c / H b5000 V ai H c`
→ kết quả **−360bb (−18000 chip)**, eff stack **360bb**, stack mình sau hand **0**.
