import { describe, expect, it, vi } from "vitest";

import { createReviewStore, type ReceiptStorage } from "../store/reviewStore";
import {
  createToolDefinitions,
  mountWebMCPTools,
  TOOL_NAMES,
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
  it("publishes the locked names, narrow schemas, and required annotations", () => {
    const tools = createToolDefinitions(makeStore());

    expect(tools.base.map((tool) => tool.name)).toStrictEqual([
      TOOL_NAMES.GET_CONTEXT,
      TOOL_NAMES.ADD_SIGNAL,
      TOOL_NAMES.PREVIEW,
      TOOL_NAMES.SAVE_RECEIPT,
    ]);
    expect(tools.adopt.name).toBe(TOOL_NAMES.ADOPT);

    for (const tool of [...tools.base, tools.adopt]) {
      expect(tool.name.length).toBeLessThan(30);
      expect(tool.description.length).toBeLessThan(500);
      expect(tool.description).not.toMatch(/\b(?:do not|don't|never)\b/i);
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
      }
    }

    expect(
      findTool(tools.base, TOOL_NAMES.GET_CONTEXT).annotations,
    ).toMatchObject({ readOnlyHint: true, untrustedContentHint: true });
    expect(
      findTool(tools.base, TOOL_NAMES.ADD_SIGNAL).annotations,
    ).toBeUndefined();
    expect(
      findTool(tools.base, TOOL_NAMES.PREVIEW).annotations?.readOnlyHint,
    ).not.toBe(true);
    expect(
      findTool(tools.base, TOOL_NAMES.SAVE_RECEIPT).annotations?.readOnlyHint,
    ).not.toBe(true);
    expect(tools.adopt.annotations?.readOnlyHint).not.toBe(true);
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
      "human",
    );
    store.addLocalSignal(
      { kind: "event_cancelled", label: "Derby match cancelled" },
      1,
      "agent",
      TOOL_NAMES.ADD_SIGNAL,
    );
    store.previewOrderPlan(
      "Replan after the match cancellation.",
      2,
      "agent",
      TOOL_NAMES.PREVIEW,
    );
    const tool = findTool(
      createToolDefinitions(store).base,
      TOOL_NAMES.GET_CONTEXT,
    );
    const output = await execute(tool, {});

    expect(JSON.stringify(output).length).toBeLessThanOrEqual(3_000);
    expect(output).toMatchObject({
      store: "Northgate",
      forecast: { base: 830, eventCovers: 310, saved: 1_140 },
      draft: { covers: 1_140, laborHours: 95, cost: 3_629 },
      previewId: "preview-5",
      revision: 3,
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
      "human",
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
    ).resolves.toMatchObject({ revision: 1, previewBecameStale: false });
    await expect(
      execute(add, {
        kind: "event_cancelled",
        label: "Derby match cancelled",
        expectedRevision: 1,
      }),
    ).resolves.toMatchObject({ revision: 2, previewBecameStale: false });
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

  it("registers four base tools exactly once across a StrictMode remount", async () => {
    const { context, calls, registerTool } = makeModelContext();
    const store = makeStore();
    const first = mountWebMCPTools({ store, modelContext: context });
    first.cleanup();
    const second = mountWebMCPTools({ store, modelContext: context });
    await Promise.resolve();

    expect(registerTool).toHaveBeenCalledTimes(4);
    expect(calls.map(({ tool }) => tool.name)).toStrictEqual([
      TOOL_NAMES.GET_CONTEXT,
      TOOL_NAMES.ADD_SIGNAL,
      TOOL_NAMES.PREVIEW,
      TOOL_NAMES.SAVE_RECEIPT,
    ]);
    expect(
      calls.every(({ options }) => options?.signal instanceof AbortSignal),
    ).toBe(true);

    second.cleanup();
    await Promise.resolve();
    expect(calls.every(({ options }) => options?.signal?.aborted)).toBe(true);
  });

  it("returns the adopt result before unregistering the dynamic tool", async () => {
    vi.useFakeTimers();
    const { context, calls, registerTool } = makeModelContext();
    const store = makeStore();
    const mount = mountWebMCPTools({ store, modelContext: context });
    await Promise.resolve();
    expect(registerTool).toHaveBeenCalledTimes(4);

    const preview = store.previewOrderPlan(
      undefined,
      store.getState().revision,
      "human",
    );
    expect(preview.ok).toBe(true);
    await Promise.resolve();
    expect(registerTool).toHaveBeenCalledTimes(5);
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
