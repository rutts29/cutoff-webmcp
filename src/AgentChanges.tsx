import { useEffect, useMemo, useState } from "react";

import { SECTION_DEFINITIONS, type Section } from "./domain/sections";
import type { ActivityEntry } from "./store/reviewStore";

const VISIBLE_CHANGE_LIMIT = 8;

type AgentChangesProps = Readonly<{
  activity: readonly ActivityEntry[];
  onReveal: (entry: ActivityEntry & { target: NonNullable<ActivityEntry["target"]> }) => void;
}>;

type TargetedActivityEntry = ActivityEntry & {
  target: NonNullable<ActivityEntry["target"]>;
};

function isTargetedAgentWrite(entry: ActivityEntry): entry is TargetedActivityEntry {
  return entry.actor === "tool" && entry.effect !== "read" && entry.target !== undefined;
}

function sectionLabel(section: Section): string {
  return SECTION_DEFINITIONS.find((candidate) => candidate.id === section)?.label ?? section;
}

export function AgentChanges({ activity, onReveal }: AgentChangesProps) {
  const [expanded, setExpanded] = useState(false);
  const [clearedIds, setClearedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const changes = useMemo(
    () => activity.filter(isTargetedAgentWrite).filter((entry) => !clearedIds.has(entry.id)).reverse(),
    [activity, clearedIds],
  );

  useEffect(() => {
    if (changes.length === 0) {
      setExpanded(false);
    }
  }, [changes.length]);

  useEffect(() => {
    if (!expanded) {
      return;
    }
    const timeout = window.setTimeout(() => setExpanded(false), 6_000);
    return () => window.clearTimeout(timeout);
  }, [expanded, changes.length]);

  useEffect(() => {
    if (!expanded) {
      return;
    }
    const collapseOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", collapseOnEscape);
    return () => window.removeEventListener("keydown", collapseOnEscape);
  }, [expanded]);

  if (changes.length === 0) {
    return null;
  }

  const countLabel = `Agent · ${changes.length} ${changes.length === 1 ? "change" : "changes"}`;
  const visibleChanges = changes.slice(0, VISIBLE_CHANGE_LIMIT);
  const hiddenCount = changes.length - visibleChanges.length;

  const clearEntries = (entries: readonly TargetedActivityEntry[]) => {
    setClearedIds((current) => {
      const next = new Set(current);
      for (const entry of entries) {
        next.add(entry.id);
      }
      return next;
    });
  };

  if (!expanded) {
    return (
      <aside className="agent-changes agent-changes-collapsed" aria-label="Agent changes">
        <button
          className="agent-changes-pill"
          type="button"
          aria-expanded="false"
          onClick={() => setExpanded(true)}
        >
          <span aria-live="polite">{countLabel}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="agent-changes agent-changes-panel" aria-label="Agent changes">
      <div className="agent-changes-heading">
        <div>
          <p className="eyebrow">Agent changes</p>
          <p className="agent-changes-count">{countLabel}</p>
        </div>
        <button
          className="agent-changes-collapse"
          type="button"
          aria-label="Collapse agent changes"
          aria-expanded="true"
          onClick={() => setExpanded(false)}
        >
          Collapse
        </button>
      </div>
      <ol className="agent-changes-list">
        {visibleChanges.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => {
                clearEntries([entry]);
                onReveal(entry);
              }}
            >
              <span className="agent-change-summary">
                <strong>{entry.target.label}</strong>
                <span aria-hidden="true"> · </span>
                <span>{entry.resultSummary}</span>
              </span>
              <span className="agent-change-meta">
                {sectionLabel(entry.section)} · {entry.tool}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {hiddenCount > 0 ? (
        <p className="agent-changes-more">and {hiddenCount} more</p>
      ) : null}
      <button
        className="agent-changes-clear"
        type="button"
        onClick={() => clearEntries(changes)}
      >
        Clear all
      </button>
    </aside>
  );
}
