# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

FROM amazonlinux:2

ADD renew.sh /
ADD krb5.conf /etc/krb5.conf

# Install the Kerberos tools -- to authenticate;
# `jq` -- to parse the credentials from the AWS Secrets Manager, which returns JSON
# `unzip` -- to install the latest version of the AWS CLI
RUN yum install -y krb5-workstation jq unzip && mkdir /krb5 && chmod 755 /krb5 

# Download and install the latest version of the AWS CLI
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
RUN unzip awscliv2.zip
RUN ./aws/install

VOLUME ["/krb5","/etc/krb5.conf.d","/var/scratch"]

ENTRYPOINT ["/renew.sh"]