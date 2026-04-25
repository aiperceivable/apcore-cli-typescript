#!/usr/bin/env node
/**
 * apcore-cli — Shebang entry point.
 *
 * Intercepts --internal-sandbox-runner before the normal CLI bootstrap so
 * that the sandbox child process can execute a module without initializing
 * the full CLI surface (extensions dir scanning, registry, etc.).
 */

const sandboxIdx = process.argv.indexOf("--internal-sandbox-runner");
if (sandboxIdx !== -1) {
  const moduleId = process.argv[sandboxIdx + 1];
  if (!moduleId) {
    process.stderr.write("--internal-sandbox-runner requires a module_id argument.\n");
    process.exit(1);
  }
  import("../src/security/sandbox.js").then(({ runSandboxRunner }) => {
    runSandboxRunner(moduleId).catch((err: unknown) => {
      process.stderr.write(`sandbox runner fatal: ${err}\n`);
      process.exit(1);
    });
  });
} else {
  import("../src/main.js").then(({ main }) => {
    main("apcore-cli");
  });
}
