# Changelog

Short dated entries, newest first. One entry per working session. Also holds the agent test log and the "Later" list.

## Unreleased

### 2026-09-03, expansion Stage 3 (Codex, build lead)

- Added the Shift log as the fourth decision page. It reads the existing activity and receipts newest first, filters by section, accepts bounded local notes, and downloads filtered service-day JSON without maintaining a second audit store.
- Added `get_shift_log` and `add_shift_note`. Shift log registers those tools plus `open_section`; note text is marked as untrusted, and notes bump the shared revision without invalidating either preview.
- Added the Saturday and rainy-Tuesday presets. Switching presets performs a full seed reset at revision 0, clears previews, undo state, and receipts, and records the new preset in activity. Tool reads and receipts report the active preset.
- Reproduced the Tuesday locked order and labor results: 520 covers, 44 hours, and 1,281 cost units at seed; a 40-person booking previews 560 covers, 47 hours, and 1,447 units; the labor preview adds Nadia at lunch and Sam at dinner for 52 scheduled hours.
- Added client-side working-order CSV export with the exact seven columns, seed row order, quoted fields, and service-date filename. The addendum's Saturday TOTAL assertion says 71 cases, but its authoritative ten row values total 78. The exporter and regression test use the truthful derived total of 78 with cost 3,629.
- Rewrote the README, demo plan, and Devpost draft around the four-section desk, per-page tool lifecycle, shared revision, presets, downloads, and local-only boundary.
- Expanded the generated runtime schema to 16 tool definitions, the first-call fixture to 19 cases, and the full-chain fixture to 21 cases. GPT-5.6 Sol, Gemini 3.8 Flash, and DeepSeek V4 Pro passed 19 of 19 clarified first-call cases. Sonnet passed 18 of 19 because it made the correct labor read plus one safe parallel order read; the raw result remains unchanged.
- Closed the final accessibility and security findings. Invalid quantity pins now announce bounded errors; placeholders pass contrast; route titles, the skip link, and waste landmark are named; order adoption, undo, and discard announce completion; Tuesday receipts restore to the correct preset; read-only tools no longer write activity; visible form limits match adapter limits; and only standard WebMCP behavior hints ship.
- Added `nosniff`, no-referrer, restrictive browser-permission, and deny-framing headers for Vercel. A new CSP was deliberately excluded because it could interfere with the preview toolbar and browser-extension testing without protecting a backend, account, or external request path that this static app does not have.
- Fixed a Chrome-only route-transition race found during the final Portless review. `open_section` now remains registered for the app lifetime while route-specific tools rotate, so asynchronous abort cleanup cannot reject a duplicate navigation tool. A browser-faithful regression test covers delayed removal.
- Passed 102 of 102 deterministic, store, adapter, registration, accessibility, and UI tests and a clean TypeScript and Vite build before the final preview and release gates.
- Repeated the complete local ladder through the canonical Portless URL, `https://cutoff.localhost`. System Chrome loaded every decision route at 1,280 px and 390 px, completed the Saturday and Tuesday cross-page flow, downloaded Shift-log JSON, and logged no console errors. A separate flag-enabled transition run kept `open_section` present with exact route tool sets and no registration warning. The Codex in-app browser reported the exact route tool sets.

### 2026-09-03, expansion Stage 2 (Codex, build lead)

- Added a pure labor engine, the Saturday and Tuesday roster seeds, one shared labor state, deterministic daypart suggestions, reversible adoption, and labor-preview invalidation from order adoption and undo.
- Added `get_labor_plan`, `add_labor_signal`, `create_labor_preview`, and the dynamic `adopt_labor_plan`. Labor exposes four tools at rest and five while a current preview is adoptable.
- Reproduced all locked labor assertions. The 910-cover plan requires 76 hours; the preview releases Tom Walsh and Jonas Weber, and Rosa Alvarez's prep absence adds Nadia Haddad for four hours. Saved-demand control and release-guard cases also pass.
- Applied the corrected authoritative split for 830 covers: 70 total, 25 lunch, 34 dinner, and 11 prep. The formula takes precedence over the superseded value in the first addendum draft.
- Closed the accessibility review findings for scheduled-value labels, status contrast, and duplicate announcements. Updated tool wording so absence inputs omit daypart and hours, and `open_section` is explicitly unnecessary when the destination tools are already available.
- Passed 83 of 83 tests at the Stage 2 boundary and a clean production build. The final Labor route browser suite passed 8 of 8 steps on the non-production preview at `https://cutoff-webmcp-hgvgx8xyk-ruttansh-bhatelias-projects.vercel.app`.
- The 17-case first-call suite scored Sonnet 16, Gemini 17, GPT-5.6 Sol 17, and DeepSeek 14. The misses were safe prerequisite reads rather than unintended writes; no fixture or tool contract was weakened to hide them.

### 2026-09-03, expansion Stage 1 (Codex, build lead)

- Added live Stock state and a pure stock engine. The seeded waste ledger totals 74.97, with 44.60 expired, 15.60 overproduction, 13.60 prep, and 1.17 dropped.
- Added the Stock count sheet, waste form, waste summary, current-count timestamps, shared activity entries, and a cross-page stale-preview notice. Order calculations now read the live on-hand and expiring counts.
- Added `get_stock_status`, `record_stock_count`, and `log_waste`. Stock exposes those three tools plus `open_section`; Order remains six tools at rest and seven with a current preview.
- Reproduced every locked Stage 1 assertion. At 910 covers, chicken 30/6 produces 16 cases and a 2,835-unit order while the cancellation reason stays primary. The same count at 1,140 covers produces 21 cases. Logging two expired lettuce heads produces 7 on hand, 2 expiring, a 2.33-unit entry, and a 77.30-unit weekly total without changing its two-case recommendation.
- Fixed a route lifecycle defect found by the browser evaluator. `open_section` had deferred the route change until after the evaluator prepared its next step. The page now commits navigation and route-scoped registration before the tool result resolves; direct headless Chrome confirmed an immediate six-to-four tool swap with no console errors.
- Closed the Stage 1 accessibility findings: tinted-panel text now passes contrast, Stock errors are associated with their fields, and successful count and waste writes announce a scoped status without making the activity log live.
- Passed 68 of 68 tests and a clean TypeScript and Vite build. The final Stock route browser suite passed 5 of 5 steps, and the expanded first-call suite passed 13 of 13 cases with Claude Sonnet 5 through Vercel AI Gateway.
- Deployed the final non-production preview at `https://cutoff-webmcp-qp6gtt0gu-ruttansh-bhatelias-projects.vercel.app`. Production was not changed. Review evidence remains under ignored `output/review1/`.
- Self-review: Review 1 passed. Stage 2 is blocked because the brief says its roster seed and deterministic suggestion outcomes are locked in a Stage 2 addendum, but no addendum is present. Stage 3 likewise depends on absent rainy-Tuesday locked numbers.

### 2026-09-03, expansion Stage 0 (Codex, build lead)

- Added one shared shift-desk shell with Order, Stock, Labor, and Shift log routes. One store and monotonic revision survive client-side navigation.
- Added route-scoped registration. Order exposes six tools at rest and seven with a current preview; placeholder routes expose only `open_section`. A live local recorder confirmed that navigation aborts all six Order registrations before Stock registers its one tool.
- Added `get_line_detail` and `open_section`, generated the seven-tool eval schema from the runtime catalog, expanded the first-call fixture from 8 to 10 cases, and expanded the full-chain fixture from 8 to 12 cases.
- Fixed pending order changes. A page signal or quantity pin refreshes an active preview; without a preview, the sheet shows an explicit pending strip until the manager previews.
- Split drawer math into the calculated recommendation and pinned decision. The formula remains calculated even when the manager pins another value.
- Rebuilt the signal form around container queries and shrink-safe tracks. Added the shared three-step explainer, page titles, step labels, and placeholder panels; removed visible WebMCP detection chrome.
- Passed 55 of 55 tests and a clean TypeScript and Vite build. Captured 1280 px and 390 px evidence for all four routes, plus the workflow, pending, drawer, signal-form, and route-invalidation artifacts under ignored `output/review0/`.
- Closed the Stage 0 accessibility pass. Pending preview moves focus to its visible result, invalid booking covers have an associated error, modified tab activation keeps native browser behavior, route changes focus the new page title, and narrow-screen row selection brings the drawer into view.
- Deployed the user-approved non-production Vercel Preview at `https://cutoff-webmcp-odv083psh-ruttansh-bhatelias-projects.vercel.app`. All five public routes return 200 with `X-Robots-Tag: noindex`; Chrome completed the responsive interaction and navigation smoke test with no console errors, and the Codex in-app browser reported six Order tools and only `open_section` on Stock. Production was not changed.

### 2026-09-02, Round 4 audit hardening (Codex, build lead)

- Reworked the visible hierarchy around the restaurant outcome, synthetic-data notice, supplier-order totals, stock-line math, and local handoff. Fixed the signal form's desktop alignment and preserved the single-column mobile layout.
- Added a copyable demo prompt, project links, a visible preview status, and a short changed-value highlight that respects reduced-motion preferences.
- Replaced human-versus-agent guesses with interaction channels. Direct calls use exact WebMCP tool names and serialize `source: tool`; browser-driven controls appear as `page action` and serialize `source: page`.
- Rewrote all five tool contracts as neutral capability descriptions with compact result shapes. `expectedRevision` remains required and is the first property on every mutation schema.
- Declared behavior hints explicitly: `get_order_context` is read-only; all four mutating definitions set `readOnlyHint: false`. Human-authored signals, notes, and handoffs carry `untrustedContentHint` where they can be returned.
- Passed all 47 tests and a clean production build. The generated eval schema still matches the runtime catalog.
- Ran the final first-call suite through Vercel AI Gateway. Claude Sonnet 5, Gemini 3.8 Flash, OpenAI GPT-5.6 Sol, and DeepSeek V4 Pro each passed 8 of 8 cases.
- Ran full production browser chains with three current model families. Sonnet passed 17 of 17 steps. Gemini 3.8 Flash and DeepSeek V4 Pro each recorded 17 passes and one safe extra preview call; neither adopted or transmitted anything.
- Re-audited production through Ora's dedicated WebMCP audit. Shared Experience, Tool Quality, and Trust scored 100; the tool map correctly showed one read and three writes. Ora's 47 Task Completion score used document-editor intents and its custom live run offered only the read tool despite capturing all four, so no unrelated editor or sharing tool was added.
- Checked webmcp.com's public lookup API. The production host is not listed. Its listing request requires a contact email and human review, so no public directory request was made.
- Deployed commit `b25dde9` as Vercel production deployment `dpl_E9Mx5CoPswubdNLZsTFPJVoZieJk`. The canonical site serves the same JavaScript asset as the local production build; both SHA-256 hashes are `57148a5712248611c5ed579ed278a9a54d402322e70e6c2421f5081a70661fbb`.
- Repeated the final production lifecycle after the interaction-channel correction. Direct calls serialized `source: tool`; the exact 910-cover, 76-hour, 2,767-unit preview adopted at revision 4; and the conditional adoption tool was no longer available afterward.

### 2026-09-02, GO LIVE (Codex, build lead)

- Deployed the approved production build to `https://cutoff-webmcp.vercel.app/`. The canonical root and `/trajectory` return 200 over HTTPS with HSTS, no preview wrapper, and no `Origin-Agent-Cluster: ?0` header.
- Matched the live JavaScript asset to the local production bundle by SHA-256. Both hashes are `3ea14d853c3b829734948093c4389dcd2ca868c1d7d63490ca90367d9e296bd9`.
- Verified the canonical site in the Codex in-app browser. It exposed four base tools, the exact 1,140-cover seed, and the current project record.
- Repeated the locked flow in system Chrome with WebMCP enabled. The page moved from four tools to five for the exact 910-cover, 76-hour, 2,767-unit preview, then returned to four after adoption. Chrome reported no console errors.
- Preserved a 16-of-17 production eval where Sonnet refused to save a handoff containing facts absent from the fresh page. Corrected only that inconsistent fixture to request a truthful current-order reminder; the production rerun passed 17 of 17 steps.

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
- Published `https://github.com/rutts29/cutoff-webmcp` on the `main` branch. GitHub reports public visibility and recognizes the root license as MIT. Local and remote commit ids matched after the first push.

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
| 2026-09-03 | System Chrome / final Stage 3 Vercel Preview | WebMCP route-registration stress test | Pass | Fifty rapid Order, Stock, Labor, and Shift log transitions produced 101 immediate and next-task observations. Every observation contained the exact route tool set; `open_section` was never absent, and no registration error appeared. |
| 2026-09-03 | System Chrome and Codex in-app browser / final Stage 3 Vercel Preview | Full business flow and route-scoped tools | Pass | Chrome reproduced Saturday 910 covers, 76 hours, and 2,767 cost units, then Tuesday 520/44/1,281 to 560/47/1,447 with a 52-hour labor preview and valid Shift-log JSON. The in-app browser exposed exactly 6 Order, 4 Stock, 4 Labor, and 3 Shift-log tools. |
| 2026-09-03 | Vercel CLI | Stage 3 preview authorization recovery | Pass | The same approved Vercel account accepted the deployment after the earlier authorization failure. No alternate host or workaround was used. |
| 2026-09-03 | Vitest and Vite / Node 24.18 | Expansion Stage 3 presets, Shift log, export, shared store, adapters, registration, accessibility, and UI | Pass | 102 of 102 tests and a clean production build. Tuesday order and labor results, Shift log filters and notes, preset-correct receipt restoration, bounded forms, CSV output, live control confirmations, and delayed WebMCP unregistration are covered. |
| 2026-09-03 | System Chrome and Codex in-app browser / `https://cutoff.localhost` | Final local Stage 3 route, responsive, tool-set, and full-flow ladder | Pass | All four decision routes loaded at 1,280 px and 390 px with no root overflow or console errors. Chrome completed the Saturday and Tuesday flow and retained the shared navigation tool through every SPA transition; the in-app browser exposed Order 6, Stock 4, Labor 4, and Shift log 3 tools at rest. |
| 2026-09-03 | Vercel CLI | Final Stage 3 non-production preview | Infrastructure blocked | Vercel rejected the authorized preview before upload with `Not authorized`. No alternate host or deployment workaround was used; browser authorization must be restored before the preview gate continues. |
| 2026-09-03 | Vercel AI Gateway / current model families | Expanded 19-case first-call suite | Mixed, recorded | GPT-5.6 Sol, Gemini 3.8 Flash, and DeepSeek V4 Pro passed 19 of 19. Sonnet passed 18 of 19 after one correct Labor read included an extra safe Order read. |
| 2026-09-03 | `webmcp-evals` / Claude Sonnet 5 / Stage 2 Vercel Preview | Labor read, absence, preview, and adoption chains | Pass | 8 of 8 steps after neutral schema clarification. The report is `evals/reports/browser-gateway-sonnet-5-stage2-labor-post-contract/report-1788387668128.json`. |
| 2026-09-03 | Vitest and Vite / Node 24.18 | Expansion Stage 2 labor engine, store, tools, UI, and accessibility | Pass | 83 of 83 tests and a clean production build at the stage boundary. All Saturday locked splits, suggestions, adoption, undo, and cross-page invalidation assertions pass. |
| 2026-09-03 | Vitest and Vite / Node 24.18 | Expansion Stage 1 stock engine, store, route lifecycle, tools, UI, and accessibility | Pass | 68 of 68 tests and a clean production build. All locked Stage 1 totals and cross-page invalidation assertions pass. |
| 2026-09-03 | Headless Chrome / final Vercel Preview | Immediate `open_section` route and tool-set transition | Pass | The tool result completed, the URL moved to `/stock`, six Order tools were replaced by exactly four Stock tools, and the console stayed clear. |
| 2026-09-03 | Vercel AI Gateway / Claude Sonnet 5 | Expanded 13-case first-call suite | Pass | 13 of 13 cases. The schema and model call remained outside the app bundle. |
| 2026-09-03 | `webmcp-evals` / Claude Sonnet 5 / Vercel Preview | Expanded cross-route browser chains | Mixed, recorded | The pre-fix run passed 25 of 35 steps. After the lifecycle fix, it passed 27 of 32. Remaining misses came from the runner retaining an unavailable Order schema for one step after navigation; raw reports are retained. |
| 2026-09-03 | `webmcp-evals` / Claude Sonnet 5 / final `/stock` preview | Stock read, record-count, and log-waste chains | Pass | 5 of 5 steps. Each mutation read the Stock revision first and then called the intended Stock tool. |
| 2026-09-03 | Playwright and Codex in-app browser / final Vercel Preview | Stock at 1280 px and 390 px, route-scoped tools, and accessibility tree | Pass | Stock exposed exactly four tools. Controls remained named and keyboard reachable; screenshots are under ignored `output/review1/`. |
| 2026-09-03 | Headed Chrome and Codex in-app browser / Vercel Preview | Deployed Stage 0 routes, responsive interactions, shared revision, browser history, and route-scoped registration | Pass | `/`, `/stock`, `/labor`, `/log`, and `/trajectory` returned 200. Chrome preserved revision 2 across Stock and back, restored focus to Order, and logged no console errors. The in-app browser reported six Order tools and only `open_section` on Stock. Production was unchanged. |
| 2026-09-03 | Vitest, Vite, headed Chrome, and Codex in-app browser / `https://cutoff.localhost` | Expansion Stage 0 shell, pending previews, line detail, responsive routes, accessibility, and registration lifecycle | Pass locally | 55 of 55 tests; clean build; Order registered six tools, aborted them on navigation, and Stock registered only `open_section`; no console errors. |
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
| 2026-09-02 | GitHub public repository | Visibility, default branch, MIT detection, public root, and commit parity | Pass | Repository is public, default branch is `main`, GitHub recognizes MIT, private files are absent, and remote `main` matched the local commit. |
| 2026-09-02 | Vercel production / canonical URL | Root, `/trajectory`, headers, host wrapper, and bundle parity | Pass | Both routes return 200 over HTTPS with HSTS. No preview iframe or feedback script is injected. The live and local JavaScript hashes match. |
| 2026-09-02 | Codex in-app browser / production | Registration, seed, and trajectory | Pass | Four base tools registered at `https://cutoff-webmcp.vercel.app/`; the exact seed totals and current project record rendered. |
| 2026-09-02 | System Chrome / production | Booking, cancellation, preview, adoption, and console | Pass | WebMCP moved 4 to 5 to 4 tools; preview totals were 910 covers, 76 hours, and 2,767 units; adoption succeeded; 0 console errors. |
| 2026-09-02 | `webmcp-evals` 0.0.4 / Claude Sonnet 5 / production | Original eight browser chains | Fixture failed | 16 of 17 steps. Sonnet correctly refused to save a handoff that claimed state absent from the fresh page. Raw report retained. |
| 2026-09-02 | `webmcp-evals` 0.0.4 / Claude Sonnet 5 / production | Truthful eight browser chains | Pass | 17 of 17 steps after correcting only the inconsistent handoff prompt; tool descriptions and revision safeguards were unchanged. |
| 2026-09-02 | Vitest / Node 24.18 | Round 4 UI, store, tool-contract, and schema regression suite | Pass | 47 of 47 tests. Tool annotations, interaction channels, result-shape descriptions, revision requirements, and UI changes are covered. |
| 2026-09-02 | Vercel AI Gateway / four current model families | Final eight-case first-call suite | Pass | Sonnet 5, Gemini 3.8 Flash, GPT-5.6 Sol, and DeepSeek V4 Pro each passed 8 of 8 cases against the final schema. |
| 2026-09-02 | `webmcp-evals` / production / Sonnet 5 | Final eight browser chains | Pass | 17 of 17 steps against the final production tools. |
| 2026-09-02 | `webmcp-evals` / production / Gemini 3.8 Flash | Final eight browser chains | Safe over-completion | 17 passes and one failure. The model added a reversible preview after the 80-person booking where the fixture expected it to stop after storing the signal. |
| 2026-09-02 | `webmcp-evals` / production / DeepSeek V4 Pro | Final eight browser chains | Safe over-completion | 17 passes and one failure for the same extra preview; no adoption or external action occurred. |
| 2026-09-02 | Ora public WebMCP audit / production | Four-pillar audit and custom live goal | Mixed, recorded | 87 overall: Shared Experience 100, Task Completion 47, Tool Quality 100, Trust 100. Task intents were for a document editor; the custom live agent was offered only the read tool despite a four-tool capture. |
| 2026-09-02 | webmcp.com public lookup API | Production directory status | Not listed | The read-only API returned `supported: false`. A listing request needs a contact email and human review, so none was submitted. |
| 2026-09-02 | Codex in-app browser / production / commit `b25dde9` | Final provenance and dynamic tool lifecycle | Pass | Direct calls serialized `source: tool`; WebMCP moved from four tools to five for the exact 910-cover, 76-hour, 2,767-unit preview, adopted at revision 4, then removed `adopt_order_preview`. |

## Open before submission

- Public video under 3 minutes, final Devpost links, and explicit submission approval.

## Later

Ideas noted during the build that are out of scope for the submission.

- Waste exposure column per line.
