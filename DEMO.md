# Cutoff demo

Public video: [Cutoff WebMCP Demo](https://www.youtube.com/watch?v=PGvSlkhThFQ)

Runtime: 2:48, with audio

The demo runs against production in ChatGPT's in-app browser. It begins with ordinary user prompts; no tool is named or manually selected for the agent.

## Sequence shown

1. **Shared desk.** The Saturday seed shows 1,140 covers, 95 required and scheduled labor hours, a 3,629-unit supplier order, weekly waste, and stock exceptions across the four sections.
2. **Order replan.** The manager records an 80-person private booking, then tells the agent that the derby was cancelled. The agent discovers the page tools, reads the current revision, records the signal, and creates a preview: 910 covers, 76 required hours, and 2,767 cost units.
3. **Dynamic adoption.** `adopt_order_preview` exists only while the current preview can be adopted. The agent adopts it locally; the working order changes and the tool disappears. Nothing is sent to a supplier.
4. **Labor proposal.** The agent opens Labor, records Rosa Alvarez's prep absence, and previews releases for Tom Walsh and Jonas Weber plus on-call cover from Nadia Haddad. The roster remains a proposal until the manager adopts it.
5. **Stock count.** The agent opens Stock, verifies chicken, and records 30 kg on hand with 6 kg expiring. The visible row, timestamp, activity, and shared revision update together.
6. **Second order preview.** The agent returns to Order and replans. Chicken rises from 15 to 16 cases because the expiring stock will not survive to service; proposed cost becomes 2,835 units.
7. **Handoff and log.** The agent saves a bounded local handoff covering the cancellation, booking, labor adjustment, and chicken recheck. The Shift log shows the same activity and downloads it as JSON.

## Claims visible in the recording

- The agent discovers tools from the page after receiving task-level prompts.
- Route changes replace the visible page and its contextual tool set.
- The Order catalog follows the 6→7→6 lifecycle around preview adoption.
- Tool-written changes appear in the UI and link back to their affected records.
- Every write uses the revision last read; stale writes return a structured error rather than overwriting newer state.
- Human-authored text is marked as untrusted in relevant tool results.
- The complete catalog has 16 unique tool names across 4 decision pages.
- Downloads and receipts stay local; no supplier or workforce system is connected.
