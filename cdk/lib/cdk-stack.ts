// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from '@aws-cdk/core';
import * as directory from '@aws-cdk/aws-directoryservice';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as ssm from '@aws-cdk/aws-ssm';

export class CdkStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const keyPairName = new cdk.CfnParameter(this, 'keyPairName', {
      type: 'String',
      description: 'The name of the EC2 keypair associated with the Windows Server instance.'
    });

    // Create a VPC. 
    const vpc = new ec2.Vpc(this, 'vpc', {
      cidr: '172.20.0.0/16',
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: 'Public'
        },
        {
          subnetType: ec2.SubnetType.PRIVATE,
          name: 'Private'
        }
      ]
    });

    // Create an ECS cluster.
    const cluster = new ecs.Cluster(this, 'ecs-cluster', {
      clusterName: 'ecs-kerberos-sample',
      vpc: vpc
    });

    // Set up ECS VPC endpoints.
    let ecsEndpoint = vpc.addInterfaceEndpoint('ecs-endpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECS,
      privateDnsEnabled: true // This must be enabled
    });
    cdk.Tag.add(ecsEndpoint, 'Name', 'ecs-kerberos-sample/ecs-endpoint');
    ecsEndpoint.connections.allowDefaultPortFromAnyIpv4('Allow HTTPS traffic');

    let ecsAgentEndpoint = vpc.addInterfaceEndpoint('ecs-agent-endpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECS_AGENT,
      privateDnsEnabled: true // This must be enabled
    });
    cdk.Tag.add(ecsAgentEndpoint, 'Name', 'ecs-kerberos-sample/ecs-agent-endpoint');
    ecsAgentEndpoint.connections.allowDefaultPortFromAnyIpv4('Allow HTTPS traffic');

    let ecsTelemetryEndpoint = vpc.addInterfaceEndpoint('ecs-telemetry-endpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECS_TELEMETRY,
      privateDnsEnabled: true // This must be enabled
    });
    cdk.Tag.add(ecsTelemetryEndpoint, 'Name', 'ecs-kerberos-sample/ecs-telemetry-endpoint');
    ecsTelemetryEndpoint.connections.allowDefaultPortFromAnyIpv4('Allow HTTPS traffic');


    // Set up VPC endpoints for ECR.
    // See: https://docs.aws.amazon.com/AmazonECR/latest/userguide/vpc-endpoints.html
    let ecrEndpoint = vpc.addInterfaceEndpoint('ecr-api-endpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
      privateDnsEnabled: true // This must be enabled
    });
    cdk.Tag.add(ecrEndpoint, 'Name', 'ecs-kerberos-sample/ecr-api-endpoint');
    ecrEndpoint.connections.allowDefaultPortFromAnyIpv4('Allow HTTPS traffic');

    let ecrDockerEndpoint = vpc.addInterfaceEndpoint('ecr-docker-endpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      privateDnsEnabled: true // This must be enabled
    });
    cdk.Tag.add(ecrDockerEndpoint, 'Name', 'ecs-kerberos-sample/ecr-docker-endpoint');
    ecrDockerEndpoint.connections.allowDefaultPortFromAnyIpv4('Allow HTTPS traffic');

    let s3Endpoint = vpc.addGatewayEndpoint('ecr-s3-endpoint', {
      // Services that use ECR also need an S3 endpoint.
      service: ec2.GatewayVpcEndpointAwsService.S3
    });
    cdk.Tag.add(s3Endpoint, 'Name', 'ecs-kerberos-sample/ecr-s3-endpoint');



    // ------------------------------------------------------------------------------------------------------------------
    // Create an AWS Managed Active Directory in the VPC. 
    // NOTE: Typically, the Active Directory will be deployed into another VPC or account. In that case, remove this code 
    // and replace it with code to establish a network route between the VPC created above and the Active Directory.

    // Create a secure password for the Active Directory admin user and store it in Secrets Manager.
    const activeDirectoryAdminPasswordSecret = new secretsmanager.Secret(this, 'active-directory-admin-password-secret',
      {
        secretName: '/ecs-kerberos-sample/active-directory-administrator-password',
        generateSecretString: {
          excludeCharacters: '"\'' // Passwords with quotes are hard to work with on the command line.
        }
      });

    // Output the ARN of the directory admin password secret.
    new cdk.CfnOutput(this, 'ActiveDirectoryAdminPasswordSecretARN', { value: activeDirectoryAdminPasswordSecret.secretArn });

    const activeDirectory = new directory.CfnMicrosoftAD(this, 'directory', {
      name: 'directory.ecs-kerberos-sample.com',
      password: activeDirectoryAdminPasswordSecret.secretValue.toString(),
      edition: 'Standard',
      vpcSettings: {
        vpcId: vpc.vpcId,
        subnetIds: [vpc.publicSubnets[0].subnetId, vpc.publicSubnets[1].subnetId]
      }
    });

    // Deploy a Windows EC2 instance to manage the Active Directory.
    // In a typical deployment, this instance is likely unnecessary.
    const windowsServerImage = ec2.MachineImage.lookup({
      name: 'Windows_Server-2019-English-Full-Base*',
      windows: true
    });
    const directoryManagementInstance = new ec2.Instance(this, 'active-directory-management-instance', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: windowsServerImage,
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      keyName: keyPairName.valueAsString
    });

    // Store the instance's security group ID in the Systems Manager Parameter Store, so it can be referenced by other stacks.
    const windowsServerInstanceSecurityGroupId = new ssm.StringParameter(this, 'active-directory-management-instance-security-group-id', {
      allowedPattern: '.*',
      description: 'ID of the Security Group for the Windows Server instance used to manage the Active Directory',
      parameterName: '/ecs-kerberos-sample/directory-management-server-security-group-id',
      stringValue: directoryManagementInstance.connections.securityGroups[0].securityGroupId,
      tier: ssm.ParameterTier.STANDARD
    });

    // Output the management instance's security group ID so we can modify it to allow connections.
    new cdk.CfnOutput(this, 'DirectoryManagementInstanceSecurityGroupID', { value: directoryManagementInstance.connections.securityGroups[0].securityGroupId });


    // ------------------------------------------------------------------------------------------------------------------


    // These steps are required even if using an existing directory.

    // Store the Active Directory ID in the Systems Manager Parameter Store, so it can be referenced by other stacks.
    const activeDirectoryIdentifierParameter = new ssm.StringParameter(this, 'active-directory-id', {
      allowedPattern: '.*',
      description: 'Active Directory ID',
      parameterName: '/ecs-kerberos-sample/active-directory-id',
      stringValue: activeDirectory.attrAlias,
      tier: ssm.ParameterTier.STANDARD
    });

    // Create a DHCP Options Set so the VPC uses the Active Directory DNS servers.
    const activeDirectoryDhcpOptionsSet = new ec2.CfnDHCPOptions(this, 'directory-dhcp-os', {
      domainNameServers: activeDirectory.attrDnsIpAddresses
    });
    new ec2.CfnVPCDHCPOptionsAssociation(this, 'directory-dhcp-os-association', {
      vpcId: vpc.vpcId,
      dhcpOptionsId: activeDirectoryDhcpOptionsSet.ref
    });
  }
}
