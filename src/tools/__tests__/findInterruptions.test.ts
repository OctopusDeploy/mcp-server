import { describe, it, expect } from "vitest";
import { interruptionSummary } from "../findInterruptions.js";

const baseInterruption = {
  Id: "Interruptions-1",
  Title: "Manual Intervention Required",
  Type: "ManualIntervention",
  Created: "2026-02-10T23:01:26.205+00:00",
  IsPending: true,
  IsLinkedToOtherInterruption: false,
  CanTakeResponsibility: true,
  HasResponsibility: false,
  TaskId: "ServerTasks-867",
  CorrelationId: "ServerTasks-867_K2CLXQCT9Q/abc/def",
  SpaceId: "Spaces-1",
  ResponsibleTeamIds: [],
  RelatedDocumentIds: [
    "Deployments-41",
    "ServerTasks-867",
    "Projects-21",
    "Environments-3",
  ],
};

// Mirrors the real /api/{spaceId}/interruptions response shape, where Form.Elements
// is an ARRAY of { Name, Control, IsValueRequired }, not a Record/object.
const realFormElements = [
  {
    Name: "Instructions",
    Control: {
      Type: "Paragraph",
      Text: "## Please review the infrastructure changes\n\nproceed to apply.",
      ResolveLinks: false,
    },
    IsValueRequired: false,
  },
  {
    Name: "Notes",
    Control: { Type: "TextArea", Label: "Notes" },
    IsValueRequired: false,
  },
  {
    Name: "Result",
    Control: {
      Type: "SubmitButtonGroup",
      Buttons: [
        { Text: "Abort", Value: "Abort", ButtonType: "Delete" },
        { Text: "Proceed", Value: "Proceed", ButtonType: "Primary" },
      ],
    },
    IsValueRequired: false,
  },
];

describe("interruptionSummary", () => {
  it("extracts formElementNames from the actual array shape (Name field)", () => {
    const summary = interruptionSummary(
      {
        ...baseInterruption,
        Form: { Values: { Instructions: null, Notes: null, Result: null }, Elements: realFormElements },
      },
      "Default",
      "https://octopus.example.com",
    );

    expect(summary.formElementNames).toEqual(["Instructions", "Notes", "Result"]);
  });

  it("never leaks form values, control text, or button labels into the slim summary", () => {
    const summary = interruptionSummary(
      {
        ...baseInterruption,
        Form: {
          Values: { Notes: "secret note value", Result: "Proceed" },
          Elements: realFormElements,
        },
      },
      "Default",
      "https://octopus.example.com",
    );

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("secret note value");
    expect(serialized).not.toContain("Please review the infrastructure changes");
    expect(serialized).not.toContain("Abort");
    expect(serialized).not.toContain("Proceed");
  });

  it("returns an empty array when Form is missing", () => {
    const summary = interruptionSummary(
      baseInterruption,
      "Default",
      "https://octopus.example.com",
    );

    expect(summary.formElementNames).toEqual([]);
  });

  it("returns an empty array when Form.Elements is missing or null", () => {
    const missingElements = interruptionSummary(
      { ...baseInterruption, Form: {} },
      "Default",
      "https://octopus.example.com",
    );
    expect(missingElements.formElementNames).toEqual([]);

    const nullElements = interruptionSummary(
      { ...baseInterruption, Form: { Elements: null } },
      "Default",
      "https://octopus.example.com",
    );
    expect(nullElements.formElementNames).toEqual([]);
  });

  it("builds resourceUri pointing at the interruption itself", () => {
    const summary = interruptionSummary(
      baseInterruption,
      "Default",
      "https://octopus.example.com",
    );

    expect(summary.resourceUri).toBe(
      "octopus://spaces/Default/interruptions/Interruptions-1",
    );
  });

  it("builds taskResourceUri pointing at the surrounding task", () => {
    const summary = interruptionSummary(
      baseInterruption,
      "Default",
      "https://octopus.example.com",
    );

    expect(summary.taskResourceUri).toBe(
      "octopus://spaces/Default/tasks/ServerTasks-867",
    );
  });

  it("URI-encodes spaceName and ids in both resourceUri and taskResourceUri", () => {
    const summary = interruptionSummary(
      { ...baseInterruption, Id: "Interruptions-1/2", TaskId: "ServerTasks-1/2" },
      "Space With/Slash",
      "https://octopus.example.com",
    );

    expect(summary.resourceUri).toBe(
      "octopus://spaces/Space%20With%2FSlash/interruptions/Interruptions-1%2F2",
    );
    expect(summary.taskResourceUri).toBe(
      "octopus://spaces/Space%20With%2FSlash/tasks/ServerTasks-1%2F2",
    );
  });

  it("builds the portal publicUrl from instanceURL, spaceId, and taskId", () => {
    const summary = interruptionSummary(
      baseInterruption,
      "Default",
      "https://octopus.example.com",
    );

    expect(summary.publicUrl).toBe(
      "https://octopus.example.com/app#/Spaces-1/tasks/ServerTasks-867",
    );
  });

  it("surfaces the responsible flags so consumers can tell who can act", () => {
    const summary = interruptionSummary(
      {
        ...baseInterruption,
        ResponsibleUserId: "Users-1",
        HasResponsibility: true,
        CanTakeResponsibility: true,
      },
      "Default",
      "https://octopus.example.com",
    );

    expect(summary.responsible).toEqual({
      teamIds: [],
      userId: "Users-1",
      canTakeResponsibility: true,
      hasResponsibility: true,
    });
  });

  it("surfaces the interruption type and relatedDocumentIds for downstream filtering", () => {
    const summary = interruptionSummary(
      baseInterruption,
      "Default",
      "https://octopus.example.com",
    );

    expect(summary.type).toBe("ManualIntervention");
    expect(summary.relatedDocumentIds).toEqual([
      "Deployments-41",
      "ServerTasks-867",
      "Projects-21",
      "Environments-3",
    ]);
    expect(summary.isLinkedToOtherInterruption).toBe(false);
  });
});
