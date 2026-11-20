import { describe, expect, it } from "vitest";
import { HTTPProxyRegistryWriter, OpenAPIScanner } from "apcore-toolkit";
import { detectEffectiveProxyHazards, detectProxyHazards } from "../src/index.js";

const response = { 200: { description: "OK" } };
const id = { name: "id", in: "path", required: true, schema: { type: "string" } };
const query = (name: string) => ({ name, in: "query", schema: { type: "string" } });
const ref = { $ref: "#/components/parameters/Term" };
const spec = {
  openapi: "3.1.0",
  components: { parameters: { Term: query("term") } },
  paths: {
    "/good/{id}": { parameters: [id], get: { operationId: "good", parameters: [ref], responses: response } },
    "/inherited": { parameters: [ref], post: { operationId: "inherited", responses: response } },
    "/same-query/{id}": { get: { operationId: "sameQuery", parameters: [id, query("id")], responses: response } },
    "/same-body/{id}": { post: {
      operationId: "sameBody", parameters: [id], responses: response,
      requestBody: { content: { "application/json": { schema: { properties: { id: { type: "boolean" } } } } } },
    } },
  },
};

describe("detectEffectiveProxyHazards", () => {
  it("reads the same top-level and alias precedence as the proxy writer", async () => {
    const [module] = new OpenAPIScanner().scanWithEffectiveParameters(spec, { include: "^inherited$" });
    const topLevel = { ...module, httpMethod: "get", urlPath: "/top", metadata: {
      ...module.metadata, httpMethod: "PATCH", urlPath: "/alias",
    } };
    const snakeCase = { ...module, metadata: { ...module.metadata, httpMethod: "PATCH", urlPath: "/alias" } };
    const aliases = { ...module, metadata: { ...module.metadata, http_method: "", url_path: null,
      httpMethod: "PUT", urlPath: "/alias" } };
    expect(detectEffectiveProxyHazards([topLevel, snakeCase, aliases])).toEqual([
      { moduleId: "inherited", httpMethod: "POST", urlPath: "/inherited",
        kind: { code: "query_on_body_method", parameters: ["term"] } },
      { moduleId: "inherited", httpMethod: "PUT", urlPath: "/alias",
        kind: { code: "query_on_body_method", parameters: ["term"] } },
      { moduleId: "inherited", httpMethod: "get", urlPath: "/top",
        kind: { code: "unsupported_http_method", method: "get" } },
    ]);

    const requests: { url: string; method?: string }[] = [];
    const writer = new HTTPProxyRegistryWriter({
      baseUrl: "https://example.invalid",
      fetchImpl: async (url, options) => {
        requests.push({ url: String(url), method: options?.method });
        return Response.json({});
      },
    });
    let runtime: { execute(inputs: Record<string, unknown>, context: Record<string, unknown>): Promise<unknown> } | undefined;
    const registry = { register: (_id: string, registered: unknown) => {
      runtime = registered as typeof runtime;
    } };
    for (const source of [topLevel, snakeCase, aliases]) {
      writer.write([source], registry);
      expect(runtime).toBeDefined();
      await runtime?.execute({ term: "test" }, {});
    }
    expect(requests).toEqual([
      { url: "https://example.invalid/top?term=test", method: "GET" },
      { url: "https://example.invalid/inherited", method: "POST" },
      { url: "https://example.invalid/alias", method: "PUT" },
    ]);
  });

  it("detects inherited query fields and path-name collisions for selected operations", () => {
    const scanner = new OpenAPIScanner();
    const modules = scanner.scanWithEffectiveParameters(spec);
    expect(detectEffectiveProxyHazards(modules)).toEqual([
      { moduleId: "inherited", httpMethod: "POST", urlPath: "/inherited",
        kind: { code: "query_on_body_method", parameters: ["term"] } },
      { moduleId: "same_body", httpMethod: "POST", urlPath: "/same-body/{id}",
        kind: { code: "name_collision", name: "id", locations: ["path", "body"] } },
      { moduleId: "same_query", httpMethod: "GET", urlPath: "/same-query/{id}",
        kind: { code: "name_collision", name: "id", locations: ["path", "query"] } },
    ]);
    expect(detectEffectiveProxyHazards(modules.filter(module => module.moduleId === "good"))).toEqual([]);
    expect(detectProxyHazards(spec, scanner.scan(spec))).toEqual([]);
    const [legacy] = scanner.scan(spec, { include: "^good$" });
    expect(detectEffectiveProxyHazards([legacy])[0]?.kind.code).toBe("missing_effective_inputs");
  });

  it("uses the published schema and records malformed metadata or declarations", () => {
    const scanner = new OpenAPIScanner();
    const [malformed] = scanner.scanWithEffectiveParameters({
      openapi: "3.1.0",
      paths: { "/items/{id}": { get: { parameters: [{ $ref: "#/missing" }], responses: response } } },
    });
    expect(detectEffectiveProxyHazards([malformed]).map(hazard => hazard.kind.code)).toEqual([
      "parameter_resolution", "path_template_mismatch",
    ]);
    const [module] = scanner.scanWithEffectiveParameters(spec, {
      include: "^good$",
      transformModule: original => ({ ...original, inputSchema: { properties: { unexpected: {} } } }),
    });
    expect(detectEffectiveProxyHazards([module]).map(hazard => hazard.kind.code)).toEqual(["input_schema_mismatch"]);
    const invalid = { ...module, metadata: { ...module.metadata, openapi: { proxy_inputs: true } } };
    expect(detectEffectiveProxyHazards([invalid])[0]?.kind.code).toBe("invalid_effective_inputs");
  });
});
