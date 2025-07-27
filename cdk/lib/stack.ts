import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as eventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';

export class AiSiteGeneratorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'GeneratedSitesBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const siteRequestQueue = new sqs.Queue(this, 'SiteRequestQueue', {
      visibilityTimeout: cdk.Duration.seconds(300),
    });

    const processor = new NodejsFunction(this, 'SiteProcessor', {
      entry: path.join(__dirname, '../../lambda/handlers/processMessage.ts'),
      handler: 'handler',
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
        actions: ['bedrock:InvokeModel'],
        resources: ['*'], 
      })
    );

    const apiHandler = new NodejsFunction(this, 'ApiHandler', {
      entry: path.join(__dirname, '../../lambda/handlers/enqueueRequest.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        QUEUE_URL: siteRequestQueue.queueUrl,
      },
    });

    siteRequestQueue.grantSendMessages(apiHandler);

    const statusHandler = new NodejsFunction(this, 'StatusHandler', {
      entry: path.join(__dirname, '../../lambda/handlers/getStatus.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
    });

    bucket.grantRead(statusHandler);

    const userPool = new cognito.UserPool(this, 'SiteUserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoVerify: { email: true },
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'SiteUserPoolClient', {
      userPool,
      generateSecret: false,
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [userPool],
    });

    const api = new apigateway.RestApi(this, 'SiteRequestApi');

    api.root.addResource('generate').addMethod(
      'POST',
      new apigateway.LambdaIntegration(apiHandler),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    api.root.addResource('status').addMethod(
      'GET',
      new apigateway.LambdaIntegration(statusHandler),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
  }
}
