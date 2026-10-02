---
name: session-compress
description: Chốt phiên làm việc HoldNote — cập nhật brain/STATUS.md, thêm quyết định mới vào brain/DECISIONS.md, đánh dấu task xong trong docs/tasks.md và báo ngắn cho Đạt. Dùng khi kết thúc phiên, hoặc khi Đạt nói "chốt phiên" / "compress".
---

# Chốt phiên (session-compress)

Làm đúng thứ tự. Không in giá trị key trong `.env.local` ở bất kỳ bước nào.

## 1. Đo sức khỏe repo và ghi đè `brain/STATUS.md`

Chạy ở gốc repo:

```sh
pnpm test
pnpm typecheck
pnpm lint
```

Ghi lại số test pass/fail và ok/lỗi. Đối chiếu `docs/tasks.md` với `git log --oneline -30`.

Ghi đè `brain/STATUS.md`, tối đa 40 dòng, đúng các mục sau:

```
# STATUS — cập nhật <ngày giờ>
## Đã xong
## Đang làm
## Bước tiếp theo (tối đa 3, theo thứ tự)
## Vướng / cần Đạt quyết
## Sức khỏe repo
- test: <số pass/fail>  - typecheck: <ok/lỗi>  - lint: <ok/lỗi>
```

Chỉ ghi điều thấy được trong repo, git log và kết quả lệnh. Chỗ không rõ ghi `TODO(unknown): <câu hỏi>`.

## 2. Thêm quyết định vào `brain/DECISIONS.md`

Quyết định nào được chốt trong phiên thì **thêm** mục mới ở cuối, số DEC tiếp theo:

```
## DEC-0xx — <tiêu đề>
- Ngày: <YYYY-MM-DD>
- Quyết định: ...
- Lý do: ...
- Ai quyết: Đạt   (hoặc: Claude Code (chờ Đạt xác nhận))
```

Append-only: không sửa, không xóa mục cũ. Đảo quyết định cũ thì thêm dòng `Supersedes: DEC-xxx` trong mục mới.

## 3. Đánh dấu task

Task nào đã xong (code chạy, test xanh, đã commit) thì đổi `- [ ]` thành `- [x]` trong `docs/tasks.md`.

## 4. Báo cho Đạt

Tiếng Việt, tối đa 10 dòng: đã xong gì, bước tiếp theo, cần Đạt quyết gì.

## 5. Không commit

Không commit, không push, trừ khi Đạt bảo.
