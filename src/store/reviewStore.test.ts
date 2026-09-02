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
    "human",
  );
}

function addCancellation(store: ReviewStore) {
  return store.addLocalSignal(
    {
      kind: "event_cancelled",
      label: "Derby match cancelled",
    },
    store.getState().revision,
    "agent",
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
      "agent",
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
      "agent",
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
      "human",
    );
    expectSuccess(firstPreview);

    const cancellation = addCancellation(store);
    expectSuccess(cancellation);
    expect(cancellation.previewBecameStale).toBe(true);
    expect(store.getState().preview).toBeNull();
  });

  it("removes a booking pin and clears the active preview", () => {
    const store = makeStore();
    const booking = addBooking(store);
    expectSuccess(booking);
    const preview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "human",
    );
    expectSuccess(preview);

    const removed = store.removeBookingPin(
      booking.signal.id,
      store.getState().revision,
      "human",
    );

    expectSuccess(removed);
    expect(store.getState().pins.bookingIds).toStrictEqual([]);
    expect(store.getState().preview).toBeNull();
    expect(store.getState().revision).toBe(3);
  });

  it("rejects a stale preview id", () => {
    const store = makeStore();
    const preview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "human",
    );
    expectSuccess(preview);

    const result = store.adoptOrderDraft(
      "preview-old",
      store.getState().revision,
      undefined,
      "agent",
      "adopt_order_preview",
    );

    expect(result).toStrictEqual({
      ok: false,
      error: "stale_preview",
      currentPreviewId: preview.preview.id,
      hint: "Call create_order_preview again, then adopt the new preview id.",
    });
  });

  it("keeps a preview adoptable across view-only updates", () => {
    const store = makeStore();
    const preview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "agent",
      "create_order_preview",
    );
    expectSuccess(preview);
    const previewRevision = store.getState().revision;

    const focused = store.focusSku("lettuce", previewRevision, "human");
    expectSuccess(focused);
    expect(focused.revision).toBe(previewRevision);
    expect(store.getState().revision).toBe(previewRevision);
    expect(store.getState().preview?.id).toBe(preview.preview.id);

    store.recordReadActivity(
      "get_order_context",
      "Read the live order context.",
      `Returned revision ${previewRevision} with 10 lines.`,
    );
    expect(store.getState().revision).toBe(previewRevision);
    expect(store.getState().preview?.id).toBe(preview.preview.id);

    const adopted = store.adoptOrderDraft(
      preview.preview.id,
      previewRevision,
      undefined,
      "agent",
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
      "agent",
      "create_order_preview",
    );
    expectSuccess(preview);

    const adopted = store.adoptOrderDraft(
      preview.preview.id,
      store.getState().revision,
      "Keep this as the working draft.",
      "agent",
      "adopt_order_preview",
    );
    expectSuccess(adopted);
    expect(adopted.undoAvailable).toBe(true);
    expect(store.getState().draft.plan.covers).toBe(910);
    expect(store.getState().preview).toBeNull();
    const adoptedRevision = store.getState().revision;

    const undone = store.undoAdoption(
      store.getState().revision,
      "human",
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
      "agent",
      "save_handoff_receipt",
    );
    expectSuccess(receipt);

    const restored = makeStore(storage);
    expect(restored.getState().lastReceipt?.id).toBe(receipt.receipt.id);
    expect(restored.getState().lastReceipt?.managerSummary).toBe(
      "Morning manager: check the revised draft before cutoff.",
    );
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
      "agent",
      "save_handoff_receipt",
    );

    expect(saved).toStrictEqual({
      ok: false,
      error: "storage_unavailable",
      hint: "Allow local storage, then retry save_handoff_receipt.",
    });
    expect(() => store.resetDemo("human")).not.toThrow();
    expect(store.getState().savedPlan.covers).toBe(1_140);
  });

  it("rejects a tampered receipt outside current input bounds", () => {
    const storage = createMemoryStorage();
    const store = makeStore(storage);
    const saved = store.saveHandoffReceipt(
      "Check the working draft before cutoff.",
      store.getState().revision,
      "human",
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
      "human",
    );
    expectSuccess(preview);
    expectSuccess(
      store.adoptOrderDraft(
        preview.preview.id,
        store.getState().revision,
        undefined,
        "human",
      ),
    );
    expectSuccess(
      store.saveHandoffReceipt(
        "Check the revised draft before cutoff.",
        store.getState().revision,
        "human",
      ),
    );
    const revisionBeforeReset = store.getState().revision;

    store.resetDemo("human");

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
      manual.addLocalSignal(input, manual.getState().revision, "human"),
    );
    expectSuccess(
      tool.addLocalSignal(
        input,
        tool.getState().revision,
        "agent",
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

  it("builds the same handoff receipt for a manual action and tool action", () => {
    const manual = makeStore();
    const tool = makeStore();
    const managerSummary =
      "Morning manager: check the revised draft before cutoff.";

    const manualResult = manual.saveHandoffReceipt(
      managerSummary,
      manual.getState().revision,
      "human",
    );
    const toolResult = tool.saveHandoffReceipt(
      managerSummary,
      tool.getState().revision,
      "agent",
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
});
