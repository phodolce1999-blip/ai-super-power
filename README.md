# AI SUPER POWER — Website MVP

Website có **6 công cụ AI**, tài khoản người dùng, lịch sử, khu quản trị và kết nối DeepSeek API (tương thích OpenAI) phía máy chủ.

## Chạy tại máy tính

Yêu cầu **Node.js 20 trở lên**. Không cần cài thư viện ngoài.

```bash
cd ai-super-power
node server.js
```

Truy cập **http://localhost:3000**.

### Tài khoản quản trị demo (chỉ dùng tại máy cá nhân)
- Email: `admin@local.test`
- Mật khẩu: `ChangeMe123!`

**Bắt buộc đổi mật khẩu ngay nếu thử nghiệm có người khác truy cập.** Khi triển khai mới, đặt biến môi trường `ADMIN_EMAIL` và `ADMIN_PASSWORD` ngay từ lần chạy đầu tiên. Nếu database đã được tạo, thay đổi `ADMIN_PASSWORD` ở môi trường **không** đổi mật khẩu hiện tại: phải đăng nhập và đổi mật khẩu trong Quản trị.

## Kết nối AI

Website dùng **DeepSeek** (`https://api.deepseek.com/chat/completions`, model mặc định `deepseek-chat`). Đặt biến môi trường `DEEPSEEK_API_KEY` trên máy chủ, không đưa vào HTML/JavaScript client. Lấy key tại https://platform.deepseek.com.

macOS / Linux:

```bash
export DEEPSEEK_API_KEY="sk-..."
export ADMIN_EMAIL="admin@yourdomain.com"
export ADMIN_PASSWORD="a-strong-new-password"
export SESSION_SECRET="a-long-random-value"
node server.js
```

Windows PowerShell:

```powershell
$env:DEEPSEEK_API_KEY="sk-..."
$env:ADMIN_EMAIL="admin@yourdomain.com"
$env:ADMIN_PASSWORD="a-strong-new-password"
$env:SESSION_SECRET="a-long-random-value"
node server.js
```

Tùy chọn: `DEEPSEEK_MODEL` (mặc định `deepseek-chat`, có thể dùng `deepseek-reasoner`), `AI_BASE_URL` (mặc định `https://api.deepseek.com`, đổi sang API tương thích OpenAI khác nếu cần), `PORT`, `DATA_PATH`. `OPENAI_API_KEY` / `OPENAI_MODEL` vẫn được đọc làm dự phòng khi không có `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL`.

## Chức năng thực tế

1. **Studio video AI**: soạn kịch bản, storyboard, lời thoại, caption và prompt video; **chưa render tệp MP4**.
2. **Trợ lý AI**: hỏi đáp, SOP, phân tích và trợ lý tác vụ.
3. **Quảng cáo**: sinh bài viết và biến thể quảng cáo.
4. **Thiết kế**: sinh brief, bố cục, màu sắc và prompt hình ảnh; **chưa render PNG hoặc PPTX**.
5. **Ý tưởng content**: tạo danh sách và lịch ý tưởng.
6. **Tự động hóa**: thiết kế flow n8n/Make; **chưa kích hoạt workflow bên ngoài**.

Người dùng tự đăng ký, đăng nhập, xem lịch sử; quản trị xem số lượng tài khoản, thống kê, nhật ký và đổi tên website. Mọi lượt gọi AI dùng API trả phí riêng của bạn.

## Đưa lên hosting

- Chạy Node.js 20+ với lệnh `npm start` trên Render, Railway hoặc VPS.
- Thiết lập `DEEPSEEK_API_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET`.
- Đặt `COOKIE_SECURE=true` khi chạy HTTPS (trên Render/Railway nên bật).
- **Lưu dữ liệu trên persistent disk** và đặt `DATA_PATH` tới ổ này. Nếu không, dữ liệu có thể mất khi triển khai lại.
- Tuyệt đối không public mật khẩu mặc định.

## Giới hạn MVP & bước trước khi vận hành công khai

- Phiên đăng nhập đang lưu trong bộ nhớ và sẽ mất khi server khởi động lại; dùng Redis/DB để lưu session trong production.
- File JSON database phù hợp thử nghiệm một instance, không phù hợp khi chạy nhiều worker; nên chuyển PostgreSQL và migration khi mở rộng.
- Nên bổ sung xác minh email, quên mật khẩu, kiểm soát chi phí API theo user, quota, audit log, sao lưu tự động, reset tài khoản admin và chống spam/captcha.
- Chức năng đăng video, trả lời Facebook, sản xuất tệp ảnh hay gọi n8n thực tế cần tích hợp API/nền tảng có quyền truy cập riêng.
- Các thông số marketing như “x10 thu nhập”/“300% hiệu suất” trong ảnh tham khảo không phải kết quả được bảo đảm và **không** được đưa vào bản demo.
