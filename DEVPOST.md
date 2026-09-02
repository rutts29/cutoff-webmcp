# Cutoff

Cutoff is a WebMCP order-review desk for restaurant managers handling a late change before a supplier deadline.

## Why this fits WebMCP

The key facts exist only in the open page. They include an unsaved 80-person booking, quantity pins, the focused stock line, the current preview, and a monotonic revision. The agent must read that live state and run the page's own deterministic ordering engine.

A screenshot or copied table is not enough. It can miss an unsaved pin, become stale after one action, or force the agent to reproduce business math outside the product. WebMCP gives the agent narrow, typed access to the same review the manager sees.

Cutoff exposes five page-owned tools. Four are always available. The fifth, `adopt_order_draft`, registers only while a current preview exists. This dynamic tool lifecycle matches the action the manager can take at that moment.

## How the user experience improves

The manager starts with a saved plan for 1,140 covers, 95 labor hours, and an order cost of 3,629 units. They add an 80-person booking by hand, then tell their agent that the derby match is cancelled.

The agent reads the live review, adds the cancellation, and asks the page to preview a new plan. The visible sheet updates to 910 covers, 76 labor hours, and a cost of 2,767 units. Each of the ten lines shows its saved quantity, preview quantity, delta, and one reason code. Clicking a row opens the exact formula with real values.

Nothing is hidden behind a chat transcript. The tool call changes the shared page before the agent's next read. The manager can correct a quantity, preview again, adopt the draft, undo adoption, and save a local receipt. The app also works as a normal order-review interface when WebMCP is unavailable.

## What the human and agent can do together

The manager contributes facts that the forecast cannot know. In the demo, they pin a private booking and may pin lettuce at four cases because the next delivery is unreliable. Their agent contributes speed and consistency. It reads the current state, adds the cancelled event, runs the deterministic preview, and saves the requested handoff.

The manager keeps every consequential choice. A preview never changes the saved plan. Adoption changes only the working draft. No tool can submit or transmit an order, and every receipt states that nothing was sent outside the page.

The result is a shared exception review instead of a hand calculation or a blind recommendation. Both participants work against one revisioned sheet, and the activity panel records who did what.

## How WebMCP was implemented

Cutoff uses the imperative `document.modelContext.registerTool` API in the top-level page. The registration module feature-detects WebMCP, registers through one lifecycle, and uses `AbortController` cleanup so React StrictMode does not leave duplicate tools.

Tool schemas reject unknown fields and keep free text bounded. Every mutating tool requires `expectedRevision`. A stale call returns a structured error with the current revision and a recovery instruction. `adopt_order_draft` also checks that the preview id and base revision still match.

The adapters are thin. They validate input, call one revisioned store, and shape compact output. The store calls a pure order engine that owns all demand, labor, quantity, cost, pin, and reason calculations. Human controls call the same store methods as WebMCP tools.

The test suite reproduces the locked ten-line table and totals. It also covers stale revisions, stale previews, registration cleanup, dynamic tool registration, storage failures, receipt reload, keyboard actions, and matching human and tool transitions. Model-backed evals check both the required first read and the full live browser chains.

## Submission links

- Live app: add after GO LIVE
- Source repository: https://github.com/rutts29/cutoff-webmcp
- Demo video: add after upload

All data is synthetic. Cutoff is not affiliated with any restaurant, supplier, ordering platform, or agent provider.
