import { type MouseEvent, useEffect, useRef } from "react";

import { getPreset } from "./data/presets";
import { type LaborDaypart } from "./domain/labor";
import { pathForSection, type Section } from "./domain/sections";
import { WASTE_REASONS, type WasteReason } from "./domain/stock";
import { getLaborPlan } from "./engine/laborEngine";
import {
  getActiveEventCovers,
  getPinnedBookingCovers,
} from "./engine/orderEngine";
import { summarizeWaste } from "./engine/stockEngine";
import type { ReviewState } from "./store/reviewStore";

type ServiceBandProps = Readonly<{
  state: ReviewState;
  navigate?: (section: Section) => void;
}>;

type AttentionItem = Readonly<{
  label: string;
  section: Section;
}>;

const DAYPART_LABELS = {
  lunch: "Lunch",
  dinner: "Dinner",
  prep: "Prep",
} as const satisfies Record<LaborDaypart, string>;

const WASTE_REASON_LABELS = {
  expired: "expired",
  overproduction: "overproduction",
  prep: "prep",
  dropped: "dropped",
} as const satisfies Record<WasteReason, string>;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

export function formatLaborGap(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function laborVarianceClass(value: number): string {
  const absolute = Math.abs(value);
  if (absolute < 1) {
    return "variance-neutral";
  }
  return absolute <= 4 ? "variance-moderate" : "variance-critical";
}

export function LaborBars({
  required,
  scheduled,
}: Readonly<{
  required: number;
  scheduled: number;
}>) {
  const maximum = Math.max(required, scheduled, 1);

  return (
    <div
      className="labor-bars"
      aria-label={`Required ${required} hours, scheduled ${scheduled} hours`}
    >
      <div>
        <span>Required {required}h</span>
        <span className="labor-bar-track" aria-hidden="true">
          <span
            className="labor-bar-fill is-required"
            style={{ width: `${(required / maximum) * 100}%` }}
          />
        </span>
      </div>
      <div>
        <span>Scheduled {scheduled}h</span>
        <span className="labor-bar-track" aria-hidden="true">
          <span
            className="labor-bar-fill is-scheduled"
            style={{ width: `${(scheduled / maximum) * 100}%` }}
          />
        </span>
      </div>
    </div>
  );
}

function DeltaNumber({
  value,
  children,
  className = "",
}: Readonly<{
  value: number;
  children: string;
  className?: string;
}>) {
  const previousValue = useRef(value);
  const changed = previousValue.current !== value;

  useEffect(() => {
    previousValue.current = value;
  }, [value]);

  return (
    <strong className={`service-number ${changed ? "changed-cell" : ""} ${className}`.trim()}>
      {children}
    </strong>
  );
}

function buildAttentionItems(
  state: ReviewState,
  dayparts: ReturnType<typeof getLaborPlan>["dayparts"],
): readonly AttentionItem[] {
  const attention: AttentionItem[] = [];

  if (state.pendingOrderChanges > 0) {
    attention.push({
      label: `${state.pendingOrderChanges} ${state.pendingOrderChanges === 1 ? "change" : "changes"} not previewed`,
      section: "order",
    });
  }
  if (state.orderPreviewStaleReason) {
    attention.push({ label: "Order preview is stale", section: "order" });
  }
  if (state.laborPreviewStaleReason) {
    attention.push({ label: "Labor preview is stale", section: "labor" });
  }

  for (const daypart of dayparts) {
    if (Math.abs(daypart.gap) <= 4) {
      continue;
    }
    attention.push({
      label: `${DAYPART_LABELS[daypart.id]} ${daypart.gap > 0 ? "over" : "under"} by ${Math.abs(daypart.gap)}h`,
      section: "labor",
    });
  }

  const expiringLineCount = state.stock.items.filter(
    (item) => item.expiring > 0,
  ).length;
  if (expiringLineCount > 0) {
    attention.push({
      label: `${expiringLineCount} ${expiringLineCount === 1 ? "line" : "lines"} with expiring stock`,
      section: "stock",
    });
  }

  return attention;
}

function shouldHandleNavigation(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function ServiceBand({ state, navigate }: ServiceBandProps) {
  const preset = getPreset(state.presetId);
  const currentPreview = state.orderPreviewStaleReason ? null : state.preview;
  const isPreview = currentPreview !== null;
  const covers = currentPreview?.covers.after ?? state.draft.plan.covers;
  const orderCost = currentPreview?.totals.afterCost ?? state.draft.plan.totalCost;
  const orderLines = currentPreview?.lines ?? state.draft.plan.lines;
  const totalCases = orderLines.reduce(
    (total, line) => total + ("afterCases" in line ? line.afterCases : line.cases),
    0,
  );
  const bookingCovers = getPinnedBookingCovers(
    state.signals,
    state.pins,
  );
  const totalEventCovers = state.eventUplifts.reduce(
    (total, uplift) => total + uplift.covers,
    0,
  );
  const eventCovers = getActiveEventCovers(
    state.eventUplifts,
    state.signals,
  );
  const coversBreakdown = {
    base: state.baseCovers,
    eventUplift: eventCovers,
    pinnedBookings: bookingCovers,
  };
  const derivedCovers =
    coversBreakdown.base +
    coversBreakdown.eventUplift +
    coversBreakdown.pinnedBookings;
  const breakdownMatchesDisplayedCovers = derivedCovers === covers;
  const eventWasCancelled = eventCovers < totalEventCovers;
  const laborPlan = getLaborPlan({
    state: state.labor,
    forecastCovers: state.draft.plan.covers,
  });
  const scheduledHours = laborPlan.dayparts.reduce(
    (total, daypart) => total + daypart.scheduled,
    0,
  );
  const laborGap = scheduledHours - laborPlan.requiredTotal;
  const waste = summarizeWaste(state.stock.wasteLedger);
  const attention = buildAttentionItems(state, laborPlan.dayparts);
  const costPerCover = covers > 0 ? orderCost / covers : 0;
  const eventLabel = preset.id === "saturday" ? "derby" : "events";
  const topWasteReason = waste.topReason;

  return (
    <section id="service-band" className="service-band" aria-label="Tonight's service">
      <article className="service-tile">
        <p className="service-label">Covers</p>
        <DeltaNumber value={covers}>{formatNumber(covers)}</DeltaNumber>
        <p className="service-comparison">
          {breakdownMatchesDisplayedCovers ? (
            <>
              {isPreview ? `preview ${formatNumber(covers)} · ` : ""}
              saved {formatNumber(state.savedPlan.covers)} · base {formatNumber(coversBreakdown.base)} + {eventLabel} {formatNumber(coversBreakdown.eventUplift)}{eventWasCancelled ? " (cancelled)" : ""} + bookings {formatNumber(coversBreakdown.pinnedBookings)}
            </>
          ) : (
            `saved ${formatNumber(state.savedPlan.covers)} · ${state.signals.length} ${state.signals.length === 1 ? "signal" : "signals"} recorded, not in working order`
          )}
        </p>
      </article>

      <article className="service-tile">
        <p className="service-label">Labor</p>
        <DeltaNumber value={scheduledHours}>{formatNumber(scheduledHours)}</DeltaNumber>
        <p className="service-comparison labor-comparison">
          <span>required {laborPlan.requiredTotal} · </span>
          <span className={`labor-gap ${laborVarianceClass(laborGap)}`}>
            gap {formatLaborGap(laborGap)}
          </span>
        </p>
        <LaborBars required={laborPlan.requiredTotal} scheduled={scheduledHours} />
      </article>

      <article className="service-tile">
        <p className="service-label">Order cost</p>
        <DeltaNumber value={orderCost}>{formatNumber(orderCost)}</DeltaNumber>
        <p className="service-comparison">
          {isPreview ? `preview ${formatNumber(orderCost)} · ` : ""}{formatMoney(costPerCover)} per cover · {formatNumber(totalCases)} cases across {orderLines.length} lines · no sales feed
        </p>
      </article>

      <article className="service-tile">
        <p className="service-label">Waste this week</p>
        <DeltaNumber value={waste.totalCost}>{formatMoney(waste.totalCost)}</DeltaNumber>
        <p className="service-comparison">
          {topWasteReason
            ? `top reason: ${WASTE_REASON_LABELS[topWasteReason]} ${formatMoney(waste.byReason[topWasteReason])}`
            : "top reason: none"}
        </p>
        <div
          className="waste-stack"
          aria-label={WASTE_REASONS.map(
            (reason) => `${WASTE_REASON_LABELS[reason]} ${formatMoney(waste.byReason[reason])}`,
          ).join(", ")}
        >
          {WASTE_REASONS.map((reason) => (
            <span
              key={reason}
              className={`waste-stack-segment waste-${reason}`}
              style={{
                width: `${waste.totalCost > 0 ? (waste.byReason[reason] / waste.totalCost) * 100 : 0}%`,
              }}
              title={`${WASTE_REASON_LABELS[reason]} ${formatMoney(waste.byReason[reason])}`}
            />
          ))}
        </div>
      </article>

      <article className="service-tile service-attention">
        <p className="service-label">Needs attention</p>
        <DeltaNumber value={attention.length} className="service-attention-count">
          {formatNumber(attention.length)}
        </DeltaNumber>
        {attention.length === 0 ? (
          <p className="service-comparison">Nothing outstanding</p>
        ) : (
          <ul className="attention-list">
            {attention.slice(0, 3).map((item) => (
              <li key={`${item.section}-${item.label}`}>
                <a
                  href={pathForSection(item.section)}
                  onClick={(event) => {
                    if (!navigate || !shouldHandleNavigation(event)) {
                      return;
                    }
                    event.preventDefault();
                    navigate(item.section);
                  }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
