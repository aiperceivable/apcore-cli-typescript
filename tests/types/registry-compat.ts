/**
 * Compile-time compatibility guard — never executed, only type-checked.
 *
 * The `Registry` / `Executor` / `ModuleDescriptor` interfaces in `src/cli.ts`
 * are local structural shims (the package deliberately carries no apcore-js
 * type import). Nothing in `src/` proves that a real apcore-js instance still
 * satisfies them, so a single upstream field change can silently break the
 * documented "pass the apcore-js objects directly, no adapter required" path —
 * which is exactly what happened in 0.12.7: apcore-js declares
 * `annotations: ModuleAnnotations | null`, a named interface that never gets
 * an implicit index signature, so `Record<string, unknown>` rejected every
 * real descriptor (fixed in 0.12.8 — see CHANGELOG.md).
 *
 * Run with `pnpm typecheck` (tsconfig.typecheck.json includes this file;
 * the default tsconfig excludes `tests`). If this file stops compiling, the
 * public embedder contract is broken — fix `src/cli.ts`, not this file.
 */
import { APCore } from "apcore-js";

import type {
  Executor as CliExecutor,
  ModuleDescriptor as CliModuleDescriptor,
  Registry as CliRegistry,
} from "../../src/cli.js";

const apcore = new APCore();
apcore.register("app.status", {
  description: "Compile-time fixture; never invoked.",
  inputSchema: {},
  execute: async () => ({}),
});

/** A real apcore-js `Registry` must satisfy the CLI's `Registry` shim. */
export const registry: CliRegistry = apcore.registry;

/** Descriptors returned by the real registry must satisfy the CLI's descriptor. */
export const descriptor: CliModuleDescriptor | null = apcore.registry.getDefinition("app.status");

/** A real apcore-js `Executor` (including its `registry` field) must satisfy the shim. */
export const executor: CliExecutor = {
  registry: apcore.registry,
  async call() {
    return {};
  },
};
