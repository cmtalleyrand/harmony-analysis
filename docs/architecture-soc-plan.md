# Architecture / Separation-of-Concerns Plan

This plan defines how to evolve from one large HTML file into a maintainable codebase with fine-grained SoC.

## Goals

1. Clear module boundaries.
2. Centralized constants/configuration.
3. Testable pure logic.
4. UI decoupled from analysis engine.

---

## Proposed target structure

```text
src/
  config/
    analysis-constants.js      # scoring constants, thresholds, penalty weights
    ui-constants.js            # labels, presets, default form values
    feature-flags.js           # phase toggles (heuristics, persistence, etc.)
  domain/
    notes.js                   # SPN parsing, superscript normalization, duration parsing
    meter.js                   # time-signature parsing, metric position helpers
    chords.js                  # chord dictionary, naming, interval utilities
  engine/
    salience.js                # salience computation
    candidate-scoring.js       # base score + (future) heuristic extension
    dp-forward.js
    dp-backward.js
    dp-path-dependent.js
    approaches.js              # A/B/C/D orchestration
  app/
    state.js                   # immutable app state + transitions
    persistence.js             # localStorage save/load
    summary.js                 # comparison card generation
  ui/
    controls.js
    output-view.js
    summary-view.js
    app-shell.js
  index.js                     # composition root
```

---

## Constants centralization plan

Move all magic numbers into `src/config/analysis-constants.js` first, e.g.:
- `DECAY_RATE`
- `PASSING_NOTE_THRESHOLD`
- `MIN_SALIENCE`
- `NON_CHORD_TONE_FLOOR`
- `COMPLEXITY_PENALTY`
- metric weighting values
- heuristic coefficients (future)

Rules:
- No scoring constants hard-coded in engine modules.
- Engine imports constants only from config modules.
- UI labels/presets never mixed into scoring files.

---

## Migration sequence (safe and incremental)

1. **Extract constants first** (no behavior change).
2. Extract domain utilities (`notes`, `meter`, `chords`).
3. Extract scoring and DP engine modules.
4. Add app state + persistence module.
5. Keep a thin UI shell that calls app services.

Each step should preserve behavior and be validated with snapshot-style output checks.

---

## Testing strategy for SoC migration

- Unit tests for pure modules (`notes`, `meter`, `salience`, `candidate-scoring`).
- Golden tests for algorithm outputs on fixed note sequences.
- UI smoke test for run actions + persistence restore.

