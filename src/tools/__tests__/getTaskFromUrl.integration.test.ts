import { describe, it, expect } from 'vitest';
import { testConfig, validateTestEnvironment } from './testSetup.js';
import { Client } from '@octopusdeploy/api-client';
import { getTaskFromUrl } from '../getTaskFromUrl.js';

describe('getTaskFromUrl Integration Tests', () => {
  validateTestEnvironment();

  describe('Successful scenarios', () => {
    it('should get task details from valid task URL', async () => {
      if (!process.env.TEST_TASK_URL) {
        console.warn('TEST_TASK_URL not set, skipping test');
        return;
      }

      const client = await Client.create({
        apiKey: testConfig.octopusApiKey!,
        instanceURL: testConfig.octopusServerUrl!,
      });

      const result = await getTaskFromUrl(client, {
        url: process.env.TEST_TASK_URL
      });

      // Verify task structure
      expect(result.task).toBeDefined();
      expect(result.task.Id).toBeDefined();
      expect(result.task.Id).toMatch(/^ServerTasks-\d+$/);
      expect(result.task.Name).toBeDefined();
      expect(result.task.State).toBeDefined();

      // Verify resolved information
      expect(result.resolvedSpaceName).toBeDefined();
      expect(result.resolvedTaskId).toBeDefined();

      // Verify URL info
      expect(result.urlInfo).toBeDefined();
      expect(result.urlInfo.originalUrl).toBe(process.env.TEST_TASK_URL);
      expect(result.urlInfo.extractedSpaceId).toBeDefined();
    }, testConfig.timeout);

  });

  describe('Error scenarios', () => {
    it('should throw error for invalid task ID', async () => {
      const client = await Client.create({
        apiKey: testConfig.octopusApiKey!,
        instanceURL: testConfig.octopusServerUrl!,
      });

      const invalidUrl = `${testConfig.octopusServerUrl}/app#/Spaces-1/tasks/ServerTasks-99999999`;

      await expect(
        getTaskFromUrl(client, { url: invalidUrl })
      ).rejects.toThrow();
    }, testConfig.timeout);

    it('should throw error for malformed URL', async () => {
      const client = await Client.create({
        apiKey: testConfig.octopusApiKey!,
        instanceURL: testConfig.octopusServerUrl!,
      });

      await expect(
        getTaskFromUrl(client, { url: 'not-a-valid-url' })
      ).rejects.toThrow();
    }, testConfig.timeout);

    it('should throw error for URL without task or deployment ID', async () => {
      const client = await Client.create({
        apiKey: testConfig.octopusApiKey!,
        instanceURL: testConfig.octopusServerUrl!,
      });

      const urlWithoutIds = `${testConfig.octopusServerUrl}/app#/Spaces-1/projects/test`;

      await expect(
        getTaskFromUrl(client, { url: urlWithoutIds })
      ).rejects.toThrow(/Could not extract task ID from URL/);
    }, testConfig.timeout);

    it('should throw error for invalid task ID format', async () => {
      const client = await Client.create({
        apiKey: testConfig.octopusApiKey!,
        instanceURL: testConfig.octopusServerUrl!,
      });

      const urlWithInvalidFormat = `${testConfig.octopusServerUrl}/app#/Spaces-1/tasks/InvalidTask-123`;

      await expect(
        getTaskFromUrl(client, { url: urlWithInvalidFormat })
      ).rejects.toThrow(/Could not extract task ID from URL/);
    }, testConfig.timeout);

    it('should throw error when given deployment URL instead of task URL', async () => {
      const client = await Client.create({
        apiKey: testConfig.octopusApiKey!,
        instanceURL: testConfig.octopusServerUrl!,
      });

      const deploymentUrl = `${testConfig.octopusServerUrl}/app#/Spaces-1/projects/test/deployments/Deployments-123`;

      await expect(
        getTaskFromUrl(client, { url: deploymentUrl })
      ).rejects.toThrow(/Could not extract task ID from URL/);
    }, testConfig.timeout);
  });
});
