const vpcAttr = {
    // Optional: Use custom VPC if supplied. Must have public subnets.
    customVpcId: '',
    // Optional: Restrict access to specific CIDR ranges (a.b.c.d/xx). If not specified the sites will be public.
    allowCidrs: [],
};
const dnsAttr = {
    // Required: Route53 Zone must be in same Account.
    zoneName: '',
    hostedZoneId: '',
    // Optional: Use existing certificate if supplied. Must be a wildcard, or match the hostname above.
    cerificateArn: '',
};
const apps = [
    // Create Fargate apps.
    // Images must have a web server running on the specified port.
    // If using a local Docker file then Docker Desktop is required for deployment.
    {
        name: 'webDemo1',
        containerPort: 80,
        hostname: 'web-demo1',
        // Specify local image path or Docker Hub (or ECR) URI
        dockerHubImage: '',
        dockerFileDir: 'containers/app1',
        // Optional: set a schedule to start/stop the Task. CRON expressions without seconds. Time in UTC.
        schedule: {
            start: '0 2 ? * MON-FRI *',
            stop: '0 10 ? * * *',
        },
    },
    {
        name: 'webDemo2',
        containerPort: 80,
        hostname: 'web-demo2',
        // Specify local image path or Docker Hub (or ECR) URI
        dockerHubImage: '',
        dockerFileDir: 'containers/app2',
        schedule: {
            start: '0 2 ? * MON-FRI *',
            stop: '0 10 ? * * *',
        },
    },
    {
        name: 'wordpress',
        containerPort: 80,
        hostname: 'wordpress',
        // Specify local image path or Docker Hub (or ECR) URI
        dockerHubImage: 'wordpress',
        dockerFileDir: '',
        schedule: {},
    },
];

module.exports = {
    vpcAttr, dnsAttr, apps,
};
