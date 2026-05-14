# Receipt to Zenmoney Implementation Review

Date: 2026-05-06

## Summary

The application is in good shape overall: the main receipt capture -> parse -> review -> submit flow is clear, the codebase is compact, and the unit coverage around storage and service helpers is solid.

The main improvement areas are reliability of the mobile flow, correctness at the external API boundaries, and recovery from partial failure. Most of the risk is not in the UI itself, but in what happens when the app is refreshed, the AI returns imperfect output, or the Zenmoney sync flow does not behave exactly as expected.

## Findings

### 1. Uploaded image MIME type is not preserved when sending to Claude

Priority: High

Files:
- `src/routes/+page.svelte`
- `src/lib/services/claude.ts`

Problem:

The upload flow preserves the original file type in the capture store for `png`, `jpeg`, and `webp`, but the Claude request always sends the image as `image/jpeg`.

Why it matters:

- Non-JPEG uploads may fail or be interpreted incorrectly.
- Even when accepted, mismatched metadata can reduce parsing reliability.

Recommendation:

- Pass the real MIME type into `parseReceipt`.
- Alternatively, normalize every uploaded image to JPEG before storing and submitting it.

## 2. Review state is lost on refresh or resumed PWA sessions

Priority: High

Files:
- `src/lib/stores/capture.ts`
- `src/routes/review/+page.svelte`

Problem:

The captured receipt exists only in an in-memory Svelte store. If the user refreshes the page, the app is killed in the background, or the PWA resumes in a new process, the review page loses the image and redirects back to capture.

Why it matters:

- This is a realistic mobile failure mode.
- Users can lose progress after taking a photo and waiting for parsing.

Recommendation:

- Persist the pending capture in `sessionStorage` or IndexedDB.
- Clear it only after successful submission or explicit cancellation.

## 3. Default account selection is inconvenient for multi-account users

Priority: Medium

Files:
- `src/routes/settings/+page.svelte`

Problem:

The account picker appears only after a category reload within the current page state. On a later visit, a previously saved account can exist, but the account list is gone unless the user reloads categories again.

Why it matters:

- Changing the default account requires an unnecessary sync action.
- The settings page does not fully reflect previously loaded configuration.

Recommendation:

- Persist the fetched account list locally.
- Or load available accounts on mount using the stored Zenmoney token.

## 4. Submission lifecycle needs retry and reconciliation support

Priority: Medium

Files:
- `src/routes/review/+page.svelte`
- `src/routes/history/+page.svelte`

Problem:

The app records local transactions as `pending`, then updates them to `submitted` or `failed`, but there is no retry flow for failures and no reconciliation pass to confirm remote state.

There is also a weak assumption in the current flow where `zenmoneyId` is set to the local transaction UUID after submission instead of using a confirmed remote identifier.

Why it matters:

- Failed submissions remain stranded.
- Network interruptions can create ambiguity around whether Zenmoney accepted the transaction.
- History becomes a dead-end instead of an operational queue.

Recommendation:

- Add retry actions for failed transactions from the history screen.
- Add a sync/reconciliation step that verifies server state after submission.
- Clarify whether the Zenmoney API treats the client-supplied ID as the canonical transaction ID.

## 5. Claude output is parsed but not validated

Priority: Medium

Files:
- `src/lib/services/claude.ts`
- `src/routes/review/+page.svelte`

Problem:

The Claude response is passed through `JSON.parse`, but there is no runtime validation of field shapes or values before the data is used in the form and later sent to Zenmoney.

Why it matters:

- A malformed-but-valid JSON payload can still contain an invalid date, unknown category, unsupported currency, or empty merchant.
- `parseFloat(amount) || 0` can silently convert bad input into a zero-value transaction.

Recommendation:

- Validate the response with a runtime schema.
- Reject or sanitize invalid values before they reach submission.
- Tighten submit-side validation so invalid form values cannot degrade into `0`.

## 6. Stored secret protection is useful, but weaker than it may appear

Priority: Low

Files:
- `src/lib/services/crypto.ts`
- `src/lib/db/settings.ts`

Problem:

API keys and tokens are encrypted before storage, but the encryption key is stored locally in IndexedDB on the same device.

Why it matters:

- This protects against casual inspection.
- It does not provide strong protection against hostile local access or injected script execution.

Recommendation:

- Keep the implementation if the goal is lightweight local obfuscation.
- Document the real security properties clearly in the README or settings UI.
- If stronger protection is required, the architecture needs a different trust model.

## Broader Improvements

### Receipt preprocessing

- Resize and compress receipt images before sending them to Claude.
- This should reduce mobile memory pressure, request size, latency, and cost.

### Test coverage

- The current tests cover services and IndexedDB helpers well.
- Add component or route-level tests for the main user flow: capture, parse failure fallback, submit success, and submit failure recovery.

### Offline and queue behavior

- The app is a PWA, but the main import action still depends on live third-party APIs.
- Consider making failed submissions explicitly queueable for later retry when the device is back online.

### History UX

- The history page is currently read-only.
- It would be more useful with filters by status, retry actions, and a clearer distinction between local pending data and remotely confirmed transactions.

### Settings UX

- Add field-level validation and clearer error messages for invalid credentials.
- Consider showing whether the Claude key and Zenmoney token are present without forcing users to re-enter them.

### Tooling cleanup

- `svelte-check` warns that the Node type definitions are missing.
- `oxlint` reports unused `describe` imports in two test files.
- These are minor, but worth fixing to keep the project clean.

## Validation

Commands run during review:

- `pnpm test -- --run`
- `pnpm check`
- `pnpm lint`

Results:

- Unit tests passed: 27 / 27
- `svelte-check`: 0 errors, 1 warning
- `oxlint`: 0 errors, 2 warnings

## Suggested Next Steps

1. Fix the MIME type mismatch and add runtime validation for Claude output.
2. Persist pending capture state so the mobile review flow survives refresh and resume.
3. Improve failed submission recovery with retry support in history.
4. Clean up the remaining tooling warnings.
