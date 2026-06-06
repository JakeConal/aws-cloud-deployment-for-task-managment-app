# Project 2 Report Outline

## 1. Introduction

### 1.1 Project Context
- Introduce the course project: a serverless Task Management web application on AWS.
- State the main goals: serverless deployment, secure architecture, private AWS networking, monitoring, and cost control.

### 1.2 Application Scope
- Briefly describe the task management application.
- Mention supported user features:
  - Sign up and login through Amazon Cognito.
  - Create, view, update, and delete tasks.
  - Filter tasks by due date and priority.
  - Persist task data in DynamoDB.

### 1.3 Deployment Summary
- Provide the deployed frontend CloudFront URL.
- Provide the API Gateway base URL.
- State the AWS region used: `ap-southeast-1`.
- State that the deployment was completed manually through the AWS Console.
- State that the deployment does not use EC2, NAT Gateway, or IaC tools.

## 2. System Architecture

### 2.1 Architecture Diagram
- Insert the final architecture diagram.
- The diagram should show:
  - Browser users.
  - CloudFront distribution.
  - Private S3 bucket with Origin Access Control.
  - API Gateway REST API stage `prod`.
  - Cognito User Pool and API Gateway Cognito Authorizer.
  - Four separate Lambda functions inside private subnets.
  - Custom VPC with two private subnets across two Availability Zones.
  - DynamoDB Gateway VPC Endpoint.
  - DynamoDB table and `userId-index` GSI.
  - IAM roles.
  - CloudWatch dashboard, CloudWatch alarms, SNS email notification.
  - AWS Budget.

### 2.2 Main AWS Services
- Summarize the role of each service:
  - Amazon S3 for static frontend storage.
  - CloudFront for CDN delivery.
  - Origin Access Control for private S3 access.
  - Amazon Cognito for authentication.
  - API Gateway REST API for HTTPS API routing and throttling.
  - Lambda for serverless backend compute.
  - VPC, private subnets, security group, route table, and DynamoDB Gateway Endpoint for private networking.
  - DynamoDB for task persistence.
  - IAM for least-privilege access control.
  - CloudWatch, SNS, and AWS Budgets for observability and cost control.
- Use the deployed resource names where applicable:
  - VPC: `TaskManagerVPC`.
  - Private subnets: `PrivateSubnet-AZ1` and `PrivateSubnet-AZ2`.
  - Security group: `LambdaSecurityGroup`.
  - DynamoDB table: `TasksTable`.
  - DynamoDB GSI: `userId-index`.
  - Cognito User Pool: `TaskManagerUserPool`.
  - Cognito App Client: `WebAppClient`.
  - API Gateway REST API: `TaskManagerAPI`.
  - CloudWatch dashboard: `TaskManager-Dashboard`.
  - AWS Budget: `TaskManager-Budget-0.01`.

### 2.3 Request Flow
- Explain the frontend loading flow:
  - User opens the CloudFront domain.
  - CloudFront returns cached static assets if available.
  - On cache miss, CloudFront retrieves files from the private S3 bucket through OAC.
- Explain the authenticated task creation flow:
  - User logs in through Cognito and receives a JWT token.
  - User submits a new task from the frontend.
  - Browser sends an HTTPS request to API Gateway with the JWT token.
  - API Gateway validates the token through the Cognito Authorizer.
  - API Gateway invokes the correct Lambda function.
  - Lambda runs inside private subnets and calls DynamoDB through the VPC Gateway Endpoint.
  - DynamoDB stores the task and returns the result.
  - Lambda returns JSON to API Gateway, and API Gateway returns the response to the browser.

### 2.4 Serverless Auto Scaling
- Explain why the system is serverless.
- Explain how API Gateway handles incoming HTTPS requests without an Application Load Balancer.
- Explain how Lambda scales from zero to multiple concurrent executions.
- Explain the selected Lambda reserved concurrency value and why it is suitable for Free Tier usage.
- Discuss the risk of setting reserved concurrency too low or too high.
- State the configured reserved concurrency values:
  - `GetTasksFunction`: 5.
  - `CreateTaskFunction`: 2.
  - `UpdateTaskFunction`: 2.
  - `DeleteTaskFunction`: 1.

### 2.5 CDN and Origin Access Control
- Explain CloudFront cache hit and cache miss behavior.
- Explain why S3 Static Website Hosting is disabled.
- Explain why the S3 bucket is private.
- Explain how OAC allows only CloudFront to read S3 objects.

### 2.6 VPC Endpoint Design
- Explain why Lambda functions are attached to a Custom VPC.
- Explain why private subnets need a DynamoDB Gateway Endpoint.
- Describe the DynamoDB traffic path over the AWS private backbone.
- Compare this design with a NAT Gateway approach:
  - NAT Gateway would allow internet egress but creates monthly cost.
  - DynamoDB Gateway Endpoint is free and keeps traffic private.

## 3. Application Implementation

### 3.1 Frontend
- Describe the frontend technology stack: HTML, CSS, JavaScript, or framework if used.
- Describe the main pages/components:
  - Login.
  - Sign up.
  - Task list.
  - Task creation form.
  - Task update/delete actions.
  - Priority and due-date filters.
- Explain how the frontend stores and sends the Cognito JWT token.
- Explain that CORS only allows the CloudFront domain.

### 3.2 Backend API
- State that the backend uses Node.js 20.x, API Gateway REST API, and four separate Lambda functions.
- Include an endpoint table:
  - `GET /tasks` -> `GetTasksFunction`.
  - `POST /tasks` -> `CreateTaskFunction`.
  - `PUT /tasks/{id}` -> `UpdateTaskFunction`.
  - `DELETE /tasks/{id}` -> `DeleteTaskFunction`.
- For each Lambda function, summarize:
  - Input.
  - Main validation.
  - DynamoDB operation.
  - Success response.
  - Error response.

### 3.3 DynamoDB Design
- Describe the table schema:
  - `taskId` as the partition key.
  - `userId`.
  - `title`.
  - `description`.
  - `priority`.
  - `dueDate`.
  - `status`.
  - `createdAt`.
- Describe the `userId-index` GSI:
  - Partition key: `userId`.
  - Projection: `ALL`.
- Explain why querying by `userId` is better than scanning the whole table.
- Mention the two pre-created demo users or demo records required for testing.

## 4. Security Design and Evidence

### 4.1 Frontend Security
- Explain private S3 bucket configuration.
- Explain CloudFront-only access through OAC.
- Insert evidence:
  - SE-1: S3 Block Public Access enabled.
  - SE-2: Direct S3 URL returns 403 Forbidden or AccessDenied.
  - SE-3: CloudFront URL returns 200 OK.
  - SE-4: CloudFront distribution uses OAC.

### 4.2 Authentication and API Protection
- Explain Cognito User Pool and App Client.
- Explain API Gateway Cognito Authorizer.
- Explain JWT token validation for all `/tasks` endpoints.
- Insert evidence:
  - CO-1: Cognito User Pool.
  - CO-2: API Gateway Cognito Authorizer.
  - CO-3: API request without token returns 401 Unauthorized.
  - CO-4: API request with valid token returns 200 OK.

### 4.3 IAM Least Privilege
- Explain that Lambda functions use four separate IAM roles, one role per function.
- Explain why policies avoid wildcard resources.
- Explain DynamoDB access scope limited to the specific table ARN and index ARN where needed.
- List the role mapping:
  - `GetTasksFunction` -> `GetTasksLambdaRole`.
  - `CreateTaskFunction` -> `CreateTaskLambdaRole`.
  - `UpdateTaskFunction` -> `UpdateTaskLambdaRole`.
  - `DeleteTaskFunction` -> `DeleteTaskLambdaRole`.
- Insert evidence:
  - IM-1: Four separate IAM roles.
  - IM-2: Policy JSON with specific DynamoDB table resource ARN.
  - IM-3: Each Lambda attached to the correct role.

### 4.4 Network Security
- Explain Lambda VpcConfig in private subnets.
- Explain security group outbound restriction to HTTPS for DynamoDB access.
- Explain route table entry to the DynamoDB prefix list through the VPC endpoint.
- Insert evidence:
  - NE-1: DynamoDB Gateway Endpoint available.
  - NE-2: Lambda VpcConfig with subnets and security group.
  - NE-3: Route table contains `pl-xxxxxx -> vpce-xxxxxxxx`.
  - NE-4: No active NAT Gateway.
  - NE-5: CloudWatch log shows successful DynamoDB call.

## 5. API Gateway Configuration

### 5.1 REST API Setup
- State the API type: REST API.
- State the deployment stage: `prod`.
- State that HTTPS is provided by API Gateway.

### 5.2 CORS
- State the configured `Access-Control-Allow-Origin` value.
- Explain why `*` is not used.

### 5.3 Throttling and Concurrency
- State API Gateway throttling values:
  - Rate limit: 100 requests per second.
  - Burst limit: 50 requests.
- State Lambda reserved concurrency values:
  - `GetTasksFunction`: 5.
  - `CreateTaskFunction`: 2.
  - `UpdateTaskFunction`: 2.
  - `DeleteTaskFunction`: 1.
- Explain how throttling and reserved concurrency reduce cost risk and protect backend resources.

## 6. Monitoring and Logging

### 6.1 CloudWatch Dashboard
- Insert screenshot of `TaskManager-Dashboard`.
- Describe at least five widgets:
  - Lambda Invocations.
  - Lambda Duration P50/P99.
  - Lambda Errors.
  - Lambda Throttles.
  - API Gateway Latency.
  - API Gateway 4XX/5XX errors.

### 6.2 CloudWatch Alarms and SNS
- Insert screenshots of:
  - `Lambda-Error-Alarm`.
  - `API-5xx-Alarm`.
- Explain alarm thresholds.
- Explain SNS email notification setup and confirmed subscription.

### 6.3 Logs
- Insert successful request log evidence:
  - Status code 200.
  - Duration.
  - Billed Duration.
  - Memory Used.
- Insert failed request log evidence:
  - Validation error, stack trace, or controlled error message.

## 7. Cost Management

### 7.1 Free Tier Design Choices
- Explain why the architecture avoids EC2.
- Explain why the architecture avoids NAT Gateway.
- Explain why DynamoDB, Lambda, S3, CloudFront, and API Gateway usage are expected to stay near Free Tier limits for this project.

### 7.2 AWS Budget
- Insert screenshot of the AWS Budget.
- State the monthly budget limit: `$0.01`.
- State alert thresholds:
  - 80 percent: `$0.008`.
  - 100 percent: `$0.01`.

### 7.3 Actual Cost
- Insert Cost Explorer or Billing Dashboard screenshot.
- State total project cost.
- If cost is greater than `$0.01`, explain why and what action was taken.

## 8. Testing and Results

### 8.1 Functional Test Cases
- Include a test table with:
  - Test case.
  - Input.
  - Expected result.
  - Actual result.
  - Evidence screenshot or curl output.
- Cover:
  - Sign up.
  - Login.
  - Create task.
  - Get tasks.
  - Update task.
  - Delete task.
  - Filter by priority.
  - Filter by due date.
  - Unauthorized API call.
  - Authorized API call.

### 8.2 Demo Data
- Show DynamoDB records after CRUD operations.
- Show at least two users or user-owned datasets for demo/testing.

### 8.3 Deployment Validation
- Summarize that:
  - Frontend is reachable only through CloudFront.
  - API returns JSON correctly.
  - DynamoDB data persists between requests.
  - Cognito authentication works.
  - Monitoring and budget controls are configured.

## 9. Limitations and Future Improvements

### 9.1 Current Limitations
- Mention any honest limitations, such as simple frontend design, limited validation, no custom domain, or no CI/CD pipeline.

### 9.2 Future Improvements
- Possible improvements:
  - Add custom domain and ACM certificate.
  - Add CI/CD deployment pipeline.
  - Add richer task search.
  - Add stricter input validation.
  - Add automated integration tests.

## 10. Conclusion
- Summarize how the project satisfies:
  - Serverless architecture.
  - Secure frontend hosting.
  - Cognito-protected API.
  - Private Lambda-to-DynamoDB networking.
  - Least-privilege IAM.
  - Monitoring and alarms.
  - Cost control.

## Appendix A. Evidence Checklist

| ID | Evidence | Included |
| --- | --- | --- |
| SE-1 | S3 Block Public Access enabled | TODO |
| SE-2 | Direct S3 access returns 403 | TODO |
| SE-3 | CloudFront access returns 200 | TODO |
| SE-4 | OAC attached to CloudFront | TODO |
| CO-1 | Cognito User Pool created | TODO |
| CO-2 | API Gateway Cognito Authorizer configured | TODO |
| CO-3 | API without token returns 401 | TODO |
| CO-4 | API with token returns 200 | TODO |
| NE-1 | DynamoDB VPC Endpoint available | TODO |
| NE-2 | Lambda VpcConfig shown | TODO |
| NE-3 | Route table has endpoint route | TODO |
| NE-4 | No NAT Gateway | TODO |
| NE-5 | Lambda DynamoDB call succeeds in CloudWatch logs | TODO |
| IM-1 | Four separate IAM roles | TODO |
| IM-2 | Policies use specific DynamoDB ARN | TODO |
| IM-3 | Lambdas attached to correct roles | TODO |

## Appendix B. GenAI Prompt History
- Include exported chat history or screenshots if GenAI was used.

## Appendix C. Source Code and Deployment Notes
- Link or describe submitted source code.
- State that no IaC tool was used; deployment was completed manually through the AWS Console.
- Include README deployment summary.
