# Cutoff

Cutoff is a restaurant supplier-order review built for the WebMCP Challenge. It helps a manager revise a working order when local facts change before cutoff. The page never sends an order to a supplier.

Live app: [cutoff-webmcp.vercel.app](https://cutoff-webmcp.vercel.app/)

## The problem

A saved forecast expects 1,140 covers because a derby match is scheduled nearby. The manager then learns that the match is cancelled and that a private booking will bring 80 guests. Neither fact is in the ordering system.

Cutoff gives the manager one shared order sheet for that exception. The manager pins local facts, asks their agent to run the page's deterministic ordering engine, checks every changed line, and decides whether to adopt the order preview.

## Who it is for

Cutoff is for quick-service restaurant managers who review stock and labor plans under a supplier deadline. The demo uses one fictional location and ten synthetic stock items.

## Product tour

1. The order sheet starts with 1,140 covers, 95 labor hours, and an order cost of 3,629 units.
2. The manager adds an 80-person booking by hand. Booking signals stay pinned across every preview.
3. Their agent reads the live sheet, including unsaved signals, pins, the focused row, and the current revision.
4. The agent adds the cancelled match and previews a new plan. The page shows 910 covers, 76 labor hours, and a cost of 2,767 units.
5. The manager can inspect the formula for any line, pin a quantity, adopt the order preview, and save a local handoff receipt.

The activity panel records page actions and direct WebMCP tool calls. A direct call shows its tool name; a browser-driven click appears as a page action because the page cannot reliably infer who drove the browser. Every line has a reason code, and every preview remains a proposal until the manager adopts it.

## Why WebMCP

The useful state exists inside the open page. It includes unsaved booking pins, quantity overrides, row focus, a live preview, and the current revision. A screenshot does not give an agent a reliable way to read that state or run the same calculation as the page.

WebMCP lets the agent read the live review and call the page's own deterministic actions. The manager and the agent see the same updated sheet after each call. Without WebMCP, the agent must infer table state from pixels and reproduce ordering math outside the product.

## WebMCP tools

| Tool | Purpose | Result |
|---|---|---|
| `get_order_context` | Reads the supplier-order state and gives the agent the revision rules. | Guide, dates, forecast, working order, lines, pins, signals, active preview id, and revision. |
| `add_local_signal` | Records a booking, event cancellation, or operational fact. | Signal id, stored kind and label, revision, and whether an earlier preview became stale. |
| `create_order_preview` | Runs the page's engine and shows a revisioned order preview. | Preview id, revision, covers, labor hours, line deltas and reasons, cost, and warnings. |
| `adopt_order_preview` | Adopts the current order preview. It exists only while that preview is current. | Revision, adopted totals, undo availability, and confirmation that no external action occurred. |
| `save_handoff_receipt` | Saves the manager's handoff summary in this browser. | Receipt id, revision, and local-save confirmation. |

The page registers four base tools. `adopt_order_preview` becomes the fifth tool only while a current preview exists. The tools stay on the order sheet because their availability depends on that page's live state. `/trajectory` does not register them. The tool catalog and registration code are in [`src/webmcp/`](src/webmcp/), with the `document.modelContext.registerTool` call in [`registerTools.ts`](src/webmcp/registerTools.ts).

## Run locally

Install dependencies and start the local HTTPS route:

```bash
npm install
npm run dev:portless
```

Open `https://cutoff.localhost`. On the first run, Portless asks macOS to trust its local certificate authority and to bind port 443.

For direct Vite testing, run:

```bash
npm run dev
```

The app feature-detects `document.modelContext`. It remains usable in a browser without WebMCP support.

## Test and build

Run the deterministic engine, store, adapter, and UI tests:

```bash
npm test
npm run build
```

Generate the tool schema from the same catalog used at runtime:

```bash
npm run evals:generate
```

Static evals check the required first read. Browser evals check full ordered tool chains against live state. Sonnet 5, Gemini 3.8 Flash, GPT-5.6 Sol, and DeepSeek V4 Pro each passed the final 8-of-8 first-call suite. Sonnet passed all 17 live browser steps; Gemini and DeepSeek each made one additional safe preview call and recorded 17 passes out of 18 expected steps. The raw results and failures are in [`evals/2026-09-02-run-summary.md`](evals/2026-09-02-run-summary.md).

Ora's production audit scored Shared Experience, Tool Quality, and Trust at 100. Its Task Completion score used document-editor intents that do not match this supplier-order page; the exact result and the custom live-agent limitation are preserved in [`evals/ora-webmcp-audit.json`](evals/ora-webmcp-audit.json). Cutoff does not add unrelated document or sharing tools to raise that score.

## Deploy

`npm run build` writes the static app to `dist/`. Serve that directory over HTTPS as a top-level page. Do not wrap the app in an iframe or set `Origin-Agent-Cluster: ?0`.

The app has no backend, authentication, API key, or model dependency. Environment keys used for evals never enter the application bundle.

## Demo prompts

1. Add `Private booking, 80 guests, 18:30` in the signals panel.
2. Ask, "Look at the Sat 5 Sep order. Why is it this big, and what would change it?"
3. Ask, "The derby has been cancelled. Add that and replan, but keep my booking."
4. Optional: focus lettuce, pin it at 4 cases, and ask for a new preview.
5. Ask, "Adopt this order preview as the working order. Don't send anything."
6. Ask, "Save a handoff note for the morning manager saying the derby was cancelled, the booking was kept, the working order was updated, and nothing was sent."
7. Open `/trajectory` to show the project record.

The timed recording plan is in [`DEMO.md`](DEMO.md).

## Data and affiliation

All locations, events, inventory, quantities, costs, and notes are synthetic. Cutoff is not affiliated with any restaurant, supplier, ordering platform, or agent provider. It contains no third-party logo or screenshot.

The manager controls every adoption. Receipts stay in the browser's local storage, and nothing in the app can contact a supplier.

## License

Cutoff is available under the [MIT License](LICENSE).
