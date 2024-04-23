import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticloadbalancingv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';

export interface ScalableHandsonStackStackProps extends cdk.StackProps {
  /**
   * User Name
   * @default 'user1'
   */
  readonly userName?: string;
  /**
   * Instance Type
   * @default 't2.micro'
   */
  readonly instanceType?: string;
  /**
   * DB Admin User
   */
  readonly dbAdminUser: string;
  /**
   * DB Admin Password
   */
  readonly dbAdminPassword: string;
  /**
   * AMI ID
   */
  readonly amiId: string;
}

/**
 * Scalable website
 */
export class ScalableHandsonStackStack extends cdk.Stack {
  /**
   * The Instance ID
   */
  public readonly instanceId;
  /**
   * EC2 Public IP
   */
  public readonly publicIp;
  public readonly rdsDomainName;
  public readonly elbDomainName;

  public constructor(scope: cdk.App, id: string, props: ScalableHandsonStackStackProps) {
    super(scope, id, props);

    // Applying default props
    props = {
      ...props,
      userName: props.userName ?? 'user1',
      instanceType: props.instanceType ?? 't2.micro',
    };

    // Mappings
    const regionMap: Record<string, Record<string, string>> = {
      'us-east-1': {
        'zone1': 'us-east-1a',
        'zone2': 'us-east-1b',
      },
      'ap-northeast-1': {
        'zone1': 'ap-northeast-1a',
        'zone2': 'ap-northeast-1c',
      },
    };

    // Resources
    const internetGateway = new ec2.CfnInternetGateway(this, 'InternetGateway', {
    });

    const vpc = new ec2.CfnVPC(this, 'VPC', {
      cidrBlock: '10.0.0.0/16',
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags: [
        {
          key: 'Name',
          value: [
            'handson',
            props.userName!,
          ].join('-'),
        },
      ],
    });

    const elbSecurityGroup = new ec2.CfnSecurityGroup(this, 'ElbSecurityGroup', {
      groupDescription: 'elb',
      vpcId: vpc.ref,
      securityGroupIngress: [
        {
          ipProtocol: 'tcp',
          fromPort: 80,
          toPort: 80,
          cidrIp: '0.0.0.0/0',
        },
      ],
    });

    const internetGatewayAttachment = new ec2.CfnVPCGatewayAttachment(this, 'InternetGatewayAttachment', {
      vpcId: vpc.ref,
      internetGatewayId: internetGateway.ref,
    });

    const privateSubnet1 = new ec2.CfnSubnet(this, 'PrivateSubnet1', {
      vpcId: vpc.ref,
      cidrBlock: '10.0.2.0/24',
      availabilityZone: regionMap[this.region]['zone1'],
      tags: [
        {
          key: 'Name',
          value: '???????????-1a',
        },
      ],
    });

    const privateSubnet2 = new ec2.CfnSubnet(this, 'PrivateSubnet2', {
      vpcId: vpc.ref,
      cidrBlock: '10.0.3.0/24',
      availabilityZone: regionMap[this.region]['zone2'],
      tags: [
        {
          key: 'Name',
          value: '???????????-1c',
        },
      ],
    });

    const publicSubnet1 = new ec2.CfnSubnet(this, 'PublicSubnet1', {
      vpcId: vpc.ref,
      cidrBlock: '10.0.0.0/24',
      availabilityZone: regionMap[this.region]['zone1'],
      tags: [
        {
          key: 'Name',
          value: '??????????-1a',
        },
      ],
    });

    const publicSubnet2 = new ec2.CfnSubnet(this, 'PublicSubnet2', {
      vpcId: vpc.ref,
      cidrBlock: '10.0.1.0/24',
      availabilityZone: regionMap[this.region]['zone2'],
      tags: [
        {
          key: 'Name',
          value: '??????????-1c',
        },
      ],
    });

    const routeTablePrivate1 = new ec2.CfnRouteTable(this, 'RouteTablePrivate1', {
      vpcId: vpc.ref,
    });

    const routeTablePrivate2 = new ec2.CfnRouteTable(this, 'RouteTablePrivate2', {
      vpcId: vpc.ref,
    });

    const routeTablePublic = new ec2.CfnRouteTable(this, 'RouteTablePublic', {
      vpcId: vpc.ref,
    });

    const associateRouteTablePrivate1 = new ec2.CfnSubnetRouteTableAssociation(this, 'AssociateRouteTablePrivate1', {
      routeTableId: routeTablePrivate1.ref,
      subnetId: privateSubnet1.ref,
    });

    const associateRouteTablePrivate2 = new ec2.CfnSubnetRouteTableAssociation(this, 'AssociateRouteTablePrivate2', {
      routeTableId: routeTablePrivate2.ref,
      subnetId: privateSubnet2.ref,
    });

    const associateRouteTablePublic1 = new ec2.CfnSubnetRouteTableAssociation(this, 'AssociateRouteTablePublic1', {
      routeTableId: routeTablePublic.ref,
      subnetId: publicSubnet1.ref,
    });

    const associateRouteTablePublic2 = new ec2.CfnSubnetRouteTableAssociation(this, 'AssociateRouteTablePublic2', {
      routeTableId: routeTablePublic.ref,
      subnetId: publicSubnet2.ref,
    });

    const ec2SecurityGroup = new ec2.CfnSecurityGroup(this, 'Ec2SecurityGroup', {
      groupDescription: 'EC2 securitygroup',
      vpcId: vpc.ref,
      securityGroupIngress: [
        {
          ipProtocol: 'tcp',
          fromPort: 80,
          toPort: 80,
          cidrIp: '0.0.0.0/0',
        },
        {
          sourceSecurityGroupId: elbSecurityGroup.ref,
          ipProtocol: 'tcp',
          fromPort: 80,
          toPort: 80,
        },
      ],
    });

    const elb = new elasticloadbalancingv2.CfnLoadBalancer(this, 'Elb', {
      securityGroups: [
        elbSecurityGroup.ref,
      ],
      subnets: [
        publicSubnet1.ref,
        publicSubnet2.ref,
      ],
    });

    const rdsDbSubnetGroup = new rds.CfnDBSubnetGroup(this, 'RdsDBSubnetGroup', {
      dbSubnetGroupDescription: 'RDS for MySQL',
      subnetIds: [
        privateSubnet1.ref,
        privateSubnet2.ref,
      ],
    });

    const routePublic1 = new ec2.CfnRoute(this, 'RoutePublic1', {
      routeTableId: routeTablePublic.ref,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: internetGateway.ref,
    });

    const ec2Instance = new ec2.CfnInstance(this, 'EC2Instance', {
      imageId: props.amiId!,
      instanceType: props.instanceType!,
      ebsOptimized: false,
      blockDeviceMappings: [
        {
          deviceName: '/dev/xvda',
          ebs: {
            encrypted: false,
            deleteOnTermination: true,
            iops: 3000,
            volumeSize: 16,
            volumeType: 'gp3',
          },
        },
      ],
      networkInterfaces: [
        {
          subnetId: publicSubnet1.ref,
          associatePublicIpAddress: true,
          deviceIndex: '0',
          groupSet: [
            ec2SecurityGroup.ref,
          ],
        },
      ],
      privateDnsNameOptions: {
        hostnameType: 'ip-name',
        enableResourceNameDnsARecord: false,
        enableResourceNameDnsAaaaRecord: false,
      },
      tags: [
        {
          key: 'Name',
          value: `webserver#1-${props.userName!}`,
        },
      ],
    });

    const ec2Instance2 = new ec2.CfnInstance(this, 'EC2Instance2', {
      imageId: props.amiId!,
      instanceType: props.instanceType!,
      ebsOptimized: false,
      blockDeviceMappings: [
        {
          deviceName: '/dev/xvda',
          ebs: {
            encrypted: false,
            deleteOnTermination: true,
            iops: 3000,
            volumeSize: 16,
            volumeType: 'gp3',
          },
        },
      ],
      networkInterfaces: [
        {
          subnetId: publicSubnet2.ref,
          associatePublicIpAddress: true,
          deviceIndex: '0',
          groupSet: [
            ec2SecurityGroup.ref,
          ],
        },
      ],
      privateDnsNameOptions: {
        hostnameType: 'ip-name',
        enableResourceNameDnsARecord: false,
        enableResourceNameDnsAaaaRecord: false,
      },
      tags: [
        {
          key: 'Name',
          value: `webserver#2-${props.userName!}`,
        },
      ],
    });

    const rdsSecurityGroup = new ec2.CfnSecurityGroup(this, 'RdsSecurityGroup', {
      groupDescription: 'RDS for MySQL',
      vpcId: vpc.ref,
      securityGroupIngress: [
        {
          sourceSecurityGroupId: ec2SecurityGroup.ref,
          ipProtocol: 'tcp',
          fromPort: 3306,
          toPort: 3306,
        },
      ],
    });

    const elbTargetGroup = new elasticloadbalancingv2.CfnTargetGroup(this, 'ElbTargetGroup', {
      targetType: 'instance',
      protocol: 'HTTP',
      port: 80,
      vpcId: vpc.ref,
      protocolVersion: 'HTTP1',
      healthCheckEnabled: true,
      healthCheckProtocol: 'HTTP',
      healthCheckPath: '/wp-includes/images/blank.gif',
      targets: [
        {
          id: ec2Instance.ref,
        },
        {
          id: ec2Instance2.ref,
        },
      ],
    });

    const rdsDbInstance = new rds.CfnDBInstance(this, 'RdsDBInstance', {
      engine: 'MySQL',
      engineVersion: '8.0.33',
      masterUsername: props.dbAdminUser!,
      masterUserPassword: props.dbAdminPassword!,
      dbInstanceClass: 'db.t3.micro',
      allocatedStorage: '20',
      dbSubnetGroupName: rdsDbSubnetGroup.ref,
      publiclyAccessible: false,
      vpcSecurityGroups: [
        rdsSecurityGroup.ref,
      ],
      dbName: 'wordpress',
    });

    const elbListener = new elasticloadbalancingv2.CfnListener(this, 'ElbListener', {
      loadBalancerArn: elb.ref,
      protocol: 'HTTP',
      port: 80,
      defaultActions: [
        {
          type: 'forward',
          targetGroupArn: elbTargetGroup.ref,
        },
      ],
    });

    // Outputs
    this.instanceId = ec2Instance.ref;
    new cdk.CfnOutput(this, 'CfnOutputInstanceID', {
      key: 'InstanceID',
      description: 'The Instance ID',
      value: this.instanceId!.toString(),
    });
    this.publicIp = ec2Instance.attrPublicIp;
    new cdk.CfnOutput(this, 'CfnOutputPublicIp', {
      key: 'PublicIp',
      description: 'EC2 Public IP',
      value: this.publicIp!.toString(),
    });
    this.rdsDomainName = rdsDbInstance.attrEndpointAddress;
    new cdk.CfnOutput(this, 'CfnOutputRdsDomainName', {
      key: 'RdsDomainName',
      value: this.rdsDomainName!.toString(),
    });
    this.elbDomainName = [
      'http://',
      elb.attrDnsName,
    ].join('');
    new cdk.CfnOutput(this, 'CfnOutputElbDomainName', {
      key: 'ElbDomainName',
      value: this.elbDomainName!.toString(),
    });
  }
}
