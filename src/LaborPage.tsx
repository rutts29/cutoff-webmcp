import { type FormEvent, useState } from "react";

import {
  LABOR_DAYPARTS,
  type AddLaborSignalInput,
  type LaborDaypart,
  type LaborReason,
} from "./domain/labor";
import { getLaborPlan } from "./engine/laborEngine";
import { LaborBars, laborVarianceClass } from "./ServiceBand";
import type { ReviewState, ReviewStore } from "./store/reviewStore";
import { StaffAvatar } from "./VisualIdentity";

type LaborPageProps = Readonly<{
  state: ReviewState;
  store: ReviewStore;
}>;

type LaborSignalKind = AddLaborSignalInput["kind"];

type StaffOption = Readonly<{
  staffId: string;
  name: string;
}>;

const DAYPART_LABELS = {
  lunch: "Lunch",
  dinner: "Dinner",
  prep: "Prep and close",
} as const satisfies Record<LaborDaypart, string>;

const REASON_LABELS = {
  OVER_SCHEDULED_FORECAST_DOWN: "Forecast down",
  UNDER_SCHEDULED_ABSENCE: "Absence cover",
  UNDER_SCHEDULED_FORECAST_UP: "Forecast up",
  WITHIN_TOLERANCE: "Within tolerance",
} as const satisfies Record<LaborReason, string>;

function isLaborDaypart(value: string): value is LaborDaypart {
  return LABOR_DAYPARTS.some((daypart) => daypart === value);
}

function uniqueStaff(
  staff: readonly StaffOption[],
): readonly StaffOption[] {
  const seen = new Set<string>();
  return staff.filter((person) => {
    if (seen.has(person.staffId)) {
      return false;
    }
    seen.add(person.staffId);
    return true;
  });
}

function formatGap(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

function LaborSignalForm({
  state,
  store,
}: Readonly<{ state: ReviewState; store: ReviewStore }>) {
  const rosterStaff = uniqueStaff(state.labor.shifts);
  const allStaff = uniqueStaff([...rosterStaff, ...state.labor.onCall]);
  const [kind, setKind] = useState<LaborSignalKind>("absence");
  const [staffId, setStaffId] = useState(rosterStaff[0]?.staffId ?? "");
  const [daypart, setDaypart] = useState<LaborDaypart>("lunch");
  const [hours, setHours] = useState("4");
  const [note, setNote] = useState("");
  const [staffError, setStaffError] = useState("");
  const [hoursError, setHoursError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const staffOptions = kind === "absence" ? rosterStaff : allStaff;
  const staffErrorId = "labor-staff-error";
  const hoursErrorId = "labor-hours-error";
  const formErrorId = "labor-form-error";

  const clearFeedback = () => {
    setStaffError("");
    setHoursError("");
    setFormError("");
    setNotice("");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFeedback();
    if (!staffId || !staffOptions.some((staff) => staff.staffId === staffId)) {
      setStaffError("Choose a staff member");
      return;
    }

    let input: AddLaborSignalInput;
    if (kind === "absence") {
      input = {
        kind,
        staffId,
        ...(note.trim() ? { note: note.trim() } : {}),
      };
    } else {
      const parsedHours = Number(hours);
      if (!Number.isInteger(parsedHours) || parsedHours < 1 || parsedHours > 12) {
        setHoursError("Enter a whole number from 1 to 12");
        return;
      }
      input = {
        kind,
        staffId,
        daypart,
        hours: parsedHours,
        ...(note.trim() ? { note: note.trim() } : {}),
      };
    }

    const result = store.addLaborSignal(
      input,
      state.revision,
      "page",
    );
    if (!result.ok) {
      if (result.error === "invalid_shift_hours") {
        setHoursError("Enter a whole number from 1 to 12");
      } else if (result.error === "labor_staff_not_found") {
        setStaffError("Choose a staff member on this roster");
      } else {
        setFormError("The roster changed. Review it and try again");
      }
      return;
    }

    const selectedStaff = staffOptions.find((staff) => staff.staffId === staffId);
    setNote("");
    setNotice(
      kind === "absence"
        ? `${selectedStaff?.name ?? "Absence"} recorded as absent`
        : `${hours} extra hours recorded for ${selectedStaff?.name ?? "staff"}`,
    );
  };

  return (
    <section className="signals-panel labor-signals-panel" aria-labelledby="labor-signals-heading">
      <p className="panel-step">Step 1</p>
      <p className="eyebrow">Labor signals</p>
      <h2 id="labor-signals-heading">Record a roster change</h2>
      <form
        className="signal-form labor-signal-form"
        aria-describedby={`${formErrorId} labor-form-status`}
        onSubmit={submit}
        noValidate
      >
        <label htmlFor="labor-signal-kind">
          Change
          <select
            id="labor-signal-kind"
            value={kind}
            onChange={(event) => {
              const nextKind: LaborSignalKind =
                event.target.value === "extra_shift" ? "extra_shift" : "absence";
              const nextOptions = nextKind === "absence" ? rosterStaff : allStaff;
              setKind(nextKind);
              if (!nextOptions.some((staff) => staff.staffId === staffId)) {
                setStaffId(nextOptions[0]?.staffId ?? "");
              }
              clearFeedback();
            }}
          >
            <option value="absence">Absence</option>
            <option value="extra_shift">Extra shift</option>
          </select>
        </label>

        <label htmlFor="labor-staff">
          Staff member
          <select
            id="labor-staff"
            aria-describedby={staffError ? staffErrorId : undefined}
            aria-invalid={staffError ? true : undefined}
            required
            value={staffId}
            onChange={(event) => {
              setStaffId(event.target.value);
              clearFeedback();
            }}
          >
            {staffOptions.map((staff) => (
              <option key={staff.staffId} value={staff.staffId}>{staff.name}</option>
            ))}
          </select>
          <span
            className="field-error"
            id={staffErrorId}
            role={staffError ? "alert" : undefined}
          >
            {staffError}
          </span>
        </label>

        {kind === "extra_shift" ? (
          <>
            <label htmlFor="labor-daypart">
              Daypart
              <select
                id="labor-daypart"
                value={daypart}
                onChange={(event) => {
                  if (isLaborDaypart(event.target.value)) {
                    setDaypart(event.target.value);
                  }
                  clearFeedback();
                }}
                required
              >
                {LABOR_DAYPARTS.map((candidate) => (
                  <option key={candidate} value={candidate}>{DAYPART_LABELS[candidate]}</option>
                ))}
              </select>
            </label>
            <label htmlFor="labor-hours">
              Hours
              <input
                id="labor-hours"
                aria-describedby={hoursError ? hoursErrorId : undefined}
                aria-invalid={hoursError ? true : undefined}
                inputMode="numeric"
                min="1"
                max="12"
                required
                step="1"
                type="number"
                value={hours}
                onChange={(event) => {
                  setHours(event.target.value);
                  clearFeedback();
                }}
              />
              <span
                className="field-error"
                id={hoursErrorId}
                role={hoursError ? "alert" : undefined}
              >
                {hoursError}
              </span>
            </label>
          </>
        ) : null}

        <label className="labor-note-field" htmlFor="labor-note">
          Note
          <input
            id="labor-note"
            maxLength={500}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              clearFeedback();
            }}
          />
        </label>
        <button type="submit">Record signal</button>
      </form>
      <p className="field-error" id={formErrorId} role={formError ? "alert" : undefined}>{formError}</p>
      <p className="field-status" id="labor-form-status" role="status">{notice}</p>

      {state.labor.signals.length > 0 ? (
        <ul className="signal-list labor-signal-list" aria-label="Recorded labor signals">
          {state.labor.signals.map((signal) => {
            const name = allStaff.find((staff) => staff.staffId === signal.staffId)?.name ?? signal.staffId;
            return (
              <li key={signal.id}>
                <span className="staff-identity">
                  <StaffAvatar name={name} />
                  <span className="staff-identity-copy">
                    <span>
                      {signal.kind === "absence"
                        ? `${name} absent`
                        : `${name}, ${DAYPART_LABELS[signal.daypart]}, ${signal.hours}h`}
                    </span>
                    {signal.note ? <small className="labor-signal-note">{signal.note}</small> : null}
                  </span>
                </span>
                <span className="reason-chip">{signal.kind === "absence" ? "Absence" : "Extra shift"}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-state labor-signals-empty">No labor changes recorded.</p>
      )}
    </section>
  );
}

export function LaborPage({ state, store }: LaborPageProps) {
  const plan = getLaborPlan({
    state: state.labor,
    forecastCovers: state.draft.plan.covers,
  });
  const preview = state.labor.preview;
  const [controlError, setControlError] = useState("");
  const [controlNotice, setControlNotice] = useState("");

  const runControl = (
    action: () => { ok: boolean },
    successMessage: string,
  ) => {
    setControlError("");
    setControlNotice("");
    const result = action();
    if (!result.ok) {
      setControlError("The roster changed. Review it and try again");
      return;
    }
    setControlNotice(successMessage);
  };

  const createPreview = () => runControl(
    () => store.previewLaborPlan(
      "Manual preview from the labor desk.",
      state.revision,
      "page",
    ),
    "Labor preview ready",
  );

  return (
    <div className="labor-page">
      {state.laborPreviewStaleReason ? (
        <section className="stale-preview-strip labor-stale-notice" role="status">
          <p>
            <strong>Labor preview needs a refresh</strong>
            <span>{state.laborPreviewStaleReason}</span>
          </p>
          <button type="button" onClick={createPreview}>Preview again</button>
        </section>
      ) : null}

      <section id="labor-roster" className="labor-dayparts" aria-labelledby="labor-roster-heading">
        <div className="section-heading">
          <div>
            <p className="panel-step">Step 1</p>
            <p className="eyebrow">Service-day roster</p>
            <h2 id="labor-roster-heading">Required hours by daypart</h2>
          </div>
          <p className="mono section-note">revision {state.revision}</p>
        </div>
        <div className="labor-daypart-grid">
          {plan.dayparts.map((daypart) => {
            const headingId = `labor-${daypart.id}-heading`;
            return (
            <article
              aria-labelledby={headingId}
              className="labor-daypart-card"
              key={daypart.id}
            >
              <div className="labor-daypart-heading">
                <h3 id={headingId}>{DAYPART_LABELS[daypart.id]}</h3>
                <span className={`labor-gap ${laborVarianceClass(daypart.gap)}`}>
                  {formatGap(daypart.gap)}h gap
                </span>
              </div>
              <LaborBars required={daypart.required} scheduled={daypart.scheduled} />
              <ul className="labor-shift-list" aria-label={`${DAYPART_LABELS[daypart.id]} shifts`}>
                {daypart.shifts.map((shift, index) => (
                  <li
                    id={`staff-${shift.staffId}`}
                    key={`${shift.staffId}-${shift.daypart}-${index}`}
                  >
                    <span className="staff-identity">
                      <StaffAvatar name={shift.name} />
                      <span className="staff-identity-copy">
                        <span>{shift.name}</span>
                        <small>{shift.hours}h</small>
                      </span>
                    </span>
                    <span className={`reason-chip labor-shift-status status-${shift.status}`}>
                      {shift.status}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
            );
          })}
        </div>
      </section>

      <div className="labor-workspace-grid">
        <LaborSignalForm state={state} store={store} />

        <section
          id="labor-preview"
          className="controls-panel labor-preview-panel"
          aria-labelledby="labor-preview-heading"
        >
          <p className="panel-step">Step 2</p>
          <p className="eyebrow">Labor preview</p>
          <h2 id="labor-preview-heading">Review proposed shift changes</h2>
          {preview ? (
            <div className="labor-preview-results">
              <p className="preview-status">
                {preview.totals.scheduledBefore} scheduled hours to {preview.totals.scheduledAfter}
              </p>
              <ul className="labor-preview-list">
                {preview.dayparts.map((daypart) => (
                  <li key={daypart.id}>
                    <div className="labor-preview-daypart-heading">
                      <strong>{DAYPART_LABELS[daypart.id]}</strong>
                      <span className="reason-chip">{REASON_LABELS[daypart.reason]}</span>
                    </div>
                    <p className="labor-preview-delta">
                      {daypart.scheduledBefore}h scheduled to {daypart.scheduledAfter}h, gap {formatGap(daypart.gapAfter)}h
                    </p>
                    {daypart.actions.length > 0 ? (
                      <ul className="labor-action-list">
                        {daypart.actions.map((action) => (
                          <li key={`${action.type}-${action.staffId}`}>
                            <span className="staff-identity">
                              <StaffAvatar name={action.name} />
                              <span className="staff-identity-copy">
                                <span>{action.type === "release" ? "Release" : "Cover with"} {action.name}, {action.hours}h</span>
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="empty-state">No shift change.</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="empty-state labor-preview-empty">
              Preview the roster to see releases and on-call cover.
            </p>
          )}

          <div className="labor-adopt-controls">
            <p className="panel-step">Step 3</p>
            <div className="control-buttons">
              <button type="button" onClick={createPreview}>Preview shifts</button>
              <button
                type="button"
                disabled={!preview}
                onClick={() => preview && runControl(
                  () => store.adoptLaborPlan(
                    preview.id,
                    state.revision,
                    undefined,
                    "page",
                  ),
                  "Labor plan adopted",
                )}
              >
                Adopt labor plan
              </button>
              <button
                type="button"
                disabled={!state.labor.undoSnapshot}
                onClick={() => runControl(
                  () => store.undoLaborAdoption(state.revision, "page"),
                  "Labor adoption undone",
                )}
              >
                Undo adoption
              </button>
              <button
                className="text-button"
                type="button"
                disabled={!preview}
                onClick={() => runControl(
                  () => store.discardLaborPreview(state.revision, "page"),
                  "Labor preview discarded",
                )}
              >
                Discard preview
              </button>
            </div>
            <p>Adoption updates this working roster only.</p>
            <p className="field-error" role={controlError ? "alert" : undefined}>{controlError}</p>
            <p className="field-status" role="status">{controlNotice}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
