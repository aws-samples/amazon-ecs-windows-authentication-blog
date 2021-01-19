#!/usr/bin/env node

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ApplicationStack } from '../lib/application-stack';
import { DatabaseStack } from '../lib/database-stack';

const environment = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
};

const app = new cdk.App();

const databaseStack = new DatabaseStack(app, 'ecs-kerberos-sample--web-database-stack', { env: environment });

const applicationStack = new ApplicationStack(app, 'ecs-kerberos-sample--web-application-stack', { env: environment });
