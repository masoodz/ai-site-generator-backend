import * as cdk from 'aws-cdk-lib';
import { AiSiteGeneratorStack } from '../lib/stack';

const app = new cdk.App();

new AiSiteGeneratorStack(app, 'AiSiteGeneratorStack');
