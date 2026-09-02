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
| Gateway REST, first-call fixture | Gemini 3.7 Flash | Blocked, 0 scored | `gateway-gemini-3.7-first-call.json` |
| Gateway REST, credited first-call rerun | Gemini 3.7 Flash | 8 of 8 cases | `gateway-gemini-3.7-first-call-rerun.json` |

An earlier OpenAI run authenticated, but OpenAI rejected inference because the account had no API credits. That run produced no score.

The Gemini cross-check used `curl` against Vercel AI Gateway's Chat Completions endpoint. The gateway rejected all eight requests before inference. Five responses were HTTP 403 and three were HTTP 429. Each response classified the key as free tier without paid access to Gemini 3.7 Flash. The raw report records eight attempted cases and zero scored cases. The runner now stops after the first infrastructure error. No older Gemini model or OpenAI model was called through the gateway.

After credits became active, a separate Gemini 3.7 Flash rerun passed 8 of 8 cases. Every response made exactly one `get_order_context` call. The gateway reported 5,287 total tokens across the run. The credited rerun did not call OpenAI or an older Gemini model.

The successful browser run used system Chrome against `https://cutoff-webmcp-n33qtur1x-ruttansh-bhatelias-projects.vercel.app/`. Each case started from a fresh page. The model completed these chains:

- `get_order_context` then `add_local_signal`
- `get_order_context`
- `get_order_context` then `add_local_signal` then `preview_order_plan`
- `get_order_context` then `add_local_signal`
- `get_order_context` then `preview_order_plan`, with no adoption call
- `get_order_context` then `save_handoff_receipt`
- `get_order_context` then `preview_order_plan` then `adopt_order_draft`
- `get_order_context` then `preview_order_plan`

## Neutral browser trials

A clean Sol worker used the live WebMCP tools for context, previews, cancellation, adoption, verification, and the receipt. It used visible controls only for the booking and lettuce pins. The final preview matched 910 covers, 76 labor hours, and cost 2,795. Row focus kept adoption available. Pinning invalidated the old preview, and a new preview restored adoption.

A clean Terra worker reproduced the same business totals and completed the final receipt, but used visible controls for most mutations. That run is product evidence, not tool-selection evidence.

## Ora audit

`npx ax webmcp-audit https://cutoff.localhost --json` ran once with `ax` 0.7.0 and its own unmodified Chrome. Ora rejected the capture before scoring because the CLI emitted capture shim version 1 while the scoring service requires version 2. `ora-webmcp-audit.json` records the blocked result. No preview URL was sent to Ora, and no retry was used.
