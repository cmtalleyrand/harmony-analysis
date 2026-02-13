function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function scoreVal(v) {
  return Number.isFinite(v) ? v : -Infinity;
}

function renderApproachTable(summary) {
  const sorted = [...summary.results].sort((a, b) => scoreVal(b.total) - scoreVal(a.total));
  const bestScore = sorted.length ? scoreVal(sorted[0].total) : -Infinity;
  const rows = sorted.map(r => {
    const total = scoreVal(r.total);
    const delta = Number.isFinite(bestScore) && Number.isFinite(total) ? (bestScore - total) : NaN;
    return `
      <tr>
        <td>${esc(r.approach)}</td>
        <td>${esc(r.progression || '(none)')}</td>
        <td>${Number.isFinite(total) ? total.toFixed(3) : '-'}</td>
        <td>${Number.isFinite(delta) ? (delta === 0 ? '0.000' : delta.toFixed(3)) : '-'}</td>
      </tr>`;
  }).join('');

  return `
    <table class="result-table">
      <thead><tr><th>Approach</th><th>Progression</th><th>Total score</th><th>Δ from best</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderBeatTable(summary) {
  const byApproach = Object.fromEntries(summary.results.map(r => [r.approach, r.path || []]));
  const maxBeats = Math.max(0, ...Object.values(byApproach).map(p => p.length));
  const cell = (a, i) => byApproach[a]?.[i]?.chordName || '-';

  const rows = [];
  for (let i = 0; i < maxBeats; i++) {
    const picks = ['A', 'B', 'C', 'D'].map(a => cell(a, i));
    const counts = new Map();
    for (const p of picks) counts.set(p, (counts.get(p) || 0) + 1);
    let winner = '-';
    let agree = 0;
    for (const [name, count] of counts.entries()) {
      if (count > agree) {
        winner = name;
        agree = count;
      }
    }
    rows.push(`<tr><td>${i}</td><td>${esc(winner)}</td><td>${agree}/4</td><td>${esc(picks[0])}</td><td>${esc(picks[1])}</td><td>${esc(picks[2])}</td><td>${esc(picks[3])}</td></tr>`);
  }

  return `
    <table class="result-table compact">
      <thead><tr><th>Beat</th><th>Majority pick</th><th>Agreement</th><th>A</th><th>B</th><th>C</th><th>D</th></tr></thead>
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
  <details class="raw-log"><summary>Diagnostic log (optional)</summary><pre>${esc(rawText)}</pre></details>`;
}
