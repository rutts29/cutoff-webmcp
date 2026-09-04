# Cutoff

Cutoff is a WebMCP shift operations desk for restaurant managers handling local changes before a supplier cutoff.

**Tagline:** One revisioned restaurant desk where a manager and browser agent replan order, stock, labor, and handoff before cutoff.

**Built with:** WebMCP, React, TypeScript, Vite, Portless, Vitest, and Vercel.

**Why WebMCP fits.** The state that matters—unsaved signals, shelf counts, pins, roster absences, preview IDs, and one shared revision—lives in the page and cannot be recovered reliably from pixels. WebMCP exposes it directly where the manager is already working.

**Better experience.** The manager states a fact once in plain language, and the agent runs the same deterministic engine as the visible controls. Results land in the shared UI before adoption; final approval and undo stay with the manager.

**People and agents together.** A manager and agent can revise an order, reconcile stock, rebalance a roster, and leave a handoff in one session, with the agent moving between pages through `open_section`. Before, an agent could summarize a screenshot, but the manager still had to re-enter numbers across separate workflows.

**Implementation.** Cutoff uses 16 hand-built tools registered with `document.modelContext.registerTool`. Registrations are route-scoped and use `AbortController` cleanup. Adoption tools exist only while their preview is current. Mutations require `expectedRevision`; stale writes return a structured recovery error. `readOnlyHint` and `untrustedContentHint` reflect actual behavior. The app is static React and TypeScript with no backend or application keys.

## Inspiration

A forecast can be internally correct and still miss what just happened on the floor: a nearby event was cancelled, a private booking arrived, a shelf count changed, or a staff member called out. Those facts affect the order and roster together but often live in separate notes or in the manager's head.

Cutoff makes that exception work inspectable across Order, Stock, Labor, and Shift log.

## What it does

The Saturday scenario starts with 1,140 covers, 95 labor hours, and a 3,629-unit supplier order. An 80-person booking and a cancelled derby produce a preview of 910 covers, 76 hours, and a 2,767-unit order, with a reason on every changed line.

The manager can inspect stock math, pin a quantity, adopt or undo an order, record counts and waste, record an absence, preview roster changes, and save a local handoff. The Shift log joins those actions into one downloadable service-day record. A rainy Tuesday preset exercises the same engines against a different seed.

No tool can transmit an order or update an external rota. Order and labor previews remain proposals until adopted, and every consequential local write requires the current shared revision.

## How we built it

Each decision page has a small pure engine. Thin WebMCP adapters validate input, enforce revision rules, call one shared browser store, and return compact structured results. Human controls call the same store methods.

Route changes keep `open_section` available while replacing the previous route's registrations. Order and Labor add an adoption tool only while a current preview exists. This page-owned design exposes state that an agent cannot scrape reliably without turning the product into a server API wrapper.

## Challenges and lessons

The hard part was keeping previews, adoption, invalidation, undo, navigation, and tool registration truthful under one revision. A stock count must stale an order preview but not a labor preview. Order adoption must invalidate labor demand. A route change must replace tools before navigation resolves.

We also separated static first-call evaluation from ordered browser execution. Static fixtures can measure the required first read; only a browser can supply the revision returned by that read to the next mutation. Extra safe reads and retained baselines remain explicit in the public evaluation summary.

WebMCP works best when the page and tools are designed together: tools expose state and outcomes that screenshots cannot, while the visible interface keeps the human in control.

## Accomplishments

- One revisioned client-side state model across four decision pages
- Deterministic order, stock, waste, labor, preset, export, and log behavior
- Route-scoped and state-scoped registration with dynamic adoption tools
- Structured stale-write recovery and reversible local adoption
- 111 deterministic tests and a clean production build
- First-call results of 19/19 for OpenAI, Gemini, and DeepSeek, and 18/19 for Sonnet, with the retained DeepSeek baseline explained publicly
- A 21-task production browser run with all tasks completed and 46/48 strict steps; one extra safe Stock read caused both strict misses
- Accessible keyboard controls, responsive layouts, reduced motion, and local-only storage

## Testing instructions (private Devpost field)

No login or app key is needed. The app is static and keeps its state in the browser tab.

1. Open https://cutoff-webmcp.vercel.app/ in ChatGPT's in-app browser. For registration inspection in Chrome 149+, enable `chrome://flags/#enable-webmcp-testing`, reload, and open **DevTools > Application > WebMCP**. The Chrome panel inspects registration; the optional [WebMCP Model Context Tool Inspector](https://chromewebstore.google.com/detail/webmcp-model-context-tool/gbpdfapgefenggkahomfgkhfehlcenpd) can run model-driven calls with a Gemini API key.
2. Order exposes 6 tools at rest and 7 while a preview is current. Stock exposes 4, Labor exposes 4 at rest and 5 with a preview, and Shift log exposes 3.
3. On Order, enter an 80-person private booking, then prompt: “The derby has been cancelled. Add that to the order review and replan, but keep my booking.” Expected: 1,140 to 910 covers, 95 to 76 hours, 3,629 to 2,767 units, reasons on changed lines, and `adopt_order_preview` appearing.
4. Prompt: “Adopt the current order preview. Do not send anything outside this page.” Then: “Open the labor section. Rosa cannot make prep. Record her absence, preview the roster changes, and leave the proposal for me to review.” Expected: two releases, one on-call cover, and Labor using the adopted 910 covers.
5. Prompt: “Open the stock section. Chicken is actually 30 kilos on hand and 6 kilos expire before service. Record that count.” Return to Order and preview again. Expected: chicken 15 to 16 cases and cost 2,835.
6. A mutation with a stale `expectedRevision` returns a structured error containing the current revision. **Reset demo** restores the selected preset's seed.

Nothing leaves the browser. There is no supplier, rota, account, or server integration to configure.

## Tested agents and clients (required Devpost field)

The final production demo was recorded in ChatGPT's in-app browser. It shows ordinary user prompts leading to route-scoped discovery, order preview and adoption, agent-driven navigation, Labor and Stock writes, a local handoff, and Shift-log JSON download.

Google Chrome 152 with WebMCP enabled was used for production registration checks, the 6→7→6 Order lifecycle, and a 21-task browser suite with Claude Sonnet 5. All 21 tasks completed; the strict matcher scored 46/48 after one extra safe Stock read. The Chrome Model Context Tool Inspector also exercised live tools with Gemini.

GPT-5.6 Sol, Gemini 3.8 Flash, Claude Sonnet 5, and DeepSeek V4 Pro were checked against the current catalog through the Vercel AI Gateway. Codex's in-app browser was also used for direct production calls during development.

## AI tools used (required Devpost field)

OpenAI Codex with GPT-5.6 Sol was used for implementation, test design, debugging, UI iteration, browser checks, security review, and release verification. Claude Sonnet 5, Gemini 3.8 Flash, and DeepSeek V4 Pro were used through the Vercel AI Gateway for first-call tool-selection evaluation. ChatGPT's in-app browser ran the final product demo. ffmpeg and Remotion were used to edit the screen recording; neither is a product runtime dependency.

## Screenshot assets

1. `docs/screenshots/01-order-overview.png` — the four-section desk and Saturday seed.
2. `docs/screenshots/02-order-preview.png` — the 910-cover, 76-hour, 2,767-unit preview and agent-change pill.
3. `docs/screenshots/03-labor-preview.png` — Rosa Alvarez's absence, two releases, Nadia Haddad's 4-hour cover, and accumulated agent changes.
4. `docs/screenshots/04-stock-reconciliation.png` — chicken at 30 kg on hand with 6 kg expiring in the shared revision.
5. `docs/screenshots/05-shift-log.png` — the service-day record with direct links to tool-written changes.

## Links

- Live app: https://cutoff-webmcp.vercel.app/
- Source: https://github.com/rutts29/cutoff-webmcp
- Demo video: https://www.youtube.com/watch?v=PGvSlkhThFQ

All locations, people, events, inventory, quantities, and costs are fictional. Cutoff is not affiliated with any restaurant, supplier, workforce system, or agent provider.
