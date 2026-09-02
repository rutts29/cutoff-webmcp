import { describe, expect, it } from 'vitest';

import { SEED_COVERS, SEED_ITEMS } from '../data/seed';
import {
  calculatePlan,
  createOrderPreview,
  getUsableStock,
  REASON_CODES,
} from './orderEngine';

const eventUplifts = [{ id: 'derby-match', covers: 310 }];

type BookingSignal = {
  id: string;
  kind: 'booking';
  label: string;
  covers: number;
  source: 'human';
  addedAt: string;
};

type CancellationSignal = {
  id: string;
  kind: 'event_cancelled';
  label: string;
  source: 'agent';
  addedAt: string;
};

const bookingSignal: BookingSignal = {
  id: 'booking-1',
  kind: 'booking',
  label: 'Private booking, 80 guests, 18:30',
  covers: 80,
  source: 'human',
  addedAt: '2026-09-02T12:00:00.000Z',
};

const cancellationSignal: CancellationSignal = {
  id: 'cancel-1',
  kind: 'event_cancelled',
  label: 'Derby match cancelled',
  source: 'agent',
  addedAt: '2026-09-02T12:01:00.000Z',
};

function savedPlan() {
  return calculatePlan({ items: SEED_ITEMS, covers: SEED_COVERS });
}

function preview(options: {
  signals: (typeof bookingSignal | typeof cancellationSignal)[];
  lineOverrides?: Readonly<Record<string, number>>;
}) {
  return createOrderPreview({
    savedPlan: savedPlan(),
    items: SEED_ITEMS,
    baseCovers: 830,
    eventUplifts,
    signals: options.signals,
    pins: {
      bookingIds: ['booking-1'],
      lineOverrides: options.lineOverrides ?? {},
    },
    id: 'preview-1',
    baseRevision: 1,
  });
}

function lineForSku<Line extends { skuId: string }>(
  lines: readonly Line[],
  skuId: string,
): Line {
  const line = lines.find((candidate) => candidate.skuId === skuId);
  if (!line) {
    throw new Error(`Expected a line for ${skuId}`);
  }
  return line;
}

describe('order engine', () => {
  it('loads the ten locked seed inputs', () => {
    expect(SEED_COVERS).toBe(1140);
    expect(SEED_ITEMS).toHaveLength(10);
    expect(
      SEED_ITEMS.map(
        ({
          id,
          name,
          unit,
          caseSize,
          usagePerCover,
          onHand,
          inTransit,
          expiring,
          safety,
          perishable,
          costPerCase,
        }) => ({
          id,
          name,
          unit,
          caseSize,
          usagePerCover,
          onHand,
          inTransit,
          expiring,
          safety,
          perishable,
          costPerCase,
        }),
      ),
    ).toStrictEqual([
      { id: 'chicken', name: 'Chicken thighs', unit: 'kg', caseSize: 10, usagePerCover: 0.18, onHand: 42, inTransit: 0, expiring: 6, safety: 0.1, perishable: true, costPerCase: 68 },
      { id: 'patties', name: 'Beef patties 150g', unit: 'ea', caseSize: 80, usagePerCover: 0.62, onHand: 190, inTransit: 0, expiring: 0, safety: 0.1, perishable: true, costPerCase: 96 },
      { id: 'buns', name: 'Brioche buns', unit: 'ea', caseSize: 48, usagePerCover: 0.62, onHand: 180, inTransit: 96, expiring: 24, safety: 0.05, perishable: true, costPerCase: 19 },
      { id: 'fries', name: 'Fries 2.5kg bags', unit: 'kg', caseSize: 12.5, usagePerCover: 0.15, onHand: 40, inTransit: 0, expiring: 0, safety: 0.1, perishable: false, costPerCase: 21 },
      { id: 'lettuce', name: 'Iceberg lettuce', unit: 'head', caseSize: 12, usagePerCover: 0.02, onHand: 9, inTransit: 0, expiring: 4, safety: 0.05, perishable: true, costPerCase: 14 },
      { id: 'tomatoes', name: 'Tomatoes', unit: 'kg', caseSize: 5, usagePerCover: 0.03, onHand: 7, inTransit: 0, expiring: 3, safety: 0.05, perishable: true, costPerCase: 11 },
      { id: 'cheese', name: 'Cheddar slices', unit: 'ea', caseSize: 200, usagePerCover: 0.7, onHand: 320, inTransit: 200, expiring: 0, safety: 0.05, perishable: true, costPerCase: 24 },
      { id: 'cola', name: 'Cola syrup BIB', unit: 'L', caseSize: 18.9, usagePerCover: 0.25, onHand: 30, inTransit: 0, expiring: 0, safety: 0.1, perishable: false, costPerCase: 58 },
      { id: 'oil', name: 'Fryer oil', unit: 'L', caseSize: 20, usagePerCover: 0.012, onHand: 25, inTransit: 0, expiring: 0, safety: 0.05, perishable: false, costPerCase: 32 },
      { id: 'boxes', name: 'Fry boxes', unit: 'ea', caseSize: 500, usagePerCover: 0.8, onHand: 600, inTransit: 0, expiring: 0, safety: 0.05, perishable: false, costPerCase: 27 },
    ]);
  });

  it('calculates the saved 1,140-cover plan exactly', () => {
    const plan = savedPlan();

    expect(plan.covers).toBe(1140);
    expect(plan.laborHours).toBe(95);
    expect(plan.lines.map((line) => line.cases)).toStrictEqual([19, 8, 11, 12, 2, 7, 2, 16, 0, 1]);
    expect(plan.totalCost).toBe(3629);
  });

  it('recomputes the preview for a pinned booking and cancelled event', () => {
    const result = preview({ signals: [bookingSignal, cancellationSignal] });

    expect(result.covers).toStrictEqual({
      before: 1140,
      after: 910,
      base: 830,
      eventUplift: 0,
      pinnedBookings: 80,
    });
    expect(result.laborHours).toStrictEqual({ before: 95, after: 76 });
    expect(result.lines.map((line) => line.afterCases)).toStrictEqual([15, 6, 8, 9, 2, 5, 1, 12, 0, 1]);
    expect(result.totals.afterCost).toBe(2767);
  });

  it('does not apply a booking that is absent when the event is cancelled', () => {
    const result = preview({ signals: [cancellationSignal] });

    expect(result.covers.after).toBe(830);
    expect(result.laborHours.after).toBe(70);
  });

  it('keeps a pinned lettuce override and prices it into the preview', () => {
    const result = preview({
      signals: [bookingSignal, cancellationSignal],
      lineOverrides: { lettuce: 4 },
    });
    const lettuce = lineForSku(result.lines, 'lettuce');

    expect(lettuce.afterCases).toBe(4);
    expect(lettuce.reason).toBe(REASON_CODES.MANUAL_OVERRIDE_KEPT);
    expect(result.totals.afterCost).toBe(2795);
  });

  it('gives each preview line one allowed primary reason', () => {
    const result = preview({ signals: [bookingSignal, cancellationSignal] });
    const allowedReasons = Object.values(REASON_CODES);

    for (const line of result.lines) {
      expect(Object.keys(line).filter((key) => key === 'reason')).toHaveLength(1);
      expect(line.reason).toBeTypeOf('string');
      expect(allowedReasons).toContain(line.reason);
    }
  });

  it('excludes expiring chicken stock and never orders negative oil', () => {
    const chicken = SEED_ITEMS.find((item) => item.id === 'chicken');
    if (!chicken) {
      throw new Error('Expected chicken in the seed data');
    }

    const savedOil = lineForSku(savedPlan().lines, 'oil');
    const previewOil = lineForSku(
      preview({ signals: [bookingSignal, cancellationSignal] }).lines,
      'oil',
    );

    expect(getUsableStock(chicken)).toBe(36);
    expect(savedOil.cases).toBe(0);
    expect(previewOil.afterCases).toBe(0);
    expect(savedOil.cases).toBeGreaterThanOrEqual(0);
    expect(previewOil.afterCases).toBeGreaterThanOrEqual(0);
  });
});
