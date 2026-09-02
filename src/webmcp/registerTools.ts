import { BASE_COVERS, SEED_EVENT_UPLIFTS, SEED_ITEMS } from "../data/seed";
import type { LocalSignal } from "../domain/types";
import type { ReviewStore } from "../store/reviewStore";
import toolCatalog from "./toolCatalog.json";

export const TOOL_NAMES = {
  GET_CONTEXT: "get_order_context",
  ADD_SIGNAL: "add_local_signal",
  PREVIEW: "create_order_preview",
  ADOPT: "adopt_order_preview",
  SAVE_RECEIPT: "save_handoff_receipt",
} as const;

export const TOOL_CATALOG = toolCatalog;
export const TOOL_SCHEMAS = {
  [TOOL_NAMES.GET_CONTEXT]: TOOL_CATALOG[TOOL_NAMES.GET_CONTEXT].inputSchema,
  [TOOL_NAMES.ADD_SIGNAL]: TOOL_CATALOG[TOOL_NAMES.ADD_SIGNAL].inputSchema,
  [TOOL_NAMES.PREVIEW]: TOOL_CATALOG[TOOL_NAMES.PREVIEW].inputSchema,
  [TOOL_NAMES.ADOPT]: TOOL_CATALOG[TOOL_NAMES.ADOPT].inputSchema,
  [TOOL_NAMES.SAVE_RECEIPT]: TOOL_CATALOG[TOOL_NAMES.SAVE_RECEIPT].inputSchema,
};

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
  const eventCovers = SEED_EVENT_UPLIFTS.reduce(
    (total, event) => total + event.covers,
    0,
  );
  return {
    guide:
      "Mutating tools need expectedRevision from this result or the last mutation. A preview never changes the saved plan. Ask the manager before adopting or saving.",
    store: state.store,
    serviceDate: state.serviceDate,
    cutoffAt: state.cutoffAt,
    deliveryAt: state.deliveryAt,
    forecast: {
      base: BASE_COVERS,
      eventCovers,
      saved: state.savedPlan.covers,
    },
    draft: {
      covers: state.draft.plan.covers,
      laborHours: state.draft.plan.laborHours,
      cost: state.draft.plan.totalCost,
    },
    lines: SEED_ITEMS.map((item) => {
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
      const output = contextOutput(store);
      store.recordReadActivity(
        TOOL_NAMES.GET_CONTEXT,
        "Read the live order context.",
        `Returned revision ${output.revision} with ${output.lines.length} lines.`,
      );
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
        revision: result.revision,
        confirmation:
          "Saved in this browser. Nothing was sent outside this page.",
      };
    }),
  };
}

export function createToolDefinitions(store: ReviewStore): Readonly<{
  base: readonly WebMCP.ModelContextTool[];
  adopt: WebMCP.ModelContextTool;
}> {
  return {
    base: [
      getContextTool(store),
      addSignalTool(store),
      previewTool(store),
      saveReceiptTool(store),
    ],
    adopt: adoptTool(store),
  };
}

export type WebMCPStatus = Readonly<{
  supported: boolean;
  toolCount: number;
  error: string | null;
}>;

type RegistrationSession = {
  store: ReviewStore;
  modelContext: WebMCP.ModelContext;
  definitions: ReturnType<typeof createToolDefinitions>;
  baseController: AbortController;
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

function syncAdoptRegistration(session: RegistrationSession) {
  const state = session.store.getState();
  const shouldRegister =
    state.preview !== null && state.preview.baseRevision === state.revision;

  if (shouldRegister && session.adoptController === null) {
    session.adoptController = new AbortController();
    register(session, session.definitions.adopt, session.adoptController);
    updateStatus(session, {
      supported: true,
      toolCount: 5,
      error: session.status.error,
    });
    return;
  }

  if (!shouldRegister && session.adoptController !== null) {
    const controller = session.adoptController;
    globalThis.setTimeout(() => {
      const currentState = session.store.getState();
      const previewIsCurrent =
        currentState.preview !== null &&
        currentState.preview.baseRevision === currentState.revision;
      if (previewIsCurrent || session.adoptController !== controller) {
        return;
      }
      controller.abort();
      session.adoptController = null;
      updateStatus(session, {
        supported: true,
        toolCount: 4,
        error: session.status.error,
      });
    }, 0);
  }
}

function createSession(
  store: ReviewStore,
  modelContext: WebMCP.ModelContext,
): RegistrationSession {
  const definitions = createToolDefinitions(store);
  const session: RegistrationSession = {
    store,
    modelContext,
    definitions,
    baseController: new AbortController(),
    adoptController: null,
    releaseStore: () => undefined,
    listeners: new Set(),
    references: 0,
    generation: 0,
    status: { supported: true, toolCount: 4, error: null },
  };
  sessions.set(modelContext, session);
  for (const tool of definitions.base) {
    register(session, tool, session.baseController);
  }
  session.releaseStore = store.subscribe(() => syncAdoptRegistration(session));
  syncAdoptRegistration(session);
  return session;
}

function disposeSession(session: RegistrationSession) {
  session.baseController.abort();
  session.adoptController?.abort();
  session.adoptController = null;
  session.releaseStore();
  sessions.delete(session.modelContext);
}

export function mountWebMCPTools({
  store,
  modelContext = document.modelContext,
  onStatus,
}: Readonly<{
  store: ReviewStore;
  modelContext?: WebMCP.ModelContext;
  onStatus?: (status: WebMCPStatus) => void;
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
  session ??= createSession(store, modelContext);
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
