import { SEED_ITEMS } from "../data/seed";
import { SECTIONS, type Section } from "../domain/sections";
import { WASTE_REASONS, type WasteReason } from "../domain/stock";
import {
  LABOR_DAYPARTS,
  type AddLaborSignalInput,
  type LaborDaypart,
} from "../domain/labor";
import type { LocalSignal } from "../domain/types";
import { calculateLine } from "../engine/orderEngine";
import { summarizeSkuWaste, summarizeWaste } from "../engine/stockEngine";
import { getLaborPlan } from "../engine/laborEngine";
import type { ReviewStore } from "../store/reviewStore";
import toolCatalog from "./toolCatalog.json";

export const TOOL_NAMES = {
  GET_CONTEXT: "get_order_context",
  GET_LINE_DETAIL: "get_line_detail",
  ADD_SIGNAL: "add_local_signal",
  PREVIEW: "create_order_preview",
  ADOPT: "adopt_order_preview",
  SAVE_RECEIPT: "save_handoff_receipt",
  GET_STOCK_STATUS: "get_stock_status",
  RECORD_STOCK_COUNT: "record_stock_count",
  LOG_WASTE: "log_waste",
  GET_LABOR_PLAN: "get_labor_plan",
  ADD_LABOR_SIGNAL: "add_labor_signal",
  CREATE_LABOR_PREVIEW: "create_labor_preview",
  ADOPT_LABOR_PLAN: "adopt_labor_plan",
  GET_SHIFT_LOG: "get_shift_log",
  ADD_SHIFT_NOTE: "add_shift_note",
  OPEN_SECTION: "open_section",
} as const;

export const TOOL_CATALOG = toolCatalog;
export const TOOL_SCHEMAS = {
  [TOOL_NAMES.GET_CONTEXT]: TOOL_CATALOG[TOOL_NAMES.GET_CONTEXT].inputSchema,
  [TOOL_NAMES.GET_LINE_DETAIL]: TOOL_CATALOG[TOOL_NAMES.GET_LINE_DETAIL].inputSchema,
  [TOOL_NAMES.ADD_SIGNAL]: TOOL_CATALOG[TOOL_NAMES.ADD_SIGNAL].inputSchema,
  [TOOL_NAMES.PREVIEW]: TOOL_CATALOG[TOOL_NAMES.PREVIEW].inputSchema,
  [TOOL_NAMES.ADOPT]: TOOL_CATALOG[TOOL_NAMES.ADOPT].inputSchema,
  [TOOL_NAMES.SAVE_RECEIPT]: TOOL_CATALOG[TOOL_NAMES.SAVE_RECEIPT].inputSchema,
  [TOOL_NAMES.GET_STOCK_STATUS]: TOOL_CATALOG[TOOL_NAMES.GET_STOCK_STATUS].inputSchema,
  [TOOL_NAMES.RECORD_STOCK_COUNT]: TOOL_CATALOG[TOOL_NAMES.RECORD_STOCK_COUNT].inputSchema,
  [TOOL_NAMES.LOG_WASTE]: TOOL_CATALOG[TOOL_NAMES.LOG_WASTE].inputSchema,
  [TOOL_NAMES.GET_LABOR_PLAN]: TOOL_CATALOG[TOOL_NAMES.GET_LABOR_PLAN].inputSchema,
  [TOOL_NAMES.ADD_LABOR_SIGNAL]: TOOL_CATALOG[TOOL_NAMES.ADD_LABOR_SIGNAL].inputSchema,
  [TOOL_NAMES.CREATE_LABOR_PREVIEW]: TOOL_CATALOG[TOOL_NAMES.CREATE_LABOR_PREVIEW].inputSchema,
  [TOOL_NAMES.ADOPT_LABOR_PLAN]: TOOL_CATALOG[TOOL_NAMES.ADOPT_LABOR_PLAN].inputSchema,
  [TOOL_NAMES.GET_SHIFT_LOG]: TOOL_CATALOG[TOOL_NAMES.GET_SHIFT_LOG].inputSchema,
  [TOOL_NAMES.ADD_SHIFT_NOTE]: TOOL_CATALOG[TOOL_NAMES.ADD_SHIFT_NOTE].inputSchema,
  [TOOL_NAMES.OPEN_SECTION]: TOOL_CATALOG[TOOL_NAMES.OPEN_SECTION].inputSchema,
};

type ToolEnvironment = Readonly<{
  section: Section;
  navigate: (section: Section) => void;
}>;

type PartialToolEnvironment = Partial<ToolEnvironment>;

function toolEnvironment(environment: PartialToolEnvironment = {}): ToolEnvironment {
  return {
    section: environment.section ?? "order",
    navigate: environment.navigate ?? (() => undefined),
  };
}

type ValidationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{
      ok: false;
      error: "invalid_input";
      issues: readonly string[];
      hint: "Correct the listed fields and retry this tool.";
    }>;

function invalidInput(issues: readonly string[]): ValidationResult<never> {
  return {
    ok: false,
    error: "invalid_input",
    issues,
    hint: "Correct the listed fields and retry this tool.",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkProperties(
  input: Record<string, unknown>,
  allowed: readonly string[],
): string[] {
  const allowedSet = new Set(allowed);
  return Object.keys(input)
    .filter((key) => !allowedSet.has(key))
    .map((key) => `Remove unsupported property: ${key}.`);
}

function readRevision(
  input: Record<string, unknown>,
  issues: string[],
): number {
  const value = input.expectedRevision;
  if (!Number.isInteger(value) || typeof value !== "number" || value < 0) {
    issues.push("expectedRevision must be a nonnegative whole number.");
    return 0;
  }
  return value;
}

function readOptionalText(
  value: unknown,
  field: string,
  maximum: number,
  issues: string[],
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length > maximum) {
    issues.push(`${field} must be text up to ${maximum} characters.`);
    return undefined;
  }
  return value.trim();
}

type AddSignalInput =
  | Readonly<{
      kind: "booking";
      label: string;
      covers: number;
      occurredAt?: string;
      note?: string;
      expectedRevision: number;
    }>
  | Readonly<{
      kind: "event_cancelled" | "operator_note";
      label: string;
      occurredAt?: string;
      note?: string;
      expectedRevision: number;
    }>;

function parseAddSignal(input: unknown): ValidationResult<AddSignalInput> {
  if (!isRecord(input)) {
    return invalidInput(["Input must be an object."]);
  }
  const issues = checkProperties(input, [
    "kind",
    "label",
    "covers",
    "occurredAt",
    "note",
    "expectedRevision",
  ]);
  const expectedRevision = readRevision(input, issues);
  const kind = input.kind;
  if (
    kind !== "booking" &&
    kind !== "event_cancelled" &&
    kind !== "operator_note"
  ) {
    issues.push(
      "kind must be booking, event_cancelled, or operator_note.",
    );
  }
  const label = input.label;
  if (
    typeof label !== "string" ||
    label.trim().length === 0 ||
    label.trim().length > 160
  ) {
    issues.push("label must contain 1 to 160 characters.");
  }
  const occurredAt = readOptionalText(
    input.occurredAt,
    "occurredAt",
    80,
    issues,
  );
  const note = readOptionalText(input.note, "note", 500, issues);
  const covers = input.covers;
  if (
    kind === "booking" &&
    (typeof covers !== "number" ||
      !Number.isInteger(covers) ||
      covers < 1 ||
      covers > 2_000)
  ) {
    issues.push(
      "Booking signals require a positive whole-number covers value.",
    );
  }
  if (kind !== "booking" && covers !== undefined) {
    issues.push("covers is accepted only for booking signals.");
  }

  if (
    issues.length > 0 ||
    typeof label !== "string" ||
    (kind !== "booking" &&
      kind !== "event_cancelled" &&
      kind !== "operator_note")
  ) {
    return invalidInput(issues);
  }

  const optional = {
    ...(occurredAt ? { occurredAt } : {}),
    ...(note ? { note } : {}),
  };
  if (kind === "booking") {
    if (typeof covers !== "number") {
      return invalidInput([
        "Booking signals require a positive whole-number covers value.",
      ]);
    }
    return {
      ok: true,
      value: {
        kind,
        label: label.trim(),
        covers,
        expectedRevision,
        ...optional,
      },
    };
  }
  return {
    ok: true,
    value: {
      kind,
      label: label.trim(),
      expectedRevision,
      ...optional,
    },
  };
}

function parseExpectedRevisionInput(
  input: unknown,
  optionalTextField?: Readonly<{ name: string; maximum: number }>,
): ValidationResult<Readonly<{ expectedRevision: number; text?: string }>> {
  if (!isRecord(input)) {
    return invalidInput(["Input must be an object."]);
  }
  const allowed = optionalTextField
    ? ["expectedRevision", optionalTextField.name]
    : ["expectedRevision"];
  const issues = checkProperties(input, allowed);
  const expectedRevision = readRevision(input, issues);
  const text = optionalTextField
    ? readOptionalText(
        input[optionalTextField.name],
        optionalTextField.name,
        optionalTextField.maximum,
        issues,
      )
    : undefined;
  if (issues.length > 0) {
    return invalidInput(issues);
  }
  return { ok: true, value: { expectedRevision, ...(text ? { text } : {}) } };
}

function parseAdoptInput(
  input: unknown,
): ValidationResult<
  Readonly<{ previewId: string; expectedRevision: number; note?: string }>
> {
  if (!isRecord(input)) {
    return invalidInput(["Input must be an object."]);
  }
  const issues = checkProperties(input, [
    "previewId",
    "expectedRevision",
    "note",
  ]);
  const expectedRevision = readRevision(input, issues);
  const previewId = input.previewId;
  if (
    typeof previewId !== "string" ||
    previewId.trim().length === 0 ||
    previewId.length > 100
  ) {
    issues.push("previewId must contain 1 to 100 characters.");
  }
  const note = readOptionalText(input.note, "note", 500, issues);
  if (issues.length > 0 || typeof previewId !== "string") {
    return invalidInput(issues);
  }
  return {
    ok: true,
    value: {
      previewId: previewId.trim(),
      expectedRevision,
      ...(note ? { note } : {}),
    },
  };
}

function parseSaveInput(
  input: unknown,
): ValidationResult<
  Readonly<{ expectedRevision: number; managerSummary: string }>
> {
  if (!isRecord(input)) {
    return invalidInput(["Input must be an object."]);
  }
  const issues = checkProperties(input, [
    "expectedRevision",
    "managerSummary",
  ]);
  const expectedRevision = readRevision(input, issues);
  const managerSummary = input.managerSummary;
  if (
    typeof managerSummary !== "string" ||
    managerSummary.trim().length === 0 ||
    managerSummary.trim().length > 1_000
  ) {
    issues.push("managerSummary must contain 1 to 1000 characters.");
  }
  if (issues.length > 0 || typeof managerSummary !== "string") {
    return invalidInput(issues);
  }
  return {
    ok: true,
    value: { expectedRevision, managerSummary: managerSummary.trim() },
  };
}

function parseSkuInput(
  input: unknown,
): ValidationResult<Readonly<{ skuId: string }>> {
  if (!isRecord(input)) {
    return invalidInput(["Input must be an object."]);
  }
  const issues = checkProperties(input, ["skuId"]);
  const skuId = input.skuId;
  if (
    typeof skuId !== "string" ||
    !SEED_ITEMS.some((item) => item.id === skuId)
  ) {
    issues.push("skuId must match a stock line from get_order_context.");
  }
  return issues.length > 0 || typeof skuId !== "string"
    ? invalidInput(issues)
    : { ok: true, value: { skuId } };
}

function readStockQuantity(
  value: unknown,
  field: string,
  issues: string[],
  allowZero: boolean,
): number {
  const minimumIsValid =
    typeof value === "number" && (allowZero ? value >= 0 : value > 0);
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !minimumIsValid ||
    value > 100_000
  ) {
    issues.push(
      `${field} must be ${allowZero ? "a nonnegative" : "a positive"} number up to 100000.`,
    );
    return 0;
  }
  return value;
}

function isWasteReason(value: unknown): value is WasteReason {
  return (
    typeof value === "string" &&
    WASTE_REASONS.some((candidate) => candidate === value)
  );
}

function parseStockCountInput(
  input: unknown,
): ValidationResult<
  Readonly<{
    expectedRevision: number;
    skuId: string;
    onHand: number;
    expiring?: number;
  }>
> {
  if (!isRecord(input)) {
    return invalidInput(["Input must be an object."]);
  }
  const issues = checkProperties(input, [
    "expectedRevision",
    "skuId",
    "onHand",
    "expiring",
  ]);
  const expectedRevision = readRevision(input, issues);
  const sku = parseSkuInput({ skuId: input.skuId });
  if (!sku.ok) {
    issues.push(...sku.issues);
  }
  const onHand = readStockQuantity(input.onHand, "onHand", issues, true);
  const expiring =
    input.expiring === undefined
      ? undefined
      : readStockQuantity(input.expiring, "expiring", issues, true);
  if (expiring !== undefined && expiring > onHand) {
    issues.push("expiring cannot exceed onHand.");
  }
  if (issues.length > 0 || !sku.ok) {
    return invalidInput(issues);
  }
  return {
    ok: true,
    value: {
      expectedRevision,
      skuId: sku.value.skuId,
      onHand,
      ...(expiring === undefined ? {} : { expiring }),
    },
  };
}

function parseWasteInput(
  input: unknown,
): ValidationResult<
  Readonly<{
    expectedRevision: number;
    skuId: string;
    quantity: number;
    reason: WasteReason;
    note?: string;
  }>
> {
  if (!isRecord(input)) {
    return invalidInput(["Input must be an object."]);
  }
  const issues = checkProperties(input, [
    "expectedRevision",
    "skuId",
    "quantity",
    "reason",
    "note",
  ]);
  const expectedRevision = readRevision(input, issues);
  const sku = parseSkuInput({ skuId: input.skuId });
  if (!sku.ok) {
    issues.push(...sku.issues);
  }
  const quantity = readStockQuantity(
    input.quantity,
    "quantity",
    issues,
    false,
  );
  const reason = input.reason;
  if (!isWasteReason(reason)) {
    issues.push(
      "reason must be expired, prep, dropped, or overproduction.",
    );
  }
  const note = readOptionalText(input.note, "note", 500, issues);
  if (
    issues.length > 0 ||
    !sku.ok ||
    !isWasteReason(reason)
  ) {
    return invalidInput(issues);
  }
  return {
    ok: true,
    value: {
      expectedRevision,
      skuId: sku.value.skuId,
      quantity,
      reason,
      ...(note ? { note } : {}),
    },
  };
}

function isLaborDaypart(value: unknown): value is LaborDaypart {
  return (
    typeof value === "string" &&
    LABOR_DAYPARTS.some((candidate) => candidate === value)
  );
}

function parseLaborSignalInput(
  input: unknown,
): ValidationResult<
  Readonly<{ expectedRevision: number; signal: AddLaborSignalInput }>
> {
  if (!isRecord(input)) {
    return invalidInput(["Input must be an object."]);
  }
  const issues = checkProperties(input, [
    "expectedRevision",
    "kind",
    "staffId",
    "daypart",
    "hours",
    "note",
  ]);
  const expectedRevision = readRevision(input, issues);
  const kind = input.kind;
  if (kind !== "absence" && kind !== "extra_shift") {
    issues.push("kind must be absence or extra_shift.");
  }
  const staffId = input.staffId;
  if (
    typeof staffId !== "string" ||
    staffId.trim().length === 0 ||
    staffId.trim().length > 100
  ) {
    issues.push("staffId must contain 1 to 100 characters.");
  }
  const note = readOptionalText(input.note, "note", 500, issues);

  if (kind === "absence") {
    if (input.daypart !== undefined || input.hours !== undefined) {
      issues.push("absence rejects daypart and hours.");
    }
    if (issues.length > 0 || typeof staffId !== "string") {
      return invalidInput(issues);
    }
    return {
      ok: true,
      value: {
        expectedRevision,
        signal: {
          kind,
          staffId: staffId.trim(),
          ...(note ? { note } : {}),
        },
      },
    };
  }

  const daypart = input.daypart;
  if (!isLaborDaypart(daypart)) {
    issues.push("daypart must be lunch, dinner, or prep for extra_shift.");
  }
  const hours = input.hours;
  if (
    typeof hours !== "number" ||
    !Number.isInteger(hours) ||
    hours < 1 ||
    hours > 12
  ) {
    issues.push("hours must be a whole number from 1 to 12 for extra_shift.");
  }
  if (
    kind !== "extra_shift" ||
    typeof staffId !== "string" ||
    !isLaborDaypart(daypart) ||
    typeof hours !== "number" ||
    issues.length > 0
  ) {
    return invalidInput(issues);
  }
  return {
    ok: true,
    value: {
      expectedRevision,
      signal: {
        kind,
        staffId: staffId.trim(),
        daypart,
        hours,
        ...(note ? { note } : {}),
      },
    },
  };
}

function parseSectionInput(
  input: unknown,
): ValidationResult<Readonly<{ section: Section }>> {
  if (!isRecord(input)) {
    return invalidInput(["Input must be an object."]);
  }
  const issues = checkProperties(input, ["section"]);
  const section = input.section;
  if (
    typeof section !== "string" ||
    !SECTIONS.some((candidate) => candidate === section)
  ) {
    issues.push("section must be order, stock, labor, or log.");
  }
  return issues.length > 0 || typeof section !== "string"
    ? invalidInput(issues)
    : { ok: true, value: { section: section as Section } };
}

function parseShiftLogInput(
  input: unknown,
): ValidationResult<Readonly<{ section?: Section; limit: number }>> {
  if (!isRecord(input)) {
    return invalidInput(["Input must be an object."]);
  }
  const issues = checkProperties(input, ["section", "limit"]);
  const section = input.section;
  if (
    section !== undefined &&
    (typeof section !== "string" ||
      !SECTIONS.some((candidate) => candidate === section))
  ) {
    issues.push("section must be order, stock, labor, or log.");
  }
  const limit = input.limit ?? 50;
  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 200
  ) {
    issues.push("limit must be a whole number from 1 to 200.");
  }
  if (issues.length > 0 || typeof limit !== "number") {
    return invalidInput(issues);
  }
  return {
    ok: true,
    value: {
      ...(typeof section === "string" ? { section: section as Section } : {}),
      limit,
    },
  };
}

function parseShiftNoteInput(
  input: unknown,
): ValidationResult<
  Readonly<{ expectedRevision: number; text: string; section: Section }>
> {
  if (!isRecord(input)) {
    return invalidInput(["Input must be an object."]);
  }
  const issues = checkProperties(input, ["expectedRevision", "text", "section"]);
  const expectedRevision = readRevision(input, issues);
  const text = input.text;
  if (
    typeof text !== "string" ||
    text.trim().length === 0 ||
    text.length > 500
  ) {
    issues.push("text must contain 1 to 500 characters.");
  }
  const section = input.section ?? "log";
  if (
    typeof section !== "string" ||
    !SECTIONS.some((candidate) => candidate === section)
  ) {
    issues.push("section must be order, stock, labor, or log.");
  }
  if (
    issues.length > 0 ||
    typeof text !== "string" ||
    typeof section !== "string"
  ) {
    return invalidInput(issues);
  }
  return {
    ok: true,
    value: {
      expectedRevision,
      text: text.trim(),
      section: section as Section,
    },
  };
}

function withoutOk<T extends Readonly<{ ok: boolean }>>(
  result: T,
): Omit<T, "ok"> {
  const { ok: _ok, ...output } = result;
  return output;
}

const abortedOutput = {
  error: "execution_aborted",
  hint: "The caller cancelled this tool. Read the current context before retrying.",
} as const;

function toolBoundary(
  handler: (input: unknown) => unknown | Promise<unknown>,
): WebMCP.ToolExecuteCallback {
  return async (input, options) => {
    if (options?.signal?.aborted) {
      return abortedOutput;
    }
    try {
      return await handler(input);
    } catch {
      return {
        error: "tool_failed",
        hint: "Reload the order review, read the current context, and retry.",
      };
    }
  };
}

function contextOutput(store: ReviewStore) {
  const state = store.getState();
  const eventCovers = state.eventUplifts.reduce(
    (total, event) => total + event.covers,
    0,
  );
  return {
    presetId: state.presetId,
    guide:
      "Mutating tools need expectedRevision from this result or the last mutation. A preview never changes the saved plan. Ask the manager before adopting or saving.",
    store: state.store,
    serviceDate: state.serviceDate,
    cutoffAt: state.cutoffAt,
    deliveryAt: state.deliveryAt,
    forecast: {
      base: state.baseCovers,
      eventCovers,
      saved: state.savedPlan.covers,
    },
    draft: {
      covers: state.draft.plan.covers,
      laborHours: state.draft.plan.laborHours,
      cost: state.draft.plan.totalCost,
    },
    lines: state.stock.items.map((item) => {
      const saved = state.savedPlan.lines.find(
        (line) => line.skuId === item.id,
      );
      const draft = state.draft.plan.lines.find(
        (line) => line.skuId === item.id,
      );
      const preview = state.preview?.lines.find(
        (line) => line.skuId === item.id,
      );
      return {
        id: item.id,
        name: item.name,
        savedCases: saved?.cases ?? 0,
        draftCases: draft?.cases ?? 0,
        ...(preview
          ? {
              previewCases: preview.afterCases,
              delta: preview.delta,
              reason: preview.reason,
            }
          : { reason: state.draft.reasons[item.id] }),
      };
    }),
    focusedSkuId: state.focusedSkuId,
    pins: state.pins,
    signals: state.signals.map((signal) => ({
      id: signal.id,
      kind: signal.kind,
      label: signal.label,
      source: signal.source,
      ...(signal.kind === "booking" ? { covers: signal.covers } : {}),
      ...(signal.occurredAt ? { occurredAt: signal.occurredAt } : {}),
      ...(signal.note ? { note: signal.note } : {}),
    })),
    previewId: state.preview?.id ?? null,
    revision: state.revision,
  };
}

function getContextTool(store: ReviewStore): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.GET_CONTEXT,
    ...TOOL_CATALOG[TOOL_NAMES.GET_CONTEXT],
    execute: toolBoundary((input) => {
      if (!isRecord(input)) {
        return withoutOk(invalidInput(["Input must be an object."]));
      }
      const issues = checkProperties(input, []);
      if (issues.length > 0) {
        return withoutOk(invalidInput(issues));
      }
      return contextOutput(store);
    }),
  };
}

function getLineDetailTool(store: ReviewStore): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.GET_LINE_DETAIL,
    ...TOOL_CATALOG[TOOL_NAMES.GET_LINE_DETAIL],
    execute: toolBoundary((input) => {
      const parsed = parseSkuInput(input);
      if (!parsed.ok) {
        return withoutOk(parsed);
      }
      const state = store.getState();
      const item = state.stock.items.find(
        (candidate) => candidate.id === parsed.value.skuId,
      );
      if (!item) {
        return withoutOk(
          invalidInput(["skuId must match a stock line from get_order_context."]),
        );
      }
      const covers = state.preview?.covers.after ?? state.draft.plan.covers;
      const calculation = calculateLine(item, covers);
      const previewLine = state.preview?.lines.find(
        (line) => line.skuId === item.id,
      );
      const output = {
        item: item.name,
        unit: item.unit,
        caseSize: item.caseSize,
        usagePerCover: item.usagePerCover,
        onHand: item.onHand,
        expiring: item.expiring,
        usable: calculation.usable,
        inTransit: item.inTransit,
        safety: item.safety,
        safetyRationale: "Running out costs more margin than the waste.",
        demand: calculation.demand,
        need: calculation.need,
        calculatedCases: calculation.calculatedCases,
        pinnedCases: state.pins.lineOverrides[item.id] ?? null,
        currentReason:
          previewLine?.reason ?? state.draft.reasons[item.id] ?? "UNCHANGED",
        expiringShare: item.onHand === 0 ? 0 : item.expiring / item.onHand,
      };
      return output;
    }),
  };
}

function addSignalTool(store: ReviewStore): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.ADD_SIGNAL,
    ...TOOL_CATALOG[TOOL_NAMES.ADD_SIGNAL],
    execute: toolBoundary((input) => {
      const parsed = parseAddSignal(input);
      if (!parsed.ok) {
        return withoutOk(parsed);
      }
      const { expectedRevision, ...signal } = parsed.value;
      const result = store.addLocalSignal(
        signal,
        expectedRevision,
        "tool",
        TOOL_NAMES.ADD_SIGNAL,
      );
      if (!result.ok) {
        return withoutOk(result);
      }
      return {
        signalId: result.signal.id,
        kind: result.signal.kind,
        label: result.signal.label,
        revision: result.revision,
        previewBecameStale: result.previewBecameStale,
      };
    }),
  };
}

function previewTool(store: ReviewStore): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.PREVIEW,
    ...TOOL_CATALOG[TOOL_NAMES.PREVIEW],
    execute: toolBoundary((input) => {
      const parsed = parseExpectedRevisionInput(input, {
        name: "rationale",
        maximum: 500,
      });
      if (!parsed.ok) {
        return withoutOk(parsed);
      }
      const result = store.previewOrderPlan(
        parsed.value.text,
        parsed.value.expectedRevision,
        "tool",
        TOOL_NAMES.PREVIEW,
      );
      if (!result.ok) {
        return withoutOk(result);
      }
      return {
        previewId: result.preview.id,
        revision: result.revision,
        covers: result.preview.covers,
        laborHours: result.preview.laborHours,
        lines: result.preview.lines.map((line) => ({
          id: line.skuId,
          before: line.beforeCases,
          after: line.afterCases,
          delta: line.delta,
          reason: line.reason,
        })),
        cost: {
          before: result.preview.totals.beforeCost,
          after: result.preview.totals.afterCost,
        },
        warnings: result.preview.warnings,
      };
    }),
  };
}

function adoptTool(store: ReviewStore): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.ADOPT,
    ...TOOL_CATALOG[TOOL_NAMES.ADOPT],
    execute: toolBoundary((input) => {
      const parsed = parseAdoptInput(input);
      if (!parsed.ok) {
        return withoutOk(parsed);
      }
      const result = store.adoptOrderDraft(
        parsed.value.previewId,
        parsed.value.expectedRevision,
        parsed.value.note,
        "tool",
        TOOL_NAMES.ADOPT,
      );
      if (!result.ok) {
        return withoutOk(result);
      }
      return {
        revision: result.revision,
        adopted: {
          covers: result.plan.covers,
          laborHours: result.plan.laborHours,
          cost: result.plan.totalCost,
        },
        undoAvailable: result.undoAvailable,
        noExternalAction: "Nothing was sent to any supplier.",
      };
    }),
  };
}

function saveReceiptTool(store: ReviewStore): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.SAVE_RECEIPT,
    ...TOOL_CATALOG[TOOL_NAMES.SAVE_RECEIPT],
    execute: toolBoundary((input) => {
      const parsed = parseSaveInput(input);
      if (!parsed.ok) {
        return withoutOk(parsed);
      }
      const result = store.saveHandoffReceipt(
        parsed.value.managerSummary,
        parsed.value.expectedRevision,
        "tool",
        TOOL_NAMES.SAVE_RECEIPT,
      );
      if (!result.ok) {
        return withoutOk(result);
      }
      return {
        receiptId: result.receipt.id,
        presetId: result.receipt.presetId,
        revision: result.revision,
        confirmation:
          "Saved in this browser. Nothing was sent outside this page.",
      };
    }),
  };
}

function getStockStatusTool(store: ReviewStore): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.GET_STOCK_STATUS,
    ...TOOL_CATALOG[TOOL_NAMES.GET_STOCK_STATUS],
    execute: toolBoundary((input) => {
      if (!isRecord(input)) {
        return withoutOk(invalidInput(["Input must be an object."]));
      }
      const issues = checkProperties(input, []);
      if (issues.length > 0) {
        return withoutOk(invalidInput(issues));
      }
      const state = store.getState();
      const totals = summarizeWaste(state.stock.wasteLedger);
      const output = {
        presetId: state.presetId,
        items: state.stock.items.map((item) => {
          const waste = summarizeSkuWaste(state.stock.wasteLedger, item.id);
          return {
            id: item.id,
            name: item.name,
            unit: item.unit,
            onHand: item.onHand,
            expiring: item.expiring,
            lastCountedAt: item.lastCountedAt,
            wasteWeekQty: waste.quantity,
            wasteWeekCost: waste.cost,
          };
        }),
        totals: {
          wasteWeekCost: totals.totalCost,
          byReason: totals.byReason,
          topReason: totals.topReason,
        },
        orderPreviewStale: state.orderPreviewStaleReason !== null,
        revision: state.revision,
      };
      return output;
    }),
  };
}

function recordStockCountTool(store: ReviewStore): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.RECORD_STOCK_COUNT,
    ...TOOL_CATALOG[TOOL_NAMES.RECORD_STOCK_COUNT],
    execute: toolBoundary((input) => {
      const parsed = parseStockCountInput(input);
      if (!parsed.ok) {
        return withoutOk(parsed);
      }
      const item = store
        .getState()
        .stock.items.find((candidate) => candidate.id === parsed.value.skuId);
      if (!item) {
        return withoutOk(
          invalidInput(["skuId must match an item from get_stock_status."]),
        );
      }
      const result = store.recordStockCount(
        parsed.value.skuId,
        parsed.value.onHand,
        parsed.value.expiring ?? item.expiring,
        parsed.value.expectedRevision,
        "tool",
        TOOL_NAMES.RECORD_STOCK_COUNT,
      );
      if (!result.ok) {
        return withoutOk(result);
      }
      return {
        skuId: result.skuId,
        previous: result.previous,
        current: result.current,
        revision: result.revision,
        orderPreviewInvalidated: result.orderPreviewInvalidated,
      };
    }),
  };
}

function logWasteTool(store: ReviewStore): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.LOG_WASTE,
    ...TOOL_CATALOG[TOOL_NAMES.LOG_WASTE],
    execute: toolBoundary((input) => {
      const parsed = parseWasteInput(input);
      if (!parsed.ok) {
        return withoutOk(parsed);
      }
      const result = store.logWaste(
        parsed.value.skuId,
        parsed.value.quantity,
        parsed.value.reason,
        parsed.value.note,
        parsed.value.expectedRevision,
        "tool",
        TOOL_NAMES.LOG_WASTE,
      );
      if (!result.ok) {
        return withoutOk(result);
      }
      return {
        entryId: result.entry.id,
        cost: result.cost,
        newOnHand: result.newOnHand,
        newExpiring: result.newExpiring,
        weekTotal: result.weekTotal,
        revision: result.revision,
        orderPreviewInvalidated: result.orderPreviewInvalidated,
      };
    }),
  };
}

function getLaborPlanTool(store: ReviewStore): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.GET_LABOR_PLAN,
    ...TOOL_CATALOG[TOOL_NAMES.GET_LABOR_PLAN],
    execute: toolBoundary((input) => {
      if (!isRecord(input)) {
        return withoutOk(invalidInput(["Input must be an object."]));
      }
      const issues = checkProperties(input, []);
      if (issues.length > 0) {
        return withoutOk(invalidInput(issues));
      }
      const state = store.getState();
      const plan = getLaborPlan({
        state: state.labor,
        forecastCovers: state.draft.plan.covers,
      });
      const output = {
        ...plan,
        presetId: state.presetId,
        revision: state.revision,
      };
      return output;
    }),
  };
}

function addLaborSignalTool(store: ReviewStore): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.ADD_LABOR_SIGNAL,
    ...TOOL_CATALOG[TOOL_NAMES.ADD_LABOR_SIGNAL],
    execute: toolBoundary((input) => {
      const parsed = parseLaborSignalInput(input);
      if (!parsed.ok) {
        return withoutOk(parsed);
      }
      const result = store.addLaborSignal(
        parsed.value.signal,
        parsed.value.expectedRevision,
        "tool",
        TOOL_NAMES.ADD_LABOR_SIGNAL,
      );
      return withoutOk(result);
    }),
  };
}

function createLaborPreviewTool(store: ReviewStore): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.CREATE_LABOR_PREVIEW,
    ...TOOL_CATALOG[TOOL_NAMES.CREATE_LABOR_PREVIEW],
    execute: toolBoundary((input) => {
      const parsed = parseExpectedRevisionInput(input, {
        name: "note",
        maximum: 500,
      });
      if (!parsed.ok) {
        return withoutOk(parsed);
      }
      const result = store.previewLaborPlan(
        parsed.value.text,
        parsed.value.expectedRevision,
        "tool",
        TOOL_NAMES.CREATE_LABOR_PREVIEW,
      );
      if (!result.ok) {
        return withoutOk(result);
      }
      return {
        previewId: result.preview.id,
        revision: result.revision,
        dayparts: result.preview.dayparts,
        totals: result.preview.totals,
      };
    }),
  };
}

function adoptLaborPlanTool(store: ReviewStore): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.ADOPT_LABOR_PLAN,
    ...TOOL_CATALOG[TOOL_NAMES.ADOPT_LABOR_PLAN],
    execute: toolBoundary((input) => {
      const parsed = parseAdoptInput(input);
      if (!parsed.ok) {
        return withoutOk(parsed);
      }
      const result = store.adoptLaborPlan(
        parsed.value.previewId,
        parsed.value.expectedRevision,
        parsed.value.note,
        "tool",
        TOOL_NAMES.ADOPT_LABOR_PLAN,
      );
      if (!result.ok) {
        return withoutOk(result);
      }
      return {
        revision: result.revision,
        scheduledTotal: result.scheduledTotal,
        undoAvailable: result.undoAvailable,
        noExternalAction: "Nothing was sent outside this page.",
      };
    }),
  };
}

function getShiftLogTool(store: ReviewStore): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.GET_SHIFT_LOG,
    ...TOOL_CATALOG[TOOL_NAMES.GET_SHIFT_LOG],
    execute: toolBoundary((input) => {
      const parsed = parseShiftLogInput(input);
      if (!parsed.ok) {
        return withoutOk(parsed);
      }
      return store.getShiftLog(
        parsed.value.section,
        parsed.value.limit,
      );
    }),
  };
}

function addShiftNoteTool(store: ReviewStore): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.ADD_SHIFT_NOTE,
    ...TOOL_CATALOG[TOOL_NAMES.ADD_SHIFT_NOTE],
    execute: toolBoundary((input) => {
      const parsed = parseShiftNoteInput(input);
      if (!parsed.ok) {
        return withoutOk(parsed);
      }
      const result = store.addShiftNote(
        parsed.value.text,
        parsed.value.section,
        parsed.value.expectedRevision,
        "tool",
        TOOL_NAMES.ADD_SHIFT_NOTE,
      );
      return withoutOk(result);
    }),
  };
}

export function getToolNamesForSection(
  section: Section,
  store: ReviewStore,
): readonly string[] {
  if (section === "stock") {
    return [
      TOOL_NAMES.GET_STOCK_STATUS,
      TOOL_NAMES.RECORD_STOCK_COUNT,
      TOOL_NAMES.LOG_WASTE,
      TOOL_NAMES.OPEN_SECTION,
    ];
  }
  if (section === "labor") {
    const state = store.getState();
    const base = [
      TOOL_NAMES.GET_LABOR_PLAN,
      TOOL_NAMES.ADD_LABOR_SIGNAL,
      TOOL_NAMES.CREATE_LABOR_PREVIEW,
      TOOL_NAMES.OPEN_SECTION,
    ];
    return state.labor.preview !== null &&
      state.labor.preview.baseRevision === state.labor.revision &&
      state.laborPreviewStaleReason === null
      ? [...base, TOOL_NAMES.ADOPT_LABOR_PLAN]
      : base;
  }
  if (section === "log") {
    return [
      TOOL_NAMES.GET_SHIFT_LOG,
      TOOL_NAMES.ADD_SHIFT_NOTE,
      TOOL_NAMES.OPEN_SECTION,
    ];
  }
  if (section !== "order") {
    return [TOOL_NAMES.OPEN_SECTION];
  }
  const state = store.getState();
  const base = [
    TOOL_NAMES.GET_CONTEXT,
    TOOL_NAMES.GET_LINE_DETAIL,
    TOOL_NAMES.ADD_SIGNAL,
    TOOL_NAMES.PREVIEW,
    TOOL_NAMES.SAVE_RECEIPT,
    TOOL_NAMES.OPEN_SECTION,
  ];
  return state.preview !== null &&
    state.orderPreviewStaleReason === null &&
    state.pendingOrderChanges === 0
    ? [...base, TOOL_NAMES.ADOPT]
    : base;
}

function openSectionTool(
  store: ReviewStore,
  environment: ToolEnvironment,
): WebMCP.ModelContextTool {
  return {
    name: TOOL_NAMES.OPEN_SECTION,
    ...TOOL_CATALOG[TOOL_NAMES.OPEN_SECTION],
    execute: toolBoundary((input) => {
      const parsed = parseSectionInput(input);
      if (!parsed.ok) {
        return withoutOk(parsed);
      }
      const output = {
        section: parsed.value.section,
        toolNames: getToolNamesForSection(parsed.value.section, store),
        revision: store.getState().revision,
      };
      store.recordSectionOpen(
        parsed.value.section,
        "tool",
        TOOL_NAMES.OPEN_SECTION,
      );
      environment.navigate(parsed.value.section);
      return output;
    }),
  };
}

export function createToolDefinitions(
  store: ReviewStore,
  partialEnvironment: PartialToolEnvironment = {},
): Readonly<{
  base: readonly WebMCP.ModelContextTool[];
  adopt: WebMCP.ModelContextTool;
}> {
  const environment = toolEnvironment(partialEnvironment);
  const openSection = openSectionTool(store, environment);
  const base =
    environment.section === "order"
      ? [
          getContextTool(store),
          getLineDetailTool(store),
          addSignalTool(store),
          previewTool(store),
          saveReceiptTool(store),
          openSection,
        ]
      : environment.section === "stock"
        ? [
            getStockStatusTool(store),
            recordStockCountTool(store),
            logWasteTool(store),
            openSection,
          ]
        : environment.section === "labor"
          ? [
              getLaborPlanTool(store),
              addLaborSignalTool(store),
              createLaborPreviewTool(store),
              openSection,
            ]
          : environment.section === "log"
            ? [
                getShiftLogTool(store),
                addShiftNoteTool(store),
                openSection,
              ]
          : [openSection];
  return {
    base,
    adopt:
      environment.section === "labor"
        ? adoptLaborPlanTool(store)
        : adoptTool(store),
  };
}

export type WebMCPStatus = Readonly<{
  supported: boolean;
  toolCount: number;
  error: string | null;
}>;

type RegistrationSession = {
  store: ReviewStore;
  section: Section;
  modelContext: WebMCP.ModelContext;
  definitions: ReturnType<typeof createToolDefinitions>;
  routeController: AbortController;
  navigationController: AbortController;
  navigationTarget: { current: (section: Section) => void };
  adoptController: AbortController | null;
  releaseStore: () => void;
  listeners: Set<(status: WebMCPStatus) => void>;
  references: number;
  generation: number;
  status: WebMCPStatus;
};

const sessions = new WeakMap<WebMCP.ModelContext, RegistrationSession>();

function notify(session: RegistrationSession) {
  for (const listener of session.listeners) {
    listener(session.status);
  }
}

function updateStatus(
  session: RegistrationSession,
  status: WebMCPStatus,
) {
  session.status = status;
  notify(session);
}

function reportRegistrationError(
  session: RegistrationSession,
  signal: AbortSignal,
) {
  return () => {
    if (signal.aborted) {
      return;
    }
    updateStatus(session, {
      ...session.status,
      error: "WebMCP tool registration failed.",
    });
  };
}

function register(
  session: RegistrationSession,
  tool: WebMCP.ModelContextTool,
  controller: AbortController,
) {
  try {
    void session.modelContext
      .registerTool(tool, { signal: controller.signal })
      .catch(reportRegistrationError(session, controller.signal));
  } catch {
    reportRegistrationError(session, controller.signal)();
  }
}

function splitBaseTools(
  definitions: ReturnType<typeof createToolDefinitions>,
) {
  const navigationTool = definitions.base.find(
    ({ name }) => name === TOOL_NAMES.OPEN_SECTION,
  );
  if (!navigationTool) {
    throw new Error("The WebMCP navigation tool is missing.");
  }
  return {
    navigationTool,
    routeTools: definitions.base.filter(
      ({ name }) => name !== TOOL_NAMES.OPEN_SECTION,
    ),
  } as const;
}

function syncAdoptRegistration(session: RegistrationSession) {
  const state = session.store.getState();
  const shouldRegister =
    (session.section === "order" &&
      state.preview !== null &&
      state.orderPreviewStaleReason === null &&
      state.pendingOrderChanges === 0) ||
    (session.section === "labor" &&
      state.labor.preview !== null &&
      state.labor.preview.baseRevision === state.labor.revision &&
      state.laborPreviewStaleReason === null);

  if (shouldRegister && session.adoptController === null) {
    session.adoptController = new AbortController();
    register(session, session.definitions.adopt, session.adoptController);
    updateStatus(session, {
      supported: true,
      toolCount: session.definitions.base.length + 1,
      error: session.status.error,
    });
    return;
  }

  if (!shouldRegister && session.adoptController !== null) {
    const controller = session.adoptController;
    globalThis.setTimeout(() => {
      const currentState = session.store.getState();
      const previewIsCurrent =
        (session.section === "order" &&
          currentState.preview !== null &&
          currentState.orderPreviewStaleReason === null &&
          currentState.pendingOrderChanges === 0) ||
        (session.section === "labor" &&
          currentState.labor.preview !== null &&
          currentState.labor.preview.baseRevision === currentState.labor.revision &&
          currentState.laborPreviewStaleReason === null);
      if (previewIsCurrent || session.adoptController !== controller) {
        return;
      }
      controller.abort();
      session.adoptController = null;
      updateStatus(session, {
        supported: true,
        toolCount: session.definitions.base.length,
        error: session.status.error,
      });
    }, 0);
  }
}

function createSession(
  store: ReviewStore,
  modelContext: WebMCP.ModelContext,
  environment: ToolEnvironment,
): RegistrationSession {
  const navigationTarget = { current: environment.navigate };
  const definitions = createToolDefinitions(store, {
    ...environment,
    navigate: (section) => navigationTarget.current(section),
  });
  const { navigationTool, routeTools } = splitBaseTools(definitions);
  const session: RegistrationSession = {
    store,
    section: environment.section,
    modelContext,
    definitions,
    routeController: new AbortController(),
    navigationController: new AbortController(),
    navigationTarget,
    adoptController: null,
    releaseStore: () => undefined,
    listeners: new Set(),
    references: 0,
    generation: 0,
    status: {
      supported: true,
      toolCount: definitions.base.length,
      error: null,
    },
  };
  sessions.set(modelContext, session);
  for (const tool of routeTools) {
    register(session, tool, session.routeController);
  }
  register(session, navigationTool, session.navigationController);
  session.releaseStore = store.subscribe(() => syncAdoptRegistration(session));
  syncAdoptRegistration(session);
  return session;
}

function transitionSession(
  session: RegistrationSession,
  environment: ToolEnvironment,
) {
  session.routeController.abort();
  session.adoptController?.abort();
  session.adoptController = null;
  session.releaseStore();

  session.navigationTarget.current = environment.navigate;
  session.section = environment.section;
  session.definitions = createToolDefinitions(session.store, {
    ...environment,
    navigate: (section) => session.navigationTarget.current(section),
  });
  session.routeController = new AbortController();
  const { routeTools } = splitBaseTools(session.definitions);
  updateStatus(session, {
    supported: true,
    toolCount: session.definitions.base.length,
    error: null,
  });
  for (const tool of routeTools) {
    register(session, tool, session.routeController);
  }
  session.releaseStore = session.store.subscribe(() =>
    syncAdoptRegistration(session),
  );
  syncAdoptRegistration(session);
}

function disposeSession(session: RegistrationSession) {
  session.routeController.abort();
  session.navigationController.abort();
  session.adoptController?.abort();
  session.adoptController = null;
  session.releaseStore();
  sessions.delete(session.modelContext);
}

export function mountWebMCPTools({
  store,
  modelContext = document.modelContext,
  onStatus,
  section = "order",
  navigate = () => undefined,
}: Readonly<{
  store: ReviewStore;
  modelContext?: WebMCP.ModelContext;
  onStatus?: (status: WebMCPStatus) => void;
  section?: Section;
  navigate?: (section: Section) => void;
}>): Readonly<{
  supported: boolean;
  toolCount: number;
  cleanup: () => void;
}> {
  if (!modelContext) {
    const status = { supported: false, toolCount: 0, error: null } as const;
    onStatus?.(status);
    return { ...status, cleanup: () => undefined };
  }

  let session = sessions.get(modelContext);
  if (session && session.store !== store) {
    disposeSession(session);
    session = undefined;
  }
  session ??= createSession(store, modelContext, { section, navigate });
  if (session.section !== section) {
    transitionSession(session, { section, navigate });
  } else {
    session.navigationTarget.current = navigate;
  }
  session.references += 1;
  session.generation += 1;
  if (onStatus) {
    session.listeners.add(onStatus);
    onStatus(session.status);
  }
  const mountGeneration = session.generation;
  let cleaned = false;

  return {
    supported: true,
    toolCount: session.status.toolCount,
    cleanup: () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      if (onStatus) {
        session?.listeners.delete(onStatus);
      }
      if (!session) {
        return;
      }
      session.references = Math.max(0, session.references - 1);
      const cleanupGeneration = session.generation;
      queueMicrotask(() => {
        if (
          session &&
          session.references === 0 &&
          session.generation === cleanupGeneration &&
          session.generation >= mountGeneration
        ) {
          disposeSession(session);
        }
      });
    },
  };
}
