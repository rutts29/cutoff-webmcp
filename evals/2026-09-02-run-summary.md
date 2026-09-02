# WebMCP eval run summary

Date: 2026-09-02

## Eval contract

`schema.json` contains five definitions generated from the same catalog as the registration module. The schema drift test passes.

Mutating tools require `expectedRevision` from `get_order_context` or a prior mutation result. `cases.local.json` therefore checks only the first call with `--max-steps 1`. `cases.json` checks the full ordered chains against the live page.

The first fixture version omitted the required read step. Sonnet read the state before each mutation, but the matcher marked that safe read as an unexpected call. The corrected fixture records the read as part of the contract. No stale-write guard or vendor-specific hint changed.

## Raw results

| Mode | Model | Result | Report |
|---|---|---:|---|
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

## Neutral browser trials

A clean Sol worker used the live WebMCP tools for context, previews, cancellation, adoption, verification, and the receipt. It used visible controls only for the booking and lettuce pins. The final preview matched 910 covers, 76 labor hours, and cost 2,795. Row focus kept adoption available. Pinning invalidated the old preview, and a new preview restored adoption.

A clean Terra worker reproduced the same business totals and completed the final receipt, but used visible controls for most mutations. That run is product evidence, not tool-selection evidence.

## Public auditor results

`npx ax webmcp-audit https://cutoff.localhost --json` ran once with `ax` 0.7.0 and its own unmodified Chrome. Ora rejected the capture before scoring because the CLI emitted capture shim version 1 while the scoring service requires version 2. `ora-webmcp-audit.json` records the blocked result. No preview URL was sent to Ora, and no retry was used.

The production URL was then audited through Ora's dedicated WebMCP audit. The final captured tool set scored 87 overall: Shared Experience 100, Task Completion 47, Tool Quality 100, and Trust 100. Ora classified all four base tools correctly as one read and three writes. The earlier trust findings are resolved: mutations explicitly declare `readOnlyHint: false`, human-authored content is marked untrusted where it can be returned, and tool descriptions state capabilities and result shapes without steering the caller.

Ora's task score is not a Cutoff task score. Its canonical intents were to open a document, add a summary paragraph, and save a share link, and the report classified the page as an editor. A forced run with a restaurant supplier-order goal still gave the live agent only `get_order_context`, even though the same report captured all four base tools. No document editor, sharing tool, sixth product tool, or weaker revision contract was added to improve that number. The exact public result and limitation are recorded in `ora-webmcp-audit.json`.

webmcp.com's public lookup API currently returns `supported: false` for the production host. A directory listing request requires a contact email and human review, so no listing claim or request is included in this package.
