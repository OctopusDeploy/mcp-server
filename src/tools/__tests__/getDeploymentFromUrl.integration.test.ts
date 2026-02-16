import { describe, it, expect } from 'vitest';
import { testConfig, validateTestEnvironment } from './testSetup.js';
import { Client } from '@octopusdeploy/api-client';
import { getDeploymentFromUrl } from '../getDeploymentFromUrl.js';

describe('getDeploymentFromUrl Integration Tests', () => {
  validateTestEnvironment();

  describe('Successful scenarios', () => {
    it('should get deployment details from valid deployment URL', async () => {
      if (!process.env.TEST_DEPLOYMENT_URL) {
        console.warn('TEST_DEPLOYMENT_URL not set, skipping test');
        return;
      }

      const client = await Client.create({
        apiKey: testConfig.octopusApiKey!,
        instanceURL: testConfig.octopusServerUrl!,
      });

      const result = await getDeploymentFromUrl(client, {
        url: process.env.TEST_DEPLOYMENT_URL
      });

      // Verify deployment structure
      expect(result.deployment).toBeDefined();
      expect(result.deployment.id).toBeDefined();
      expect(result.deployment.id).toMatch(/^Deployments-\d+$/);
      expect(result.deployment.name).toBeDefined();
      expect(result.deployment.taskId).toBeDefined();
      expect(result.deployment.environmentId).toBeDefined();
      expect(result.deployment.projectId).toBeDefined();
      expect(result.deployment.releaseId).toBeDefined();

      // Verify resolved information
      expect(result.resolvedSpaceName).toBeDefined();
      expect(result.resolvedDeploymentId).toBeDefined();
      expect(result.taskIdForLogs).toBeDefined();

      // Verify URL info
      expect(result.urlInfo).toBeDefined();
      expect(result.urlInfo.originalUrl).toBe(process.env.TEST_DEPLOYMENT_URL);
      expect(result.urlInfo.extractedSpaceId).toBeDefined();
      expect(result.urlInfo.extractedDeploymentId).toBeDefined();

      // Verify next steps guidance
      expect(result.nextSteps).toBeDefined();
      expect(result.nextSteps.suggestedTool).toBe('get_task_details');
    }, testConfig.timeout);
  });

  describe('Error scenarios', () => {
    it('should throw error for invalid deployment ID', async () => {
      const client = await Client.create({
        apiKey: testConfig.octopusApiKey!,
        instanceURL: testConfig.octopusServerUrl!,
      });

      const invalidUrl = `${testConfig.octopusServerUrl}/app#/Spaces-1/projects/test/deployments/Deployments-99999999`;

      await expect(
        getDeploymentFromUrl(client, { url: invalidUrl })
      ).rejects.toThrow();
    }, testConfig.timeout);

    it('should throw error for malformed URL', async () => {
      const client = await Client.create({
        apiKey: testConfig.octopusApiKey!,
        instanceURL: testConfig.octopusServerUrl!,
      });

      await expect(
        getDeploymentFromUrl(client, { url: 'not-a-valid-url' })
      ).rejects.toThrow();
    }, testConfig.timeout);

    it('should throw error for URL without deployment ID', async () => {
      const client = await Client.create({
        apiKey: testConfig.octopusApiKey!,
        instanceURL: testConfig.octopusServerUrl!,
      });

      const urlWithoutDeployment = `${testConfig.octopusServerUrl}/app#/Spaces-1/projects/test`;

      await expect(
        getDeploymentFromUrl(client, { url: urlWithoutDeployment })
      ).rejects.toThrow(/Could not extract deployment ID/);
    }, testConfig.timeout);

    it('should throw error for invalid deployment ID format', async () => {
      const client = await Client.create({
        apiKey: testConfig.octopusApiKey!,
        instanceURL: testConfig.octopusServerUrl!,
      });

      const urlWithInvalidFormat = `${testConfig.octopusServerUrl}/app#/Spaces-1/projects/test/deployments/InvalidId-123`;

      await expect(
        getDeploymentFromUrl(client, { url: urlWithInvalidFormat })
      ).rejects.toThrow(/Could not extract deployment ID/);
    }, testConfig.timeout);
  });
});
