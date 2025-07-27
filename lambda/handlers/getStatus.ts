import { APIGatewayProxyHandler } from "aws-lambda";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: "us-east-1" });
const BUCKET_NAME = process.env.BUCKET_NAME!;

export const handler: APIGatewayProxyHandler = async (event) => {
  const sessionId = event.queryStringParameters?.sessionId;

  if (!sessionId) {
    return { statusCode: 400, body: "Missing sessionId" };
  }

  try {
    await s3.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${sessionId}.html`,
    }));
    return { statusCode: 200, body: JSON.stringify({ status: "ready" }) };
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return { statusCode: 200, body: JSON.stringify({ status: "pending" }) };
    }
    return { statusCode: 500, body: "Error checking status" };
  }
};
