export type StockItem = Readonly<{
  id: string;
  name: string;
  unit: "kg" | "ea" | "L" | "head";
  caseSize: number;
  usagePerCover: number;
  onHand: number;
  inTransit: number;
  expiring: number;
  safety: number;
  perishable: boolean;
  costPerCase: number;
}>;

export type PlanLine = Readonly<{
  skuId: string;
  cases: number;
  lineCost: number;
}>;

export type OrderPlan = Readonly<{
  covers: number;
  laborHours: number;
  lines: readonly PlanLine[];
  totalCost: number;
}>;

export type EventUplift = Readonly<{
  id: string;
  covers: number;
}>;

type SignalBase = Readonly<{
  id: string;
  label: string;
  source: "tool" | "page";
  addedAt: string;
  occurredAt?: string;
  note?: string;
}>;

export type BookingSignal = SignalBase &
  Readonly<{
    kind: "booking";
    covers: number;
  }>;

export type EventCancelledSignal = SignalBase &
  Readonly<{
    kind: "event_cancelled";
    eventId?: string;
  }>;

export type OperatorNoteSignal = SignalBase &
  Readonly<{
    kind: "operator_note";
  }>;

export type LocalSignal =
  | BookingSignal
  | EventCancelledSignal
  | OperatorNoteSignal;

export type ReviewPins = Readonly<{
  bookingIds: readonly string[];
  lineOverrides: Readonly<Record<string, number>>;
}>;

export type ReasonCode =
  | "DEMAND_DOWN_EVENT_CANCELLED"
  | "DEMAND_UP_PINNED_BOOKING"
  | "MANUAL_OVERRIDE_KEPT"
  | "COVERED_BY_STOCK"
  | "EXPIRING_STOCK_EXCLUDED"
  | "UNCHANGED";

export type PreviewLine = Readonly<{
  skuId: string;
  beforeCases: number;
  afterCases: number;
  delta: number;
  reason: ReasonCode;
  explanation: string;
}>;

export type OrderPreview = Readonly<{
  id: string;
  baseRevision: number;
  covers: Readonly<{
    before: number;
    after: number;
    base: number;
    eventUplift: number;
    pinnedBookings: number;
  }>;
  laborHours: Readonly<{
    before: number;
    after: number;
  }>;
  lines: readonly PreviewLine[];
  totals: Readonly<{
    beforeCost: number;
    afterCost: number;
  }>;
  warnings: readonly string[];
}>;
