---
name: db-migration
description: Quy trình bắt buộc cho database Supabase của HoldNote. Dùng MỌI LẦN tạo hoặc sửa bảng, cột, policy, function, view, trigger hay quyền (grant) trong Supabase — kể cả thay đổi nhỏ.
---

# Đổi database (db-migration)

Project Supabase đã link qua CLI (`supabase/.temp/project-ref`). Máy không có Docker: migration áp thẳng lên project thật, nên làm cẩn thận từng bước.

## Checklist bắt buộc

1. Tạo file migration **mới** trong `supabase/migrations/` (`<YYYYMMDDHHMMSS>_<mo_ta>.sql`); không sửa migration đã chạy.
2. Mọi bảng chứa dữ liệu người dùng: có `user_id uuid not null references auth.users on delete cascade`, `enable row level security`, và đủ 4 policy select/insert/update/delete với điều kiện `user_id = auth.uid()` (insert/update dùng `with check`).
   - Ngoại lệ (đã chốt với Đạt): bảng chỉ server ghi (`ai_usage`, `user_api_keys`) không cho client insert/update/delete; `profiles` do trigger tạo, user chỉ select/update các cột được phép (không đổi `plan`).
3. View: dùng `security_invoker = true` để view không bỏ qua RLS.
4. Function `security definer`: chỉ dùng khi bắt buộc, phải `set search_path = ''` và ghi lý do trong comment.
5. Tiền dùng `numeric(14,2)`; không dùng float.
6. Chạy test RLS (`pnpm test:rls`), phải pass.
7. Sinh lại TypeScript types từ schema (`pnpm db:types`).
8. Schema khác `docs/spec.md` mục 4 thì **dừng, hỏi Đạt trước**; được đồng ý thì thêm DEC vào `brain/DECISIONS.md` và cập nhật spec mục 4.

## Quy ước của repo

- Dùng `(select auth.uid())` trong policy (Postgres tính một lần mỗi câu lệnh).
- Bảng con trỏ tới bảng cha bằng khóa ngoại kép `(x_id, user_id)` để chỉ trỏ được tới dữ liệu của chính user.
- Không cấp quyền cho `anon` (bắt buộc đăng nhập).
- Kiểu liệt kê: `text` + `check (... in (...))`, không dùng enum.

## Lệnh, theo thứ tự

```sh
pnpm exec supabase db push --dry-run   # xem migration nào sẽ chạy
pnpm db:push                            # áp lên project
pnpm db:types                           # sinh lại apps/web/src/lib/supabase/database.types.ts
pnpm test:rls                           # test RLS thật với 2 user tạm
pnpm exec supabase db lint --linked     # không được có lỗi
pnpm typecheck && pnpm lint && pnpm test
```

Thêm bảng mới thì thêm ca kiểm vào `apps/web/tests/rls.test.ts`: user khác không đọc/sửa/xóa được, không insert được với `user_id` của người khác.
