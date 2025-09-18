import { type ResourceWithId, type SpaceScopedResource } from "./baseResource.js";
import { type SensitiveValue, type TenantedDeploymentMode } from "@octopusdeploy/api-client";

export enum CertificateDataFormat {
  Pkcs12 = "Pkcs12",
  Pem = "Pem",
}

export enum SelfSignedCertificateCurve {
  P256 = "P256",
  P384 = "P384",
  P521 = "P521",
}

export interface Certificate {
  SubjectDistinguishedName?: string;
  IssuerDistinguishedName?: string;
  Thumbprint?: string;
  NotAfter?: string;
  NotBefore?: string;
  Version?: number;
  SerialNumber?: string;
  SignatureAlgorithmName?: string;
  IsExpired?: boolean;
}

export interface CertificateResource extends ResourceWithId, Certificate, SpaceScopedResource {
  Name: string;
  Notes?: string;
  CertificateData: SensitiveValue;
  Password: SensitiveValue;
  EnvironmentIds: string[];
  TenantIds: string[];
  TenantTags: string[];
  CertificateDataFormat?: CertificateDataFormat;
  Archived?: string;
  ReplacedBy?: string;
  SubjectCommonName?: string;
  SubjectOrganization?: string;
  IssuerCommonName?: string;
  IssuerOrganization?: string;
  SelfSigned?: boolean;
  SelfSignedCertificateCurve?: SelfSignedCertificateCurve;
  HasPrivateKey?: boolean;
  TenantedDeploymentParticipation?: TenantedDeploymentMode;
  SubjectAlternativeNames?: string[];
}

export function mapCertificateResource(cert: CertificateResource) {
  return {
    spaceId: cert.SpaceId,
    id: cert.Id,
    name: cert.Name,
    notes: cert.Notes,
    thumbprint: cert.Thumbprint,
    subjectDistinguishedName: cert.SubjectDistinguishedName,
    issuerDistinguishedName: cert.IssuerDistinguishedName,
    subjectCommonName: cert.SubjectCommonName,
    subjectOrganization: cert.SubjectOrganization,
    issuerCommonName: cert.IssuerCommonName,
    issuerOrganization: cert.IssuerOrganization,
    notAfter: cert.NotAfter,
    notBefore: cert.NotBefore,
    isExpired: cert.IsExpired,
    version: cert.Version,
    serialNumber: cert.SerialNumber,
    signatureAlgorithmName: cert.SignatureAlgorithmName,
    environmentIds: cert.EnvironmentIds,
    tenantIds: cert.TenantIds,
    tenantTags: cert.TenantTags,
    certificateDataFormat: cert.CertificateDataFormat,
    archived: cert.Archived,
    replacedBy: cert.ReplacedBy,
    selfSigned: cert.SelfSigned,
    selfSignedCertificateCurve: cert.SelfSignedCertificateCurve,
    hasPrivateKey: cert.HasPrivateKey,
    tenantedDeploymentParticipation: cert.TenantedDeploymentParticipation,
    subjectAlternativeNames: cert.SubjectAlternativeNames,
  };
}