import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Định nghĩa một tập header CORS chuẩn dùng chung để không bị sót ở các lệnh return lỗi
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': 'https://d1ikfum6io2m2d.cloudfront.net',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Content-Type': 'application/json'
};

export const handler = async (event) => {
    // Log toàn bộ event nhận được để debug trên CloudWatch Logs khi cần thiết
    console.log("Received event:", JSON.stringify(event));

    try {
        // 1. Kiểm tra quyền Authorizer từ Cognito
        const userId = event.requestContext?.authorizer?.claims?.sub || event.requestContext?.authorizer?.claims?.username;
        if (!userId) {
            console.error("Authentication Error: userId missing from Authorizer claims.");
            return { 
                statusCode: 401, 
                headers: CORS_HEADERS, 
                body: JSON.stringify({ error: "Unauthorized: Missing identity profile tokens." }) 
            };
        }

        // 2. Phân tách và kiểm tra dữ liệu Body gửi từ Frontend
        let body;
        try {
            body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
        } catch (parseErr) {
            console.error("JSON Parsing Error:", parseErr);
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: "Invalid JSON format in request body." })
            };
        }

        if (!body.title) {
            console.warn("Validation Warning: Title field is required.");
            return { 
                statusCode: 400, 
                headers: CORS_HEADERS, 
                body: JSON.stringify({ error: 'Title required' }) 
            };
        }

        // 3. Tạo cấu trúc Item chuẩn hóa lưu vào DynamoDB
        const item = {
            taskId: randomUUID(),
            userId: userId, // Đảm bảo ánh xạ chuẩn theo Sub UUID bảo mật của Cognito
            title: body.title,
            description: body.description || '',
            priority: body.priority || 'medium',
            dueDate: body.dueDate || '',
            status: body.status || 'pending',
            createdAt: new Date().toISOString()
        };

        console.log("Writing item to DynamoDB:", JSON.stringify(item));
        await docClient.send(new PutCommand({ TableName: "TasksTable", Item: item }));

        // 4. Trả về kết quả thành công kèm CORS đầy đủ
        return {
            statusCode: 201,
            headers: CORS_HEADERS,
            body: JSON.stringify(item)
        };

    } catch (err) {
        console.error("Fatal Handler Exception:", err);
        return { 
            statusCode: 500, 
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: err.message }) 
        };
    }
};