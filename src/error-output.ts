/**
 * Failure-envelope rendering.
 *
 * Both `buildModuleCommand()` and the built-in `apcli exec` command need to
 * render a classified failure the same way, and both need to honour a host's
 * choice of destination: stderr (CLI default) or stdout (agent-facing hosts
 * whose contract is "on failure stdout contains exactly one document").
 */

import { inspect } from "node:util";
import { exitCodeForError } from "./errors.js";
import { exitWith } from "./exit.js";
import type { ModuleErrorContext, ModuleResultOptions } from "./main.js";

/** Where a structured/human-readable failure envelope is written. */
export type ErrorStream = "stdout" | "stderr" | { write(chunk: string): unknown };

/** Minimal writable shape shared by `process.stdout`, `process.stderr` and hosts. */
export type ErrorWriter = { write(chunk: string): unknown };

/**
 * Resolve the destination for a failure envelope. `stdout` lets an
 * agent-facing host honour the "stdout carries exactly one document" contract;
 * the default remains stderr so ordinary CLI pipelines are unaffected.
 */
export function resolveErrorStream(spec: ErrorStream | undefined): ErrorWriter {
  if (spec === "stdout") return process.stdout;
  if (spec === undefined || spec === "stderr") return process.stderr;
  return spec;
}

export function resolveModuleError(
  error: unknown,
  moduleId: string,
  exitCodes: ModuleResultOptions["exitCodes"],
): ModuleErrorContext {
  const value = error as { code?: unknown } | null;
  const code = typeof value?.code === "string" ? value.code : null;
  const mapped = code !== null && exitCodes && Object.hasOwn(exitCodes, code)
    ? exitCodes[code]
    : undefined;
  return { error, code, moduleId, exitCode: mapped ?? exitCodeForError(error) };
}

export async function reportModuleError(
  failure: ModuleErrorContext,
  options: ModuleResultOptions,
  format?: string,
): Promise<void> {
  await options.onError?.(failure);
  const output = resolveErrorStream(options.errorStream);
  if (format === "json" || !process.stderr.isTTY) {
    emitErrorJson(failure.error, failure.exitCode, output);
  } else {
    emitErrorTty(failure.error, failure.exitCode, output);
  }
  (options.exit ?? exitWith)(failure.exitCode);
}

/** Emit the single-line JSON error document (F3). */
export function emitErrorJson(e: unknown, exitCode: number, out: ErrorWriter = process.stderr): void {
  const err = e instanceof Error ? e : new Error(String(e));
  const errRecord = err as unknown as Record<string, unknown>;
  const code = errRecord.code ?? "UNKNOWN";
  const payload: Record<string, unknown> = {
    error: true,
    code,
    message: err.message,
    exit_code: exitCode,
  };
  for (const field of ["details", "suggestion", "ai_guidance", "retryable", "user_fixable"]) {
    const val = errRecord[field];
    if (val !== undefined && val !== null) {
      payload[field] = val;
    }
  }
  out.write(JSON.stringify(payload) + "\n");
}

/** Emit the human-readable error with guidance fields (F3). */
export function emitErrorTty(e: unknown, exitCode: number, out: ErrorWriter = process.stderr): void {
  const err = e instanceof Error ? e : new Error(String(e));
  const errRecord = err as unknown as Record<string, unknown>;
  const code = errRecord.code;
  const header = code ? `Error [${code}]: ${err.message}` : `Error: ${err.message}`;
  out.write(header + "\n");

  const details = errRecord.details;
  if (details && typeof details === "object" && !Array.isArray(details)) {
    out.write("\n  Details:\n");
    for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
      let detail: string;
      try {
        detail = typeof v === "object" && v !== null ? JSON.stringify(v) ?? String(v) : String(v);
      } catch {
        detail = inspect(v, { depth: 4, customInspect: false });
      }
      out.write(`    ${k}: ${detail}\n`);
    }
  }

  const suggestion = errRecord.suggestion;
  if (suggestion) {
    out.write(`\n  Suggestion: ${suggestion}\n`);
  }

  const retryable = errRecord.retryable;
  if (retryable !== undefined && retryable !== null) {
    const label = retryable ? "Yes" : "No (same input will fail again)";
    out.write(`  Retryable: ${label}\n`);
  }

  out.write(`\n  Exit code: ${exitCode}\n`);
}
