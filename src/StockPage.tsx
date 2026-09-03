import { type FormEvent, useEffect, useState } from "react";

import { WASTE_REASONS, type CountedStockItem, type WasteReason } from "./domain/stock";
import { summarizeSkuWaste, summarizeWaste } from "./engine/stockEngine";
import type { ReviewState, ReviewStore } from "./store/reviewStore";
import { StockItemThumbnail } from "./VisualIdentity";

type StockPageProps = Readonly<{
  state: ReviewState;
  store: ReviewStore;
  openOrder: () => void;
}>;

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function formatCountedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(date);
}

function isWasteReason(value: string): value is WasteReason {
  return WASTE_REASONS.some((candidate) => candidate === value);
}

function StockCountRow({
  item,
  state,
  store,
}: Readonly<{
  item: CountedStockItem;
  state: ReviewState;
  store: ReviewStore;
}>) {
  const [onHand, setOnHand] = useState(String(item.onHand));
  const [expiring, setExpiring] = useState(String(item.expiring));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const waste = summarizeSkuWaste(state.stock.wasteLedger, item.id);
  const errorId = `stock-count-error-${item.id}`;

  useEffect(() => {
    setOnHand(String(item.onHand));
    setExpiring(String(item.expiring));
  }, [item.onHand, item.expiring]);

  const record = () => {
    setNotice("");
    const nextOnHand = Number(onHand);
    const nextExpiring = Number(expiring);
    if (
      !Number.isFinite(nextOnHand) ||
      !Number.isFinite(nextExpiring) ||
      nextOnHand < 0 ||
      nextExpiring < 0 ||
      nextOnHand > 100_000 ||
      nextExpiring > 100_000
    ) {
      setError("Enter stock quantities from 0 to 100,000");
      return;
    }
    if (nextExpiring > nextOnHand) {
      setError("Expiring stock cannot exceed on hand");
      return;
    }
    const result = store.recordStockCount(
      item.id,
      nextOnHand,
      nextExpiring,
      state.revision,
      "page",
    );
    setError(result.ok ? "" : "The stock count changed. Review it and try again");
    if (result.ok) {
      setNotice(`${item.name} count recorded`);
    }
  };

  return (
    <tr>
      <th scope="row">
        <span className="item-identity">
          <StockItemThumbnail skuId={item.id} />
          <span className="item-identity-copy">
            <span>{item.name}</span>
            <small className="mono">{item.unit}</small>
          </span>
        </span>
      </th>
      <td>
        <input
          aria-label={`${item.name} on hand`}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          max="100000"
          min="0"
          step="any"
          type="number"
          value={onHand}
          onChange={(event) => {
            setOnHand(event.target.value);
            setError("");
            setNotice("");
          }}
        />
      </td>
      <td>
        <input
          aria-label={`${item.name} expiring`}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          max="100000"
          min="0"
          step="any"
          type="number"
          value={expiring}
          onChange={(event) => {
            setExpiring(event.target.value);
            setError("");
            setNotice("");
          }}
        />
      </td>
      <td className="mono counted-at">{formatCountedAt(item.lastCountedAt)}</td>
      <td className="mono">{waste.quantity}</td>
      <td className="mono">{formatMoney(waste.cost)}</td>
      <td>
        <button
          type="button"
          aria-label={`Record ${item.name} count`}
          onClick={record}
        >
          Record
        </button>
        <span
          className="field-error row-error"
          id={errorId}
          role={error ? "alert" : undefined}
        >
          {error}
        </span>
        {notice ? <span className="field-status row-status" role="status">{notice}</span> : null}
      </td>
    </tr>
  );
}

function WasteSummaryPanel({ state }: Readonly<{ state: ReviewState }>) {
  const summary = summarizeWaste(state.stock.wasteLedger);
  const maximum = Math.max(...Object.values(summary.byReason), 1);

  return (
    <aside className="waste-summary-panel" aria-label="Waste this week">
      <p className="eyebrow">Waste this week</p>
      <h2>{formatMoney(summary.totalCost)}</h2>
      <p className="waste-top-reason">
        {`Top reason: ${summary.topReason ?? "none"}`}
      </p>
      <ul className="waste-bars">
        {WASTE_REASONS.map((reason) => (
          <li key={reason}>
            <span>{reason}</span>
            <span className="waste-track" aria-hidden="true">
              <span
                className="waste-fill"
                style={{ width: `${(summary.byReason[reason] / maximum) * 100}%` }}
              />
            </span>
            <strong className="mono">{formatMoney(summary.byReason[reason])}</strong>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function WasteForm({
  state,
  store,
}: Readonly<{ state: ReviewState; store: ReviewStore }>) {
  const [skuId, setSkuId] = useState(state.stock.items[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<WasteReason>("expired");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const quantityError = error === "Enter a waste quantity above 0 and no more than 100,000";
  const errorId = "waste-form-error";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || parsedQuantity > 100_000) {
      setError("Enter a waste quantity above 0 and no more than 100,000");
      return;
    }
    const result = store.logWaste(
      skuId,
      parsedQuantity,
      reason,
      note.trim() || undefined,
      state.revision,
      "page",
    );
    if (!result.ok) {
      setError("The stock record changed. Review it and try again");
      return;
    }
    setQuantity("1");
    setNote("");
    setError("");
    const itemName = state.stock.items.find((item) => item.id === skuId)?.name ?? "Stock";
    setNotice(`${itemName} waste recorded`);
  };

  return (
    <section className="waste-form-panel" aria-labelledby="waste-form-heading">
      <p className="panel-step">Step 2</p>
      <p className="eyebrow">Waste log</p>
      <h2 id="waste-form-heading">Record what left the shelf</h2>
      <form onSubmit={submit} noValidate>
        <label>
          Waste item
          <select
            aria-label="Waste item"
            value={skuId}
            onChange={(event) => setSkuId(event.target.value)}
          >
            {state.stock.items.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          Waste quantity
          <input
            aria-label="Waste quantity"
            aria-describedby={quantityError ? errorId : undefined}
            aria-invalid={quantityError ? true : undefined}
            max="100000"
            min="0.01"
            step="any"
            type="number"
            value={quantity}
            onChange={(event) => {
              setQuantity(event.target.value);
              setError("");
              setNotice("");
            }}
          />
        </label>
        <label>
          Waste reason
          <select
            aria-label="Waste reason"
            value={reason}
            onChange={(event) => {
              const value = event.target.value;
              if (isWasteReason(value)) {
                setReason(value);
              }
            }}
          >
            {WASTE_REASONS.map((candidate) => (
              <option key={candidate} value={candidate}>{candidate}</option>
            ))}
          </select>
        </label>
        <label className="waste-note-field">
          Note
          <input
            aria-label="Waste note"
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <button type="submit">Log waste</button>
      </form>
      <p className="field-error" id={errorId} role={error ? "alert" : undefined}>{error}</p>
      {notice ? <p className="field-status" role="status">{notice}</p> : null}
    </section>
  );
}

export function StockPage({ state, store, openOrder }: StockPageProps) {
  return (
    <div className="stock-page-grid">
      <section className="stock-count-panel" aria-labelledby="stock-count-heading">
        <div className="section-heading">
          <div>
            <p className="panel-step">Step 1</p>
            <p className="eyebrow">Count sheet</p>
            <h2 id="stock-count-heading">Walk-in and dry store</h2>
          </div>
          <p className="mono section-note">10 items · revision {state.revision}</p>
        </div>
        <div className="table-scroll">
          <table className="stock-count-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">On hand</th>
                <th scope="col">Expiring</th>
                <th scope="col">Last counted</th>
                <th scope="col">Waste qty</th>
                <th scope="col">Waste cost</th>
                <th scope="col">Record</th>
              </tr>
            </thead>
            <tbody>
              {state.stock.items.map((item) => (
                <StockCountRow
                  key={item.id}
                  item={item}
                  state={state}
                  store={store}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <WasteSummaryPanel state={state} />
      <WasteForm state={state} store={store} />

      {state.orderPreviewStaleReason ? (
        <section className="stale-order-panel" role="status">
          <p className="panel-step">Step 3</p>
          <p className="eyebrow">Shared order</p>
          <h2>Order preview needs a refresh</h2>
          <p>{state.orderPreviewStaleReason}</p>
          <button type="button" onClick={openOrder}>Open Order</button>
        </section>
      ) : (
        <section className="stock-order-status">
          <p className="panel-step">Step 3</p>
          <p className="eyebrow">Shared order</p>
          <h2>Counts feed the next order preview</h2>
          <p>Open Order to review the revised cases and cost.</p>
          <button type="button" onClick={openOrder}>Open Order</button>
        </section>
      )}
    </div>
  );
}
