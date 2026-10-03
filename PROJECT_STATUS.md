# Tiên Lộ Trợ Thủ — trạng thái bàn giao

## Phiên bản hiện tại

- Gói chia sẻ Windows x64: `dist/TienLo-1.3.65-Windows-x64.zip` (~34 MiB), Node v25.6.1 và LICENSE đi kèm. Giải nén + CHAY-TOOL.bat; Load unpacked extension lần đầu vẫn thủ công. Smoke test từ ZIP đã giải nén đạt: bundled node/server, setup/dashboard, quest catalog, maps; audit ZIP không private/logs/accounts/.env. Chưa thử cài trên máy người khác; không kèm Ollama/model.

- Extension: `1.3.65`
- 1.3.65: Nút Chạy trong nền bật fallback rAF khi document.hidden (opt-in, document_start), race/cancel không lặp callback; không chạy khi browser freeze hoặc máy ngủ, timer nền có thể chậm. Bảng việc hôm nay đọc seedTaskList/active/quota từ runtime; unknown không coi completed. Test đã qua; live vẫn hook 1.3.64, chưa chứng minh chạy nền 1.3.65.
- 1.3.64: Live 1.3.63 mở Đại Phu còn 8 lượt nhưng memory phủ định nút nhận việc. Daily context mới theo task/quota tránh memory cũ và gộp lượt; workflow xác nhận mở sổ, chi tiết, active task; thành công reset attempt. Chưa xác nhận live bản mới.
- 1.3.63: Chụp ảnh hội thoại lỗi quyền activeTab hoặc capture thất bại tự gửi cùng quest/options/dialog tới AI bằng chữ. Không bỏ qua bộ lọc lựa chọn và không mở rộng quyền extension. Có regression test background; chưa kiểm chứng live extension mới.
- 1.3.62: Live log cho thấy sau giao Dược Công, fallback thử Đổi Gói Hạt Tụ Khí Đan dù rank=-1000. Fallback và AI nay tuân thủ hard reject; daily turn-in đánh dấu step, chặn mua/đổi/huỷ, tự rời quầy đổi hạt sai mục tiêu. Chưa kiểm chứng live bản mới.
- 1.3.61: Tool tự đóng #khu-panel/.khu-x trước watchdog rồi tìm lại đường. Rèn chờ xác nhận inventory tăng, giới hạn 4 thử/cooldown 8s; trang bị xác nhận isEquipped, tối đa 4 thử. Các thao tác này nằm trong hook, không phải Codex bấm hộ. Chưa kiểm chứng live hook mới.
- 1.3.60: Live đứng THỦ CÔNG tại bước rèn, quặng 1/2. Thêm planner kiếm quặng từ Thạch Yêu/Thạch Ma/Thạch Giáp Yêu trong hang, đủ thì tới Thợ Rèn chọn Thiết Kiếm; handler chọn slot và rèn; trang bị món sau khi flag rèn và inventory xác nhận. Chưa kiểm chứng UI rèn live bản 1.3.60.
- 1.3.59: Log live 1.3.58 ghi nhận dừng 11:15:38 sau 4 recovery ở bước đả tọa. Watchdog trước đây chỉ bù game clock đứng hẳn, bỏ sót đồng hồ chạy rất chậm. Bù theo delta thời gian mô phỏng kể cả khi visibility không đáng tin; vẫn giữ ngưỡng kẹt và giới hạn 4 recovery khi game chạy bình thường. Diagnostics thêm XP/realm/máu/downed/sit/bonus/gameTime và stepId. Chưa kiểm chứng phiên live với hook 1.3.59.

- 1.3.58: Sửa sai 1.3.57: Q không bật meditateBonusExp. Quest tại đài đá dùng E để game Player.sit(player,false,true); nếu ngồi Q không bonus thì đứng dậy tương tác lại. Giữ nguyên ngồi khi sit+bonus đã xác nhận. Test trực tiếp hàm tickMeditate trích từ source game: Q XP462 giữ nguyên, bonus tăng492 sau30s mô phỏng. Không có tab Chrome game trong CUA nên chưa test phiên live.

- 1.3.57: Bước day_dao_hanh tại đài đá dùng Q thay vì E; đang sit không toggle lại. Watchdog theo dõi Progress.exp thực khi thiền quest. Hồi linh lực không đứng dậy nếu vẫn cần thiền quest. Fix từ log stage20 2026-10-03, chưa xác minh XP thiền thật.

- 1.3.56: Nhãn nút game cập nhật khi ping kết nối lại; Stop giữ nhãn Đã kết nối nếu dashboard còn mở. Connect không che nhãn Auto đang chạy. Test reconnect đạt.

- 1.3.55: Bù thời gian timer quest bị đình chỉ (>3s) hoặc game clock đứng khi tab nền, không tính thời gian đó vào watchdog/hội thoại. Dashboard không báo mất kết nối chỉ do dashboard ẩn; khi quay lại ping và chờ 15s trước báo lỗi. Không ngăn Chrome đóng băng/discard tab. Test mô phỏng cadence đạt.

- 1.3.54: Utility khi chờ cây: trả việc 850, thu hoạch 800, tưới 780, săn Linh Thúy 650 trừ nguy hiểm, việc đang nhận 550, nhận Dược Công 420 trừ nguy hiểm, chờ 50. Đọc Farm.state/ready/remain, kiểm tra mỗi nhịp quest; chờ hợp lệ không kích watchdog. Setting utilityWhileGrowing mặc định bật. Chưa kiểm chứng chuỗi trong game thật.

- 1.3.53: Settings làm hết lượt Dược Công thường theo seedTaskList/runsLeft; ưu tiên trước quest chính khi bật, nhận/làm/trả rồi nhận tiếp, hết lượt dừng. Tùy chọn nhận thêm Đại Hội, nhưng trận Đại Hội vẫn cần người dùng tham gia/thắng (manual). Chưa kiểm chứng 15 lượt thật.

- 1.3.52: Settings autoFly mặc định tắt; kiểm tra mỗi 1s khi Auto chạy, dùng pressFlyToggle, kiểm tra đã bay/canFly/vùng cấm/menu/thiền/hồi phục; retry tối thiểu 5s. Tắt setting ngừng tự cất cánh, không tự hạ cánh. Chưa test game thật.

- 1.3.51: Bật tự hồi sinh mặc định và migration dashboard một lần; nhận nút Hồi sinh/Hồi sinh tại chỗ. Ưu tiên tại chỗ, fallback Về làng khi không khả dụng sau 5s hoặc hết giới hạn 3 lần/30s; về làng click một lần, chờ xác nhận tối đa 15s. Chưa test game thật.

- 1.3.50: Kiểm tra sát thương/rút lui mỗi 50ms; sát thương lớn kích hoạt ở mọi mức HP, hoặc HP thấp còn bị đánh. Khởi tạo mẫu HP/giáp trước Auto, xóa input/path cũ khi bắt đầu rút. Giữ thời gian chạy tối đa và điều kiện thoát tiếp xúc. Chưa đo độ trễ trong Chrome thật.

- 1.3.49: Stage 19 có handler riêng mở Tán Tu Chiến Bảng rồi bấm .cb-fight khả dụng; bỏ phân trang và không coi mở bảng là quest thất bại. Cooldown khiêu chiến 8s. Fix từ log 2026-10-03; chưa xác minh trận thật hoàn thành.

- 1.3.48: Khi đã trong tầm mục tiêu quest, dùng Input.pressInteract (cùng luồng phím E của game), giữ chọn target và cooldown 3,5s. Chỉ fallback scene.approach khi runtime thiếu API E. Đã đối chiếu input.js/world.js công khai; chưa kiểm chứng trực tiếp từng quest.

- 1.3.47: Dashboard ping mỗi 3s và khi focus/pageshow/hiện tab; game phục hồi timer khi bắt tay và gửi ngay khi hiện tab. Lỗi lưu bộ nhớ/map không chặn heartbeat. Test reconnect mô phỏng đạt; cần kiểm chứng throttle tab nền trên Chrome thật.

- 1.3.46: Cache lịch sử AI theo metadata file, nạp lại khi log thay đổi. Hội thoại ổn định 600ms, cách click 700ms; kiểm tra hộp thoại đang mở mỗi 250ms. Nhịp quest/combat nền và giới hạn fallback, chống bấm lặp giữ nguyên. Chưa benchmark trực tiếp trong game.

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

- Dashboard rộng tối đa 1800px, log ở cột chính, Settings và thống kê ở cột phải; responsive một cột dưới 1100px. Log giữ 500 sự kiện trong bộ nhớ phiên, tìm kiếm/lọc cảnh báo/Utility/combat, tạm dừng hiển thị, sao chép và xóa hiển thị. Tạm dừng không dừng Auto; xóa không xóa log server. Đã kiểm tra UI ở viewport nhỏ và desktop bằng browser.

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
## Cloudflare — 2026-10-03

- Website đã triển khai: https://leon-project.pages.dev.
- Cài extension cloud: https://leon-project.pages.dev/setup.html (1.3.66; local 1.3.65).
- D1 leon-project-db đã tạo schema events/fixes và binding DB; đã redeploy để áp dụng.
- Quest line đọc 32 giai đoạn; đã lưu ghi chú thử, tải lại xác nhận tồn tại rồi xóa nội dung thử.
- API lọc dữ liệu theo khóa riêng của từng trình duyệt; tests/cloud-api.cjs và tests/cloud-extension.cjs đạt, toàn suite CJS đạt.
- Không cần BAT ở bản cloud. AI mô hình, clone từ xa và auto-update extension chưa có.
- Auto Quest với extension cloud mới chưa được kiểm chứng trong game.
- Hướng dẫn build/deploy: cloud/README.md; ảnh: leon-project-cloud.jpg.


## Cloud 1.3.67 — 2026-10-03
- Đã deploy màn hình nhập key và API xác thực server, phiên HMAC 24h; khóa người dùng không nhúng trong extension.
- Test trên https://leon-project.pages.dev: key sai báo lỗi, key đã chỉ định mở dashboard thành công.
- Giao diện tối đa 1000px, nhật ký chính; cài đặt/thống kê thu gọn.
- tests/cloud-auth.cjs, cloud-api.cjs, cloud-extension.cjs đạt; hook/background/session syntax đạt.
- Cần nạp extension cloud 1.3.67 và tải lại tab game để truyền phiên X-Leon-Access. Chưa kiểm chứng Auto Quest trong game với bản này.
- Ảnh: leon-key-gate.jpg và leon-compact.jpg.

### UI cài đặt — 2026-10-03
- Khôi phục class chip cho link Cài extension khi build cloud.
- Trang setup dùng cùng stylesheet, nút tải nổi bật và 3 bước cài đặt; hướng dẫn cập nhật thu gọn.
- Sửa khối điều khiển giãn đủ chiều ngang trong bố cục gọn.
- Cloud extension regression đạt; kiểm tra trực quan trên web sau deploy.

## Cloud UI 1.3.68 — 2026-10-03
- Baloo 2 tự lưu tại assets/vendor/fonts (Google Fonts, OFL); icon SVG Lucide chính thức tự lưu kèm giấy phép.
- Bộ icon áp dụng cho điều hướng, thao tác auto, nhật ký, cài đặt và các ô chỉ số.
- Khí huyết đỏ, thần thức xanh dương; thanh chỉ số tính từ dữ liệu thật, không giả lập. Khí huyết <=30% thêm viền cảnh báo.
- Nhiệm vụ vàng, mục tiêu xanh lá; thẻ bo góc, nút và vùng focus đồng nhất, bố cục mobile dễ bấm.
- Cloud build thay toàn bộ chữ hiển thị Trợ Thủ/trợ thủ thành Leon; nút extension mới là ✦ Leon. Phiên bản local không đổi.
- Tests cloud-extension, cloud-api, cloud-auth đạt. Cần nạp extension cloud 1.3.68 để nhận tên nút mới.

## Tên hiển thị 1.3.69
- Đổi tên sản phẩm và nút kết nối thành Tiên Lộ theo phản hồi người dùng; tên nhân vật lấy từ game không bị thay đổi.
- Giữ nguyên tên project/địa chỉ leon-project.pages.dev và header/API kỹ thuật.
- Kiểm tra cloud-auth và cloud-extension đạt.

## Cloud 1.3.70 — Quest line admin tập trung
- Quest line GET/POST yêu cầu phiên admin HMAC riêng (1 giờ); key chạy tool không có quyền đọc hoặc sửa trạng thái fix.
- Admin đọc events từ mọi tenant, lọc theo nhân vật; giữ dấu thiết bị rút gọn để phân biệt nguồn. Hiển thị 2.000 sự kiện gần nhất, tối đa 100 lỗi gần đây cả lỗi không gắn stage.
- Fix dùng namespace admin-global, không trộn fix cá nhân cũ.
- Log vẫn tự gửi API quest-failures và lưu D1; lúc gửi lỗi thì queue trình duyệt tự thử lại. Dữ liệu cá nhân của planner vẫn tách riêng.
- Dashboard có thông báo log lỗi/tên nhân vật gửi Cloudflare để admin xem.
- Tests xác nhận người thường bị 403 khi đọc/ghi Quest line, token user không đóng giả admin, admin thấy events của hai người khác nhau và lưu fix chung.
- Key admin chỉ lưu dạng hash trong Worker, không nhúng vào mã client hoặc extension.

### Admin trên web thật
- Đã thử key người dùng ở màn hình admin: bị từ chối. Key admin mở được trang và API báo nguồn log tập trung.
- Hiện D1 chưa có lỗi game cloud; không tạo log game giả để trình diễn. Phân quyền/tổng hợp hai người được kiểm chứng bằng test D1 SQLite.
- Trang admin chờ xác thực xong mới khởi động truy vấn để không bị timeout lúc nhập key.

## Local 1.3.71 — quay về localhost, party boss
- HOOK_VERSION, manifest và EXPECTED_HOOK_VERSION đồng bộ 1.3.71. Cloud chưa redeploy các thay đổi này.
- Huyết Xích Cấm Địa/U Minh Cự Mãng: chờ hợp lệ khi chưa đọc được số người hoặc dưới ngưỡng an toàn 6 theo yêu cầu người dùng. Không tăng watchdog recovery hoặc tắt Auto Quest khi chờ; kiểm tra lại mỗi tick.
- Đủ người: tới nu_tu_mieu_hoang ở Miếu Hoang, chọn đăng ký. Trong các map bí cảnh đã xác định từ source game: theo boss nhiệm vụ; không để ưu tiên Yêu Thú/avoidBoss chặn mục tiêu bắt buộc trong chooseTarget.
- Source game hiện ghi minMembers 2/maxMembers 6. Không kết luận game bắt buộc 6 để vào; ngưỡng 6 là lựa chọn an toàn của người dùng.
- Chưa có source Party/Team đầy đủ trong crawl. Adapter đọc members/memberCount nếu runtime có; không có thì báo chưa đọc được, không giả định đủ đội. Cần xác minh adapter trên phiên game đăng nhập.
- Toàn suite CJS đạt sau sửa; tests/party-boss.cjs kiểm tra unknown/5/6/đăng ký đúng NPC/vào bí cảnh/rời bí cảnh kiểm tra lại. quest-routing đạt sau chỉnh NPC.
- Chưa kiểm chứng live toàn bộ Luyện Khí 1–13. Không tự tạo người chơi hoặc bấm game thay tool.

## Local 1.3.72 — tự tìm tổ đội
- Đọc source công khai net/gateway.js: API thực PNTT.Gateway.partyInvite(targetId), partyAnswer(true,inviteId), partyLeave(); trạng thái Gateway.party/members, partyId, leaderId, selfId, remotes và partyPending.
- Bổ sung party-auto.js, chỉ chạy khi Auto Quest đang cần party boss. Nhận lời mời còn hạn khi chưa có đội; tự mời người gần trong INVITE_RANGE của game (mặc định 180), không mời bản thân/thành viên/đã gục, chỉ trưởng đội hoặc người chưa có đội được gửi mời.
- Một thao tác mỗi 1.5s, mỗi người được mời cách nhau tối thiểu 60s; sau nhận lời mời chờ trạng thái server xác nhận.
- Tính 180s từ lần đầu quan sát server xác nhận party; thêm thành viên không reset đồng hồ. Chưa vào bí cảnh thì yêu cầu leave, tối đa 3 lần cách 5s, không tự sửa trạng thái party. Sau yêu cầu thành công chờ 30s trước tìm lại. Vào bí cảnh không leave vì timeout.
- Adapter partyBossState nay đọc Gateway thật thay vì chỉ Party/Team chưa xác minh.
- Hook/manifest/EXPECTED_HOOK_VERSION đồng bộ 1.3.72. Toàn suite CJS đạt, có tests/party-auto.cjs. Chưa kiểm chứng thao tác trên phiên game thật; cần reload extension local và tab game.

## Local 1.3.73 — Cành Khô pathfinding
- Route collision now follows player flying state and native rectFlyBlocked, preserving flight barriers.
- Search three rings including full interaction boundary for obstructed props.
- Full tests/*.cjs suite passed; actual Cành Khô collection not yet verified in game.


Cloud 1.3.73 deployed via authenticated Cloudflare Pages dashboard. Production manifest and dashboard version verified; extension ZIP HTTP 200.


## 1.3.74 — stage 8 water scoop
Native game SceneWorld confirmed scenery E uses Targeting.propReach (Ao Bich Thuy 72px). Scenery routes keep 4px margin; water guide chooses Muc nuoc explicitly; utility watering first opens missing water access. Full CJS suite passed. Cloud deployed and production manifest verified. Live game scoop not yet verified.


## 1.3.75 — garden workflow evidence
Stage 8 uses Linh Diep/Huyet Thao seed policy independent of breakthrough recipe. Garden actions confirmed by Farm water access and plot changes. Watchdog includes garden state and legitimate growing wait. Garden memory namespace isolates incorrect old failures. Full suite passed; Cloudflare production manifest verified 1.3.75. Live stage completion remains unverified.

## 1.3.76 — first Quest line repair batch
Daily credit prerequisites choose an available daily job. Quest return and Huấn Sư acceptance choices receive explicit priority. Fishing start is acknowledged by the game fishing state, with old incorrect fishing penalties isolated. Garden observation now applies beyond stage 8. Meditation progress includes both Progress and player XP. Hỏi Đạo recognizes the native colon/slash progress text. Full CJS suite passed, including regression cases for unchanged HUD with increasing player XP, daily selection and fishing acknowledgement. These are code-tested repairs; live game completion is not yet verified. Forge/equip, tournament and combat waits remain under review.

## 1.3.77 — quest weapon prerequisites and arena
Quest Thiết Kiếm checks native recipe ore and stone requirements. Missing ore or stones routes to cave monsters; enough inventory returns to forge. Existing iron weapons route to equip instead of duplicate crafting. Explicit Phi Diệp/Trúc Kiếm equip objectives use native Inventory.equip and confirmation, with watchdog on failure. Material gathering closes an old dialog before moving. Native chien_bang_dai map remains in arena combat until server return, bypassing NPC routing and ordinary stuck detection. Routing and arena regressions passed; live loot, forging, equipment and tournament completion remain unverified. This covers the quest iron weapon recipe, not arbitrary high-level crafting.

