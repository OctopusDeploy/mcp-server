import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { dispatchOctopusUri } from "../dispatch.js";
import {
  RESOURCE_REGISTRY,
  registerResourceDescriptor,
  type ResourceDescriptor,
} from "../../types/resourceConfig.js";
import { setActiveToolsetConfig } from "../../helpers/activeToolsetConfig.js";

/**
 * Tests target the dispatch + registry contract in isolation:
 *   1. the right descriptor is picked for a URI,
 *   2. variables reach the descriptor's `read` callback URL-decoded,
 *   3. unmatched URIs fall through cleanly without invoking any descriptor.
 *
 * Synthetic descriptors are registered per-test so the live release descriptor
 * (registered via side-effect import in src/resources/index.ts) stays out of
 * the picture — the file is never imported here.
 */

function makeDescriptor(
  overrides: Partial<ResourceDescriptor> & Pick<ResourceDescriptor, "name" | "uriTemplate">,
): ResourceDescriptor {
  return {
    toolset: "releases",
    title: overrides.name,
    description: overrides.name,
    mimeType: "application/json",
    read: vi.fn(async (vars) => ({
      mimeType: "application/json",
      text: JSON.stringify(vars),
    })),
    ...overrides,
  };
}

describe("dispatchOctopusUri", () => {
  beforeEach(() => {
    // The registry is module-level; reset between tests so each starts clean.
    RESOURCE_REGISTRY.length = 0;
  });

  it("routes a URI to the descriptor whose template matches and surfaces parsed variables", async () => {
    const releaseDescriptor = makeDescriptor({
      name: "release",
      uriTemplate: "octopus://spaces/{spaceName}/releases/{releaseId}",
    });
    const taskLogDescriptor = makeDescriptor({
      name: "task-log",
      uriTemplate: "octopus://spaces/{spaceName}/tasks/{taskId}/log",
    });
    registerResourceDescriptor(releaseDescriptor);
    registerResourceDescriptor(taskLogDescriptor);

    const payload = await dispatchOctopusUri(
      "octopus://spaces/Default/releases/Releases-42",
    );

    expect(payload).not.toBeNull();
    expect(JSON.parse(payload!.text)).toEqual({
      spaceName: "Default",
      releaseId: "Releases-42",
    });
    expect(releaseDescriptor.read).toHaveBeenCalledTimes(1);
    expect(taskLogDescriptor.read).not.toHaveBeenCalled();
  });

  it("URL-decodes percent-encoded variables before passing them to the descriptor", async () => {
    // Regression: the SDK's UriTemplate.match returns raw regex captures with
    // no decoding, so a space-name like "AI Foundations" arrives percent-encoded
    // and must be decoded before it reaches the Octopus API.
    const descriptor = makeDescriptor({
      name: "release",
      uriTemplate: "octopus://spaces/{spaceName}/releases/{releaseId}",
    });
    registerResourceDescriptor(descriptor);

    await dispatchOctopusUri(
      "octopus://spaces/AI%20Foundations/releases/Releases-1397446",
    );

    expect(descriptor.read).toHaveBeenCalledWith({
      spaceName: "AI Foundations",
      releaseId: "Releases-1397446",
    });
  });

  it("falls back to the raw value when a variable contains an invalid percent-escape", async () => {
    // decodeURIComponent throws on malformed input like "100%off" — the dispatcher
    // surfaces the raw value rather than crashing, letting the API produce a clearer
    // downstream error.
    const descriptor = makeDescriptor({
      name: "release",
      uriTemplate: "octopus://spaces/{spaceName}/releases/{releaseId}",
    });
    registerResourceDescriptor(descriptor);

    await dispatchOctopusUri(
      "octopus://spaces/Default/releases/Releases-100%off",
    );

    expect(descriptor.read).toHaveBeenCalledWith({
      spaceName: "Default",
      releaseId: "Releases-100%off",
    });
  });

  it("returns null for an octopus:// URI that no descriptor matches and invokes no read callback", async () => {
    const descriptor = makeDescriptor({
      name: "release",
      uriTemplate: "octopus://spaces/{spaceName}/releases/{releaseId}",
    });
    registerResourceDescriptor(descriptor);

    const payload = await dispatchOctopusUri(
      "octopus://spaces/Default/projects/Projects-1/deployment-process",
    );

    expect(payload).toBeNull();
    expect(descriptor.read).not.toHaveBeenCalled();
  });

  it("returns null for non-octopus:// URIs without consulting any descriptor", async () => {
    const descriptor = makeDescriptor({
      name: "release",
      uriTemplate: "octopus://spaces/{spaceName}/releases/{releaseId}",
    });
    registerResourceDescriptor(descriptor);

    expect(await dispatchOctopusUri("https://example.com/foo")).toBeNull();
    expect(await dispatchOctopusUri("not-a-uri")).toBeNull();
    expect(descriptor.read).not.toHaveBeenCalled();
  });

  describe("toolset filtering", () => {
    afterEach(() => {
      // Reset to "all enabled" so other test files aren't affected by leaked state.
      setActiveToolsetConfig({});
    });

    it("skips a descriptor whose toolset is not enabled, so read_resource cannot bypass --toolsets filtering by URI guess", async () => {
      const featureToggleDescriptor = makeDescriptor({
        name: "featureToggle",
        toolset: "featureToggles",
        uriTemplate:
          "octopus://spaces/{spaceName}/projects/{projectId}/featuretoggles/{slug}",
      });
      registerResourceDescriptor(featureToggleDescriptor);

      // Session enabled `projects` but NOT `featureToggles`.
      setActiveToolsetConfig({ enabledToolsets: ["projects"] });

      const payload = await dispatchOctopusUri(
        "octopus://spaces/Default/projects/Projects-123/featuretoggles/checkout",
      );

      expect(payload).toBeNull();
      expect(featureToggleDescriptor.read).not.toHaveBeenCalled();
    });

    it("invokes a descriptor when its toolset IS enabled", async () => {
      const featureToggleDescriptor = makeDescriptor({
        name: "featureToggle",
        toolset: "featureToggles",
        uriTemplate:
          "octopus://spaces/{spaceName}/projects/{projectId}/featuretoggles/{slug}",
      });
      registerResourceDescriptor(featureToggleDescriptor);

      setActiveToolsetConfig({ enabledToolsets: ["featureToggles"] });

      const payload = await dispatchOctopusUri(
        "octopus://spaces/Default/projects/Projects-123/featuretoggles/checkout",
      );

      expect(payload).not.toBeNull();
      expect(featureToggleDescriptor.read).toHaveBeenCalledTimes(1);
    });

    it("always allows core descriptors regardless of enabledToolsets", async () => {
      const coreDescriptor = makeDescriptor({
        name: "catalog",
        toolset: "core",
        uriTemplate: "octopus://api/llms.txt",
      });
      registerResourceDescriptor(coreDescriptor);

      // No toolsets enabled; core should still resolve.
      setActiveToolsetConfig({ enabledToolsets: [] });

      const payload = await dispatchOctopusUri("octopus://api/llms.txt");
      expect(payload).not.toBeNull();
      expect(coreDescriptor.read).toHaveBeenCalledTimes(1);
    });
  });
});
