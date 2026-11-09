/**
 * Regression tests: the client-side approval gate must honour the annotation
 * key convention of the descriptor it is given.
 *
 * apcore-js `Registry.getDefinition()` returns descriptors whose
 * `annotations` are camelCase (`requiresApproval`), while descriptors built by
 * the CLI itself / toolkit scans use snake_case (`requires_approval`). Before
 * the fix, only the snake_case spelling was read, so a real apcore-js module
 * declaring `requiresApproval: true` executed without a prompt.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkApproval } from "../src/approval.js";
import { ApprovalDeniedError } from "../src/errors.js";
import type { ModuleDescriptor } from "../src/cli.js";

/** Descriptor shaped like apcore-js `ModuleDescriptor` (no top-level requiresApproval). */
function realDescriptor(annotations: object): ModuleDescriptor {
  return {
    moduleId: "test.mod",
    name: "test.mod",
    description: "Real apcore-js descriptor shape",
    annotations,
  } as unknown as ModuleDescriptor;
}

describe("checkApproval — annotation key conventions", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.APCORE_CLI_AUTO_APPROVE;
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("prompts for camelCase annotations (in-memory apcore-js descriptor)", async () => {
    await expect(checkApproval(realDescriptor({ requiresApproval: true }), false)).rejects.toBeInstanceOf(
      ApprovalDeniedError,
    );
  });

  it("prompts for snake_case annotations (JSON / toolkit descriptor)", async () => {
    await expect(checkApproval(realDescriptor({ requires_approval: true }), false)).rejects.toBeInstanceOf(
      ApprovalDeniedError,
    );
  });

  it("stays silent when the annotation is false in either convention", async () => {
    await expect(checkApproval(realDescriptor({ requiresApproval: false }), false)).resolves.toBeUndefined();
    await expect(checkApproval(realDescriptor({ requires_approval: false }), false)).resolves.toBeUndefined();
  });

  it("stays silent when the descriptor carries no annotations", async () => {
    await expect(checkApproval(realDescriptor({}), false)).resolves.toBeUndefined();
  });
});
