import type { StockItem } from "./types";

export const WASTE_REASONS = [
  "expired",
  "overproduction",
  "prep",
  "dropped",
] as const;

export type WasteReason = (typeof WASTE_REASONS)[number];

export type CountedStockItem = Readonly<
  StockItem & {
    lastCountedAt: string;
    unitCost: number;
  }
>;

export type WasteEntry = Readonly<{
  id: string;
  skuId: string;
  quantity: number;
  reason: WasteReason;
  cost: number;
  loggedAt: string;
  note?: string;
}>;

export type StockEngineState = Readonly<{
  items: readonly CountedStockItem[];
  wasteLedger: readonly WasteEntry[];
  revision: number;
}>;

export type WasteCostByReason = Readonly<Record<WasteReason, number>>;

export type WasteSummary = Readonly<{
  totalCost: number;
  byReason: WasteCostByReason;
  topReason: WasteReason | null;
}>;

export type SkuWasteSummary = Readonly<{
  quantity: number;
  cost: number;
}>;

export type StockCountSnapshot = Readonly<{
  onHand: number;
  expiring: number;
  lastCountedAt: string;
}>;

type StockItemNotFoundError = Readonly<{
  ok: false;
  error: "stock_item_not_found";
  skuId: string;
}>;

type InvalidStockCountError = Readonly<{
  ok: false;
  error: "invalid_stock_count" | "expiring_exceeds_on_hand";
  skuId: string;
  onHand: number;
  expiring: number;
}>;

type InvalidWasteQuantityError = Readonly<{
  ok: false;
  error: "invalid_waste_quantity";
  skuId: string;
  quantity: number;
}>;

export type RecordStockCountSuccess = Readonly<{
  ok: true;
  skuId: string;
  previous: StockCountSnapshot;
  current: StockCountSnapshot;
  state: StockEngineState;
  revision: number;
  orderPreviewInvalidated: boolean;
}>;

export type RecordStockCountResult =
  | RecordStockCountSuccess
  | StockItemNotFoundError
  | InvalidStockCountError;

export type LogWasteSuccess = Readonly<{
  ok: true;
  entryId: string;
  cost: number;
  entry: WasteEntry;
  newOnHand: number;
  newExpiring: number;
  weekTotal: number;
  weekSummary: WasteSummary;
  state: StockEngineState;
  revision: number;
  orderPreviewInvalidated: boolean;
}>;

export type LogWasteResult =
  | LogWasteSuccess
  | StockItemNotFoundError
  | InvalidWasteQuantityError;
