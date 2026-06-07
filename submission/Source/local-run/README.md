# Chạy local

Thư mục này cung cấp một bộ chạy local tối thiểu cho frontend hiện có trong `../frontend/index.html`.

## Mục đích

- Phục vụ giao diện tại `http://localhost:3000`
- Đọc file `../frontend/index.html` rồi thay URL API trong bộ nhớ từ URL AWS thật sang `/api`
- Proxy các request `/api/*` sang API Gateway đã deploy trên AWS
- Tránh lỗi CORS khi test frontend ở môi trường local

## Thành phần

- `server.mjs`: web server local tối thiểu, đồng thời đóng vai trò reverse proxy
- `package.json`: khai báo script chạy local bằng Node.js

## Yêu cầu

- Máy đã cài `Node.js`
- Có internet để frontend gọi `Cognito` và proxy gọi `API Gateway`

## Cách chạy

Mở terminal tại thư mục này:

```bash
npm start
```

Sau đó mở trình duyệt tại:

```text
http://localhost:3000
```

## Cách hoạt động

1. Server local đọc file `../frontend/index.html`
2. Chuỗi `apiUrl` được thay trong bộ nhớ thành `/api`
3. Trình duyệt tải giao diện từ `localhost`
4. Các request `/api/*` được server local chuyển tiếp sang API AWS thật
5. Header CORS được xử lý ở local để frontend gọi được bình thường