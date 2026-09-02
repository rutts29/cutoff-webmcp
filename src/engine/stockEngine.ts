import type { StockItem } from "../domain/types";
import {
  WASTE_REASONS,
  type CountedStockItem,
  type LogWasteResult,
  type RecordStockCountResult,
  type SkuWasteSummary,
  type StockCountSnapshot,
  type StockEngineState,
  type WasteCostByReason,
  type WasteEntry,
  type WasteReason,
  type WasteSummary,
} from "../domain/stock";

export const SEED_LAST_COUNTED_AT = "2026-09-04T15:00:00.000Z";

export type StockSeedWasteRow = Readonly<{
  id: string;
  skuId: string;
  quantity: number;
  reason: WasteReason;
  loggedAt: string;
}>;

const SEED_WASTE_ROWS = [
  {
    id: "waste-chicken-expired",
    skuId: "chicken",
    quantity: 4,
    reason: "expired",
    loggedAt: "2026-08-31T10:00:00.000Z",
  },
  {
    id: "waste-chicken-prep",
    skuId: "chicken",
    quantity: 2,
    reason: "prep",
    loggedAt: "2026-08-31T18:00:00.000Z",
  },
  {
    id: "waste-buns-expired",
    skuId: "buns",
    quantity: 24,
    reason: "expired",
    loggedAt: "2026-09-01T10:00:00.000Z",
  },
  {
    id: "waste-lettuce-expired",
    skuId: "lettuce",
    quantity: 3,
    reason: "expired",
    loggedAt: "2026-09-01T18:00:00.000Z",
  },
  {
    id: "waste-lettuce-dropped",
    skuId: "lettuce",
    quantity: 1,
    reason: "dropped",
    loggedAt: "2026-09-02T10:00:00.000Z",
  },
  {
    id: "waste-tomatoes-expired",
    skuId: "tomatoes",
    quantity: 2,
    reason: "expired",
    loggedAt: "2026-09-02T18:00:00.000Z",
  },
  {
    id: "waste-fries-overproduction",
    skuId: "fries",
    quantity: 5,
    reason: "overproduction",
    loggedAt: "2026-09-03T10:00:00.000Z",
  },
  {
    id: "waste-patties-overproduction",
    skuId: "patties",
    quantity: 6,
    reason: "overproduction",
    loggedAt: "2026-09-03T18:00:00.000Z",
  },
] satisfies readonly StockSeedWasteRow[];

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function findItem(
  items: readonly CountedStockItem[],
  skuId: string,
): CountedStockItem | undefined {
  return items.find((item) => item.id === skuId);
}

function countSnapshot(item: CountedStockItem): StockCountSnapshot {
  return {
    onHand: item.onHand,
    expiring: item.expiring,
    lastCountedAt: item.lastCountedAt,
  };
}

function createSeedWasteLedger(
  items: readonly CountedStockItem[],
  rows: readonly StockSeedWasteRow[],
): readonly WasteEntry[] {
  return rows.map((row) => {
    const item = findItem(items, row.skuId);
    if (!item) {
      throw new Error(`Missing seed stock item ${row.skuId}`);
    }

    return {
      ...row,
      cost: roundMoney(row.quantity * item.unitCost),
    };
  });
}

export function createSeedStockState(
  items: readonly StockItem[],
  options: Readonly<{
    lastCountedAt?: string;
    wasteRows?: readonly StockSeedWasteRow[];
  }> = {},
): StockEngineState {
  const lastCountedAt = options.lastCountedAt ?? SEED_LAST_COUNTED_AT;
  const countedItems = items.map((item) => ({
    ...item,
    lastCountedAt,
    unitCost: item.costPerCase / item.caseSize,
  }));

  return {
    items: countedItems,
    wasteLedger: createSeedWasteLedger(
      countedItems,
      options.wasteRows ?? SEED_WASTE_ROWS,
    ),
    revision: 0,
  };
}

export function summarizeWaste(
  entries: readonly WasteEntry[],
): WasteSummary {
  const initialByReason: WasteCostByReason = {
    expired: 0,
    overproduction: 0,
    prep: 0,
    dropped: 0,
  };
  const byReason = entries.reduce<WasteCostByReason>(
    (totals, entry) => ({
      ...totals,
      [entry.reason]: roundMoney(totals[entry.reason] + entry.cost),
    }),
    initialByReason,
  );
  const totalCost = roundMoney(
    entries.reduce((total, entry) => total + entry.cost, 0),
  );

  let topReason: WasteReason | null = null;
  for (const reason of WASTE_REASONS) {
    if (
      byReason[reason] > 0 &&
      (topReason === null || byReason[reason] > byReason[topReason])
    ) {
      topReason = reason;
    }
  }

  return { totalCost, byReason, topReason };
}

export function summarizeSkuWaste(
  entries: readonly WasteEntry[],
  skuId: string,
): SkuWasteSummary {
  const entriesForSku = entries.filter((entry) => entry.skuId === skuId);
  return {
    quantity: entriesForSku.reduce(
      (total, entry) => total + entry.quantity,
      0,
    ),
    cost: roundMoney(
      entriesForSku.reduce((total, entry) => total + entry.cost, 0),
    ),
  };
}

export function recordStockCount({
  state,
  skuId,
  onHand,
  expiring,
  countedAt,
  hasOrderPreview,
}: Readonly<{
  state: StockEngineState;
  skuId: string;
  onHand: number;
  expiring: number;
  countedAt: string;
  hasOrderPreview: boolean;
}>): RecordStockCountResult {
  const item = findItem(state.items, skuId);
  if (!item) {
    return { ok: false, error: "stock_item_not_found", skuId };
  }

  if (
    !Number.isFinite(onHand) ||
    !Number.isFinite(expiring) ||
    onHand < 0 ||
    expiring < 0
  ) {
    return {
      ok: false,
      error: "invalid_stock_count",
      skuId,
      onHand,
      expiring,
    };
  }

  if (expiring > onHand) {
    return {
      ok: false,
      error: "expiring_exceeds_on_hand",
      skuId,
      onHand,
      expiring,
    };
  }

  const updatedItem: CountedStockItem = {
    ...item,
    onHand,
    expiring,
    lastCountedAt: countedAt,
  };
  const revision = state.revision + 1;
  const nextState: StockEngineState = {
    ...state,
    items: state.items.map((candidate) =>
      candidate.id === skuId ? updatedItem : candidate,
    ),
    revision,
  };

  return {
    ok: true,
    skuId,
    previous: countSnapshot(item),
    current: countSnapshot(updatedItem),
    state: nextState,
    revision,
    orderPreviewInvalidated: hasOrderPreview,
  };
}

export function logWaste({
  state,
  skuId,
  quantity,
  reason,
  note,
  entryId,
  loggedAt,
  hasOrderPreview,
}: Readonly<{
  state: StockEngineState;
  skuId: string;
  quantity: number;
  reason: WasteReason;
  note?: string;
  entryId: string;
  loggedAt: string;
  hasOrderPreview: boolean;
}>): LogWasteResult {
  const item = findItem(state.items, skuId);
  if (!item) {
    return { ok: false, error: "stock_item_not_found", skuId };
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return {
      ok: false,
      error: "invalid_waste_quantity",
      skuId,
      quantity,
    };
  }

  const newOnHand = Math.max(0, item.onHand - quantity);
  const expiredReduction =
    reason === "expired" ? Math.min(quantity, item.expiring) : 0;
  const newExpiring = item.expiring - expiredReduction;
  const updatedItem: CountedStockItem = {
    ...item,
    onHand: newOnHand,
    expiring: newExpiring,
  };
  const entry: WasteEntry = {
    id: entryId,
    skuId,
    quantity,
    reason,
    cost: roundMoney(quantity * item.unitCost),
    loggedAt,
    ...(note === undefined ? {} : { note }),
  };
  const wasteLedger = [...state.wasteLedger, entry];
  const revision = state.revision + 1;
  const nextState: StockEngineState = {
    items: state.items.map((candidate) =>
      candidate.id === skuId ? updatedItem : candidate,
    ),
    wasteLedger,
    revision,
  };
  const weekSummary = summarizeWaste(wasteLedger);

  return {
    ok: true,
    entryId,
    cost: entry.cost,
    entry,
    newOnHand,
    newExpiring,
    weekTotal: weekSummary.totalCost,
    weekSummary,
    state: nextState,
    revision,
    orderPreviewInvalidated: hasOrderPreview,
  };
}
