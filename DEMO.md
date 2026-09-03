# Cutoff demo plan

Target length: 2 minutes 39 seconds.

Run the main demo against production in ChatGPT's in-app browser. This recording is also the final ChatGPT client check. Crop the recording to Cutoff and the browser's tool activity. Do not show bookmarks, account details, environment files, or API keys.

The agent steps must begin with ordinary user prompts. Do not choose tools for the agent or use the inspector's manual Execute Tool control. The recording should show the agent discovering the registered tools, calling them, and changing the same page the manager is viewing.

## Before recording

1. Select **Sat 5 Sep · derby weekend**, then reset the demo.
2. In the in-app browser, click the cursor icon in the URL bar and expand **Available site tools**. Keep the agent conversation or tool activity visible when practical.
3. Confirm six tools on Order, four on Stock, four on Labor, and three on Shift log when no preview is active.
4. In Chrome 149+, enable `chrome://flags/#enable-webmcp-testing`, open the production URL, and confirm the same Order tools under **DevTools > Application > WebMCP**. This is a short compatibility shot, not a second model run.
5. Keep `/trajectory` in a second tab only if the recording needs a closing evidence shot.

## Recording script

### 0:00–0:18 — one shared desk

Show the shared service band across the four tabs: covers, labor, cost, waste, and what needs attention. Hold on the Saturday seed: 1,140 covers, 95 scheduled and required labor hours, 3,629 cost units, 74.97 waste units, and four stock lines with expiring stock.

Narration: “Cutoff is one shift operations desk. Covers, labor, cost, waste, and exceptions stay visible on every page, and all four decisions share one local revision.”

### 0:18–0:48 — replan the order

Add **Private booking**, label **Private booking, 80 guests**, covers **80**. Then ask:

```text
The derby has been cancelled. Add that to the order review and replan, but keep my booking.
```

Show the agent's `get_order_context`, `add_local_signal`, and `create_order_preview` calls. Hold on 1,140 → 910 covers, 95 → 76 hours, and 3,629 → 2,767 units. Show the changed cells and the dynamic seventh tool, `adopt_order_preview`.

Narration: “The agent reads the current revision and runs Cutoff's deterministic engine. The proposal is visible before it can be adopted.”

### 0:48–1:02 — adopt locally

Ask:

```text
Adopt the current order preview. Do not send anything outside this page.
```

Show the working order, Undo, and the tool count returning to six.

Narration: “Adoption updates only the browser's working order. Nothing is sent to a supplier.”

### 1:02–1:35 — reconcile labor

Open Labor and ask:

```text
Rosa cannot make prep. Record her absence, preview the roster changes, and leave the proposal for me to review.
```

Show the 76-hour requirement, releases for Tom and Jonas, and Nadia's prep cover. Adopt the labor preview from the visible control.

Narration: “Labor reads the adopted 910-cover order, not an unapproved preview. The same shared revision protects the roster change.”

### 1:35–1:55 — count stock

Open Stock and ask:

```text
Chicken is actually 30 kilos on hand and six kilos expire before service. Record that count.
```

Show the updated chicken row, count time, and activity entry.

Narration: “A shelf count updates the same stock the order engine uses. If an order preview were open, this would mark it stale.”

### 1:55–2:14 — hand off

Return to Order. In **Handoff summary**, write:

```text
Derby cancellation and private booking are in the working order. Labor was adjusted for Rosa's absence. Recheck the new chicken count before cutoff.
```

Select **Save handoff receipt** and show the local confirmation.

Narration: “The manager leaves one bounded receipt in the browser. The page action and tool use the same store path.”

### 2:14–2:31 — shift log and download

Open Shift log. Show the newest-first entries and filter once. Select **Download shift log (JSON)**.

Narration: “The shift log is built from the same activity, not a second audit system. It records the route, interaction channel, and summary for whoever opens tomorrow.”

### 2:31–2:39 — compatibility and close

Show Chrome's **DevTools > Application > WebMCP** panel with the six Order tools, then return to Cutoff's four tabs.

Narration: “The same page tools register in Chrome and ChatGPT. One restaurant, four decisions, one shared revision, and no external action.”

## Recording checks

- Runtime is under 2 minutes 40 seconds.
- A natural prompt leads to automatic tool calls. No tool is manually selected.
- ChatGPT's in-app browser shows the available site tools and completes the main flow.
- Chrome shows the production Order registrations under DevTools > Application > WebMCP.
- The six-to-seven-to-six Order tool lifecycle is visible.
- The 910-cover, 76-hour, 2,767-unit order result is readable.
- Labor actions show two releases and one on-call cover.
- Stock count, receipt, and Shift log download are visible.
- No secret, provider branding, account detail, or real restaurant data appears.
