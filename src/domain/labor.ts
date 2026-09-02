export const LABOR_DAYPARTS = ["lunch", "dinner", "prep"] as const;

export type LaborDaypart = (typeof LABOR_DAYPARTS)[number];

export type LaborShiftStatus =
  | "scheduled"
  | "absent"
  | "released"
  | "cover";

export type LaborShift = Readonly<{
  staffId: string;
  name: string;
  daypart: LaborDaypart;
  hours: number;
  status: LaborShiftStatus;
}>;

export type OnCallStaff = Readonly<{
  staffId: string;
  name: string;
}>;

type LaborSignalBase = Readonly<{
  id: string;
  staffId: string;
  note?: string;
}>;

export type LaborAbsenceSignal = LaborSignalBase &
  Readonly<{
    kind: "absence";
  }>;

export type LaborExtraShiftSignal = LaborSignalBase &
  Readonly<{
    kind: "extra_shift";
    daypart: LaborDaypart;
    hours: number;
  }>;

export type LaborSignal = LaborAbsenceSignal | LaborExtraShiftSignal;

export type AddLaborSignalInput =
  | Readonly<{
      kind: "absence";
      staffId: string;
      note?: string;
    }>
  | Readonly<{
      kind: "extra_shift";
      staffId: string;
      daypart: LaborDaypart;
      hours: number;
      note?: string;
    }>;

export type LaborReason =
  | "OVER_SCHEDULED_FORECAST_DOWN"
  | "UNDER_SCHEDULED_ABSENCE"
  | "UNDER_SCHEDULED_FORECAST_UP"
  | "WITHIN_TOLERANCE";

type LaborActionBase = Readonly<{
  staffId: string;
  name: string;
  hours: number;
}>;

export type ReleaseLaborAction = LaborActionBase &
  Readonly<{
    type: "release";
  }>;

export type CoverLaborAction = LaborActionBase &
  Readonly<{
    type: "cover";
  }>;

export type LaborAction = ReleaseLaborAction | CoverLaborAction;

export type LaborPreviewDaypart = Readonly<{
  id: LaborDaypart;
  required: number;
  scheduledBefore: number;
  scheduledAfter: number;
  gapBefore: number;
  gapAfter: number;
  reason: LaborReason;
  actions: readonly LaborAction[];
}>;

export type LaborPreview = Readonly<{
  id: string;
  baseRevision: number;
  forecastCovers: number;
  requiredTotal: number;
  dayparts: readonly LaborPreviewDaypart[];
  totals: Readonly<{
    scheduledBefore: number;
    scheduledAfter: number;
    required: number;
    releases: number;
    covers: number;
  }>;
}>;

export type LaborAdoptionSnapshot = Readonly<{
  shifts: readonly LaborShift[];
}>;

export type LaborEngineState = Readonly<{
  shifts: readonly LaborShift[];
  onCall: readonly OnCallStaff[];
  signals: readonly LaborSignal[];
  preview: LaborPreview | null;
  undoSnapshot: LaborAdoptionSnapshot | null;
  revision: number;
}>;

export type LaborRequirement = Readonly<{
  total: number;
  lunch: number;
  dinner: number;
  prep: number;
}>;

export type LaborPlanDaypart = Readonly<{
  id: LaborDaypart;
  required: number;
  scheduled: number;
  gap: number;
  shifts: readonly LaborShift[];
}>;

export type LaborPlan = Readonly<{
  forecastCovers: number;
  requiredTotal: number;
  dayparts: readonly LaborPlanDaypart[];
  onCall: readonly OnCallStaff[];
  signals: readonly LaborSignal[];
  laborPreviewId: string | null;
  revision: number;
}>;

type LaborSignalError = Readonly<{
  ok: false;
  error: "labor_staff_not_found" | "invalid_shift_hours";
  staffId: string;
}>;

export type AddLaborSignalSuccess = Readonly<{
  ok: true;
  signal: LaborSignal;
  state: LaborEngineState;
  revision: number;
  laborPreviewInvalidated: boolean;
}>;

export type AddLaborSignalResult = AddLaborSignalSuccess | LaborSignalError;

type StaleLaborPreviewError = Readonly<{
  ok: false;
  error: "stale_labor_preview";
  currentPreviewId: string | null;
}>;

export type AdoptLaborPlanSuccess = Readonly<{
  ok: true;
  state: LaborEngineState;
  revision: number;
  scheduledTotal: number;
  undoAvailable: true;
  noExternalAction: true;
}>;

export type AdoptLaborPlanResult =
  | AdoptLaborPlanSuccess
  | StaleLaborPreviewError;

type NoLaborUndoError = Readonly<{
  ok: false;
  error: "nothing_to_undo";
}>;

export type UndoLaborAdoptionSuccess = Readonly<{
  ok: true;
  state: LaborEngineState;
  revision: number;
  scheduledTotal: number;
  undoAvailable: false;
}>;

export type UndoLaborAdoptionResult =
  | UndoLaborAdoptionSuccess
  | NoLaborUndoError;
