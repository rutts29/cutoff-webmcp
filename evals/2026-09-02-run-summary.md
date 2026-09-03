# WebMCP evaluation summary

Updated: 2026-09-04

## Current contract

`schema.json` contains 16 tool definitions generated from `src/webmcp/toolCatalog.json`. The schema drift test compares the generated definitions with the catalog used for runtime registration.

The committed fixtures have separate jobs:

- `cases.local.json` contains 19 first-call selection cases across the four decision pages.
- `cases.json` contains 21 ordered browser tasks.
- `cases.stock.json`, `cases.labor.json`, and `cases.log.json` isolate their page-specific flows.

Mutating tools require `expectedRevision` from a page read or the previous mutation. Browser tasks therefore test ordered discovery and execution against live page state. The first-call suite tests only the first selected tool.

## Current first-call results

On September 4, the unchanged 19-case fixture ran once per model through Vercel AI Gateway with the production tool names, descriptions, and input schemas. Results were accepted only when they matched or improved on the published artifact; there were no retries.

| Model | September 4 run | Published artifact | Publication decision |
|---|---:|---:|---|
| OpenAI GPT-5.6 Sol | 19 of 19 | 19 of 19 | refreshed |
| Gemini 3.8 Flash | 19 of 19 | 19 of 19 | refreshed |
| DeepSeek V4 Pro | 18 of 19 | 19 of 19 | September 2 artifact retained |
| Claude Sonnet 5 | 18 of 19 | 18 of 19 | refreshed |

The fresh DeepSeek run began the restrained-preview task with the required `get_order_context` call, then added the safe `get_labor_plan` and `get_stock_status` reads. The strict matcher therefore scored that run 18 of 19, and the repository keeps the earlier 19-of-19 artifact as an explicitly retained baseline rather than replacing it with a regression. Sonnet used `get_order_context` instead of `get_line_detail` for the stock-line calculation case, so its refreshed artifact remains 18 of 19. No fixture or tool description was changed, and neither model was retried to improve its score.

The raw result filenames remain stable:

- `gateway-openai-gpt-5.6-sol-first-call-stage3-final.json`
- `gateway-gemini-3.8-flash-first-call-stage3-final.json`
- `gateway-deepseek-v4-pro-first-call-stage3-final.json`
- `gateway-claude-sonnet-5-first-call-stage3-final.json`

The gateway was evaluation transport only. No model key enters the application bundle.

## Live browser result

The final production browser suite discovered the page-owned tools and completed all 21 tasks without a tool execution error. It scored 46 of 48 strict matcher steps. For the chicken-count task, Sonnet called `open_section`, read `get_stock_status`, and recorded the exact count. The fixture permits the shorter navigation-and-mutation chain because `open_section` already returns the current revision, so the additional safe read displaced two strict step matches.

The deterministic suite contains 111 tests for engine calculations, shared revisions, stale writes, route-scoped registration, dynamic adoption tools, storage bounds, exports, accessibility, and UI state transitions.

## Public auditor result

[The September 4 webmcp.com report](https://webmcp.com/report/6d9b889b-a122-4c21-85fa-c327f2f28a24) graded the production site A, "Excellent," with 14 unique tools detected across five pages. Those are the tools registered at rest; the two adoption tools remain intentionally dynamic, producing the complete 16-tool catalog only while their previews are current. Its findings praise the constrained inputs, revision guards, cross-section coverage, and naming. It asks for output schemas, but WebMCP has no standard `outputSchema` member, so Cutoff keeps its result shapes in the descriptions and generated `schema.json`.

[Ora's September 4 production report](https://webmcp.ora.ai/cutoff-webmcp.vercel.app) scored 86 overall: Shared Experience 100, Tool Selection 45, Tool Quality 99, and Trust 100. It captured all six Order tools with no registration error. One custom audit was started from the required `/audit` page; after Ora's cooldown, a single forced run used the restaurant-specific goal. The resulting report still substituted three document or note-taking tasks: open a recent document, insert a summary, and save a public share link. Cutoff correctly has no tool for the last two. The product does not add unrelated editing or public-sharing capabilities to satisfy that classifier mismatch.

Neither `robots.txt` nor `llms.txt` was added as a score patch. The expanded WebMCP scorecard does not include either file: Shared Experience and Trust are already 100, Tool Quality is 99 with only the `open_section` naming warning, and Tool Selection is 45 because of the incorrect editor classification. Ora's broader site-readiness methodology says an absent matching robots rule already permits crawling and gives separate discovery credit for `llms.txt`; it does not establish that either file changes WebMCP site-type classification.

## Committed artifacts

The public repository keeps:

- the generated schema;
- the five current fixtures;
- three refreshed 19-case model results and the explicitly retained DeepSeek baseline;
- the current Ora and webmcp.com records; and
- this summary.

Intermediate gateway snapshots and generated browser reports are ignored. They are local debugging artifacts, not submission evidence.
