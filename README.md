# blockchain-for-medical-records

Hướng dẫn chạy demo:

- Công cụ cần thiết: tiện ích mở rộng của trình duyệt (extension) MetaMask

- Để bắt đầu trang web, tại đường dẫn ...\CNTT2>:

1. npm install
2. npm start

Tài khoản MetaMask:
email: benhvienqk2025@gmail.com
password email: quankhoaTDTU_2025
password MetaMask: 5pt0105wLx8UX5QL

testing:
whNcRv87Ra7M817e

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

Mongodb atlas cluster: mongodb+srv://sorrowle:IEbNxjdqgmJGfDnx@cluster0.aaa7lmd.mongodb.net/?appName=Cluster0
sorrowle
IEbNxjdqgmJGfDnx

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
- app.js File chính của ứng dụng, nơi khởi tạo và cấu hình chung

ref: https://docs.metamask.io/wallet/
https://docs.ethers.org/v6/

Plan:

1. viết code solidity trên Remix IDE gồm:

   - arrays doctorCodes(mapping address => bytes32), doctorWallets(mapping bytes32 => address), isDoctorRegistered(mapping address => bool): chứa address và doctorCode để check doctor có đăng ký wallet trên blockchain chưa
   - registeredDoctorWallet() cho doctor đổi flag của isDoct... sau đó lấy địa chỉ wallet ở backend,
     assignDoctorCode(address, bytes32) hệ thống sẽ tự động thực hiện transaction từ private_address của admin ở env giúp doctor link address-code
   - khi doctor kết nối ví ở profile, địa chỉ wallet và doctorCode sẽ được liên kết
   - khi tạo tài khoản patient, nếu liên kết bảng user với patient thành công thì sẽ có mục liên kết ví ở profile
   - admin sẽ thực hiện transaction tương tự với doctor, assignPatientCode(address, bytes32)
     assigns done.

   - array accessGranted(mapping bytes32 => mapping(bytes32 => mapping(bytes32 => bool))) gán true khi patient grantAccess

   - grantAccess(address, recordCode, doctorCode) với doctorWallets[doctorCode] bệnh nhân sẽ cấp quyền truy cập một bệnh án đến một bác sĩ
   - emit event (contract.on) AccessGranted/Revoked(patient, recordCode, doctor) để backend nhận và lưu những record vào db để có thể hiển thị lên trang bệnh nhân

   - một user có thể là guardian của nhiều patient, sử dụng chung ví của guardian, cập nhật db và front-end lại cho user.
   - ưu tiên việc nhận được emit events từ contract để hiển thị hoặc thực hiện những thao tác khác ở backend

XÓA "DELETE ALL COLLECTIONS" AUTH.JS 441, LOGIN.EJS 84/204
