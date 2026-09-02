import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { SEED_ITEMS } from "./data/seed";
import type { LocalSignal, ReasonCode, StockItem } from "./domain/types";
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
}>;

type SignalKind = "booking" | "event_cancelled" | "operator_note";

const defaultStatus: WebMCPStatus = {
  supported: false,
  toolCount: 0,
  error: null,
};

const DEMO_PROMPT =
  "The derby has been cancelled. Add that to the order review and replan, but keep my booking.";

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
  const item = SEED_ITEMS.find((candidate) => candidate.id === state.focusedSkuId);
  const [quantity, setQuantity] = useState("");

  useEffect(() => {
    if (!item) {
      setQuantity("");
      return;
    }
    setQuantity(String(state.pins.lineOverrides[item.id] ?? lineCases(state, item.id)));
  }, [item, state.pins.lineOverrides, state.draft.plan.lines]);

  if (!item) {
    return (
      <aside id="numbers" className="detail-panel empty-detail" aria-label="Stock line math">
        <p className="eyebrow">Stock line math</p>
        <p>Select a line to inspect its order math and pin a quantity.</p>
      </aside>
    );
  }

  const covers = state.preview?.covers.after ?? state.draft.plan.covers;
  const demand = covers * item.usagePerCover;
  const usable = Math.max(0, item.onHand - item.expiring);
  const need = demand * (1 + item.safety) - usable - item.inTransit;
  const pin = state.pins.lineOverrides[item.id];
  const previewLine = state.preview?.lines.find((line) => line.skuId === item.id);
  const reason = previewLine?.reason ?? state.draft.reasons[item.id] ?? "UNCHANGED";

  const pinQuantity = () => {
    const parsed = Number(quantity);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return;
    }
    store.pinLineQuantity(item.id, parsed, state.revision, "human");
  };

  return (
    <aside id="numbers" className="detail-panel" aria-label={`${item.name} stock line math`}>
      <div className="detail-heading">
        <div>
          <p className="eyebrow">Stock line math</p>
          <h2>{item.name}</h2>
          <p className="mono item-id">{item.id} / {item.unit} / case {item.caseSize}</p>
        </div>
        <span className="reason-chip">{reasonLabel(reason)}</span>
      </div>
      <div className="formula" aria-label="Filled order formula">
        <p><span>demand</span><code>{formatNumber(covers)} × {item.usagePerCover} = {demand.toFixed(2)}</code></p>
        <p><span>need</span><code>{demand.toFixed(2)} × {(1 + item.safety).toFixed(2)} − ({item.onHand} − {item.expiring}) − {item.inTransit} = {need.toFixed(2)}</code></p>
        <p><span>cases</span><code>max(0, ceil({need.toFixed(2)} / {item.caseSize})) = {previewLine?.afterCases ?? lineCases(state, item.id)}</code></p>
      </div>
      <p className="safety-note"><strong>{Math.round(item.safety * 100)}% safety.</strong> Running out costs more margin than the waste.</p>
      <div className="pin-control">
        <label htmlFor={`pin-${item.id}`}>Pin quantity</label>
        <div>
          <input
            id={`pin-${item.id}`}
            aria-label={`${item.name} quantity pin`}
            inputMode="numeric"
            min="0"
            step="1"
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <button type="button" onClick={pinQuantity}>Pin quantity</button>
        </div>
        {pin !== undefined ? <button className="text-button" type="button" onClick={() => store.removeLinePin(item.id, state.revision, "human")}>Remove pin</button> : null}
      </div>
    </aside>
  );
}

function OrderSheet({ state, store }: Readonly<{ state: ReviewState; store: ReviewStore }>) {
  const selectLine = (skuId: string) => {
    if (state.focusedSkuId !== skuId) {
      store.focusSku(skuId, state.revision, "human");
    }
  };
  return (
    <section className="sheet-panel" aria-labelledby="sheet-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Supplier order sheet</p>
          <h2 id="sheet-heading">Stock lines for Sat 5 Sep</h2>
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
            {SEED_ITEMS.map((item) => {
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
                      <span>{item.name}</span>
                      <small className="mono">{item.id}</small>
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

  const addSignal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanLabel = label.trim();
    if (!cleanLabel) {
      setLabelError("Give the signal a label");
      return;
    }
    if (kind === "booking") {
      const parsedCovers = Number(covers);
      if (!Number.isInteger(parsedCovers) || parsedCovers < 1) {
        return;
      }
      store.addLocalSignal({ kind, label: cleanLabel, covers: parsedCovers }, state.revision, "human");
    } else {
      store.addLocalSignal({ kind, label: cleanLabel }, state.revision, "human");
    }
    setLabel("");
    setLabelError("");
  };

  return (
    <section className="signals-panel" aria-labelledby="signals-heading">
      <div className="section-heading">
        <div>
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
          <input aria-label="Booking covers" type="number" min="1" value={covers} onChange={(event) => setCovers(event.target.value)} />
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
              onClick={() => store.removeBookingPin(signal.id, state.revision, "human")}
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
              onClick={() => store.removeLinePin(skuId, state.revision, "human")}
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
          <h2 id="activity-heading">Order review activity</h2>
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
      {status.supported ? (
        <p className="agent-tools-status" role="status" aria-live="polite">
          {status.toolCount} agent tools available on this page
        </p>
      ) : null}
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

export function App({ store: providedStore, modelContext }: AppProps) {
  const ownedStore = useMemo(() => createReviewStore(), []);
  const store = providedStore ?? ownedStore;
  const state = useReviewState(store);
  const [status, setStatus] = useState<WebMCPStatus>(defaultStatus);
  const [handoffSummary, setHandoffSummary] = useState("");
  const [handoffError, setHandoffError] = useState("");
  const [promptNotice, setPromptNotice] = useState("");

  useEffect(() => {
    const mount = mountWebMCPTools({ store, modelContext, onStatus: setStatus });
    return mount.cleanup;
  }, [store, modelContext]);

  const forecastAfter = state.preview?.covers.after ?? state.draft.plan.covers;
  const laborAfter = state.preview?.laborHours.after ?? state.draft.plan.laborHours;
  const costAfter = state.preview?.totals.afterCost ?? state.draft.plan.totalCost;
  const hasPreview = state.preview !== null;
  const canAdopt =
    state.preview !== null && state.preview.baseRevision === state.revision;
  const preview = () => store.previewOrderPlan("Manual preview from the order sheet.", state.revision, "human");
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
      "human",
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

  return (
    <main className="app-shell">
      <aside className="cutoff-rail" aria-label="Supplier cutoff">
        <span>Cutoff</span>
        <strong>22:00</strong>
        <span>Fri 4 Sep</span>
      </aside>
      <div className="paper">
        <header className="app-header">
          <div>
            <div className="header-kicker">
              <p className="eyebrow">Restaurant supplier order · synthetic data</p>
              <span className="synthetic-tag">Synthetic</span>
            </div>
            <h1>Cutoff</h1>
            <p className="hero-copy">Revise the supplier order when the forecast is wrong. Covers, labor hours, and stock cases for one location before cutoff.</p>
            <p className="header-subtitle">Northgate · service Sat 5 Sep · delivery 06:30</p>
          </div>
          <div className="header-actions">
            <button className="text-button reset-button" type="button" onClick={() => store.resetDemo("human")}>Reset demo</button>
          </div>
        </header>

        <p className="demo-banner">Synthetic demo data. One fictional restaurant, ten stock items. No supplier is connected.</p>

        <section className="forecast-strip" aria-label="Forecast and order summary">
          <div><p className="eyebrow">Forecast covers</p><strong className="big-number">{formatNumber(state.savedPlan.covers)} <span className="metric-arrow">→</span> <span key={`${state.revision}-${forecastAfter}`} className={forecastAfter === state.savedPlan.covers ? "metric-current" : "metric-current changed-cell"}>{formatNumber(forecastAfter)}</span></strong><small>covers</small></div>
          <div><p className="eyebrow">Labor hours</p><strong className="big-number">{state.savedPlan.laborHours} <span className="metric-arrow">→</span> <span key={`${state.revision}-${laborAfter}`} className={laborAfter === state.savedPlan.laborHours ? "metric-current" : "metric-current changed-cell"}>{laborAfter}</span></strong><small>hours</small></div>
          <div><p className="eyebrow">Supplier order cost</p><strong className="big-number">{formatNumber(state.savedPlan.totalCost)} <span className="metric-arrow">→</span> <span key={`${state.revision}-${costAfter}`} className={costAfter === state.savedPlan.totalCost ? "metric-current" : "metric-current changed-cell"}>{formatNumber(costAfter)}</span></strong><small>units</small></div>
          <div className="forecast-notes"><p>Base 830</p><p>Derby uplift +310</p><p>Pinned bookings +{state.preview?.covers.pinnedBookings ?? 0}</p></div>
        </section>

        <div className="main-grid">
          <OrderSheet state={state} store={store} />
          <DetailPanel state={state} store={store} />
          <SignalForm state={state} store={store} />
          <section className="controls-panel" aria-label="Order plan">
            <p className="eyebrow">Order plan</p>
            <div className="control-buttons">
              <button type="button" onClick={preview}>Preview replan</button>
              <button type="button" disabled={!canAdopt} onClick={() => state.preview && store.adoptOrderDraft(state.preview.id, state.revision, undefined, "human")}>Adopt order plan</button>
              <button type="button" disabled={!state.undoAvailable} onClick={() => store.undoAdoption(state.revision, "human")}>Undo adoption</button>
              <button type="button" disabled={!hasPreview} className="text-button" onClick={() => store.discardPreview(state.revision, "human")}>Discard preview</button>
            </div>
            {state.preview ? (
              <p className="preview-status" role="status" aria-live="polite">
                Preview ready: {formatNumber(state.preview.covers.after)} covers, {state.preview.laborHours.after} labor hours, {formatNumber(state.preview.totals.afterCost)} units.
              </p>
            ) : null}
            <p>Nothing is sent to a supplier from this page.</p>
            <form className="handoff-form" onSubmit={saveHandoff} noValidate>
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

        <footer className="app-footer">
          <nav aria-label="Project links">
            <a href="/trajectory">How this was built</a>
            <a href="https://github.com/rutts29/cutoff-webmcp" rel="noreferrer">GitHub repository</a>
            <a href="#numbers">How the numbers work</a>
            <button className="text-button" type="button" onClick={() => void copyDemoPrompt()}>Copy demo prompt</button>
          </nav>
          <p className="copy-notice" aria-live="polite">{promptNotice}</p>
        </footer>
      </div>
    </main>
  );
}
