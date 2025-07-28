import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as eventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";

export class AiSiteGeneratorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "GeneratedSitesBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
    });

    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`${bucket.bucketArn}/*`],
        principals: [new iam.AnyPrincipal()],
        effect: iam.Effect.ALLOW,
      })
    );

    bucket.addCorsRule({
      allowedOrigins: ["*"],
      allowedMethods: [s3.HttpMethods.GET],
      allowedHeaders: ["*"],
    });

    const siteRequestQueue = new sqs.Queue(this, "SiteRequestQueue", {
      visibilityTimeout: cdk.Duration.seconds(300),
    });

    const processor = new NodejsFunction(this, "SiteProcessor", {
      entry: path.join(__dirname, "../../lambda/handlers/processMessage.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(90),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        QUEUE_URL: siteRequestQueue.queueUrl,
      },
    });
    bucket.grantPut(processor);
    siteRequestQueue.grantConsumeMessages(processor);
    processor.addEventSource(new eventSources.SqsEventSource(siteRequestQueue));
    processor.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
      })
    );

    const apiHandler = new NodejsFunction(this, "ApiHandler", {
      entry: path.join(__dirname, "../../lambda/handlers/enqueueRequest.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        QUEUE_URL: siteRequestQueue.queueUrl,
      },
    });
    siteRequestQueue.grantSendMessages(apiHandler);

    const statusHandler = new NodejsFunction(this, "StatusHandler", {
      entry: path.join(__dirname, "../../lambda/handlers/getStatus.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
    });
    bucket.grantRead(statusHandler);

    const api = new apigateway.RestApi(this, "SiteRequestApi", {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "Authorization",
          "X-Amz-Date",
          "X-Amz-Security-Token",
          "X-Amz-User-Agent",
          "X-Amz-Content-SHA256",
          "x-amz-content-sha256",
        ],
      },
    });

    api.root
      .addResource("generate")
      .addMethod("POST", new apigateway.LambdaIntegration(apiHandler), {
        authorizationType: apigateway.AuthorizationType.IAM,
      });

    api.root
      .addResource("status")
      .addMethod("GET", new apigateway.LambdaIntegration(statusHandler), {
        authorizationType: apigateway.AuthorizationType.IAM,
      });

    api.addGatewayResponse("Default4xxWithCORS", {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers": "'*'",
        "Access-Control-Allow-Methods": "'OPTIONS,POST,GET'",
      },
    });

    api.addGatewayResponse("Default5xxWithCORS", {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers": "'*'",
        "Access-Control-Allow-Methods": "'OPTIONS,POST,GET'",
      },
    });

    const unauthRole = new iam.Role(this, "UnauthenticatedRole", {
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: { "cognito-identity.amazonaws.com:aud": "IDENTITY_POOL_ID" },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "unauthenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonAPIGatewayInvokeFullAccess"),
      ],
    });

    const identityPool = new cdk.aws_cognito.CfnIdentityPool(this, "IdentityPool", {
      allowUnauthenticatedIdentities: true,
    });

    const identityPoolRoleAttachment = new cdk.aws_cognito.CfnIdentityPoolRoleAttachment(
      this,
      "IdentityPoolRoleAttachment",
      {
        identityPoolId: identityPool.ref,
        roles: {
          unauthenticated: unauthRole.roleArn,
        },
      }
    );

    unauthRole.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.FederatedPrincipal(
            "cognito-identity.amazonaws.com",
            {},
            "sts:AssumeRoleWithWebIdentity"
          ),
        ],
        actions: ["sts:AssumeRoleWithWebIdentity"],
        conditions: {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "unauthenticated",
          },
        },
      })
    );

    new cdk.CfnOutput(this, "ApiUrl", { value: api.url });
    new cdk.CfnOutput(this, "BucketName", { value: bucket.bucketName });
    new cdk.CfnOutput(this, "IdentityPoolId", { value: identityPool.ref });
  }
}
