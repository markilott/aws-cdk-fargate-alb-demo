import { Construct } from 'constructs';
import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import {
    ApplicationLoadBalancer, ApplicationProtocol, ApplicationTargetGroup,
    ListenerAction, TargetType, ListenerCondition,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import {
    Vpc, IVpc, ISubnet, SecurityGroup, Peer, Port,
} from 'aws-cdk-lib/aws-ec2';
import { HostedZone, ARecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';

interface AlbStackProps extends StackProps {
    vpcAttr: {
        customVpcId?: string,
        allowCidrs?: string[],
    },
    dnsAttr: {
        zoneName: string,
        hostedZoneId: string,
        cerificateArn?: string,
    },
    apps: {
        name: string,
        hostname: string,
        containerPort?: number,
    }[],
}

/**
 * Deploys a public facing Application Load Balancer
 * and Listeners for use by the Fargate apps
 *
 * @param {Construct} scope
 * @param {string} id
 * @param {AlbStackProps} props
 */
export class AlbStack extends Stack {
    vpc: IVpc;

    subnets: ISubnet[];

    targetGroups: {
        name: string,
        targetGroup: ApplicationTargetGroup,
        url: string,
    }[];

    constructor(scope: Construct, id: string, props: AlbStackProps) {
        super(scope, id, props);

        const { vpcAttr, dnsAttr } = props;

        // VPC ==================================================================================================

        // Use an existing VPC if specified in options, or the default VPC if not
        const { customVpcId, allowCidrs } = vpcAttr;
        const vpc = (customVpcId) ? Vpc.fromLookup(this, 'vpc', { vpcId: customVpcId }) : Vpc.fromLookup(this, 'vpc', { isDefault: true });
        this.vpc = vpc;

        // Get public subnets from the VPC and confirm we have at least one
        const subnets = vpc.publicSubnets;
        this.subnets = subnets;
        if (!subnets.length) { throw new Error('We need at least one public subnet in the VPC'); }

        // Security group for the ALB
        const albSg = new SecurityGroup(this, 'albSg', {
            description: 'ALB Endpoint SG',
            vpc,
            allowAllOutbound: false, // Rules to access the Fargate apps will be added by CDK
        });
        Tags.of(albSg).add('Name', 'AlbDemoSg');
        if (Array.isArray(allowCidrs) && allowCidrs.length) {
            // Allow inbound from our specified CIDR ranges
            allowCidrs.forEach((cidr) => {
                albSg.addIngressRule(Peer.ipv4(cidr), Port.tcp(443), 'allow https access');
                albSg.addIngressRule(Peer.ipv4(cidr), Port.tcp(80), 'allow http access');
            });
        } else {
            // Or allow public web access
            albSg.addIngressRule(Peer.anyIpv4(), Port.tcp(443), 'allow public https access');
            albSg.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'allow public http access');
        }

        // DNS and Certificate =========================================================================================

        // Use custom domain and hostname for ALB. The Route53 Zone must be in the same account.
        const { zoneName = '', hostedZoneId = '', cerificateArn = '' } = dnsAttr;
        const createCert = (!cerificateArn);
        if (!(zoneName && hostedZoneId)) { throw new Error('Route53 domain details are required'); }

        // DNS Zone
        const zone = HostedZone.fromHostedZoneAttributes(this, 'zone', dnsAttr);

        // Use existing Certificate if supplied, or create new one. Existing Certificate must be in the same Account and Region.
        // Creating a certificate will try to create auth records in the Route53 DNS zone.
        const certificate = (createCert) ? new Certificate(this, 'cert', { domainName: `*.${zoneName}`, validation: CertificateValidation.fromDns(zone) }) : Certificate.fromCertificateArn(this, 'cert', cerificateArn);

        // ALB =========================================================================================================

        // load balancer base
        const alb = new ApplicationLoadBalancer(this, 'alb', {
            vpc,
            vpcSubnets: {
                subnets,
            },
            internetFacing: true,
            securityGroup: albSg,
        });

        // Https listener
        const httpsListener = alb.addListener('https', {
            port: 443,
            protocol: ApplicationProtocol.HTTPS,
            certificates: [certificate],
            open: false, // Prevent CDK from adding an allow all inbound rule to the security group
        });

        // addRedirect will create a HTTP listener and redirect to HTTPS
        alb.addRedirect({
            sourceProtocol: ApplicationProtocol.HTTP,
            sourcePort: 80,
            targetProtocol: ApplicationProtocol.HTTPS,
            targetPort: 443,
            open: false, // Prevent CDK from adding an allow all inbound rule to the security group
        });

        // Add default route to send a 404 response for unknown domains
        httpsListener.addAction('default', {
            action: ListenerAction.fixedResponse(404, {
                contentType: 'text/plain',
                messageBody: 'Nothing to see here',
            }),
        });

        // Target Groups and Routes for our apps ========================================================================
        const { apps } = props;
        let priority = 1; // We need a unique priority for each app

        this.targetGroups = apps.map((app) => {
            const { name, hostname, containerPort = 80 } = app;
            const fqdn = `${hostname}.${zoneName}`;

            // Target Group. Fargate stack will add services to this group
            const targetGroup = new ApplicationTargetGroup(this, `${name}TargetGroup`, {
                vpc,
                port: containerPort,
                // IP target type is required for Fargate services - it must be specified here if attaching services in other stacks
                targetType: TargetType.IP,
            });

            // Add route to the target group
            httpsListener.addAction(`${name}Action`, {
                action: ListenerAction.forward([targetGroup]),
                conditions: [
                    ListenerCondition.hostHeaders([fqdn]),
                ],
                priority,
            });

            // Add DNS alias for the app
            new ARecord(this, `${name}Alias`, {
                recordName: fqdn,
                zone,
                comment: `DNS Alias for ${name}`,
                target: RecordTarget.fromAlias(new LoadBalancerTarget(alb)),
            });

            priority += 1;

            return {
                name,
                targetGroup,
                url: `https://${fqdn}/`,
            };
        });
    }
}
