import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
    try {
        const userId = event.requestContext?.authorizer?.claims?.sub;
        if (!userId) {
            return { 
                statusCode: 401, 
                headers: { 'Access-Control-Allow-Origin': 'https://d1ikfum6io2m2d.cloudfront.net' },
                body: JSON.stringify({ error: "Unauthorized" }) 
            };
        }

        const command = new QueryCommand({
            TableName: "TasksTable",
            IndexName: 'userId-index',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: { ':userId': userId }
        });

        const response = await docClient.send(command);
        const rawItems = response.Items || [];

        const formattedTasks = rawItems.map(item => ({
            taskId: item.taskId || item.taskid || item.id,
            userId: item.userId,
            title: item.title || item.Title || "Untitled Task",
            description: item.description || "",
            priority: item.priority || "medium",
            status: item.status || "pending",
            dueDate: item.dueDate || item.duedate || ""
        }));

        return {
            statusCode: 200,
            headers: { 
                'Access-Control-Allow-Origin': 'https://d1ikfum6io2m2d.cloudfront.net',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(formattedTasks) // Gửi mảng dữ liệu đã chuẩn hóa sạch sẽ
        };
    } catch (err) {
        console.error(err);
        return { 
            statusCode: 500, 
            headers: { 
                'Access-Control-Allow-Origin': 'https://d1ikfum6io2m2d.cloudfront.net',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            body: JSON.stringify({ error: err.message }) 
        };
    }
};