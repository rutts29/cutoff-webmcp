import { act, cleanup, render, screen, within } from "@testing-library/react";
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

function adoptLockedOrder(store: ReturnType<typeof makeStore>) {
  expect(
    store.addLocalSignal(
      { kind: "booking", label: "Private booking", covers: 80 },
      store.getState().revision,
      "page",
    ).ok,
  ).toBe(true);
  expect(
    store.addLocalSignal(
      { kind: "event_cancelled", label: "Derby cancelled" },
      store.getState().revision,
      "page",
    ).ok,
  ).toBe(true);
  const preview = store.previewOrderPlan(
    undefined,
    store.getState().revision,
    "page",
  );
  expect(preview.ok).toBe(true);
  if (!preview.ok) {
    throw new Error("Expected the locked order preview");
  }
  expect(
    store.adoptOrderDraft(
      preview.preview.id,
      store.getState().revision,
      undefined,
      "page",
    ).ok,
  ).toBe(true);
}

afterEach(cleanup);
afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("order review UI", () => {
  it("describes the whole shift desk in the shared header", () => {
    render(<App store={makeStore()} modelContext={undefined} section="log" />);

    expect(
      screen.getByText(
        "Order, stock, labor and the shift record for one location, before the supplier cutoff.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Northgate · burger QSR · cutoff 22:00 Fri 4 Sep · service Sat 5 Sep · delivery 06:30",
      ),
    ).toBeVisible();
    expect(screen.queryByLabelText("Supplier cutoff")).not.toBeInTheDocument();
  });

  it("keeps the synthetic and local-only explanation in the footer", () => {
    render(<App store={makeStore()} modelContext={undefined} section="order" />);

    expect(
      screen.getByText(
        "Synthetic data stays in this tab; no supplier or rota is connected.",
      ),
    ).toBeVisible();
  });

  it("shows one live service band on every desk section", () => {
    const store = makeStore();
    const { rerender } = render(
      <App store={store} modelContext={undefined} section="order" />,
    );

    for (const section of ["order", "stock", "labor", "log"] as const) {
      rerender(<App store={store} modelContext={undefined} section={section} />);
      const band = screen.getByRole("region", { name: "Tonight's service" });
      expect(band).toBeVisible();
      expect(within(band).getByText("1,140")).toBeVisible();
      expect(
        within(band).getByText(
          "saved 1,140 · base 830 + derby 310 + bookings 0",
        ),
      ).toBeVisible();
      expect(band).toHaveTextContent("required 95 · gap 0");
      expect(
        within(band).getByText(
          "3.18 per cover · 78 cases across 10 lines · no sales feed",
        ),
      ).toBeVisible();
      expect(within(band).getByText("top reason: expired 44.60")).toBeVisible();
      expect(
        within(band).getByRole("link", { name: "4 lines with expiring stock" }),
      ).toHaveAttribute("href", "/stock");
    }

    expect(
      screen.queryByRole("region", { name: "Labor forecast summary" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Forecast and order summary" }),
    ).not.toBeInTheDocument();
  });

  it("updates service-band numbers and attention from shared store state", () => {
    const store = makeStore();
    render(<App store={store} modelContext={undefined} section="log" />);
    act(() => {
      expect(store.addLocalSignal(
        { kind: "booking", label: "Private booking", covers: 80 },
        store.getState().revision,
        "page",
      ).ok).toBe(true);
    });
    const pendingBand = screen.getByRole("region", { name: "Tonight's service" });
    expect(pendingBand).toHaveTextContent(
      "saved 1,140 · 1 signal recorded, not in working order",
    );
    expect(within(pendingBand).getByText("2", { selector: ".service-attention-count" })).toBeVisible();
    expect(within(pendingBand).getByRole("link", { name: "1 change not previewed" })).toHaveAttribute(
      "href",
      "/",
    );

    act(() => {
      expect(store.previewOrderPlan(
        "Preview the booking.",
        store.getState().revision,
        "page",
      ).ok).toBe(true);
    });
    const previewBand = screen.getByRole("region", { name: "Tonight's service" });
    expect(within(previewBand).getByText("1,220")).toBeVisible();
    expect(previewBand).toHaveTextContent(
      "preview 1,220 · saved 1,140 · base 830 + derby 310 + bookings 80",
    );
    expect(within(previewBand).queryByText("1 change not previewed")).not.toBeInTheDocument();
  });

  it("keeps preview totals, breakdown, and working-order labor on explicit bases", () => {
    const store = makeStore();
    expect(
      store.addLocalSignal(
        { kind: "booking", label: "Private booking", covers: 80 },
        store.getState().revision,
        "page",
      ).ok,
    ).toBe(true);
    expect(
      store.addLocalSignal(
        { kind: "event_cancelled", label: "Derby cancelled" },
        store.getState().revision,
        "page",
      ).ok,
    ).toBe(true);
    const preview = store.previewOrderPlan(
      "Replan after the cancelled derby.",
      store.getState().revision,
      "page",
    );
    expect(preview.ok).toBe(true);
    if (!preview.ok) {
      throw new Error("Expected an order preview");
    }

    render(<App store={store} modelContext={undefined} section="order" />);
    const band = screen.getByRole("region", { name: "Tonight's service" });
    const coversTile = within(band).getByText("Covers").closest("article");
    if (!coversTile) {
      throw new Error("Expected the Covers service tile");
    }

    expect(within(coversTile).getByText("910")).toBeVisible();
    expect(
      within(coversTile).getByText(
        "preview 910 · saved 1,140 · base 830 + derby 0 (cancelled) + bookings 80",
      ),
    ).toBeVisible();
    expect(within(band).getByText(/^preview 2,767 · /)).toBeVisible();
    expect(band).toHaveTextContent("required 95 · gap 0");
    expect(within(band).queryByRole("link", { name: /Lunch over/ })).not.toBeInTheDocument();
    expect(within(band).queryByRole("link", { name: /Dinner over/ })).not.toBeInTheDocument();

    act(() => {
      expect(
        store.adoptOrderDraft(
          preview.preview.id,
          store.getState().revision,
          undefined,
          "page",
        ).ok,
      ).toBe(true);
    });

    expect(within(coversTile).getByText("910")).toBeVisible();
    expect(
      within(coversTile).getByText(
        "saved 1,140 · base 830 + derby 0 (cancelled) + bookings 80",
      ),
    ).toBeVisible();
    expect(within(coversTile).queryByText(/^preview 910/)).not.toBeInTheDocument();
    expect(band).toHaveTextContent("required 76 · gap +19");
    expect(within(band).getByRole("link", { name: "Lunch over by 6h" })).toBeVisible();
    expect(within(band).getByRole("link", { name: "Dinner over by 10h" })).toBeVisible();

    act(() => {
      expect(store.undoAdoption(store.getState().revision, "page").ok).toBe(true);
    });

    expect(within(coversTile).getByText("1,140")).toBeVisible();
    expect(
      within(coversTile).getByText(
        "saved 1,140 · 2 signals recorded, not in working order",
      ),
    ).toBeVisible();
    expect(coversTile).not.toHaveTextContent("derby 0");
    expect(band).toHaveTextContent("required 95 · gap 0");
    expect(within(band).queryByRole("link", { name: /Lunch over/ })).not.toBeInTheDocument();
    expect(within(band).queryByRole("link", { name: /Dinner over/ })).not.toBeInTheDocument();
  });

  it("uses required and scheduled bars with signed variance bands", () => {
    const store = makeStore();
    expect(
      store.addLaborSignal(
        { kind: "absence", staffId: "s11" },
        store.getState().revision,
        "page",
      ).ok,
    ).toBe(true);
    render(<App store={store} modelContext={undefined} section="labor" />);

    const prep = screen.getByRole("article", { name: "Prep and close" });
    expect(within(prep).getByText("Required 14h")).toBeVisible();
    expect(within(prep).getByText("Scheduled 7h")).toBeVisible();
    expect(within(prep).getByText("-7h gap")).toHaveClass("variance-critical");
  });

  it("uses section-specific workflow copy", () => {
    render(
      <App
        store={makeStore()}
        modelContext={undefined}
        section="stock"
      />,
    );

    expect(screen.getByText("Count the shelf")).toBeVisible();
    expect(screen.getByText("On hand, expiring, and last counted")).toBeVisible();
    expect(screen.getByText("Log what was wasted")).toBeVisible();
    expect(screen.queryByText("Signals, pins, and stock math")).not.toBeInTheDocument();
  });

  it("renders the locked Labor roster and section-specific workflow", () => {
    render(
      <App store={makeStore()} modelContext={undefined} section="labor" />,
    );

    expect(
      screen.getByText("Match the service-day roster to the covers you're actually expecting."),
    ).toBeVisible();
    expect(screen.getByText("Check the roster against the forecast")).toBeVisible();
    expect(screen.getByText("Preview shift changes")).toBeVisible();
    expect(screen.getByText("Adopt the roster")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Lunch" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Dinner" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Prep and close" })).toBeVisible();
    expect(screen.getAllByText("Amara Osei")[0]).toBeVisible();
  });

  it("previews, adopts, and undoes the locked Labor flow", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    adoptLockedOrder(store);
    render(<App store={store} modelContext={undefined} section="labor" />);

    await user.selectOptions(screen.getByLabelText("Staff member"), "s11");
    await user.type(screen.getByLabelText("Note"), "Cannot make close.");
    await user.click(screen.getByRole("button", { name: "Record signal" }));
    expect(screen.getByText("Rosa Alvarez recorded as absent")).toHaveAttribute(
      "role",
      "status",
    );

    await user.click(screen.getByRole("button", { name: "Preview shifts" }));
    expect(screen.getByText("Release Tom Walsh, 6h")).toBeVisible();
    expect(screen.getByText("Release Jonas Weber, 6h")).toBeVisible();
    expect(screen.getByText("Cover with Nadia Haddad, 4h")).toBeVisible();
    expect(store.getState().labor.preview?.totals).toMatchObject({
      scheduledAfter: 80,
      required: 76,
      releases: 2,
      covers: 1,
    });

    await user.click(screen.getByRole("button", { name: "Adopt labor plan" }));
    expect(store.getState().labor.shifts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ staffId: "s04", status: "released" }),
        expect.objectContaining({ staffId: "s10", status: "released" }),
        expect.objectContaining({ staffId: "oc1", status: "cover" }),
      ]),
    );
    await user.click(screen.getByRole("button", { name: "Undo adoption" }));
    expect(store.getState().labor.shifts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ staffId: "s04", status: "scheduled" }),
        expect.objectContaining({ staffId: "s10", status: "scheduled" }),
        expect.objectContaining({ staffId: "s11", status: "absent" }),
      ]),
    );
  });

  it("records shelf counts and waste from the Stock section", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(
      <App
        store={store}
        modelContext={undefined}
        section="stock"
      />,
    );

    expect(
      within(screen.getByRole("complementary", { name: "Waste this week" })).getByText("74.97"),
    ).toBeVisible();
    const wasteSummary = screen.getByRole("complementary", { name: "Waste this week" });
    expect(within(wasteSummary).getByText(/Top reason: expired/i)).toBeVisible();

    await user.clear(screen.getByLabelText("Chicken thighs on hand"));
    await user.type(screen.getByLabelText("Chicken thighs on hand"), "30");
    await user.click(
      screen.getByRole("button", { name: "Record Chicken thighs count" }),
    );
    expect(
      store.getState().stock.items.find((item) => item.id === "chicken"),
    ).toMatchObject({ onHand: 30, expiring: 6 });
    expect(screen.getByText("Chicken thighs count recorded")).toHaveAttribute(
      "role",
      "status",
    );

    await user.selectOptions(screen.getByLabelText("Waste item"), "lettuce");
    await user.clear(screen.getByLabelText("Waste quantity"));
    await user.type(screen.getByLabelText("Waste quantity"), "2");
    await user.selectOptions(screen.getByLabelText("Waste reason"), "expired");
    await user.click(screen.getByRole("button", { name: "Log waste" }));

    expect(
      store.getState().stock.items.find((item) => item.id === "lettuce"),
    ).toMatchObject({ onHand: 7, expiring: 2 });
    expect(
      within(screen.getByRole("complementary", { name: "Waste this week" })).getByText("77.30"),
    ).toBeVisible();
    expect(screen.getByText("Iceberg lettuce waste recorded")).toHaveAttribute(
      "role",
      "status",
    );
    expect(store.getState().activity.at(-1)).toMatchObject({ section: "stock" });
  });

  it("associates Stock validation errors with their fields", async () => {
    const user = userEvent.setup();
    render(
      <App store={makeStore()} modelContext={undefined} section="stock" />,
    );

    const onHand = screen.getByLabelText("Chicken thighs on hand");
    const expiring = screen.getByLabelText("Chicken thighs expiring");
    await user.clear(onHand);
    await user.type(onHand, "5");
    await user.click(
      screen.getByRole("button", { name: "Record Chicken thighs count" }),
    );
    expect(onHand).toHaveAttribute("aria-invalid", "true");
    expect(expiring).toHaveAttribute("aria-invalid", "true");
    expect(onHand).toHaveAccessibleDescription(
      "Expiring stock cannot exceed on hand",
    );

    const wasteQuantity = screen.getByLabelText("Waste quantity");
    await user.clear(wasteQuantity);
    await user.type(wasteQuantity, "0");
    await user.click(screen.getByRole("button", { name: "Log waste" }));
    expect(wasteQuantity).toHaveAttribute("aria-invalid", "true");
    expect(wasteQuantity).toHaveAccessibleDescription(
      "Enter a waste quantity above 0 and no more than 100,000",
    );
  });

  it("shows a stale order notice after a cross-page count and refreshes it", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    expect(
      store.addLocalSignal(
        { kind: "booking", label: "Private booking", covers: 80 },
        store.getState().revision,
        "page",
      ).ok,
    ).toBe(true);
    expect(
      store.addLocalSignal(
        { kind: "event_cancelled", label: "Derby cancelled" },
        store.getState().revision,
        "tool",
        "add_local_signal",
      ).ok,
    ).toBe(true);
    const preview = store.previewOrderPlan(
      "Preview before the shelf count.",
      store.getState().revision,
      "page",
    );
    expect(preview.ok).toBe(true);

    const stockPage = render(
      <App
        store={store}
        modelContext={undefined}
        section="stock"
      />,
    );
    await user.clear(screen.getByLabelText("Chicken thighs on hand"));
    await user.type(screen.getByLabelText("Chicken thighs on hand"), "30");
    await user.click(
      screen.getByRole("button", { name: "Record Chicken thighs count" }),
    );
    expect(screen.getByText("Order preview needs a refresh")).toBeVisible();
    stockPage.unmount();

    render(<App store={store} modelContext={undefined} section="order" />);
    expect(
      screen.getByText("Stock counts changed since this preview. Preview again."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Preview again" }));
    expect(store.getState().orderPreviewStaleReason).toBeNull();
    expect(store.getState().preview?.totals.afterCost).toBe(2_835);
  });

  it("shows the live WebMCP tool count and names in the footer", async () => {
    const user = userEvent.setup();
    const context = {
      registerTool: vi.fn(async () => undefined),
      getTools: vi.fn(async () => []),
      ontoolchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    } satisfies WebMCP.ModelContext;

    render(<App store={makeStore()} modelContext={context} />);

    expect(await screen.findByText("6 tools")).toBeVisible();
    await user.click(screen.getByText("6 tools"));
    expect(screen.getByText("get_order_context")).toBeVisible();
    expect(screen.getByText("open_section")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Preview replan" }));
    expect(await screen.findByText("7 tools")).toBeVisible();
    expect(screen.getByText("adopt_order_preview")).toBeVisible();
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

  it("shows an inline error when booking covers are invalid", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<App store={store} modelContext={undefined} />);

    await user.type(screen.getByLabelText("Signal label"), "Private booking");
    await user.clear(screen.getByLabelText("Booking covers"));
    await user.click(screen.getByRole("button", { name: "Add signal" }));

    expect(
      screen.getByText("Enter covers as a whole number from 1 to 2,000"),
    ).toBeVisible();
    expect(screen.getByLabelText("Booking covers")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(store.getState().signals).toStrictEqual([]);
  });

  it("matches the visible booking limit to the tool contract", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<App store={store} modelContext={undefined} />);

    await user.type(screen.getByLabelText("Signal label"), "Oversized booking");
    const covers = screen.getByLabelText("Booking covers");
    await user.clear(covers);
    await user.type(covers, "2001");
    await user.click(screen.getByRole("button", { name: "Add signal" }));

    expect(screen.getByText("Enter covers as a whole number from 1 to 2,000")).toBeVisible();
    expect(covers).toHaveAttribute("max", "2000");
    expect(store.getState().signals).toStrictEqual([]);
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

  it("pins a quantity into the visible row, drawer, and preview cost", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<App store={store} modelContext={undefined} />);

    await user.click(screen.getByRole("button", { name: "Preview replan" }));
    screen.getByRole("button", { name: /Brioche buns/ }).focus();
    await user.keyboard("{Enter}");
    expect(store.getState().focusedSkuId).toBe("buns");

    const previewId = store.getState().preview?.id;
    await user.clear(screen.getByLabelText("Brioche buns quantity pin"));
    await user.type(screen.getByLabelText("Brioche buns quantity pin"), "13");
    await user.click(screen.getByRole("button", { name: "Pin quantity" }));

    expect(store.getState().pins.lineOverrides.buns).toBe(13);
    expect(store.getState().preview?.id).not.toBe(previewId);
    expect(store.getState().preview?.totals.afterCost).toBe(3_667);
    expect(
      screen.getByRole("button", {
        name: "Brioche buns, saved 11 cases, current 13 cases",
      }),
    ).toBeVisible();
    expect(screen.getByLabelText("Brioche buns case decision")).toHaveTextContent(
      "Calculated 11",
    );
    expect(screen.getByLabelText("Brioche buns case decision")).toHaveTextContent(
      "Pinned 13",
    );
    expect(screen.getByLabelText("Filled order formula")).toHaveTextContent(
      "ceil(490.14 / 48)) = 11",
    );
    expect(screen.getByText("3,667")).toBeVisible();
  });

  it("explains an invalid quantity pin and clears the error on edit", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<App store={store} modelContext={undefined} />);

    await user.click(screen.getByRole("button", { name: /Brioche buns/ }));
    const input = screen.getByLabelText("Brioche buns quantity pin");
    await user.clear(input);
    await user.type(input, "-1");
    await user.click(screen.getByRole("button", { name: "Pin quantity" }));

    expect(screen.getByText("Enter a whole number from 0 to 10,000")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(store.getState().pins.lineOverrides).not.toHaveProperty("buns");

    await user.clear(input);
    await user.type(input, "13");
    expect(screen.queryByText("Enter a whole number from 0 to 10,000")).not.toBeInTheDocument();
  });

  it("refreshes an active preview when the manager records a signal", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<App store={store} modelContext={undefined} />);

    await user.click(screen.getByRole("button", { name: "Preview replan" }));
    const firstPreviewId = store.getState().preview?.id;
    await user.selectOptions(
      screen.getByLabelText("Signal type"),
      "event_cancelled",
    );
    await user.type(screen.getByLabelText("Signal label"), "Derby cancelled");
    await user.click(screen.getByRole("button", { name: "Add signal" }));

    expect(store.getState().preview?.id).not.toBe(firstPreviewId);
    expect(store.getState().preview?.covers.after).toBe(830);
    expect(store.getState().pendingOrderChanges).toBe(0);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Preview ready: 830 covers, 70 labor hours",
    );
  });

  it("shows pending changes until the manager previews them", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<App store={store} modelContext={undefined} />);

    await user.type(screen.getByLabelText("Signal label"), "Private booking");
    await user.click(screen.getByRole("button", { name: "Add signal" }));

    expect(screen.getAllByText("1 change not previewed")).toHaveLength(2);
    await user.click(
      screen.getByRole("button", { name: "Preview pending changes" }),
    );
    expect(screen.queryByText(/change(?:s)? not previewed/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveFocus();
  });

  it("moves focus to a selected line's drawer on a narrow screen", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    const user = userEvent.setup();
    render(<App store={makeStore()} modelContext={undefined} />);

    await user.click(screen.getByRole("button", { name: /Brioche buns/ }));

    expect(screen.getByLabelText("Brioche buns stock line math")).toHaveFocus();
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
    expect(screen.getByRole("status")).toHaveTextContent("Order plan adopted");

    await user.click(screen.getByRole("button", { name: "Undo adoption" }));
    expect(store.getState().draft.plan.covers).toBe(1_140);
    expect(store.getState().undoAvailable).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("Order adoption undone");
  });

  it("announces when the manager discards an order preview", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<App store={store} modelContext={undefined} />);

    await user.click(screen.getByRole("button", { name: "Preview replan" }));
    await user.click(screen.getByRole("button", { name: "Discard preview" }));

    expect(store.getState().preview).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Order preview discarded");
  });

  it("shows a saved receipt with the manager summary and JSON", () => {
    const store = makeStore();
    store.saveHandoffReceipt(
      "Morning manager: check the revised draft before cutoff.",
      store.getState().revision,
      "page",
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
      actor: "page",
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
    store.addLocalSignal(
      { kind: "event_cancelled", label: "Derby cancelled" },
      0,
      "tool",
      "add_local_signal",
    );

    render(<App store={store} modelContext={undefined} />);

    expect(screen.getByText("add_local_signal")).toBeVisible();
    expect(screen.getByText("event_cancelled: Derby cancelled")).toBeVisible();
    expect(screen.getByText("Signal added at revision 1.")).toBeVisible();
    expect(screen.queryByText("agent")).not.toBeInTheDocument();
  });

  it("copies receipt JSON and starts a JSON download", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.saveHandoffReceipt(
      "Check the draft before cutoff.",
      store.getState().revision,
      "page",
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
      "page",
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
    expect(screen.queryByRole("link", { name: "How the numbers work" })).not.toBeInTheDocument();
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

  it("sets a route-specific document title", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/");
    render(<RouteView />);

    expect(document.title).toBe("Cutoff · Order");
    await user.click(screen.getByRole("link", { name: "Stock" }));
    expect(document.title).toBe("Cutoff · Stock");
    window.history.pushState({}, "", "/");
  });

  it("keeps one revisioned store while the manager switches sections", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/");
    render(<RouteView />);

    await user.type(screen.getByLabelText("Signal label"), "Private booking");
    await user.click(screen.getByRole("button", { name: "Add signal" }));
    expect(screen.getAllByText("1 change not previewed")).toHaveLength(2);

    await user.click(screen.getByRole("link", { name: "Stock" }));
    expect(screen.getByRole("heading", { name: "Stock" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Stock" })).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Walk-in and dry store" })).toBeVisible();

    await user.click(screen.getByRole("link", { name: "Order" }));
    expect(screen.getByText("Private booking · 80 covers")).toBeVisible();
    expect(screen.getAllByText("1 change not previewed")).toHaveLength(2);
    window.history.pushState({}, "", "/");
  });

  it("switches the visible service day to the Tuesday preset", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<App store={store} modelContext={undefined} />);

    await user.selectOptions(screen.getByLabelText("Service day"), "tuesday");

    expect(store.getState().presetId).toBe("tuesday");
    expect(store.getState().revision).toBe(0);
    expect(screen.getByText(/service Tue 8 Sep/)).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Tonight's service" }),
    ).toHaveTextContent("saved 520 · base 520 + events 0 + bookings 0");
    expect(
      screen.getByText(
        "Northgate · burger QSR · cutoff 22:00 Mon 7 Sep · service Tue 8 Sep · delivery 06:30",
      ),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Stock lines for Tue 8 Sep" })).toBeVisible();
  });

  it("adds and filters a note on the shift log", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<App store={store} modelContext={undefined} section="log" />);

    expect(screen.getByText("One record of the shift, for whoever opens tomorrow.")).toBeVisible();
    await user.type(
      screen.getByLabelText("Shift note"),
      "Check the walk-in before lunch.",
    );
    await user.selectOptions(screen.getByLabelText("Filed under"), "stock");
    await user.click(screen.getByRole("button", { name: "Add shift note" }));

    expect(screen.getByText("Shift note added")).toHaveAttribute("role", "status");
    expect(screen.getByText(/Check the walk-in before lunch/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Labor" }));
    expect(screen.getByText("No recorded activity matches this filter.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Stock" }));
    expect(screen.getByText(/Check the walk-in before lunch/)).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Service day"), "tuesday");
    expect(screen.queryByText("Shift note added")).not.toBeInTheDocument();
    expect(screen.getByText(/Preset tuesday loaded at revision 0/)).toBeVisible();
  });

  it("offers client-side order CSV and shift-log JSON downloads", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:download");
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const store = makeStore();
    const { rerender } = render(<App store={store} modelContext={undefined} />);

    await user.click(screen.getByRole("button", { name: "Download order sheet (CSV)" }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    rerender(<App store={store} modelContext={undefined} section="log" />);
    await user.click(screen.getByRole("button", { name: "Download shift log (JSON)" }));
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(click).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    click.mockRestore();
  });
});
