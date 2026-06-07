# Tổng quan thư mục source

Thư mục `source` chứa mã nguồn nộp kèm cho phần triển khai ứng dụng Task Manager theo kiến trúc serverless trên AWS.

## Cấu trúc thư mục

- `frontend/`: mã nguồn giao diện người dùng
- `backend/`: mã nguồn 4 Lambda function cho các thao tác CRUD
- `local-run/`: bộ chạy local tối thiểu để mở frontend ở máy local và gọi API AWS đã deploy mà không sửa file gốc

## Thư mục frontend

### `frontend/index.html`

Đây là toàn bộ giao diện frontend ở dạng **single-file app**, bao gồm:

- HTML giao diện đăng nhập, đăng ký, xác nhận tài khoản và quản lý task
- CSS nhúng trực tiếp trong file
- JavaScript nhúng trực tiếp trong file
- Cấu hình AWS frontend:
  - `region`
  - `userPoolId`
  - `clientId`
  - `apiUrl`

Frontend thực hiện các chức năng chính:

- Đăng ký tài khoản qua Amazon Cognito
- Xác nhận tài khoản bằng mã xác thực
- Đăng nhập để lấy JWT token
- Gọi API `/tasks` với header `Authorization`
- Hiển thị danh sách công việc
- Tạo, cập nhật trạng thái và xóa công việc

## Thư mục backend

Thư mục `backend/` được tách thành 4 Lambda function độc lập đúng theo yêu cầu đồ án.

### `backend/get-tasks/index.mjs`

Lambda xử lý `GET /tasks`.

Chức năng:

- Lấy `userId` từ Cognito authorizer
- Query DynamoDB qua GSI `userId-index`
- Trả về danh sách task thuộc người dùng hiện tại

### `backend/create-task/index.mjs`

Lambda xử lý `POST /tasks`.

Chức năng:

- Kiểm tra người dùng đã xác thực
- Parse JSON body từ frontend
- Validate dữ liệu đầu vào
- Tạo `taskId` mới
- Ghi item mới vào DynamoDB

### `backend/update-task/index.mjs`

Lambda xử lý `PUT /tasks/{id}`.

Chức năng:

- Kiểm tra người dùng đã xác thực
- Lấy `taskId` từ `pathParameters`
- Cập nhật các trường được gửi lên
- Dùng `ConditionExpression` để chỉ cho phép sửa task của đúng chủ sở hữu

### `backend/delete-task/index.mjs`

Lambda xử lý `DELETE /tasks/{id}`.

Chức năng:

- Kiểm tra người dùng đã xác thực
- Lấy `taskId` từ `pathParameters`
- Xóa task trong DynamoDB
- Dùng `ConditionExpression` để chỉ cho phép xóa task của đúng chủ sở hữu

## Thư mục local-run

Thư mục này phục vụ nhu cầu test local mà vẫn dùng hạ tầng AWS đã deploy.

### `local-run/server.mjs`

Server Node.js tối thiểu:

- Serve frontend tại `http://localhost:3000`
- Rewrite `apiUrl` thành `/api` trong bộ nhớ
- Proxy request `/api/*` sang API Gateway AWS
- Xử lý CORS ở local để trình duyệt không bị chặn

### `local-run/package.json`

Khai báo script:

- `npm start`: chạy local server

### `local-run/README.md`

Hướng dẫn chạy local bằng tiếng Việt.

## Cách dùng source

### Chạy local frontend để gọi API AWS đã deploy

Vào thư mục:

```bash
cd Report/source/local-run
```

Chạy:

```bash
npm start
```

Mở:

```text
http://localhost:3000
```

### Dùng frontend gốc để tham khảo mã nguồn

Có thể mở trực tiếp file:

```text
Report/source/frontend/index.html
```

Tuy nhiên để gọi API ổn định trong trình duyệt, nên dùng `local-run/` thay vì mở file trực tiếp bằng `file://`.

## Ghi chú

- Source hiện tại tập trung vào mã nguồn phục vụ đồ án và minh họa triển khai thực tế
- Thư mục `backend/` hiện chưa kèm `package.json` hay framework deploy local như `SAM`, `Serverless Framework`, `CDK` hoặc `Terraform`
- Nếu muốn chạy giả lập backend local hoàn chỉnh, cần bổ sung thêm manifest dependency và công cụ mô phỏng API Gateway/Lambda
