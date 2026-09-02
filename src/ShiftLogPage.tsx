import { type FormEvent, useEffect, useMemo, useState } from "react";

import { SECTION_DEFINITIONS, type Section } from "./domain/sections";
import type { ReviewState, ReviewStore } from "./store/reviewStore";

type ShiftLogPageProps = Readonly<{
  state: ReviewState;
  store: ReviewStore;
}>;

type LogFilter = "all" | Section;

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(date);
}

export function ShiftLogPage({ state, store }: ShiftLogPageProps) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const [text, setText] = useState("");
  const [section, setSection] = useState<Section>("log");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const log = useMemo(
    () => store.getShiftLog(filter === "all" ? undefined : filter, 200),
    [filter, state.activity, state.presetId, state.revision, store],
  );

  useEffect(() => {
    setFilter("all");
    setText("");
    setSection("log");
    setError("");
    setNotice("");
  }, [state.presetId]);

  const addNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    const cleanText = text.trim();
    if (!cleanText) {
      setError("Write a note for the next shift");
      return;
    }
    const result = store.addShiftNote(
      cleanText,
      section,
      state.revision,
      "page",
    );
    if (!result.ok) {
      setError("The shift record changed. Review it and try again");
      return;
    }
    setText("");
    setError("");
    setNotice("Shift note added");
  };

  const downloadLog = () => {
    const contents = JSON.stringify(log, null, 2);
    const file = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cutoff-shift-log-${state.serviceDate}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="shift-log-grid">
      <section className="shift-log-panel" aria-labelledby="shift-log-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Service-day record</p>
            <h2 id="shift-log-heading">Everything recorded this shift</h2>
          </div>
          <p className="mono section-note">{log.total} entries · revision {state.revision}</p>
        </div>
        <div className="log-toolbar">
          <div className="filter-chips" role="group" aria-label="Filter shift log by section">
            <button
              type="button"
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            {SECTION_DEFINITIONS.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                aria-pressed={filter === candidate.id}
                onClick={() => setFilter(candidate.id)}
              >
                {candidate.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={downloadLog}>Download shift log (JSON)</button>
        </div>
        {log.entries.length === 0 ? (
          <p className="empty-state">No recorded activity matches this filter.</p>
        ) : (
          <ol className="shift-log-list">
            {log.entries.map((entry) => (
              <li key={entry.id}>
                <div className="shift-log-meta">
                  <time className="mono" dateTime={entry.at}>{timeLabel(entry.at)}</time>
                  <span className={`section-chip section-${entry.section}`}>{entry.section}</span>
                  <span className="mono">{entry.tool ?? "page"}</span>
                </div>
                <p>{entry.summary}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="shift-note-panel" aria-labelledby="shift-note-heading">
        <p className="panel-step">Step 2</p>
        <p className="eyebrow">Next shift</p>
        <h2 id="shift-note-heading">Leave one useful note</h2>
        <form onSubmit={addNote} noValidate>
          <label htmlFor="shift-note-text">
            Shift note
            <textarea
              id="shift-note-text"
              aria-describedby="shift-note-error shift-note-status"
              aria-invalid={error ? true : undefined}
              maxLength={500}
              onChange={(event) => {
                setText(event.target.value);
                setError("");
                setNotice("");
              }}
              placeholder="Morning team: check the walk-in before lunch."
              required
              rows={5}
              value={text}
            />
          </label>
          <label htmlFor="shift-note-section">
            Filed under
            <select
              id="shift-note-section"
              value={section}
              onChange={(event) => setSection(event.target.value as Section)}
            >
              {SECTION_DEFINITIONS.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
              ))}
            </select>
          </label>
          <button type="submit">Add shift note</button>
          <p id="shift-note-error" className="field-error" role={error ? "alert" : undefined}>{error}</p>
          <p id="shift-note-status" className="field-status" role={notice ? "status" : undefined}>{notice}</p>
        </form>
      </section>
    </div>
  );
}
