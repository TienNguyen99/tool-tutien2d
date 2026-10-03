# Tiên Lộ Trợ Thủ

Extension trình duyệt và giao diện companion cục bộ hỗ trợ đọc trạng thái,
phân tích nhiệm vụ và điều khiển các cơ chế có sẵn của Tu Tiên 2D.

## Thành phần

- `extension/`: Chrome Manifest V3 content script.
- `index.html`: khung HTML gọn của bảng điều khiển.
- `assets/css/app.css`: toàn bộ giao diện và responsive layout.
- `assets/js/config.js`: cấu hình, phiên bản hook và giá trị mặc định.
- `assets/js/state.js`: trạng thái phiên, localStorage và tiện ích dữ liệu.
- `assets/js/settings.js`: công tắc và thanh kéo cấu hình hồi máu/thiền/rút lui/né ngắn.
- `assets/js/runtime-hook.js`: runtime hook dự phòng chạy trong tab game.
- `assets/js/app.js`: kết nối extension, điều phối UI và WebMCP.
- `tools/dev-server.cjs`: web server Node.js dự phòng.
- `start-tienlo.bat`: khởi động web server cho companion.
- `PROJECT_STATUS.md`: trạng thái triển khai và hướng dẫn bàn giao.

## Chạy project

1. Cài Node.js và chạy `start-tienlo.bat` (server phục vụ UI và lưu log).
2. Mở `chrome://extensions`, bật Developer mode và chọn **Load unpacked**.
3. Chọn thư mục `extension`.
4. Mở `https://tutien2d.online/?choi`, tự đăng nhập và bấm `✦ Trợ Thủ`.
5. Mở `http://127.0.0.1:8765/index.html` để điều khiển.

Sau mỗi lần cập nhật extension, cần tải lại extension và tải lại tab game.
Sau khi đã liên kết bằng nút `✦ Trợ Thủ`, dashboard tự bắt tay lại với tab game
nếu trang dashboard được tải lại hoặc vài nhịp đồng bộ bị trễ. Không tự bật lại
Auto khi bạn đã dừng. Clone thử lại kết nối server; nếu mất quá 30 giây trong
lúc farm do manager điều khiển, clone dừng an toàn. Nếu server vừa cập nhật code,
cần khởi động lại `start-tienlo.bat` để nạp bản server mới.

## Settings an toàn

Mở **⚙ Settings** trên dashboard. Các thay đổi tự lưu trên trình duyệt và gửi tới
game đang kết nối; cũng được gửi khi bắt đầu Auto Quest/Farm.

- Hồi máu: bật/tắt tự tìm điểm an toàn, chỉnh % bắt đầu, % tiếp tục và khoảng cách với quái.
  Auto tìm đường qua collision grid rồi dùng Q; khi quái lại gần sẽ đứng lên tìm chỗ khác.
  Nếu HP không tăng trong 20s khi ngồi, tool dừng kiểm tra thay vì thiền vô hạn.
- Rút lui: bật/tắt chạy xa, chỉnh ngưỡng HP, sát thương HP/giáp trong 3s và thời gian chạy tối đa.
  Sát thương mạnh kích hoạt rút lui ở mọi mức HP; HP dưới ngưỡng cũng rút khi còn bị đánh.
  Kiểm tra nguy hiểm mỗi 50ms khi Auto chạy; độ trễ thực tế phụ thuộc trình duyệt/game.
- Hit-and-run: bật/tắt né sau khi phát đòn, chỉnh thời gian né và khoảng lùi.
- Thiền linh lực: chỉnh % bắt đầu và % tiếp tục. Ngưỡng tiếp tục luôn cao hơn ngưỡng bắt đầu.

Khi tự hồi máu bật, ngưỡng dừng máu thấp dự phòng không chặn nó.
Tính năng cần extension 1.3.35; chưa xác nhận hiệu quả hồi HP trực tiếp trong game.

## Quest line

Mở `quest-line.html` từ nút **Quest line** trên dashboard. Trang đồng bộ server mỗi 5s,
lọc nhân vật/quest có fail, xem log watchdog và ghi chú trạng thái fix. Trạng thái fix
lưu trong `data/logs/quest-fixes.json`. Tiến độ đã quan sát không phải xác nhận hoàn thành;
fail lịch sử không bị xoá khi đánh dấu đã sửa. Nguồn crawl hiện có 32 giai đoạn chính;
giai đoạn mới trong log được bổ sung, không cam kết đã có mọi quest phụ/bản cập nhật mới.
Restart server và reload extension 1.3.39 để dùng API và lưu log tiến độ mới.

## AI planner (extension 1.3.37)

Giai đoạn đầu: phân tích **hội thoại quest chưa rõ**, không điều khiển combat mỗi frame.
Code xử lý chắc chắn/bộ nhớ thành công trước; AI chọn trong danh sách nút hiện tại;
không chạy code do mô hình sinh. Quá thời gian/không hợp lệ vẫn fallback nút đầu tiên sau 6s.
Settings có công tắc AI. Mô hình chạy cục bộ qua Ollama, không gửi ra dịch vụ cloud.

Cài Ollama và tải một mô hình phù hợp với máy trước. Trong PowerShell, dùng tên mô hình
đã có trong `ollama list`, rồi khởi động server:

```powershell
$env:TIENLO_AI_MODEL = 'TEN_MODEL_DA_CAI'
node tools/dev-server.cjs
```

Đóng server tool cũ trước khi chạy; Ollama phải đang phục vụ ở `127.0.0.1:11434`.
Không đặt tên placeholder nguyên văn. Chưa đặt biến này thì không gọi mô hình;
bộ nhớ và fallback vẫn hoạt động. Giới hạn suy luận 4s để không giữ hội thoại vô hạn.
Máy/mô hình chậm có thể luôn fallback; chưa benchmark mô hình thật trên máy này.
Log quyết định: `data/logs/ai-decisions.jsonl`; feedback thành công/fail dùng
`quest-failures.jsonl` hiện có. Đây là planner + bộ nhớ, chưa phải training trọng số/RL.

## Quyền riêng tư

### Phân tích ảnh hội thoại (1.3.44)

Trong Settings bật AI và **Gửi ảnh hội thoại cho AI cục bộ**. Đưa tab game ra phía
trước, bấm icon extension Tiên Lộ trên thanh Chrome để cấp activeTab (có thể cần cấp
lại khi điều hướng). Không chụp tab clone đang ẩn hoặc một website khác.

Cấu hình `$env:TIENLO_AI_VISION_MODEL = 'TEN_MODEL_HO_TRO_ANH_DA_CAI'` trước khi
khởi động server. Mô hình text thường không đọc được ảnh. Payload Ollama gửi ảnh
JPEG base64 trong trường `messages[].images`. Chỉ chụp vùng hộp thoại; log server
lưu quyết định và cờ vision, không lưu ảnh. Ảnh vẫn tồn tại tạm trong bộ nhớ khi suy luận.
Chỉ chọn nút DOM hợp lệ; chưa hỗ trợ click toạ độ nút vẽ hoàn toàn trong canvas.
Giới hạn 4s có thể không đủ cho mô hình local chậm; chưa test mô hình thị giác thật.

Log fail lưu tại `data/logs/quest-failures.jsonl` trên máy chạy server, dùng làm
dữ liệu phân tích/học sau này. Trình duyệt chỉ giữ bộ đệm khi server chưa nhận.

Project không lưu mật khẩu, cookie hoặc access token. Không commit thông tin đăng
nhập hay dữ liệu phiên game vào repository.

