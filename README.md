# Cutoff

Cutoff is a four-section shift operations desk for a fictional restaurant. A manager and their browser agent can revise the supplier order, reconcile stock and waste, adjust labor, and leave one service-day record without sending data to a supplier.

Live app: [cutoff-webmcp.vercel.app](https://cutoff-webmcp.vercel.app/)

All names, dates, stock, costs, bookings, and events are synthetic.

## The operating problem

A saved forecast can miss facts that exist only on the floor: a cancelled event, a late booking, a shelf count, or an absence. Those facts affect more than one plan. Cutoff keeps them in one revisioned browser store so that the manager and agent work from the same state on every page.

The Saturday preset starts at 1,140 covers, 95 labor hours, and a 3,629-unit supplier order. Recording an 80-person booking and a cancelled derby produces a preview of 910 covers, 76 required labor hours, and a 2,767-unit order. The manager can inspect every line, adopt or undo proposals, and leave a local handoff.

## Workflows

**Order.** Record a booking, event cancellation, operational note, or quantity pin; preview the deterministic replan; inspect line math and reasons; then adopt or undo the working order. A preview is a proposal. It never changes the working order on its own.

**Stock.** Record shelf counts and waste against the same stock catalogue. Counts feed the order engine, and a count made after an order preview marks that preview stale. The weekly waste summary shows cost by reason without adding a backend or transmitting a record.

**Labor.** Compare the working order's covers with scheduled shifts by lunch, dinner, and prep. Absences and extra shifts produce a deterministic preview of releases or on-call cover. Labor reads the adopted working order, not an unapproved order preview.

**Shift log.** Read the newest signals, pins, previews, adoptions, counts, waste, receipts, section changes, and notes in one service-day record. Filter by section, add a note, or download the filtered rows as JSON.

The header switches between a derby Saturday and a rainy Tuesday. Changing the preset is a full reset to that service day's synthetic seed at revision 0; it clears previews, undo state, and receipts.

## Why WebMCP

The useful state is not all visible in the DOM. It includes live counts, unsaved signals, quantity pins, labor signals, preview identifiers, and one monotonic revision shared across routes. Scraping pixels cannot reliably recover that state or run the same calculations as the page.

Cutoff exposes hand-built tools for those decisions. Tools are registered only for the page the manager is looking at, and dynamic adoption tools exist only while their page has a current preview. `open_section` moves the manager and replaces the route's tool set before it resolves. This is page-owned functionality, not an API wrapper.

The app is static and client-side. It needs no MCP server, application API key, account, or supplier connection. Direct tool calls and visible controls use the same store methods. Mutations require an `expectedRevision`; stale writes return a structured recovery error.

## Tools by page

| Page | Tool | WebMCP hints | Purpose and result |
|---|---|---|---|
| Order | `get_order_context` | Read-only; untrusted content | Reads the complete order context, preset, guidance, current revision, signals, pins, and working plan. |
| Order | `get_line_detail` | Read-only | Explains one SKU with inventory inputs, calculated and pinned cases, reason, and safety math. |
| Order | `add_local_signal` | Read-only: no; untrusted content | Records a booking, event cancellation, or operator note and reports the new revision and preview state. |
| Order | `create_order_preview` | Read-only: no | Creates a revisioned proposal with covers, labor, line deltas, cost, reasons, and warnings. |
| Order | `adopt_order_preview` | Read-only: no | Adopts the current proposal into the working order while it is current and confirms that no external action occurred. |
| Order | `save_handoff_receipt` | Read-only: no; untrusted content | Stores a manager summary in this browser and returns the receipt id, preset, and revision. |
| Stock | `get_stock_status` | Read-only; untrusted content | Reads counts, last-counted times, waste totals, preview staleness, and revision. |
| Stock | `record_stock_count` | Read-only: no | Records on-hand and expiring quantities and reports whether an order preview was invalidated. |
| Stock | `log_waste` | Read-only: no; untrusted content | Adds a waste entry, updates on-hand stock, and returns item and weekly cost effects. |
| Labor | `get_labor_plan` | Read-only; untrusted content | Reads working-order covers, required hours, roster gaps, shifts, on-call staff, signals, and revision. |
| Labor | `add_labor_signal` | Read-only: no; untrusted content | Records an absence or extra shift and reports whether a labor preview was invalidated. |
| Labor | `create_labor_preview` | Read-only: no | Creates release and cover proposals by daypart with before-and-after staffing totals. |
| Labor | `adopt_labor_plan` | Read-only: no | Applies the current roster proposal while it is current and keeps one undo point. |
| Shift log | `get_shift_log` | Read-only; untrusted content | Reads newest activity with an optional section filter and limit. |
| Shift log | `add_shift_note` | Read-only: no; untrusted content | Adds one bounded service-day note without invalidating either preview. |
| Every decision page | `open_section` | Read-only: no | Moves the visible page and returns the destination tool names and shared revision. |

Order registers six tools at rest and seven with an adoptable preview. Stock registers four. Labor registers four at rest and five with an adoptable preview. Shift log registers three. `/trajectory` registers none.

WebMCP has no standard `outputSchema` field. Each description states its result shape, and [`evals/schema.json`](evals/schema.json) is generated from the same catalog used by runtime registration.

## Engine rules

Each decision page has a small pure engine. The order engine calculates demand, removes usable and inbound stock, applies safety, rounds to cases, and keeps one reason per line. The stock engine validates counts and prices waste from each item's unit cost. The labor engine derives required hours with `ceil(covers / 12)`, splits them across dayparts, and proposes deterministic releases or on-call cover. The CSV exporter serializes only the working order, never an unapproved preview.

## Run locally

Install dependencies and start the required local HTTPS route:

```bash
npm install
npm run dev:portless
```

Open `https://cutoff.localhost`. Portless may ask macOS to trust its local certificate authority and bind port 443 on the first run.

`npm run dev` starts direct Vite for isolated debugging. A direct `127.0.0.1` URL is not accepted as the Portless test rung.

## Test and build

```bash
npm run evals:generate
npm test -- --run
npm run build
```

The current deterministic suite covers all locked order, stock, waste, labor, preset, shift-log, CSV, store, adapter, registration, accessibility, and UI transitions. The model-backed first-call suite uses the Vercel AI Gateway only as an eval transport; no model key enters the application bundle.

Static first-call evaluation measures whether a model starts from the required page state. Full ordered selection is measured in a real browser because mutations need the revision returned by a prior tool. Raw successes, safe over-reads, infrastructure failures, and fixture corrections remain in [`evals/2026-09-02-run-summary.md`](evals/2026-09-02-run-summary.md).

## Independent WebMCP audit

[Ora's Sep 3 production report](https://webmcp.ora.ai/cutoff-webmcp.vercel.app) scored 87 overall: Shared Experience 100, Task Completion 47, Tool Quality 99, and Trust 100. It captured all six Order tools, including two reads and four actions, with no registration error.

The 47-point task score came from document-editor tests: open a recent document, insert a paragraph, then save and share it. Those are not Cutoff tasks. Ora's custom restaurant run also offered its live model only the two read tools, although the same report captured all six. By comparison, the production browser suite discovered the live page tools and completed all 21 Cutoff tasks, scoring 46 of 48 strict matcher steps after one extra safe Stock read. The remaining quality warning says `open_section` does not begin with a verb, while Ora's suggested fix repeats the same name. The tool remains unchanged because "open" is its verb and the name states the action accurately.

## Downloads and storage

The Order page downloads the current working order as CSV. Shift log downloads filtered activity as JSON. Handoff receipts use bounded local storage. No action submits an order, updates a rota, contacts a supplier, or writes to a server.

## Project record

The human-readable build record is at [`/trajectory`](https://cutoff-webmcp.vercel.app/trajectory). Source decisions and test evidence are in [`CHANGELOG.md`](CHANGELOG.md), while the timed recording plan is in [`DEMO.md`](DEMO.md).

## License

Cutoff is available under the [MIT License](LICENSE).
