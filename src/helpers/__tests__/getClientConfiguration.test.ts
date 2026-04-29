import { describe, it, expect } from "vitest";
import { getClientConfiguration } from "../getClientConfigurationFromEnvironment.js";

describe("getClientConfiguration", () => {
  describe("validation", () => {
    it("throws when instanceURL is missing", () => {
      expect(() =>
        getClientConfiguration({ apiKey: "API-KEY" }),
      ).toThrowError(/Octopus server URL must be provided/);
    });

    it("throws when instanceURL is an empty string", () => {
      expect(() =>
        getClientConfiguration({ instanceURL: "", apiKey: "API-KEY" }),
      ).toThrowError(/Octopus server URL must be provided/);
    });

    it("throws when instanceURL is whitespace only", () => {
      expect(() =>
        getClientConfiguration({ instanceURL: "   ", apiKey: "API-KEY" }),
      ).toThrowError(/Octopus server URL must be provided/);
    });

    it("throws when both apiKey and accessToken are missing", () => {
      expect(() =>
        getClientConfiguration({ instanceURL: "https://octopus.example.com" }),
      ).toThrowError(/OCTOPUS_API_KEY or OCTOPUS_ACCESS_TOKEN/);
    });

    it("throws when both credentials are empty strings", () => {
      expect(() =>
        getClientConfiguration({
          instanceURL: "https://octopus.example.com",
          apiKey: "",
          accessToken: "",
        }),
      ).toThrowError(/OCTOPUS_API_KEY or OCTOPUS_ACCESS_TOKEN/);
    });

    it("throws when both credentials are whitespace only", () => {
      expect(() =>
        getClientConfiguration({
          instanceURL: "https://octopus.example.com",
          apiKey: "   ",
          accessToken: "\t\n",
        }),
      ).toThrowError(/OCTOPUS_API_KEY or OCTOPUS_ACCESS_TOKEN/);
    });
  });

  describe("API key auth", () => {
    it("returns config with apiKey when only apiKey provided", () => {
      const config = getClientConfiguration({
        instanceURL: "https://octopus.example.com",
        apiKey: "API-XXXX",
      });

      expect(config.instanceURL).toBe("https://octopus.example.com");
      expect(config.apiKey).toBe("API-XXXX");
      expect(config.accessToken).toBeUndefined();
    });

    it("returns config with apiKey when accessToken is empty", () => {
      const config = getClientConfiguration({
        instanceURL: "https://octopus.example.com",
        apiKey: "API-XXXX",
        accessToken: "",
      });

      expect(config.apiKey).toBe("API-XXXX");
      expect(config.accessToken).toBeUndefined();
    });
  });

  describe("access token auth", () => {
    it("returns config with accessToken when only accessToken provided", () => {
      const config = getClientConfiguration({
        instanceURL: "https://octopus.example.com",
        accessToken: "Bearer-Token-Value",
      });

      expect(config.instanceURL).toBe("https://octopus.example.com");
      expect(config.accessToken).toBe("Bearer-Token-Value");
      expect(config.apiKey).toBeUndefined();
    });

    it("returns config with accessToken when apiKey is empty", () => {
      const config = getClientConfiguration({
        instanceURL: "https://octopus.example.com",
        apiKey: "",
        accessToken: "Bearer-Token-Value",
      });

      expect(config.accessToken).toBe("Bearer-Token-Value");
      expect(config.apiKey).toBeUndefined();
    });
  });

  describe("precedence", () => {
    it("uses access token over API key when both are provided", () => {
      const config = getClientConfiguration({
        instanceURL: "https://octopus.example.com",
        apiKey: "API-XXXX",
        accessToken: "Bearer-Token-Value",
      });

      expect(config.accessToken).toBe("Bearer-Token-Value");
      expect(config.apiKey).toBeUndefined();
    });
  });

  describe("user agent", () => {
    it("sets userAgentApp on the returned config", () => {
      const config = getClientConfiguration({
        instanceURL: "https://octopus.example.com",
        apiKey: "API-XXXX",
      });

      expect(config.userAgentApp).toMatch(/^octopus-mcp-server\//);
    });
  });
});
