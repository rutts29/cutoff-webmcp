# Cutoff

Cutoff is a WebMCP shift operations desk for a fictional restaurant. A manager and their browser agent can revise the supplier order, reconcile stock and waste, adjust labor, and leave one service-day record without sending anything to a supplier or rota.

[Live app](https://cutoff-webmcp.vercel.app/) · [2:48 demo with audio](https://www.youtube.com/watch?v=PGvSlkhThFQ) · [Build record](https://cutoff-webmcp.vercel.app/trajectory)

All names, dates, stock, costs, bookings, and events are synthetic.

## The operating problem

A saved forecast can miss facts that exist only on the floor: a cancelled event, a late booking, a shelf count, or an absence. Those facts affect more than one plan. Cutoff keeps them in one revisioned browser store so that the manager and agent work from the same state on every page.

The Saturday preset starts at 1,140 covers, 95 labor hours, and a 3,629-unit supplier order. An 80-person booking and a cancelled derby produce a preview of 910 covers, 76 required hours, and a 2,767-unit order. A later chicken count changes the recommendation from 15 to 16 cases and the preview cost to 2,835 units.

## What the desk does

- **Order:** record local signals or quantity pins, preview the deterministic replan, inspect line math, then adopt or undo the working order.
- **Stock:** record shelf counts and waste against the same catalogue. A new count makes an older order preview stale.
- **Labor:** compare the adopted order's covers with scheduled shifts by daypart, then preview releases or on-call cover. Labor never reads demand from an unapproved order preview.
- **Shift log:** read and filter the newest activity, add a note, or download the filtered service-day record as JSON.

Switching between the derby Saturday and rainy Tuesday presets is a full reset to that service day's synthetic seed at revision 0.

## Why WebMCP

The useful state is not all visible in the DOM. It includes live counts, unsaved signals, pins, roster absences, preview identifiers, and one revision shared across routes. Scraping pixels cannot reliably recover that state or run the page's calculations.

Cutoff registers hand-built tools with `document.modelContext.registerTool`. Each route exposes only the tools relevant to the page the manager is viewing. The two adoption tools appear only while their preview is current, and `open_section` changes the visible route and its tool set before resolving.

The app is static and client-side. Visible controls and tool calls use the same store methods. Every mutation requires an `expectedRevision`; a stale write returns the current revision instead of silently overwriting newer work. Human-authored text is marked as untrusted where it enters tool results.

## WebMCP tools

The catalog contains **16 unique tool names**. Order exposes 6 tools at rest and 7 with a current preview; Stock exposes 4; Labor exposes 4 at rest and 5 with a current preview; Shift log exposes 3. `open_section` is one shared tool registered on every decision page. `/trajectory` registers none.

<details>
<summary><strong>Order — 6 at rest, 7 with a preview</strong></summary>

- `get_order_context` reads the complete order state and revision.
- `get_line_detail` explains one SKU's inventory and safety math.
- `add_local_signal` records a booking, cancellation, or operator note.
- `create_order_preview` creates a reasoned, revisioned proposal.
- `save_handoff_receipt` stores a bounded local manager summary.
- `open_section` moves to another decision page.
- `adopt_order_preview` appears only while the active preview is adoptable.

</details>

<details>
<summary><strong>Stock — 4</strong></summary>

- `get_stock_status` reads counts, waste, staleness, and revision.
- `record_stock_count` records on-hand and expiring quantities.
- `log_waste` records a local waste entry and its cost effect.
- `open_section` moves to another decision page.

</details>

<details>
<summary><strong>Labor — 4 at rest, 5 with a preview</strong></summary>

- `get_labor_plan` reads working-order demand, shifts, gaps, and signals.
- `add_labor_signal` records an absence or extra shift.
- `create_labor_preview` proposes deterministic releases or cover.
- `open_section` moves to another decision page.
- `adopt_labor_plan` appears only while the active preview is adoptable.

</details>

<details>
<summary><strong>Shift log — 3</strong></summary>

- `get_shift_log` reads newest activity with optional filtering.
- `add_shift_note` adds one bounded service-day note.
- `open_section` moves to another decision page.

</details>

Exact input schemas, behavior hints, and result descriptions are generated from the runtime catalog into [`evals/schema.json`](evals/schema.json). WebMCP does not define a standard `outputSchema` field.

## Run locally

```bash
npm install
npm run dev:portless
```

Open `https://cutoff.localhost`. Portless may ask macOS to trust its local certificate authority and bind port 443 on first use. `npm run dev` starts direct Vite for isolated debugging.

## Test and evidence

```bash
npm run evals:generate
npm test -- --run
npm run build
```

The deterministic suite has 111 tests across the engines, shared revision rules, storage, exports, registration, accessibility, and UI transitions. Model-backed first-call evaluation uses the Vercel AI Gateway only as eval transport; no model key enters the app bundle. Current results and limitations are in the [evaluation summary](evals/2026-09-02-run-summary.md).

Independent checks: [webmcp.com graded the production site A](https://webmcp.com/report/6d9b889b-a122-4c21-85fa-c327f2f28a24), detecting its 14 at-rest tools; the two dynamic adoption tools complete the 16-tool catalog. [Ora scored it 86](https://webmcp.ora.ai/cutoff-webmcp.vercel.app), with 100 for Shared Experience and Trust and 99 for Tool Quality. Ora's lower Tool Selection score came from classifying Cutoff as a document editor and generating unrelated tasks; the limitation is recorded without adding capabilities the product does not need.

## Boundaries and project record

Order CSV, Shift-log JSON, and handoff receipts stay in the browser. No action submits an order, updates a rota, contacts a supplier, or writes to a server.

Submission copy and testing instructions are in [`DEVPOST.md`](DEVPOST.md). The final demo flow is in [`DEMO.md`](DEMO.md), implementation history is in [`CHANGELOG.md`](CHANGELOG.md), and the source is available under the [MIT License](LICENSE).
