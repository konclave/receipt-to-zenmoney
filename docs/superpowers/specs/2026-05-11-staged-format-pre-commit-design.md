# Staged Format Pre-Commit Hook Design

## Goal

Add a repo-managed pre-commit hook that formats only staged files, preserves partial staging semantics, and covers all supported code file types in this repository.

## Current Context

- The repository uses `pnpm`.
- Existing formatting is provided by `oxfmt`.
- `package.json` currently exposes `format` and `format:check` scripts that target `src`.
- There is no existing Git hook manager or staged-file formatter wiring.
- Repository code includes `.svelte`, `.ts`, `.css`, `.html`, `.json`, and related web project file types.
- `oxfmt` formats files such as `.css` and `.html` in this repository, but does not appear to accept `.svelte` files.

## Requirements

### Functional

- Run automatically on `git commit` via a repo-managed pre-commit hook.
- Format only the files currently staged for commit.
- Preserve partial staging so unstaged hunks are not pulled into the commit.
- Format all supported code files in the repository, not just files under `src/`.
- Skip unsupported file types cleanly.

### Non-Functional

- Follow common contributor tooling so the setup is easy to understand and maintain.
- Avoid custom Git index manipulation logic when a well-tested tool already handles it.
- Keep formatter ownership explicit by file type.

## Recommended Approach

Use `husky` for repo-managed Git hook installation and `lint-staged` for staged-file selection plus partial-staging-safe execution.

### Why This Approach

- `husky` is the standard lightweight way to keep hooks in the repository.
- `lint-staged` already solves the hard part: temporarily hiding unstaged changes, running commands against staged files, and restoring the working tree safely.
- A custom script would duplicate fragile `lint-staged` behavior for no product benefit.

## Formatter Routing

### `oxfmt`

Use `oxfmt` for file types it already supports in this project, such as:

- `*.ts`
- `*.js`
- `*.mjs`
- `*.cjs`
- `*.json`
- `*.css`
- `*.html`
- `*.svg`

This list can be tuned to the actual formatter support confirmed during implementation.

### Svelte Formatter

Add a Svelte-capable formatter for `*.svelte` files because `oxfmt` does not appear to process them correctly in the current setup.

The most pragmatic option is Prettier with the Svelte plugin, scoped only to the file types `oxfmt` does not cover.

## Hook Flow

1. Contributor installs dependencies with `pnpm install`.
2. The repository `prepare` script ensures Husky installs the Git hooks into `.husky/`.
3. On `git commit`, `.husky/pre-commit` runs `pnpm lint-staged`.
4. `lint-staged` groups staged files by glob pattern and runs the matching formatter command.
5. Formatter edits are re-staged automatically.
6. If any formatter command fails, the commit is blocked and the working tree is restored.

## File-Level Changes

### `package.json`

- Add `husky` and `lint-staged` dev dependencies.
- Add any Svelte formatter dependency required by the chosen command.
- Update `prepare` so Husky installs hooks as part of dependency setup.
- Add a `lint-staged` configuration entry or point to a dedicated config file.
- Optionally broaden `format` and `format:check` scripts so they align with repo-wide formatting intent.

### `.husky/pre-commit`

- Add a Husky-managed shell hook that runs `pnpm lint-staged`.

### Optional formatter config

- Add a Prettier config only if the Svelte formatter requires explicit repo configuration.
- Keep this minimal and avoid replacing `oxfmt` where it already works.

## Error Handling

- Unsupported file types should be ignored by glob selection rather than failing the hook.
- Formatter failures should stop the commit with the formatter output visible to the contributor.
- Partial staging must remain intact after both success and failure paths.

## Testing Strategy

### Manual verification

- Stage a `.ts` file with formatting issues and confirm the hook fixes and re-stages it.
- Stage a `.svelte` file with formatting issues and confirm the hook fixes and re-stages it.
- Create a partially staged file and confirm the commit contains only the staged hunks after formatting.
- Stage an unsupported file type and confirm the hook ignores it without failure.

### Command-level verification

- Run the formatter commands directly on representative files before wiring them into `lint-staged`.
- Run `pnpm lint-staged` with staged sample files to confirm the config behaves as expected.

## Out of Scope

- Replacing `oxfmt` as the repository’s primary formatter.
- Adding linting to the pre-commit hook.
- Reformatting the whole repository as part of this change.
