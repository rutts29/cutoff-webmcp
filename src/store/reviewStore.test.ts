import { describe, expect, it } from "vitest";

import type { LocalSignal } from "../domain/types";
import {
  createReviewStore,
  RECEIPT_STORAGE_KEY,
  type ReceiptStorage,
  type ReviewStore,
} from "./reviewStore";

function createMemoryStorage(): ReceiptStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function makeStore(storage = createMemoryStorage()): ReviewStore {
  let id = 0;
  return createReviewStore({
    storage,
    now: () => "2026-09-02T12:00:00.000Z",
    createId: (prefix) => `${prefix}-${++id}`,
  });
}

function addBooking(store: ReviewStore) {
  return store.addLocalSignal(
    {
      kind: "booking",
      label: "Private booking, 80 guests, 18:30",
      covers: 80,
    },
    store.getState().revision,
    "page",
  );
}

function addCancellation(store: ReviewStore) {
  return store.addLocalSignal(
    {
      kind: "event_cancelled",
      label: "Derby match cancelled",
    },
    store.getState().revision,
    "tool",
    "add_local_signal",
  );
}

function expectSuccess<T extends { ok: boolean }>(
  result: T,
): asserts result is Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
}

describe("review store", () => {
  it("starts at the exact saved plan and bumps revisions monotonically", () => {
    const store = makeStore();

    expect(store.getState().revision).toBe(0);
    expect(store.getState().savedPlan.covers).toBe(1_140);
    expect(store.getState().savedPlan.laborHours).toBe(95);
    expect(store.getState().savedPlan.totalCost).toBe(3_629);

    expectSuccess(addBooking(store));
    expect(store.getState().revision).toBe(1);
    expect(store.getState().pins.bookingIds).toStrictEqual(["signal-1"]);

    expectSuccess(addCancellation(store));
    expect(store.getState().revision).toBe(2);

    const preview = store.previewOrderPlan(
      "Replan after the local signals.",
      store.getState().revision,
      "tool",
      "create_order_preview",
    );
    expectSuccess(preview);
    expect(preview.preview.covers.after).toBe(910);
    expect(preview.preview.baseRevision).toBe(3);
    expect(store.getState().revision).toBe(3);
  });

  it("rejects a stale expected revision with a recovery hint", () => {
    const store = makeStore();
    expectSuccess(addBooking(store));

    const result = store.addLocalSignal(
      { kind: "event_cancelled", label: "Derby match cancelled" },
      0,
      "tool",
      "add_local_signal",
    );

    expect(result).toStrictEqual({
      ok: false,
      error: "stale_revision",
      currentRevision: 1,
      hint: "Read get_order_context and retry with the current revision.",
    });
  });

  it("invalidates an existing preview when a signal changes", () => {
    const store = makeStore();
    expectSuccess(addBooking(store));
    const firstPreview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(firstPreview);

    const cancellation = addCancellation(store);
    expectSuccess(cancellation);
    expect(cancellation.previewBecameStale).toBe(true);
    expect(store.getState().preview).toBeNull();
  });

  it("removes a booking pin and refreshes the active preview", () => {
    const store = makeStore();
    const booking = addBooking(store);
    expectSuccess(booking);
    const preview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(preview);

    const removed = store.removeBookingPin(
      booking.signal.id,
      store.getState().revision,
      "page",
    );

    expectSuccess(removed);
    expect(store.getState().pins.bookingIds).toStrictEqual([]);
    expect(store.getState().preview).not.toBeNull();
    expect(store.getState().preview?.covers.after).toBe(1_140);
    expect(store.getState().revision).toBe(3);
  });

  it("rejects a stale preview id", () => {
    const store = makeStore();
    const preview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(preview);

    const result = store.adoptOrderDraft(
      "preview-old",
      store.getState().revision,
      undefined,
      "tool",
      "adopt_order_preview",
    );

    expect(result).toStrictEqual({
      ok: false,
      error: "stale_preview",
      currentPreviewId: preview.preview.id,
      hint: "Call create_order_preview again, then adopt the new preview id.",
    });
  });

  it("keeps a preview adoptable across view-only row focus", () => {
    const store = makeStore();
    const preview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "tool",
      "create_order_preview",
    );
    expectSuccess(preview);
    const previewRevision = store.getState().revision;

    const focused = store.focusSku("lettuce", previewRevision, "page");
    expectSuccess(focused);
    expect(focused.revision).toBe(previewRevision);
    expect(store.getState().revision).toBe(previewRevision);
    expect(store.getState().preview?.id).toBe(preview.preview.id);

    const adopted = store.adoptOrderDraft(
      preview.preview.id,
      previewRevision,
      undefined,
      "tool",
      "adopt_order_preview",
    );
    expectSuccess(adopted);
    expect(store.getState().preview).toBeNull();
  });

  it("adopts then undoes without rolling the revision backward", () => {
    const store = makeStore();
    expectSuccess(addBooking(store));
    expectSuccess(addCancellation(store));
    const preview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "tool",
      "create_order_preview",
    );
    expectSuccess(preview);

    const adopted = store.adoptOrderDraft(
      preview.preview.id,
      store.getState().revision,
      "Keep this as the working draft.",
      "tool",
      "adopt_order_preview",
    );
    expectSuccess(adopted);
    expect(adopted.undoAvailable).toBe(true);
    expect(store.getState().draft.plan.covers).toBe(910);
    expect(store.getState().preview).toBeNull();
    const adoptedRevision = store.getState().revision;

    const undone = store.undoAdoption(
      store.getState().revision,
      "page",
    );
    expectSuccess(undone);
    expect(store.getState().draft.plan.covers).toBe(1_140);
    expect(store.getState().revision).toBe(adoptedRevision + 1);
  });

  it("restores the saved receipt when a store is recreated", () => {
    const storage = createMemoryStorage();
    const store = makeStore(storage);

    const receipt = store.saveHandoffReceipt(
      "Morning manager: check the revised draft before cutoff.",
      store.getState().revision,
      "tool",
      "save_handoff_receipt",
    );
    expectSuccess(receipt);

    const restored = makeStore(storage);
    expect(restored.getState().lastReceipt?.id).toBe(receipt.receipt.id);
    expect(restored.getState().lastReceipt?.managerSummary).toBe(
      "Morning manager: check the revised draft before cutoff.",
    );
  });

  it("restores a Tuesday receipt on its matching preset after reload", () => {
    const storage = createMemoryStorage();
    const store = makeStore(storage);
    store.switchPreset("tuesday", "page");
    const receipt = store.saveHandoffReceipt(
      "Tuesday opener: verify covers before lunch.",
      store.getState().revision,
      "page",
    );
    expectSuccess(receipt);

    const restored = makeStore(storage);
    expect(restored.getState().presetId).toBe("tuesday");
    expect(restored.getState().lastReceipt).toStrictEqual(receipt.receipt);
    expect(restored.getShiftLog("order").entries[0]?.id).toBe(receipt.receipt.id);
  });

  it("does not crash when receipt storage is unavailable", () => {
    const storage: ReceiptStorage = {
      getItem: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("Full", "QuotaExceededError");
      },
      removeItem: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
    };
    const store = makeStore(storage);

    const saved = store.saveHandoffReceipt(
      "Check the working draft before cutoff.",
      store.getState().revision,
      "tool",
      "save_handoff_receipt",
    );

    expect(saved).toStrictEqual({
      ok: false,
      error: "storage_unavailable",
      hint: "Allow local storage, then retry save_handoff_receipt.",
    });
    expect(() => store.resetDemo("page")).not.toThrow();
    expect(store.getState().savedPlan.covers).toBe(1_140);
  });

  it("rejects a tampered receipt outside current input bounds", () => {
    const storage = createMemoryStorage();
    const store = makeStore(storage);
    const saved = store.saveHandoffReceipt(
      "Check the working draft before cutoff.",
      store.getState().revision,
      "page",
    );
    expectSuccess(saved);
    const raw = storage.getItem(RECEIPT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const tampered = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    tampered.managerSummary = "x".repeat(1_001);
    storage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(tampered));

    const restored = makeStore(storage);

    expect(restored.getState().lastReceipt).toBeNull();
  });

  it("resets every mutable field to the exact seed state", () => {
    const store = makeStore();
    expectSuccess(addBooking(store));
    expectSuccess(addCancellation(store));
    const preview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(preview);
    expectSuccess(
      store.adoptOrderDraft(
        preview.preview.id,
        store.getState().revision,
        undefined,
        "page",
      ),
    );
    expectSuccess(
      store.saveHandoffReceipt(
        "Check the revised draft before cutoff.",
        store.getState().revision,
        "page",
      ),
    );
    const revisionBeforeReset = store.getState().revision;

    store.resetDemo("page");

    const state = store.getState();
    expect(state.revision).toBe(revisionBeforeReset + 1);
    expect(state.savedPlan.covers).toBe(1_140);
    expect(state.draft.plan).toStrictEqual(state.savedPlan);
    expect(state.signals).toStrictEqual([]);
    expect(state.pins).toStrictEqual({ bookingIds: [], lineOverrides: {} });
    expect(state.focusedSkuId).toBeNull();
    expect(state.preview).toBeNull();
    expect(state.lastReceipt).toBeNull();
    expect(state.undoAvailable).toBe(false);
  });

  it("uses the same store transition for a manual action and tool action", () => {
    const manual = makeStore();
    const tool = makeStore();
    const input = {
      kind: "booking" as const,
      label: "Private booking, 80 guests, 18:30",
      covers: 80,
    };

    expectSuccess(
      manual.addLocalSignal(input, manual.getState().revision, "page"),
    );
    expectSuccess(
      tool.addLocalSignal(
        input,
        tool.getState().revision,
        "tool",
        "add_local_signal",
      ),
    );

    const normalize = (signals: readonly LocalSignal[]) =>
      signals.map(({ source: _source, ...signal }) => signal);
    expect(normalize(manual.getState().signals)).toStrictEqual(
      normalize(tool.getState().signals),
    );
    expect(manual.getState().pins).toStrictEqual(tool.getState().pins);
    expect(manual.getState().revision).toBe(tool.getState().revision);
  });

  it("records the interaction channel without guessing human or agent identity", () => {
    const page = makeStore();
    const tool = makeStore();
    const input = {
      kind: "booking" as const,
      label: "Private booking, 80 guests, 18:30",
      covers: 80,
    };

    expectSuccess(
      page.addLocalSignal(input, page.getState().revision, "page"),
    );
    expectSuccess(
      tool.addLocalSignal(
        input,
        tool.getState().revision,
        "tool",
        "add_local_signal",
      ),
    );

    expect(page.getState().signals[0]?.source).toBe("page");
    expect(page.getState().activity[0]?.actor).toBe("page");
    expect(tool.getState().signals[0]?.source).toBe("tool");
    expect(tool.getState().activity[0]?.actor).toBe("tool");
  });

  it("builds the same handoff receipt for a manual action and tool action", () => {
    const manual = makeStore();
    const tool = makeStore();
    const managerSummary =
      "Morning manager: check the revised draft before cutoff.";

    const manualResult = manual.saveHandoffReceipt(
      managerSummary,
      manual.getState().revision,
      "page",
    );
    const toolResult = tool.saveHandoffReceipt(
      managerSummary,
      tool.getState().revision,
      "tool",
      "save_handoff_receipt",
    );

    expectSuccess(manualResult);
    expectSuccess(toolResult);
    expect(manualResult.receipt).toStrictEqual(toolResult.receipt);
    expect(manual.getState().lastReceipt).toStrictEqual(
      tool.getState().lastReceipt,
    );
    expect(manual.getState().revision).toBe(tool.getState().revision);
  });

  it("records a stock count and invalidates the shared order preview", () => {
    const store = makeStore();
    expectSuccess(addBooking(store));
    expectSuccess(addCancellation(store));
    const firstPreview = store.previewOrderPlan(
      "Preview the cancellation and booking.",
      store.getState().revision,
      "page",
    );
    expectSuccess(firstPreview);

    const count = store.recordStockCount(
      "chicken",
      30,
      6,
      store.getState().revision,
      "tool",
      "record_stock_count",
    );

    expectSuccess(count);
    expect(count).toMatchObject({
      previous: { onHand: 42, expiring: 6 },
      current: { onHand: 30, expiring: 6 },
      orderPreviewInvalidated: true,
    });
    expect(store.getState().preview?.id).toBe(firstPreview.preview.id);
    expect(store.getState().preview?.baseRevision).not.toBe(
      store.getState().revision,
    );
    expect(store.getState().orderPreviewStaleReason).toBe(
      "Stock counts changed since this preview. Preview again.",
    );
    expect(store.getState().activity.at(-1)).toMatchObject({
      section: "stock",
      tool: "record_stock_count",
    });

    const refreshed = store.previewOrderPlan(
      "Refresh after the count.",
      store.getState().revision,
      "tool",
      "create_order_preview",
    );
    expectSuccess(refreshed);
    expect(
      refreshed.preview.lines.find((line) => line.skuId === "chicken"),
    ).toMatchObject({ afterCases: 16, reason: "DEMAND_DOWN_EVENT_CANCELLED" });
    expect(refreshed.preview.totals.afterCost).toBe(2_835);
    expect(store.getState().orderPreviewStaleReason).toBeNull();
  });

  it("uses a current stock count in a saved-plan preview", () => {
    const store = makeStore();
    const count = store.recordStockCount(
      "chicken",
      30,
      6,
      store.getState().revision,
      "page",
    );
    expectSuccess(count);

    const preview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(preview);
    expect(
      preview.preview.lines.find((line) => line.skuId === "chicken"),
    ).toMatchObject({ afterCases: 21 });
  });

  it("logs expired waste and updates stock and weekly totals", () => {
    const store = makeStore();
    const result = store.logWaste(
      "lettuce",
      2,
      "expired",
      undefined,
      store.getState().revision,
      "tool",
      "log_waste",
    );

    expectSuccess(result);
    expect(result).toMatchObject({
      cost: 2.33,
      newOnHand: 7,
      newExpiring: 2,
      weekTotal: 77.3,
      orderPreviewInvalidated: false,
    });
    expect(store.getState().activity.at(-1)).toMatchObject({
      section: "stock",
      tool: "log_waste",
    });

    const preview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(preview);
    expect(
      preview.preview.lines.find((line) => line.skuId === "lettuce"),
    ).toMatchObject({ afterCases: 2 });
  });

  it("runs the locked 910-cover labor flow and undoes only the adoption", () => {
    const store = makeStore();
    expectSuccess(addBooking(store));
    expectSuccess(addCancellation(store));
    const orderPreview = store.previewOrderPlan(
      "Replan after the local signals.",
      store.getState().revision,
      "page",
    );
    expectSuccess(orderPreview);
    expectSuccess(
      store.adoptOrderDraft(
        orderPreview.preview.id,
        store.getState().revision,
        undefined,
        "page",
      ),
    );
    expect(store.getState().draft.plan.covers).toBe(910);

    expectSuccess(
      store.addLaborSignal(
        { kind: "absence", staffId: "s11", note: "Cannot make close." },
        store.getState().revision,
        "page",
      ),
    );
    const laborPreview = store.previewLaborPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(laborPreview);
    expect(laborPreview.preview.totals).toStrictEqual({
      scheduledBefore: 88,
      scheduledAfter: 80,
      required: 76,
      releases: 2,
      covers: 1,
    });

    expectSuccess(
      store.adoptLaborPlan(
        laborPreview.preview.id,
        store.getState().revision,
        undefined,
        "page",
      ),
    );
    expect(store.getState().labor.shifts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ staffId: "s04", status: "released" }),
        expect.objectContaining({ staffId: "s10", status: "released" }),
        expect.objectContaining({ staffId: "s11", status: "absent" }),
        expect.objectContaining({ staffId: "oc1", status: "cover", hours: 4 }),
      ]),
    );
    expectSuccess(
      store.undoLaborAdoption(
        store.getState().revision,
        "page",
      ),
    );
    expect(store.getState().labor.shifts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ staffId: "s04", status: "scheduled" }),
        expect.objectContaining({ staffId: "s10", status: "scheduled" }),
        expect.objectContaining({ staffId: "s11", status: "absent" }),
      ]),
    );
    expect(
      store.getState().labor.shifts.some((shift) => shift.staffId === "oc1"),
    ).toBe(false);
  });

  it("keeps unrelated page previews current and invalidates labor on order adoption", () => {
    const store = makeStore();
    const orderPreview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(orderPreview);
    expectSuccess(
      store.addLaborSignal(
        { kind: "absence", staffId: "s11" },
        store.getState().revision,
        "page",
      ),
    );
    expectSuccess(
      store.adoptOrderDraft(
        orderPreview.preview.id,
        store.getState().revision,
        undefined,
        "page",
      ),
    );

    const laborPreview = store.previewLaborPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(laborPreview);
    expectSuccess(
      store.recordStockCount(
        "chicken",
        30,
        6,
        store.getState().revision,
        "page",
      ),
    );
    expect(store.getState().labor.preview?.id).toBe(laborPreview.preview.id);
    expectSuccess(
      store.adoptLaborPlan(
        laborPreview.preview.id,
        store.getState().revision,
        undefined,
        "page",
      ),
    );

    const nextLaborPreview = store.previewLaborPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(nextLaborPreview);
    expectSuccess(addBooking(store));
    const changedOrder = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(changedOrder);
    expectSuccess(
      store.adoptOrderDraft(
        changedOrder.preview.id,
        store.getState().revision,
        undefined,
        "page",
      ),
    );
    expect(store.getState().labor.preview).toBeNull();
    expect(store.getState().laborPreviewStaleReason).toMatch(
      /working order covers changed/i,
    );
  });

  it("switches to the locked Tuesday preset at revision zero", () => {
    const store = makeStore();
    expectSuccess(addBooking(store));

    store.switchPreset("tuesday", "page");

    const state = store.getState();
    expect(state.presetId).toBe("tuesday");
    expect(state.revision).toBe(0);
    expect(state.serviceDate).toBe("2026-09-08");
    expect(state.savedPlan).toMatchObject({
      covers: 520,
      laborHours: 44,
      totalCost: 1_281,
    });
    expect(state.savedPlan.lines.map((line) => line.cases)).toStrictEqual([
      7, 3, 2, 4, 1, 3, 0, 6, 0, 0,
    ]);
    expect(state.activity).toHaveLength(1);
    expect(state.activity[0]?.inputSummary).toMatch(/rainy midweek/i);
    expect(state.undoAvailable).toBe(false);
  });

  it("matches the locked Tuesday booking and labor previews", () => {
    const store = makeStore();
    store.switchPreset("tuesday", "page");
    const booking = store.addLocalSignal(
      { kind: "booking", label: "Tuesday booking", covers: 40 },
      0,
      "page",
    );
    expectSuccess(booking);
    const orderPreview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(orderPreview);
    expect(orderPreview.preview.covers.after).toBe(560);
    expect(orderPreview.preview.laborHours.after).toBe(47);
    expect(orderPreview.preview.totals.afterCost).toBe(1_447);
    expect(orderPreview.preview.lines.map((line) => line.afterCases)).toStrictEqual([
      8, 3, 3, 5, 1, 3, 0, 7, 0, 0,
    ]);
    expect(orderPreview.preview.lines.map((line) => line.reason)).toStrictEqual([
      "DEMAND_UP_PINNED_BOOKING",
      "UNCHANGED",
      "DEMAND_UP_PINNED_BOOKING",
      "DEMAND_UP_PINNED_BOOKING",
      "EXPIRING_STOCK_EXCLUDED",
      "EXPIRING_STOCK_EXCLUDED",
      "COVERED_BY_STOCK",
      "DEMAND_UP_PINNED_BOOKING",
      "COVERED_BY_STOCK",
      "COVERED_BY_STOCK",
    ]);
    expectSuccess(
      store.adoptOrderDraft(
        orderPreview.preview.id,
        store.getState().revision,
        undefined,
        "page",
      ),
    );
    const laborPreview = store.previewLaborPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(laborPreview);
    expect(laborPreview.preview.requiredTotal).toBe(47);
    expect(laborPreview.preview.totals).toStrictEqual({
      scheduledBefore: 44,
      scheduledAfter: 52,
      required: 47,
      releases: 0,
      covers: 2,
    });
    expect(laborPreview.preview.dayparts).toMatchObject([
      {
        id: "lunch",
        required: 16,
        scheduledBefore: 15,
        scheduledAfter: 19,
        reason: "UNDER_SCHEDULED_FORECAST_UP",
        actions: [{ type: "cover", staffId: "oc1", hours: 4 }],
      },
      {
        id: "dinner",
        required: 24,
        scheduledBefore: 22,
        scheduledAfter: 26,
        reason: "UNDER_SCHEDULED_FORECAST_UP",
        actions: [{ type: "cover", staffId: "oc2", hours: 4 }],
      },
      {
        id: "prep",
        required: 7,
        scheduledBefore: 7,
        scheduledAfter: 7,
        reason: "WITHIN_TOLERANCE",
        actions: [],
      },
    ]);
  });

  it("filters the shift log and keeps a new shift note independent of previews", () => {
    const store = makeStore();
    expectSuccess(
      store.recordStockCount("chicken", 31, 4, 0, "page"),
    );
    expectSuccess(
      store.logWaste(
        "chicken",
        1,
        "prep",
        "Trim loss",
        store.getState().revision,
        "page",
      ),
    );
    const stockLog = store.getShiftLog("stock");
    expect(stockLog.total).toBe(2);
    expect(stockLog.entries).toHaveLength(2);
    expect(stockLog.entries.every((entry) => entry.section === "stock")).toBe(true);
    expect(stockLog.entries[0]?.summary).toMatch(/^Log 1 chicken/);

    const preview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(preview);
    const note = store.addShiftNote(
      "Check the walk-in before lunch.",
      "stock",
      store.getState().revision,
      "tool",
      "add_shift_note",
    );
    expectSuccess(note);
    expect(store.getState().preview?.id).toBe(preview.preview.id);
    const log = store.getShiftLog();
    expect(log.entries[0]).toMatchObject({
      id: note.noteId,
      section: "stock",
      actor: "tool",
      tool: "add_shift_note",
    });
    expect(log.entries[0]?.summary).toContain("Check the walk-in before lunch.");
  });

  it("uses staff names and omits preview identifiers in shift-log summaries", () => {
    const store = makeStore();
    expectSuccess(
      store.addLaborSignal(
        { kind: "absence", staffId: "s11" },
        store.getState().revision,
        "page",
      ),
    );
    expectSuccess(
      store.addLaborSignal(
        { kind: "extra_shift", staffId: "oc1", daypart: "lunch", hours: 4 },
        store.getState().revision,
        "page",
      ),
    );
    const laborPreview = store.previewLaborPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(laborPreview);
    expectSuccess(
      store.adoptLaborPlan(
        laborPreview.preview.id,
        store.getState().revision,
        undefined,
        "page",
      ),
    );
    const orderPreview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expectSuccess(orderPreview);
    expectSuccess(
      store.adoptOrderDraft(
        orderPreview.preview.id,
        store.getState().revision,
        undefined,
        "page",
      ),
    );

    const summaries = store.getShiftLog().entries.map((entry) => entry.summary);
    expect(summaries).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Record Rosa Alvarez absent."),
        expect.stringContaining("Add 4 lunch hours for Nadia Haddad."),
        expect.stringContaining("Order preview created"),
        expect.stringContaining("Labor preview created"),
      ]),
    );
    expect(summaries.join(" ")).not.toMatch(/\bs11\b/);
    expect(summaries.join(" ")).not.toMatch(/\boc1\b/);
    expect(summaries.join(" ")).not.toMatch(/\b(?:labor-)?preview-[a-z0-9-]+\b/i);
  });

  it("restores a saved receipt into the shift log after reload", () => {
    const storage = createMemoryStorage();
    const store = makeStore(storage);
    const receipt = store.saveHandoffReceipt(
      "Check the working order before cutoff.",
      0,
      "tool",
      "save_handoff_receipt",
    );
    expectSuccess(receipt);

    const restored = makeStore(storage);
    expect(restored.getShiftLog("order").entries[0]).toMatchObject({
      id: receipt.receipt.id,
      actor: "page",
      summary: expect.stringContaining("Check the working order before cutoff."),
    });
  });
});
