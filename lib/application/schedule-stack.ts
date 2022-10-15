import { Construct } from 'constructs';
import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import iam = require('aws-cdk-lib/aws-iam');
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

/**
 * Creates a Lambda function for starting and stopping ECS Tasks
 *
 * @param {Construct} scope
 * @param {string} id
 * @param {ScheduleStackProps} props
 */
export class ScheduleStack extends Stack {
    ecsScheduleFnc: NodejsFunction;

    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        // Lambda Function to start/stop tasks =====================================
        const ecsScheduleFnc = new NodejsFunction(this, 'EcsScheduleFnc', {
            description: 'Lambda ECS Service Mgt Function',
            runtime: Runtime.NODEJS_16_X,
            handler: 'index.handler',
            timeout: Duration.seconds(5),
            entry: `${__dirname}/lambda/manage-task/index.ts`,
            bundling: {
                sourceMap: true,
            },
        });

        // IAM Policy to allow access to ECS Services from Lambda
        ecsScheduleFnc.addToRolePolicy(new iam.PolicyStatement({
            sid: 'ECSServices',
            resources: ['*'],
            actions: [
                'ecs:ListServices',
                'ecs:ListClusters',
            ],
        }));
        // IAM Policy to allow Start/Stop of the demo services
        ecsScheduleFnc.addToRolePolicy(new iam.PolicyStatement({
            sid: 'DemoApp',
            // Allow access to all ECS tasks - we don't do this in Production.
            // Alternatives include using Tags or prefixes, or moving this policy add to the app stacks themselves
            resources: ['*'],
            actions: [
                'ecs:UpdateService',
                'ecs:DescribeServices',
            ],
        }));
        this.ecsScheduleFnc = ecsScheduleFnc;
    }
}
