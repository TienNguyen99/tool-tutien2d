# leon-project trên Cloudflare Pages

Đã triển khai: https://leon-project.pages.dev — hướng dẫn cài: https://leon-project.pages.dev/setup.html.
Cloud extension 1.3.66; bản local giữ nguyên 1.3.65.

Build và đóng gói từ thư mục project (PowerShell):
```powershell
node scripts/build-cloud.cjs
Compress-Archive -Path 'dist/leon-project/extension' -DestinationPath 'dist/leon-project/leon-project-extension.zip' -Force
Compress-Archive -Path 'dist/leon-project/*' -DestinationPath 'dist/leon-project-cloudflare.zip' -Force
```
Kết quả: `dist/leon-project` và ZIP để Direct Upload. Build lại sẽ xóa output cũ, nên luôn đóng gói lại cả hai ZIP.
`LEON_ORIGIN` có thể đổi HTTPS origin nếu Cloudflare cấp tên miền khác.

Cloudflare Dashboard: tạo Pages project `leon-project`, Direct Upload gói ZIP của nội dung
`dist/leon-project`. `_worker.js` xử lý API, `_routes.json` chỉ gọi Worker cho `/api/*`.
Tạo D1 `leon-project-db`, thực thi `schema.sql`, thêm binding tên `DB` trong Pages
Settings > Bindings rồi triển khai lại để binding có hiệu lực.

Wrangler thay thế: điền database_id thật vào wrangler.jsonc, chạy từ thư mục cloud:
`npx wrangler d1 execute leon-project-db --remote --file=schema.sql`, sau đó
`npx wrangler pages deploy ../dist/leon-project --project-name leon-project`.

Gói extension cloud dùng origin web, không cần server BAT. Người dùng tự đăng nhập game.
Không hỗ trợ lưu mật khẩu game/mở clone từ xa. AI mô hình chưa bật; planner và bộ nhớ
quyết định vẫn hoạt động. Nhịp điều khiển/chiến đấu chạy tại trình duyệt, không gửi cloud mỗi frame.
Heartbeat clone local được bỏ qua trên cloud để giảm số request.

Mỗi trình duyệt có khóa ngẫu nhiên 256 bit lưu trên origin web, dữ liệu D1 được lọc theo
SHA-256 khóa. Đây là phân tách theo thiết bị, chưa phải tài khoản đăng nhập/cơ chế khôi phục.
Không chia sẻ khóa. Xóa dữ liệu trang sẽ mất truy cập lịch sử cũ. Không tải log hoặc tài khoản
của người tạo tool lên cloud khi build; chỉ code và bản đồ/quest công khai.

Đã kiểm tra trên web thật: Quest line đọc đủ 32 giai đoạn, ghi chú lưu D1 còn sau tải lại.
Các test cloud-api.cjs và cloud-extension.cjs đã đạt; toàn bộ suite CJS đạt.
Chưa kiểm chứng Auto Quest trong game với extension cloud mới. Web cập nhật tập trung;
extension hiện vẫn cần tải/nạp lại khi có bản mới, chưa có auto-update từ cửa hàng.

## Cloud 1.3.67 — key và giao diện gọn
- Nhập key do chủ tool chỉ định trước khi chạy app/kết nối; server kiểm tra hash và cấp phiên HMAC hạn 24 giờ.
- Phiên truy cập lưu sessionStorage; khóa riêng dữ liệu vẫn giữ localStorage, nên đăng nhập lại không mất lịch sử.
- API yêu cầu X-Leon-Access; extension 1.3.67 truyền phiên từ dashboard, không chứa key trong bundle extension.
- Giới hạn thử key 8 lần/phút/IP trong từng Worker isolate (best effort, chưa thay thế WAF/rate limit phân tán). Key chung ngắn chỉ dành nhóm bạn, có thể bị chia sẻ/đoán.
- Dashboard rộng tối đa 1000px; cài đặt/thống kê thu vào mục mở rộng, nhật ký ở phần chính.
- tests/cloud-auth.cjs kiểm tra sai key, thiếu phiên, giả mạo và hết hạn; cloud-api/cloud-extension đều đạt.

## Quest line admin (1.3.70)
Quest line chỉ admin được đọc/ghi; giao diện yêu cầu key admin riêng. API kiểm tra
phiên có chữ ký dành cho vai trò admin, không tin vai trò do client tự khai.
Key chạy tool chỉ được gửi log và dùng dữ liệu riêng cho planner. Admin tổng hợp
log chẩn đoán của mọi thiết bị và cập nhật trạng thái fix chung. Hiển thị giới hạn
2.000 sự kiện gần nhất/100 lỗi gần nhất; các bản ghi D1 cũ không bị xóa.
Người dùng thấy thông báo tên nhân vật và log lỗi được gửi lên Cloudflare.
Queue local giữ sự kiện chưa được server xác nhận và tự thử lại; chưa có mạng hoặc
chưa xác thực thì không thể gửi ngay. Cần dùng extension bản cloud, không dùng bản
localhost để gửi dữ liệu vào D1.
