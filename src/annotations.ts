/**
 * Annotation access helpers — one place that resolves an annotation key
 * regardless of the casing convention the descriptor came from.
 *
 * apcore-js keeps annotations in two shapes with two key conventions:
 *
 * - in memory (`ModuleAnnotations`, what `Registry.getDefinition()` returns):
 *   **camelCase** — `requiresApproval`, `openWorld`, `cacheTtl`, …
 *   (see `DEFAULT_ANNOTATIONS` in apcore-js `dist/module.js`);
 * - on the wire (JSON, PROTOCOL_SPEC §4.4.1): **snake_case** —
 *   `requires_approval`, `open_world`, `cache_ttl`, ….
 *
 * The CLI consumes in-memory descriptors, but its annotation reads were ported
 * from the Python and Rust SDKs, whose in-memory annotations *are* snake_case.
 * Reading `requires_approval` off an apcore-js descriptor therefore silently
 * returned the default — in `checkApproval()` that meant a module declaring
 * `annotations.requiresApproval: true` skipped the client-side approval gate.
 * That went unnoticed because `annotations` used to be typed
 * `Record<string, unknown>`, which makes every key legal and no key checkable.
 *
 * This module is the single resolution point: it matches any of
 * `requiresApproval` / `requires_approval` / `requires-approval`, and falls
 * back to the `extra` bag, where apcore-js keeps extension data such as
 * `approval_message`. Call sites should use it instead of indexing the bag.
 *
 * `ModuleDescriptor.annotations` is `object | null` (not
 * `Record<string, unknown>`) because apcore-js declares
 * `ModuleAnnotations | null` and a named interface has no implicit index
 * signature — see `cli.ts` and `tests/types/registry-compat.ts`.
 */

/** Normalise a key for convention-insensitive comparison (`cache_ttl` ≈ `cacheTtl`). */
function normalizeKey(key: string): string {
  return key.replace(/[_-]/g, "").toLowerCase();
}

/** Treat anything non-null and object-like as a keyed bag. */
function asBag(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/** Exact-key lookup first, then a casing/underscore-insensitive scan. */
function lookup(bag: Record<string, unknown>, key: string): { found: boolean; value?: unknown } {
  if (key in bag) return { found: true, value: bag[key] };
  const wanted = normalizeKey(key);
  for (const [k, v] of Object.entries(bag)) {
    if (normalizeKey(k) === wanted) return { found: true, value: v };
  }
  return { found: false };
}

/**
 * Read an annotation by name.
 *
 * Accepts `requiresApproval`, `requires_approval` and `requires-approval`
 * interchangeably, and looks inside `extra` when the key is not on the bag
 * itself. Returns `defaultValue` for `null`/`undefined`/non-object bags and for
 * keys that are absent everywhere.
 *
 * Class instances are supported for the exact spelling only (`key in bag`);
 * the casing-insensitive scan walks own enumerable properties, which is what
 * apcore-js's frozen annotation objects are.
 */
export function getAnnotation(
  annotations: unknown,
  key: string,
  defaultValue: unknown = undefined,
): unknown {
  const bag = asBag(annotations);
  if (!bag) return defaultValue;

  const direct = lookup(bag, key);
  if (direct.found) return direct.value;

  const extra = asBag(bag["extra"]);
  if (extra) {
    const nested = lookup(extra, key);
    if (nested.found) return nested.value;
  }
  return defaultValue;
}
