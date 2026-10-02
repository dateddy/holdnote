# Prompt cho Claude Code

## Prompt 1 — dán vào Claude Code (bật Plan mode trước)

Đọc CLAUDE.md, docs/spec.md và docs/tasks.md. Đây là dự án HoldNote, chuyển từ app cũ trong legacy/.

Nhiệm vụ: làm Giai đoạn 1, task 1.1 tới 1.4 (monorepo + packages/poker-core với test). Chưa đụng tới Supabase.

Yêu cầu:
- Đưa kế hoạch trước (cấu trúc thư mục, dependency, danh sách hàm của poker-core, danh sách test) và chờ tôi duyệt rồi mới viết code.
- poker-core: viết test trước. Lấy fixture từ legacy/data/hands (các hand có `line` dùng ký hiệu H/V) và ca test vàng trong CLAUDE.md.
- Đọc parser cũ trong legacy/sotay-index.html để hiểu cú pháp, nhưng viết lại bằng TypeScript có kiểu, không copy.
- Mỗi task xong: chạy `pnpm test`, `pnpm typecheck`, `pnpm lint` xanh, đánh dấu [x] trong docs/tasks.md, commit riêng.
- Cuối cùng báo bằng tiếng Việt: đã làm gì, bao nhiêu test pass, hand nào trong dữ liệu cũ không khớp kết quả và lý do.

## Prompt 2 — sau khi đã có key Supabase trong .env.local

Đọc CLAUDE.md và docs/tasks.md. Làm task 1.5 tới 1.7 (Supabase migration + RLS, auth Google/email, i18n vi/en).
Đưa kế hoạch và schema SQL cho tôi duyệt trước khi tạo migration. Không đổi schema so với docs/spec.md mục 4 nếu chưa hỏi.
Xong thì hướng dẫn tôi từng bước bật Google login trong Supabase dashboard.

## Prompt các phiên sau

Đọc CLAUDE.md và docs/tasks.md. Làm task <số>. Đưa kế hoạch ngắn trước, chờ tôi duyệt.
