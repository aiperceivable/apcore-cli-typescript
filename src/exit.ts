/**
 * Process-exit indirection for embedded hosts.
 *
 * The CLI is also a library: `createCli()` and `buildModuleCommand()` are
 * called from host applications that own the process. A hard `process.exit()`
 * inside those paths makes the host untestable and prevents it from
 * translating an apcore exit code into its own (e.g. mapping
 * `SCHEMA_VALIDATION_ERROR` 45 to a generic `2`).
 *
 * Every library-side exit goes through {@link exitWith}. The default handler
 * still calls `process.exit`, so the standalone binary is unchanged. An
 * embedded host installs its own handler once:
 *
 * ```ts
 * setExitHandler((code) => {
 *   throw new CliExit(code);   // or record the code and return
 * });
 * ```
 *
 * The binary entry point (`main()`) deliberately keeps the default handler.
 */

/** Receives the exit code a library path wants to terminate with. */
export type ExitHandler = (code: number) => void;

/**
 * Thrown when an {@link ExitHandler} returns instead of terminating the flow.
 *
 * A handler may throw its own error (the recommended way to hand control back
 * to a host) or call `process.exit`. Returning is treated as a bug because
 * every caller of {@link exitWith} is on a path that must not continue; the
 * sentinel makes that explicit and keeps TypeScript control-flow analysis.
 */
export class CliExit extends Error {
  readonly code: number;

  constructor(code: number) {
    super(`CLI exit with code ${code}`);
    this.name = "CliExit";
    this.code = code;
  }
}

const defaultExitHandler: ExitHandler = (code) => {
  process.exit(code);
};

let exitHandler: ExitHandler = defaultExitHandler;

/**
 * Replace the process-exit action used by the library. Pass `null` to restore
 * the default (`process.exit`).
 */
export function setExitHandler(handler: ExitHandler | null): void {
  exitHandler = handler ?? defaultExitHandler;
}

/** The currently installed exit handler. */
export function getExitHandler(): ExitHandler {
  return exitHandler;
}

/**
 * Terminate through the installed handler. Declared `never`: a handler that
 * returns causes a {@link CliExit} to be thrown rather than letting a
 * caller continue past a failed command.
 */
export function exitWith(code: number): never {
  exitHandler(code);
  throw new CliExit(code);
}

/** Restore `process.exit`; intended for tests. */
export function resetExitHandler(): void {
  exitHandler = defaultExitHandler;
}
