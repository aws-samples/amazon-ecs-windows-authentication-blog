// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from '@aws-cdk/core';
import * as directory from '@aws-cdk/aws-directoryservice';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecr from '@aws-cdk/aws-ecr';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns';
import * as iam from '@aws-cdk/aws-iam';
import * as rds from '@aws-cdk/aws-rds';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as servicediscovery from '@aws-cdk/aws-servicediscovery';
import * as ssm from '@aws-cdk/aws-ssm';

export class ApplicationStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const webSiteRepositoryArn: string = cdk.Arn.format({ service: 'ecr', resource: 'repository', resourceName: 'ecs-kerberos-sample/web-site' }, this);
    const kerberosSidecarRepositoryArn: string = cdk.Arn.format({ service: 'ecr', resource: 'repository', resourceName: 'ecs-kerberos-sample/kerberos-renewal-sidecar' }, this);
    const databaseCredentialsSecretArn = new cdk.CfnParameter(this, 'databaseCredentialsSecretArn', {
      type: 'String',
      description: 'ARN of the database credentials secret.'
    });

    // Look up assets from other stacks.
    const vpc = ec2.Vpc.fromLookup(this, 'vpc', {
      vpcName: 'ecs-kerberos-stack/vpc'
    });

    const cluster = ecs.Cluster.fromClusterAttributes(this, 'ecs-cluster', {
      clusterName: 'ecs-kerberos-sample',
      vpc: vpc,
      securityGroups: []
    });

    // Create an IAM user and role for the ECS tasks.
    const taskUser = new iam.User(this, 'web-site-user', { userName: 'ecs-kerberos-sample-web-site-user' });
    const taskRole = new iam.Role(this, 'web-site-iam-role', {
      roleName: 'ecs-kerberos-sample-web-site-role',
      assumedBy: taskUser
    });
    taskRole.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        principals: [new iam.ServicePrincipal('ecs-tasks.amazonaws.com')]
      })
    );

    // Get a reference to the database credentials secret. 
    const dbCredentialsSecret = secretsmanager.Secret.fromSecretArn(this, 'database-credentials-secret', databaseCredentialsSecretArn.valueAsString);
    // Allow the task role to read the secret.
    dbCredentialsSecret.grantRead(taskRole);


    // Get a reference to the repository.
    const webSiteRepository = ecr.Repository.fromRepositoryAttributes(this, 'web-site-repository', {
      repositoryArn: webSiteRepositoryArn,
      repositoryName: 'ecs-kerberos-sample/web-site'
    });
    const kerberosRenewalSidecarRepository = ecr.Repository.fromRepositoryAttributes(this, 'kerberos-renewal-sidecar-ecr-repository', {
      repositoryArn: kerberosSidecarRepositoryArn,
      repositoryName: 'ecs-kerberos-sample/kerberos-renewal-sidecar'
    });

    // Create a Fargate task. Include an application scratch volume.
    const fargateTask = new ecs.FargateTaskDefinition(this, 'web-site-task', {
      taskRole: taskRole,
      memoryLimitMiB: 512,
      volumes: [
        {
          name: 'application_scratch',
          host: {}
        }
      ]
    });

    // Add the web application container to the task definition.
    const webSiteContainer = fargateTask.addContainer('web-site-container', {
      image: ecs.ContainerImage.fromEcrRepository(webSiteRepository, 'latest'),
      memoryLimitMiB: 512,
      essential: true,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'web'
      })
    });
    webSiteContainer.addPortMappings({ containerPort: 80 });
    webSiteContainer.addMountPoints({ sourceVolume: 'application_scratch', containerPath: '/var/scratch', readOnly: true });


    // Add the Kerberos renewal sidecar container to the task definition.
    const kerberosRenewalSidecarContainer = fargateTask.addContainer('kerberos-renewal-sidecar-container', {
      image: ecs.ContainerImage.fromEcrRepository(kerberosRenewalSidecarRepository, 'latest'),
      memoryLimitMiB: 256,
      essential: true,
      // Pass in the credentials secret ARN as an environment variable.
      environment: {
        'CREDENTIALS_SECRET_ARN': dbCredentialsSecret.secretArn,
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'kerberos-renewal-sidecar'
      })
    });
    kerberosRenewalSidecarContainer.addMountPoints({ sourceVolume: 'application_scratch', containerPath: '/var/scratch', readOnly: false });

    // Set up the service container to depend on the Kerberos renewal sidecar.
    webSiteContainer.addContainerDependencies({ container: kerberosRenewalSidecarContainer, condition: ecs.ContainerDependencyCondition.START });

    // Create a load-balanced service.
    const loadBalancedService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'web-site-fargate-service', {
      cluster: cluster,
      taskDefinition: fargateTask,
      desiredCount: 3,
      publicLoadBalancer: true
    });
    loadBalancedService.targetGroup.configureHealthCheck({
      path: '/Home/HealthCheck'
    });

    // Allow the service to connect to the database.
    const sqlServerSecurityGroupId = ssm.StringParameter.fromStringParameterAttributes(this, 'MyValue', {
      parameterName: '/ecs-kerberos-sample/web-site/sql-server-security-group-id',
    }).stringValue;
    const sqlServerSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'sql-server-security-group', sqlServerSecurityGroupId);

    sqlServerSecurityGroup.connections.allowFrom(loadBalancedService.service, ec2.Port.tcp(1433));
  }
}
