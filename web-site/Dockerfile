# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

# https://hub.docker.com/_/microsoft-dotnet-core

ARG ASPNETCORE_ENVIRONMENT=Development_AWS
ARG HTTP_PORT=80

FROM mcr.microsoft.com/dotnet/core/sdk:3.1 AS build
WORKDIR /source

# Copy csproj and restore as distinct layers
COPY ./web-site.sln ./
COPY ./web-site.csproj ./
RUN dotnet restore

# Copy everything else and build
COPY ./ ./

# Uncomment this to verify the build file structure.
#RUN find .

WORKDIR /source
RUN dotnet publish -c Debug -o /app --no-restore

# final stage/image
FROM mcr.microsoft.com/dotnet/core/aspnet:3.1
WORKDIR /app
COPY --from=build /app ./

# ARG and FROM interact in weird ways.
# https://docs.docker.com/engine/reference/builder/#understand-how-arg-and-from-interact
# An ARG declared before a FROM is outside of a build stage, so it can’t be used in any 
# instruction after a FROM. To use the default value of an ARG declared before the first
# FROM use an ARG instruction without a value inside of a build stage.

ARG ASPNETCORE_ENVIRONMENT
ARG HTTP_PORT

ENV ASPNETCORE_ENVIRONMENT $ASPNETCORE_ENVIRONMENT
ENV ASPNETCORE_URLS=http://*:$HTTP_PORT


# Kerberos setup.
RUN apt update
RUN apt install -y krb5-config krb5-user 
COPY krb5.conf /etc/krb5.conf
VOLUME ["/var/scratch"]

COPY ./container-start.sh ./
RUN chmod +x container-start.sh

#RUN find .

CMD ["./container-start.sh"]