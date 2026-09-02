import type {
  EventUplift,
  LocalSignal,
  OrderPlan,
  OrderPreview,
  PreviewLine,
  ReasonCode,
  ReviewPins,
  StockItem,
} from "../domain/types";

export const REASON_CODES = {
  DEMAND_DOWN_EVENT_CANCELLED: "DEMAND_DOWN_EVENT_CANCELLED",
  DEMAND_UP_PINNED_BOOKING: "DEMAND_UP_PINNED_BOOKING",
  MANUAL_OVERRIDE_KEPT: "MANUAL_OVERRIDE_KEPT",
  COVERED_BY_STOCK: "COVERED_BY_STOCK",
  EXPIRING_STOCK_EXCLUDED: "EXPIRING_STOCK_EXCLUDED",
  UNCHANGED: "UNCHANGED",
} as const satisfies Record<ReasonCode, ReasonCode>;

export function getUsableStock(item: StockItem): number {
  return Math.max(0, item.onHand - item.expiring);
}

export type LineCalculation = Readonly<{
  demand: number;
  need: number;
  calculatedCases: number;
  usable: number;
}>;

export function calculateLine(
  item: StockItem,
  covers: number,
): LineCalculation {
  const demand = Math.max(0, covers) * item.usagePerCover;
  const usable = getUsableStock(item);
  const need = demand * (1 + item.safety) - (usable + item.inTransit);

  return {
    demand,
    need,
    calculatedCases: Math.max(0, Math.ceil(need / item.caseSize)),
    usable,
  };
}

export function calculatePlan({
  items,
  covers,
}: Readonly<{
  items: readonly StockItem[];
  covers: number;
}>): OrderPlan {
  const safeCovers = Math.max(0, covers);
  const lines = items.map((item) => {
    const cases = calculateLine(item, safeCovers).calculatedCases;
    return {
      skuId: item.id,
      cases,
      lineCost: cases * item.costPerCase,
    };
  });

  return {
    covers: safeCovers,
    laborHours: Math.ceil(safeCovers / 12),
    lines,
    totalCost: lines.reduce((total, line) => total + line.lineCost, 0),
  };
}

function findCases(plan: OrderPlan, skuId: string): number {
  return plan.lines.find((line) => line.skuId === skuId)?.cases ?? 0;
}

function getReason({
  item,
  beforeCases,
  afterCases,
  automaticCases,
  hasCancellation,
  pinnedBookingCovers,
  hasOverride,
}: Readonly<{
  item: StockItem;
  beforeCases: number;
  afterCases: number;
  automaticCases: number;
  hasCancellation: boolean;
  pinnedBookingCovers: number;
  hasOverride: boolean;
}>): Readonly<{ code: ReasonCode; explanation: string }> {
  if (hasOverride && afterCases !== automaticCases) {
    return {
      code: REASON_CODES.MANUAL_OVERRIDE_KEPT,
      explanation: "The pinned case override stays in the working order.",
    };
  }

  if (afterCases < beforeCases && hasCancellation) {
    return {
      code: REASON_CODES.DEMAND_DOWN_EVENT_CANCELLED,
      explanation: "The cancelled event lowers forecast demand.",
    };
  }

  if (afterCases > beforeCases && pinnedBookingCovers > 0) {
    return {
      code: REASON_CODES.DEMAND_UP_PINNED_BOOKING,
      explanation: "The pinned booking raises forecast demand.",
    };
  }

  if (afterCases === 0 && getUsableStock(item) + item.inTransit > 0) {
    return {
      code: REASON_CODES.COVERED_BY_STOCK,
      explanation: "Usable stock and inbound cases cover forecast demand.",
    };
  }

  if (item.expiring > 0) {
    return {
      code: REASON_CODES.EXPIRING_STOCK_EXCLUDED,
      explanation: "Expiring stock is excluded from usable inventory.",
    };
  }

  return {
    code: REASON_CODES.UNCHANGED,
    explanation: "The recommended case count is unchanged.",
  };
}

function getActiveEventCovers(
  eventUplifts: readonly EventUplift[],
  signals: readonly LocalSignal[],
): number {
  const cancellations = signals.filter(
    (signal) => signal.kind === "event_cancelled",
  );

  return eventUplifts.reduce((total, event) => {
    const isCancelled = cancellations.some(
      (signal) => signal.eventId === undefined || signal.eventId === event.id,
    );
    return isCancelled ? total : total + event.covers;
  }, 0);
}

function getPinnedBookingCovers(
  signals: readonly LocalSignal[],
  pins: ReviewPins,
): number {
  const pinnedIds = new Set(pins.bookingIds);
  return signals.reduce(
    (total, signal) =>
      signal.kind === "booking" && pinnedIds.has(signal.id)
        ? total + signal.covers
        : total,
    0,
  );
}

export function createOrderPreview({
  savedPlan,
  items,
  baseCovers,
  eventUplifts,
  signals,
  pins,
  id,
  baseRevision,
}: Readonly<{
  savedPlan: OrderPlan;
  items: readonly StockItem[];
  baseCovers: number;
  eventUplifts: readonly EventUplift[];
  signals: readonly LocalSignal[];
  pins: ReviewPins;
  id: string;
  baseRevision: number;
}>): OrderPreview {
  const eventUplift = getActiveEventCovers(eventUplifts, signals);
  const pinnedBookings = getPinnedBookingCovers(signals, pins);
  const covers = baseCovers + eventUplift + pinnedBookings;
  const automaticPlan = calculatePlan({ items, covers });
  const hasCancellation = signals.some(
    (signal) => signal.kind === "event_cancelled",
  );

  const lines: PreviewLine[] = items.map((item) => {
    const beforeCases = findCases(savedPlan, item.id);
    const automaticCases = findCases(automaticPlan, item.id);
    const override = pins.lineOverrides[item.id];
    const hasOverride = override !== undefined;
    const afterCases = hasOverride ? Math.max(0, override) : automaticCases;
    const reason = getReason({
      item,
      beforeCases,
      afterCases,
      automaticCases,
      hasCancellation,
      pinnedBookingCovers: pinnedBookings,
      hasOverride,
    });

    return {
      skuId: item.id,
      beforeCases,
      afterCases,
      delta: afterCases - beforeCases,
      reason: reason.code,
      explanation: reason.explanation,
    };
  });

  const afterCost = lines.reduce((total, line) => {
    const item = items.find((candidate) => candidate.id === line.skuId);
    return total + line.afterCases * (item?.costPerCase ?? 0);
  }, 0);

  const warnings = Object.keys(pins.lineOverrides).map(
    (skuId) => `Pinned override kept for ${skuId}.`,
  );

  return {
    id,
    baseRevision,
    covers: {
      before: savedPlan.covers,
      after: covers,
      base: baseCovers,
      eventUplift,
      pinnedBookings,
    },
    laborHours: {
      before: savedPlan.laborHours,
      after: automaticPlan.laborHours,
    },
    lines,
    totals: {
      beforeCost: savedPlan.totalCost,
      afterCost,
    },
    warnings,
  };
}
