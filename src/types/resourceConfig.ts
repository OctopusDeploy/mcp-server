import { type Toolset } from "./toolConfig.js";

export interface ResourcePayload {
  mimeType: string;
  text: string;
}

export interface ResourceDescriptor {
  name: string;
  uriTemplate: string;
  toolset: Toolset;
  title: string;
  description: string;
  mimeType: string;
  read: (vars: Record<string, string>) => Promise<ResourcePayload>;
}

export const RESOURCE_REGISTRY: ResourceDescriptor[] = [];

export function registerResourceDescriptor(descriptor: ResourceDescriptor): void {
  RESOURCE_REGISTRY.push(descriptor);
}
