/**
 * Will deploy into the current default CLI account.
 *
 * Deployment:
 * cdk deploy --all
 */

/* eslint-disable no-new */
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { FargateAppStack } from '../lib/application/application-stack';
import { AlbStack } from '../lib/application/load-balancer-stack';
import { ScheduleStack } from '../lib/application/schedule-stack';
import { dnsAttr, apps, vpcAttr } from '../config';

const app = new App();

// Use account details from default AWS CLI credentials:
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;
const env = { account, region };

// Create Application Load Balancer
const albStack = new AlbStack(app, 'FargateAlbStack', {
    description: 'Fargate ALB Demo Stack',
    env,
    dnsAttr,
    apps,
    vpcAttr,
});
const { vpc, subnets, targetGroups } = albStack;

// Create Scheduler Stack
const scheduleStack = new ScheduleStack(app, 'FargateScheduleStack', {
    description: 'Fargate Scheduler Demo Stack',
    env,
});
const { ecsScheduleFnc } = scheduleStack;

// Create Fargate Service and Task stack for each app
apps.forEach((appAttr) => {
    const { name } = appAttr;
    const group = targetGroups.find((item) => item.name === name);
    if (!group) { throw new Error('Target group detail not found'); }

    const { targetGroup, url } = group;
    new FargateAppStack(app, `${name}FargateAppStack`, {
        description: `Fargate Demo Stack - ${name}`,
        env,
        vpc,
        subnets,
        targetGroup,
        url,
        appAttr,
        ecsScheduleFnc,
    });
});
