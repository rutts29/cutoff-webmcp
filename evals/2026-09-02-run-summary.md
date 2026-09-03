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

The final 19-case fixture ran through Vercel AI Gateway with the production tool names, descriptions, and input schemas.

| Model | Result | Raw result |
|---|---:|---|
| OpenAI GPT-5.6 Sol | 19 of 19 | `gateway-openai-gpt-5.6-sol-first-call-stage3-final.json` |
| Gemini 3.8 Flash | 19 of 19 | `gateway-gemini-3.8-flash-first-call-stage3-final.json` |
| DeepSeek V4 Pro | 19 of 19 | `gateway-deepseek-v4-pro-first-call-stage3-final.json` |
| Claude Sonnet 5 | 18 of 19 | `gateway-claude-sonnet-5-first-call-stage3-final.json` |

Sonnet selected the correct `get_labor_plan` call and added one safe parallel `get_order_context` read. The strict first-call matcher records the additional read as a failure. No fixture or tool description was changed to hide it.

The gateway was evaluation transport only. No model key enters the application bundle.

## Live browser result

The final production browser suite discovered the page-owned tools and completed all 21 tasks without a tool execution error. It scored 46 of 48 strict matcher steps. For the chicken-count task, Sonnet called `open_section`, read `get_stock_status`, and recorded the exact count. The fixture permits the shorter navigation-and-mutation chain because `open_section` already returns the current revision, so the additional safe read displaced two strict step matches.

The deterministic suite contains 109 tests for engine calculations, shared revisions, stale writes, route-scoped registration, dynamic adoption tools, storage bounds, exports, accessibility, and UI state transitions.

## Public auditor result

[Ora's September 3 production report](https://webmcp.ora.ai/cutoff-webmcp.vercel.app) scored 87 overall: Shared Experience 100, Task Completion 47, Tool Quality 99, and Trust 100. It captured all six Order tools with no registration error.

Ora assigned document-editor tasks to Cutoff. Its custom restaurant run captured all six Order tools but exposed only the two read tools to its live agent. The product does not add document editing, public sharing, or weaker revision rules to satisfy that mismatch. `ora-webmcp-audit.json` records the result and its limitations.

## Committed artifacts

The public repository keeps:

- the generated schema;
- the five current fixtures;
- the four final 19-case model results;
- the current Ora record; and
- this summary.

Intermediate gateway snapshots and generated browser reports are ignored. They are local debugging artifacts, not submission evidence.
