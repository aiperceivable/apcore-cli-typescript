/**
 * Tests for the annotation accessor.
 *
 * Regression context: apcore-js keeps annotations camelCase in memory
 * (`DEFAULT_ANNOTATIONS` in `apcore-js/dist/module.js`) and snake_case on the
 * wire (PROTOCOL_SPEC §4.4.1). The CLI read only snake_case, so a module
 * declaring `annotations.requiresApproval: true` skipped the client-side
 * approval gate. `getAnnotation` now resolves either spelling.
 */

import { describe, it, expect } from "vitest";
import { getAnnotation } from "../src/annotations.js";

describe("getAnnotation", () => {
  it("reads camelCase keys (in-memory apcore-js ModuleAnnotations)", () => {
    expect(getAnnotation({ requiresApproval: true }, "requires_approval", false)).toBe(true);
    expect(getAnnotation({ requiresApproval: true }, "requiresApproval", false)).toBe(true);
  });

  it("reads snake_case keys (JSON wire / toolkit descriptors)", () => {
    expect(getAnnotation({ requires_approval: true }, "requiresApproval", false)).toBe(true);
    expect(getAnnotation({ requires_approval: true }, "requires_approval", false)).toBe(true);
  });

  it("reads the CLI flag spelling", () => {
    expect(getAnnotation({ requiresApproval: true }, "requires-approval", false)).toBe(true);
    expect(getAnnotation({ requires_approval: true }, "requires-approval", false)).toBe(true);
  });

  it("resolves multi-word keys across conventions", () => {
    expect(getAnnotation({ cacheTtl: 30 }, "cache_ttl")).toBe(30);
    expect(getAnnotation({ cache_ttl: 30 }, "cacheTtl")).toBe(30);
    expect(getAnnotation({ paginationStyle: "cursor" }, "pagination_style")).toBe("cursor");
  });

  it("falls back to the extra bag", () => {
    expect(getAnnotation({ extra: { approval_message: "Confirm" } }, "approval_message")).toBe("Confirm");
    expect(getAnnotation({ extra: { approvalMessage: "Confirm" } }, "approval_message")).toBe("Confirm");
  });

  it("prefers a top-level key over extra", () => {
    const bag = { approval_message: "top", extra: { approval_message: "nested" } };
    expect(getAnnotation(bag, "approval_message")).toBe("top");
  });

  it("returns the default for null, undefined, non-object and empty bags", () => {
    expect(getAnnotation(null, "requires_approval", false)).toBe(false);
    expect(getAnnotation(undefined, "requires_approval", false)).toBe(false);
    expect(getAnnotation("not-a-bag", "requires_approval", false)).toBe(false);
    expect(getAnnotation({}, "requires_approval", false)).toBe(false);
  });

  it("does not mistake a falsy annotation value for a miss", () => {
    expect(getAnnotation({ requiresApproval: false }, "requires_approval", true)).toBe(false);
    expect(getAnnotation({ cacheTtl: 0 }, "cache_ttl", 99)).toBe(0);
  });

  it("reads own properties of class instances", () => {
    class Annotations {
      requiresApproval = true;
    }
    expect(getAnnotation(new Annotations(), "requiresApproval", false)).toBe(true);
    expect(getAnnotation(new Annotations(), "requires_approval", false)).toBe(true);
  });
});
