import {
  BASE_COVERS,
  SEED_COVERS,
  SEED_EVENT_UPLIFTS,
  SEED_ITEMS,
} from "../data/seed";
import type {
  LocalSignal,
  OrderPlan,
  OrderPreview,
  ReasonCode,
  ReviewPins,
} from "../domain/types";
import {
  calculatePlan,
  createOrderPreview,
  REASON_CODES,
} from "../engine/orderEngine";

export const RECEIPT_STORAGE_KEY = "cutoff:last-receipt";

export type ActivityEffect = "read" | "draft" | "save";
export type ActivityActor = "human" | "agent";

export type ActivityEntry = Readonly<{
  id: string;
  at: string;
  actor: ActivityActor;
  tool?: string;
  inputSummary: string;
  resultSummary: string;
  effect: ActivityEffect;
}>;

export type DraftPlan = Readonly<{
  plan: OrderPlan;
  reasons: Readonly<Record<string, ReasonCode>>;
}>;

export type HandoffReceipt = Readonly<{
  id: string;
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
  store: "Northgate";
  serviceDate: "2026-09-05";
  cutoffAt: "2026-09-04T22:00:00";
  deliveryAt: "2026-09-05T06:30:00";
  savedPlan: OrderPlan;
  draft: DraftPlan;
  signals: readonly LocalSignal[];
  pins: ReviewPins;
  focusedSkuId: string | null;
  preview: OrderPreview | null;
  revision: number;
  activity: readonly ActivityEntry[];
  lastReceipt: HandoffReceipt | null;
  undoAvailable: boolean;
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
  recordReadActivity: (
    tool: string,
    inputSummary: string,
    resultSummary: string,
  ) => void;
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
    (value.source !== "human" && value.source !== "agent") ||
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
      value.store !== "Northgate" ||
      value.serviceDate !== "2026-09-05" ||
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

function initialState(lastReceipt: HandoffReceipt | null): ReviewState {
  const savedPlan = calculatePlan({ items: SEED_ITEMS, covers: SEED_COVERS });
  return {
    store: "Northgate",
    serviceDate: "2026-09-05",
    cutoffAt: "2026-09-04T22:00:00",
    deliveryAt: "2026-09-05T06:30:00",
    savedPlan,
    draft: {
      plan: savedPlan,
      reasons: unchangedReasons(savedPlan),
    },
    signals: [],
    pins: { bookingIds: [], lineOverrides: {} },
    focusedSkuId: null,
    preview: null,
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
): ActivityEntry {
  return {
    id: createId("activity"),
    at: now(),
    actor,
    ...(tool ? { tool } : {}),
    inputSummary,
    resultSummary,
    effect,
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
  let state = initialState(readReceipt(storage));

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

  const invalidatePreview = (): boolean => state.preview !== null;

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

      const previewBecameStale = invalidatePreview();
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
      const entry = activityEntry(
        createId,
        now,
        actor,
        `${signal.kind}: ${signal.label}`,
        previewBecameStale
          ? `Signal added at revision ${nextRevision}; prior preview cleared.`
          : `Signal added at revision ${nextRevision}.`,
        "draft",
        tool,
      );

      setState({
        ...state,
        signals: [...state.signals, signal],
        pins: { ...state.pins, bookingIds },
        preview: null,
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
      const preview = createOrderPreview({
        savedPlan: state.draft.plan,
        items: SEED_ITEMS,
        baseCovers: BASE_COVERS,
        eventUplifts: SEED_EVENT_UPLIFTS,
        signals: state.signals,
        pins: state.pins,
        id: createId("preview"),
        baseRevision: nextRevision,
      });
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
        state.preview.baseRevision !== state.revision
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
          const item = SEED_ITEMS.find(
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
        preview: null,
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
        preview: null,
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
      const entry = activityEntry(
        createId,
        now,
        actor,
        `Pin ${skuId} at ${safeCases} cases.`,
        `Quantity pinned at revision ${nextRevision}; active preview cleared.`,
        "draft",
      );
      setState({
        ...state,
        pins: {
          ...state.pins,
          lineOverrides: {
            ...state.pins.lineOverrides,
            [skuId]: safeCases,
          },
        },
        preview: null,
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
      const entry = activityEntry(
        createId,
        now,
        actor,
        `Remove the ${skuId} quantity pin.`,
        `Pin removed at revision ${nextRevision}; active preview cleared.`,
        "draft",
      );
      setState({
        ...state,
        pins: { ...state.pins, lineOverrides },
        preview: null,
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
      const entry = activityEntry(
        createId,
        now,
        actor,
        `Remove the ${signalId} booking pin.`,
        `Booking pin removed at revision ${nextRevision}; active preview cleared.`,
        "draft",
      );
      setState({
        ...state,
        pins: {
          ...state.pins,
          bookingIds: state.pins.bookingIds.filter((id) => id !== signalId),
        },
        preview: null,
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
        store: state.store,
        serviceDate: state.serviceDate,
        revision: nextRevision,
        signals: state.signals,
        pins: state.pins,
        lines: state.draft.plan.lines.map((line) => ({
          skuId: line.skuId,
          name:
            SEED_ITEMS.find((item) => item.id === line.skuId)?.name ??
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
        "Save a handoff receipt.",
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
    recordReadActivity: (tool, inputSummary, resultSummary) => {
      const entry = activityEntry(
        createId,
        now,
        "agent",
        inputSummary,
        resultSummary,
        "read",
        tool,
      );
      setState({ ...state, activity: [...state.activity, entry] });
    },
    resetDemo: (actor) => {
      const nextRevision = state.revision + 1;
      undoHistory.length = 0;
      try {
        storage?.removeItem(RECEIPT_STORAGE_KEY);
      } catch {
        // The in-memory reset remains safe even when browser storage is blocked.
      }
      const reset = initialState(null);
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
