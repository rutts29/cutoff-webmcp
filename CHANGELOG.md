# Changelog

Short dated entries, newest first. One entry per working session. Also holds the agent test log and the "Later" list.

## Unreleased

### 2026-09-02, Review 2 closeout and P1 package (Codex, build lead)

- Recorded the human Review 2 pass against `https://cutoff-webmcp-h1fr49smy-ruttansh-bhatelias-projects.vercel.app`. The reviewer repeated the full flow, confirmed the row-focus fix, inspected the line formula, and checked the eval evidence.
- Added the inline `Give the signal a label` error with required and invalid-state semantics. The message clears when the manager types.
- Added a visible handoff summary field and `Save handoff receipt` button. It calls the same revisioned store transition as `save_handoff_receipt` and records a human activity entry.
- Added three regression tests for empty-label validation, manual receipt creation, and matching human and tool receipt state. All 43 tests and the production build pass.
- Verified both fixes in a headed browser over `https://cutoff.localhost`. The receipt rendered at revision 1, stated that nothing left the page, and produced no console error.
- Added `DEMO.md`, `DEVPOST.md`, and the MIT `LICENSE`. Rewrote the README around the problem, audience, product tour, WebMCP need, five tools, local use, deployment, demo prompts, synthetic data, and affiliation limits.
- Trimmed `docs/trajectory.json` from 22 implementation and infrastructure entries to 14 decision-level entries. Failed eval attempts remain visible in the eval summary and test log.
- Replaced the stale Review 1 screenshot with `docs/cutoff-review3.png`. The current capture uses the fixed dates, opens the lettuce formula, and includes the visible handoff control without browser chrome or third-party marks.
- Deployed the current non-production preview at `https://cutoff-webmcp-ekm8ou384-ruttansh-bhatelias-projects.vercel.app`. The root and `/trajectory` return 200, the production alias returns 404, and the app still registers four base tools in the in-app browser.
- Removed the unreferenced intermediate preview created during the documentation pass. Its URL now returns 404; the current preview returns 200.
- Stopped retrying the Ora CLI. Its current capture shim and service are incompatible. The public audit remains a GO LIVE check against the production URL only.
- Recorded a human Chrome inspector run over Portless HTTPS. The agent called `get_order_context`, `add_local_signal`, `preview_order_plan`, and `save_handoff_receipt` with revisions 0 through 3. The 50-guest booking changed the preview from 1,140 to 1,190 covers, 95 to 100 labor hours, and 3,629 to 3,718 cost units.
- Kept the branded browser and extension captures in ignored `output/chrome-inspector/`; they are private review evidence, not submission assets. The agent's final prose added dollar signs to neutral cost units, while the tool result and page remained correct. No product change was made for that model narration error.
- Completed the human Chrome inspector 4-to-5-to-4 flow on the current preview. The page exposed five tools at revision 2, accepted `adopt_order_draft`, committed revision 3, recorded the adoption in activity, and returned to four tools.
- Found an adapter lifecycle bug during that run. The store committed adoption, but the registration subscription immediately aborted the dynamic tool's registration signal before its result reached the inspector. The inspector reported an unknown transient failure even though the page had adopted the draft.
- Deferred dynamic-tool unregistration to the next task and added a regression assertion that the adoption result resolves before its registration signal aborts. All 43 tests and the production build pass.
- Tried to deploy the fix to a fresh non-production Vercel preview. Vercel CLI returned `Not authorized`, so no new preview was created and the existing preview still has the old adapter bundle.
- After the human restored Vercel CLI authorization, deployed the corrected bundle and current trajectory to `https://cutoff-webmcp-o8cx9mu98-ruttansh-bhatelias-projects.vercel.app`. The root and `/trajectory` return 200, the new JavaScript asset is live, and the production alias remains 404.
- Started the corrected-preview Chrome inspector rerun. The extension found all four base tools and completed `get_order_context` at revision 1, then its Gemini request returned `503 UNAVAILABLE` for temporary high demand. An earlier attempt returned `Failed to fetch`. The extension accepts only a direct Gemini key, so the existing Vercel gateway cannot replace its model connection. No app change or retry loop was added.
- The human accepted the Gemini outage as an external exception and closed Review 2 on the combined evidence. Chrome and the in-app browser exercised the live tools, Sonnet passed the full browser chains, Gemini Flash passed through the gateway, and the inspector captured the dynamic tool lifecycle and committed adoption.
- The human approved Review 3 and public repository creation. The public package excludes private transcripts, environment files, browser-extension captures, internal planning documents, and generated HTML eval viewers.

### 2026-09-02, P0-b implementation and review fixes (Codex, build lead)

- Kept previews adoptable across view-only row focus and read activity. Added a store regression test for preview, focus, read, and adopt.
- Moved all five tool definitions to one JSON catalog. Generated `evals/schema.json` from that catalog and added eight tool-selection cases.
- Added the receipt panel, copy and download actions, receipt reload, `/trajectory`, activity times, pin removal, tablet reflow, native table semantics, visible link focus, and contrast-safe accent text.
- Removed `untrustedContentHint` from `add_local_signal` because its output contains only ids and revision data. Kept the hint on `get_order_context`, which returns human labels and notes.
- Made local receipt access exception-safe and rejected restored data outside current string, range, line, pin, and cost constraints.
- Completed the Daybreak security pass. It found no P0 or P1 issue. The two low-severity storage findings were fixed and covered by tests.
- Passed all 40 Vitest tests and a clean TypeScript and Vite production build.
- Verified preview, row focus, and adoption in system Chrome and the Codex in-app browser over the canonical Portless URL. Both kept five tools after focus and returned to four after adoption.
- Deployed the corrected Vercel preview at `https://cutoff-webmcp-n33qtur1x-ruttansh-bhatelias-projects.vercel.app`. The root and `/trajectory` return 200, the preview sends `X-Robots-Tag: noindex`, and the production alias returns 404.
- Added `.vercelignore` for environment files before the clean preview. The deployment target is Preview, and no production alias is live.
- Removed the two stale preview deployments after the corrected preview passed. Both stale URLs and the production alias now return 404; the corrected preview returns 200.
- Rewrote the eval cases after the original cases omitted the required read step. Local mode now checks only the first call with `--max-steps 1`; browser mode checks the full ordered chains.
- Kept revision inputs tied to the latest `get_order_context` or mutation result. The visible header revision remains human-only context.
- Ran the corrected Sonnet local suite at 8 of 8 steps and the live browser suite at 17 of 17 steps.
- Added a dependency-free `curl` runner for the same first-call contract through Vercel AI Gateway. The first Gemini 3.7 Flash attempt was blocked before inference because the gateway classified the key as free tier. After credits became active, the separate rerun passed 8 of 8 cases. No older Gemini or OpenAI gateway request was used.
- Ran independent clean Sol and Terra browser trials. Sol completed the full WebMCP flow with exact totals. Terra completed the product flow but used visible controls for most mutations, so it is not counted as tool-selection evidence.
- Ran `npx ax webmcp-audit https://cutoff.localhost --json` once. Ora rejected `ax` 0.7.0 before scoring because its capture shim version does not match the service. No preview URL was audited.

### 2026-09-02, P0-a Review 1 verification (Codex, build lead)

- Reproduced every Section 4 output in the engine suite and passed all 29 tests across the engine, store, WebMCP adapters, and UI.
- Verified a production build with TypeScript and Vite.
- Ran the locked booking and cancellation flow in system Chrome over Portless HTTPS. WebMCP moved from four tools to five for a current preview, then back to four after adoption.
- Ran real `get_order_context`, `add_local_signal`, `preview_order_plan`, and `adopt_order_draft` calls in the Codex in-app browser. The page updated during the tool calls and adopted the exact 910-cover, 76-hour, 2,767-unit draft.
- Verified direct localhost separately from Portless. Both origins are secure contexts in the tested Chrome build and expose the four base tools.
- Ran `portless doctor`: CA trust, proxy health, DNS, and the active route passed with no warnings. After the human completed Portless's interactive macOS sudo step, the canonical port-443 URL passed in both browsers without a product workaround.
- Completed independent seed and engine review. All locked inputs, formulas, costs, outputs, and six reason branches matched the brief.

### 2026-09-02, P0-a build (Codex, build lead)

- Read the WebMCP specification, every linked Chrome guide, the ChatGPT site tools guide, the package typings, and the challenge rules before implementation.
- Added the locked 10-item seed, pure order engine, revisioned review store, receipt persistence, and five narrow WebMCP tool definitions.
- Added feature detection, abort-signal cleanup, StrictMode registration reuse, and dynamic registration for `adopt_order_draft`.
- Added 29 deterministic tests. They cover the exact Section 4 numbers, stale writes, adopt and undo, receipt reload, input validation, caller compatibility, output size, registration lifecycle, and core UI actions.
- Installed `portless` for local HTTPS testing. No site was deployed or published.
- Updated the brief so checkpoint times are sequencing guidance. Added the P0-b WebMCP eval CLI requirements.

### 2026-09-02, planning (Cursor agent, reviewer)

- Reviewed the full three-day ideation session, the WebMCP spec, all Chrome WebMCP guides, the ChatGPT site tools page, the Devpost rules, and the ora audit rubric.
- Locked the product: Cutoff, a QSR supplier-order exception desk with five WebMCP tools. Alternative (manufacturing containment review) kept as fallback only.
- Computed the deterministic dataset and expected outputs. Written into `BUILD_BRIEF.md` as test assertions.
- Wrote `BUILD_BRIEF.md`, `REVIEW_CHECKLIST.md`, seeded `docs/trajectory.json`.

## Agent test log

| Date | Agent / browser | Flow | Result | Notes |
|---|---|---|---|---|
| 2026-09-02 | Vitest / Node 24.18 | Engine, store, tool adapters, and UI | Pass | 29 of 29 tests; exact Section 4 table and totals. |
| 2026-09-02 | System Chrome 151 / `https://cutoff.localhost:1355/` | Booking, cancellation, preview, and adopt | Pass | Secure context; WebMCP detected; tools changed 4 to 5 to 4; adopted 910 covers, 76 hours, and 2,767 units. |
| 2026-09-02 | System Chrome 151 / `http://localhost:4428/` | Direct-origin registration smoke test | Pass | Secure context; WebMCP detected; four base tools registered without Portless. |
| 2026-09-02 | Codex in-app browser / `https://cutoff.localhost:1355/` | Real get, add, preview, and adopt tool calls | Pass | UI changed during tool calls; adopted revision 4; no supplier action. |
| 2026-09-02 | Portless 0.15.6 diagnostics | HTTPS proxy, CA, DNS, and route | Pass | 0 failures and 0 warnings on port 1355. Port 443 requires an interactive sudo password. |
| 2026-09-02 | System Chrome 152 / `https://cutoff.localhost/` | Canonical HTTPS registration and console check | Pass | HTTP/2; trusted CA; secure context; four base tools; no console errors. |
| 2026-09-02 | Codex in-app browser / `https://cutoff.localhost/` | Canonical real context call | Pass | Returned revision 0, 1,140 covers, 95 hours, 3,629 units, and 10 lines; activity updated during the call. |
| 2026-09-02 | Portless 0.15.6 diagnostics / port 443 | HTTPS proxy, CA, DNS, and route | Pass | 0 failures and 0 warnings after the human completed the interactive sudo step. |
| 2026-09-02 | Vitest / Node 24.18 | Engine, store, tools, schema drift, routes, receipt, and UI | Pass | 40 of 40 tests; generated schema matches the five registered tool definitions. |
| 2026-09-02 | System Chrome 152 / `https://cutoff.localhost/` | Preview, focus lettuce, and adopt | Pass | Tools stayed at five after view-only focus, adoption succeeded, tools returned to four, and the console had no errors. |
| 2026-09-02 | Codex in-app browser / `https://cutoff.localhost/` | Preview, focus lettuce, and adopt | Pass | Tools stayed at five after focus and returned to four after adoption. |
| 2026-09-02 | Daybreak security review | Tool boundaries, schemas, storage, rendering, and external-action paths | Pass | No P0 or P1 issue. Storage exception handling and restored-data bounds were hardened. |
| 2026-09-02 | `webmcp-evals` 0.0.4 setup | CLI, generated schema, and eight cases | Ready | CLI works. Model runs wait for an ignored environment file and preview URL. |
| 2026-09-02 | `npx ax webmcp-audit` / `ax` 0.7.0 | Local private WebMCP audit | Blocked | Ora requires capture shim version 2, while the current CLI emitted version 1. The run stopped before scoring and was not retried. |
| 2026-09-02 | System Chrome 152 / Vercel preview | Booking, cancellation, preview, routing, and console | Pass | WebMCP detected; exact 1,140 to 910 covers, 95 to 76 hours, 3,629 to 2,767 units; five tools during preview; no console errors. |
| 2026-09-02 | Codex in-app browser / Vercel preview | Registration, preview, row focus, and adopt | Pass | Four base tools, five with a preview, five after row focus, then four after adoption. |
| 2026-09-02 | `webmcp-evals` 0.0.4 / OpenAI | Eight-case local model run | Blocked | Runner authenticated, then OpenAI reported no API credits. Stopped after the repeated infrastructure error; no eval score produced. |
| 2026-09-02 | Vercel preview cleanup | Deployment target and environment-file exclusion | Pass | Final deployment target is preview. `.env` and `.env.*` are excluded. All automatic production aliases return 404. |
| 2026-09-02 | `webmcp-evals` 0.0.4 / Claude Sonnet 5 | Eight-case local first-call suite | Pass | 8 of 8 steps. Every intent began with `get_order_context`; `--max-steps 1` kept the static run to its stated purpose. |
| 2026-09-02 | `webmcp-evals` 0.0.4 / Claude Sonnet 5 / system Chrome | Eight live browser chains | Pass | 17 of 17 steps against the corrected preview. Mutation, restraint, handoff, pin-aware preview, and adoption chains matched. |
| 2026-09-02 | Vercel AI Gateway / `curl` / Gemini 3.7 Flash | Eight-case local first-call suite | Blocked | 0 cases scored. The gateway returned five 403 responses, then three 429 responses, before inference. It classified the key as free tier without access to this model. |
| 2026-09-02 | Vercel AI Gateway / `curl` / Gemini 3.7 Flash | Credited eight-case local first-call rerun | Pass | 8 of 8 cases. Every response made one call to `get_order_context`; 5,287 total tokens were reported. |
| 2026-09-02 | Neutral Sol worker / in-app browser | Full manager flow using live WebMCP tools | Pass | Exact 910-cover, 76-hour, 2,767-unit preview and 2,795-unit lettuce-pin preview. Focus preserved adoption; pinning required a fresh preview. |
| 2026-09-02 | Neutral Terra worker / fresh browser | Full manager business flow | Pass | Exact totals and receipt. Most mutations used visible controls, so this row is not tool-selection evidence. |
| 2026-09-02 | Vercel corrected preview | Root, `/trajectory`, headers, and production isolation | Pass | Both preview routes return 200, `X-Robots-Tag: noindex` is present, and the production alias returns 404. |
| 2026-09-02 | Vercel stale-preview cleanup | Exact deployment removal and URL checks | Pass | Both stale preview URLs return 404. The corrected preview returns 200, and the production alias remains 404. |
| 2026-09-02 | Human reviewer / Vercel preview | Full Review 2 flow and evidence audit | Pass | Exact totals, focus-safe adoption, receipt, formula detail, fixed dates, trajectory, headers, and recorded eval limitations passed. |
| 2026-09-02 | Vitest / Node 24.18 | Review 2 fixes and full regression suite | Pass | 43 of 43 tests. Empty-label validation, manual receipt creation, and human-tool receipt parity are covered. |
| 2026-09-02 | Headed browser / `https://cutoff.localhost/` | Empty signal label and manual receipt | Pass | Inline alert appeared. Manual save created revision 1 and a receipt with no external action. No console errors. |
| 2026-09-02 | Codex in-app browser / current Vercel preview | Registration and Review 2 fix smoke test | Pass | Four base tools registered. The current form includes the inline-validation path and visible handoff control. |
| 2026-09-02 | Vercel current preview | Root, `/trajectory`, headers, and production isolation | Pass | Both preview routes return 200, the app remains top-level, HSTS and `noindex` are present, and the production alias returns 404. The preview host adds its member-only feedback script outside the app bundle. |
| 2026-09-02 | Vercel preview cleanup | Superseded intermediate deployment | Pass | Removed only the unreferenced documentation-pass preview. Its URL returns 404; the current preview and the earlier human Review 2 evidence URL remain live. |
| 2026-09-02 | Human Chrome inspector / `https://cutoff.localhost/` | Context, 50-guest booking, preview, and handoff receipt | Pass | All four calls and revisions succeeded; preview totals were 1,190 covers, 100 hours, and 3,718 cost units. |
| 2026-09-02 | Human Chrome inspector / current Vercel preview | Dynamic registration and adoption | Product state pass; adapter result fail | Captured four tools, five with the current preview, and four after adoption. Adoption committed at revision 3, but immediate unregistration made the inspector report a transient tool failure. |
| 2026-09-02 | Vitest / Node 24.18 | Dynamic-tool result ordering and full regression suite | Pass | 43 of 43 tests. The adoption result now resolves before the dynamic registration signal aborts; production build passes. |
| 2026-09-02 | Vercel CLI | Corrected non-production preview deployment | Blocked | Vercel returned `Not authorized`. No new deployment was created and no alternate host was attempted. |
| 2026-09-02 | Vercel corrected preview | Adapter ordering fix, routes, headers, and production isolation | Pass | Root and `/trajectory` return 200 with the new bundle. HTTPS, HSTS, and `noindex` are present; the production alias remains 404. |
| 2026-09-02 | Human Chrome inspector / corrected Vercel preview | Corrected adoption-result verification | Blocked | Four base tools registered and `get_order_context` completed. Gemini then returned `503 UNAVAILABLE` for high demand before preview or adoption; one earlier request failed to fetch. |
| 2026-09-02 | Human Review 2 exception review | Combined browser and model evidence | Accepted | The recorded Chrome, in-app browser, Sonnet, gateway Gemini, and inspector evidence is sufficient. No more manual retry is required for the external Gemini outage. |

## Open before GO LIVE and submission

- Create the approved public repository and confirm that GitHub recognizes the root MIT license.
- Explicit GO LIVE approval for the production deployment.
- Production rerun in both browsers, the browser eval against that URL, and the public Ora audit.
- Public video under 3 minutes, final Devpost links, and explicit submission approval.

## Later

Ideas noted during the build that are out of scope for the submission.

- Second scenario preset (staff shortage as a warning signal).
- Waste exposure column per line.
