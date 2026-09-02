# Cutoff

Cutoff is a WebMCP supplier-order review for restaurant managers handling a late change before a supplier deadline.

## Why this fits WebMCP

The key facts exist only in the open page. They include an unsaved 80-person booking, quantity pins, the focused stock line, the current preview, and a monotonic revision. The agent must read that live state and run the page's own deterministic ordering engine.

A screenshot or copied table is not enough. It can miss an unsaved pin, become stale after one action, or force the agent to reproduce business math outside the product. WebMCP gives the agent narrow, typed access to the same review the manager sees.

Cutoff exposes five page-owned tools. Four are always available. The fifth, `adopt_order_preview`, registers only while a current preview exists. This dynamic tool lifecycle matches the action the manager can take at that moment.

## How the user experience improves

The manager starts with a saved plan for 1,140 covers, 95 labor hours, and an order cost of 3,629 units. They add an 80-person booking by hand, then tell their agent that the derby match is cancelled.

The agent reads the live review, adds the cancellation, and asks the page to preview a new plan. The visible sheet updates to 910 covers, 76 labor hours, and a cost of 2,767 units. Each of the ten lines shows its saved quantity, preview quantity, delta, and one reason code. Clicking a row opens the exact formula with real values.

Nothing is hidden behind a chat transcript. The tool call changes the shared page before the agent's next read. The manager can correct a quantity, preview again, adopt the order preview, undo adoption, and save a local receipt. The app also works as a normal order-review interface when WebMCP is unavailable.

## What the human and agent can do together

The manager contributes facts that the forecast cannot know. In the demo, they pin a private booking and may pin lettuce at four cases because the next delivery is unreliable. Their agent contributes speed and consistency. It reads the current state, adds the cancelled event, runs the deterministic preview, and saves the requested handoff.

The manager keeps every consequential choice. A preview never changes the saved plan. Adoption changes only the working order. No tool can submit or transmit an order, and every receipt states that nothing was sent outside the page.

The result is a shared exception review instead of a hand calculation or a blind recommendation. Both participants work against one revisioned sheet. The activity panel records exact WebMCP tool names; browser-driven UI interactions appear as `page action` because the page cannot reliably infer who drove the browser.

## How WebMCP was implemented

Cutoff uses the imperative `document.modelContext.registerTool` API in the top-level page. The registration module feature-detects WebMCP, registers through one lifecycle, and uses `AbortController` cleanup so React StrictMode does not leave duplicate tools.

The app is static and client-side. Registering tools from the page avoids a server whose only job would be an MCP endpoint, and keeps the order state in the manager's browser.

The tools are hand-built around page state an agent cannot scrape reliably: unsaved pins, the revision, the preview object, and the conditional adoption action. They are not generated from the visible controls or an API. `operator_note` also gives the agent a first-class way to record an operational fact that is absent from the forecast.

One answer tool reads the review. Four reversible action tools change local state. There is no sensitive action because the page cannot transmit an order.

Tool schemas reject unknown fields and keep free text bounded. Every mutating tool requires `expectedRevision`. A stale call returns a structured error with the current revision and a recovery instruction. `adopt_order_preview` also checks that the preview id and base revision still match.

The adapters are thin. They validate input, call one revisioned store, and shape compact output. The store calls a pure order engine that owns all demand, labor, quantity, cost, pin, and reason calculations. Human controls call the same store methods as WebMCP tools.

The test suite reproduces the locked ten-line table and totals. It also covers stale revisions, stale previews, registration cleanup, dynamic tool registration, storage failures, receipt reload, keyboard actions, and matching UI and tool transitions. Model-backed evals check both the required first read and the full live browser chains. Four current model families passed the final 8-of-8 first-call suite. Sonnet passed all 17 live browser steps; Gemini and DeepSeek each made one extra safe preview call without adopting or sending anything.

Ora's production audit scored Shared Experience, Tool Quality, and Trust at 100. Its Task Completion run classified Cutoff as a document editor and asked for paragraph editing and a share link. Those capabilities are outside this product, so the five tools remain focused on one answer flow and four reversible local actions.

## Submission links

- Live app: https://cutoff-webmcp.vercel.app/
- Source repository: https://github.com/rutts29/cutoff-webmcp
- Demo video: add after upload

All data is synthetic. Cutoff is not affiliated with any restaurant, supplier, ordering platform, or agent provider.
