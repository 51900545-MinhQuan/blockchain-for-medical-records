# blockchain-for-medical-records

Hướng dẫn chạy demo:

- Công cụ cần thiết: tiện ích mở rộng của trình duyệt (extension) MetaMask

- Để bắt đầu trang web, tại đường dẫn ...\CNTT2>:

1. npm install
2. npm start

Tài khoản MetaMask (đăng nhập thông qua gmail):
email: benhvienqk2025@gmail.com
password email: quankhoaTDTU_2025
password MetaMask: 5pt0105wLx8UX5QL

Thêm mạng Polygon Amoy tesnet nếu chưa có:

1. Vào menu của MetaMask
2. Networks
3. Add a custom network:
   Network name: Amoy
   Default RPC URL: https://rpc-amoy.polygon.technology
   Chain ID: 80002
   Currency symbol: POL
   Block explorer URL: https://amoy.polygonscan.com

Tài khoản Admin (đổi tài khoản ví MetaMask sang admin):
email: Admin@gmail.com
password: Admin123.

Tài khoản Doctor1 (đổi tài khoản ví MetaMask sang Doctor1)
email: HMQ@gmail.com
password: Abcd123.

Tài khoản Doctor2 (...Doctor2)
email: TAK@gmail.com
password: Abcd123.

Tài khoản Patient1 (...Patient1)
email: NguyenA@gmail.com
password: Abcd123.

Tài khoản Patient2 (...Patient2)
email: NguyenB@gmail.com
password Abcd123.

---

---

Notes:

clear node_modules trước khi up lên git:
rimraf node_modules

Cấu trúc code:

- models/ Chứa các thông tin bảng cơ sở dữ liệu
- routes/ Chứa các file định nghĩa route/hướng đi của URL cho ứng dụng
- middleware/ Chứa các file module dùng khi router, và file blockchain.js tạm thời để ở đó
- validators/ Chứa các quy tắc xác thực dữ liệu
- views/ Chứa các file giao diện người dùng (EJS templates)
- public/ Chứa các file tĩnh như CSS, JavaScript phía client, hình ảnh
- public/assets/js Chứa 2 file account-change.js (để kiểm tra sự kiện đổi tài khoản ví) và blockchain-client.js (để thực hiện các quy trình liên quan đến blockchain ở phía client)
- blockchain/ Chứa 2 file event-listener.js (để nhận sự kiện từ smart contract và tạo log admin) và blockchain-admin.js (để thực hiện các giao dịch sử dụng ví của admin)
- app.js File chính của ứng dụng, nơi khởi tạo và cấu hình chung
- bin/www File cấu hình server
