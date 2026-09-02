# WebMCP eval run summary

Date: 2026-09-02

## Eval contract

`schema.json` contains 16 definitions generated from the same catalog as the registration module. The schema drift test passes.

Mutating tools require `expectedRevision` from `get_order_context` or a prior mutation result. `cases.local.json` therefore checks only the first call with `--max-steps 1`. `cases.json` checks the full ordered chains against the live page.

The first fixture version omitted the required read step. Sonnet read the state before each mutation, but the matcher marked that safe read as an unexpected call. The corrected fixture records the read as part of the contract. No stale-write guard or vendor-specific hint changed.

## Stage 0 fixture delta

The expansion shell adds `get_line_detail` and `open_section`. The first-call fixture grows from 8 to 10 cases. The full-chain fixture grows from 8 to 12 cases with one direct call and one ordered chain for each new tool. These cases are not scored yet. The expansion brief schedules the next model-backed run after the Stock page adds a real decision flow; prior scores remain labeled as pre-expansion evidence.

## Stage 1 fixture delta

Stock adds `get_stock_status`, `record_stock_count`, and `log_waste`. The first-call fixture grows from 10 to 13 cases, and the full-chain fixture grows from 12 to 15 cases. `cases.stock.json` runs the three Stock cases from `/stock`, where those contextual tools are registered.

The first cross-route browser run exposed a product timing defect: `open_section` returned before its timer replaced the registered tool set. After the route lifecycle fix, direct Chrome changed the URL and tool set before the result completed. The full evaluator improved from 25 of 35 to 27 of 32 steps. Its remaining cross-route misses show the runner offering an unavailable Order schema for one step, then recovering to the Stock tool. Expectations were not relaxed. The page-context Stock suite passed 5 of 5 steps.

Two earlier Stage 1 browser invocations scored no cases because the runner was pointed at the wrong provider mapping. Their raw reports remain under `reports/browser-gateway-sonnet-5-stage1-preview/` and `reports/browser-gateway-sonnet-5-stage1-preview-corrected/`. Neither reached a model or tool, so neither is reported as product evidence.

## Stage 2 fixture delta

Labor adds `get_labor_plan`, `add_labor_signal`, `create_labor_preview`, and dynamic `adopt_labor_plan`. The first-call fixture grew to 17 cases. The Stage 2 browser fixture exercises the Labor route, including an absence, deterministic release and cover proposals, and adoption against live revision state.

The final Labor browser run passed 8 of 8 steps after two neutral contract clarifications: absence inputs explicitly omit `daypart` and `hours`, and `open_section` says it is redundant when the destination tools are already available. No provider-specific wording or narrow prompt rule was added.

## Stage 3 fixture delta

Shift log adds `get_shift_log` and `add_shift_note`. The generated catalog now contains 16 definitions across all routes, the first-call fixture contains 19 cases, and the full browser fixture contains 21 cases. Preset selection and CSV are visible page actions rather than WebMCP tools, so they are covered by deterministic and browser UI tests instead of artificial tool-selection cases.

An early Shift-log fixture said only “save a note,” which became genuinely ambiguous once both an operational shift note and a handoff receipt existed. The corrected case names the requested handoff receipt. The correction distinguishes two real product outcomes; it does not steer toward a vendor or weaken a safety rule. Both raw runs remain recorded.

The first full Stage 3 preview run passed 44 of 49 matcher steps. Three apparent route failures came from `open_section` returning before Chrome and the runner agreed on the destination tool set. The registration session now keeps `open_section` mounted across route changes and completes synchronous navigation before returning. A focused rerun completed all three business tasks; its two remaining matcher misses required `get_stock_status` even though `open_section` had already returned the current revision and the user supplied the complete count. The final fixture accepts the contract-valid `open_section` then `record_stock_count` chain. It still requires the exact destination and mutation arguments, and it does not weaken revision checking.

## Raw results

| Mode | Model | Result | Report |
|---|---|---:|---|
| Stage 3 gateway, clarified first-call fixture | OpenAI GPT-5.6 Sol | 19 of 19 cases | `gateway-openai-gpt-5.6-sol-first-call-stage3-final.json` |
| Stage 3 gateway, clarified first-call fixture | Gemini 3.8 Flash | 19 of 19 cases | `gateway-gemini-3.8-flash-first-call-stage3-final.json` |
| Stage 3 gateway, clarified first-call fixture | DeepSeek V4 Pro | 19 of 19 cases | `gateway-deepseek-v4-pro-first-call-stage3-final.json` |
| Stage 3 gateway, clarified first-call fixture | Claude Sonnet 5 | 18 of 19 cases | `gateway-claude-sonnet-5-first-call-stage3-final.json` |
| Stage 3 gateway, ambiguous pre-correction fixture | Gemini 3.8 Flash | 18 of 19 cases | `gateway-gemini-3.8-flash-first-call-stage3.json` |
| Stage 3 gateway, ambiguous pre-correction fixture | DeepSeek V4 Pro | 16 of 19 cases | `gateway-deepseek-v4-pro-first-call-stage3.json` |
| Stage 3 preview browser, before final route sequencing | Claude Sonnet 5 | 44 of 49 steps | `reports/browser-gateway-sonnet-5-stage3-preview-final/report-1788391560734.json` |
| Stage 3 preview browser, focused route verification | Claude Sonnet 5 | 6 of 8 matcher steps; all 3 tasks completed | `reports/browser-gateway-sonnet-5-stage3-preview-targeted/report-1788391864378.json` |
| Stage 2 final `/labor` browser | Claude Sonnet 5 | 8 of 8 steps | `reports/browser-gateway-sonnet-5-stage2-labor-post-contract/report-1788387668128.json` |
| Stage 2 gateway, first-call fixture | Claude Sonnet 5 | 16 of 17 cases | `gateway-claude-sonnet-5-first-call-stage2.json` |
| Stage 2 gateway, first-call fixture | Gemini 3.8 Flash | 17 of 17 cases | `gateway-gemini-3.8-flash-first-call-stage2.json` |
| Stage 2 gateway, first-call fixture | OpenAI GPT-5.6 Sol | 17 of 17 cases | `gateway-openai-gpt-5.6-sol-first-call-stage2.json` |
| Stage 2 gateway, first-call fixture | DeepSeek V4 Pro | 14 of 17 cases | `gateway-deepseek-v4-pro-first-call-stage2.json` |
| Stage 1 gateway, first-call fixture | Claude Sonnet 5 | 13 of 13 cases | `gateway-claude-sonnet-5-first-call-stage1.json` |
| Stage 1 preview browser, before route fix | Claude Sonnet 5 | 25 of 35 steps | `reports/browser-gateway-sonnet-5-stage1-preview-final/report-1788381425168.json` |
| Stage 1 preview browser, after route fix | Claude Sonnet 5 | 27 of 32 steps | `reports/browser-gateway-sonnet-5-stage1-preview-postfix/report-1788381859082.json` |
| Stage 1 final `/stock` browser | Claude Sonnet 5 | 5 of 5 steps | `reports/browser-gateway-sonnet-5-stage1-stock-final/report-1788382005653.json` |
| Local, original fixture | Claude Sonnet 5 | 1 of 17 steps | `reports/local-sonnet-rerun/report-1788321216670.json` |
| Local, first-call fixture | Claude Sonnet 5 | 8 of 8 steps | `reports/local-sonnet-first-call/report-1788321837675.json` |
| Browser, full chains | Claude Sonnet 5 | 17 of 17 steps | `reports/browser-sonnet-full-chains/report-1788322037677.json` |
| Production browser, original handoff fixture | Claude Sonnet 5 | 16 of 17 steps | `reports/browser-sonnet-production/report-1788364094659.json` |
| Production browser, truthful handoff fixture | Claude Sonnet 5 | 17 of 17 steps | `reports/browser-sonnet-production-corrected/report-1788364308035.json` |
| Gateway REST, first-call fixture | Gemini 3.7 Flash | Blocked, 0 scored | `gateway-gemini-3.7-first-call.json` |
| Gateway REST, credited first-call rerun | Gemini 3.7 Flash | 8 of 8 cases | `gateway-gemini-3.7-first-call-rerun.json` |
| Gateway REST, final first-call fixture | Claude Sonnet 5 | 8 of 8 cases | `gateway-claude-sonnet-5-first-call-round4-final.json` |
| Gateway REST, final first-call fixture | Gemini 3.8 Flash | 8 of 8 cases | `gateway-gemini-3.8-flash-first-call-round4-final.json` |
| Gateway REST, final first-call fixture | OpenAI GPT-5.6 Sol | 8 of 8 cases | `gateway-openai-gpt-5.6-sol-first-call-round4-final.json` |
| Gateway REST, final first-call fixture | DeepSeek V4 Pro | 8 of 8 cases | `gateway-deepseek-v4-pro-first-call-round4-final.json` |
| Production browser, final tool contracts | Claude Sonnet 5 | 17 of 17 steps | `reports/browser-gateway-sonnet-5-production-round4/report-1788369737764.json` |
| Production browser, final tool contracts | Gemini 3.8 Flash | 17 of 18 steps | `reports/browser-gateway-gemini-3.8-production-round4-final/report-1788370145603.json` |
| Production browser, final tool contracts | DeepSeek V4 Pro | 17 of 18 steps | `reports/browser-gateway-deepseek-v4-pro-production-round4-final/report-1788370267982.json` |

An earlier OpenAI run authenticated, but OpenAI rejected inference because the account had no API credits. That run produced no score.

The Gemini cross-check used `curl` against Vercel AI Gateway's Chat Completions endpoint. The gateway rejected all eight requests before inference. Five responses were HTTP 403 and three were HTTP 429. Each response classified the key as free tier without paid access to Gemini 3.7 Flash. The raw report records eight attempted cases and zero scored cases. The runner now stops after the first infrastructure error. No older Gemini model or OpenAI model was called through the gateway.

After credits became active, a separate Gemini 3.7 Flash rerun passed 8 of 8 cases. Every response made exactly one `get_order_context` call. The gateway reported 5,287 total tokens across the run. The credited rerun did not call OpenAI or an older Gemini model.

The first successful browser run used system Chrome against `https://cutoff-webmcp-n33qtur1x-ruttansh-bhatelias-projects.vercel.app/`. Each case started from a fresh page. The model completed these chains:

- `get_order_context` then `add_local_signal`
- `get_order_context`
- `get_order_context` then `add_local_signal` then `create_order_preview`
- `get_order_context` then `add_local_signal`
- `get_order_context` then `create_order_preview`, with no adoption call
- `get_order_context` then `save_handoff_receipt`
- `get_order_context` then `create_order_preview` then `adopt_order_preview`
- `get_order_context` then `create_order_preview`

The first production run used the canonical URL and scored 16 of 17 steps. Its handoff fixture asked the model to record a cancelled derby and updated draft on a fresh page where neither fact existed. Sonnet read the page and refused to save an inaccurate receipt. The fixture now asks for a truthful current-order reminder while preserving the required `get_order_context` then `save_handoff_receipt` chain. The single corrected production rerun passed 17 of 17 steps. Both reports remain in the repository.

## Final current-model cross-check

The final first-call suite used the production tool descriptions and schemas through Vercel AI Gateway. Claude Sonnet 5, Gemini 3.8 Flash, OpenAI GPT-5.6 Sol, and DeepSeek V4 Pro each passed 8 of 8 cases. The runner used the gateway's OpenAI-compatible REST endpoint through `curl`; no application dependency or API key entered the app bundle.

The final live browser suites used the canonical production page and its revisioned state. Sonnet passed all 17 expected steps. Gemini 3.8 Flash and DeepSeek V4 Pro each recorded 17 passes and one failure because they continued from `add_local_signal` to the safe, reversible `create_order_preview` call for the 80-person booking case. The fixture expected that case to stop after storing the signal. Neither model adopted the preview or performed an external action. The raw failures remain unchanged.

The final UI review then renamed serialized interaction provenance from inferred person labels to `page` and `tool`. This did not change a tool name, description, schema, revision rule, or engine result. The deterministic suite and a production 4-to-5-to-4 tool run cover that final boundary; the model reports were not rerun for a non-selection change.

## Expansion current-model cross-check

Stage 2 ran the 17-case first-call fixture through the same gateway harness. Gemini 3.8 Flash and GPT-5.6 Sol passed 17 of 17. Sonnet passed 16 of 17 after choosing the safe order-context prerequisite instead of direct line detail once. DeepSeek V4 Pro passed 14 of 17 after making conservative section reads. The final page-context Labor browser run passed 8 of 8 steps with Sonnet.

Stage 3 ran the clarified 19-case fixture through four current model families. GPT-5.6 Sol, Gemini 3.8 Flash, and DeepSeek V4 Pro passed 19 of 19. Sonnet passed 18 of 19: it made the correct `get_labor_plan` call and one additional parallel `get_order_context` read. The harness requires exactly one call for a first-call case, so that safe over-read remains a failure rather than being normalized away.

The two pre-correction Shift-log results also remain. Gemini scored 18 of 19 and DeepSeek 16 of 19 when “save a note” could truthfully mean either a handoff receipt or a shift note. The final fixture names the requested record. No tool description was tuned to a model response.

## Neutral browser trials

A clean Sol worker used the live WebMCP tools for context, previews, cancellation, adoption, verification, and the receipt. It used visible controls only for the booking and lettuce pins. The final preview matched 910 covers, 76 labor hours, and cost 2,795. Row focus kept adoption available. Pinning invalidated the old preview, and a new preview restored adoption.

A clean Terra worker reproduced the same business totals and completed the final receipt, but used visible controls for most mutations. That run is product evidence, not tool-selection evidence.

## Public auditor results

`npx ax webmcp-audit https://cutoff.localhost --json` ran once with `ax` 0.7.0 and its own unmodified Chrome. Ora rejected the capture before scoring because the CLI emitted capture shim version 1 while the scoring service requires version 2. `ora-webmcp-audit.json` records the blocked result. No preview URL was sent to Ora, and no retry was used.

The production URL was then audited through Ora's dedicated WebMCP audit. The final captured tool set scored 87 overall: Shared Experience 100, Task Completion 47, Tool Quality 100, and Trust 100. Ora classified all four base tools correctly as one read and three writes. The earlier trust findings are resolved: mutations explicitly declare `readOnlyHint: false`, human-authored content is marked untrusted where it can be returned, and tool descriptions state capabilities and result shapes without steering the caller.

Ora's task score is not a Cutoff task score. Its canonical intents were to open a document, add a summary paragraph, and save a share link, and the report classified the page as an editor. A forced run with a restaurant supplier-order goal still gave the live agent only `get_order_context`, even though the same report captured all four base tools. No document editor, sharing tool, sixth product tool, or weaker revision contract was added to improve that number. The exact public result and limitation are recorded in `ora-webmcp-audit.json`.

webmcp.com's public lookup API currently returns `supported: false` for the production host. A directory listing request requires a contact email and human review, so no listing claim or request is included in this package.
