import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
    try {
        const userId = event.requestContext?.authorizer?.claims?.sub;
        if (!userId) return { statusCode: 401, body: "Unauthorized" };

        const taskId = event.pathParameters?.id;
        const body = JSON.parse(event.body || '{}');

        const updates = [];
        const exprAttrValues = { ":userId": userId };
        const exprAttrNames = {};

        ['title', 'description', 'priority', 'dueDate', 'status'].forEach(key => {
            if (body[key] !== undefined) {
                updates.push(`#${key} = :${key}`);
                exprAttrValues[`:${key}`] = body[key];
                exprAttrNames[`#${key}`] = key;
            }
        });

        if (updates.length === 0) return { statusCode: 400, body: JSON.stringify({ error: 'No updates' }) };

        const response = await docClient.send(new UpdateCommand({
            TableName: "TasksTable",
            Key: { taskId },
            UpdateExpression: "SET " + updates.join(", "),
            ExpressionAttributeNames: exprAttrNames,
            ExpressionAttributeValues: exprAttrValues,
            ConditionExpression: "userId = :userId",
            ReturnValues: "ALL_NEW"
        }));

        return {
            statusCode: 200,
            headers: { 
                'Access-Control-Allow-Origin': 'https://d1ikfum6io2m2d.cloudfront.net',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(response.Attributes)
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