# Spec — Ghi hand theo action (thay spec 3.5, chế độ "Nút")

Chốt ngày 19/10/2026. Áp dụng chung cho Cash và MTT live. Chế độ ghi tắt H/V giữ nguyên làm chế độ phụ. Cả hai chế độ phải ra **cùng một mảng `actions`** (CLAUDE.md luật 4).

## 1. Phạm vi

**Có trong v1**
- Engine N người (2–10) trong `poker-core`. Người dùng chọn mình và một hoặc nhiều đối thủ (multiway) trên bàn mini; ghế được chọn là người được theo dõi, ghế khác tự fold.
- Straddle (chuỗi tối đa min(3, N−3), chỉ từ ghế sát bên trái BB), bật/tắt theo hand; công tắc tự khóa khi N không cho phép.
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

## 3. Thiết lập hand (trong thanh ngữ cảnh)

Không có bước thiết lập riêng và không có nút "Bắt đầu ghi": vào màn Ghi hand là nhập được ngay (task 5.1c-5).

**Thanh ngữ cảnh** (dính ở đầu màn): chip vị trí màu `[MP] vs [LJ] [BTN]`, "N người", stack của mình, straddle (cash) hoặc level/blind/giai đoạn (MTT). Điền sẵn theo hand trước; chạm thanh để mở **bàn mini** trượt ra ngay dưới thanh (không phủ màn, không làm tối). Bàn mini tự thu khi chạm ô bài, nút action hoặc chạm ra ngoài. Hand mới: vị trí mình điền sẵn, đối thủ trống, bàn mini tự mở ở thanh Đối thủ.

**Bàn mini** có hai thanh: Mình (màu `accent`) và Đối thủ (màu cam). Ghế chỉ tô màu, không ghi chữ "Mình"/"Đối thủ" (nghĩa nằm ở nhãn thanh và `aria-label`); ghế chọn tô đặc, ghế trống chỉ viền. Thanh Mình chọn 1 ghế, chạm ghế khác để chuyển, chọn xong tự sang thanh Đối thủ. Thanh Đối thủ chạm để chọn, chạm lại để bỏ, chọn nhiều (multiway); ghế của mình không chọn được. Mỗi đối thủ đã chọn có một dòng dưới bàn mini: vị trí, stack (điền theo lần gặp gần nhất), gắn tên (danh sách hiện tất cả đối thủ đã lưu, người trùng địa điểm phiên xếp lên đầu; mỗi người chỉ gắn được một ghế). Bộ đếm "N người [−][+]" nằm ngay trên bàn mini, bên phải.

| Trường | Mặc định | Ghi chú |
|---|---|---|
| Vị trí mình | Xoay theo hand trước | Chạm ghế trên bàn mini |
| Đối thủ (một hoặc nhiều) | Trống | Chạm ghế trên bàn mini |
| Bài mình | Trống | CardPicker, bộ 4 màu |
| Stack mình | Stack sau hand trước | Chip |
| Stack từng đối thủ | Lần gần nhất gặp đối thủ này | Bỏ trống được |
| Straddle (chỉ Cash) | Theo hand trước, ban đầu theo phiên | Công tắc + số nhà straddle 1–3 |
| Level, SB/BB, ante (chỉ MTT) | Theo hand trước | Nút "Lên level" |
| Giai đoạn giải (chỉ MTT) | Theo hand trước | Tùy chọn |

**Số người chơi N (2–10)** = số người được chia bài (người sit out không tính). Mặc định theo phiên, sau đó nhớ theo hand trước; lưu theo từng hand (`players_dealt`). Tên vị trí theo N (bỏ dần ghế đầu, BTN/SB/BB luôn có):

| N | Vị trí theo thứ tự hành động preflop |
|---|---|
| 10 | UTG, UTG+1, UTG+2, MP, LJ, HJ, CO, BTN, SB, BB |
| 9 | UTG, UTG+1, MP, LJ, HJ, CO, BTN, SB, BB |
| 8 | UTG, UTG+1, LJ, HJ, CO, BTN, SB, BB |
| 7 | UTG, LJ, HJ, CO, BTN, SB, BB |
| 6 | LJ, HJ, CO, BTN, SB, BB |
| 5 | HJ, CO, BTN, SB, BB |
| 4 | CO, BTN, SB, BB |
| 3 | BTN, SB, BB |
| 2 | BTN (đóng SB), BB |

**Heads-up (N = 2):** BTN đóng SB, đi trước preflop, đi sau cùng postflop; BB đi trước postflop. Tên cũ `SB` trong hand heads-up đã lưu đọc là `BTN`.

**Hand lưu trước 5.1c-5** dùng tên vị trí cũ (6 người: UTG, MP…). Khi đọc, `legacySeat(N, pos)` đổi sang tên mới (N=6: UTG→LJ, MP→HJ; N=5: UTG→HJ; N=7/8: MP→LJ). Không sửa dữ liệu đã lưu.

**Chọn ghế:** Mình chọn đúng 1 ghế (chạm ghế khác để chuyển). Đối thủ chọn nhiều ghế, chạm lại để bỏ; không chọn được ghế của mình. **Đối thủ chính** = người được chọn đầu tiên; nếu người đó fold thì chuyển sang người còn lại tới showdown (`primaryOpponent`). Hand lưu `villain_pos`, `villain_stack`, `opponent_id` của đối thủ chính và `opponents` cho tất cả.

**Đổi lựa chọn khi đã có action:** bỏ chọn một đối thủ, đổi vị trí mình, hoặc giảm N làm mất ghế → replay dừng ở action đầu tiên của ghế không còn được theo dõi; action đó và mọi action sau tô đỏ (`invalid`, cảnh báo `not_in_hand`), không xóa. Chọn lại ghế thì hết đỏ.

## 4. Straddle

- Chuỗi bắt đầu từ ghế sát bên trái BB, đi tiếp theo chiều kim đồng hồ, tối đa **min(3, N−3) nhà** (N=4: 1; N=5: 2; N≥6: 3; N≤3: không có). Không bao giờ tới BTN, SB, BB.
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
- Ghế không được chọn (không phải mình hay đối thủ đã chọn) tự coi là fold khi tới lượt. Muốn đưa ghế đó vào hand thì chọn nó làm đối thủ.
- Heads-up: BTN trước preflop, BB trước postflop (xem mục 3).

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
- O, B, R mở bàn phím số trượt ra ngay trong thẻ Action (không từ đáy màn).

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
4. Còn lại → sang street sau, action tiếp tục ngay. **Board không chặn action**: nhập board lúc nào cũng được, chạm ô nào mở bộ chọn bài cho ô đó, chọn xong tự sang ô kế.
5. Ô board mở theo street cuối mà action đã tới (flop 3 ô, turn 4, river 5); all-in được theo thì mở cả 5 ô để chọn nốt. Ô trong phần đã tới mà còn trống thì nhấp nháy để nhắc, không chặn. Sửa action làm một street không còn tồn tại: ô board của street đó tô cảnh báo (`extra`), không tự xóa lá bài.
6. Lúc lưu: board thiếu → nhãn "Thiếu dữ liệu"; board thừa → cảnh báo, vẫn lưu được.

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

- Mình: màu `accent`. Đối thủ: màu cam. Người khác: màu trung tính. Trong timeline chip vẫn ghi chữ "Mình"/"Đối thủ"; trên bàn mini ghế chỉ tô màu và nghĩa nằm ở nhãn thanh + `aria-label`.
- Bộ bài 4 màu: ♠ trắng/đen, ♥ đỏ, ♦ xanh dương, ♣ xanh lục.
- Thẻ bài 7 ô: Bài mình (2) | Flop (3) | Turn | River, một `CardPicker` dùng chung. Chạm ô thì bộ chọn trượt ra trong thẻ (không sheet, không làm tối); chọn xong tự sang ô trống kế (hết bài mình thì sang flop); chọn đủ lá hoặc chạm ra ngoài thì đóng, lúc mở thẻ Action thu còn hàng tab. Chọn rank xong, chất đã có trong bài mình/board bị mờ; lá trùng không chọn được (`takenSuits`, `duplicateCards`). Hai ô bài mình nhấp nháy khi còn trống; ô board thiếu nhắc bằng màu `warn`. Dòng nhắc: "Không nhớ board thì để trống".
- Thẻ Action: bàn phím số trượt ra trong thẻ; Hoàn tác là nút nhỏ cùng hàng với ‹ › và ⋯ ("+ Tiền khác" nằm trong ⋯); "Chưa có cược" thay "Không phải theo"; tab chưa có action không chiếm chỗ.
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
18. Ghế không được chọn tự fold; chọn thêm đối thủ thứ ba giữa preflop → thứ tự đúng.
19. 3 người, có all-in stack lệch → có cảnh báo side pot.
20. "+ tiền khác" (limper fold sau đó) → pot đúng.
21. Chia pot: kết quả đúng cho mình.
22. Sửa action cũ → action phía sau không hợp lệ bị đánh dấu.
23. Chưa nhập board: action vẫn đi tiếp; `boardCheck` báo ô thiếu (nhãn "Thiếu dữ liệu" khi lưu); board thừa sau khi sửa action thì báo ô `extra`.
24. Ghi tắt H/V và chế độ mới cho cùng một hand → mảng `actions` giống hệt.
25. Số người N = 2, 3, 4, 6, 9, 10: tên vị trí và thứ tự hành động preflop/postflop đúng bảng mục 3.
26. Heads-up: BTN đóng SB, đi trước preflop, đi sau cùng postflop; BB có option check sau limp.
27. Straddle tối đa min(3, N−3) ở N = 3, 4, 5, 6, 9, 10; không tới BTN/SB/BB.
28. Bỏ chọn đối thủ đã có action / đổi vị trí mình / giảm N → action của ghế đó và phía sau `invalid`, không xóa; chọn lại thì hết đỏ.
29. Đối thủ chính: người đầu fold → người kế; tất cả fold → người đầu.
30. `legacySeat` đổi tên vị trí cũ theo N; `remapSeats` giữ ghế còn tồn tại, bỏ ghế mất.
31. Chặn trùng lá: `duplicateCards`, `takenSuits` (lá `?` không tính trùng).
