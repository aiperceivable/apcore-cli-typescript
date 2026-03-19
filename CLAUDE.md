# CLAUDE.md — apcore-cli-typescript

## Build & Test

- `pnpm test` (or `npx vitest run`) — run all tests. **Must pass before considering any task complete.**
- `pnpm build` — compile TypeScript to `dist/`.
- `npx tsc --noEmit` — type check without emitting.

## Code Style

- TypeScript strict mode with full type coverage.
- All code must pass `tsc --noEmit` with zero errors.
- Use `process.stderr.write()` for error output, `process.stdout.write()` or `console.log()` for normal output.
- Prefer `process.exit(code)` with `EXIT_CODES` constants over throwing for CLI errors.
- camelCase for functions/methods/variables, PascalCase for classes/interfaces/types.

## Project Conventions

- Spec repo (single source of truth): `../apcore-cli/docs/`
- Python reference implementation: `../apcore-cli-python/`
- ESM module (`"type": "module"` in package.json).
- Public API exported from `src/index.ts`.
- CLI framework: Commander.js (not Click or clap).
- DEFAULTS keys use snake_case dot-notation to match spec (e.g., `cli.help_text_max_length`, not `cli.helpTextMaxLength`).
- Security modules live in `src/security/` sub-directory.
- Tests: vitest, files in `tests/*.test.ts`.

## Environment

- Node.js >= 18
- Package manager: pnpm
- Key dependencies: commander, js-yaml, ajv
