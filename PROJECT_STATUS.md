# Tiên Lộ Trợ Thủ — trạng thái bàn giao

## Phiên bản hiện tại

- Extension: `1.3.8`
- Game: `https://tutien2d.online/?choi`
- Companion: `http://127.0.0.1:8765/index.html`
- Tệp chính: `extension/hook.js`, `extension/manifest.json`, `index.html`

## Chức năng đã triển khai

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

- Nạp extension 1.3.8 và tải lại tab game.
- Chạy lại Auto Quest, xác nhận Hỏi Đạo đạt 5/5 rồi rút bí tịch mới.
- Nếu vẫn kẹt, đọc snapshot mới nhất trước khi sửa thêm luật nhiệm vụ.
