import {
  LABOR_DAYPARTS,
  type AddLaborSignalInput,
  type AddLaborSignalResult,
  type AdoptLaborPlanResult,
  type CoverLaborAction,
  type LaborAction,
  type LaborDaypart,
  type LaborEngineState,
  type LaborPlan,
  type LaborPreview,
  type LaborPreviewDaypart,
  type LaborReason,
  type LaborRequirement,
  type LaborShift,
  type LaborSignal,
  type OnCallStaff,
  type ReleaseLaborAction,
  type UndoLaborAdoptionResult,
} from "../domain/labor";

export const LABOR_REASONS = {
  OVER_SCHEDULED_FORECAST_DOWN: "OVER_SCHEDULED_FORECAST_DOWN",
  UNDER_SCHEDULED_ABSENCE: "UNDER_SCHEDULED_ABSENCE",
  UNDER_SCHEDULED_FORECAST_UP: "UNDER_SCHEDULED_FORECAST_UP",
  WITHIN_TOLERANCE: "WITHIN_TOLERANCE",
} as const satisfies Record<LaborReason, LaborReason>;

const SEED_SHIFTS = [
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
] as const satisfies readonly LaborShift[];

const SEED_ON_CALL = [
  { staffId: "oc1", name: "Nadia Haddad" },
  { staffId: "oc2", name: "Sam O'Neill" },
] as const satisfies readonly OnCallStaff[];

function isActiveShift(shift: LaborShift): boolean {
  return shift.status === "scheduled" || shift.status === "cover";
}

function sumScheduled(shifts: readonly LaborShift[]): number {
  return shifts.reduce(
    (total, shift) => total + (isActiveShift(shift) ? shift.hours : 0),
    0,
  );
}

function requiredForDaypart(
  requirement: LaborRequirement,
  daypart: LaborDaypart,
): number {
  return requirement[daypart];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function staffName(
  state: LaborEngineState,
  staffId: string,
): string | undefined {
  return (
    state.shifts.find((shift) => shift.staffId === staffId)?.name ??
    state.onCall.find((staff) => staff.staffId === staffId)?.name
  );
}

function applySignalToShifts({
  shifts,
  signal,
  name,
}: Readonly<{
  shifts: readonly LaborShift[];
  signal: LaborSignal;
  name: string;
}>): readonly LaborShift[] {
  if (signal.kind === "extra_shift") {
    return [
      ...shifts,
      {
        staffId: signal.staffId,
        name,
        daypart: signal.daypart,
        hours: signal.hours,
        status: "scheduled",
      },
    ];
  }

  let markedAbsent = false;
  return shifts.map((shift) => {
    if (!markedAbsent && shift.staffId === signal.staffId) {
      markedAbsent = true;
      return { ...shift, status: "absent" };
    }
    return shift;
  });
}

function createReleaseActions({
  shifts,
  required,
}: Readonly<{
  shifts: readonly LaborShift[];
  required: number;
}>): readonly ReleaseLaborAction[] {
  const scheduled = sumScheduled(shifts);
  if (scheduled - required <= 4) {
    return [];
  }

  const candidates = shifts
    .map((shift, rosterIndex) => ({ shift, rosterIndex }))
    .filter(({ shift }) => isActiveShift(shift))
    .sort(
      (left, right) =>
        left.shift.hours - right.shift.hours ||
        left.rosterIndex - right.rosterIndex,
    );
  const actions: ReleaseLaborAction[] = [];
  let scheduledAfter = scheduled;

  for (const { shift } of candidates) {
    if (scheduledAfter - required <= 4) {
      break;
    }
    if (scheduledAfter - shift.hours < required) {
      break;
    }
    actions.push({
      type: "release",
      staffId: shift.staffId,
      name: shift.name,
      hours: shift.hours,
    });
    scheduledAfter -= shift.hours;
  }

  return actions;
}

function createCoverActions({
  scheduled,
  required,
  availableOnCall,
}: Readonly<{
  scheduled: number;
  required: number;
  availableOnCall: OnCallStaff[];
}>): readonly CoverLaborAction[] {
  const actions: CoverLaborAction[] = [];
  let scheduledAfter = scheduled;

  while (scheduledAfter < required && availableOnCall.length > 0) {
    const staff = availableOnCall.shift();
    if (!staff) {
      break;
    }
    const hours = clamp(required - scheduledAfter, 4, 8);
    actions.push({
      type: "cover",
      staffId: staff.staffId,
      name: staff.name,
      hours,
    });
    scheduledAfter += hours;
  }

  return actions;
}

function reasonForDaypart({
  actions,
  hasAbsence,
}: Readonly<{
  actions: readonly LaborAction[];
  hasAbsence: boolean;
}>): LaborReason {
  if (actions.some((action) => action.type === "release")) {
    return LABOR_REASONS.OVER_SCHEDULED_FORECAST_DOWN;
  }
  if (actions.some((action) => action.type === "cover")) {
    return hasAbsence
      ? LABOR_REASONS.UNDER_SCHEDULED_ABSENCE
      : LABOR_REASONS.UNDER_SCHEDULED_FORECAST_UP;
  }
  return LABOR_REASONS.WITHIN_TOLERANCE;
}

function createPreviewDaypart({
  state,
  daypart,
  required,
  availableOnCall,
}: Readonly<{
  state: LaborEngineState;
  daypart: LaborDaypart;
  required: number;
  availableOnCall: OnCallStaff[];
}>): LaborPreviewDaypart {
  const shifts = state.shifts.filter((shift) => shift.daypart === daypart);
  const scheduledBefore = sumScheduled(shifts);
  const releaseActions = createReleaseActions({ shifts, required });
  const coverActions =
    releaseActions.length === 0 && scheduledBefore < required
      ? createCoverActions({
          scheduled: scheduledBefore,
          required,
          availableOnCall,
        })
      : [];
  const actions: readonly LaborAction[] = [
    ...releaseActions,
    ...coverActions,
  ];
  const scheduledAfter = actions.reduce(
    (total, action) =>
      action.type === "release"
        ? total - action.hours
        : total + action.hours,
    scheduledBefore,
  );
  const hasAbsence = shifts.some((shift) => shift.status === "absent");

  return {
    id: daypart,
    required,
    scheduledBefore,
    scheduledAfter,
    gapBefore: scheduledBefore - required,
    gapAfter: scheduledAfter - required,
    reason: reasonForDaypart({ actions, hasAbsence }),
    actions,
  };
}

function applyPreviewActions(
  shifts: readonly LaborShift[],
  preview: LaborPreview,
): readonly LaborShift[] {
  let result = [...shifts];

  for (const daypart of preview.dayparts) {
    for (const action of daypart.actions) {
      if (action.type === "cover") {
        result.push({
          staffId: action.staffId,
          name: action.name,
          daypart: daypart.id,
          hours: action.hours,
          status: "cover",
        });
        continue;
      }

      let released = false;
      result = result.map((shift) => {
        if (
          !released &&
          shift.staffId === action.staffId &&
          shift.daypart === daypart.id &&
          shift.hours === action.hours &&
          isActiveShift(shift)
        ) {
          released = true;
          return { ...shift, status: "released" };
        }
        return shift;
      });
    }
  }

  return result;
}

export function createSeedLaborState(
  revision = 0,
  seed: Readonly<{
    shifts: readonly LaborShift[];
    onCall: readonly OnCallStaff[];
  }> = { shifts: SEED_SHIFTS, onCall: SEED_ON_CALL },
): LaborEngineState {
  return {
    shifts: seed.shifts.map((shift) => ({ ...shift })),
    onCall: seed.onCall.map((staff) => ({ ...staff })),
    signals: [],
    preview: null,
    undoSnapshot: null,
    revision,
  };
}

export function calculateLaborRequirement(covers: number): LaborRequirement {
  const total = Math.ceil(Math.max(0, covers) / 12);
  const lunch = Math.round(total * 0.35);
  const prep = Math.round(total * 0.15);
  return {
    total,
    lunch,
    dinner: total - lunch - prep,
    prep,
  };
}

export function getLaborPlan({
  state,
  forecastCovers,
}: Readonly<{
  state: LaborEngineState;
  forecastCovers: number;
}>): LaborPlan {
  const safeForecastCovers = Math.max(0, forecastCovers);
  const requirement = calculateLaborRequirement(safeForecastCovers);
  const dayparts = LABOR_DAYPARTS.map((id) => {
    const shifts = state.shifts.filter((shift) => shift.daypart === id);
    const scheduled = sumScheduled(shifts);
    const required = requiredForDaypart(requirement, id);
    return {
      id,
      required,
      scheduled,
      gap: scheduled - required,
      shifts,
    };
  });

  return {
    forecastCovers: safeForecastCovers,
    requiredTotal: requirement.total,
    dayparts,
    onCall: state.onCall,
    signals: state.signals,
    laborPreviewId: state.preview?.id ?? null,
    revision: state.revision,
  };
}

export function addLaborSignal({
  state,
  signalId,
  input,
}: Readonly<{
  state: LaborEngineState;
  signalId: string;
  input: AddLaborSignalInput;
}>): AddLaborSignalResult {
  const name = staffName(state, input.staffId);
  if (!name || (input.kind === "absence" && !state.shifts.some((shift) => shift.staffId === input.staffId))) {
    return {
      ok: false,
      error: "labor_staff_not_found",
      staffId: input.staffId,
    };
  }
  if (
    input.kind === "extra_shift" &&
    (!Number.isInteger(input.hours) || input.hours < 1 || input.hours > 12)
  ) {
    return {
      ok: false,
      error: "invalid_shift_hours",
      staffId: input.staffId,
    };
  }

  const signal: LaborSignal =
    input.kind === "absence"
      ? {
          id: signalId,
          kind: input.kind,
          staffId: input.staffId,
          ...(input.note === undefined ? {} : { note: input.note }),
        }
      : {
          id: signalId,
          kind: input.kind,
          staffId: input.staffId,
          daypart: input.daypart,
          hours: input.hours,
          ...(input.note === undefined ? {} : { note: input.note }),
        };
  const shifts = applySignalToShifts({
    shifts: state.shifts,
    signal,
    name,
  });
  const undoSnapshot = state.undoSnapshot
    ? {
        shifts: applySignalToShifts({
          shifts: state.undoSnapshot.shifts,
          signal,
          name,
        }),
      }
    : null;
  const revision = state.revision + 1;
  const nextState: LaborEngineState = {
    ...state,
    shifts,
    signals: [...state.signals, signal],
    preview: null,
    undoSnapshot,
    revision,
  };

  return {
    ok: true,
    signal,
    state: nextState,
    revision,
    laborPreviewInvalidated: state.preview !== null,
  };
}

export function createLaborPreview({
  state,
  forecastCovers,
  previewId,
}: Readonly<{
  state: LaborEngineState;
  forecastCovers: number;
  previewId: string;
}>): Readonly<{
  state: LaborEngineState;
  preview: LaborPreview;
  revision: number;
}> {
  const safeForecastCovers = Math.max(0, forecastCovers);
  const requirement = calculateLaborRequirement(safeForecastCovers);
  const activeStaffIds = new Set(
    state.shifts
      .filter(isActiveShift)
      .map((shift) => shift.staffId),
  );
  const availableOnCall = state.onCall.filter(
    (staff) => !activeStaffIds.has(staff.staffId),
  );
  const dayparts = LABOR_DAYPARTS.map((id) =>
    createPreviewDaypart({
      state,
      daypart: id,
      required: requiredForDaypart(requirement, id),
      availableOnCall,
    }),
  );
  const revision = state.revision + 1;
  const preview: LaborPreview = {
    id: previewId,
    baseRevision: revision,
    forecastCovers: safeForecastCovers,
    requiredTotal: requirement.total,
    dayparts,
    totals: {
      scheduledBefore: dayparts.reduce(
        (total, item) => total + item.scheduledBefore,
        0,
      ),
      scheduledAfter: dayparts.reduce(
        (total, item) => total + item.scheduledAfter,
        0,
      ),
      required: requirement.total,
      releases: dayparts.reduce(
        (total, item) =>
          total + item.actions.filter((action) => action.type === "release").length,
        0,
      ),
      covers: dayparts.reduce(
        (total, item) =>
          total + item.actions.filter((action) => action.type === "cover").length,
        0,
      ),
    },
  };
  const nextState: LaborEngineState = {
    ...state,
    preview,
    revision,
  };

  return { state: nextState, preview, revision };
}

export function adoptLaborPlan({
  state,
  previewId,
}: Readonly<{
  state: LaborEngineState;
  previewId: string;
}>): AdoptLaborPlanResult {
  if (
    state.preview === null ||
    state.preview.id !== previewId ||
    state.preview.baseRevision !== state.revision
  ) {
    return {
      ok: false,
      error: "stale_labor_preview",
      currentPreviewId: state.preview?.id ?? null,
    };
  }

  const shifts = applyPreviewActions(state.shifts, state.preview);
  const revision = state.revision + 1;
  const nextState: LaborEngineState = {
    ...state,
    shifts,
    preview: null,
    undoSnapshot: { shifts: state.shifts },
    revision,
  };

  return {
    ok: true,
    state: nextState,
    revision,
    scheduledTotal: sumScheduled(shifts),
    undoAvailable: true,
    noExternalAction: true,
  };
}

export function undoLaborAdoption({
  state,
}: Readonly<{
  state: LaborEngineState;
}>): UndoLaborAdoptionResult {
  if (state.undoSnapshot === null) {
    return { ok: false, error: "nothing_to_undo" };
  }

  const shifts = state.undoSnapshot.shifts;
  const revision = state.revision + 1;
  const nextState: LaborEngineState = {
    ...state,
    shifts,
    preview: null,
    undoSnapshot: null,
    revision,
  };

  return {
    ok: true,
    state: nextState,
    revision,
    scheduledTotal: sumScheduled(shifts),
    undoAvailable: false,
  };
}
