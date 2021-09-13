// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as rds from '@aws-cdk/aws-rds';
import * as ssm from '@aws-cdk/aws-ssm';
import { SqlServerEngineVersion } from '@aws-cdk/aws-rds';

export class DatabaseStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Look up assets from other stacks.
    const vpc = ec2.Vpc.fromLookup(this, 'vpc', {
      vpcName: 'ecs-kerberos-stack/vpc'
    });

    // Set up an RDS SQL Server instance with Windows auth to the Active Directory.

    // Create a SQL Server instance inside the VPC and joined to the existing directory.
    const sqlServerInstance = new rds.DatabaseInstance(this, 'web-sql-rds', {
      engine: rds.DatabaseInstanceEngine.sqlServerSe({ version: SqlServerEngineVersion.VER_15 }),
      licenseModel: rds.LicenseModel.LICENSE_INCLUDED,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.XLARGE),
      vpc: vpc,
      vpcPlacement: { subnetType: ec2.SubnetType.PRIVATE_WITH_NAT },
      credentials: rds.Credentials.fromGeneratedSecret('web_dbo'),
      autoMinorVersionUpgrade: true,

      // You may wish to change these settings in a production environment.
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Set up credential rotation for the DB administrator user.
    sqlServerInstance.addRotationSingleUser();

    // Store the database credentials secret ARN in the Systems Manager Parameter Store, so it can be referenced by the Web application stack.
    const sqlServerInstanceSecretArnParameter = new ssm.StringParameter(this, 'sql-server-credentials-secret-arn', {
      allowedPattern: '.*',
      description: 'ARN of the secret containing the database credentials',
      parameterName: '/ecs-kerberos-sample/web-site/sql-server-credentials-secret-arn',
      stringValue: sqlServerInstance.secret?.secretArn ?? '',
      tier: ssm.ParameterTier.STANDARD
    });

    // Create an IAM Role with the `AmazonRDSDirectoryServiceAccess` policy. This is required to join the SQL Server to the domain.
    const dbRole = new iam.Role(this, 'rds-role', {
      assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonRDSDirectoryServiceAccess')],
    });

    // Join the SQL server to the domain. This isn't available in CDK yet, so use the CloudFormation primitives.

    // In order to join the server to the domain, we need to know the ID of the Active Directory.
    // The root stack stored this value in the Systems Manager Parameter Store.
    const activeDirectoryId = ssm.StringParameter.fromStringParameterAttributes(this, 'active-directory-id-parameter-value', {
      parameterName: '/ecs-kerberos-sample/active-directory-id',
    }).stringValue;

    const cfnSqlServerInstance = sqlServerInstance.node.defaultChild as rds.CfnDBInstance;
    cfnSqlServerInstance.domain = activeDirectoryId;
    cfnSqlServerInstance.domainIamRoleName = dbRole.roleName;

    // Store the security group IDs in the Systems Manager Parameter Store, so they can be referenced by the Web application stack.
    const sqlServerInstanceSecurityGroupId = new ssm.StringParameter(this, 'sql-server-security-group-id', {
      allowedPattern: '.*',
      description: 'ID of the Security Group for the Web Site RDS instance',
      parameterName: '/ecs-kerberos-sample/web-site/sql-server-security-group-id',
      stringValue: sqlServerInstance.connections.securityGroups[0].securityGroupId,
      tier: ssm.ParameterTier.STANDARD
    });

    // Allow the AD management instance to connect to the database, so the management instance can be used to set up the database access.
    const activeDirectoryManagementServerSecurityGroupId = ssm.StringParameter.fromStringParameterAttributes(this, 'directory-management-server-security-group-id', {
      parameterName: '/ecs-kerberos-sample/directory-management-server-security-group-id',
    }).stringValue;
    const activeDirectoryManagementServerSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'active-directory-management-server-security-group', activeDirectoryManagementServerSecurityGroupId);

    sqlServerInstance.connections.allowDefaultPortFrom(activeDirectoryManagementServerSecurityGroup,
      'Consider removing this rule after the database deployment is complete.');


    // Output information about the database instance.
    new cdk.CfnOutput(this, 'DBInstanceIdentifier', { value: sqlServerInstance.instanceIdentifier });
    new cdk.CfnOutput(this, 'DBInstanceEndpointAddress', { value: sqlServerInstance.dbInstanceEndpointAddress });
    new cdk.CfnOutput(this, 'DBInstanceCredentialsSecretARN', { value: sqlServerInstance.secret?.secretArn ?? '' });
  }
}
