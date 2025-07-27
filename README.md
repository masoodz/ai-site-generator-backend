
# AI Site Generator (Backend)

This project implements a fully serverless backend that generates HTML websites from user prompts using Amazon Bedrock and stores them in S3. It includes secure user authentication via Amazon Cognito and exposes endpoints for generation and status checking via API Gateway.

---

## 🏗️ Architecture Overview

- **Amazon API Gateway**: Public interface with Cognito Authorizer
- **AWS Lambda**:
  - `ApiHandler`: Receives user prompt and enqueues request
  - `SiteProcessor`: Consumes SQS messages, calls Bedrock, uploads HTML to S3
  - `StatusHandler`: Checks if generated site is ready in S3
- **Amazon Bedrock**: Claude 3.5 Sonnet model for HTML generation
- **Amazon SQS**: Decouples request from processing
- **Amazon S3**: Stores generated HTML files
- **Amazon Cognito**: Authenticates users

---

## 🚀 Deployment Instructions

### Prerequisites
- AWS CLI and credentials configured
- Node.js and AWS CDK installed

### 1. Install dependencies

```bash
npm install
```

### 2. Bootstrap CDK (only once per account/region)

```bash
cdk bootstrap
```

### 3. Deploy the stack

```bash
cdk deploy
```

### 4. Outputs

The stack outputs:
- `ApiUrl`: Base URL for the REST API
- `BucketName`: S3 bucket where HTML files are stored
- `UserPoolId`: Cognito User Pool ID
- `UserPoolClientId`: Cognito App Client ID

---

## 🔐 Authentication

All endpoints are protected with Cognito authentication.

### Signing up users

Users can sign up and log in using email and password. You can use AWS Amplify or Cognito-hosted UI for this.

### Making authenticated API requests

Once authenticated, send requests like:

```bash
curl -X POST https://<api-url>/generate \
  -H "Authorization: <Cognito JWT token>" \
  -H "Content-Type: application/json" \
  -d '{ "prompt": "Build a portfolio site", "sessionId": "session-123" }'
```

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

- **Model ID**: `anthropic.claude-3-5-sonnet-20240620-v1:0`
- **Max Tokens**: 20000
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
```

---

## 📜 License

MIT
