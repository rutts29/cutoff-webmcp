# Cutoff

Cutoff is a WebMCP shift operations desk for restaurant managers handling local changes before a supplier cutoff.

**Why WebMCP fits.** The state that matters (unsaved signals, shelf counts, pins, roster absences, preview IDs, one shared revision) lives in the page and is not recoverable from pixels. Tools expose it directly, on the page the manager is already looking at.

**Better experience.** The manager types a fact once, in plain words, and the agent runs the same deterministic engine the buttons run. Every result lands in the shared UI before anything can be adopted; adopt and undo stay with the human.

**Together, not before.** A manager and an agent can now revise an order, reconcile stock, and rebalance a roster in one session, on one revision, with the agent moving between pages via `open_section` and every write guarded by `expectedRevision`. Before, that meant a chatbot summarising a screenshot and a human re-typing numbers.

**Implementation.** Sixteen hand-built tools via `document.modelContext.registerTool`, registered per route with `AbortController` cleanup, dynamic adoption tools that exist only while a preview is current, `readOnlyHint` and `untrustedContentHint` set truthfully, stale-write errors that return the current revision, and result shapes stated in every description. Static React, no backend, no keys.

## Inspiration

A forecast can be internally correct and still miss what just happened on the floor: a nearby event was cancelled, a private booking arrived, a shelf count changed, or a staff member called out. Those facts affect the order and the roster together, but they often live in separate notes or in the manager's head.

Cutoff makes that exception work inspectable. The manager and their browser agent use the same revisioned state across Order, Stock, Labor, and Shift log.

## What it does

The Saturday scenario begins with 1,140 covers, 95 labor hours, and a 3,629-unit supplier order. The manager records an 80-person booking, and their agent adds a cancelled derby. Cutoff previews 910 covers, 76 hours, and a 2,767-unit order, with a reason on every line.

The manager can inspect the exact stock formula, pin a quantity, adopt or undo the order, count stock, log waste, record an absence, preview deterministic roster changes, and save a local handoff. The Shift log joins those actions into one downloadable service-day record. A rainy Tuesday preset proves the same engines work against a different seed.

No tool can transmit an order or update an external rota. Order and labor previews remain proposals until adopted, and every consequential local write requires the current shared revision.

## How we built it

Cutoff is a static React and TypeScript application. Each decision page has a small pure engine, while thin WebMCP adapters validate input, enforce revision rules, call one shared store, and return compact structured results. Human controls call the same store methods.

The page uses the imperative `document.modelContext.registerTool` API. Route changes keep `open_section` available while replacing only the old route-specific registrations, then expose the tools relevant to the page the manager is viewing. Order and Labor add their adoption tool only while a current preview exists.

This page-owned design matters because the agent needs state it cannot scrape reliably: unsaved signals, stock counts, quantity pins, roster absences, preview objects, and the shared revision. Hand-built tools carry that state directly instead of wrapping visible controls or a server API.

The tools form read and reversible-action layers. There is no sensitive external action because the application has no supplier, scheduling, account, or backend integration. Operator notes and handoff text are marked as untrusted content, and all tool descriptions state their result shapes.

## What WebMCP adds

Without WebMCP, an agent would have to interpret table pixels, miss unsaved local state, and reproduce the business math outside the product. With WebMCP, it reads the same store as the manager, supplies the revision it observed, and invokes the page's deterministic operations. Every result appears in the shared interface before the next decision.

The tool surface follows page state rather than advertising every capability everywhere: six Order tools at rest, four Stock tools, four Labor tools at rest, and three Shift log tools. Dynamic adoption tools appear only when their preview is current. `open_section` moves the visible page and returns the destination tool set.

## Challenges

The difficult part was not exposing functions. It was keeping preview, adoption, cross-page invalidation, undo, navigation, and tool registration truthful under one revision. A stock count must stale an order preview but not a labor preview. Order adoption must invalidate labor demand. Row focus must remain view-only. A route change must replace tools before the navigation result resolves.

We also kept the evaluation record honest. Static harnesses can measure the required first read but cannot supply live revision state; browser suites measure the ordered chains. Safe extra reads, infrastructure failures, and corrected fixtures remain in the public summary and ignored local raw reports.

## Accomplishments

- One client-side state model across four useful decision pages
- Exact deterministic order, stock, waste, labor, preset, export, and log tests
- Page-scoped and state-scoped WebMCP registration with abort cleanup
- Structured stale-write recovery and reversible local adoption
- Published first-call evidence keeps the strongest non-retried run per model: OpenAI, Gemini, and DeepSeek scored 19 of 19, while Sonnet scored 18 of 19. The September 4 refresh matched OpenAI, Gemini, and Sonnet; DeepSeek made the required read plus two safe extra reads and scored 18 of 19, so its labeled September 2 baseline remains published.
- A live production browser run completed all 21 business tasks and scored 46 of 48 strict matcher steps; the two misses came from one extra safe Stock read
- Accessible keyboard controls, responsive layouts, reduced-motion handling, and local-only storage

## What we learned

WebMCP is strongest when the page and the tools are designed together. The agent interface should expose state and outcomes that a screenshot cannot provide, while the visible interface gives the manager the same result and final control.

We also learned that page scope is part of the contract. Registering tools on unrelated pages would make discovery look broader but would weaken the shared-context model. Cutoff keeps each decision tool where that decision lives.

## What's next

The current submission stays synthetic and local. Future work could connect an explicitly approved data import, add waste exposure per order line, or test more service-day presets. None of those belongs in the current external-action boundary.

## Testing instructions (private Devpost field)

No app login or app key is needed. The app is static and keeps all state in the browser tab.

1. For agent testing, open https://cutoff-webmcp.vercel.app/ in the ChatGPT desktop in-app browser. For registration inspection in Chrome 149+, enable `chrome://flags/#enable-webmcp-testing` and reload the page.
2. To see the registered tools, click the cursor icon in the in-app browser's URL bar and expand "Available site tools." In Chrome, open DevTools > Application > WebMCP. That Chrome panel inspects registration only. For a model-driven Chrome run, use the [WebMCP Model Context Tool Inspector](https://chromewebstore.google.com/detail/webmcp-model-context-tool/gbpdfapgefenggkahomfgkhfehlcenpd); it asks for a Gemini API key. Order shows six tools at rest and seven while a preview exists. Stock shows four, Labor shows four at rest and five with a preview, and Shift log shows three.
3. Suggested first prompt on the Order page: "The derby has been cancelled and we have a private booking for 80. Add both to the order review, preview the replan, and tell me which lines changed and why." Expected: 1,140 to 910 covers, 95 to 76 hours, 3,629 to 2,767 units, a reason on every changed line, and `adopt_order_preview` appearing.
4. Then: "Adopt the preview." Followed by "Open the labor section. Rosa cannot make the prep shift. Record the absence and preview roster changes." Expected: two releases, one on-call cover, and Labor reading the adopted 910 covers.
5. Then on Stock: "Chicken is actually 30 kilos with 6 expiring. Record it." Then back on Order: "Preview the order again." Expected: chicken 15 to 16, cost 2,835.
6. Any mutation with a stale `expectedRevision` returns a structured error with the current revision. Visible controls and tools call the same store methods, so both paths share one revision and state.
7. "Reset demo" returns to seed. The header switches between the Saturday and Tuesday presets.

Nothing leaves the browser. There is no supplier, rota, or server integration to configure.

## Tested agents and clients (required Devpost field)

Google Chrome 152 with WebMCP enabled was used for production registration checks, the six-to-seven-to-six dynamic Order lifecycle, and a 21-task agent browser suite with Claude Sonnet 5. All 21 tasks completed; the strict matcher scored 46 of 48 because the model made one extra safe Stock read. The Chrome Model Context Tool Inspector also exercised live tools with Gemini.

Codex's in-app browser was used for route-scoped discovery and direct production tool calls, including order preview and adoption. GPT-5.6 Sol, Gemini 3.8 Flash, Claude Sonnet 5, and DeepSeek V4 Pro were also checked against the current tool catalog through the Vercel AI Gateway. ChatGPT's in-app browser will be added to this field only after the final recorded run succeeds.

## Screenshot assets

1. `docs/screenshots/01-order-overview.png`: the four-section desk and Saturday seed.
2. `docs/screenshots/02-order-preview.png`: cancelled derby plus the 80-person booking, with 910 covers, 76 hours, 2,767 units, and the new agent-change pill.
3. `docs/screenshots/03-labor-preview.png`: Rosa Alvarez's absence, two releases, Nadia Haddad's four-hour cover, and the accumulated agent-change count.
4. `docs/screenshots/04-stock-reconciliation.png`: chicken recorded at 30 kg on hand with 6 kg expiring, in the same shared revision.
5. `docs/screenshots/05-shift-log.png`: the complete service-day record with the Agent changes panel expanded to show direct links back to tool-written changes.

## Links

- Live app: https://cutoff-webmcp.vercel.app/
- Source: https://github.com/rutts29/cutoff-webmcp
- Demo video: pending public YouTube upload

All locations, people, events, inventory, quantities, and costs are fictional. Cutoff is not affiliated with any restaurant, supplier, workforce system, or agent provider.
