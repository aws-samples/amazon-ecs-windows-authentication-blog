## AWS Blog: Using Windows Authentication with Linux Containers on Amazon ECS

This repository contains sample code for the AWS Blog Post "Using Windows Authentication with Linux Containers on Amazon ECS". 

Windows (or Integrated) Authentication is the recommended mechanism for clients and applications to connect to SQL Server databases, but using Windows Authentication can be challenging when running containerized workloads. Typically, Windows Authentication clients are joined to the same domain as the SQL Server database, but since individual container instances are ephemeral, joining them to a domain is not optimal.

This post shows how to configure a Linux container running on Amazon Elastic Container Service (Amazon ECS) to connect to a SQL Server database using Windows Authentication, without joining the container to the domain. The example will use AWS Fargate to run the containers, but this solution could be deployed onto a different container runtime or control plane with minor modifications.

This sample uses the AWS Cloud Development Kit (CDK) to deploy the following AWS resources:
 
* An Amazon Elastic Container Service (ECS) cluster;
* A managed Active Directory running in AWS Directory Service for Microsoft Active Directory;
* A SQL Server database running in Amazon Relational Database Service (RDS);
* An AWS Fargate task that includes two containers, a Web site and a Kerberos renewal 'sidecar';
* An ECS Service that runs the Fargate task.

See the blog post for complete instructions on how to deploy the sample.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

