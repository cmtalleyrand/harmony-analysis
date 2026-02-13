function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderApproachTable(summary) {
  const rows = summary.results.map(r => `
    <tr>
      <td>${esc(r.approach)}</td>
      <td>${esc(r.progression || '(none)')}</td>
      <td>${Number.isFinite(r.total) ? r.total.toFixed(3) : '-'}</td>
    </tr>`).join('');
  return `
    <table class="result-table">
      <thead><tr><th>Approach</th><th>Progression</th><th>Total score</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderBeatTable(summary) {
  const byApproach = Object.fromEntries(summary.results.map(r => [r.approach, r.path || []]));
  const maxBeats = Math.max(0, ...Object.values(byApproach).map(p => p.length));
  const rows = [];
  for (let i = 0; i < maxBeats; i++) {
    const cell = (a) => esc(byApproach[a]?.[i]?.chordName || '-');
    rows.push(`<tr><td>${i}</td><td>${cell('A')}</td><td>${cell('B')}</td><td>${cell('C')}</td><td>${cell('D')}</td></tr>`);
  }
  return `
    <table class="result-table compact">
      <thead><tr><th>Beat</th><th>A</th><th>B</th><th>C</th><th>D</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;
}

export function renderStructuredOutput(runSummaries, rawText) {
  if (!runSummaries.length) return `<div class="empty">Click "Run" to start.</div>`;
  const blocks = runSummaries.map(s => `
    <section class="run-block">
      <h3>${esc(s.label)} — Best: ${esc(s.best.approach)} (${esc(s.best.progression || '(none)')})</h3>
      ${renderApproachTable(s)}
      ${renderBeatTable(s)}
    </section>
  `).join('');
  return `${blocks}
  <details class="raw-log"><summary>Full diagnostic log</summary><pre>${esc(rawText)}</pre></details>`;
}
