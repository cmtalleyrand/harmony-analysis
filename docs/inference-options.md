# Inference Options (Q5) — Precise, Implementable Specification

This document reflects the latest feedback and only retains heuristics that are aligned with the tool’s purpose (identify likely chords from note evidence).

## Current baseline (already in code)

Per-note segment salience:

`salience(seg, decay) = max((seg.duration - PASSING_NOTE_THRESHOLD) * metricMult(seg.onset) * seg.approach, MIN_SALIENCE) * decay`

Per-candidate chord base score:

`score_base = (matchedSalience - nonChordPenalty) * bassMultiplier - complexityPenalty`

Dynamic programming then finds the best sequence across beats.

---

## Option B — Hybrid rules + heuristics (revised)

### 1) Keep: cadential resolution heuristic

For candidate chord `c_t` and previous selected chord `c_{t-1}`:

`H_cad = +0.12` when BOTH are true, otherwise `0`:
- previous chord type in `{dominant_7, diminished, half_dim_7}`;
- current root is a descending fifth or ascending fourth from previous root:
  - `(prevRoot - curRoot) mod 12 == 7` OR `(curRoot - prevRoot) mod 12 == 5`.

### 2) Add: tonic triad target multiplier after cadence

If `H_cad` is active and current chord is a tonic triad (`major` or `minor` on the local tonic root), apply:

`cadentialTonicMult = 1.10`

Applied to the local chord score component for that candidate.

### 3) Replace root-motion heuristic with approach-based salience modulation

Do **not** use generic root-motion penalties/rewards.

Instead, add a note-level approach modifier in the same-voice predecessor relation:

- If note `n_i` is approached from previous note in the **same voice** by perfect fourth/fifth (±5 or ±7 semitones):
  - `approachBonusP4P5 = +0.06` multiplier-equivalent term (implemented as `seg.approach += 0.06` before final salience calculation).
- If note `n_i` is approached by step (±1 or ±2 semitones) in the **lower voice only**:
  - `approachLowerStepPenalty = -0.03` (small reduction to approach term).

This keeps the heuristic tied to note salience evidence rather than chord-progression preference.

### 4) Explicitly removed for now

The following are intentionally out-of-scope at this stage:
- Common-tone continuity heuristic.
- Strong-beat chord-change heuristic (salience already includes metric weighting).
- Flip/flop path penalty.

---

## Meter note (for future rhythm heuristics)

If rhythm-level heuristics are revisited later, strong-beat definitions must be meter-aware:
- `3/4`: beat 1 strong; beats 2–3 weak.
- `9/8`: typically 3 macro-beats (1, 4, 7 eighth positions), with beat-group 1 strongest.

No additional strong-beat transition bonus is recommended at present.

---

## Option C — Probabilistic / ML-assisted ranking

As of now, **no usable corpus is bundled/configured in this repo**, so C remains non-viable for immediate implementation.

Status:
- C is **deferred**.
- B should be implemented/tuned first.

---

## Recommended immediate implementation scope

1. Implement `H_cad` exactly as specified.
2. Implement `cadentialTonicMult = 1.10` target behavior.
3. Implement approach-based salience modulation (P4/P5 bonus and lower-voice step penalty).
4. Keep all other heuristic families disabled.
