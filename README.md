# AI Site Generator (Backend)

This project implements a fully serverless backend that generates HTML websites from user prompts using Amazon Bedrock and stores them in S3. It includes secure user authentication via Amazon Cognito and exposes endpoints for generation and status checking via API Gateway.

---

## 🏗️ Architecture Overview

- **Amazon API Gateway**: Public interface with Cognito Authorizer and CORS restricted to your frontend
- **AWS Lambda**:
  - `ApiHandler`: Receives user prompt and enqueues request
  - `SiteProcessor`: Consumes SQS messages, calls Bedrock, uploads HTML to S3
  - `StatusHandler`: Checks if generated site is ready in S3
- **Amazon Bedrock**: `us.deepseek.r1-v1:0` model for HTML generation
- **Amazon SQS**: Decouples request from processing
- **Amazon S3**: Stores generated HTML files
- **Amazon Cognito**: Authenticates users
- **Environment Variable**: `ALLOWED_ORIGIN` restricts requests to your deployed frontend domain

---

## 🚀 Deployment Instructions

### Prerequisites

- AWS CLI and credentials configured
- Node.js and AWS CDK installed
- Your frontend URL ready (e.g. from Amplify)

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env` file

Create a `.env` file in your project root with your frontend domain:

```env
ALLOWED_ORIGIN=https://main.d2ut7n3rxzs0az.amplifyapp.com
```

> This value is used to configure CORS for S3 and API Gateway.

### 3. Load `.env` in CDK

Ensure the following exists at the top of `bin/app.ts`:

```ts
import * as dotenv from "dotenv";
dotenv.config();
```

### 4. Bootstrap CDK (once per account/region)

```bash
cdk bootstrap
```

### 5. Deploy the stack

```bash
cdk deploy
```

### 6. Outputs

The stack outputs:

- `ApiUrl`: Base URL for the REST API
- `BucketName`: S3 bucket where HTML files are stored
- `IdentityPoolId`: Cognito Identity Pool ID
- `AllowedOrigin`: Origin allowed by CORS (from `.env`)

---

## 🔐 Authentication

All endpoints are protected using IAM-based auth tied to Cognito Identity Pool (unauthenticated users).

The frontend uses the AWS SDK to assume the unauth role and sign requests.

---

## 🧪 Endpoints

### POST /generate

Submits a site generation request.

**Body:**

```json
{
  "prompt": "Create a modern landing page",
  "sessionId": "your-session-id"
}
```

### GET /status?sessionId=your-session-id

Checks if the site is ready. If ready, returns:

```json
{
  "status": "ready",
  "url": "https://<bucket-name>.s3.amazonaws.com/your-session-id.html"
}
```

---

## 🧠 Model Used

- **Model ID**: `us.deepseek.r1-v1:0`
- **Max Tokens**: 20,000
- **Temperature**: 0.7
- **Image Sources**: Uses Pexels image links

---

## 🧼 Cleanup

To remove all resources:

```bash
cdk destroy
```

---

## 📂 Project Structure

```
lambda/
  handlers/
    enqueueRequest.ts
    processMessage.ts
    getStatus.ts
lib/
  ai-site-generator-stack.ts
bin/
  app.ts
.env
```

---

## 📜 License

MIT
