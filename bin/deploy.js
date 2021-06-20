/**
 * Will deploy into the current default CLI account.
 *
 * Deployment:
 * cdk deploy --all
 */

/* eslint-disable no-new */
const cdk = require('@aws-cdk/core');
const { FargateAppStack } = require('../lib/application/application-stack');
const { AlbStack } = require('../lib/application/load-balancer-stack');
const { ScheduleStack } = require('../lib/application/schedule-stack');
const options = require('../lib/application/options.js');

const app = new cdk.App();

// Use account details from default AWS CLI credentials:
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;
const env = { account, region };

// Create Application Load Balancer
const albStack = new AlbStack(app, 'FargateAlbStack', {
    description: 'Fargate ALB Demo Stack',
    env,
    options,
});
const { vpc, subnets, targetGroups } = albStack;

// Create Scheduler Stack
const scheduleStack = new ScheduleStack(app, 'FargateScheduleStack', {
    description: 'Fargate Scheduler Demo Stack',
    env,
    options,
});
const { ecsScheduleFnc } = scheduleStack;

// Create Fargate Service and Task stack for each app
options.apps.forEach((appAttr) => {
    const { name } = appAttr;
    const { targetGroup, url } = targetGroups.find((group) => group.name === name);
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
