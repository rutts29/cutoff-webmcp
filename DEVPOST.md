# Cutoff

Cutoff is a WebMCP shift operations desk for restaurant managers handling local changes before a supplier cutoff.

## Inspiration

A forecast can be internally correct and still miss what just happened on the floor: a nearby event was cancelled, a private booking arrived, a shelf count changed, or a staff member called out. Those facts affect the order and the roster together, but they often live in separate notes or in the manager's head.

Cutoff makes that exception work inspectable. The manager and their browser agent use the same revisioned state across Order, Stock, Labor, and Shift log.

## What it does

The Saturday scenario begins with 1,140 covers, 95 labor hours, and a 3,629-unit supplier order. The manager records an 80-person booking, and their agent adds a cancelled derby. Cutoff previews 910 covers, 76 hours, and a 2,767-unit order, with a reason on every line.

The manager can inspect the exact stock formula, pin a quantity, adopt or undo the order, count stock, log waste, record an absence, preview deterministic roster changes, and save a local handoff. The Shift log joins those actions into one downloadable service-day record. A rainy Tuesday preset proves the same engines work against a different seed.

No tool can transmit an order or update an external rota. Order and labor previews remain proposals until adopted, and every consequential local write requires the current shared revision.

## How we built it

Cutoff is a static React and TypeScript application. Each decision page has a small pure engine, while thin WebMCP adapters validate input, enforce revision rules, call one shared store, and return compact structured results. Human controls call the same store methods.

The page uses the imperative `document.modelContext.registerTool` API. Route changes abort the old registration set and expose only the tools relevant to the page the manager is viewing. Order and Labor add their adoption tool only while a current preview exists.

This page-owned design matters because the agent needs state it cannot scrape reliably: unsaved signals, stock counts, quantity pins, roster absences, preview objects, and the shared revision. Hand-built tools carry that state directly instead of wrapping visible controls or a server API.

The tools form read and reversible-action layers. There is no sensitive external action because the application has no supplier, scheduling, account, or backend integration. Operator notes and handoff text are marked as untrusted content, and all tool descriptions state their result shapes.

## What WebMCP adds

Without WebMCP, an agent would have to interpret table pixels, miss unsaved local state, and reproduce the business math outside the product. With WebMCP, it reads the same store as the manager, supplies the revision it observed, and invokes the page's deterministic operations. Every result appears in the shared interface before the next decision.

The tool surface follows page state rather than advertising every capability everywhere: six Order tools at rest, four Stock tools, four Labor tools at rest, and three Shift log tools. Dynamic adoption tools appear only when their preview is current. `open_section` moves the visible page and returns the destination tool set.

## Challenges

The difficult part was not exposing functions. It was keeping preview, adoption, cross-page invalidation, undo, navigation, and tool registration truthful under one revision. A stock count must stale an order preview but not a labor preview. Order adoption must invalidate labor demand. Row focus must remain view-only. A route change must replace tools before the navigation result resolves.

We also kept the evaluation record honest. Static harnesses can measure the required first read but cannot supply live revision state; browser suites measure the ordered chains. Safe extra reads, infrastructure failures, and corrected fixtures remain in the raw reports.

## Accomplishments

- One client-side state model across four useful decision pages
- Exact deterministic order, stock, waste, labor, preset, export, and log tests
- Page-scoped and state-scoped WebMCP registration with abort cleanup
- Structured stale-write recovery and reversible local adoption
- Current-model first-call checks through a separate eval harness
- Accessible keyboard controls, responsive layouts, reduced-motion handling, and local-only storage

## What we learned

WebMCP is strongest when the page and the tools are designed together. The agent interface should expose state and outcomes that a screenshot cannot provide, while the visible interface gives the manager the same result and final control.

We also learned that page scope is part of the contract. Registering tools on unrelated pages would make discovery look broader but would weaken the shared-context model. Cutoff keeps each decision tool where that decision lives.

## What's next

The current submission stays synthetic and local. Future work could connect an explicitly approved data import, add waste exposure per order line, or test more service-day presets. None of those belongs in the current external-action boundary.

## Links

- Live app: https://cutoff-webmcp.vercel.app/
- Source: https://github.com/rutts29/cutoff-webmcp
- Demo video: add after upload

All locations, people, events, inventory, quantities, and costs are fictional. Cutoff is not affiliated with any restaurant, supplier, workforce system, or agent provider.
