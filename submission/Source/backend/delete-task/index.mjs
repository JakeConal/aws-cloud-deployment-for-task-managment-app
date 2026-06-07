import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
    try {
        const userId = event.requestContext?.authorizer?.claims?.sub;
        if (!userId) return { statusCode: 401, body: "Unauthorized" };

        const taskId = event.pathParameters?.id;

        await docClient.send(new DeleteCommand({
            TableName: "TasksTable",
            Key: { taskId },
            ConditionExpression: "userId = :userId",
            ExpressionAttributeValues: { ":userId": userId }
        }));

        return {
            statusCode: 200,
            headers: { 
                'Access-Control-Allow-Origin': 'https://d1ikfum6io2m2d.cloudfront.net',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ message: 'Task deleted' })
        };
    } catch (err) {
        console.error(err);
        return { 
            statusCode: 500, 
            headers: { 'Access-Control-Allow-Origin': 'https://d1ikfum6io2m2d.cloudfront.net' },
            body: JSON.stringify({ error: err.message }) 
        };
    }
};