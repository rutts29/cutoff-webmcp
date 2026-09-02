import { describe, expect, it, vi } from "vitest";

import { createReviewStore, type ReceiptStorage } from "../store/reviewStore";
import {
  createToolDefinitions,
  getToolNamesForSection,
  mountWebMCPTools,
  TOOL_NAMES,
  type WebMCPStatus,
} from "./registerTools";

function memoryStorage(): ReceiptStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function makeStore() {
  let id = 0;
  return createReviewStore({
    storage: memoryStorage(),
    now: () => "2026-09-02T12:00:00.000Z",
    createId: (prefix) => `${prefix}-${++id}`,
  });
}

type RegisteredCall = Readonly<{
  tool: WebMCP.ModelContextTool;
  options: WebMCP.ModelContextRegisterToolOptions | undefined;
}>;

function makeModelContext() {
  const calls: RegisteredCall[] = [];
  const registerTool = vi.fn(
    async (
      tool: WebMCP.ModelContextTool,
      options?: WebMCP.ModelContextRegisterToolOptions,
    ) => {
      calls.push({ tool, options });
    },
  );
  const context = {
    registerTool,
    getTools: vi.fn(async () => []),
    ontoolchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } satisfies WebMCP.ModelContext;
  return { context, calls, registerTool };
}

function makeAsynchronousRemovalModelContext() {
  const calls: RegisteredCall[] = [];
  const activeTools = new Map<string, WebMCP.ModelContextTool>();
  const registerTool = vi.fn(
    async (
      tool: WebMCP.ModelContextTool,
      options?: WebMCP.ModelContextRegisterToolOptions,
    ) => {
      calls.push({ tool, options });
      if (activeTools.has(tool.name)) {
        throw new Error(`Tool ${tool.name} is already registered`);
      }
      activeTools.set(tool.name, tool);
      options?.signal?.addEventListener(
        "abort",
        () => queueMicrotask(() => activeTools.delete(tool.name)),
        { once: true },
      );
    },
  );
  const context = {
    registerTool,
    getTools: vi.fn(async () =>
      [...activeTools.values()].map(
        (tool): WebMCP.RegisteredTool => ({
          name: tool.name,
          title: tool.title ?? tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          window,
          origin: window.location.origin,
          annotations: tool.annotations,
        }),
      ),
    ),
    ontoolchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } satisfies WebMCP.ModelContext;
  return { context, calls, activeTools, registerTool };
}

async function execute(
  tool: WebMCP.ModelContextTool,
  input: Record<string, unknown>,
) {
  return tool.execute(input, { signal: new AbortController().signal });
}

function findTool(
  tools: readonly WebMCP.ModelContextTool[],
  name: string,
): WebMCP.ModelContextTool {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Expected ${name}`);
  }
  return tool;
}

describe("WebMCP tool adapters", () => {
  it("publishes seven precise contracts with standard annotations", () => {
    const tools = createToolDefinitions(makeStore());

    expect(tools.base.map((tool) => tool.name)).toStrictEqual([
      "get_order_context",
      "get_line_detail",
      "add_local_signal",
      "create_order_preview",
      "save_handoff_receipt",
      "open_section",
    ]);
    expect(tools.adopt.name).toBe("adopt_order_preview");

    for (const tool of [...tools.base, tools.adopt]) {
      expect(tool.name.length).toBeLessThan(30);
      expect(tool.description.length).toBeLessThan(500);
      expect(tool.description).toMatch(/Returns /);
      expect(tool.description).not.toMatch(
        /\b(?:use|when|ask|asks|only|must|do not|don't|never)\b/i,
      );
      expect(tool.inputSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
      });

      const schema = tool.inputSchema as {
        properties?: Record<string, { description?: string }>;
      };
      for (const property of Object.values(schema.properties ?? {})) {
        expect(property.description?.length ?? 0).toBeGreaterThan(0);
        expect(property.description?.length ?? 0).toBeLessThan(150);
        expect(property.description).not.toMatch(
          /\b(?:use|when|ask|asks|do not|don't|never)\b/i,
        );
      }
    }

    expect(
      findTool(tools.base, TOOL_NAMES.GET_CONTEXT).annotations,
    ).toMatchObject({ readOnlyHint: true, untrustedContentHint: true });
    expect(
      findTool(tools.base, TOOL_NAMES.GET_LINE_DETAIL).annotations,
    ).toMatchObject({ readOnlyHint: true });
    expect(
      findTool(tools.base, TOOL_NAMES.OPEN_SECTION).annotations,
    ).toMatchObject({ readOnlyHint: false });
    expect(
      findTool(tools.base, TOOL_NAMES.ADD_SIGNAL).annotations,
    ).toMatchObject({ readOnlyHint: false, untrustedContentHint: true });
    const addSignalSchema = findTool(
      tools.base,
      TOOL_NAMES.ADD_SIGNAL,
    ).inputSchema as {
      properties: Record<string, { description?: string }>;
    };
    expect(
      findTool(tools.base, TOOL_NAMES.ADD_SIGNAL).description,
    ).toMatch(/revisioned local state/i);
    expect(
      findTool(tools.base, TOOL_NAMES.ADD_SIGNAL).description,
    ).toMatch(/without calculating or previewing/i);
    expect(addSignalSchema.properties.kind.description).toMatch(/operational facts/i);
    expect(addSignalSchema.properties.expectedRevision.description).toMatch(
      /get_order_context/i,
    );
    expect(
      findTool(tools.base, TOOL_NAMES.PREVIEW).annotations?.readOnlyHint,
    ).toBe(false);
    expect(
      findTool(tools.base, TOOL_NAMES.PREVIEW).description,
    ).toMatch(/saved order and adoption status remain unchanged/i);
    expect(
      findTool(tools.base, TOOL_NAMES.SAVE_RECEIPT).annotations?.readOnlyHint,
    ).toBe(false);
    expect(
      findTool(tools.base, TOOL_NAMES.SAVE_RECEIPT).annotations,
    ).toMatchObject({ untrustedContentHint: true });
    expect(findTool(tools.base, TOOL_NAMES.SAVE_RECEIPT).description).toMatch(
      /local browser receipt/i,
    );
    expect(tools.adopt.annotations?.readOnlyHint).toBe(false);
    expect(tools.adopt.description).toMatch(/active order preview/i);
    expect(tools.adopt.description).toMatch(
      /registered while a current preview is adoptable/i,
    );

    for (const tool of [
      findTool(tools.base, TOOL_NAMES.ADD_SIGNAL),
      findTool(tools.base, TOOL_NAMES.PREVIEW),
      findTool(tools.base, TOOL_NAMES.SAVE_RECEIPT),
      tools.adopt,
    ]) {
      const schema = tool.inputSchema as {
        required?: readonly string[];
        properties?: Record<string, Record<string, unknown>>;
      };
      expect(schema.required).toContain("expectedRevision");
      expect(Object.keys(schema.properties ?? {})[0]).toBe("expectedRevision");
      expect(schema.properties?.expectedRevision).toMatchObject({
        type: "integer",
        minimum: 0,
      });
      expect(schema.properties?.expectedRevision).not.toHaveProperty("default");
      expect(schema.properties?.expectedRevision).not.toHaveProperty("const");
      expect(schema.properties?.expectedRevision).not.toHaveProperty("examples");
    }
  });

  it("keeps every read-only tool free of visible state changes", async () => {
    const cases = [
      { section: "order" as const, name: TOOL_NAMES.GET_CONTEXT, input: {} },
      { section: "order" as const, name: TOOL_NAMES.GET_LINE_DETAIL, input: { skuId: "buns" } },
      { section: "stock" as const, name: TOOL_NAMES.GET_STOCK_STATUS, input: {} },
      { section: "labor" as const, name: TOOL_NAMES.GET_LABOR_PLAN, input: {} },
      { section: "log" as const, name: TOOL_NAMES.GET_SHIFT_LOG, input: {} },
    ];

    for (const testCase of cases) {
      const store = makeStore();
      const before = store.getState();
      const tool = findTool(
        createToolDefinitions(store, { section: testCase.section }).base,
        testCase.name,
      );
      await execute(tool, testCase.input);
      expect(store.getState()).toBe(before);
    }
  });

  it("returns exact calculated and pinned line detail", async () => {
    const store = makeStore();
    store.pinLineQuantity("buns", 13, 0, "page");
    const tool = findTool(
      createToolDefinitions(store).base,
      TOOL_NAMES.GET_LINE_DETAIL,
    );

    await expect(execute(tool, { skuId: "buns" })).resolves.toMatchObject({
      item: "Brioche buns",
      unit: "ea",
      caseSize: 48,
      usagePerCover: 0.62,
      onHand: 180,
      expiring: 24,
      usable: 156,
      inTransit: 96,
      safety: 0.05,
      safetyRationale: "Running out costs more margin than the waste.",
      demand: 706.8,
      need: 490.14,
      calculatedCases: 11,
      pinnedCases: 13,
      currentReason: "UNCHANGED",
      expiringShare: expect.closeTo(24 / 180),
    });
  });

  it("moves the shared page with open_section and returns the next tool set", async () => {
    const store = makeStore();
    const navigate = vi.fn();
    const tool = findTool(
      createToolDefinitions(store, { section: "order", navigate }).base,
      TOOL_NAMES.OPEN_SECTION,
    );

    const result = execute(tool, { section: "stock" });
    expect(navigate).toHaveBeenCalledWith("stock");
    await expect(result).resolves.toStrictEqual({
      section: "stock",
      toolNames: [
        "get_stock_status",
        "record_stock_count",
        "log_waste",
        "open_section",
      ],
      revision: 0,
    });
  });

  it("registers the four Stock tools and returns the locked stock mutations", async () => {
    const store = makeStore();
    const tools = createToolDefinitions(store, { section: "stock" }).base;

    expect(tools.map((tool) => tool.name)).toStrictEqual([
      TOOL_NAMES.GET_STOCK_STATUS,
      TOOL_NAMES.RECORD_STOCK_COUNT,
      TOOL_NAMES.LOG_WASTE,
      TOOL_NAMES.OPEN_SECTION,
    ]);
    expect(findTool(tools, TOOL_NAMES.GET_STOCK_STATUS).annotations).toMatchObject({
      readOnlyHint: true,
      untrustedContentHint: true,
    });
    expect(findTool(tools, TOOL_NAMES.LOG_WASTE).annotations).toMatchObject({
      readOnlyHint: false,
      untrustedContentHint: true,
    });

    const status = await execute(findTool(tools, TOOL_NAMES.GET_STOCK_STATUS), {});
    expect(status).toMatchObject({
      totals: {
        wasteWeekCost: 74.97,
        byReason: {
          expired: 44.6,
          overproduction: 15.6,
          prep: 13.6,
          dropped: 1.17,
        },
        topReason: "expired",
      },
      orderPreviewStale: false,
      revision: 0,
    });
    expect(JSON.stringify(status).length).toBeLessThanOrEqual(3_000);

    const count = await execute(findTool(tools, TOOL_NAMES.RECORD_STOCK_COUNT), {
      expectedRevision: 0,
      skuId: "chicken",
      onHand: 30,
      expiring: 6,
    });
    expect(count).toMatchObject({
      skuId: "chicken",
      previous: { onHand: 42, expiring: 6 },
      current: { onHand: 30, expiring: 6 },
      revision: 1,
      orderPreviewInvalidated: false,
    });

    const waste = await execute(findTool(tools, TOOL_NAMES.LOG_WASTE), {
      expectedRevision: 1,
      skuId: "lettuce",
      quantity: 2,
      reason: "expired",
      note: "Walk-in trim found at close.",
    });
    expect(waste).toMatchObject({
      cost: 2.33,
      newOnHand: 7,
      newExpiring: 2,
      weekTotal: 77.3,
      revision: 2,
      orderPreviewInvalidated: false,
    });
  });

  it("registers the Labor tools and returns the locked forecast-down preview", async () => {
    const store = makeStore();
    store.addLocalSignal(
      { kind: "booking", label: "Private booking", covers: 80 },
      store.getState().revision,
      "page",
    );
    store.addLocalSignal(
      { kind: "event_cancelled", label: "Derby cancelled" },
      store.getState().revision,
      "page",
    );
    const lowerPreview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    if (!lowerPreview.ok) {
      throw new Error("Expected the lower-cover preview");
    }
    store.adoptOrderDraft(
      lowerPreview.preview.id,
      store.getState().revision,
      undefined,
      "page",
    );

    const definitions = createToolDefinitions(store, { section: "labor" });
    expect(definitions.base.map((tool) => tool.name)).toStrictEqual([
      TOOL_NAMES.GET_LABOR_PLAN,
      TOOL_NAMES.ADD_LABOR_SIGNAL,
      TOOL_NAMES.CREATE_LABOR_PREVIEW,
      TOOL_NAMES.OPEN_SECTION,
    ]);
    expect(definitions.adopt.name).toBe(TOOL_NAMES.ADOPT_LABOR_PLAN);

    const labor = await execute(
      findTool(definitions.base, TOOL_NAMES.GET_LABOR_PLAN),
      {},
    );
    expect(labor).toMatchObject({
      forecastCovers: 910,
      requiredTotal: 76,
      laborPreviewId: null,
      revision: store.getState().revision,
    });
    expect(
      findTool(definitions.base, TOOL_NAMES.GET_LABOR_PLAN).annotations,
    ).toMatchObject({
      readOnlyHint: true,
      untrustedContentHint: true,
    });

    const absence = await execute(
      findTool(definitions.base, TOOL_NAMES.ADD_LABOR_SIGNAL),
      {
        expectedRevision: store.getState().revision,
        kind: "absence",
        staffId: "s11",
        note: "Cannot make close.",
      },
    );
    expect(absence).toMatchObject({
      kind: "absence",
      staffId: "s11",
      revision: store.getState().revision,
      laborPreviewInvalidated: false,
    });

    const preview = await execute(
      findTool(definitions.base, TOOL_NAMES.CREATE_LABOR_PREVIEW),
      { expectedRevision: store.getState().revision },
    );
    expect(preview).toMatchObject({
      revision: store.getState().revision,
      totals: {
        scheduledBefore: 88,
        scheduledAfter: 80,
        required: 76,
        releases: 2,
        covers: 1,
      },
      dayparts: expect.arrayContaining([
        expect.objectContaining({
          id: "prep",
          scheduledBefore: 7,
          scheduledAfter: 11,
          reason: "UNDER_SCHEDULED_ABSENCE",
          actions: [
            {
              type: "cover",
              staffId: "oc1",
              name: "Nadia Haddad",
              hours: 4,
            },
          ],
        }),
      ]),
    });

    const activePreview = store.getState().labor.preview;
    if (!activePreview) {
      throw new Error("Expected a current labor preview");
    }
    await expect(
      execute(definitions.adopt, {
        expectedRevision: store.getState().revision,
        previewId: activePreview.id,
      }),
    ).resolves.toMatchObject({
      scheduledTotal: 80,
      undoAvailable: true,
      noExternalAction: "Nothing was sent outside this page.",
    });
  });

  it("registers the three Shift log tools and echoes a revisioned note", async () => {
    const store = makeStore();
    const tools = createToolDefinitions(store, { section: "log" }).base;

    expect(tools.map((tool) => tool.name)).toStrictEqual([
      TOOL_NAMES.GET_SHIFT_LOG,
      TOOL_NAMES.ADD_SHIFT_NOTE,
      TOOL_NAMES.OPEN_SECTION,
    ]);
    expect(findTool(tools, TOOL_NAMES.GET_SHIFT_LOG).annotations).toMatchObject({
      readOnlyHint: true,
      untrustedContentHint: true,
    });
    expect(findTool(tools, TOOL_NAMES.ADD_SHIFT_NOTE).annotations).toMatchObject({
      readOnlyHint: false,
      untrustedContentHint: true,
    });

    await expect(
      execute(findTool(tools, TOOL_NAMES.GET_SHIFT_LOG), { limit: 10 }),
    ).resolves.toMatchObject({
      presetId: "saturday",
      serviceDate: "2026-09-05",
      entries: [],
      total: 0,
      revision: 0,
    });
    const note = await execute(findTool(tools, TOOL_NAMES.ADD_SHIFT_NOTE), {
      expectedRevision: 0,
      text: "Check the walk-in before lunch.",
      section: "stock",
    });
    expect(note).toMatchObject({ revision: 1 });
    await expect(
      execute(findTool(tools, TOOL_NAMES.GET_SHIFT_LOG), {
        section: "stock",
        limit: 10,
      }),
    ).resolves.toMatchObject({
      presetId: "saturday",
      entries: [
        expect.objectContaining({
          section: "stock",
          actor: "tool",
          tool: "add_shift_note",
          summary: expect.stringContaining("Check the walk-in before lunch."),
        }),
      ],
      total: 1,
      revision: 1,
    });
  });

  it("keeps the full order context under the hard output budget", async () => {
    const store = makeStore();
    store.addLocalSignal(
      {
        kind: "booking",
        label: "Private booking, 80 guests, 18:30",
        covers: 80,
      },
      0,
      "page",
    );
    store.addLocalSignal(
      { kind: "event_cancelled", label: "Derby match cancelled" },
      1,
      "tool",
      TOOL_NAMES.ADD_SIGNAL,
    );
    store.previewOrderPlan(
      "Replan after the match cancellation.",
      2,
      "tool",
      TOOL_NAMES.PREVIEW,
    );
    const tool = findTool(
      createToolDefinitions(store).base,
      TOOL_NAMES.GET_CONTEXT,
    );
    const output = await execute(tool, {});

    expect(JSON.stringify(output).length).toBeLessThanOrEqual(3_000);
    expect(output).toMatchObject({
      guide: expect.stringContaining("Mutating tools need expectedRevision"),
      presetId: "saturday",
      store: "Northgate",
      forecast: { base: 830, eventCovers: 310, saved: 1_140 },
      draft: { covers: 1_140, laborHours: 95, cost: 3_629 },
      previewId: "preview-5",
      revision: 3,
    });
    expect((output as { guide: string }).guide.length).toBeLessThan(300);
  });

  it("reports the active Tuesday preset through the order context", async () => {
    const store = makeStore();
    store.switchPreset("tuesday", "page");
    const output = await execute(
      findTool(createToolDefinitions(store).base, TOOL_NAMES.GET_CONTEXT),
      {},
    );

    expect(output).toMatchObject({
      presetId: "tuesday",
      serviceDate: "2026-09-08",
      forecast: { base: 520, eventCovers: 0, saved: 520 },
      draft: { covers: 520, laborHours: 44, cost: 1_281 },
      revision: 0,
    });
  });

  it("validates unknown input and returns actionable errors", async () => {
    const tool = findTool(
      createToolDefinitions(makeStore()).base,
      TOOL_NAMES.ADD_SIGNAL,
    );

    await expect(
      execute(tool, {
        kind: "booking",
        label: "Private booking",
        expectedRevision: 0,
        extra: "not allowed",
      }),
    ).resolves.toMatchObject({
      error: "invalid_input",
      issues: expect.arrayContaining([
        "Remove unsupported property: extra.",
        "Booking signals require a positive whole-number covers value.",
      ]),
      hint: "Correct the listed fields and retry this tool.",
    });
  });

  it("returns stale revision errors from the shared store", async () => {
    const store = makeStore();
    store.addLocalSignal(
      { kind: "operator_note", label: "Check the walk-in count." },
      0,
      "page",
    );
    const tool = findTool(
      createToolDefinitions(store).base,
      TOOL_NAMES.PREVIEW,
    );

    await expect(execute(tool, { expectedRevision: 0 })).resolves.toStrictEqual({
      error: "stale_revision",
      currentRevision: 1,
      hint: "Read get_order_context and retry with the current revision.",
    });
  });

  it("adds signals, previews the locked result, and adopts without external action", async () => {
    const store = makeStore();
    const definitions = createToolDefinitions(store);
    const add = findTool(definitions.base, TOOL_NAMES.ADD_SIGNAL);
    const preview = findTool(definitions.base, TOOL_NAMES.PREVIEW);

    await expect(
      execute(add, {
        kind: "booking",
        label: "Private booking, 80 guests, 18:30",
        covers: 80,
        expectedRevision: 0,
      }),
    ).resolves.toMatchObject({
      kind: "booking",
      label: "Private booking, 80 guests, 18:30",
      revision: 1,
      previewBecameStale: false,
    });
    await expect(
      execute(add, {
        kind: "event_cancelled",
        label: "Derby match cancelled",
        expectedRevision: 1,
      }),
    ).resolves.toMatchObject({
      kind: "event_cancelled",
      label: "Derby match cancelled",
      revision: 2,
      previewBecameStale: false,
    });
    const previewOutput = await execute(preview, { expectedRevision: 2 });
    expect(previewOutput).toMatchObject({
      revision: 3,
      covers: { before: 1_140, after: 910 },
      laborHours: { before: 95, after: 76 },
      cost: { before: 3_629, after: 2_767 },
    });

    const activePreview = store.getState().preview;
    expect(activePreview).not.toBeNull();
    await expect(
      execute(definitions.adopt, {
        previewId: activePreview?.id,
        expectedRevision: 3,
      }),
    ).resolves.toMatchObject({
      revision: 4,
      adopted: { covers: 910, laborHours: 76, cost: 2_767 },
      undoAvailable: true,
      noExternalAction: "Nothing was sent to any supplier.",
    });
  });

  it("returns a structured aborted result before changing state", async () => {
    const store = makeStore();
    const tool = findTool(
      createToolDefinitions(store).base,
      TOOL_NAMES.PREVIEW,
    );
    const controller = new AbortController();
    controller.abort();

    await expect(
      tool.execute(
        { expectedRevision: 0 },
        { signal: controller.signal },
      ),
    ).resolves.toStrictEqual({
      error: "execution_aborted",
      hint: "The caller cancelled this tool. Read the current context before retrying.",
    });
    expect(store.getState().revision).toBe(0);
  });

  it("runs when a caller omits the execution options object", async () => {
    const store = makeStore();
    const tool = findTool(
      createToolDefinitions(store).base,
      TOOL_NAMES.PREVIEW,
    );

    const output = await Reflect.apply(tool.execute, undefined, [
      { expectedRevision: 0 },
    ]);

    expect(output).toMatchObject({
      revision: 1,
      covers: { before: 1_140, after: 1_140 },
    });
  });

  it("runs when a caller supplies execution options without a signal", async () => {
    const store = makeStore();
    const tool = findTool(
      createToolDefinitions(store).base,
      TOOL_NAMES.GET_CONTEXT,
    );

    const output = await Reflect.apply(tool.execute, undefined, [{}, {}]);

    expect(output).toMatchObject({
      store: "Northgate",
      revision: 0,
    });
  });
});

describe("WebMCP registration lifecycle", () => {
  it("is a no-op when document.modelContext is unavailable", () => {
    const status = vi.fn();
    const mount = mountWebMCPTools({
      store: makeStore(),
      modelContext: undefined,
      onStatus: status,
    });

    expect(mount.supported).toBe(false);
    expect(mount.toolCount).toBe(0);
    expect(status).toHaveBeenCalledWith({
      supported: false,
      toolCount: 0,
      error: null,
    });
    expect(() => mount.cleanup()).not.toThrow();
  });

  it("registers six order tools exactly once across a StrictMode remount", async () => {
    const { context, calls, registerTool } = makeModelContext();
    const store = makeStore();
    const first = mountWebMCPTools({ store, modelContext: context });
    first.cleanup();
    const second = mountWebMCPTools({ store, modelContext: context });
    await Promise.resolve();

    expect(registerTool).toHaveBeenCalledTimes(6);
    expect(calls.map(({ tool }) => tool.name)).toStrictEqual([
      TOOL_NAMES.GET_CONTEXT,
      TOOL_NAMES.GET_LINE_DETAIL,
      TOOL_NAMES.ADD_SIGNAL,
      TOOL_NAMES.PREVIEW,
      TOOL_NAMES.SAVE_RECEIPT,
      TOOL_NAMES.OPEN_SECTION,
    ]);
    expect(
      calls.every(({ options }) => options?.signal instanceof AbortSignal),
    ).toBe(true);

    second.cleanup();
    await Promise.resolve();
    expect(calls.every(({ options }) => options?.signal?.aborted)).toBe(true);
  });

  it("aborts the old route and registers exactly the next route tools", async () => {
    const { context, calls } = makeModelContext();
    const store = makeStore();
    const order = mountWebMCPTools({
      store,
      modelContext: context,
      section: "order",
    });
    await Promise.resolve();
    const orderCalls = [...calls];

    order.cleanup();
    const stock = mountWebMCPTools({
      store,
      modelContext: context,
      section: "stock",
    });
    await Promise.resolve();

    expect(
      orderCalls
        .filter(({ tool }) => tool.name !== TOOL_NAMES.OPEN_SECTION)
        .every(({ options }) => options?.signal?.aborted),
    ).toBe(true);
    expect(
      orderCalls.find(({ tool }) => tool.name === TOOL_NAMES.OPEN_SECTION)
        ?.options?.signal?.aborted,
    ).toBe(false);
    expect(calls.slice(orderCalls.length).map(({ tool }) => tool.name)).toStrictEqual([
      TOOL_NAMES.GET_STOCK_STATUS,
      TOOL_NAMES.RECORD_STOCK_COUNT,
      TOOL_NAMES.LOG_WASTE,
    ]);
    expect(getToolNamesForSection("stock", store)).toStrictEqual([
      TOOL_NAMES.GET_STOCK_STATUS,
      TOOL_NAMES.RECORD_STOCK_COUNT,
      TOOL_NAMES.LOG_WASTE,
      TOOL_NAMES.OPEN_SECTION,
    ]);
    stock.cleanup();
    await Promise.resolve();
  });

  it("keeps the shared navigation tool registered across route transitions", async () => {
    const { context, calls, activeTools } =
      makeAsynchronousRemovalModelContext();
    const store = makeStore();
    const statuses: WebMCPStatus[] = [];

    let mount = mountWebMCPTools({
      store,
      modelContext: context,
      section: "order",
      onStatus: (status) => statuses.push(status),
    });
    await Promise.resolve();

    for (const section of ["stock", "log", "order"] as const) {
      mount.cleanup();
      mount = mountWebMCPTools({
        store,
        modelContext: context,
        section,
        onStatus: (status) => statuses.push(status),
      });
      await Promise.resolve();
      await Promise.resolve();
    }

    expect(
      calls.filter(({ tool }) => tool.name === TOOL_NAMES.OPEN_SECTION),
    ).toHaveLength(1);
    expect(statuses.every(({ error }) => error === null)).toBe(true);
    expect([...activeTools.keys()].sort()).toStrictEqual(
      [...getToolNamesForSection("order", store)].sort(),
    );

    mount.cleanup();
    await Promise.resolve();
    await Promise.resolve();
    expect(activeTools.size).toBe(0);
  });

  it("registers labor adoption only for a current labor preview", async () => {
    vi.useFakeTimers();
    const { context, calls, registerTool } = makeModelContext();
    const store = makeStore();
    const mount = mountWebMCPTools({
      store,
      modelContext: context,
      section: "labor",
    });
    await Promise.resolve();
    expect(registerTool).toHaveBeenCalledTimes(4);
    expect(calls.map(({ tool }) => tool.name)).toStrictEqual([
      TOOL_NAMES.GET_LABOR_PLAN,
      TOOL_NAMES.ADD_LABOR_SIGNAL,
      TOOL_NAMES.CREATE_LABOR_PREVIEW,
      TOOL_NAMES.OPEN_SECTION,
    ]);

    const preview = store.previewLaborPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expect(preview.ok).toBe(true);
    await Promise.resolve();
    expect(registerTool).toHaveBeenCalledTimes(5);
    expect(calls.at(-1)?.tool.name).toBe(TOOL_NAMES.ADOPT_LABOR_PLAN);
    const adoptCall = calls.at(-1);
    expect(getToolNamesForSection("labor", store)).toContain(
      TOOL_NAMES.ADOPT_LABOR_PLAN,
    );

    store.recordStockCount(
      "chicken",
      30,
      6,
      store.getState().revision,
      "page",
    );
    await vi.runAllTimersAsync();
    expect(adoptCall?.options?.signal?.aborted).toBe(false);

    store.addLaborSignal(
      { kind: "absence", staffId: "s11" },
      store.getState().revision,
      "page",
    );
    await vi.runAllTimersAsync();
    expect(adoptCall?.options?.signal?.aborted).toBe(true);
    expect(getToolNamesForSection("labor", store)).not.toContain(
      TOOL_NAMES.ADOPT_LABOR_PLAN,
    );

    mount.cleanup();
    vi.useRealTimers();
  });

  it("returns the adopt result before unregistering the dynamic tool", async () => {
    vi.useFakeTimers();
    const { context, calls, registerTool } = makeModelContext();
    const store = makeStore();
    const mount = mountWebMCPTools({ store, modelContext: context });
    await Promise.resolve();
    expect(registerTool).toHaveBeenCalledTimes(6);

    const preview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "page",
    );
    expect(preview.ok).toBe(true);
    await Promise.resolve();
    expect(registerTool).toHaveBeenCalledTimes(7);
    const adoptCall = calls.find(
      ({ tool }) => tool.name === TOOL_NAMES.ADOPT,
    );
    expect(adoptCall?.options?.signal?.aborted).toBe(false);

    const previewId = store.getState().preview?.id;
    if (!previewId) {
      throw new Error("Expected an active preview");
    }
    const resultPromise = execute(adoptCall!.tool, {
      previewId,
      expectedRevision: store.getState().revision,
    });
    expect(adoptCall?.options?.signal?.aborted).toBe(false);
    const result = await resultPromise;
    expect(result).toMatchObject({ undoAvailable: true });
    expect(adoptCall?.options?.signal?.aborted).toBe(false);

    await vi.runAllTimersAsync();
    expect(adoptCall?.options?.signal?.aborted).toBe(true);

    mount.cleanup();
    await Promise.resolve();
    vi.useRealTimers();
  });
});
