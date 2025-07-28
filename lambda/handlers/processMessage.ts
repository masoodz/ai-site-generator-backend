import { SQSEvent } from "aws-lambda";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const bedrock = new BedrockRuntimeClient({ region: "us-east-1" });
const s3 = new S3Client({ region: "us-east-1" });

const MODEL_ID = "us.deepseek.r1-v1:0";
const BUCKET_NAME = process.env.BUCKET_NAME;

if (!BUCKET_NAME) {
  console.error("BUCKET_NAME environment variable is not set.");
  throw new Error("Missing required environment variable BUCKET_NAME.");
}

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log(`Received ${event.Records.length} record(s) from SQS.`);

  for (const record of event.Records) {
    try {
      console.log("Processing record:", record.messageId);
      const { prompt, sessionId } = JSON.parse(record.body);

      console.log(`Prompt: ${prompt}`);
      console.log(`Session ID: ${sessionId}`);

      const systemPrompt = `
You are a professional web designer and helpful assistant.

Your task is to generate a complete, visually appealing, and responsive one-page website using only valid HTML and CSS.

Strict requirements:
- The design must be clean, modern, and user-friendly
- Use responsive layout techniques (e.g., flexbox, grid, and media queries)
- Ensure good spacing, color contrast, and mobile optimization
- Include a <meta name="viewport" content="width=device-width, initial-scale=1.0"> in the <head>
- Use embedded <style> tags in the <head> for all CSS
- Use a Google Font (e.g., Inter, Roboto, or Poppins) loaded via <link> from fonts.googleapis.com
- Use <img> tags with **real, descriptive image URLs** (e.g., from https://images.pexels.com or https://picsum.photos)
- Do not use placeholder images (e.g., no "placehold.co", "loremflickr", or "dummyimage.com")
- Use semantic HTML5 elements where appropriate (e.g., <header>, <main>, <section>, <footer>)
- Begin your response with <!-- START HTML --> and end with <!-- END HTML -->
- Output only a complete HTML document – do not include explanations, markdown, or extra text

Current request: "${prompt}"
Respond only with valid HTML. Do not include explanations or comments outside the HTML.
`.trim();

      const command = new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          prompt: systemPrompt,
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 8192,
        }),
      });

      console.log("Sending prompt to Bedrock (DeepSeek)...");
      const response = await bedrock.send(command);
      const rawBody = await response.body.transformToString();
      console.log("Raw response from DeepSeek:", rawBody);

      const parsed = JSON.parse(rawBody);
      console.log("Raw response from DeepSeek:", JSON.stringify(parsed, null, 2));

      const fullText = parsed.choices?.[0]?.text ?? "";
      const htmlStartIndex = fullText.indexOf("<!-- START HTML -->");
      const htmlEndIndex = fullText.indexOf("<!-- END HTML -->") + "<!-- END HTML -->".length;

      const html =
        htmlStartIndex >= 0 && htmlEndIndex > htmlStartIndex
          ? fullText.slice(htmlStartIndex, htmlEndIndex)
          : fullText;

      if (html.length < 100) {
        console.warn("⚠️ HTML seems too short. Verify model output.");
      }

      const s3Key = `${sessionId}.html`;
      console.log(`Uploading to s3://${BUCKET_NAME}/${s3Key}`);

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: html,
          ContentType: "text/html",
        })
      );

      console.log(`Upload complete for session: ${sessionId}`);
    } catch (err) {
      console.error("Error processing message:", JSON.stringify(err, null, 2));
    }
  }
};
