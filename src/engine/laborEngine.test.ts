import { describe, expect, it } from "vitest";

import type { LaborEngineState, LaborShift } from "../domain/labor";
import {
  addLaborSignal,
  adoptLaborPlan,
  calculateLaborRequirement,
  createLaborPreview,
  createSeedLaborState,
  getLaborPlan,
  LABOR_REASONS,
  undoLaborAdoption,
} from "./laborEngine";

function expectSignalSuccess(
  result: ReturnType<typeof addLaborSignal>,
): asserts result is Extract<ReturnType<typeof addLaborSignal>, { ok: true }> {
  expect(result.ok).toBe(true);
}

function expectAdoptSuccess(
  result: ReturnType<typeof adoptLaborPlan>,
): asserts result is Extract<ReturnType<typeof adoptLaborPlan>, { ok: true }> {
  expect(result.ok).toBe(true);
}

function expectUndoSuccess(
  result: ReturnType<typeof undoLaborAdoption>,
): asserts result is Extract<ReturnType<typeof undoLaborAdoption>, { ok: true }> {
  expect(result.ok).toBe(true);
}

function daypart<Value extends { id: string }>(
  value: { dayparts: readonly Value[] },
  id: "lunch" | "dinner" | "prep",
): Value {
  const result = value.dayparts.find((candidate) => candidate.id === id);
  if (!result) {
    throw new Error(`Expected ${id} in the labor result`);
  }
  return result;
}

function shift(
  state: LaborEngineState,
  staffId: string,
): LaborShift {
  const result = state.shifts.find((candidate) => candidate.staffId === staffId);
  if (!result) {
    throw new Error(`Expected labor shift for ${staffId}`);
  }
  return result;
}

describe("labor engine", () => {
  it("calculates the three locked forecast splits", () => {
    expect(calculateLaborRequirement(1_140)).toStrictEqual({
      total: 95,
      lunch: 33,
      dinner: 48,
      prep: 14,
    });
    expect(calculateLaborRequirement(910)).toStrictEqual({
      total: 76,
      lunch: 27,
      dinner: 38,
      prep: 11,
    });
    expect(calculateLaborRequirement(830)).toStrictEqual({
      total: 70,
      lunch: 25,
      dinner: 34,
      prep: 11,
    });
  });

  it("seeds the locked Saturday roster and on-call order", () => {
    const state = createSeedLaborState();

    expect(
      state.shifts.map(({ staffId, name, daypart, hours, status }) => ({
        staffId,
        name,
        daypart,
        hours,
        status,
      })),
    ).toStrictEqual([
      { staffId: "s01", name: "Amara Osei", daypart: "lunch", hours: 9, status: "scheduled" },
      { staffId: "s02", name: "Diego Ruiz", daypart: "lunch", hours: 9, status: "scheduled" },
      { staffId: "s03", name: "Hana Kimura", daypart: "lunch", hours: 9, status: "scheduled" },
      { staffId: "s04", name: "Tom Walsh", daypart: "lunch", hours: 6, status: "scheduled" },
      { staffId: "s05", name: "Priya Nair", daypart: "dinner", hours: 9, status: "scheduled" },
      { staffId: "s06", name: "Marcus Bell", daypart: "dinner", hours: 9, status: "scheduled" },
      { staffId: "s07", name: "Sofia Marino", daypart: "dinner", hours: 8, status: "scheduled" },
      { staffId: "s08", name: "Kwame Mensah", daypart: "dinner", hours: 8, status: "scheduled" },
      { staffId: "s09", name: "Leah Brooks", daypart: "dinner", hours: 8, status: "scheduled" },
      { staffId: "s10", name: "Jonas Weber", daypart: "dinner", hours: 6, status: "scheduled" },
      { staffId: "s11", name: "Rosa Alvarez", daypart: "prep", hours: 7, status: "scheduled" },
      { staffId: "s12", name: "Ben Carter", daypart: "prep", hours: 7, status: "scheduled" },
    ]);
    expect(state.onCall).toStrictEqual([
      { staffId: "oc1", name: "Nadia Haddad" },
      { staffId: "oc2", name: "Sam O'Neill" },
    ]);
    expect(state.revision).toBe(0);
  });

  it("A: keeps the saved roster exact with no actions", () => {
    const result = createLaborPreview({
      state: createSeedLaborState(),
      forecastCovers: 1_140,
      previewId: "labor-preview-a",
    });

    expect(
      result.preview.dayparts.map(
        ({ id, required, scheduledBefore, scheduledAfter, gapBefore, gapAfter, reason, actions }) => ({
          id,
          required,
          scheduledBefore,
          scheduledAfter,
          gapBefore,
          gapAfter,
          reason,
          actions,
        }),
      ),
    ).toStrictEqual([
      {
        id: "lunch",
        required: 33,
        scheduledBefore: 33,
        scheduledAfter: 33,
        gapBefore: 0,
        gapAfter: 0,
        reason: LABOR_REASONS.WITHIN_TOLERANCE,
        actions: [],
      },
      {
        id: "dinner",
        required: 48,
        scheduledBefore: 48,
        scheduledAfter: 48,
        gapBefore: 0,
        gapAfter: 0,
        reason: LABOR_REASONS.WITHIN_TOLERANCE,
        actions: [],
      },
      {
        id: "prep",
        required: 14,
        scheduledBefore: 14,
        scheduledAfter: 14,
        gapBefore: 0,
        gapAfter: 0,
        reason: LABOR_REASONS.WITHIN_TOLERANCE,
        actions: [],
      },
    ]);
    expect(result.preview.totals).toStrictEqual({
      scheduledBefore: 95,
      scheduledAfter: 95,
      required: 95,
      releases: 0,
      covers: 0,
    });
    expect(result.revision).toBe(1);
    expect(result.preview.baseRevision).toBe(1);
  });

  it("B and E: releases only Tom and Jonas for the adopted 910-cover order", () => {
    const result = createLaborPreview({
      state: createSeedLaborState(),
      forecastCovers: 910,
      previewId: "labor-preview-b",
    });

    expect(daypart(result.preview, "lunch")).toStrictEqual({
      id: "lunch",
      required: 27,
      scheduledBefore: 33,
      scheduledAfter: 27,
      gapBefore: 6,
      gapAfter: 0,
      reason: LABOR_REASONS.OVER_SCHEDULED_FORECAST_DOWN,
      actions: [
        {
          type: "release",
          staffId: "s04",
          name: "Tom Walsh",
          hours: 6,
        },
      ],
    });
    expect(daypart(result.preview, "dinner")).toStrictEqual({
      id: "dinner",
      required: 38,
      scheduledBefore: 48,
      scheduledAfter: 42,
      gapBefore: 10,
      gapAfter: 4,
      reason: LABOR_REASONS.OVER_SCHEDULED_FORECAST_DOWN,
      actions: [
        {
          type: "release",
          staffId: "s10",
          name: "Jonas Weber",
          hours: 6,
        },
      ],
    });
    expect(daypart(result.preview, "prep")).toStrictEqual({
      id: "prep",
      required: 11,
      scheduledBefore: 14,
      scheduledAfter: 14,
      gapBefore: 3,
      gapAfter: 3,
      reason: LABOR_REASONS.WITHIN_TOLERANCE,
      actions: [],
    });
    expect(result.preview.totals).toStrictEqual({
      scheduledBefore: 95,
      scheduledAfter: 83,
      required: 76,
      releases: 2,
      covers: 0,
    });
  });

  it("C: keeps the forecast-down releases and covers Rosa's absence with Nadia", () => {
    const absence = addLaborSignal({
      state: createSeedLaborState(),
      signalId: "labor-signal-rosa",
      input: { kind: "absence", staffId: "s11", note: "Cannot make close." },
    });
    expectSignalSuccess(absence);

    const result = createLaborPreview({
      state: absence.state,
      forecastCovers: 910,
      previewId: "labor-preview-c",
    });

    expect(daypart(result.preview, "lunch").actions).toStrictEqual([
      { type: "release", staffId: "s04", name: "Tom Walsh", hours: 6 },
    ]);
    expect(daypart(result.preview, "dinner").actions).toStrictEqual([
      { type: "release", staffId: "s10", name: "Jonas Weber", hours: 6 },
    ]);
    expect(daypart(result.preview, "prep")).toStrictEqual({
      id: "prep",
      required: 11,
      scheduledBefore: 7,
      scheduledAfter: 11,
      gapBefore: -4,
      gapAfter: 0,
      reason: LABOR_REASONS.UNDER_SCHEDULED_ABSENCE,
      actions: [
        {
          type: "cover",
          staffId: "oc1",
          name: "Nadia Haddad",
          hours: 4,
        },
      ],
    });
    expect(result.preview.totals).toStrictEqual({
      scheduledBefore: 88,
      scheduledAfter: 80,
      required: 76,
      releases: 2,
      covers: 1,
    });
  });

  it("D: fills Priya's saved-plan absence with Nadia and Sam in pool order", () => {
    const absence = addLaborSignal({
      state: createSeedLaborState(),
      signalId: "labor-signal-priya",
      input: { kind: "absence", staffId: "s05" },
    });
    expectSignalSuccess(absence);

    const result = createLaborPreview({
      state: absence.state,
      forecastCovers: 1_140,
      previewId: "labor-preview-d",
    });

    expect(daypart(result.preview, "lunch").reason).toBe(
      LABOR_REASONS.WITHIN_TOLERANCE,
    );
    expect(daypart(result.preview, "dinner")).toStrictEqual({
      id: "dinner",
      required: 48,
      scheduledBefore: 39,
      scheduledAfter: 51,
      gapBefore: -9,
      gapAfter: 3,
      reason: LABOR_REASONS.UNDER_SCHEDULED_ABSENCE,
      actions: [
        { type: "cover", staffId: "oc1", name: "Nadia Haddad", hours: 8 },
        { type: "cover", staffId: "oc2", name: "Sam O'Neill", hours: 4 },
      ],
    });
    expect(daypart(result.preview, "prep").reason).toBe(
      LABOR_REASONS.WITHIN_TOLERANCE,
    );
  });

  it("F: undo restores the pre-adoption roster while keeping Rosa absent", () => {
    const absence = addLaborSignal({
      state: createSeedLaborState(),
      signalId: "labor-signal-rosa",
      input: { kind: "absence", staffId: "s11" },
    });
    expectSignalSuccess(absence);
    const preview = createLaborPreview({
      state: absence.state,
      forecastCovers: 910,
      previewId: "labor-preview-f",
    });
    const adopted = adoptLaborPlan({
      state: preview.state,
      previewId: preview.preview.id,
    });
    expectAdoptSuccess(adopted);

    expect(shift(adopted.state, "s04").status).toBe("released");
    expect(shift(adopted.state, "s10").status).toBe("released");
    expect(shift(adopted.state, "s11").status).toBe("absent");
    expect(shift(adopted.state, "oc1")).toMatchObject({
      daypart: "prep",
      hours: 4,
      status: "cover",
    });
    expect(adopted.scheduledTotal).toBe(80);
    expect(adopted.undoAvailable).toBe(true);
    expect(adopted.noExternalAction).toBe(true);

    const undone = undoLaborAdoption({ state: adopted.state });
    expectUndoSuccess(undone);

    expect(shift(undone.state, "s04").status).toBe("scheduled");
    expect(shift(undone.state, "s10").status).toBe("scheduled");
    expect(shift(undone.state, "s11").status).toBe("absent");
    expect(undone.state.shifts.some((candidate) => candidate.staffId === "oc1")).toBe(false);
    expect(undone.state.signals).toStrictEqual(absence.state.signals);
    expect(undone.state.revision).toBe(4);
  });

  it("records typed signals, invalidates only a current labor preview, and adds extra shifts", () => {
    const seededPreview = createLaborPreview({
      state: createSeedLaborState(),
      forecastCovers: 1_140,
      previewId: "labor-preview-before-signal",
    });
    const result = addLaborSignal({
      state: seededPreview.state,
      signalId: "labor-signal-extra",
      input: {
        kind: "extra_shift",
        staffId: "oc1",
        daypart: "prep",
        hours: 4,
        note: "Available after lunch.",
      },
    });
    expectSignalSuccess(result);

    expect(result.laborPreviewInvalidated).toBe(true);
    expect(result.state.preview).toBeNull();
    expect(result.state.revision).toBe(2);
    expect(shift(result.state, "oc1")).toMatchObject({
      name: "Nadia Haddad",
      daypart: "prep",
      hours: 4,
      status: "scheduled",
    });
    expect(result.signal).toStrictEqual({
      id: "labor-signal-extra",
      kind: "extra_shift",
      staffId: "oc1",
      daypart: "prep",
      hours: 4,
      note: "Available after lunch.",
    });

    const plan = getLaborPlan({ state: result.state, forecastCovers: 1_140 });
    expect(daypart(plan, "prep").scheduled).toBe(18);
    expect(plan.laborPreviewId).toBeNull();
  });

  it("uses roster order to break ties between equally short release candidates", () => {
    const state: LaborEngineState = {
      ...createSeedLaborState(),
      shifts: [
        { staffId: "a", name: "First", daypart: "lunch", hours: 5, status: "scheduled" },
        { staffId: "b", name: "Second", daypart: "lunch", hours: 5, status: "scheduled" },
        { staffId: "c", name: "Third", daypart: "lunch", hours: 27, status: "scheduled" },
      ],
    };
    const result = createLaborPreview({
      state,
      forecastCovers: 910,
      previewId: "labor-preview-tie",
    });

    expect(daypart(result.preview, "lunch").actions[0]).toMatchObject({
      type: "release",
      staffId: "a",
    });
  });
});
