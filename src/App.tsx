import {
  type FormEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  pathForSection,
  SECTION_DEFINITIONS,
  type Section,
} from "./domain/sections";
import { getPreset, PRESETS, PRESET_IDS, type PresetId } from "./data/presets";
import type { LocalSignal, ReasonCode } from "./domain/types";
import {
  buildOrderSheetCsv,
  getOrderSheetCsvFilename,
} from "./engine/exportEngine";
import { calculateLine } from "./engine/orderEngine";
import { StockPage } from "./StockPage";
import { LaborPage } from "./LaborPage";
import { ShiftLogPage } from "./ShiftLogPage";
import { ServiceBand } from "./ServiceBand";
import { BrandMark, StockItemThumbnail } from "./VisualIdentity";
import {
  createReviewStore,
  type HandoffReceipt,
  type ReviewState,
  type ReviewStore,
} from "./store/reviewStore";
import { mountWebMCPTools, type WebMCPStatus } from "./webmcp/registerTools";
import "./styles.css";

type AppProps = Readonly<{
  store?: ReviewStore;
  modelContext?: WebMCP.ModelContext;
  section?: Section;
  navigate?: (section: Section) => void;
}>;

type SignalKind = "booking" | "event_cancelled" | "operator_note";

const defaultStatus: WebMCPStatus = {
  supported: false,
  toolCount: 0,
  error: null,
};

const DEMO_PROMPT =
  "The derby has been cancelled. Add that to the order review and replan, but keep my booking.";
const ORIENTATION_STORAGE_KEY = "cutoff:orientation-dismissed";

function orientationWasDismissed(): boolean {
  try {
    return window.localStorage.getItem(ORIENTATION_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function storeOrientationDismissal(dismissed: boolean): void {
  try {
    if (dismissed) {
      window.localStorage.setItem(ORIENTATION_STORAGE_KEY, "true");
    } else {
      window.localStorage.removeItem(ORIENTATION_STORAGE_KEY);
    }
  } catch {
    // The orientation strip still works for this tab when storage is blocked.
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function reasonLabel(reason: ReasonCode): string {
  return reason.replaceAll("_", " ").toLowerCase();
}

function readSignalKind(value: string): SignalKind {
  switch (value) {
    case "booking":
    case "event_cancelled":
    case "operator_note":
      return value;
    default:
      return "operator_note";
  }
}

function lineCases(state: ReviewState, skuId: string): number {
  const line = state.draft.plan.lines.find((candidate) => candidate.skuId === skuId);
  return line?.cases ?? 0;
}

function signalSummary(signal: LocalSignal): string {
  if (signal.kind === "booking") {
    return `${signal.label} · ${signal.covers} covers`;
  }
  return signal.label;
}

function activityTime(value: string): string {
  const time = value.slice(11, 16);
  return /^\d{2}:\d{2}$/.test(time) ? time : "time unavailable";
}

function activityEffectLabel(effect: ReviewState["activity"][number]["effect"]): string {
  return effect === "draft" ? "change" : effect;
}

function useReviewState(store: ReviewStore): ReviewState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

function DetailPanel({ state, store }: Readonly<{ state: ReviewState; store: ReviewStore }>) {
  const item = state.stock.items.find(
    (candidate) => candidate.id === state.focusedSkuId,
  );
  const [quantity, setQuantity] = useState("");
  const [pinError, setPinError] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const previousItemId = useRef<string | null>(null);

  useEffect(() => {
    if (!item) {
      setQuantity("");
      setPinError("");
      return;
    }
    setQuantity(String(state.pins.lineOverrides[item.id] ?? lineCases(state, item.id)));
    setPinError("");
  }, [item, state.pins.lineOverrides, state.draft.plan.lines]);

  useEffect(() => {
    if (
      item &&
      item.id !== previousItemId.current &&
      window.matchMedia?.("(max-width: 720px)").matches
    ) {
      panelRef.current?.focus();
    }
    previousItemId.current = item?.id ?? null;
  }, [item]);

  if (!item) {
    return (
      <aside className="detail-panel empty-detail" aria-label="Stock line math">
        <p className="eyebrow">Stock line math</p>
        <p>Select a line to inspect its order math and pin a quantity.</p>
      </aside>
    );
  }

  const covers = state.preview?.covers.after ?? state.draft.plan.covers;
  const calculation = calculateLine(item, covers);
  const { demand, need } = calculation;
  const pin = state.pins.lineOverrides[item.id];
  const previewLine = state.preview?.lines.find((line) => line.skuId === item.id);
  const reason = previewLine?.reason ?? state.draft.reasons[item.id] ?? "UNCHANGED";

  const pinQuantity = () => {
    const parsed = Number(quantity);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10_000) {
      setPinError("Enter a whole number from 0 to 10,000");
      return;
    }
    const result = store.pinLineQuantity(item.id, parsed, state.revision, "page");
    setPinError(result.ok ? "" : "The order changed. Review it and try again");
  };

  const pinErrorId = `pin-error-${item.id}`;

  return (
    <aside
      className="detail-panel"
      aria-label={`${item.name} stock line math`}
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="detail-heading">
        <div className="item-detail-identity">
          <StockItemThumbnail skuId={item.id} />
          <div>
          <p className="eyebrow">Stock line math</p>
          <h2>{item.name}</h2>
          <p className="mono item-id">{item.id} / {item.unit} / case {item.caseSize}</p>
          </div>
        </div>
        <span className="reason-chip">{reasonLabel(reason)}</span>
      </div>
      <div className="formula" aria-label="Filled order formula">
        <p><span>demand</span><code>{formatNumber(covers)} × {item.usagePerCover} = {demand.toFixed(2)}</code></p>
        <p><span>need</span><code>{demand.toFixed(2)} × {(1 + item.safety).toFixed(2)} − ({item.onHand} − {item.expiring}) − {item.inTransit} = {need.toFixed(2)}</code></p>
        <p><span>cases</span><code>max(0, ceil({need.toFixed(2)} / {item.caseSize})) = {calculation.calculatedCases}</code></p>
      </div>
      <div className="case-decision" aria-label={`${item.name} case decision`}>
        <p><span>Calculated</span>{" "}<strong className="mono">{calculation.calculatedCases}</strong></p>
        <p><span>Pinned</span>{" "}<strong className="mono">{pin ?? "None"}</strong></p>
      </div>
      {item.lastCountedAt !== getPreset(state.presetId).stockLastCountedAt ? (
        <p className="count-updated-note">Count updated. The reason code still explains the order recommendation.</p>
      ) : null}
      <p className="safety-note"><strong>{Math.round(item.safety * 100)}% safety.</strong> Running out costs more margin than the waste.</p>
      <div className="pin-control">
        <label htmlFor={`pin-${item.id}`}>Pin quantity</label>
        <div>
          <input
            id={`pin-${item.id}`}
            aria-describedby={pinError ? pinErrorId : undefined}
            aria-invalid={pinError ? "true" : undefined}
            aria-label={`${item.name} quantity pin`}
            inputMode="numeric"
            max="10000"
            min="0"
            step="1"
            type="number"
            value={quantity}
            onChange={(event) => {
              setQuantity(event.target.value);
              setPinError("");
            }}
          />
          <button type="button" onClick={pinQuantity}>Pin quantity</button>
        </div>
        {pinError ? <p id={pinErrorId} className="field-error" role="alert">{pinError}</p> : null}
        {pin !== undefined ? <button className="text-button" type="button" onClick={() => store.removeLinePin(item.id, state.revision, "page")}>Remove pin</button> : null}
      </div>
    </aside>
  );
}

function OrderSheet({
  state,
  store,
  serviceLabel,
}: Readonly<{
  state: ReviewState;
  store: ReviewStore;
  serviceLabel: string;
}>) {
  const selectLine = (skuId: string) => {
    if (state.focusedSkuId !== skuId) {
      store.focusSku(skuId, state.revision, "page");
    }
  };
  return (
    <section className="sheet-panel" aria-labelledby="sheet-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Supplier order sheet</p>
          <h2 id="sheet-heading">Stock lines for {serviceLabel}</h2>
        </div>
        <p className="mono section-note">10 lines · revision {state.revision}</p>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">On hand</th>
              <th scope="col">Inbound</th>
              <th scope="col">Expiring</th>
              <th scope="col">Saved</th>
              <th scope="col">Preview / working order</th>
              <th scope="col">Delta</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            {state.stock.items.map((item) => {
              const saved = state.savedPlan.lines.find((line) => line.skuId === item.id)?.cases ?? 0;
              const preview = state.preview?.lines.find((line) => line.skuId === item.id);
              const current = preview?.afterCases ?? lineCases(state, item.id);
              const delta = preview?.delta ?? current - saved;
              const reason = preview?.reason ?? state.draft.reasons[item.id] ?? "UNCHANGED";
              const selected = state.focusedSkuId === item.id;
              return (
                <tr
                  key={item.id}
                  className={selected ? "selected" : undefined}
                  onClick={() => selectLine(item.id)}
                >
                  <th scope="row">
                    <button
                      type="button"
                      className="row-select"
                      aria-label={`${item.name}, saved ${saved} cases, current ${current} cases`}
                      aria-pressed={selected}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectLine(item.id);
                      }}
                    >
                      <span className="item-identity">
                        <StockItemThumbnail skuId={item.id} />
                        <span className="item-identity-copy">
                          <span>{item.name}</span>
                          <small className="mono">{item.id}</small>
                        </span>
                      </span>
                    </button>
                  </th>
                  <td className="mono">{item.onHand}</td>
                  <td className="mono">{item.inTransit}</td>
                  <td className="mono">{item.expiring}</td>
                  <td className="mono">{saved}</td>
                  <td className="mono current-value">
                    <span
                      key={`${state.preview?.id ?? `working-${state.revision}`}-${current}`}
                      className={delta === 0 ? undefined : "changed-cell"}
                    >
                      {current}
                    </span>
                  </td>
                  <td className={`mono delta ${delta === 0 ? "flat" : ""}`}>{formatDelta(delta)}</td>
                  <td><span className="reason-chip">{reasonLabel(reason)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SignalForm({ state, store }: Readonly<{ state: ReviewState; store: ReviewStore }>) {
  const [kind, setKind] = useState<SignalKind>("booking");
  const [label, setLabel] = useState("");
  const [covers, setCovers] = useState("80");
  const [labelError, setLabelError] = useState("");
  const [coversError, setCoversError] = useState("");

  const addSignal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanLabel = label.trim();
    if (!cleanLabel) {
      setLabelError("Give the signal a label");
      return;
    }
    if (kind === "booking") {
      const parsedCovers = Number(covers);
      if (!Number.isInteger(parsedCovers) || parsedCovers < 1 || parsedCovers > 2_000) {
        setCoversError("Enter covers as a whole number from 1 to 2,000");
        return;
      }
      store.addLocalSignal({ kind, label: cleanLabel, covers: parsedCovers }, state.revision, "page");
    } else {
      store.addLocalSignal({ kind, label: cleanLabel }, state.revision, "page");
    }
    setLabel("");
    setLabelError("");
    setCoversError("");
  };

  return (
    <section className="signals-panel" aria-labelledby="signals-heading">
      <div className="section-heading">
        <div>
          <p className="panel-step">Step 1</p>
          <p className="eyebrow">Local signals</p>
          <h2 id="signals-heading">What changed on the ground</h2>
        </div>
      </div>
      <form onSubmit={addSignal} className="signal-form" noValidate>
        <label>Signal type
          <select aria-label="Signal type" value={kind} onChange={(event) => setKind(readSignalKind(event.target.value))}>
            <option value="booking">Private booking</option>
            <option value="event_cancelled">Event cancelled</option>
            <option value="operator_note">Operator note</option>
          </select>
        </label>
        <label>Signal label
          <input
            aria-describedby={labelError ? "signal-label-error" : undefined}
            aria-invalid={labelError ? "true" : undefined}
            aria-label="Signal label"
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              if (labelError) {
                setLabelError("");
              }
            }}
            maxLength={160}
            required
          />
          {labelError ? (
            <span id="signal-label-error" className="field-error" role="alert">
              {labelError}
            </span>
          ) : null}
        </label>
        {kind === "booking" ? <label>Booking covers
          <input
            aria-describedby={coversError ? "booking-covers-error" : undefined}
            aria-invalid={coversError ? "true" : undefined}
            aria-label="Booking covers"
            type="number"
            max="2000"
            min="1"
            value={covers}
            onChange={(event) => {
              setCovers(event.target.value);
              if (coversError) {
                setCoversError("");
              }
            }}
          />
          {coversError ? (
            <span id="booking-covers-error" className="field-error" role="alert">
              {coversError}
            </span>
          ) : null}
        </label> : null}
        <button type="submit">Add signal</button>
      </form>
      <ul className="signal-list">
        {state.signals.length === 0 ? <li className="empty-state">No local signals recorded.</li> : state.signals.map((signal) => (
          <li key={signal.id}>
            <span>{signalSummary(signal)}</span>
          </li>
        ))}
      </ul>
      <div className="pins-list">
        <p className="eyebrow">Pins</p>
        {state.pins.bookingIds.length === 0 && Object.keys(state.pins.lineOverrides).length === 0 ? <p className="empty-state">No pins set.</p> : null}
        {state.signals.filter((signal) => signal.kind === "booking" && state.pins.bookingIds.includes(signal.id)).map((signal) => (
          <div className="pin-row" key={signal.id}>
            <p>Booking pinned: {signalSummary(signal)}</p>
            <button
              className="text-button"
              type="button"
              aria-label={`Remove booking pin: ${signal.label}`}
              onClick={() => store.removeBookingPin(signal.id, state.revision, "page")}
            >
              Remove
            </button>
          </div>
        ))}
        {Object.entries(state.pins.lineOverrides).map(([skuId, cases]) => (
          <div className="pin-row" key={skuId}>
            <p>Quantity pinned: <span className="mono">{skuId} / {cases}</span></p>
            <button
              className="text-button"
              type="button"
              aria-label={`Remove quantity pin: ${skuId}`}
              onClick={() => store.removeLinePin(skuId, state.revision, "page")}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityPanel({
  state,
  status,
}: Readonly<{ state: ReviewState; status: WebMCPStatus }>) {
  return (
    <section className="activity-panel" aria-labelledby="activity-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Activity</p>
          <h2 id="activity-heading">Shift activity</h2>
        </div>
      </div>
      <ol className="activity-list">
        {state.activity.length === 0 ? <li className="empty-state">No activity yet.</li> : state.activity.map((entry) => (
          <li key={entry.id}>
            <div>
              <span className="effect-tag">{activityEffectLabel(entry.effect)}</span>
              <span className="mono">{entry.tool ?? "page action"}</span>
              <time className="mono activity-time" dateTime={entry.at}>{activityTime(entry.at)}</time>
            </div>
            <p>{entry.inputSummary}</p>
            <small>{entry.resultSummary}</small>
          </li>
        ))}
      </ol>
      {status.error ? <p className="alert" role="alert">{status.error}</p> : null}
    </section>
  );
}

function HandoffReceiptPanel({ receipt }: Readonly<{ receipt: HandoffReceipt }>) {
  const [copyNotice, setCopyNotice] = useState("");
  const receiptJson = useMemo(() => JSON.stringify(receipt, null, 2), [receipt]);

  const copyJson = async () => {
    setCopyNotice("");
    if (!navigator.clipboard?.writeText) {
      setCopyNotice("Copy is unavailable in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(receiptJson);
      setCopyNotice("JSON copied.");
    } catch {
      setCopyNotice("Copy failed. Select the JSON and copy it manually.");
    }
  };

  const downloadJson = () => {
    const file = new Blob([receiptJson], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cutoff-receipt-${receipt.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="receipt-panel" aria-label="Saved handoff receipt">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Handoff receipt</p>
          <h2>Saved for the morning manager</h2>
        </div>
        <p className="mono section-note">revision {receipt.revision}</p>
      </div>
      <p className="receipt-summary">{receipt.managerSummary}</p>
      <p className="receipt-status">Saved locally. Nothing was sent outside this page.</p>
      <div className="control-buttons">
        <button type="button" onClick={() => void copyJson()}>Copy JSON</button>
        <button type="button" onClick={downloadJson}>Download JSON</button>
      </div>
      <p className="copy-notice" aria-live="polite">{copyNotice}</p>
      <pre className="receipt-json" aria-label="Receipt JSON">{receiptJson}</pre>
    </section>
  );
}

export function App({
  store: providedStore,
  modelContext,
  section = "order",
  navigate,
}: AppProps) {
  const ownedStore = useMemo(() => createReviewStore(), []);
  const store = providedStore ?? ownedStore;
  const state = useReviewState(store);
  const [status, setStatus] = useState<WebMCPStatus>(defaultStatus);
  const [handoffSummary, setHandoffSummary] = useState("");
  const [handoffError, setHandoffError] = useState("");
  const [promptNotice, setPromptNotice] = useState("");
  const [orderControlError, setOrderControlError] = useState("");
  const [orderControlNotice, setOrderControlNotice] = useState("");
  const [orientationVisible, setOrientationVisible] = useState(
    () => !orientationWasDismissed(),
  );
  const sectionDefinition = SECTION_DEFINITIONS.find(
    (candidate) => candidate.id === section,
  ) ?? SECTION_DEFINITIONS[0];
  const preset = getPreset(state.presetId);
  const pageTitleRef = useRef<HTMLHeadingElement>(null);
  const previousSection = useRef(section);
  const previewSummaryRef = useRef<HTMLElement>(null);
  const focusPreviewSummary = useRef(false);

  useLayoutEffect(() => {
    const mount = mountWebMCPTools({
      store,
      modelContext,
      onStatus: setStatus,
      section,
      navigate,
    });
    return mount.cleanup;
  }, [store, modelContext, navigate, section]);

  useEffect(() => {
    if (previousSection.current !== section) {
      pageTitleRef.current?.focus();
      previousSection.current = section;
    }
  }, [section]);

  useEffect(() => {
    if (focusPreviewSummary.current && state.preview) {
      previewSummaryRef.current?.focus();
      focusPreviewSummary.current = false;
    }
  }, [state.preview]);

  const hasPreview = state.preview !== null;
  const canAdopt =
    state.preview !== null &&
    state.orderPreviewStaleReason === null &&
    state.pendingOrderChanges === 0;
  const runOrderControl = (
    action: () => { ok: boolean },
    successMessage: string,
  ) => {
    setOrderControlError("");
    setOrderControlNotice("");
    const result = action();
    if (!result.ok) {
      setOrderControlError("The order changed. Review it and try again");
      return;
    }
    setOrderControlNotice(successMessage);
  };
  const preview = () => {
    setOrderControlError("");
    setOrderControlNotice("");
    return store.previewOrderPlan(
      "Manual preview from the order sheet.",
      state.revision,
      "page",
    );
  };
  const previewPendingChanges = () => {
    focusPreviewSummary.current = true;
    preview();
  };
  const moveToSection = (nextSection: Section) => {
    if (nextSection === section) {
      return;
    }
    store.recordSectionOpen(nextSection, "page");
    navigate?.(nextSection);
  };
  const resetDemo = () => {
    storeOrientationDismissal(false);
    setOrientationVisible(true);
    store.resetDemo("page");
  };
  const dismissOrientation = () => {
    storeOrientationDismissal(true);
    setOrientationVisible(false);
  };
  const copyDemoPrompt = async () => {
    setPromptNotice("");
    if (!navigator.clipboard?.writeText) {
      setPromptNotice("Copy is unavailable in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(DEMO_PROMPT);
      setPromptNotice("Demo prompt copied.");
    } catch {
      setPromptNotice("Copy failed. Select the prompt and copy it manually.");
    }
  };
  const saveHandoff = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanSummary = handoffSummary.trim();
    if (!cleanSummary) {
      setHandoffError("Give the morning manager a note");
      return;
    }
    const result = store.saveHandoffReceipt(
      cleanSummary,
      state.revision,
      "page",
    );
    if (!result.ok) {
      setHandoffError(
        result.error === "storage_unavailable"
          ? "Allow local storage, then try again"
          : "The order changed. Review it, then try again",
      );
      return;
    }
    setHandoffSummary("");
    setHandoffError("");
  };
  const downloadOrderSheet = () => {
    const csv = buildOrderSheetCsv({
      items: state.stock.items,
      workingPlan: state.draft.plan,
      reasons: state.draft.reasons,
    });
    const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = getOrderSheetCsvFilename(state.serviceDate);
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app-shell">
      <a className="skip-link" href="#page-title">Skip to current section</a>
      <div className="paper">
        <header className="app-header">
          <div>
            <div className="header-kicker">
              <p className="eyebrow">Cutoff · Shift operations desk</p>
              <span className="synthetic-tag">Synthetic</span>
            </div>
            <div className="brand-title-row">
              <BrandMark />
              <h1>Cutoff</h1>
            </div>
            <p className="hero-copy">Order, stock, labor and the shift record for one location, before the supplier cutoff.</p>
            <p className="header-subtitle">Northgate · burger QSR · cutoff 22:00 {preset.cutoffLabel} · service {preset.serviceLabel} · delivery 06:30</p>
          </div>
          <div className="header-actions">
            <label htmlFor="preset-select">
              Service day
              <select
                id="preset-select"
                value={state.presetId}
                onChange={(event) => {
                  const presetId = event.target.value as PresetId;
                  if (PRESET_IDS.some((candidate) => candidate === presetId)) {
                    store.switchPreset(presetId, "page");
                  }
                }}
              >
                {PRESET_IDS.map((presetId) => (
                  <option key={presetId} value={presetId}>{PRESETS[presetId].label}</option>
                ))}
              </select>
            </label>
            <button className="text-button reset-button" type="button" onClick={resetDemo}>Reset demo</button>
          </div>
        </header>

        {orientationVisible ? (
          <aside className="orientation-strip" aria-label="Demo orientation">
            <p>A shift manager and their browser agent work this page together. Everything here is synthetic and stays in this tab; nothing reaches a supplier or rota.</p>
            <button
              aria-label="Dismiss orientation"
              className="orientation-dismiss"
              type="button"
              onClick={dismissOrientation}
            >
              Dismiss
            </button>
          </aside>
        ) : null}

        <nav className="section-tabs" aria-label="Shift desk sections">
          {SECTION_DEFINITIONS.map((candidate) => (
            <a
              key={candidate.id}
              aria-current={candidate.id === section ? "page" : undefined}
              href={pathForSection(candidate.id)}
              onClick={(event) => {
                if (
                  !navigate ||
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return;
                }
                event.preventDefault();
                moveToSection(candidate.id);
              }}
            >
              {candidate.label}
            </a>
          ))}
        </nav>

        <ServiceBand state={state} navigate={moveToSection} />

        <section className="page-intro" aria-labelledby="page-title">
          <p className="eyebrow">Current section</p>
          <h2 id="page-title" ref={pageTitleRef} tabIndex={-1}>
            {sectionDefinition.label}
          </h2>
          <p>
            {sectionDefinition.description}
          </p>
        </section>

        <ol className="workflow-strip" aria-label="Shift review steps">
          {sectionDefinition.steps.map((step, index) => (
            <li key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step.title}</strong>
              <small>{step.detail}</small>
            </li>
          ))}
        </ol>
        <p className="agent-collaboration-note">Your agent can do every step with you on this page.</p>

        {section === "stock" ? (
          <>
            <StockPage
              state={state}
              store={store}
              openOrder={() => moveToSection("order")}
            />
            <ActivityPanel state={state} status={status} />
          </>
        ) : section === "labor" ? (
          <>
            <LaborPage state={state} store={store} />
            <ActivityPanel state={state} status={status} />
          </>
        ) : section === "log" ? (
          <>
            <ShiftLogPage state={state} store={store} />
            {status.error ? <p className="alert" role="alert">{status.error}</p> : null}
          </>
        ) : (
          <>

        {state.orderPreviewStaleReason ? (
          <section className="stale-preview-strip" role="status">
            <p>
              <strong>Order preview needs a refresh</strong>
              <span>{state.orderPreviewStaleReason}</span>
            </p>
            <button type="button" onClick={previewPendingChanges}>Preview again</button>
          </section>
        ) : null}

        {state.pendingOrderChanges > 0 ? (
          <section className="pending-strip" aria-live="polite">
            <p>
              <strong>{state.pendingOrderChanges} {state.pendingOrderChanges === 1 ? "change" : "changes"} not previewed</strong>
              <span>The working order still shows the last calculated plan.</span>
            </p>
            <button type="button" onClick={previewPendingChanges}>Preview pending changes</button>
          </section>
        ) : null}
        {state.preview ? (
          <section
            className="preview-summary"
            ref={previewSummaryRef}
            role="status"
            tabIndex={-1}
          >
            Preview ready: {formatNumber(state.preview.covers.after)} covers, {state.preview.laborHours.after} labor hours, {formatNumber(state.preview.totals.afterCost)} units.
          </section>
        ) : null}

        <div className="main-grid">
          <OrderSheet state={state} store={store} serviceLabel={preset.serviceLabel} />
          <SignalForm state={state} store={store} />
          <DetailPanel state={state} store={store} />
          <section className="controls-panel" aria-label="Order plan">
            <p className="panel-step">Step 2</p>
            <p className="eyebrow">Order plan</p>
            <div className="control-buttons">
              <button type="button" onClick={preview}>Preview replan</button>
              <button
                type="button"
                disabled={!canAdopt}
                onClick={() => {
                  const currentPreview = state.preview;
                  if (!currentPreview) {
                    return;
                  }
                  runOrderControl(
                    () => store.adoptOrderDraft(
                      currentPreview.id,
                      state.revision,
                      undefined,
                      "page",
                    ),
                    "Order plan adopted",
                  );
                }}
              >
                Adopt order plan
              </button>
              <button
                type="button"
                disabled={!state.undoAvailable}
                onClick={() => runOrderControl(
                  () => store.undoAdoption(state.revision, "page"),
                  "Order adoption undone",
                )}
              >
                Undo adoption
              </button>
              <button
                type="button"
                disabled={!hasPreview}
                className="text-button"
                onClick={() => runOrderControl(
                  () => store.discardPreview(state.revision, "page"),
                  "Order preview discarded",
                )}
              >
                Discard preview
              </button>
            </div>
            <p>Nothing is sent to a supplier from this page.</p>
            <p className="field-error" role={orderControlError ? "alert" : undefined}>{orderControlError}</p>
            <p className="field-status" role={orderControlNotice ? "status" : undefined}>{orderControlNotice}</p>
            <button type="button" className="secondary-button" onClick={downloadOrderSheet}>Download order sheet (CSV)</button>
            <form className="handoff-form" onSubmit={saveHandoff} noValidate>
              <p className="panel-step">Step 3</p>
              <label htmlFor="handoff-summary">Handoff summary</label>
              <textarea
                id="handoff-summary"
                aria-describedby="handoff-error"
                aria-invalid={handoffError ? "true" : undefined}
                maxLength={1000}
                onChange={(event) => {
                  setHandoffSummary(event.target.value);
                  if (handoffError) {
                    setHandoffError("");
                  }
                }}
                placeholder="Morning manager: check the working order before cutoff."
                required
                rows={3}
                value={handoffSummary}
              />
              <button type="submit">Save handoff receipt</button>
              <p id="handoff-error" className="field-error" role={handoffError ? "alert" : undefined}>{handoffError}</p>
            </form>
          </section>
          <ActivityPanel state={state} status={status} />
          {state.lastReceipt ? <HandoffReceiptPanel receipt={state.lastReceipt} /> : null}
        </div>
          </>
        )}

        <footer className="app-footer">
          <nav aria-label="Project links">
            <a href="/trajectory">How this was built</a>
            <a href="https://github.com/rutts29/cutoff-webmcp" rel="noreferrer">GitHub repository</a>
            <button className="text-button" type="button" onClick={() => void copyDemoPrompt()}>Copy demo prompt</button>
          </nav>
          <p className="copy-notice" aria-live="polite">{promptNotice}</p>
        </footer>
      </div>
    </main>
  );
}
