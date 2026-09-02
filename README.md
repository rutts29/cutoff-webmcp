# Cutoff

Cutoff is a restaurant order-review desk built for the WebMCP Challenge. It helps a manager revise a supplier draft when local facts change before cutoff. The page never sends an order to a supplier.

## The problem

A saved forecast expects 1,140 covers because a derby match is scheduled nearby. The manager then learns that the match is cancelled and that a private booking will bring 80 guests. Neither fact is in the ordering system.

Cutoff gives the manager one shared order sheet for that exception. The manager pins local facts, asks their agent to run the page's deterministic ordering engine, checks every changed line, and decides whether to adopt the draft.

## Who it is for

Cutoff is for quick-service restaurant managers who review stock and labor plans under a supplier deadline. The demo uses one fictional location and ten synthetic stock items.

## Product tour

1. The order sheet starts with 1,140 covers, 95 labor hours, and an order cost of 3,629 units.
2. The manager adds an 80-person booking by hand. Booking signals stay pinned across every preview.
3. Their agent reads the live sheet, including unsaved signals, pins, the focused row, and the current revision.
4. The agent adds the cancelled match and previews a new plan. The page shows 910 covers, 76 labor hours, and a cost of 2,767 units.
5. The manager can inspect the formula for any line, pin a quantity, adopt the draft, and save a local handoff receipt.

The activity panel records both human actions and tool calls. Every line has a reason code, and every preview remains a proposal until the manager adopts it.

## Why WebMCP

The useful state exists inside the open page. It includes unsaved booking pins, quantity overrides, row focus, a live preview, and the current revision. A screenshot does not give an agent a reliable way to read that state or run the same calculation as the page.

WebMCP lets the agent read the live review and call the page's own deterministic actions. The manager and the agent see the same updated sheet after each call. Without WebMCP, the agent must infer table state from pixels and reproduce ordering math outside the product.

## WebMCP tools

| Tool | Purpose |
|---|---|
| `get_order_context` | Reads the current forecast, lines, signals, pins, preview, and revision. |
| `add_local_signal` | Adds a booking, event cancellation, or operator note to the review. |
| `preview_order_plan` | Runs the page's engine and renders a proposed order diff. |
| `adopt_order_draft` | Adopts the current preview. It exists only while that preview is current. |
| `save_handoff_receipt` | Saves a local receipt with the manager's summary and the final plan. |

The page registers four base tools. `adopt_order_draft` becomes the fifth tool only while a current preview exists. The tool catalog and registration code are in [`src/webmcp/`](src/webmcp/), with the `document.modelContext.registerTool` call in [`registerTools.ts`](src/webmcp/registerTools.ts).

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

Static evals check the required first read. Browser evals check the full ordered tool chains against live state. The saved results and limitations are in [`evals/2026-09-02-run-summary.md`](evals/2026-09-02-run-summary.md).

## Deploy

`npm run build` writes the static app to `dist/`. Serve that directory over HTTPS as a top-level page. Do not wrap the app in an iframe or set `Origin-Agent-Cluster: ?0`.

The app has no backend, authentication, API key, or model dependency. Environment keys used for evals never enter the application bundle.

## Demo prompts

1. Add `Private booking, 80 guests, 18:30` in the signals panel.
2. Ask, "Look at the Sat 5 Sep order. Why is it this big, and what would change it?"
3. Ask, "The derby has been cancelled. Add that and replan, but keep my booking."
4. Optional: focus lettuce, pin it at 4 cases, and ask for a new preview.
5. Ask, "Adopt this as the draft. Don't send anything."
6. Ask, "Save a handoff note for the morning manager saying the derby was cancelled, the booking was kept, the draft was updated, and nothing was sent."
7. Open `/trajectory` to show the project record.

The timed recording plan is in [`DEMO.md`](DEMO.md).

## Data and affiliation

All locations, events, inventory, quantities, costs, and notes are synthetic. Cutoff is not affiliated with any restaurant, supplier, ordering platform, or agent provider. It contains no third-party logo or screenshot.

The manager controls every adoption. Receipts stay in the browser's local storage, and nothing in the app can contact a supplier.

## License

Cutoff is available under the [MIT License](LICENSE).
