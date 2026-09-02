import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { RouteView } from "./RouteView";
import { createReviewStore, type ReceiptStorage } from "./store/reviewStore";
import trajectory from "../docs/trajectory.json";

function memoryStorage(): ReceiptStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function makeStore(storage = memoryStorage()) {
  let id = 0;
  return createReviewStore({
    storage,
    now: () => "2026-09-02T12:00:00.000Z",
    createId: (prefix) => `${prefix}-${++id}`,
  });
}

async function addLockedSignals(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText("Signal label"),
    "Private booking, 80 guests, 18:30",
  );
  await user.clear(screen.getByLabelText("Booking covers"));
  await user.type(screen.getByLabelText("Booking covers"), "80");
  await user.click(screen.getByRole("button", { name: "Add signal" }));
  await user.selectOptions(
    screen.getByLabelText("Signal type"),
    "event_cancelled",
  );
  await user.clear(screen.getByLabelText("Signal label"));
  await user.type(
    screen.getByLabelText("Signal label"),
    "Derby match cancelled",
  );
  await user.click(screen.getByRole("button", { name: "Add signal" }));
}

afterEach(cleanup);
afterEach(() => vi.unstubAllGlobals());

describe("order review UI", () => {
  it("shows the agent-tool count only when WebMCP is available", async () => {
    const context = {
      registerTool: vi.fn(async () => undefined),
      getTools: vi.fn(async () => []),
      ontoolchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    } satisfies WebMCP.ModelContext;

    const supportedView = render(<App store={makeStore()} modelContext={context} />);
    expect(
      await screen.findByText("4 agent tools available on this page"),
    ).toBeVisible();

    supportedView.unmount();
    render(<App store={makeStore()} modelContext={undefined} />);
    expect(
      screen.queryByText(/agent tools available on this page/i),
    ).not.toBeInTheDocument();
  });

  it("keeps the seeded saved quantities intact before any action", () => {
    const store = makeStore();
    render(<App store={store} modelContext={undefined} />);

    expect(store.getState().savedPlan.covers).toBe(1_140);
    expect(store.getState().savedPlan.totalCost).toBe(3_629);
    expect(store.getState().savedPlan.lines).toHaveLength(10);
  });

  it("pins a manual booking, records a cancellation, and previews the diff", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<App store={store} modelContext={undefined} />);

    await addLockedSignals(user);
    await user.click(screen.getByRole("button", { name: "Preview replan" }));

    const state = store.getState();
    expect(state.pins.bookingIds).toHaveLength(1);
    expect(state.preview?.covers).toMatchObject({ before: 1_140, after: 910 });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Preview ready: 910 covers, 76 labor hours, 2,767 units.",
    );
    expect(state.preview?.lines.find((line) => line.skuId === "chicken")).toMatchObject({
      beforeCases: 19,
      afterCases: 15,
      delta: -4,
    });
  });

  it("shows an inline error when a signal label is empty", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<App store={store} modelContext={undefined} />);

    await user.click(screen.getByRole("button", { name: "Add signal" }));

    expect(screen.getByText("Give the signal a label")).toBeVisible();
    expect(screen.getByLabelText("Signal label")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(store.getState().signals).toStrictEqual([]);

    await user.type(screen.getByLabelText("Signal label"), "Private booking");
    expect(screen.queryByText("Give the signal a label")).not.toBeInTheDocument();
  });

  it("removes a pinned booking from the pins panel", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<App store={store} modelContext={undefined} />);

    await user.type(
      screen.getByLabelText("Signal label"),
      "Private booking, 80 guests, 18:30",
    );
    await user.click(screen.getByRole("button", { name: "Add signal" }));
    expect(store.getState().pins.bookingIds).toHaveLength(1);

    await user.click(
      screen.getByRole("button", { name: /Remove booking pin/ }),
    );

    expect(store.getState().pins.bookingIds).toStrictEqual([]);
  });

  it("focuses a row with the keyboard and pins its quantity", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<App store={store} modelContext={undefined} />);

    screen.getByRole("button", { name: /Chicken thighs/ }).focus();
    await user.keyboard("{Enter}");
    expect(store.getState().focusedSkuId).toBe("chicken");

    await user.clear(screen.getByLabelText("Chicken thighs quantity pin"));
    await user.type(screen.getByLabelText("Chicken thighs quantity pin"), "17");
    await user.click(screen.getByRole("button", { name: "Pin quantity" }));
    expect(store.getState().pins.lineOverrides.chicken).toBe(17);
  });

  it("adopts a preview and restores the prior draft with undo", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<App store={store} modelContext={undefined} />);

    await addLockedSignals(user);
    await user.click(screen.getByRole("button", { name: "Preview replan" }));
    await user.click(screen.getByRole("button", { name: "Adopt order plan" }));
    expect(store.getState().draft.plan.covers).toBe(910);
    expect(store.getState().draft.plan.totalCost).toBe(2_767);
    expect(store.getState().undoAvailable).toBe(true);

    await user.click(screen.getByRole("button", { name: "Undo adoption" }));
    expect(store.getState().draft.plan.covers).toBe(1_140);
    expect(store.getState().undoAvailable).toBe(false);
  });

  it("shows a saved receipt with the manager summary and JSON", () => {
    const store = makeStore();
    store.saveHandoffReceipt(
      "Morning manager: check the revised draft before cutoff.",
      store.getState().revision,
      "human",
    );
    render(<App store={store} modelContext={undefined} />);

    expect(
      screen.getByRole("region", { name: "Saved handoff receipt" }),
    ).toBeVisible();
    expect(
      screen.getByText("Morning manager: check the revised draft before cutoff."),
    ).toBeVisible();
    expect(screen.getByLabelText("Receipt JSON").textContent).toContain(
      '"externalAction": false',
    );
  });

  it("saves a handoff receipt from the visible controls", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<App store={store} modelContext={undefined} />);

    await user.type(
      screen.getByLabelText("Handoff summary"),
      "Morning manager: check the revised draft before cutoff.",
    );
    await user.click(
      screen.getByRole("button", { name: "Save handoff receipt" }),
    );

    expect(store.getState().lastReceipt?.managerSummary).toBe(
      "Morning manager: check the revised draft before cutoff.",
    );
    const activity = store.getState().activity.at(-1);
    expect(activity).toMatchObject({
      actor: "human",
      effect: "save",
    });
    expect(activity).not.toHaveProperty("tool");
    expect(screen.getByText("page action")).toBeVisible();
    expect(screen.queryByText("human")).not.toBeInTheDocument();
    expect(screen.queryByText("agent")).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Saved handoff receipt" }),
    ).toBeVisible();
  });

  it("shows direct WebMCP calls by tool name without guessing who drove the browser", () => {
    const store = makeStore();
    store.recordReadActivity(
      "get_order_context",
      "Read the live order context.",
      "Returned revision 0 with 10 lines.",
    );

    render(<App store={store} modelContext={undefined} />);

    expect(screen.getByText("get_order_context")).toBeVisible();
    expect(screen.getByText("Read the live order context.")).toBeVisible();
    expect(screen.getByText("Returned revision 0 with 10 lines.")).toBeVisible();
    expect(screen.queryByText("agent")).not.toBeInTheDocument();
  });

  it("copies receipt JSON and starts a JSON download", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.saveHandoffReceipt(
      "Check the draft before cutoff.",
      store.getState().revision,
      "human",
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    const createObjectURL = vi.fn(() => "blob:receipt");
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    render(<App store={store} modelContext={undefined} />);

    await user.click(screen.getByRole("button", { name: "Copy JSON" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('"managerSummary": "Check the draft before cutoff."'),
    );

    await user.click(screen.getByRole("button", { name: "Download JSON" }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:receipt");
    click.mockRestore();
  });

  it("restores a saved receipt through the store on reload", () => {
    const storage = memoryStorage();
    const firstStore = makeStore(storage);
    firstStore.saveHandoffReceipt(
      "Morning manager: check the revised draft before cutoff.",
      firstStore.getState().revision,
      "human",
    );
    const reloadedStore = makeStore(storage);
    render(<App store={reloadedStore} modelContext={undefined} />);

    expect(reloadedStore.getState().lastReceipt?.managerSummary).toBe(
      "Morning manager: check the revised draft before cutoff.",
    );
    expect(screen.getByRole("region", { name: "Saved handoff receipt" })).toBeVisible();
  });

  it("links the build record and copies the demo prompt", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<App store={makeStore()} modelContext={undefined} />);

    expect(screen.getByRole("link", { name: "How this was built" })).toHaveAttribute(
      "href",
      "/trajectory",
    );
    expect(screen.getByRole("link", { name: "How the numbers work" })).toHaveAttribute(
      "href",
      "#numbers",
    );
    await user.click(screen.getByRole("button", { name: "Copy demo prompt" }));

    expect(writeText).toHaveBeenCalledWith(
      "The derby has been cancelled. Add that to the order review and replan, but keep my booking.",
    );
    expect(screen.getByText("Demo prompt copied.")).toBeVisible();
  });

  it("renders the project trajectory at the trajectory route", () => {
    window.history.pushState({}, "", "/trajectory");
    render(<RouteView />);

    expect(screen.getByRole("heading", { name: trajectory.title })).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(trajectory.entries.length);
    window.history.pushState({}, "", "/");
  });
});
