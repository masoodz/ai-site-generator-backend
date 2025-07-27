import { APIGatewayProxyHandler } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({ region: "us-east-1" });
const QUEUE_URL = process.env.QUEUE_URL!;

export const handler: APIGatewayProxyHandler = async (event) => {
  const { prompt, sessionId } = JSON.parse(event.body || "{}");

  if (!prompt || !sessionId) {
    return { statusCode: 400, body: "Missing prompt or sessionId" };
  }

  await sqs.send(new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify({ prompt, sessionId }),
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Request accepted", sessionId }),
  };
};
