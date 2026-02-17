# Harmony Analysis

## Current app summary (what exists today)

`harmonic-lab-new.html` is a self-contained, browser-based harmonic analysis sandbox with no build step or external dependencies.

### What users can do
- Enter one or two monophonic voices in SPN note format (e.g., `C4 Eb4 F#4`).
- Choose per-voice rhythmic duration (half, quarter, eighth, sixteenth).
- Choose time signature.
- Run either:
  - **All durations** for voice 1, or
  - **One selected duration setup** for both voices.
- Start quickly from several presets.

### What the engine does
- Parses SPN into MIDI and merges voices into a timeline.
- Splits notes across beat boundaries, computes note salience from:
  - duration,
  - metric position,
  - melodic approach interval,
  - temporal decay.
- Scores candidate chords over a chord vocabulary (triads + seventh/sixth families).
- Applies chord complexity penalties and non-chord-tone penalties.
- Runs four competing harmonic inference approaches:
  - **A:** Bidirectional collection + path-dependent boundary DP,
  - **B:** Forward+Backward combined, two-pass constrained DP,
  - **C:** Forward-only two-pass constrained DP,
  - **D:** Past-only collection + path-dependent boundary DP.
- Prints detailed diagnostics (top harmonies per beat, per-chord contribution details, non-harmonized notes, final progression).

---

## Captured direction decisions

- Primary persona: **composers**.
- Primary JTBD: **identify harmonies quickly, then drill down when needed**.
- Default output: **verbose diagnostics with drill-down**.
- Meter direction: **user-selectable time signatures**.
- Algorithm comparison: **keep side-by-side A/B/C/D comparison**.
- UI direction (Q7): **B — split view: controls + readable analysis panes**.
- Performance target: **medium passages with snappy interaction**.
- Success emphasis: **interpretability + ability to assess algorithms**.
- Harmony vocabulary now: **keep current triads + 6ths/7ths**.
- Persistence target: **save/load local sessions**.

---

## Planning and design docs

- Detailed inference strategy implementation notes (Q5 B vs C):
  - [`docs/inference-options.md`](docs/inference-options.md)
- Next-step execution plan (separate from README):
  - [`docs/next-steps-plan.md`](docs/next-steps-plan.md)
- Architecture and fine-grained separation-of-concerns plan:
  - [`docs/architecture-soc-plan.md`](docs/architecture-soc-plan.md)
- Delivery protocol designed to minimize admin overhead:
  - [`docs/delivery-protocol.md`](docs/delivery-protocol.md)

---

## Merge-conflict help

If GitHub shows **"This branch has conflicts"**, follow:

- [`docs/conflict-resolution.md`](docs/conflict-resolution.md)

It provides exact CLI steps to reproduce conflicts locally, resolve them file-by-file, validate, and push a clean merge-resolution commit.


### If the live page looks outdated

- Check the build tag in the app header (top-right).
- Hard refresh the page (or open in a private tab) to bypass tablet cache.
- Verify your latest commit has completed the `Deploy static site to GitHub Pages` workflow.
