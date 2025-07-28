import { APIGatewayProxyHandler } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const client = new SQSClient({});

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
      },
      body: '',
    };
  }

  try {
    const body = JSON.parse(event.body!);
    const sessionId = body.sessionId ?? 'web-guest';

    await client.send(
      new SendMessageCommand({
        QueueUrl: process.env.QUEUE_URL!,
        MessageBody: JSON.stringify({ prompt: body.prompt, sessionId }),
      })
    );

    const response = {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
      },
      body: JSON.stringify({ message: 'Request enqueued' }),
    };

    console.log(response);

    return response;
  } catch (err: any) {
    console.error('Failed:', err);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
      },
      body: JSON.stringify({ error: 'Failed to enqueue' }),
    };
  }
};
