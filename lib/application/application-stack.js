/* eslint-disable no-new */
const { Stack, Tags, CfnOutput } = require('aws-cdk-lib');
const ecs = require('aws-cdk-lib').aws_ecs;
const { SecurityGroup } = require('aws-cdk-lib').aws_ec2;
const iam = require('aws-cdk-lib').aws_iam;
const { DockerImageAsset } = require('aws-cdk-lib').aws_ecr_assets;
const { Rule, Schedule, RuleTargetInput } = require('aws-cdk-lib').aws_events;
const { LambdaFunction } = require('aws-cdk-lib').aws_events_targets;

class FargateAppStack extends Stack {
    /**
     * Creates Fargate Service using local definition to create an ECR image
     * or an image from DockerHub.
     * If using a local image Docker Desktop must be installed.
     * If using DockerHub image we expect one with a web server on port 80.
     * Attaches to the new Fargate service to our ALB.
     *
     * @param {cdk.Construct} scope
     * @param {string} id
     * @param {cdk.StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        const { appAttr, targetGroup, url } = props;
        const { name } = appAttr;

        // VPC Setup =========================================================================================================

        const { vpc, subnets } = props;
        const { containerPort = 80 } = appAttr;

        // Security Group for the App Service
        // Note this SG will only allow traffic from the ALB.
        // If you need to SSH to the container you will need to add additional ingress rules here.
        const sg = new SecurityGroup(this, `${name}Sg`, {
            vpc,
            description: `${name} App SG`,
            allowAllOutbound: true, // Allow all so we can get Docker Hub images
        });
        Tags.of(sg).add('Name', `FargateDemoSg-${name}`);

        // ECR/Docker Image ========================================================================================================

        // Use a DockerHub Image if supplied, otherwise create from local definition
        let imageUri = appAttr.dockerHubImage;
        let repositoryArn = '';

        // Create image from local file and upload to ECR
        // Requires Docker Desktop installed locally
        if (!imageUri) {
            const { dockerFileDir = '' } = appAttr;
            if (!dockerFileDir) { throw new Error('dockerFileDir is required for local image'); }
            const ecrImage = new DockerImageAsset(this, `${name}AppImage`, {
                directory: `${__dirname}/${dockerFileDir}`,
            });
            repositoryArn = ecrImage.repository.repositoryArn;
            imageUri = ecrImage.imageUri;
        }

        // Fargate ==========================================================================================================
        // ECS Cluster
        const cluster = new ecs.Cluster(this, `${name}Cluster`, { vpc });

        // Fargate Task
        const taskDefinition = new ecs.FargateTaskDefinition(this, 'taskDef', {
            memoryLimitMiB: 512,
            cpu: 256,
        });
        taskDefinition.addContainer('webContainer', {
            image: ecs.ContainerImage.fromRegistry(imageUri),
            portMappings: [{ containerPort }],
        });

        // Allow Fargate to access the ECR Image if we created one
        if (repositoryArn) {
            taskDefinition.addToExecutionRolePolicy(new iam.PolicyStatement({
                sid: 'EcrImage',
                resources: [repositoryArn],
                actions: [
                    'ecr:BatchCheckLayerAvailability',
                    'ecr:GetDownloadUrlForLayer',
                    'ecr:BatchGetImage',
                ],
            }));
            taskDefinition.addToExecutionRolePolicy(new iam.PolicyStatement({
                sid: 'EcrAuth',
                resources: ['*'],
                actions: [
                    'ecr:GetAuthorizationToken',
                ],
            }));
        }

        // Fargate Service
        const service = new ecs.FargateService(this, `${name}Svc`, {
            cluster,
            taskDefinition,
            desiredCount: 1,
            vpcSubnets: { subnets },
            securityGroups: [sg],
            // Public IP required so we can get the ECR or Docker image. If you have a NAT Gateway or ECR VPC Endpoints set this to false.
            assignPublicIp: true,
        });

        // Add service to Load Balancer
        targetGroup.addTarget(service);

        // Export the app URL
        new CfnOutput(this, `${name}CustomUrl`, {
            description: `${name} Url`,
            value: url,
        });

        // Add Schedule =====================================================================================================
        const { ecsScheduleFnc } = props;
        const { start = '', stop = '' } = appAttr.schedule;
        if (start || stop) {
            // Lambda target config
            const params = {
                clusterArn: cluster.clusterArn,
                serviceName: service.serviceName,
            };

            // Schedule Rules
            if (start) {
                params.active = true;
                const mgtTarget = new LambdaFunction(ecsScheduleFnc, {
                    event: RuleTargetInput.fromObject({ params }),
                    retryAttempts: 3,
                });
                const startRule = new Rule(this, 'startRule', {
                    description: 'Start ECS Task',
                    schedule: Schedule.expression(`cron(${start})`),
                });
                startRule.addTarget(mgtTarget);
            }
            if (stop) {
                params.active = false;
                const mgtTarget = new LambdaFunction(ecsScheduleFnc, {
                    event: RuleTargetInput.fromObject({ params }),
                    retryAttempts: 3,
                });
                const stopRule = new Rule(this, 'stopRule', {
                    description: 'Stop ECS Task',
                    schedule: Schedule.expression(`cron(${stop})`),
                });
                stopRule.addTarget(mgtTarget);
            }
        }
    }
}

module.exports = { FargateAppStack };
