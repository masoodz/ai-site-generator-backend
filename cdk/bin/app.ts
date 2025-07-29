import * as cdk from 'aws-cdk-lib';
import { AiSiteGeneratorStack } from '../lib/stack';
import * as dotenv from "dotenv";
dotenv.config();

const app = new cdk.App();

new AiSiteGeneratorStack(app, 'AiSiteGeneratorStack');
