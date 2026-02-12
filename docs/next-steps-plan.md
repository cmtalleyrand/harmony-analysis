# Next Steps Plan

This plan is intentionally in a standalone document (not README).

## Confirmed direction snapshot

- Q7 UI answer: **B — Split view (controls + readable analysis panes)**.
- Meter: user-selectable time signature.
- Input: manual entry with enhanced notation support (`L:` default length, per-note duration suffix, superscript octave).
- Explainability: summary first with deep drill-down.
- Algorithm evaluation: keep side-by-side comparison.

---

## Phase 1 (implemented)

1. **Input parsing upgrades**
   - Superscript octave parsing (`C⁴`).
   - Optional `L:x/y` default duration declaration.
   - Per-note duration multiplier suffix (`C⁴4`, `Eb⁴6`).

2. **Time-signature support**
   - Meter selector in UI.
   - Metric weighting uses selected meter.
   - Note preprocessing splits on meter beat boundaries.

3. **UX copy updates**
   - Help text includes new notation examples.

---

## Phase 2 (implemented)

1. **Q7-B split-view UI realization**
   - Left panel: controls/presets/help.
   - Right panel: comparison summary + full diagnostic output.

2. **Algorithm comparison summary panel**
   - Per-run cards with A/B/C/D totals.
   - Best approach/progression highlighted.

3. **Local persistence (Q15B)**
   - Saves and restores form settings.
   - Saves and restores summary + output text via localStorage.

---

## Phase 3 (next)

1. **Constants centralization and SoC refactor**
   - Move scoring constants into dedicated config module.
   - Split parser/meter/chord/engine/UI into separate modules.
   - See: `docs/architecture-soc-plan.md`.

2. **Inference option B implementation (narrow scope)**
   - Implement cadence-resolution heuristic and cadential tonic multiplier.
   - Implement note-approach salience modulation (P4/P5 same-voice bonus, lower-voice step penalty).
   - Keep common-tone, strong-beat transition, and flip-penalty heuristics disabled.

3. **Inference option C decision gate**
   - Keep deferred until a corpus is selected and ingested.

