# Tiên Lộ Trợ Thủ

Extension trình duyệt và giao diện companion cục bộ hỗ trợ đọc trạng thái,
phân tích nhiệm vụ và điều khiển các cơ chế có sẵn của Tu Tiên 2D.

## Thành phần

- `extension/`: Chrome Manifest V3 content script.
- `index.html`: bảng điều khiển companion chạy tại máy cục bộ.
- `start-tienlo.bat`: khởi động web server cho companion.
- `PROJECT_STATUS.md`: trạng thái triển khai và hướng dẫn bàn giao.

## Chạy project

1. Chạy `start-tienlo.bat`.
2. Mở `chrome://extensions`, bật Developer mode và chọn **Load unpacked**.
3. Chọn thư mục `extension`.
4. Mở `https://tutien2d.online/?choi`, tự đăng nhập và bấm `✦ Trợ Thủ`.
5. Mở `http://127.0.0.1:8765/index.html` để điều khiển.

Sau mỗi lần cập nhật extension, cần tải lại extension và tải lại tab game.

## Quyền riêng tư

Project không lưu mật khẩu, cookie hoặc access token. Không commit thông tin đăng
nhập hay dữ liệu phiên game vào repository.

