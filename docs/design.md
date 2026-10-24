# Design — HoldNote

Nguồn chuẩn cho giao diện `apps/web`. Token màu nằm trong `apps/web/src/app/globals.css`,
component trong `apps/web/src/components/ui`. Đổi token hay thêm component thì sửa file này cùng commit.

## 1. Nguyên tắc

- Tối giản, một màu chủ đạo xanh lục; mặc định nền tối, tự đổi sang sáng theo máy (DEC-044).
- Dùng tại bàn bằng một tay: control chính cao ≥ 44px, nút Lưu luôn trong tầm ngón cái.
- Màu chỉ để báo nghĩa (thắng/thua/cảnh báo/đang chọn), không trang trí.

## 2. Màu (token)

Dùng qua class Tailwind: `bg-*`, `text-*`, `border-*`.

| Token               | Tối     | Sáng    | Dùng cho                                  |
| ------------------- | ------- | ------- | ----------------------------------------- |
| `background`        | #0c0f0d | #f6f8f6 | Nền trang                                 |
| `foreground`        | #ecf0ed | #101612 | Chữ chính                                 |
| `panel`             | #111612 | #eef2ef | Thẻ lớn bao trang và cột menu (desktop)   |
| `surface`           | #141a16 | #ffffff | Card, input, chip, thanh dưới             |
| `line`              | #27322b | #d6ded8 | Viền, đường kẻ                            |
| `muted`             | #8d9a91 | #5d6b62 | Chữ phụ, placeholder, tab không chọn      |
| `accent`            | #34c26b | #12853f | Nút chính, chip đang chọn, tab đang chọn  |
| `accent-foreground` | #04140a | #ffffff | Chữ trên nền accent                       |
| `win`               | #4ade80 | #12853f | Kết quả dương                             |
| `loss`              | #f87171 | #c62828 | Kết quả âm, lỗi, nút xóa, chất ♥♦         |
| `warn`              | #fbbf24 | #a15c00 | Stop-loss, thiếu dữ liệu                  |
| `villain`           | #fb923c | #c2570c | Đối thủ (ghế, thanh Đối thủ, chip action) + chữ "Đối thủ" |
| `villain-foreground`| #1c0b02 | #ffffff | Chữ trên nền `villain`                    |
| `suit-heart`        | #f87171 | #c62828 | ♥ trong bộ bài 4 màu                      |
| `suit-diamond`      | #60a5fa | #1d5fd1 | ♦                                         |
| `suit-club`         | #34d399 | #0f7a55 | ♣ (♠ dùng `foreground`)                   |

- Nền nhạt cho thông báo: `bg-loss/10`, `bg-warn/10`, `bg-accent/10`.
- Cấm: màu palette Tailwind (`red-700`, `zinc-*`…), mã hex trong `.tsx`, class `dark:`.
  Ngoại lệ: file sinh icon (`app/icons`, `apple-icon.tsx`, `lib/pwa/icons.ts`).

## 3. Chữ

Font Geist Sans (chữ), Geist Mono (ô ghi tắt). Số tiền/bb luôn `tabular-nums`.

| Bậc          | Class                                 | Dùng cho                                         |
| ------------ | ------------------------------------- | ------------------------------------------------ |
| Tiêu đề màn  | `text-2xl font-semibold`              | `h1`, chỉ trong `TopBar`                         |
| Tiêu đề mục  | `text-lg font-semibold`               | `h2`                                             |
| Tiêu đề nhóm | `text-base font-medium`               | `h3`, legend, nhãn nhóm                          |
| Thân         | `text-base`                           | Đoạn văn, giá trị input (16px để iOS không zoom) |
| Phụ          | `text-sm`                             | Nhãn ô, mô tả, link phụ, chip                    |
| Chú thích    | `text-xs text-muted`                  | Gợi ý dưới ô, nhãn tab, meta                     |
| Số lớn       | `text-2xl font-semibold tabular-nums` | Kết quả phiên, stack                             |

- Chỉ hai độ đậm: `font-medium`, `font-semibold`. Không `font-bold`.
- `text-xl`, `text-3xl` không dùng (riêng tên app ở trang đăng nhập được `text-3xl`).

**Chữ tiếng Việt:** không viết tắt ở bất kỳ màn nào ("Đối thủ", không "Đ.thủ"). Nút action ghi đủ chữ: Fold, Check, Call, Open, Bet, Raise, All-in.

## 4. Khoảng cách

Bậc dùng được: 1 (4px), 2 (8px), 3 (12px), 4 (16px), 6 (24px).

| Chỗ                              | Giá trị                                  |
| -------------------------------- | ---------------------------------------- |
| Lề trang                         | `p-6`, khung `mx-auto w-full max-w-md`   |
| Giữa các mục trong trang         | `gap-6`                                  |
| Giữa các ô trong một form/nhóm   | `gap-3`                                  |
| Nhãn ↔ ô, icon ↔ chữ             | `gap-1` hoặc `space-y-1`                 |
| Trong card                       | `p-4`, `space-y-2`                       |
| Lưới dày (lưới bài, hàng phím)   | `gap-1.5`                                |

Không dùng `gap-5`, margin lẻ (`mt-*`, `mb-*`) để căn; dùng gap của cha.

**Ngoại lệ — màn Ghi nhanh** (cho vừa 375×550 và 375×667 khi đang nhập):

| Chỗ                         | Giá trị                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| Giữa các mục                | `gap-3` (thay `gap-6`)                                                                          |
| Lề màn                      | 12px (`px-3`); vùng trong thẻ bài ở màn 375px: 375 − 24 − 16 = **335px**                        |
| Thẻ bài (`Card snug`)       | padding 8px (`p-2`), `space-y-2`                                                                |
| Thẻ Action (`Card tight`)   | padding 12px (`p-3`)                                                                            |
| Ô bài (`CardSlot size="card"`) | **41×57px**, khe **4px** trong nhóm, **12px** giữa các nhóm (7 ô: 287 + 12 + 36 = 335)        |
| Nhãn nhóm bài               | 11px, chữ hoa, giãn chữ 0.06em, `text-muted` (Bài mình · Flop · Turn · River)                   |
| Bàn phím chọn bài (`CardPicker`) | phím cao **48px**, khe **4px**; hàng 1: A K Q J T 9 8 (7 phím chia đều, ≈44px); hàng 2: 7 6 5 4 3 2 (6 phím cùng cỡ, thụt 24px mỗi bên); hàng 3: ♥ ♦ ♣ ♠ ? ⌫ (6 phím chia đều) |
| Chữ phím                    | rank 17px mono đậm; chất 20px; bộ 4 màu (♥ `suit-heart`, ♦ `suit-diamond`, ♣ `suit-club`, ♠ `foreground`) |
| Bàn phím số (`NumPad`)      | 4 cột × 4 hàng, phím cao 44px, khe 6px                                                          |
| Bàn mini                    | cao 192px (`h-48`), ghế 44px, xếp đều theo N, BTN ở đáy; panel là phần tử trong luồng trang đứng sau dòng tóm tắt dính, không có chiều cao tối đa, trôi lên khi cuộn |

Bộ chọn bài, bàn phím số và bàn mini **trượt ra trong luồng trang** (`Collapse`), không dùng `Sheet`, không làm tối màn. Phần đang dùng phải nằm trọn trên thanh Lưu ở 375×550 (`revealAboveBar` cuộn trang khi mở).

## 5. Kích thước control

| Cỡ   | Chiều cao     | Chữ         | Dùng cho                                                                          |
| ---- | ------------- | ----------- | --------------------------------------------------------------------------------- |
| `sm` | `h-9` (36px)  | `text-sm`   | Hành động phụ trong dòng (sửa, xóa dòng luật). **Không dùng ở màn Ghi nhanh.**    |
| `md` | `h-11` (44px) | `text-base` | Mặc định: nút, `Input`, `Chip`                                                    |
| `lg` | `h-14` (56px) | `text-lg`   | Hành động chính của màn: Lưu hand, Vào bàn, Kết thúc phiên                        |

- Bo góc: `rounded-md` cho mọi thứ; `rounded-full` chỉ cho chấm/vạch chỉ báo và `Toggle`; lá bài `rounded`.
- Tắt: `disabled:opacity-40`.
- Mỗi màn tối đa một nút `lg` `primary`.

## 6. Component (`components/ui`)

| Component                  | Dùng khi                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Button` / `buttonClass()` | Mọi nút; `buttonClass` cho `<Link>` trông như nút. Variant `primary` · `secondary` · `ghost` (nút trong suốt, không gạch chân) · `danger`; size `sm` · `md` · `lg` |
| `Chip` / `chipClass()`     | Chọn một/nhiều trong nhóm (vị trí, hành động, kết quả, bộ lọc); `tone="villain"` cho thanh Đối thủ; `icon` cho icon đứng trước chữ ("✕ Xóa lọc") |
| `Input` / `INPUT_CLASS`    | Ô nhập một dòng                                                                                                           |
| `Card` / `CARD_CLASS`      | Khối nội dung có viền                                                                                                     |
| `TopBar`                   | Đầu mọi màn (trừ đăng nhập, onboarding). Màn gốc của tab: tiêu đề lớn `text-2xl`, không back. Màn con (có `back`): thanh dính trên cùng, nền `background`, viền dưới, cao ≥56px, nằm dưới vùng an toàn của status bar; `<` (`BackButton`) 44px góc trái, tiêu đề `text-lg` một dòng (cắt bằng …), phụ đề `text-xs`, `action` bên phải. Màn Ghi nhanh dùng `compact`: thanh cuộn đi cùng trang vì đã có thanh ngữ cảnh dính |
| `BackButton`               | Nút `<` của thanh màn con. Có lịch sử trong app thì `router.back()` (nút back Android và `<` làm cùng việc), mở thẳng từ link/tải lại thì về màn cha; tên truy cập là chữ "Quay lại"/"Về phiên" |
| `Icon`                     | Icon lucide 20/24px theo màu chữ, ẩn khỏi trình đọc màn hình (nút chứa nó có tên). Chỉ dùng icon qua component này          |
| `Field`                    | Nhãn trên một ô nhập + gợi ý `text-xs text-muted` + lỗi `text-loss` (dùng với `Input`)                                    |
| `BottomNav`                | Thanh 3 tab (Trang chủ · Thống kê · Cài đặt), mỗi tab icon 24px + nhãn `text-xs`; tab đang chọn: icon + chữ màu `accent` và vạch `accent` ở mép trên. Ẩn ở onboarding, Ghi nhanh, form phiên (đã có thanh Lưu dính) |
| `PlayingCard` / `CardRow`  | Hiện lá bài                                                                                                               |
| `Result`                   | Số thắng/thua có màu                                                                                                      |
| `CardKey` / `CardSlot`     | Phím hạng/chất và ô lá bài của bộ chọn bài                                                                                |
| `Seat`                     | Ghế trên bàn mini: chỉ có tên vị trí; `selected` = tô đặc theo tone (mình `accent`, đối thủ `villain`), chưa chọn = chỉ viền; nghĩa nằm ở `aria-label` |
| `PosTag`                   | Chip vị trí nhỏ màu (`[MP]` xanh, `[BTN]` cam) trên thanh ngữ cảnh                                                         |
| `BarButton`                | Cả một thanh là một nút, căn trái (dòng tóm tắt dính; panel thiết lập là phần tử riêng đứng sau nó)                          |
| `Stepper`                  | `[−] N người [+]`, hai nút 44px, có min/max                                                                                |
| `Collapse`                 | Vùng mở ra trong luồng trang (panel bàn mini, bộ chọn bài, bàn phím số); đóng thì `inert`                                   |
| `ActionPill`               | Chip action trong timeline của street; chạm để mở hàng sửa ngay dưới (`active` = viền `accent`); `invalid` tô đỏ (`loss`)        |
| `NumPad`                   | Phím số 0–9, `.`, `k`, xóa                                                                                                |
| `Toggle`                   | Công tắc bật/tắt: rãnh bo tròn, núm tròn trượt (ngoại lệ `rounded-full` cùng chấm/vạch chỉ báo), vùng chạm 44px             |
| `StickyBar`                | Thanh dính đáy duy nhất của màn làm việc (Ghi nhanh): nền đặc, viền trên, safe-area                                       |
| `Tab` / `IconButton`       | Hàng tab street (xanh = xong hoặc đang tới lượt, đỏ nét đứt = có action không hợp lệ, mờ = chưa tới; tab đang chọn tô đặc) và nút vuông 44px một ký tự (`<>`, `‹`, `›`) |
| `CardSlot` (trạng thái)    | `size="card"` (41×57px) hoặc `fill`; `missing` (nhấp nháy viền `warn`), `need` (nhấp nháy viền `accent`: bài mình còn trống), `extra` (viền `warn` nét đứt), `duplicate` (viền `loss`), `highlight` (viền `accent`); ô khóa dùng `disabled` |
| `Card tight` / `Card snug` | Card `p-3` / `p-2` cho màn làm việc phải vừa một màn hình điện thoại (Ghi nhanh)                                          |

| `InfoTip`                  | Dấu `?` (hoặc `!` khi là lưu ý, `icon="!"`) cạnh nhãn chỉ số hoặc thuật ngữ. Chạm mở/đóng, chạm ra ngoài đóng, mỗi lúc chỉ một cái mở; chuột: hover; bàn phím: focus. Bảng chú thích căn giữa theo biểu tượng, luôn cách mép màn hình ≥8px, lật lên trên khi dưới không đủ chỗ (`lib/floating.ts`, dùng chung với `MoreMenu`, `ChipMenu`). Một câu, tối đa ~15 chữ, nằm trong file ngôn ngữ (ngoại lệ `rounded-full` như chấm chỉ báo; vùng chạm mở rộng 44px) |
| `StatTile`                 | Nhãn + `InfoTip` + một số lớn (`text-lg`, từ 1024px `text-2xl`; nhiều dòng thì mỗi dòng một số, như ô Net khi trộn cash và MTT) + dòng phụ tùy chọn |
| `FilterBar`                | Khung xếp các điều khiển lọc: `row` (cuộn ngang, ẩn thanh cuộn, mép phải mờ dần khi còn nút bị che; gắn `data-hscroll` để vuốt mép trái không tranh cuộn ngang; `wrapOnDesktop` thì từ 1024px xuống dòng thay vì cuộn) hoặc `column` |
| `Segmented`                | Chọn một trong vài mục đặt cạnh nhau (Tất cả / Cash / MTT), cao 44px                                                         |
| `ChipMenu`                 | Chip `Tháng ▾` mở danh sách ngắn (vị trí `fixed`, không bị cắt bởi vùng cuộn ngang); có `allLabel` thì mục đầu xóa lựa chọn, bỏ `allLabel` khi bắt buộc chọn một (tiền tệ) |
| `SortHeader`               | `<th>` mà tên cột là nút sắp xếp (`aria-sort`); `InfoTip` đặt bên cạnh, ngoài nút                                           |
| `AppShell`                 | Khung mọi màn đăng nhập từ 1024px (theo GTO Wizard): thanh trên có chữ HoldNote đứng riêng bên trái (không nằm trong thẻ nào) và nút tài khoản bên phải (menu: Cài đặt · Đăng xuất); cột menu trái luôn mở, không thu/mở, mỗi mục icon trên + tên dưới (Trang chủ, Thống kê), nằm trong thẻ `bg-panel` bo `rounded-xl`; cả trang nằm trong một thẻ lớn `bg-panel rounded-xl`, card của trang nằm trong đó, rộng tối đa 1800px. `--nav-w` = 8rem cho thanh dính đáy. Điện thoại không đổi: Cài đặt vẫn là tab ở thanh dưới. Ẩn ở onboarding |
| `EntryLayout`              | Khung màn nhập liệu (form phiên, Ghi hand, Sửa hand) từ 1024px: [cột trái] · nội dung · cột phải dính (`lg:sticky lg:top-32`) chứa tóm tắt và nút chính; điện thoại: các phần nối nhau một cột (`contents`) |
| `Fab`                      | Nút nổi góc dưới phải cho việc bắt đầu của một màn danh sách ("Phiên mới"); điện thoại nổi phía trên thanh tab, desktop cách mép 32px |
| `ShortcutsDialog`          | Bảng phím tắt (phím `?`), `<dialog>` modal; Esc và nền đóng                                                                    |

| `ActionTag`                | Chip action tĩnh trong hàng hand (không bấm được), cùng tone với `ActionPill`, cao 24px; `showWho={false}` trong bảng desktop (màu thay chữ, tên chỉ cho trình đọc màn hình) |
| `Badge`                    | Nhãn nhỏ trên hàng: `warn` (Cần xem lại), `accent` (Có AI phân tích), `muted` (Thiếu dữ liệu)                                    |
| `BoardRow` (trong `playing-card`) | Board với vạch mảnh ngăn flop \| turn \| river                                                                          |
| `MoreMenu`                 | Nút `⋯` ở đầu màn hoặc cuối một hàng mở danh sách hành động phụ (link hoặc hành động, mục `danger` chữ đỏ); đóng khi chạm ngoài hoặc Escape. Hàng phiên: Sửa · Xóa |
| `ConfirmDialog`            | Hộp xác nhận (`<dialog>` modal) cho việc không hoàn tác được, nút `danger` + Hủy                                              |

| `TableSeat`                | Ghế trên bàn replayer: vị trí + stack bb, tô màu mình (`accent`) / đối thủ (`villain`) / người khác (viền), ra khỏi hand thì mờ, nhãn All-in/Fold; tĩnh, `aria-label` đọc đủ vị trí, vai trò và stack |
| `BetChip`                  | Số bb đã cược trước một ghế ở street hiện tại                                                                                  |

`Button` có thêm variant `danger` (nền `loss`). `TopBar` hiện đồng thời nút back và `action`.

Chip bật/tắt chọn nhiều dùng `Chip`; ô tìm dùng `Input type="search"`. Danh sách phiên ghép các component trên trong `components/session`.

Sẽ thêm trong các task 5.1b-x: `Screen` (khung trang). `Icon`, `TopBar` tab/con và `Field` đã có từ 5.1d-3 (dependency `lucide-react`, DEC-062).

**Luật:** màn hình và component nghiệp vụ chỉ ghép từ `components/ui`; không viết `<button>`, `<input>`, `<textarea>`, `<select>` có style tay ngoài `components/ui`. Thiếu thì thêm component vào `components/ui` trước và ghi vào bảng trên.

## 7. Điều hướng

- 3 tab gốc (DEC-062): **Trang chủ** `/` · **Thống kê** `/stats` · **Cài đặt** `/settings`. Không còn tab Ghi hand: ghi hand từ chi tiết phiên, hoặc nút "+ Hand" ở hàng phiên gần nhất trên trang chủ. Điện thoại: thanh dưới 3 tab; từ 1024px: `AppShell` (cột menu Trang chủ · Thống kê, Cài đặt nằm trong menu tài khoản góc phải trên).
- Màn gốc của tab: không có nút back.
- Màn con: thanh trên dính với `<` ở góc trái (không có link chữ "Quay lại"/"Về phiên"). `<` đi qua lịch sử trình duyệt; mọi link vào màn con là `push`, nên nút back Android và `<` đồng nhất. Vuốt từ mép trái (≤20px, ngang ≥60px) làm cùng việc khi app cài trên iOS (Safari thường và Android đã có cử chỉ hệ thống); không bắt vuốt bắt đầu trong vùng `data-hscroll`.
- Tab cha vẫn sáng cho màn con (`lib/nav.ts`, `activeTab`); mọi màn `/sessions/**` và `/hands/**` thuộc Trang chủ:
  - Trang chủ: `/`, `/sessions/new`, `/sessions/[id]` (có danh sách hand; `/sessions/[id]/hands` chuyển về đây), `/sessions/[id]/edit`, `/sessions/[id]/summary`, `record`, `structure`, `end`, `/hands/[id]` (replayer + review; back về `/sessions/[id]` kèm bộ lọc), `/hands/[id]/edit` (Sửa hand). `/sessions/[id]/before` còn route nhưng không có link.
  - Thống kê: `/stats`; `/rules`, `/opponents`, `/opponents/new`, `/opponents/[id]` (con của Thống kê).
  - Cài đặt: `/settings`.
- Ngoại lệ bề rộng: trang Phiên từ 1024px không giới hạn `max-w-md` (hàng lọc ngang, 3 ô chỉ số ngang, bảng 9 cột + cột ⋯); form phiên `max-w-6xl`; Ghi hand / Sửa hand `max-w-7xl`; chi tiết phiên cũng vậy: chưa chọn hand thì bảng đủ 12 cột rộng hết màn, chọn hand thì lưới `420px | còn lại` (danh sách hàng 4 dòng bên trái, dính và cuộn riêng; replayer + review bên phải); Esc hoặc ✕ đóng; điện thoại vẫn `max-w-md`.
- Phần còn lại của cây màn chốt ở task 5.1b-2.

## 8. Form phiên (tạo và sửa dùng chung)

- Bốn `Card` theo thứ tự: **Loại và hình thức** → **Địa điểm và thời gian** → **Đơn vị và blind** → **Khác**; trong card các ô cách nhau `gap-3`, giữa các card `gap-6`.
- Điện thoại: nút Tạo/Lưu `lg` nằm trong `StickyBar` dính đáy; `BottomNav` ẩn ở màn này. Desktop (`EntryLayout`): 4 card xếp lưới 2 cột, cột phải dính chứa dòng tóm tắt và nút Tạo/Lưu. Cuối form, trên thanh Lưu, một dòng tóm tắt `text-sm text-muted`, ví dụ "Cash · Live · Chip · 20/50 · straddle 100 · 1 chip = 1.000 VND". Đơn vị chỉ được gọi tên ở dòng này và ở nhóm Đơn vị: không ghi đơn vị trong từng ô.
- Đơn vị: `Segmented` "Chip | Tiền tệ" (Chip là mặc định cho phiên cash Live); chọn Tiền tệ thì hiện `ChipMenu` chọn VND · USD · …. Chọn Chip thì hiện thêm một dòng "1 chip = [số] [tiền tệ ▾]", tùy chọn; để trống thì app chỉ hiện chip và bb, có điền thì hiện tiền ở dòng phụ.
- Ngày mặc định hôm nay, giờ vào mặc định lúc này, giờ ra để trống (đang chơi); giờ ra nhỏ hơn giờ vào là sau nửa đêm. Loại phiên khóa khi sửa. Ngày và giờ chỉ điền sau khi trang chạy trong trình duyệt (máy chủ không biết múi giờ người chơi); Sửa phiên nạp lại đúng ngày, giờ vào, giờ ra đã lưu (`editTimesFrom`).

## 9. Khối "AI phân tích"

- Tiêu đề `text-lg` + `InfoTip icon="!"` ("Mang tính chất tham khảo"). Không hiện phiên bản prompt (vẫn lưu trong DB), không nhãn "Thử nghiệm".
- Chưa có AI review: nút "AI review" và số lượt còn lại (lỗi hiện ngay dưới, có "Thử lại").
- Có review: Range đối thủ, Toán (kèm pot odds do poker-core tính), Line đề xuất, ICM (MTT), Lỗi, EV, Bài học hiện chỉ đọc; rồi công tắc "Tôi đã xem lại" (lưu ngay); rồi hội thoại phản biện (khung viền "Bạn" + lập luận, ngay dưới là khung `bg-accent/5` "AI" + nhãn "Giữ kết luận" `accent` / "Đã sửa kết luận" `warn` + câu trả lời); rồi khung Phản biện với dòng chi phí `text-xs text-muted` (miễn phí / trừ 1 lượt, còn bao nhiêu / key riêng) hiện trước khi gửi.
- AI nêu lá bài không có trong hand (sau một lần thử lại): đầu khối hiện "AI có thể đã đọc sai bài. Đối chiếu với bài trên bàn ở phía trên." (`text-sm text-warn bg-warn/10 p-3 rounded-md`); câu trả lời phản biện bị cờ có dòng `text-xs text-warn` cùng nội dung.
- "Chạy lại AI review": nút `secondary`, chỉ hiện khi hand sửa sau lần AI review gần nhất (kèm dòng "Hand đã sửa sau lần AI review gần nhất."), hỏi xác nhận trước.
- Thẻ "Bạn tự review" (`Card`, dưới khối AI): tiêu đề `text-base font-medium` + `Badge` trạng thái ("Chưa review" `muted` / "Đã lưu" `accent`). Chưa có: nút `secondary` "Tự review hand này" mở form. Đã có: cả hàng tiêu đề là `BarButton` (Sửa / Thu gọn), thu gọn vẫn hiện `Badge` EV và loại lỗi; mở ra là form (các ô, loại lỗi, EV, bài học, "Tôi đã xem lại", nút Lưu). Chạy AI không đụng review tay. Hai bên cho EV khác nhau thì có dòng `text-xs text-muted` "AI: Sai · Bạn: Đúng".

## 10. Khung desktop (từ 1024px, 5.1d-4)

- **Khung:** `AppShell` (thanh trên 56px với HoldNote + nút tài khoản, cột menu icon + tên, trang trong một thẻ lớn `bg-panel`). Thanh của màn con (`TopBar` có back) dính ở `top-14`, nền `bg-panel` ở desktop. Form phiên và Ghi/Sửa hand không giới hạn bề rộng ở desktop: chạy hết thẻ lớn (thẻ lớn dừng ở 1800px); các màn khác vẫn cột hẹp, nằm giữa thẻ lớn.
- **Form phiên (desktop):** ngày · giờ vào · giờ ra một hàng; SB · BB · Straddle một hàng; cột phải là thẻ "Tóm tắt" và nút Tạo/Lưu. Nhãn vẫn đặt trên ô (không để chữ trong ô) để ô đã điền vẫn đọc được tên.
- **Trang chủ:** thẻ phiên còn mở là một dải ngang viền `warn` (`ring-1 ring-warn/60`) (mô tả · ô giờ kết thúc · "Kết thúc phiên" · "Để sau"). Một hàng lọc: Tìm · Tất cả|Cash|MTT · Tháng ▾ · Địa điểm ▾ · Mọi kết quả|Thắng|Thua (chọn một) · Cần xem lại · "✕ Xóa lọc" (chip có icon, chỉ khi đang lọc, và là nơi duy nhất có "Xóa lọc"). Dưới hàng lọc là 3 ô chỉ số ngang rồi bảng; cả hàng bảng bấm được (hover sáng, Enter mở), cột cuối `⋯` (Sửa · Xóa). "Phiên mới" là `Fab`.
- **Ô Net:** cash hiện bb (phiên Chip chưa quy đổi cũng hiện bb), MTT hiện tiền; trộn hai loại thì hai dòng (bb cho cash, tiền cho MTT). "—" chỉ khi chưa phiên nào có kết quả.
- **Ghi hand / Sửa hand:** `EntryLayout`; bàn mini và thiết lập nằm trong một `Card`; ô bài 56×80px từ 1024px; nút action ghi phím đứng trước ("F Fold"), dưới nút có dòng nhắc phím tắt, dưới thẻ bài có "Gõ phím: Ah Kd… hoặc bấm ô". Từ 1280px: 3 cột `22rem | còn lại | 22rem`. 1024–1279px (còn menu bên trái, ba cột không vừa): 2 cột, khối 1 nằm trên khối 2 trong cột trái, cột Kết quả dính bên phải `20rem`.
  1. Bàn mini lớn (288px) với số người, stack, đối thủ, straddle, chế độ nhập (`TablePanel` mở sẵn, không có thanh ngữ cảnh trượt).
  2. Thẻ bài 7 ô và thẻ Action.
  3. Cột Kết quả dính: cảnh báo và gợi ý thiếu dữ liệu, showdown (pot, "Nhận về", "Lời/lỗ"), Một câu suy nghĩ, ⚑, thanh Lưu, nút "Phím tắt (?)". Không còn dòng cảnh báo nhỏ ở góc dưới trái.
  Điện thoại giữ bố cục một cột với thanh ngữ cảnh và `StickyBar`.
- **Nhãn kết quả (cả điện thoại):** số pot người thắng nhận là "Nhận về"; số thắng thua thật của mình là "Lời/lỗ".

## 11. Phím tắt (desktop, màn Ghi hand / Sửa hand)

Logic thuần ở `lib/hands/shortcuts.ts`, có test. Chỉ bật từ 1024px.

| Phím | Việc |
| --- | --- |
| `F` `C` `X` `B` `R` `O` `A` | Fold · Call · Check · Bet · Raise · Open · All-in, chỉ khi nút đó có trong `state.buttons` |
| số, `.`, `k`, `Enter` | Khi bàn phím số đang mở: gõ kích cỡ (nhận `k`), Enter xác nhận, Backspace xóa, Esc đóng |
| hạng rồi chất (`A` `h`, `T` `d`, `10` `s`) | Khi một ô bài đang chọn: điền ô rồi tự sang ô kế |
| `Z` | Hoàn tác action cuối |
| `←` `→` | Đổi tab street |
| `?` | Mở bảng phím tắt |

- **Không kích hoạt khi đang gõ** trong ô chữ (`input`, `textarea`, `select`, nội dung sửa được: Một câu suy nghĩ, gắn tên đối thủ, stack...) và khi giữ Ctrl / Cmd / Alt.
- Khi ô bài hoặc bàn phím số đang mở, chúng tự đọc phím của mình; phím toàn màn (`F C X...`) tạm nghỉ để `A` là Ách chứ không phải All-in.

## 12. Nút và link

- **Mọi thao tác là nút** (`Button`, `Chip`...): tạo, lưu, xóa, kết thúc, để sau, bỏ qua, sửa tay. Link gạch chân chỉ dùng để **điều hướng** sang màn khác (Cài đặt, "từ phiên...", thêm đối thủ). Nút trong suốt dùng `Button variant="ghost"`, không gạch chân.
- Một `<Link>` trông như nút (`buttonClass`) vẫn là điều hướng thuần (vd "Phiên mới", "+ Hand").
