import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createScannedModule, OpenAPIScanner } from "apcore-toolkit";
import { describe, expect, it } from "vitest";

import { detectEffectiveProxyHazards, effectiveHazardToWire } from "../../src/index.js";

interface FixtureCase {
  id: string;
  module: {
    module_id: string;
    input_schema: Record<string, unknown>;
    metadata: Record<string, unknown>;
  };
  expected: unknown[];
}

interface DocumentCase {
  id: string;
  document: Record<string, unknown>;
  include?: string;
  expected: {
    modules: {
      id: string;
      properties?: Record<string, unknown>;
      required?: string[];
      output_schema?: Record<string, unknown>;
    }[];
    diagnostics: unknown[];
  };
}

const repoRoot = process.env.APCORE_CLI_SPEC_REPO
  ?? fileURLToPath(new URL("../../../apcore-cli", import.meta.url));
const fixturePath = path.join(repoRoot, "conformance/fixtures/openapi_effective_hazards.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { version: number; cases: FixtureCase[] };

describe("conformance — effective OpenAPI proxy diagnostic JSON", () => {
  it("uses the version 1 fixture", () => expect(fixture.version).toBe(1));

  for (const testCase of fixture.cases) {
    it(testCase.id, () => {
      const input = testCase.module;
      const module = createScannedModule({
        moduleId: input.module_id,
        inputSchema: input.input_schema,
        metadata: input.metadata,
        description: "",
        outputSchema: {},
        tags: [],
        target: "",
      });
      const actual = detectEffectiveProxyHazards([module]).map(effectiveHazardToWire).map(hazard => {
        if (hazard.kind.code !== "invalid_effective_inputs") return hazard;
        expect(hazard.kind.detail.length).toBeGreaterThan(0);
        return { ...hazard, kind: { code: hazard.kind.code } };
      });
      expect(JSON.parse(JSON.stringify(actual))).toEqual(testCase.expected);
    });
  }
});

const documentFixturePath = path.join(repoRoot, "conformance/fixtures/openapi_effective_documents.json");
const documentFixture = JSON.parse(readFileSync(documentFixturePath, "utf8")) as {
  version: number;
  cases: DocumentCase[];
};

describe("conformance — effective OpenAPI document scanning", () => {
  it("uses the version 1 fixture", () => expect(documentFixture.version).toBe(1));

  for (const testCase of documentFixture.cases) {
    it(testCase.id, () => {
      const modules = new OpenAPIScanner().scanWithEffectiveParameters(testCase.document, { include: testCase.include });
      expect(modules.map(module => module.moduleId).sort()).toEqual(testCase.expected.modules.map(module => module.id).sort());

      for (const expected of testCase.expected.modules) {
        const actual = modules.find(module => module.moduleId === expected.id);
        if (!actual) throw new Error(`Expected module ${expected.id}`);
        if (expected.properties !== undefined) expect(actual.inputSchema.properties).toEqual(expected.properties);
        if (expected.required !== undefined) expect(actual.inputSchema.required).toEqual(expected.required);
        if (expected.output_schema !== undefined) expect(actual.outputSchema).toEqual(expected.output_schema);
      }
      expect(detectEffectiveProxyHazards(modules).map(effectiveHazardToWire)).toEqual(testCase.expected.diagnostics);
    });
  }
});
