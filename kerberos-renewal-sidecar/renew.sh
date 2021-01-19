#!/bin/bash

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0


# Set the length of time that the scirpt will wait to refresh the token.
[[ "$DELAY_SECONDS" == "" ]] && DELAY_SECONDS=3600

# If the AWS region hasn't been set, get it from instance metadata. This will work in an instance as well as in an ECS container.
[[ "$AWS_REGION" == "" ]] && AWS_REGION=$(curl --silent http://169.254.169.254/latest/dynamic/instance-identity/document | jq -r .region)

# Use the ECS container as the source for AWS credentials. This allows the AWS CLI to use the permissions of the task role.
aws configure set credential_source EcsContainer


while true
do
    echo "Starting ticket renewal at: " + $(date)

    # Get the credentials from Secrets Manager.
    CREDENTIALS_SECRET_VALUE=$(aws secretsmanager get-secret-value --secret-id $CREDENTIALS_SECRET_ARN --region $AWS_REGION --query SecretString --output text)

    # Use `jq` to parse the credentials into username & password.
    CREDENTIALS_USERNAME=$(echo $CREDENTIALS_SECRET_VALUE | jq -r '.username')
    CREDENTIALS_PASSWORD=$(echo $CREDENTIALS_SECRET_VALUE | jq -r '.password')

    # Use the username & password to authenticate to Kerberos. The resulting token is written to the token cache, 
    # which is set up in `krb5.conf` to use the task scratch volume, shared by all containers.
    echo $CREDENTIALS_PASSWORD | kinit $CREDENTIALS_USERNAME -f -V $OPTIONS

    echo "Ticket renewal complete, waiting for $DELAY_SECONDS seconds"


    sleep $DELAY_SECONDS &
    wait
done