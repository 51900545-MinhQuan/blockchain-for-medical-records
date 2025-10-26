# blockchain-for-medical-records

Chạy web:
1. npm install
2. npm start

Admin:
email: Admin@gmail.com
password: Admin123.

clear node_modules trước khi up lên git:
rimraf node_modules

Thay đổi nhỏ cho web trước khi bắt đầu nghiên cứu đề tài chính:

2. Tạo email phụ để send email cho chức năng đăng ký và quên mật khẩu (Tạm thời bỏ qua vì hệ thống phải yêu cầu tài khoản email thật để đăng ký)

6. Logo landscape phù hợp cho header nếu có
<!-- 7. Tìm kiếm các chức năng chính của một app bệnh viện, cho mỗi role -> triển khai
    + Trong trang chủ bác sĩ, có 2 mục thuộc "Bảng điều khiển" (đổi tên sau), Quản lý bệnh nhân (danh sách, thêm bệnh nhân), Hồ sơ bệnh án (danh sách) 
    + Khi thêm bệnh nhân, ID được tạo tự động và có định dạng rõ ràng (BN00000001), bệnh nhân có thể không cần có tài khoản trước khi đi khám lần đầu, bệnh nhân có thể liên kết sau, bảng Patient và User có trường chung để liên kết
    + Trong trang danh sách bệnh nhân, có search bar với nhiều miền search (ID, tên, ngày sinh, giới tính, sđt, địa chỉ), khi click vào bệnh nhân bất kỳ, có thể vào trang chi tiết
    + Trong trang danh sách hoặc trang chi tiết, có option tạo bệnh án mới, autofill những thông tin có sẵn
    + Danh sách bệnh án tương tự -->
8. Tích hợp blockchain và vào hệ thống.
9. Chuyển database online, deploy web online
 
Cấu trúc code:
├── models/         # Chứa các thông tin về cơ sở dữ liệu (Schema)
├── routes/         # Chứa các file định nghĩa route/hướng đi của URL cho ứng dụng
├── validators/     # Chứa các quy tắc xác thực dữ liệu
├── views/          # Chứa các file giao diện người dùng (EJS templates)
├── public/         # Chứa các file tĩnh như CSS, JavaScript phía client, hình ảnh
└── app.js          # File chính của ứng dụng, nơi khởi tạo và cấu hình chung






