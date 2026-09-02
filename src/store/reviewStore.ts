import { SEED_ITEMS } from "../data/seed";
import {
  getPreset,
  isPresetId,
  type PresetId,
} from "../data/presets";
import type {
  LocalSignal,
  OrderPlan,
  OrderPreview,
  ReasonCode,
  ReviewPins,
} from "../domain/types";
import type {
  AddLaborSignalInput,
  AddLaborSignalResult,
  AdoptLaborPlanResult,
  LaborEngineState,
  LaborPreview,
  UndoLaborAdoptionResult,
} from "../domain/labor";
import type {
  LogWasteResult,
  RecordStockCountResult,
  StockEngineState,
  WasteReason,
} from "../domain/stock";
import {
  calculatePlan,
  createOrderPreview,
  REASON_CODES,
} from "../engine/orderEngine";
import {
  createSeedStockState,
  logWaste as applyWaste,
  recordStockCount as applyStockCount,
} from "../engine/stockEngine";
import {
  addLaborSignal as applyLaborSignal,
  adoptLaborPlan as applyLaborPlan,
  createLaborPreview,
  createSeedLaborState,
  undoLaborAdoption as applyLaborUndo,
} from "../engine/laborEngine";
import type { Section } from "../domain/sections";

export const RECEIPT_STORAGE_KEY = "cutoff:last-receipt";

export type ActivityEffect = "read" | "draft" | "save";
export type ActivityActor = "page" | "tool";

export type ActivityEntry = Readonly<{
  id: string;
  at: string;
  actor: ActivityActor;
  tool?: string;
  inputSummary: string;
  resultSummary: string;
  effect: ActivityEffect;
  section: Section;
}>;

export type DraftPlan = Readonly<{
  plan: OrderPlan;
  reasons: Readonly<Record<string, ReasonCode>>;
}>;

export type HandoffReceipt = Readonly<{
  id: string;
  presetId: PresetId;
  store: string;
  serviceDate: string;
  revision: number;
  signals: readonly LocalSignal[];
  pins: ReviewPins;
  lines: readonly Readonly<{
    skuId: string;
    name: string;
    cases: number;
    reason: ReasonCode;
  }>[];
  totalCost: number;
  managerSummary: string;
  savedAt: string;
  externalAction: false;
}>;

export type ReviewState = Readonly<{
  presetId: PresetId;
  store: "Northgate";
  serviceDate: string;
  cutoffAt: string;
  deliveryAt: string;
  baseCovers: number;
  eventUplifts: readonly Readonly<{ id: string; covers: number }>[];
  savedPlan: OrderPlan;
  stock: StockEngineState;
  labor: LaborEngineState;
  laborPreviewStaleReason: string | null;
  draft: DraftPlan;
  signals: readonly LocalSignal[];
  pins: ReviewPins;
  focusedSkuId: string | null;
  preview: OrderPreview | null;
  orderPreviewStaleReason: string | null;
  pendingOrderChanges: number;
  revision: number;
  activity: readonly ActivityEntry[];
  lastReceipt: HandoffReceipt | null;
  undoAvailable: boolean;
}>;

export type ShiftLogEntry = Readonly<{
  id: string;
  at: string;
  section: Section;
  actor: ActivityActor;
  tool?: string;
  summary: string;
}>;

export type ShiftLog = Readonly<{
  presetId: PresetId;
  serviceDate: string;
  entries: readonly ShiftLogEntry[];
  total: number;
  revision: number;
}>;

export type ReceiptStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

type AddSignalInput =
  | Readonly<{
      kind: "booking";
      label: string;
      covers: number;
      occurredAt?: string;
      note?: string;
    }>
  | Readonly<{
      kind: "event_cancelled";
      label: string;
      eventId?: string;
      occurredAt?: string;
      note?: string;
    }>
  | Readonly<{
      kind: "operator_note";
      label: string;
      occurredAt?: string;
      note?: string;
    }>;

export type StaleRevisionError = Readonly<{
  ok: false;
  error: "stale_revision";
  currentRevision: number;
  hint: "Read get_order_context and retry with the current revision.";
}>;

export type StalePreviewError = Readonly<{
  ok: false;
  error: "stale_preview";
  currentPreviewId: string | null;
  hint: "Call create_order_preview again, then adopt the new preview id.";
}>;

type NoUndoError = Readonly<{
  ok: false;
  error: "nothing_to_undo";
  hint: "Adopt a preview before asking to undo it.";
}>;

type StorageUnavailableError = Readonly<{
  ok: false;
  error: "storage_unavailable";
  hint: "Allow local storage, then retry save_handoff_receipt.";
}>;

type Success<T extends object> = Readonly<{ ok: true }> & Readonly<T>;

type RecordStockCountError = Exclude<RecordStockCountResult, { ok: true }>;
type LogWasteError = Exclude<LogWasteResult, { ok: true }>;
type AddLaborSignalError = Exclude<AddLaborSignalResult, { ok: true }>;
type AdoptLaborPlanError = Exclude<AdoptLaborPlanResult, { ok: true }>;
type UndoLaborAdoptionError = Exclude<UndoLaborAdoptionResult, { ok: true }>;

export type ReviewStore = Readonly<{
  getState: () => ReviewState;
  subscribe: (listener: () => void) => () => void;
  addLocalSignal: (
    input: AddSignalInput,
    expectedRevision: number,
    actor: ActivityActor,
    tool?: string,
  ) =>
    | Success<{
        signal: LocalSignal;
        revision: number;
        previewBecameStale: boolean;
      }>
    | StaleRevisionError;
  previewOrderPlan: (
    rationale: string | undefined,
    expectedRevision: number,
    actor: ActivityActor,
    tool?: string,
  ) => Success<{ preview: OrderPreview; revision: number }> | StaleRevisionError;
  adoptOrderDraft: (
    previewId: string,
    expectedRevision: number,
    note: string | undefined,
    actor: ActivityActor,
    tool?: string,
  ) =>
    | Success<{
        revision: number;
        plan: OrderPlan;
        undoAvailable: true;
      }>
    | StaleRevisionError
    | StalePreviewError;
  undoAdoption: (
    expectedRevision: number,
    actor: ActivityActor,
    tool?: string,
  ) =>
    | Success<{ revision: number; plan: OrderPlan }>
    | StaleRevisionError
    | NoUndoError;
  discardPreview: (
    expectedRevision: number,
    actor: ActivityActor,
  ) => Success<{ revision: number }> | StaleRevisionError;
  pinLineQuantity: (
    skuId: string,
    cases: number,
    expectedRevision: number,
    actor: ActivityActor,
  ) => Success<{ revision: number }> | StaleRevisionError;
  removeLinePin: (
    skuId: string,
    expectedRevision: number,
    actor: ActivityActor,
  ) => Success<{ revision: number }> | StaleRevisionError;
  removeBookingPin: (
    signalId: string,
    expectedRevision: number,
    actor: ActivityActor,
  ) => Success<{ revision: number }> | StaleRevisionError;
  focusSku: (
    skuId: string | null,
    expectedRevision: number,
    actor: ActivityActor,
  ) => Success<{ revision: number }> | StaleRevisionError;
  saveHandoffReceipt: (
    managerSummary: string,
    expectedRevision: number,
    actor: ActivityActor,
    tool?: string,
  ) =>
    | Success<{ receipt: HandoffReceipt; revision: number }>
    | StaleRevisionError
    | StorageUnavailableError;
  recordStockCount: (
    skuId: string,
    onHand: number,
    expiring: number,
    expectedRevision: number,
    actor: ActivityActor,
    tool?: string,
  ) =>
    | Success<{
        skuId: string;
        previous: Extract<RecordStockCountResult, { ok: true }>["previous"];
        current: Extract<RecordStockCountResult, { ok: true }>["current"];
        revision: number;
        orderPreviewInvalidated: boolean;
      }>
    | StaleRevisionError
    | RecordStockCountError;
  logWaste: (
    skuId: string,
    quantity: number,
    reason: WasteReason,
    note: string | undefined,
    expectedRevision: number,
    actor: ActivityActor,
    tool?: string,
  ) =>
    | Success<{
        entry: Extract<LogWasteResult, { ok: true }>["entry"];
        cost: number;
        newOnHand: number;
        newExpiring: number;
        weekTotal: number;
        revision: number;
        orderPreviewInvalidated: boolean;
      }>
    | StaleRevisionError
    | LogWasteError;
  addLaborSignal: (
    input: AddLaborSignalInput,
    expectedRevision: number,
    actor: ActivityActor,
    tool?: string,
  ) =>
    | Success<{
        signalId: string;
        kind: AddLaborSignalInput["kind"];
        staffId: string;
        revision: number;
        laborPreviewInvalidated: boolean;
      }>
    | StaleRevisionError
    | AddLaborSignalError;
  previewLaborPlan: (
    note: string | undefined,
    expectedRevision: number,
    actor: ActivityActor,
    tool?: string,
  ) => Success<{ preview: LaborPreview; revision: number }> | StaleRevisionError;
  adoptLaborPlan: (
    previewId: string,
    expectedRevision: number,
    note: string | undefined,
    actor: ActivityActor,
    tool?: string,
  ) =>
    | Success<{
        revision: number;
        scheduledTotal: number;
        undoAvailable: true;
        noExternalAction: true;
      }>
    | StaleRevisionError
    | AdoptLaborPlanError;
  undoLaborAdoption: (
    expectedRevision: number,
    actor: ActivityActor,
    tool?: string,
  ) =>
    | Success<{
        revision: number;
        scheduledTotal: number;
        undoAvailable: false;
      }>
    | StaleRevisionError
    | UndoLaborAdoptionError;
  discardLaborPreview: (
    expectedRevision: number,
    actor: ActivityActor,
  ) => Success<{ revision: number }> | StaleRevisionError;
  recordSectionOpen: (
    section: Section,
    actor: ActivityActor,
    tool?: string,
  ) => void;
  getShiftLog: (section?: Section, limit?: number) => ShiftLog;
  addShiftNote: (
    text: string,
    section: Section,
    expectedRevision: number,
    actor: ActivityActor,
    tool?: string,
  ) => Success<{ noteId: string; revision: number }> | StaleRevisionError;
  switchPreset: (presetId: PresetId, actor: ActivityActor) => void;
  resetDemo: (actor: ActivityActor) => void;
}>;

type StoreOptions = Readonly<{
  storage?: ReceiptStorage;
  now?: () => string;
  createId?: (prefix: string) => string;
}>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isReasonCode(value: unknown): value is ReasonCode {
  return (
    typeof value === "string" &&
    Object.values(REASON_CODES).some((reason) => reason === value)
  );
}

function readOptionalString(
  value: unknown,
  maximum: number,
): string | undefined | null {
  return value === undefined
    ? undefined
    : typeof value === "string" && value.length <= maximum
      ? value
      : null;
}

function isBoundedString(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= minimum &&
    value.length <= maximum
  );
}

function readStoredSignal(value: unknown): LocalSignal | null {
  if (
    !isObject(value) ||
    !isBoundedString(value.id, 1, 100) ||
    !isBoundedString(value.label, 1, 160) ||
    (value.source !== "page" && value.source !== "tool") ||
    !isBoundedString(value.addedAt, 1, 80)
  ) {
    return null;
  }
  const occurredAt = readOptionalString(value.occurredAt, 80);
  const note = readOptionalString(value.note, 500);
  if (occurredAt === null || note === null) {
    return null;
  }
  const base: Readonly<{
    id: string;
    label: string;
    source: ActivityActor;
    addedAt: string;
    occurredAt?: string;
    note?: string;
  }> = {
    id: value.id,
    label: value.label,
    source: value.source,
    addedAt: value.addedAt,
    ...(occurredAt ? { occurredAt } : {}),
    ...(note ? { note } : {}),
  };
  if (
    value.kind === "booking" &&
    typeof value.covers === "number" &&
    Number.isInteger(value.covers) &&
    value.covers >= 1 &&
    value.covers <= 2_000
  ) {
    return { ...base, kind: value.kind, covers: value.covers };
  }
  if (value.kind === "event_cancelled") {
    const eventId = readOptionalString(value.eventId, 100);
    return eventId === null
      ? null
      : { ...base, kind: value.kind, ...(eventId ? { eventId } : {}) };
  }
  return value.kind === "operator_note"
    ? { ...base, kind: value.kind }
    : null;
}

function readStoredPins(value: unknown): ReviewPins | null {
  if (
    !isObject(value) ||
    !Array.isArray(value.bookingIds) ||
    value.bookingIds.length > 100 ||
    !value.bookingIds.every((id) => isBoundedString(id, 1, 100)) ||
    !isObject(value.lineOverrides)
  ) {
    return null;
  }
  const entries = Object.entries(value.lineOverrides);
  const lineOverrides: Record<string, number> = {};
  for (const [skuId, cases] of entries) {
    if (
      typeof cases !== "number" ||
      !Number.isInteger(cases) ||
      cases < 0 ||
      cases > 10_000 ||
      !SEED_ITEMS.some((item) => item.id === skuId)
    ) {
      return null;
    }
    lineOverrides[skuId] = cases;
  }
  return {
    bookingIds: value.bookingIds,
    lineOverrides,
  };
}

function readStoredLine(
  value: unknown,
): HandoffReceipt["lines"][number] | null {
  return isObject(value) &&
    isBoundedString(value.skuId, 1, 100) &&
    isBoundedString(value.name, 1, 160) &&
    typeof value.cases === "number" &&
    Number.isInteger(value.cases) &&
    value.cases >= 0 &&
    value.cases <= 10_000 &&
    isReasonCode(value.reason)
    ? {
        skuId: value.skuId,
        name: value.name,
        cases: value.cases,
        reason: value.reason,
      }
    : null;
}

function readReceipt(storage: ReceiptStorage | undefined): HandoffReceipt | null {
  try {
    const raw = storage?.getItem(RECEIPT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const value: unknown = JSON.parse(raw);
    if (
      !isObject(value) ||
      !isBoundedString(value.id, 1, 100) ||
      typeof value.presetId !== "string" ||
      !isPresetId(value.presetId) ||
      value.store !== "Northgate" ||
      value.serviceDate !== getPreset(value.presetId).serviceDate ||
      typeof value.revision !== "number" ||
      !Number.isInteger(value.revision) ||
      value.revision < 0 ||
      !Array.isArray(value.signals) ||
      value.signals.length > 100 ||
      !Array.isArray(value.lines) ||
      value.lines.length !== SEED_ITEMS.length ||
      typeof value.totalCost !== "number" ||
      !Number.isInteger(value.totalCost) ||
      value.totalCost < 0 ||
      !isBoundedString(value.managerSummary, 1, 1_000) ||
      !isBoundedString(value.savedAt, 1, 80) ||
      Number.isNaN(Date.parse(value.savedAt)) ||
      value.externalAction !== false
    ) {
      return null;
    }
    const signals = value.signals.map(readStoredSignal);
    const pins = readStoredPins(value.pins);
    const lines = value.lines.map(readStoredLine);
    if (
      signals.some((signal) => signal === null) ||
      pins === null ||
      lines.some((line) => line === null) ||
      new Set(signals.map((signal) => signal?.id)).size !== signals.length ||
      new Set(lines.map((line) => line?.skuId)).size !== SEED_ITEMS.length
    ) {
      return null;
    }
    const restoredSignals = signals.filter((signal) => signal !== null);
    const restoredLines = lines.filter((line) => line !== null);
    const everyLineIsCurrent = SEED_ITEMS.every((item) =>
      restoredLines.some(
        (line) => line.skuId === item.id && line.name === item.name,
      ),
    );
    const bookingSignalIds = new Set(
      restoredSignals
        .filter((signal) => signal.kind === "booking")
        .map((signal) => signal.id),
    );
    const pinsReferenceBookings = pins.bookingIds.every((id) =>
      bookingSignalIds.has(id),
    );
    const calculatedCost = restoredLines.reduce((total, line) => {
      const item = SEED_ITEMS.find((candidate) => candidate.id === line.skuId);
      return total + line.cases * (item?.costPerCase ?? 0);
    }, 0);
    if (
      !everyLineIsCurrent ||
      !pinsReferenceBookings ||
      calculatedCost !== value.totalCost
    ) {
      return null;
    }
    return {
      id: value.id,
      presetId: value.presetId,
      store: value.store,
      serviceDate: value.serviceDate,
      revision: value.revision,
      signals: restoredSignals,
      pins,
      lines: restoredLines,
      totalCost: value.totalCost,
      managerSummary: value.managerSummary,
      savedAt: value.savedAt,
      externalAction: false,
    };
  } catch {
    return null;
  }
}

function browserStorage(): ReceiptStorage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function defaultCreateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function unchangedReasons(plan: OrderPlan): Readonly<Record<string, ReasonCode>> {
  return Object.fromEntries(
    plan.lines.map((line) => [line.skuId, REASON_CODES.UNCHANGED]),
  );
}

function initialState(
  presetId: PresetId,
  lastReceipt: HandoffReceipt | null,
): ReviewState {
  const preset = getPreset(presetId);
  const stock = createSeedStockState(SEED_ITEMS, {
    lastCountedAt: preset.stockLastCountedAt,
    ...(preset.stockWasteRows ? { wasteRows: preset.stockWasteRows } : {}),
  });
  const labor = createSeedLaborState(
    0,
    preset.laborShifts
      ? {
          shifts: preset.laborShifts,
          onCall: preset.onCall ?? [],
        }
      : undefined,
  );
  const savedPlan = calculatePlan({
    items: SEED_ITEMS,
    covers: preset.seedCovers,
  });
  return {
    presetId,
    store: "Northgate",
    serviceDate: preset.serviceDate,
    cutoffAt: preset.cutoffAt,
    deliveryAt: preset.deliveryAt,
    baseCovers: preset.baseCovers,
    eventUplifts: preset.eventUplifts,
    savedPlan,
    stock,
    labor,
    laborPreviewStaleReason: null,
    draft: {
      plan: savedPlan,
      reasons: unchangedReasons(savedPlan),
    },
    signals: [],
    pins: { bookingIds: [], lineOverrides: {} },
    focusedSkuId: null,
    preview: null,
    orderPreviewStaleReason: null,
    pendingOrderChanges: 0,
    revision: 0,
    activity: [],
    lastReceipt,
    undoAvailable: false,
  };
}

function staleRevision(currentRevision: number): StaleRevisionError {
  return {
    ok: false,
    error: "stale_revision",
    currentRevision,
    hint: "Read get_order_context and retry with the current revision.",
  };
}

function activityEntry(
  createId: (prefix: string) => string,
  now: () => string,
  actor: ActivityActor,
  inputSummary: string,
  resultSummary: string,
  effect: ActivityEffect,
  tool?: string,
  section: Section = "order",
): ActivityEntry {
  return {
    id: createId("activity"),
    at: now(),
    actor,
    ...(tool ? { tool } : {}),
    inputSummary,
    resultSummary,
    effect,
    section,
  };
}

export function createReviewStore(options: StoreOptions = {}): ReviewStore {
  const storage =
    options.storage ??
    browserStorage();
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? defaultCreateId;
  const listeners = new Set<() => void>();
  const undoHistory: DraftPlan[] = [];
  const storedReceipt = readReceipt(storage);
  let state = initialState(storedReceipt?.presetId ?? "saturday", storedReceipt);

  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const setState = (next: ReviewState) => {
    state = next;
    emit();
  };

  const checkRevision = (
    expectedRevision: number,
  ): StaleRevisionError | null =>
    expectedRevision === state.revision
      ? null
      : staleRevision(state.revision);

  const buildPreview = (
    source: Pick<ReviewState, "draft" | "signals" | "pins" | "stock">,
    revision: number,
  ): OrderPreview =>
    createOrderPreview({
      savedPlan: source.draft.plan,
      items: source.stock.items,
      baseCovers: state.baseCovers,
      eventUplifts: state.eventUplifts,
      signals: source.signals,
      pins: source.pins,
      id: createId("preview"),
      baseRevision: revision,
    });

  const previewAfterPageChange = (
    source: Pick<ReviewState, "draft" | "signals" | "pins" | "stock">,
    revision: number,
  ): OrderPreview | null =>
    state.preview !== null ? buildPreview(source, revision) : null;

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    addLocalSignal: (input, expectedRevision, actor, tool) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }

      const previewBecameStale = state.preview !== null;
      const base = {
        id: createId("signal"),
        label: input.label,
        source: actor,
        addedAt: now(),
        ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
        ...(input.note ? { note: input.note } : {}),
      } as const;
      const signal: LocalSignal =
        input.kind === "booking"
          ? { ...base, kind: input.kind, covers: input.covers }
          : input.kind === "event_cancelled"
            ? {
                ...base,
                kind: input.kind,
                ...(input.eventId ? { eventId: input.eventId } : {}),
              }
            : { ...base, kind: input.kind };
      const nextRevision = state.revision + 1;
      const bookingIds =
        signal.kind === "booking"
          ? [...state.pins.bookingIds, signal.id]
          : state.pins.bookingIds;
      const nextPins = { ...state.pins, bookingIds };
      const nextSignals = [...state.signals, signal];
      const refreshedPreview =
        actor === "page"
          ? previewAfterPageChange(
              {
                draft: state.draft,
                signals: nextSignals,
                pins: nextPins,
                stock: state.stock,
              },
              nextRevision,
            )
          : null;
      const entry = activityEntry(
        createId,
        now,
        actor,
        `${signal.kind}: ${signal.label}`,
        refreshedPreview
          ? `Signal added at revision ${nextRevision}; preview refreshed.`
          : previewBecameStale
            ? `Signal added at revision ${nextRevision}; prior preview cleared.`
          : `Signal added at revision ${nextRevision}.`,
        "draft",
        tool,
      );

      setState({
        ...state,
        signals: nextSignals,
        pins: nextPins,
        preview: refreshedPreview,
        orderPreviewStaleReason: null,
        pendingOrderChanges: refreshedPreview
          ? 0
          : state.pendingOrderChanges + 1,
        revision: nextRevision,
        activity: [...state.activity, entry],
      });
      return { ok: true, signal, revision: nextRevision, previewBecameStale };
    },
    previewOrderPlan: (rationale, expectedRevision, actor, tool) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }

      const nextRevision = state.revision + 1;
      const preview = buildPreview(state, nextRevision);
      const entry = activityEntry(
        createId,
        now,
        actor,
        rationale?.trim() || "Recompute the working order.",
        `Preview ${preview.id} created for ${preview.covers.after} covers.`,
        "draft",
        tool,
      );
      setState({
        ...state,
        preview,
        orderPreviewStaleReason: null,
        pendingOrderChanges: 0,
        revision: nextRevision,
        activity: [...state.activity, entry],
      });
      return { ok: true, preview, revision: nextRevision };
    },
    adoptOrderDraft: (previewId, expectedRevision, note, actor, tool) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      if (
        state.preview === null ||
        state.preview.id !== previewId ||
        state.orderPreviewStaleReason !== null ||
        state.pendingOrderChanges > 0
      ) {
        return {
          ok: false,
          error: "stale_preview",
          currentPreviewId: state.preview?.id ?? null,
          hint: "Call create_order_preview again, then adopt the new preview id.",
        };
      }

      undoHistory.push(state.draft);
      const plan: OrderPlan = {
        covers: state.preview.covers.after,
        laborHours: state.preview.laborHours.after,
        lines: state.preview.lines.map((line) => {
          const item = state.stock.items.find(
            (candidate) => candidate.id === line.skuId,
          );
          return {
            skuId: line.skuId,
            cases: line.afterCases,
            lineCost: line.afterCases * (item?.costPerCase ?? 0),
          };
        }),
        totalCost: state.preview.totals.afterCost,
      };
      const reasons = Object.fromEntries(
        state.preview.lines.map((line) => [line.skuId, line.reason]),
      );
      const nextRevision = state.revision + 1;
      const entry = activityEntry(
        createId,
        now,
        actor,
        note?.trim() || `Adopt preview ${previewId}.`,
        `Order preview adopted at revision ${nextRevision}. Nothing was sent to a supplier.`,
        "draft",
        tool,
      );
      setState({
        ...state,
        draft: { plan, reasons },
        labor:
          state.labor.preview === null
            ? state.labor
            : { ...state.labor, preview: null },
        laborPreviewStaleReason:
          state.labor.preview === null
            ? state.laborPreviewStaleReason
            : "Working order covers changed since this labor preview. Preview again.",
        preview: null,
        orderPreviewStaleReason: null,
        pendingOrderChanges: 0,
        revision: nextRevision,
        activity: [...state.activity, entry],
        undoAvailable: true,
      });
      return { ok: true, revision: nextRevision, plan, undoAvailable: true };
    },
    undoAdoption: (expectedRevision, actor, tool) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      const previous = undoHistory.pop();
      if (!previous) {
        return {
          ok: false,
          error: "nothing_to_undo",
          hint: "Adopt a preview before asking to undo it.",
        };
      }

      const nextRevision = state.revision + 1;
      const entry = activityEntry(
        createId,
        now,
        actor,
        "Undo the last adopted order preview.",
        `Previous working order restored at revision ${nextRevision}.`,
        "draft",
        tool,
      );
      setState({
        ...state,
        draft: previous,
        labor:
          state.labor.preview === null
            ? state.labor
            : { ...state.labor, preview: null },
        laborPreviewStaleReason:
          state.labor.preview === null
            ? state.laborPreviewStaleReason
            : "Working order covers changed since this labor preview. Preview again.",
        preview: null,
        orderPreviewStaleReason: null,
        pendingOrderChanges: 0,
        revision: nextRevision,
        activity: [...state.activity, entry],
        undoAvailable: undoHistory.length > 0,
      });
      return { ok: true, revision: nextRevision, plan: previous.plan };
    },
    discardPreview: (expectedRevision, actor) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      const nextRevision = state.revision + 1;
      const entry = activityEntry(
        createId,
        now,
        actor,
        "Discard the active preview.",
        `Preview cleared at revision ${nextRevision}.`,
        "draft",
      );
      setState({
        ...state,
        preview: null,
        orderPreviewStaleReason: null,
        pendingOrderChanges: 0,
        revision: nextRevision,
        activity: [...state.activity, entry],
      });
      return { ok: true, revision: nextRevision };
    },
    pinLineQuantity: (skuId, cases, expectedRevision, actor) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      const nextRevision = state.revision + 1;
      const safeCases = Math.max(0, Math.floor(cases));
      const nextPins = {
        ...state.pins,
        lineOverrides: {
          ...state.pins.lineOverrides,
          [skuId]: safeCases,
        },
      };
      const refreshedPreview =
        actor === "page"
          ? previewAfterPageChange(
              {
                draft: state.draft,
                signals: state.signals,
                pins: nextPins,
                stock: state.stock,
              },
              nextRevision,
            )
          : null;
      const entry = activityEntry(
        createId,
        now,
        actor,
        `Pin ${skuId} at ${safeCases} cases.`,
        refreshedPreview
          ? `Quantity pinned at revision ${nextRevision}; preview refreshed.`
          : `Quantity pinned at revision ${nextRevision}.`,
        "draft",
      );
      setState({
        ...state,
        pins: nextPins,
        preview: refreshedPreview,
        orderPreviewStaleReason: null,
        pendingOrderChanges: refreshedPreview
          ? 0
          : state.pendingOrderChanges + 1,
        revision: nextRevision,
        activity: [...state.activity, entry],
      });
      return { ok: true, revision: nextRevision };
    },
    removeLinePin: (skuId, expectedRevision, actor) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      const { [skuId]: _removed, ...lineOverrides } =
        state.pins.lineOverrides;
      const nextRevision = state.revision + 1;
      const nextPins = { ...state.pins, lineOverrides };
      const refreshedPreview =
        actor === "page"
          ? previewAfterPageChange(
              {
                draft: state.draft,
                signals: state.signals,
                pins: nextPins,
                stock: state.stock,
              },
              nextRevision,
            )
          : null;
      const entry = activityEntry(
        createId,
        now,
        actor,
        `Remove the ${skuId} quantity pin.`,
        refreshedPreview
          ? `Pin removed at revision ${nextRevision}; preview refreshed.`
          : `Pin removed at revision ${nextRevision}.`,
        "draft",
      );
      setState({
        ...state,
        pins: nextPins,
        preview: refreshedPreview,
        orderPreviewStaleReason: null,
        pendingOrderChanges: refreshedPreview
          ? 0
          : state.pendingOrderChanges + 1,
        revision: nextRevision,
        activity: [...state.activity, entry],
      });
      return { ok: true, revision: nextRevision };
    },
    removeBookingPin: (signalId, expectedRevision, actor) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      const nextRevision = state.revision + 1;
      const nextPins = {
        ...state.pins,
        bookingIds: state.pins.bookingIds.filter((id) => id !== signalId),
      };
      const refreshedPreview =
        actor === "page"
          ? previewAfterPageChange(
              {
                draft: state.draft,
                signals: state.signals,
                pins: nextPins,
                stock: state.stock,
              },
              nextRevision,
            )
          : null;
      const entry = activityEntry(
        createId,
        now,
        actor,
        `Remove the ${signalId} booking pin.`,
        refreshedPreview
          ? `Booking pin removed at revision ${nextRevision}; preview refreshed.`
          : `Booking pin removed at revision ${nextRevision}.`,
        "draft",
      );
      setState({
        ...state,
        pins: nextPins,
        preview: refreshedPreview,
        orderPreviewStaleReason: null,
        pendingOrderChanges: refreshedPreview
          ? 0
          : state.pendingOrderChanges + 1,
        revision: nextRevision,
        activity: [...state.activity, entry],
      });
      return { ok: true, revision: nextRevision };
    },
    focusSku: (skuId, expectedRevision, _actor) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      const currentRevision = state.revision;
      setState({
        ...state,
        focusedSkuId: skuId,
      });
      return { ok: true, revision: currentRevision };
    },
    recordStockCount: (
      skuId,
      onHand,
      expiring,
      expectedRevision,
      actor,
      tool,
    ) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      const result = applyStockCount({
        state: { ...state.stock, revision: state.revision },
        skuId,
        onHand,
        expiring,
        countedAt: now(),
        hasOrderPreview: state.preview !== null,
      });
      if (!result.ok) {
        return result;
      }
      const staleReason = result.orderPreviewInvalidated
        ? "Stock counts changed since this preview. Preview again."
        : null;
      const entry = activityEntry(
        createId,
        now,
        actor,
        `Record ${skuId}: ${onHand} on hand, ${expiring} expiring.`,
        result.orderPreviewInvalidated
          ? `Count recorded at revision ${result.revision}; order preview is stale.`
          : `Count recorded at revision ${result.revision}.`,
        "draft",
        tool,
        "stock",
      );
      setState({
        ...state,
        stock: result.state,
        orderPreviewStaleReason: staleReason,
        pendingOrderChanges: state.pendingOrderChanges + 1,
        revision: result.revision,
        activity: [...state.activity, entry],
      });
      return {
        ok: true,
        skuId: result.skuId,
        previous: result.previous,
        current: result.current,
        revision: result.revision,
        orderPreviewInvalidated: result.orderPreviewInvalidated,
      };
    },
    logWaste: (
      skuId,
      quantity,
      reason,
      note,
      expectedRevision,
      actor,
      tool,
    ) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      const result = applyWaste({
        state: { ...state.stock, revision: state.revision },
        skuId,
        quantity,
        reason,
        ...(note ? { note } : {}),
        entryId: createId("waste"),
        loggedAt: now(),
        hasOrderPreview: state.preview !== null,
      });
      if (!result.ok) {
        return result;
      }
      const staleReason = result.orderPreviewInvalidated
        ? "Stock counts changed since this preview. Preview again."
        : null;
      const entry = activityEntry(
        createId,
        now,
        actor,
        `Log ${quantity} ${skuId} as ${reason}.`,
        result.orderPreviewInvalidated
          ? `Waste logged at revision ${result.revision}; order preview is stale.`
          : `Waste logged at revision ${result.revision}.`,
        "draft",
        tool,
        "stock",
      );
      setState({
        ...state,
        stock: result.state,
        orderPreviewStaleReason: staleReason,
        pendingOrderChanges: state.pendingOrderChanges + 1,
        revision: result.revision,
        activity: [...state.activity, entry],
      });
      return {
        ok: true,
        entry: result.entry,
        cost: result.entry.cost,
        newOnHand: result.newOnHand,
        newExpiring: result.newExpiring,
        weekTotal: result.weekSummary.totalCost,
        revision: result.revision,
        orderPreviewInvalidated: result.orderPreviewInvalidated,
      };
    },
    addLaborSignal: (input, expectedRevision, actor, tool) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      const result = applyLaborSignal({
        state: state.labor,
        signalId: createId("labor-signal"),
        input,
      });
      if (!result.ok) {
        return result;
      }
      const nextRevision = state.revision + 1;
      const entry = activityEntry(
        createId,
        now,
        actor,
        result.signal.kind === "absence"
          ? `Record ${result.signal.staffId} absent.`
          : `Add ${result.signal.hours} ${result.signal.daypart} hours for ${result.signal.staffId}.`,
        result.laborPreviewInvalidated
          ? `Labor signal added at revision ${nextRevision}; prior labor preview cleared.`
          : `Labor signal added at revision ${nextRevision}.`,
        "draft",
        tool,
        "labor",
      );
      setState({
        ...state,
        labor: result.state,
        laborPreviewStaleReason: null,
        revision: nextRevision,
        activity: [...state.activity, entry],
      });
      return {
        ok: true,
        signalId: result.signal.id,
        kind: result.signal.kind,
        staffId: result.signal.staffId,
        revision: nextRevision,
        laborPreviewInvalidated: result.laborPreviewInvalidated,
      };
    },
    previewLaborPlan: (note, expectedRevision, actor, tool) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      const result = createLaborPreview({
        state: state.labor,
        forecastCovers: state.draft.plan.covers,
        previewId: createId("labor-preview"),
      });
      const nextRevision = state.revision + 1;
      const entry = activityEntry(
        createId,
        now,
        actor,
        note?.trim() || "Check the roster against the working order.",
        `Labor preview ${result.preview.id} created for ${result.preview.requiredTotal} required hours.`,
        "draft",
        tool,
        "labor",
      );
      setState({
        ...state,
        labor: result.state,
        laborPreviewStaleReason: null,
        revision: nextRevision,
        activity: [...state.activity, entry],
      });
      return { ok: true, preview: result.preview, revision: nextRevision };
    },
    adoptLaborPlan: (previewId, expectedRevision, note, actor, tool) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      const result = applyLaborPlan({ state: state.labor, previewId });
      if (!result.ok) {
        return result;
      }
      const nextRevision = state.revision + 1;
      const entry = activityEntry(
        createId,
        now,
        actor,
        note?.trim() || `Adopt labor preview ${previewId}.`,
        `Labor plan adopted at revision ${nextRevision}. Nothing was sent outside this page.`,
        "draft",
        tool,
        "labor",
      );
      setState({
        ...state,
        labor: result.state,
        laborPreviewStaleReason: null,
        revision: nextRevision,
        activity: [...state.activity, entry],
      });
      return {
        ok: true,
        revision: nextRevision,
        scheduledTotal: result.scheduledTotal,
        undoAvailable: true,
        noExternalAction: true,
      };
    },
    undoLaborAdoption: (expectedRevision, actor, tool) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      const result = applyLaborUndo({ state: state.labor });
      if (!result.ok) {
        return result;
      }
      const nextRevision = state.revision + 1;
      const entry = activityEntry(
        createId,
        now,
        actor,
        "Undo the last adopted labor preview.",
        `Previous working roster restored at revision ${nextRevision}.`,
        "draft",
        tool,
        "labor",
      );
      setState({
        ...state,
        labor: result.state,
        laborPreviewStaleReason: null,
        revision: nextRevision,
        activity: [...state.activity, entry],
      });
      return {
        ok: true,
        revision: nextRevision,
        scheduledTotal: result.scheduledTotal,
        undoAvailable: false,
      };
    },
    discardLaborPreview: (expectedRevision, actor) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      const nextRevision = state.revision + 1;
      const nextLaborRevision = state.labor.revision + 1;
      const entry = activityEntry(
        createId,
        now,
        actor,
        "Discard the active labor preview.",
        `Labor preview cleared at revision ${nextRevision}.`,
        "draft",
        undefined,
        "labor",
      );
      setState({
        ...state,
        labor: {
          ...state.labor,
          preview: null,
          revision: nextLaborRevision,
        },
        laborPreviewStaleReason: null,
        revision: nextRevision,
        activity: [...state.activity, entry],
      });
      return { ok: true, revision: nextRevision };
    },
    saveHandoffReceipt: (
      managerSummary,
      expectedRevision,
      actor,
      tool,
    ) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      const nextRevision = state.revision + 1;
      const receipt: HandoffReceipt = {
        id: createId("receipt"),
        presetId: state.presetId,
        store: state.store,
        serviceDate: state.serviceDate,
        revision: nextRevision,
        signals: state.signals,
        pins: state.pins,
        lines: state.draft.plan.lines.map((line) => ({
          skuId: line.skuId,
          name:
            state.stock.items.find((item) => item.id === line.skuId)?.name ??
            line.skuId,
          cases: line.cases,
          reason: state.draft.reasons[line.skuId] ?? REASON_CODES.UNCHANGED,
        })),
        totalCost: state.draft.plan.totalCost,
        managerSummary,
        savedAt: now(),
        externalAction: false,
      };
      try {
        if (!storage) {
          throw new Error("Local storage is unavailable.");
        }
        storage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(receipt));
      } catch {
        return {
          ok: false,
          error: "storage_unavailable",
          hint: "Allow local storage, then retry save_handoff_receipt.",
        };
      }
      const entry = activityEntry(
        createId,
        now,
        actor,
        `Handoff: ${managerSummary}`,
        `Receipt ${receipt.id} saved locally. Nothing was sent outside this page.`,
        "save",
        tool,
      );
      setState({
        ...state,
        lastReceipt: receipt,
        revision: nextRevision,
        activity: [...state.activity, entry],
      });
      return { ok: true, receipt, revision: nextRevision };
    },
    recordSectionOpen: (section, actor, tool) => {
      const entry = activityEntry(
        createId,
        now,
        actor,
        `Open the ${section} section.`,
        `Section changed with revision ${state.revision} preserved.`,
        "read",
        tool,
        section,
      );
      setState({ ...state, activity: [...state.activity, entry] });
    },
    getShiftLog: (section, limit = 50) => {
      const activityEntries: ShiftLogEntry[] = state.activity.map((entry) => ({
        id: entry.id,
        at: entry.at,
        section: entry.section,
        actor: entry.actor,
        ...(entry.tool ? { tool: entry.tool } : {}),
        summary: `${entry.inputSummary} ${entry.resultSummary}`,
      }));
      const receiptIsRecorded =
        state.lastReceipt === null ||
        state.activity.some((entry) =>
          entry.resultSummary.includes(state.lastReceipt?.id ?? ""),
        );
      const receiptEntries: ShiftLogEntry[] =
        state.lastReceipt && !receiptIsRecorded
          ? [
              {
                id: state.lastReceipt.id,
                at: state.lastReceipt.savedAt,
                section: "order",
                actor: "page",
                summary: `Handoff: ${state.lastReceipt.managerSummary} Saved locally at revision ${state.lastReceipt.revision}.`,
              },
            ]
          : [];
      const allEntries = [...activityEntries].reverse();
      allEntries.push(...receiptEntries);
      allEntries.sort((left, right) => right.at.localeCompare(left.at));
      const filtered = section
        ? allEntries.filter((entry) => entry.section === section)
        : allEntries;
      const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)));
      const entries = filtered.slice(0, safeLimit);
      return {
        presetId: state.presetId,
        serviceDate: state.serviceDate,
        entries,
        total: filtered.length,
        revision: state.revision,
      };
    },
    addShiftNote: (text, section, expectedRevision, actor, tool) => {
      const revisionError = checkRevision(expectedRevision);
      if (revisionError) {
        return revisionError;
      }
      const nextRevision = state.revision + 1;
      const entry = activityEntry(
        createId,
        now,
        actor,
        text.trim(),
        `Shift note saved at revision ${nextRevision}.`,
        "draft",
        tool,
        section,
      );
      setState({
        ...state,
        revision: nextRevision,
        activity: [...state.activity, entry],
      });
      return { ok: true, noteId: entry.id, revision: nextRevision };
    },
    switchPreset: (presetId, actor) => {
      undoHistory.length = 0;
      try {
        storage?.removeItem(RECEIPT_STORAGE_KEY);
      } catch {
        // The in-memory preset switch remains safe when storage is blocked.
      }
      const preset = getPreset(presetId);
      const reset = initialState(presetId, null);
      const entry = activityEntry(
        createId,
        now,
        actor,
        `Switch to ${preset.label}.`,
        `Preset ${presetId} loaded at revision 0.`,
        "draft",
        undefined,
        "order",
      );
      setState({ ...reset, activity: [entry] });
    },
    resetDemo: (actor) => {
      const nextRevision = state.revision + 1;
      undoHistory.length = 0;
      try {
        storage?.removeItem(RECEIPT_STORAGE_KEY);
      } catch {
        // The in-memory reset remains safe even when browser storage is blocked.
      }
      const reset = initialState(state.presetId, null);
      const entry = activityEntry(
        createId,
        now,
        actor,
        "Reset the synthetic demo.",
        `Seed restored at revision ${nextRevision}.`,
        "draft",
      );
      setState({
        ...reset,
        revision: nextRevision,
        activity: [entry],
      });
    },
  };
}
