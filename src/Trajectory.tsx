import trajectory from "../docs/trajectory.json";

export function Trajectory() {
  return (
    <main className="trajectory-shell">
      <aside className="cutoff-rail" aria-label="Project record">
        <span>Cutoff</span>
        <strong>Record</strong>
        <span>Sep 2026</span>
      </aside>
      <article className="trajectory-paper">
        <header className="trajectory-header">
          <p className="eyebrow">Project record</p>
          <h1>{trajectory.title}</h1>
          <p>{trajectory.note}</p>
          <a className="text-button" href="/">Back to order sheet</a>
        </header>
        <ol className="trajectory-list">
          {trajectory.entries.map((entry, index) => (
            <li key={`${entry.at}-${entry.phase}-${entry.actor}-${index}`}>
              <div className="trajectory-meta">
                <time dateTime={entry.at}>{entry.at}</time>
                <span>{entry.phase}</span>
                <span>{entry.actor}</span>
              </div>
              <div>
                <p>{entry.summary}</p>
                <p className="trajectory-outcome">{entry.outcome}</p>
              </div>
            </li>
          ))}
        </ol>
      </article>
    </main>
  );
}
