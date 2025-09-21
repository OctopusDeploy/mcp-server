/* eslint-disable @typescript-eslint/no-empty-object-type */
import { type NamedResource, type SpaceScopedResource, type ResourceWithSlug } from "./baseResource.js";
import { type TenantedDeploymentMode } from "@octopusdeploy/api-client";

export enum AccountType {
    None = "None",
    UsernamePassword = "UsernamePassword",
    Token = "Token",
    SshKeyPair = "SshKeyPair",
    AzureSubscription = "AzureSubscription",
    AzureServicePrincipal = "AzureServicePrincipal",
    AzureManagementCertificate = "AzureManagementCertificate",
    AzureOidc = "AzureOidc",
    AmazonWebServicesAccount = "AmazonWebServicesAccount",
    AmazonWebServicesOidcAccount = "AmazonWebServicesOidcAccount",
    GoogleCloudAccount = "GoogleCloudAccount",
    GenericOidcAccount = "GenericOidcAccount",
}

interface AccountResourceLinks {
    Self: string;
    Usages: string;
}

export interface BaseAccountResource extends ResourceWithSlug {
    Id: string;
    Name: string;
    Description: string;
    AccountType: AccountType;
}

export interface AccountResource extends BaseAccountResource, NamedResource<AccountResourceLinks>, SpaceScopedResource {
    EnvironmentIds: string[];
    TenantIds: string[];
    TenantTags: string[];
    TenantedDeploymentParticipation: TenantedDeploymentMode;
}

export interface AzureServicePrincipalAccountResource extends AccountResource {
    SubscriptionNumber: string;
    ClientId: string;
    TenantId: string;
    AzureEnvironment: string;
    ResourceManagementEndpointBaseUri: string;
    ActiveDirectoryEndpointBaseUri: string;
}

export interface AzureOidcAccountResource extends AccountResource {
    SubscriptionNumber: string;
    ClientId: string;
    TenantId: string;
    AzureEnvironment: string;
    TenantedSubjectGeneration: boolean;
    ResourceManagementEndpointBaseUri: string;
    ActiveDirectoryEndpointBaseUri: string;
    DeploymentSubjectKeys: string[];
    HealthCheckSubjectKeys: string[];
    AccountTestSubjectKeys: string[];
    Audience: string;
    CustomClaims: Record<string, string>;
}

export interface AzureSubscriptionAccountResource extends AccountResource {
    SubscriptionNumber: string;
    CertificateThumbprint: string;
    AzureEnvironment: string;
    ServiceManagementEndpointBaseUri: string;
    ServiceManagementEndpointSuffix: string;
}

export interface GenericOidcAccountResource extends AccountResource {
    TenantedSubjectGeneration: boolean;
    DeploymentSubjectKeys: string[];
    HealthCheckSubjectKeys: string[];
    AccountTestSubjectKeys: string[];
    Audience: string;
    CustomClaims: Record<string, string>;
}

export interface SshKeyPairAccountResource extends AccountResource {
    Username: string;
}

export interface UsernamePasswordAccountResource extends AccountResource {
    Username: string;
}

export interface TokenAccountResource extends AccountResource {
}

export interface AmazonWebServicesAccessKeyAccountResource extends AccountResource {
    AccessKey: string;
}

export interface AmazonWebServicesOidcAccountResource extends AccountResource {
    RoleArn: string;
    SessionDuration: string;
    DeploymentSubjectKeys: string[];
    HealthCheckSubjectKeys: string[];
    AccountTestSubjectKeys: string[];
    CustomClaims: Record<string, string>;
}

export interface GoogleCloudAccountResource extends AccountResource {
}

export function mapAccountResource(account: AccountResource) {
  const baseAccount = {
    spaceId: account.SpaceId,
    id: account.Id,
    name: account.Name,
    description: account.Description,
    slug: account.Slug,
    accountType: account.AccountType,
    environmentIds: account.EnvironmentIds,
    tenantIds: account.TenantIds,
    tenantTags: account.TenantTags,
    tenantedDeploymentParticipation: account.TenantedDeploymentParticipation,
  };

  // Add type-specific properties based on AccountType
  switch (account.AccountType) {
    case AccountType.AzureSubscription: {
      const azureAccount = account as AzureSubscriptionAccountResource;
      return {
        ...baseAccount,
        subscriptionNumber: azureAccount.SubscriptionNumber,
        certificateThumbprint: azureAccount.CertificateThumbprint,
        azureEnvironment: azureAccount.AzureEnvironment,
        serviceManagementEndpointBaseUri: azureAccount.ServiceManagementEndpointBaseUri,
        serviceManagementEndpointSuffix: azureAccount.ServiceManagementEndpointSuffix,
      };
    }

    case AccountType.AzureServicePrincipal: {
      const azureAccount = account as AzureServicePrincipalAccountResource;
      return {
        ...baseAccount,
        subscriptionNumber: azureAccount.SubscriptionNumber,
        clientId: azureAccount.ClientId,
        tenantId: azureAccount.TenantId,
        azureEnvironment: azureAccount.AzureEnvironment,
        resourceManagementEndpointBaseUri: azureAccount.ResourceManagementEndpointBaseUri,
        activeDirectoryEndpointBaseUri: azureAccount.ActiveDirectoryEndpointBaseUri,
      };
    }

    case AccountType.AzureOidc: {
      const azureAccount = account as AzureOidcAccountResource;
      return {
        ...baseAccount,
        subscriptionNumber: azureAccount.SubscriptionNumber,
        clientId: azureAccount.ClientId,
        tenantId: azureAccount.TenantId,
        azureEnvironment: azureAccount.AzureEnvironment,
        tenantedSubjectGeneration: azureAccount.TenantedSubjectGeneration,
        resourceManagementEndpointBaseUri: azureAccount.ResourceManagementEndpointBaseUri,
        activeDirectoryEndpointBaseUri: azureAccount.ActiveDirectoryEndpointBaseUri,
        deploymentSubjectKeys: azureAccount.DeploymentSubjectKeys,
        healthCheckSubjectKeys: azureAccount.HealthCheckSubjectKeys,
        accountTestSubjectKeys: azureAccount.AccountTestSubjectKeys,
        audience: azureAccount.Audience,
        customClaims: azureAccount.CustomClaims,
      };
    }

    case AccountType.SshKeyPair: {
      const sshAccount = account as SshKeyPairAccountResource;
      return {
        ...baseAccount,
        username: sshAccount.Username,
      };
    }

    case AccountType.UsernamePassword: {
      const userPassAccount = account as UsernamePasswordAccountResource;
      return {
        ...baseAccount,
        username: userPassAccount.Username,
      };
    }

    case AccountType.AmazonWebServicesAccount: {
      const awsAccount = account as AmazonWebServicesAccessKeyAccountResource;
      return {
        ...baseAccount,
        accessKey: awsAccount.AccessKey,
      };
    }

    case AccountType.AmazonWebServicesOidcAccount: {
      const awsOidcAccount = account as AmazonWebServicesOidcAccountResource;
      return {
        ...baseAccount,
        roleArn: awsOidcAccount.RoleArn,
        sessionDuration: awsOidcAccount.SessionDuration,
        deploymentSubjectKeys: awsOidcAccount.DeploymentSubjectKeys,
        healthCheckSubjectKeys: awsOidcAccount.HealthCheckSubjectKeys,
        accountTestSubjectKeys: awsOidcAccount.AccountTestSubjectKeys,
        customClaims: awsOidcAccount.CustomClaims,
      };
    }

    case AccountType.GenericOidcAccount: {
      const genericOidcAccount = account as GenericOidcAccountResource;
      return {
        ...baseAccount,
        tenantedSubjectGeneration: genericOidcAccount.TenantedSubjectGeneration,
        deploymentSubjectKeys: genericOidcAccount.DeploymentSubjectKeys,
        healthCheckSubjectKeys: genericOidcAccount.HealthCheckSubjectKeys,
        accountTestSubjectKeys: genericOidcAccount.AccountTestSubjectKeys,
        audience: genericOidcAccount.Audience,
        customClaims: genericOidcAccount.CustomClaims,
      };
    }

    case AccountType.Token:
    case AccountType.GoogleCloudAccount:
    case AccountType.None:
    default:
      return baseAccount;
  }
}
