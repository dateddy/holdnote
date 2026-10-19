# Spec — Ghi hand theo action (thay spec 3.5, chế độ "Nút")

Chốt ngày 19/10/2026. Áp dụng chung cho Cash và MTT live. Chế độ ghi tắt H/V giữ nguyên làm chế độ phụ. Cả hai chế độ phải ra **cùng một mảng `actions`** (CLAUDE.md luật 4).

## 1. Phạm vi

**Có trong v1**
- Engine N người trong `poker-core`; UI mặc định 2 người (mình + đối thủ chính), thêm người khi cần.
- Straddle (chuỗi tối đa 3, chỉ từ ghế sát bên trái BB), bật/tắt theo hand.
- MTT: level, SB/BB, ante (mỗi người hoặc BB ante), cấu trúc blind tùy chọn, nhãn giai đoạn giải.
- Cảnh báo (không chặn) khi raise dưới mức tối thiểu.

**Ngoài v1**
- Side pot: không tính. Hand có all-in với stack lệch và từ 3 người trở lên → hiện cảnh báo "kết quả có thể chưa chính xác".
- Rake / jackpot drop: không tính. Cho sửa tay kết quả cuối.
- Straddle ở BTN (Mississippi), bomb pot, run it twice, missed blind. Khoản tiền lạ đi qua nút "+ tiền khác".

## 2. Dữ liệu

- Forced bet đi vào chính mảng `actions` dưới dạng hành động post: `post_ante`, `post_sb`, `post_bb`, `post_straddle`. Không thêm cột cho straddle. Ghi quyết định này vào `DECISIONS.md` và cập nhật spec 4.2.
- Kiểu hành động người chơi: `open` (O), `bet` (B), `call` (C), `raise` (R), `allin` (A), `check` (X), `fold` (F), cộng `dead` cho "+ tiền khác".
- Mọi số tiền lưu bằng chip, **nghĩa là "lên tới" (tổng của street đó)**, không phải "thêm bao nhiêu". bb tính lúc hiển thị: Cash theo BB của phiên, MTT theo `level_bb` của hand.
- Nhãn giai đoạn giải (MTT) và loại ante: kiểm tra schema hiện có. Nếu phải thêm cột → **hỏi chủ dự án trước** (CLAUDE.md luật 7).

## 3. Bước ① Thiết lập hand

| Trường | Mặc định | Ghi chú |
|---|---|---|
| Vị trí mình, vị trí đối thủ chính | Xoay theo hand trước | Chạm ghế trên bàn mini |
| Bài mình | Trống | CardPicker, bộ 4 màu |
| Stack mình | Stack sau hand trước | Chip |
| Stack đối thủ chính | Lần gần nhất gặp đối thủ này | Bỏ trống được |
| Straddle (chỉ Cash) | Theo hand trước, ban đầu theo phiên | Công tắc + số nhà straddle 1–3 |
| Level, SB/BB, ante (chỉ MTT) | Theo hand trước | Nút "Lên level" |
| Giai đoạn giải (chỉ MTT) | Theo hand trước | Tùy chọn |

Số ghế (6-max / 9-max) lấy từ phiên.

## 4. Straddle

- Chuỗi bắt đầu từ ghế sát bên trái BB, đi tiếp theo chiều kim đồng hồ, tối đa **3 nhà**. Không bao giờ tới BTN, SB, BB. Bàn 6-max: tối đa 3 (không chạm BTN).
- Mức: straddle đầu = 2×BB, mỗi re-straddle = 2× mức trước. Cho sửa từng mức.
- Người straddle cuối hành động sau cùng preflop và có quyền check (X) hoặc raise, giống BB.
- Mức cược hiện tại ban đầu = straddle cuối. Bước raise tối thiểu ban đầu = mức straddle cuối.
- Đơn vị bb vẫn theo BB của phiên.

## 5. MTT

- Loại ante: `none` | `per_player` | `bb_ante`.
  - `per_player`: mỗi ghế đóng ante.
  - `bb_ante`: ghế BB đóng một khoản thay cả bàn (mặc định = BB).
  - Ante là **tiền chết**: vào pot, không tính vào mức phải theo. Đóng trước blind.
- Cấu trúc blind: tùy chọn khi tạo phiên (danh sách level: SB, BB, ante). Bỏ qua được.
  - Có cấu trúc → "Lên level" tự điền SB/BB/ante.
  - Không có → mỗi hand tự nhập, điền sẵn theo hand trước.
- Nhãn giai đoạn giải (tùy chọn, chọn lúc ghi hand): Đầu giải · Giữa giải · Gần bubble · Bubble · ITM · Bàn chung kết · Heads-up.
- MTT ẩn straddle.

## 6. Thứ tự hành động

- **Preflop**: bắt đầu từ ghế bên trái forced bet lớn nhất cuối cùng (BB, hoặc straddle cuối), đi theo chiều kim đồng hồ. Người đóng forced bet cuối hành động sau cùng.
  - Ví dụ 9-max, 25/50, UTG straddle 100, UTG+1 re-straddle 200: UTG+2 → … → BTN → SB → BB → UTG → UTG+1.
- **Postflop**: ghế còn chơi đầu tiên bên trái BTN (SB trước), theo chiều kim đồng hồ, BTN cuối.
- Bỏ qua ghế đã fold hoặc all-in.
- Ghế không theo dõi (không phải mình, đối thủ chính, hay người đã thêm) tự coi là fold khi tới lượt. Chạm vào ghế đó để thêm vào hand.

## 7. Nút hiện theo tình huống

| Tình huống | Nút |
|---|---|
| Preflop, chưa ai vượt forced bet | F, C (limp), O, A |
| Preflop, người đóng forced bet cuối, pot chỉ có limp | X, O, A |
| Đang phải đối mặt open / raise / bet | F, C, R, A |
| Đang đối mặt all-in thiếu, đã hành động trước đó | F, C |
| Postflop, chưa ai bet | X, B, A |

- C không cần số: tự lấy mức phải theo (hoặc all-in nếu stack không đủ).
- A không cần số: bằng stack còn lại. Stack không rõ → hỏi số.
- O, B, R mở bàn phím số trượt lên.

## 8. Nhập số

- Phím tắt:
  - Open: 2× · 2.5× · 3× mức cược hiện tại (không straddle thì chính là 2 / 2.5 / 3bb).
  - Raise: 3× · 4× mức cược đang đối mặt.
  - Bet: ⅓ · ½ · ⅔ · pot.
- Bàn phím số 0–9, `.`, `k` (×1000), xóa.
- Hiện song song chip và bb ngay khi gõ, ví dụ "5.000 (100bb)".
- Nhãn trên ô: "Lên tới".

## 9. Kiểm tra hợp lệ

- Raise tối thiểu: lên tới ≥ mức cược hiện tại + bước raise gần nhất. Dưới mức → **cảnh báo, vẫn cho lưu**.
- All-in thiếu (phần tăng nhỏ hơn bước raise gần nhất): không mở lại quyền raise cho người đã hành động.
- Bet / raise vượt stack → tự chuyển thành all-in, báo cho người dùng.

## 10. Chuyển street và kết thúc

1. Vòng cược khép lại khi mọi người còn chơi và chưa all-in đã hành động sau lần raise đủ cuối cùng và đã theo bằng mức cược.
2. Còn 1 người chưa fold → hết hand, người đó thắng.
3. Tất cả còn lại đã all-in (hoặc chỉ 1 người chưa all-in và đã theo) → chọn nốt các lá board còn thiếu, bỏ qua action, sang showdown.
4. Còn lại → sang street sau: chọn lá board trước (flop 3, turn 1, river 1), rồi tới action.
5. Không nhớ board → cho bỏ qua, hand gắn nhãn "Thiếu dữ liệu".

## 11. Showdown và kết quả

- Bài đối thủ: tùy chọn.
- Chọn kết quả: Mình thắng · Đối thủ thắng · Chia.
- Kết quả của mình = phần nhận về − tổng đã bỏ vào (chip và bb). Chia: chia đều cho những người chia.
- Không trừ rake. Cho sửa tay con số cuối, gắn cờ "đã sửa tay".
- Multiway có all-in stack lệch → cảnh báo side pot (mục 1).

## 12. Sửa và hoàn tác

- Hoàn tác action gần nhất.
- Chạm một chip action cũ để sửa → tính lại toàn bộ phía sau. Action phía sau trở thành không hợp lệ thì tô cảnh báo, không tự xóa.

## 13. Hiển thị

- Mình: màu `accent` + chữ "Mình". Đối thủ chính: cam + chữ "Đ.thủ". Người khác: màu trung tính. Không để màu một mình mang nghĩa.
- Bộ bài 4 màu: ♠ trắng/đen, ♥ đỏ, ♦ xanh dương, ♣ xanh lục.
- Timeline chip theo street cập nhật ngay khi nhập (ví dụ "UTG O 2.5bb", "BTN C").

## 14. Kiến trúc

- Toàn bộ luật ở mục 4–12 nằm trong `packages/poker-core` dạng state machine thuần (không React): đầu vào là thiết lập hand + chuỗi action, đầu ra là trạng thái (lượt của ai, nút hợp lệ, mức phải theo, bước raise tối thiểu, pot, street, cảnh báo).
- UI chỉ gọi state machine, không tự tính luật.
- Ca test vàng −360bb và toàn bộ test cũ phải xanh.

## 15. Ca test bắt buộc (viết trước khi code)

1. Heads-up cơ bản: open, call, check xuống tới river, showdown.
2. Ca vàng −360bb chạy qua state machine ra đúng kết quả.
3. Fold preflop trước open → hết hand, mình mất blind (nếu ở SB/BB).
4. Limp, BB check option → sang flop.
5. Limp, BB raise → limper có F/C/R/A.
6. 3bet, 4bet, 5bet all-in, call → chạy nốt board.
7. Straddle 1 nhà: thứ tự preflop đúng, người straddle có X khi chưa ai raise.
8. Re-straddle 3 nhà (100/200/400): thứ tự, mức cược hiện tại 400, raise tối thiểu tới 800.
9. Bàn 6-max: không cho straddle tới BTN.
10. Mình ở ghế straddle.
11. Postflop: SB đi trước, BTN đi cuối; bỏ qua ghế đã fold.
12. MTT ante mỗi người: pot đúng, ante không tính vào mức phải theo.
13. MTT BB ante: pot đúng, ante đóng trước blind.
14. MTT: đổi level giữa phiên, bb tính theo `level_bb` từng hand.
15. All-in thiếu: người đã hành động chỉ có F/C.
16. Raise dưới mức tối thiểu → có cảnh báo, vẫn lưu được.
17. Bet vượt stack → tự thành all-in.
18. Ghế không theo dõi tự fold; thêm người thứ ba giữa preflop → thứ tự đúng.
19. 3 người, có all-in stack lệch → có cảnh báo side pot.
20. "+ tiền khác" (limper fold sau đó) → pot đúng.
21. Chia pot: kết quả đúng cho mình.
22. Sửa action cũ → action phía sau không hợp lệ bị đánh dấu.
23. Bỏ qua board → nhãn "Thiếu dữ liệu".
24. Ghi tắt H/V và chế độ mới cho cùng một hand → mảng `actions` giống hệt.
