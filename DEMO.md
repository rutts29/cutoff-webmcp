# Cutoff demo plan

Target length: 2 minutes 55 seconds.

Use a clean browser profile with WebMCP enabled. Crop the recording to the product and the WebMCP tool list. Do not show third-party logos, browser bookmarks, account details, environment files, or API keys.

## Before recording

1. Reset the demo.
2. In the in-app browser, click the cursor icon in the URL bar and expand **Available site tools**. In Chrome, open **DevTools > Application > WebMCP**.
3. Confirm that the panel lists four tools.
4. Keep `/trajectory` ready in a second tab.
5. Use the fixed service date shown in the product.

## Recording script

### 0:00 to 0:15, establish the problem

Click the cursor icon in the URL bar, expand **Available site tools**, and show the four registered tools. In the Chrome version, use **DevTools > Application > WebMCP**. Then show the saved order sheet.

Narration: "This restaurant expects 1,140 covers because a nearby derby adds 310. The supplier cutoff is Fri 4 Sep at 22:00. The manager has new local information that the forecast cannot see."

### 0:15 to 0:35, add the human fact

Add a booking signal by hand:

```text
Private booking, 80 guests, 18:30
```

Show that the booking is pinned.

Narration: "The manager records an 80-person booking directly on the sheet. That booking remains pinned across every recalculation."

### 0:35 to 0:58, let the agent read live state

Ask:

```text
Look at the Sat 5 Sep order. Why is it this big, and what would change it?
```

Show `get_order_context` in the activity panel and the explanation of the derby uplift.

Narration: "The agent reads the page's live state, including unsaved pins and the current revision. It does not infer the table from a screenshot."

### 0:58 to 1:25, add the cancellation and preview

Ask:

```text
The derby has been cancelled. Add that and replan, but keep my booking.
```

Show `add_local_signal`, then `create_order_preview`. Hold on the totals:

- Covers: 1,140 to 910
- Labor: 95 to 76 hours
- Cost: 3,629 to 2,767 units

Expand **Available site tools** again. Show that the panel now lists five tools because `adopt_order_preview` is available. In Chrome, use **DevTools > Application > WebMCP**.

Narration: "The page runs its own deterministic engine. Each line shows the old quantity, the preview, the delta, and one reason. The current preview exposes a fifth tool for adoption."

### 1:25 to 1:48, show human correction

Open the lettuce row, pin 4 cases, and ask for a new preview.

Show `MANUAL_OVERRIDE_KEPT` and the new cost of 2,795 units.

Narration: "The manager can inspect the real formula and override a line. The agent reads that live pin and recomputes without replacing human judgment."

### 1:48 to 2:08, adopt without sending

Ask:

```text
Adopt this order preview as the working order. Don't send anything.
```

Show the adoption activity, the enabled Undo control, and the tools panel returning to four tools.

Narration: "Adoption changes only the working order. Nothing is sent to a supplier, and the manager can undo it."

### 2:08 to 2:35, save the handoff

Ask:

```text
Save a handoff note for the morning manager saying the derby was cancelled, the booking was kept, the working order was updated, and nothing was sent.
```

Show the saved receipt and its download control.

Narration: "The handoff receipt records the signals, pins, final lines, reasons, and manager summary in local storage. The manager can also create the same receipt from the visible controls."

### 2:35 to 2:50, show the trajectory

Open `/trajectory` and scroll once.

Narration: "The project record shows the decisions, tests, independent browser runs, and failed infrastructure checks. Failed eval attempts remain visible rather than being removed."

### 2:50 to 2:55, close

Return to the receipt status.

Narration: "Cutoff gives the manager and their agent one shared, inspectable decision before the deadline. The manager stays in control."

## Recording checks

- Total runtime stays below 3 minutes.
- Narration is audible.
- The tool list shows four tools before preview, five during preview, and four after adoption.
- The fixed totals and line reasons are readable.
- No third-party trademark, logo, screenshot, account detail, or secret appears.
- The final receipt says that nothing was sent outside the page.
