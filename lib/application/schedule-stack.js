/* eslint-disable no-new */
const { Stack, Duration } = require('aws-cdk-lib');
const iam = require('aws-cdk-lib').aws_iam;
const { Function, Runtime, Code } = require('aws-cdk-lib').aws_lambda;

class ScheduleStack extends Stack {
    /**
     * Creates a Lambda function for starting and stopping ECS Tasks
     *
     * @param {cdk.Construct} scope
     * @param {string} id
     * @param {cdk.StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        // Lambda Function to start/stop tasks =====================================
        const ecsScheduleFnc = new Function(this, 'ecsScheduleFnc', {
            description: 'Lambda ECS Service Mgt Function',
            functionName: 'ecsScheduleFnc',
            runtime: Runtime.NODEJS_14_X,
            handler: 'index.handler',
            timeout: Duration.seconds(5),
            code: Code.fromAsset(`${__dirname}/lambda/manage-task`),
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

module.exports = { ScheduleStack };
