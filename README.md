## AWS Blog: Using Windows Authentication with Linux Containers on Amazon ECS

This repository contains sample code for the AWS Blog Post ["Using Windows Authentication with Linux Containers on Amazon ECS"](https://aws.amazon.com/blogs/containers/using-windows-authentication-with-linux-containers-on-amazon-ecs/). 

Windows (or Integrated) Authentication is the recommended mechanism for clients and applications to connect to SQL Server databases, but using Windows Authentication can be challenging when running containerized workloads. Typically, Windows Authentication clients are joined to the same domain as the SQL Server database, but since individual container instances are ephemeral, joining them to a domain is not optimal.

This post shows how to configure a Linux container running on Amazon Elastic Container Service (Amazon ECS) to connect to a SQL Server database using Windows Authentication, without joining the container to the domain. The example will use AWS Fargate to run the containers, but this solution could be deployed onto a different container runtime or control plane with minor modifications.

This sample uses the AWS Cloud Development Kit (CDK) to deploy the following AWS resources:
 
* An Amazon Elastic Container Service (ECS) cluster;
* A managed Active Directory running in AWS Directory Service for Microsoft Active Directory;
* A SQL Server database running in Amazon Relational Database Service (RDS);
* An AWS Fargate task that includes two containers, a Web site and a Kerberos renewal 'sidecar';
* An ECS Service that runs the Fargate task.

See the [blog post](https://aws.amazon.com/blogs/containers/using-windows-authentication-with-linux-containers-on-amazon-ecs/) for complete instructions on how to deploy the sample.

### Prerequisites

To deploy the sample, you should have the following prerequisites:

* An [AWS account](https://aws.amazon.com/).
* Complete the [AWS CDK getting started guide](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html), including installing the CDK and learning the key concepts.
* [Install the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) and set up your [AWS credentials for command-line use](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_prerequisites).
* [Create an Amazon EC2 key pair](https://docs.aws.amazon.com/cli/latest/userguide/cli-services-ec2-keypairs.html) and record its name.
* Determine the public IP address of the computer that will be deploying the resources.
* Install a [Microsoft Remote Desktop](https://docs.microsoft.com/en-us/windows-server/remote/remote-desktop-services/clients/remote-desktop-clients) (RDP) client.
* Install the latest version of the Docker runtime.


### Solution Overview

The solution is composed of two CDK apps: a shared resource app and an app for the website. The dependencies between the CDK apps are minimal. The website app depends on the virtual private cloud (VPC) and ECS cluster created by the shared resources app. This facilitates a microservices architecture where each microservice is defined independently (while sharing an ECS cluster).

The shared resource CDK app is located in the solution directory under `/cdk`. The website CDK app is located in the solution directory under `/web-site/cdk`.

The Kerberos ticket renewal sidecar container is located in the solution directory under `/kerberos-renewal-sidecar`. This container does not have its own CDK app because it is not deployed on its own. Instead, it is incorporated into the website CDK app.

The blog post contains full instructions to deploy the sample. The summarized steps are:

1. Deploy the shared resources CDK app (in `/cdk`). Record the Active Directory admin credentials.
2. Deploy the web application database (in `/web-site/cdk`, using the app `ecs-kerberos--database-stack`).
3. Connect to the EC2 instance deployed in step 1 using RDP. While connected to that instance:
    * Connect to the Active Directory and create a directory user to access the database.
    * Connect to the SQL Server database and create a sample database. Grant the AD user access to this database.
4. Update the web site configuration (in `/web-site/appsettings.Development_AWS.json`) with the instance identifier of the database.
    * Note that the database connection string uses `Integrated Security=true`.
5. Build Docker images for the web site and Kerberos renewal sidecar. Push those images into Amazon Elastic Container Repository (ECR) repositories.
6. Deploy the web site ECS cluster (in `web-site/cdk`, using the app `ecs-kerberos-sample--web-application-stack`).
7. Use a web browser to access the public URL of the load balancer deployed in step 6. You should see a "Hello world" message and some data from the database. The database records have been accessed using Integrated Security from a Fargate container running on Linux.


## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

