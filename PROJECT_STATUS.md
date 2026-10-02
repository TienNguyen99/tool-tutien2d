# Tiên Lộ Trợ Thủ — trạng thái bàn giao

## Phiên bản hiện tại

- Extension: `1.3.45`

- 1.3.45: Dashboard ping tab game qua `window.opener`/liên kết cũ để bắt tay lại sau khi reload; game nhận ping và gửi state mới mà không tự bật Auto. Ngưỡng mất đồng bộ 15 giây, chỉ ghi một lần mỗi đợt và tự khôi phục trạng thái khi có dữ liệu. Clone tiếp tục thử heartbeat khi lỗi tạm thời, dừng an toàn nếu mất server quá 30 giây; server giữ trạng thái online tối đa 30 giây và thu hồi slot clone sau 2 phút im lặng. Test mô phỏng handshake và heartbeat đạt; chưa xác minh trực tiếp việc trình duyệt throttle tab nền hay game server mất kết nối.

- 1.3.44: Công tắc visionDialogs mặc định tắt; captureVisibleTab qua activeTab, xác nhận tab game active trước/sau chụp, crop dialog trong service worker. Ảnh chỉ gửi localhost Ollama dùng TIENLO_AI_VISION_MODEL, không trả raw ảnh vào page/không ghi log. Lựa chọn vẫn whitelist DOM và bỏ phản hồi stale. Test adapter mock đạt; chưa test Chrome permission/capture hoặc mô hình vision thật.

- 1.3.43: Settings công tắc reviveInPlace mặc định tắt. Khi Auto chết, chỉ tìm nút Hồi sinh tại chỗ trong #downed, không chọn về làng; chờ xác nhận sống lại rồi reset điều hướng/recovery. Giới hạn 3 lần click cách 5s và 30s tổng; không khả dụng thì dừng. Test revive.cjs mô phỏng đạt; chưa xác nhận DOM màn hình chết thật.

- 1.3.42: Stage 12 dùng workflow luyen_dan/Tụ Khí Đan, không còn bỏ forge-slot. Hội thoại giới hạn 4 lần cùng lựa chọn khi quest/HUD không tiến triển; sau đó ghi fail và loại lựa chọn để thử khác. Watchdog dừng sau 4 lần recovery không tiến triển, tương tác thử endpoint khác theo recovery index. Sửa P chưa khai báo trong nhánh gửi quest_stuck. Chưa phải detector mọi hành động combat/thiền; cần kiểm chứng trong game.

- 1.3.41: Kết thúc thiền linh lực dùng Player.stand thay vì toggle Q; giải phóng trạng thái/path quest. Auto đang chạy phát hiện ngồi còn sót khi HP/MP đủ và đứng dậy, nhưng giữ thiền nếu bước quest yêu cầu đả tọa/vận công. Stop đứng dậy nếu tool đang quản lý thiền. Test meditation-exit/recovery mô phỏng đạt; chưa kiểm chứng trong game.

- 1.3.40: quest-workflow.js đọc ô đan biểu tượng, phân biệt open_recipe/craft_item; mở đúng chi tiết được đánh giá riêng, craft xác nhận inventory tăng hoặc quest đổi. Ghi sequence vào choice_result trên server, vẫn dùng memory từng bước chứ chưa replay macro. Stage 9 đích Linh Dược tu_khi_duoc; chặn luyện khi tên chi tiết không khớp. Test mô phỏng đạt; chưa kiểm chứng DOM game thật.

- 1.3.39: quest-line.html/API hiển thị giai đoạn từ nguồn quest đã crawl, lọc nhân vật/fail, log chẩn đoán và ghi chú trạng thái fix lưu server. Heartbeat lưu quest_observed khi tiến độ đổi; watchdog gửi quest_stuck. Không tự coi choice success hay quest đã quan sát là quest hoàn thành. Dữ liệu cũ thiếu nhân vật để riêng.

- 1.3.38: Điểm đứng tương tác giới hạn 48px thay vì bán kính chọn prop lớn; scenery dùng tâm y thật, prop dùng y-TILE/2. Kiểm tra endpoint route trong tầm; hộp chỉ có Lui Bước tự đóng để tiếp cận lại. Dùng chung lấy nước/câu cá/chặt cây. Chưa kiểm chứng trong game; mục tiêu có tâm nằm sâu trong collision có thể báo không có điểm đứng, không fallback xuyên vật cản.

- 1.3.37: AI planner server `/api/ai/plan`, Ollama cục bộ qua TIENLO_AI_MODEL. Hội thoại không chắc dùng server memory/LLM trước fallback; xác thực index/label/confidence và lựa chọn thất bại, bỏ phản hồi stale, không bấm lặp. Log AI trong data/logs/ai-decisions.jsonl. Chưa cài/chạy mô hình thật; test mock adapter và extension đạt. Chưa phải planner điều hướng quest tổng quát hay training RL.

- 1.3.36: Hội thoại chưa xác định sau 6s thử nút đầu tiên theo thứ tự hiển thị, kể cả điểm semantic -1000 (ví dụ gieo hạt quest không phải luyện đan). Bỏ nút quay lại, thiếu nguyên liệu, xoá/vứt và lựa chọn có kết quả học âm. Không bấm lặp khi đang chờ kết quả; timeout vẫn ghi fail để lần sau thử option kế.

- 1.3.35: Dashboard có Settings bật/tắt và thanh kéo ngưỡng hồi máu, rút lui khi sát thương mạnh, né ngắn và thiền hồi linh lực. Tự lưu cấu hình và gửi sang game đang kết nối. Hồi máu tìm đường tránh quái tới điểm an toàn rồi dùng Q, tiếp tục khi đạt ngưỡng đã chọn; dừng kiểm tra nếu không tìm được điểm/không ngồi được/HP không tăng. Test recovery.cjs mô phỏng đạt; chưa kiểm chứng hồi máu trực tiếp trong game.

- 1.3.34: Chạy xa chỉ kích hoạt khi HP <20% và có sát thương mạnh mới; HP đúng 20% không kích hoạt. Hồi lên >=20% thì kết thúc chạy. Né ngắn hit-and-run là cơ chế riêng.

- 1.3.33: Máu thấp không kích hoạt/gia hạn rút lui. Chỉ sát thương mới trong cửa sổ 3s vượt ngưỡng (20% HP hoặc 35% giáp) kích hoạt chạy; dừng sau tối đa 8s tính từ lần sát thương mạnh gần nhất, hoặc khi đã thoát tầm tiếp xúc và 1s không bị đánh. Stop xóa path đang chạy. Máu thấp sau thoát thì dừng chờ hồi phục khi stopLowHp bật. Test retreat-timing.cjs đạt, chưa kiểm chứng trong game.

- 1.3.32: Ghi fail ngay khi hội thoại timeout; xóa trạng thái đã click để có thể thử option kế tiếp khi mở lại. Loại option có điểm học âm kể cả khi điểm semantic cao; ổn định memory key khi đổi thứ tự option/tiến độ. Stage 3 dùng đúng Tẩy Tuỷ Thang và cho phép click forge-slot. Gửi log/nạp bộ nhớ qua background extension kể cả không mở companion. Test mô phỏng đạt; chưa kiểm chứng trực tiếp trong game.

- 1.3.30: clones.html quản lý tối đa 5 phiên game qua heartbeat 2s, lệnh farm/stop từng phiên hoặc nhóm. Mất kết nối manager dừng farm được manager bật. Không lưu mật khẩu; chưa điều phối mục tiêu/khu hoặc tự tạo Chrome profile. Chrome Local Network Access có thể cần user cho phép. Test API isolation đạt; chưa test 5 profile thật.

- 1.3.29: Giữ target hợp lệ trong chọn quái farm/quest. Không điều hướng hay tự vệ chen vào attack/pose. Micro-dodge chỉ bắt đầu khi attackFired=true; chưa chứng minh đòn trúng qua server. Cần kiểm chứng nhịp animation trong game.

- 1.3.26: Lưu định nghĩa bản đồ có thể đọc được (cổng, tọa độ vật thể, quái) lên server qua world_map records; nạp lại vào đồ thị mapDefinitions. Không khẳng định đã thu thập toàn bộ game: khu chưa được runtime công bố vẫn cần khám phá. Collision grid vẫn kiểm tra trực tiếp tại map đang đứng.

- 1.3.25: decision-policy.js chứa điểm ưu tiên và tham số học lựa chọn. Hội thoại thiếu độ tin cậy sau 6s thử một lựa chọn không nguy hiểm/chưa thất bại; không bấm lặp cùng signature. Giá trị lựa chọn cập nhật theo reward tiến triển +20 / không tiến triển -20, learning rate 0.2, lưu cùng choice_result trên server. Đây là học giá trị hành động đơn giản, chưa phải mô hình RL toàn bộ game.

### Triển khai từng phần

- 1.3.23: Đường tới cổng, điểm quét, vật phẩm, quái, tự vệ và rút lui đều dùng safePathRoute kiểm tra hộp va chạm. Điểm rút lui được chấm theo khoảng cách thực thay vì số waypoint.
- Test: pathfinding.cjs (vách đá, vùng không nối, ngoài bản đồ); quest-routing.cjs; kiting.cjs; session-metrics.cjs.
- Chưa xác nhận trực tiếp trong game. Tiếp theo: kiểm chứng hit-and-run và chọn điểm đứng ở rìa tầm đánh thay vì tâm quái.
- Game: `https://tutien2d.online/?choi`
- Companion: `http://127.0.0.1:8765/index.html`
- Tệp chính: `extension/hook.js`, `extension/manifest.json`, `index.html`,
  `assets/js/app.js`

## Kiến trúc companion

- `index.html`: chỉ giữ cấu trúc HTML, không còn CSS/JavaScript nội tuyến.
- `assets/css/app.css`: giao diện.
- `assets/js/config.js`: cấu hình dùng chung.
- `assets/js/state.js`: state và lưu trữ.
- `assets/js/runtime-hook.js`: runtime hook dự phòng.
- `assets/js/app.js`: lớp điều phối kết nối và hành vi giao diện.
- `tools/dev-server.cjs`: server tĩnh dự phòng khi máy không có Python.

## Chức năng đã triển khai

- Hội thoại quá 8 giây không tiến triển: quay lại và lưu tối đa 200 log fail
  ở bộ đệm `tienlo-quest-failures-v1`, chuyển qua companion tới server Node.js.
- Server lưu bền vững vào `data/logs/quest-failures.jsonl`; companion tự thử lại
  khi mất kết nối, server chống ghi trùng. File log không được commit lên GitHub.
- Gieo hạt theo nguyên liệu còn thiếu trong công thức đan phá quan hiện tại.
- Auto Quest tự vệ khi mất máu/giáp và có quái gần, rồi tiếp tục nhiệm vụ khi hết đe dọa.
- Hội thoại chờ ổn định 1,2 giây, đối chiếu bước nhiệm vụ, chọn một lần rồi chờ kết quả.
- Đổi hạt chỉ chọn gói được bước phá quan yêu cầu; lựa chọn mơ hồ giữ hội thoại để phân tích.
- Auto Quest dùng runtime công khai `window.PNTT`, Pathfinder và dữ liệu nhiệm vụ của game.
- Đọc và lưu catalog Bách Khoa vào `localStorage` với khóa
  `tienlo-encyclopedia-knowledge-v1`.
- Giai đoạn 17 có state machine riêng: bắt đầu Hỏi Đạo, chọn đáp án đúng,
  chuyển câu tiếp theo và không chọn nút mở Bách Khoa.
- Nút “Mở Bách Khoa Tu Tiên” bị loại khỏi bộ chọn hội thoại tổng quát.
- AI Watchdog theo dõi chữ ký tiến độ nhiệm vụ. Sau 20 giây không đổi, nó ghi
  snapshot, phân tích nguyên nhân, báo vào nhật ký và thử khôi phục.
- Tối đa 30 snapshot được lưu tại `tienlo-quest-diagnostics-v1`.
- Trợ thủ cảnh báo khi tab game vẫn chạy content script cũ.

## Cách nạp đúng bản mới

1. Mở `chrome://extensions` và bấm **Tải lại** Tiên Lộ Trợ Thủ.
2. Bắt buộc tải lại tab game sau đó.
3. Tải lại trang companion và bấm `✦ Trợ Thủ` trong game để kết nối lại.
4. Chỉ bật Auto Quest khi log không còn cảnh báo engine cũ.

## Kiểm tra

- `node --check extension/hook.js`
- `node tests/quest-routing.cjs`: ưu tiên chỉ dẫn game và duyệt MapData.get qua các cổng.
- Phiên bản trong `extension/manifest.json` và `HOOK_VERSION` phải giống nhau.
- Khi kẹt trên 20 giây, log phải xuất hiện dạng:
  `AI WATCHDOG · kẹt ... · <phân tích>`.
- Có thể xem snapshot trong console game bằng
  `window.__tienloQuestAI.diagnostics()`.

## Trạng thái kiểm tra gần nhất

- Cảnh giới quan sát: Luyện Khí Tầng 4.
- Nhiệm vụ: Giai đoạn 17 — Hỏi Đạo và Tàng Kinh Các.
- Tiến độ quan sát gần nhất: 2/5 câu Bách Khoa.
- Auto Quest đã được dừng để tránh engine cũ tiếp tục chọn nhầm.

## Việc cần làm tiếp

- Khởi động lại server qua BAT, nạp extension 1.3.18 và tải lại tab game/companion.
- Chạy lại Auto Quest, xác nhận Hỏi Đạo đạt 5/5 rồi rút bí tịch mới.
- Nếu vẫn kẹt, đọc snapshot mới nhất trước khi sửa thêm luật nhiệm vụ.
