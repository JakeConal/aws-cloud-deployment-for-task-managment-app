# PROJECT2 Strict AWS Setup Manual (Console-Only, Node.js 20.x)

This manual is written to strictly follow `PROJECT2_VI.pdf` requirements.

Scope:
- Console-only setup (no AWS CLI flow).
- Node.js 20.x backend.
- 4 separate Lambda functions.
- 4 separate IAM roles (strict interpretation).
- Private S3 + CloudFront OAC only.
- Lambda in private subnets, DynamoDB via VPC Gateway Endpoint, no NAT Gateway.
- Monitoring, alarms, throttling, reserved concurrency, budget controls.
- Full evidence checklist mapped to `SE/NE/IM/CO`.

## 0) Hard Rules (Read First)

Objective: Lock the implementation to non-negotiable rubric constraints before creating resources.
Desired outcome: Team avoids disqualifying mistakes (NAT, public S3, wildcard CORS, non-VPC Lambda, weak IAM scope).

1. Never create a NAT Gateway.
2. Do not enable S3 static website hosting.
3. Keep S3 Block Public Access: all 4 options ON.
4. CloudFront must be the only frontend entry point.
5. Set CORS `Access-Control-Allow-Origin` to your CloudFront domain only. Never use `*`.
6. Every Lambda must run inside your custom VPC private subnets.
7. DynamoDB access must go through VPC Gateway Endpoint and route table entry `pl-xxx -> vpce-xxx`.
8. Use IAM least privilege with table-specific ARNs (no wildcard `*` for DynamoDB resources).

## 1) Required Project Values (Fill Before Setup)

Objective: Define and track all IDs/names needed across services to prevent configuration drift.
Desired outcome: Every later step can be completed without missing references or region mismatches.

Use one region for all members: `ap-southeast-1`.

Record these values as you create resources:
- `REGION`: `ap-southeast-1`
- `ACCOUNT_ID`: your AWS account ID
- `TABLE_NAME`: `TasksTable`
- `GSI_NAME`: `userId-index`
- `VPC_NAME`: `TaskManagerVPC`
- `SUBNET_A`: `PrivateSubnet-AZ1` (`10.0.1.0/24`, `ap-southeast-1a`)
- `SUBNET_B`: `PrivateSubnet-AZ2` (`10.0.2.0/24`, `ap-southeast-1b`)
- `LAMBDA_SG`: `LambdaSecurityGroup`
- `USER_POOL_NAME`: `TaskManagerUserPool`
- `APP_CLIENT_NAME`: `WebAppClient`
- `API_NAME`: `TaskManagerAPI`
- `CF_DOMAIN`: CloudFront domain, example `dxxxx.cloudfront.net`
- `BUDGET_NAME`: `TaskManager-Budget-0.01`
- `DASHBOARD_NAME`: `TaskManager-Dashboard`

## 2) Networking (Must Be Done Before Lambda VPC Attachment)

### 2.1 Create Custom VPC and Private Subnets

Objective: Build isolated network boundaries for Lambda compute.
Desired outcome: One custom VPC with two private subnets across two AZs is ready for Lambda placement.

1. Open `VPC` -> `Your VPCs` -> `Create VPC`.
2. Name: `TaskManagerVPC`, IPv4 CIDR: `10.0.0.0/16`.
3. Create subnet `PrivateSubnet-AZ1`: `10.0.1.0/24` in `ap-southeast-1a`.
4. Create subnet `PrivateSubnet-AZ2`: `10.0.2.0/24` in `ap-southeast-1b`.

### 2.2 Create Route Tables for Private Subnets

Objective: Ensure private subnets use controlled routing.
Desired outcome: Private subnet associations are explicit and ready for DynamoDB endpoint routing.

1. Create one private route table and associate both private subnets, or create two private route tables (one per subnet).
2. Confirm subnet associations are correct.

### 2.3 Create DynamoDB VPC Gateway Endpoint

Objective: Force DynamoDB traffic onto AWS private backbone instead of public internet paths.
Desired outcome: A DynamoDB Gateway Endpoint is created and linked to private route tables.

1. Open `VPC` -> `Endpoints` -> `Create endpoint`.
2. Service category: AWS services.
3. Service name: `com.amazonaws.ap-southeast-1.dynamodb`.
4. Endpoint type: `Gateway`.
5. Select VPC: `TaskManagerVPC`.
6. Select the private route table(s) associated with `PrivateSubnet-AZ1` and `PrivateSubnet-AZ2`.
7. Policy: Full access is acceptable for endpoint policy.
8. Create endpoint.

### 2.4 Restrict Lambda Security Group Egress

Objective: Enforce least-privilege network egress from Lambda.
Desired outcome: Lambda outbound traffic is restricted to HTTPS 443 toward DynamoDB Prefix List only.

1. Create security group `LambdaSecurityGroup` in `TaskManagerVPC`.
2. Remove default outbound allow-all rule.
3. Add outbound rule:
- Type: HTTPS
- Port: 443
- Destination: DynamoDB managed Prefix List for region `ap-southeast-1` (the `pl-xxxxxx` entry)

### 2.5 Confirm No NAT Gateway

Objective: Prevent mandatory cost/security violations.
Desired outcome: NAT Gateway list is empty or all entries are deleted.

1. Open `VPC` -> `NAT Gateways`.
2. Ensure list is empty, or all entries are `Deleted`.

## 3) DynamoDB

### 3.1 Create Table and GSI

Objective: Create data model required for efficient per-user task queries.
Desired outcome: `TasksTable` exists with `taskId` partition key and `userId-index` GSI projection `ALL`.

1. Open `DynamoDB` -> `Tables` -> `Create table`.
2. Table name: `TasksTable`.
3. Partition key: `taskId` (String).
4. Create table.
5. In table `Indexes`, create GSI:
- Index name: `userId-index`
- Partition key: `userId` (String)
- Projection: `All`

### 3.2 Seed Data With At Least 2 Different Users

Objective: Satisfy demo/test requirement for multiple user owners in database.
Desired outcome: Table includes seed records from at least two distinct `userId` values.

Add at least 2 items with different `userId` values:

```json
{
  "taskId": "task-001",
  "userId": "test-user-1",
  "title": "Learn Serverless",
  "description": "Study AWS Lambda and DynamoDB",
  "priority": "high",
  "dueDate": "2025-12-31",
  "status": "pending",
  "createdAt": "2025-05-22T10:00:00Z"
}
```

```json
{
  "taskId": "task-002",
  "userId": "test-user-2",
  "title": "Deploy to AWS",
  "description": "Deploy Task Manager application",
  "priority": "medium",
  "dueDate": "2025-06-15",
  "status": "done",
  "createdAt": "2025-05-20T08:00:00Z"
}
```

## 4) IAM Least Privilege (4 Separate Lambda Roles)

Objective: Isolate permissions per function and align with strict least-privilege grading criteria.
Desired outcome: Four distinct Lambda roles exist with VPC/log permissions plus table-scoped DynamoDB permissions.

Create 4 roles:
- `GetTasksLambdaRole`
- `CreateTaskLambdaRole`
- `UpdateTaskLambdaRole`
- `DeleteTaskLambdaRole`

For each role:
1. Trusted entity: Lambda.
2. Attach `AWSLambdaVPCAccessExecutionRole` managed policy.
3. Add inline policy with DynamoDB actions:
- `dynamodb:GetItem`
- `dynamodb:PutItem`
- `dynamodb:UpdateItem`
- `dynamodb:DeleteItem`
- `dynamodb:Query`
- `dynamodb:Scan`
4. Resource must be specific ARNs only:
- `arn:aws:dynamodb:ap-southeast-1:<ACCOUNT_ID>:table/TasksTable`
- `arn:aws:dynamodb:ap-southeast-1:<ACCOUNT_ID>:table/TasksTable/index/userId-index`

Important:
- Do not use resource `*` for DynamoDB.
- Do not share one role across all Lambdas in this strict guide.

## 5) Lambda Functions (Node.js 20.x, 4 Functions)

Objective: Deploy CRUD backend as four independent serverless units with controlled scaling.
Desired outcome: Four Lambda functions run in private subnets, each mapped to the correct role and endpoint behavior.

Create these functions with runtime `Node.js 20.x`:
- `GetTasksFunction`
- `CreateTaskFunction`
- `UpdateTaskFunction`
- `DeleteTaskFunction`

Assign roles:
- `GetTasksFunction` -> `GetTasksLambdaRole`
- `CreateTaskFunction` -> `CreateTaskLambdaRole`
- `UpdateTaskFunction` -> `UpdateTaskLambdaRole`
- `DeleteTaskFunction` -> `DeleteTaskLambdaRole`

Attach VPC config for each Lambda:
- VPC: `TaskManagerVPC`
- Subnets: `PrivateSubnet-AZ1`, `PrivateSubnet-AZ2`
- Security Group: `LambdaSecurityGroup`

Set reserved concurrency (recommended for Free Tier):
- `GetTasksFunction`: 5
- `CreateTaskFunction`: 2
- `UpdateTaskFunction`: 2
- `DeleteTaskFunction`: 1

Reason:
- Limits runaway cost and protects account concurrency.
- Still allows basic parallelism for demo traffic.

Code requirements:
- `/tasks` GET, POST and `/tasks/{id}` PUT, DELETE handlers.
- Query by `userId-index` for list.
- Return JSON responses.
- Use CORS header:
`'Access-Control-Allow-Origin': 'https://<your-cloudfront-domain>'`
- Never use wildcard origin `*`.

## 6) Cognito

### 6.1 User Pool and App Client

Objective: Enable managed user authentication for frontend and API protection.
Desired outcome: Cognito User Pool and App Client are created and ready for JWT-based access control.

1. Create user pool `TaskManagerUserPool`.
2. Create app client `WebAppClient`.
3. Keep auth flows needed by your frontend login flow.

### 6.2 Test Users

Objective: Prepare authentication identities for functional/security testing.
Desired outcome: At least two Cognito users exist for login, token, and access checks.

Create at least 2 users:
- `testuser1`
- `testuser2`

## 7) API Gateway (REST API, Stage `prod`)

### 7.1 Create API and Authorizer

Objective: Build protected REST entry point for Lambda CRUD operations.
Desired outcome: REST API exists with Cognito authorizer and `Authorization` token source.

1. Create `REST API` named `TaskManagerAPI`.
2. Create Cognito authorizer linked to `TaskManagerUserPool`.
3. Token source: `Authorization`.

### 7.2 Create Endpoints

Objective: Map each CRUD route to the correct Lambda function with auth enforcement.
Desired outcome: All 4 methods are integrated, authorized, and deployed to stage `prod`.

Create methods and integrations:
- `GET /tasks` -> `GetTasksFunction`
- `POST /tasks` -> `CreateTaskFunction`
- `PUT /tasks/{id}` -> `UpdateTaskFunction`
- `DELETE /tasks/{id}` -> `DeleteTaskFunction`

For all methods:
- Set method authorization to Cognito authorizer.

Deploy to stage:
- Stage name: `prod`.

### 7.3 API Throttling (Required)

Objective: Limit request burst/rate to reduce abuse and cost risk.
Desired outcome: Stage method settings enforce `Rate=100` and `Burst=50`.

On stage `prod` method settings:
- Rate limit: `100` requests/second
- Burst limit: `50`

### 7.4 CORS

Objective: Allow browser calls only from your CloudFront frontend origin.
Desired outcome: CORS origin is exact CloudFront domain and never wildcard `*`.

For API responses and Lambda responses:
- `Access-Control-Allow-Origin` must be exactly `https://<your-cloudfront-domain>`
- Allow headers including `Content-Type,Authorization`

## 8) S3 + CloudFront (Private S3, OAC Required)

### 8.1 S3 Bucket

Objective: Store frontend assets in private object storage.
Desired outcome: Bucket exists with all public access blocked and no static website hosting.

1. Create bucket `taskmanager-ui-<unique-id>`.
2. Keep `Block Public Access`: all four enabled.
3. Do not enable static website hosting.

### 8.2 CloudFront Distribution

Objective: Make CloudFront the only public delivery layer for frontend content.
Desired outcome: Distribution is active with OAC and known public domain name.

1. Create distribution with S3 bucket as origin.
2. Configure Origin Access Control (OAC).
3. Set default root object: `index.html`.
4. Copy CloudFront domain `dxxxx.cloudfront.net`.

### 8.3 S3 Bucket Policy

Objective: Grant object read permission only through CloudFront OAC path.
Desired outcome: S3 policy allows CloudFront service principal and denies direct public object access.

Allow read only from CloudFront service principal for this distribution (OAC-based policy).

### 8.4 Upload Frontend

Objective: Publish frontend assets to private S3 while serving through CDN.
Desired outcome: Web app is reachable via CloudFront URL and not via direct S3 URL.

Upload `frontend/` files to S3 bucket.
Frontend must be accessed only via `https://<cloudfront-domain>`.

## 9) Frontend Configuration

Objective: Connect browser app to Cognito and API Gateway correctly.
Desired outcome: Frontend can sign up/login, store JWT, and call `/tasks` with `Authorization` header.

Update frontend config values:
- Cognito User Pool ID
- Cognito App Client ID
- Region: `ap-southeast-1`
- API invoke URL: `https://<api-id>.execute-api.ap-southeast-1.amazonaws.com/prod`

After login/signup:
- Frontend must store JWT token.
- Frontend must send JWT in `Authorization` header for all `/tasks` API calls.

## 10) Monitoring and Cost Controls (Mandatory)

### 10.1 CloudWatch Dashboard

Objective: Provide visibility for reliability, latency, and throttling behavior.
Desired outcome: Dashboard `TaskManager-Dashboard` shows all required Lambda/API metrics.

Create dashboard `TaskManager-Dashboard` with at least these widgets:
- Lambda `Invocations`
- Lambda `Duration` (P50 and P99)
- Lambda `Errors`
- Lambda `Throttles`
- API Gateway `Latency`
- API Gateway `4XXError` and `5XXError`

### 10.2 CloudWatch Alarms + SNS

Objective: Trigger actionable notifications when backend/API error thresholds are exceeded.
Desired outcome: SNS email subscription receives alerts from both required alarms.

Create SNS topic and email subscription.

Create alarms:
- `Lambda-Error-Alarm`: Lambda `Errors > 10` in 5 minutes -> SNS
- `API-5xx-Alarm`: API Gateway `5XXError > 5` in 5 minutes -> SNS

### 10.3 AWS Budget

Objective: Enforce strict monthly spend cap for rubric compliance.
Desired outcome: Monthly budget `0.01` USD with 80% and 100% email alerts is active.

Create budget:
- Name: `TaskManager-Budget-0.01`
- Monthly budget amount: `0.01` USD
- Alert 1: 80% threshold (`0.008`) -> email
- Alert 2: 100% threshold (`0.01`) -> email

## 11) Required Verification Tests

Objective: Validate mandatory security and connectivity behavior before evidence capture.
Desired outcome: All required pass conditions are reproducible and screenshot-ready.

### 11.1 Frontend Security

Objective: Prove private S3 and CloudFront-only delivery.
Desired outcome: Direct S3 access fails with `403`, CloudFront access succeeds with `200`.

- Open direct S3 object URL `https://<bucket>.s3.amazonaws.com/index.html` -> must be `403`.
- Open CloudFront URL `https://<id>.cloudfront.net` -> should load app (`200`).

### 11.2 Cognito/API Security

Objective: Verify API authorization behavior with and without JWT.
Desired outcome: Unauthorized requests return `401`; valid-token requests return `200`.

Without token (must return 401):

```bash
curl -i https://<api-id>.execute-api.ap-southeast-1.amazonaws.com/prod/tasks
```

With valid token (must return 200):

```bash
curl -i -H "Authorization: <JWT_TOKEN>" https://<api-id>.execute-api.ap-southeast-1.amazonaws.com/prod/tasks
```

### 11.3 Networking

Objective: Confirm private-path DynamoDB connectivity and NAT-free networking.
Desired outcome: Endpoint, VPC config, route table, and logs all prove compliant private traffic flow.

- Endpoint status is `Available`.
- Lambda VPC config shows private subnets + security group.
- Route table contains `Destination = pl-xxxxxx`, `Target = vpce-xxxxxxxx`.
- NAT Gateways page shows none active.
- CloudWatch logs show successful DynamoDB calls (no network unauthorized errors).

## 12) Evidence Checklist (Submission-Ready)

Objective: Guarantee all rubric evidence artifacts are complete before submission.
Desired outcome: Full `SE/CO/NE/IM` evidence package plus monitoring/cost screenshots is ready.

Collect screenshots/output for all IDs:

### Frontend Security
- `SE-1`: S3 Block Public Access all ON.
- `SE-2`: Direct S3 URL denied with `403`.
- `SE-3`: CloudFront URL returns working site (`200`).
- `SE-4`: CloudFront distribution uses OAC.

### Cognito
- `CO-1`: Cognito User Pool exists (name + pool ID visible).
- `CO-2`: API Gateway Cognito authorizer configured.
- `CO-3`: API call without token returns `401`.
- `CO-4`: API call with valid token returns `200`.

### Networking
- `NE-1`: DynamoDB VPC endpoint exists, status `Available`.
- `NE-2`: Lambda VPC config attached (subnets + SG).
- `NE-3`: Route table has `pl-xxx -> vpce-xxx`.
- `NE-4`: No NAT Gateway (or all deleted).
- `NE-5`: CloudWatch logs prove Lambda can access DynamoDB successfully.

### IAM
- `IM-1`: Separate IAM roles visible.
- `IM-2`: Policy resources are specific DynamoDB ARNs, not `*`.
- `IM-3`: Each Lambda attached to the correct role.

### Monitoring and Cost
- CloudWatch dashboard screenshot with at least 5 widgets showing real data.
- 2 alarm screenshots.
- AWS budget configuration screenshot (`0.01`, 80%, 100%).
- Cost Explorer/Billing screenshot showing project cost near zero.

## 13) Final Pre-Submission Checklist

Objective: Run one final compliance gate to avoid avoidable point deductions.
Desired outcome: System, security, networking, monitoring, and documentation are all submission-complete.

1. CRUD works end-to-end via CloudFront frontend.
2. All 4 Lambda functions are separate and in VPC private subnets.
3. IAM roles are separate and least-privilege.
4. CORS origin is CloudFront domain only.
5. No NAT Gateway exists.
6. Throttling and reserved concurrency are configured.
7. Dashboard, alarms, budget are configured.
8. All `SE/CO/NE/IM` evidence is captured.
9. If GenAI was used, include prompt history evidence in submission package.
