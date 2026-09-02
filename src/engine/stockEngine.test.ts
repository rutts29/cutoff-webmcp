import { describe, expect, it } from "vitest";

import { BASE_COVERS, SEED_COVERS, SEED_EVENT_UPLIFTS, SEED_ITEMS } from "../data/seed";
import type { LocalSignal } from "../domain/types";
import { calculatePlan, createOrderPreview, REASON_CODES } from "./orderEngine";
import {
  createSeedStockState,
  logWaste,
  recordStockCount,
  summarizeWaste,
} from "./stockEngine";

const bookingSignal = {
  id: "booking-1",
  kind: "booking",
  label: "Private booking, 80 guests, 18:30",
  covers: 80,
  source: "page",
  addedAt: "2026-09-02T12:00:00.000Z",
} satisfies LocalSignal;

const cancellationSignal = {
  id: "cancel-1",
  kind: "event_cancelled",
  label: "Derby match cancelled",
  source: "tool",
  addedAt: "2026-09-02T12:01:00.000Z",
} satisfies LocalSignal;

function findItem<Item extends { id: string }>(
  items: readonly Item[],
  skuId: string,
): Item {
  const item = items.find((candidate) => candidate.id === skuId);
  if (!item) {
    throw new Error(`Expected stock item ${skuId}`);
  }
  return item;
}

function findLine<Line extends { skuId: string }>(
  lines: readonly Line[],
  skuId: string,
): Line {
  const line = lines.find((candidate) => candidate.skuId === skuId);
  if (!line) {
    throw new Error(`Expected order line ${skuId}`);
  }
  return line;
}

function orderPreview(items: ReturnType<typeof createSeedStockState>["items"]) {
  return createOrderPreview({
    savedPlan: calculatePlan({ items: SEED_ITEMS, covers: SEED_COVERS }),
    items,
    baseCovers: BASE_COVERS,
    eventUplifts: SEED_EVENT_UPLIFTS,
    signals: [bookingSignal, cancellationSignal],
    pins: { bookingIds: [bookingSignal.id], lineOverrides: {} },
    id: "preview-stock-test",
    baseRevision: 1,
  });
}

describe("stock and waste engine", () => {
  it("seeds counted stock and the locked Monday-to-Thursday waste ledger", () => {
    const state = createSeedStockState(SEED_ITEMS);

    expect(state.items).toHaveLength(10);
    expect(state.items.every((item) => item.lastCountedAt === "2026-09-04T15:00:00.000Z")).toBe(true);
    for (const item of state.items) {
      expect(item.unitCost).toBeCloseTo(item.costPerCase / item.caseSize, 10);
    }

    expect(
      state.wasteLedger.map(({ skuId, quantity, reason, cost }) => ({
        skuId,
        quantity,
        reason,
        cost,
      })),
    ).toStrictEqual([
      { skuId: "chicken", quantity: 4, reason: "expired", cost: 27.2 },
      { skuId: "chicken", quantity: 2, reason: "prep", cost: 13.6 },
      { skuId: "buns", quantity: 24, reason: "expired", cost: 9.5 },
      { skuId: "lettuce", quantity: 3, reason: "expired", cost: 3.5 },
      { skuId: "lettuce", quantity: 1, reason: "dropped", cost: 1.17 },
      { skuId: "tomatoes", quantity: 2, reason: "expired", cost: 4.4 },
      { skuId: "fries", quantity: 5, reason: "overproduction", cost: 8.4 },
      { skuId: "patties", quantity: 6, reason: "overproduction", cost: 7.2 },
    ]);

    expect(summarizeWaste(state.wasteLedger)).toStrictEqual({
      totalCost: 74.97,
      byReason: {
        expired: 44.6,
        overproduction: 15.6,
        prep: 13.6,
        dropped: 1.17,
      },
      topReason: "expired",
    });
  });

  it("records the locked chicken count and feeds both order calculations", () => {
    const state = { ...createSeedStockState(SEED_ITEMS), revision: 7 };
    const baselinePreview = orderPreview(state.items);
    expect(findLine(baselinePreview.lines, "chicken").afterCases).toBe(15);
    expect(baselinePreview.totals.afterCost).toBe(2_767);

    const result = recordStockCount({
      state,
      skuId: "chicken",
      onHand: 30,
      expiring: 6,
      countedAt: "2026-09-04T16:10:00.000Z",
      hasOrderPreview: true,
    });

    if (!result.ok) {
      throw new Error(`Expected a successful count, got ${result.error}`);
    }

    expect(result.previous).toStrictEqual({
      onHand: 42,
      expiring: 6,
      lastCountedAt: "2026-09-04T15:00:00.000Z",
    });
    expect(result.current).toStrictEqual({
      onHand: 30,
      expiring: 6,
      lastCountedAt: "2026-09-04T16:10:00.000Z",
    });
    expect(result.state.revision).toBe(8);
    expect(result.orderPreviewInvalidated).toBe(true);
    expect(findItem(state.items, "chicken").onHand).toBe(42);

    const preview = orderPreview(result.state.items);
    const chicken = findLine(preview.lines, "chicken");
    expect(chicken.afterCases).toBe(16);
    expect(chicken.reason).toBe(REASON_CODES.DEMAND_DOWN_EVENT_CANCELLED);
    expect(preview.totals.afterCost).toBe(2_835);

    const savedForecast = calculatePlan({
      items: result.state.items,
      covers: SEED_COVERS,
    });
    expect(
      findLine(
        calculatePlan({ items: state.items, covers: SEED_COVERS }).lines,
        "chicken",
      ).cases,
    ).toBe(19);
    expect(findLine(savedForecast.lines, "chicken").cases).toBe(21);
  });

  it("rejects a count whose expiring quantity exceeds on-hand stock", () => {
    const state = createSeedStockState(SEED_ITEMS);
    const result = recordStockCount({
      state,
      skuId: "chicken",
      onHand: 5,
      expiring: 6,
      countedAt: "2026-09-04T16:10:00.000Z",
      hasOrderPreview: false,
    });

    expect(result).toStrictEqual({
      ok: false,
      error: "expiring_exceeds_on_hand",
      skuId: "chicken",
      onHand: 5,
      expiring: 6,
    });
    expect(findItem(state.items, "chicken").onHand).toBe(42);
  });

  it("logs the locked lettuce waste and leaves its order recommendation at two cases", () => {
    const state = { ...createSeedStockState(SEED_ITEMS), revision: 11 };
    expect(findLine(orderPreview(state.items).lines, "lettuce").afterCases).toBe(2);

    const result = logWaste({
      state,
      skuId: "lettuce",
      quantity: 2,
      reason: "expired",
      note: "Outer leaves spoiled in the walk-in.",
      entryId: "waste-9",
      loggedAt: "2026-09-04T16:20:00.000Z",
      hasOrderPreview: true,
    });

    if (!result.ok) {
      throw new Error(`Expected successful waste logging, got ${result.error}`);
    }

    expect(result.entry).toMatchObject({
      id: "waste-9",
      skuId: "lettuce",
      quantity: 2,
      reason: "expired",
      note: "Outer leaves spoiled in the walk-in.",
      cost: 2.33,
    });
    expect(result.entryId).toBe("waste-9");
    expect(result.cost).toBe(2.33);
    expect(result.newOnHand).toBe(7);
    expect(result.newExpiring).toBe(2);
    expect(result.weekTotal).toBe(77.3);
    expect(result.weekSummary.totalCost).toBe(77.3);
    expect(result.state.revision).toBe(12);
    expect(result.orderPreviewInvalidated).toBe(true);
    expect(findItem(state.items, "lettuce")).toMatchObject({ onHand: 9, expiring: 4 });

    const preview = orderPreview(result.state.items);
    expect(findLine(preview.lines, "lettuce").afterCases).toBe(2);
  });

  it("floors stock at zero and only expired waste consumes expiring stock", () => {
    const state = createSeedStockState(SEED_ITEMS);
    const prepWaste = logWaste({
      state,
      skuId: "chicken",
      quantity: 50,
      reason: "prep",
      entryId: "waste-prep",
      loggedAt: "2026-09-04T16:30:00.000Z",
      hasOrderPreview: false,
    });

    if (!prepWaste.ok) {
      throw new Error(`Expected successful waste logging, got ${prepWaste.error}`);
    }

    expect(prepWaste.newOnHand).toBe(0);
    expect(prepWaste.newExpiring).toBe(6);
    expect(prepWaste.orderPreviewInvalidated).toBe(false);
  });
});
