import { ANALYSIS_CONSTANTS, CHORD_TYPES, NOTE_NAMES, TYPE_SHORT, STORE_KEY } from '../config/constants.js';
import { renderStructuredOutput } from '../ui/output-format.js';

const { DECAY_RATE, PASSING_NOTE_THRESHOLD, MIN_SALIENCE, NON_CHORD_TONE_FLOOR, COMPLEXITY_PENALTY } = ANALYSIS_CONSTANTS;


// ═══════════════════════════════════════════════════════════════════════════════
// Harmonic Analysis Lab — SPN input, two voices, full detail
// ═══════════════════════════════════════════════════════════════════════════════

function cn(root, type) { return NOTE_NAMES[root] + (TYPE_SHORT[type] ?? type); }
function pcName(pc) { return NOTE_NAMES[((pc % 12) + 12) % 12]; }

let CURRENT_METER = { num: 4, den: 4, beatLen: 1, barLen: 4 };

function parseTimeSig(sig) {
  const m = String(sig || '').match(/^(\d+)\/(\d+)$/);
  if (!m) throw new Error(`Invalid time signature "${sig}".`);
  const num = parseInt(m[1], 10);
  const den = parseInt(m[2], 10);
  const beatLen = 4 / den;
  return { num, den, beatLen, barLen: num * beatLen };
}

function setTimeSignature(sig) {
  CURRENT_METER = parseTimeSig(sig);
}

// ─── SPN parsing ──────────────────────────────────────────────────────────

const SUPER_TO_ASCII = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-' };

function normalizeSuperscriptOctave(str) {
  return str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, ch => SUPER_TO_ASCII[ch] ?? ch);
}

/** Parse "C4", "Eb3", "F#5", "Bb2" etc. to MIDI pitch. Returns null on failure. */
function parseSPN(str) {
  const src = normalizeSuperscriptOctave(str);
  const m = src.match(/^([A-Ga-g])(#{1,2}|b{1,2})?(-?\d)$/);
  if (!m) return null;
  const base = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  let pc = base[m[1].toUpperCase()];
  if (pc === undefined) return null;
  const acc = m[2] || '';
  if (acc === '#') pc += 1;
  else if (acc === '##') pc += 2;
  else if (acc === 'b') pc -= 1;
  else if (acc === 'bb') pc -= 2;
  const octave = parseInt(m[3], 10);
  return (octave + 1) * 12 + pc;
}

function parseNoteToken(token) {
  const src = normalizeSuperscriptOctave(token);
  const m = src.match(/^([A-Ga-g])(#{1,2}|b{1,2})?(-?\d)(\d+(?:\.\d+)?)?$/);
  if (!m) return null;
  const note = `${m[1]}${m[2] || ''}${m[3]}`;
  const pitch = parseSPN(note);
  if (pitch === null) return null;
  const mult = m[4] ? parseFloat(m[4]) : null;
  if (mult !== null && (!Number.isFinite(mult) || mult <= 0)) return null;
  return { pitch, mult };
}

function parseLengthDecl(token) {
  const m = token.match(/^L:(\d+)\/(\d+)$/i);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  const den = parseInt(m[2], 10);
  if (num <= 0 || den <= 0) throw new Error(`Invalid length declaration "${token}".`);
  // 1 quarter note = 1 beat in the app's internal timeline
  return 4 * num / den;
}

/** Format MIDI pitch as SPN string for display. */
function midiToSPN(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return NOTE_NAMES[pc] + oct;
}

/** Parse a voice input string. Returns array of {pitch, onset, duration} or throws. */
function parseVoice(str, defaultDuration) {
  const tokens = str.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const notes = [];
  let onset = 0;
  let baseDuration = defaultDuration;
  for (const tok of tokens) {
    const len = parseLengthDecl(tok);
    if (len !== null) { baseDuration = len; continue; }
    const parsed = parseNoteToken(tok);
    if (!parsed) throw new Error(`Cannot parse note "${tok}". Use SPN (C4/Eb3/F#5), optional superscript octave (C⁴), optional L:x/y, optional duration multiplier suffix.`);
    const duration = baseDuration * (parsed.mult ?? 1);
    notes.push({ pitch: parsed.pitch, onset, duration });
    onset += duration;
  }
  return notes;
}

/** Merge two voice note arrays into one sorted list. */
function mergeVoices(v1notes, v2notes) {
  const all = [...v1notes, ...v2notes];
  all.sort((a, b) => a.onset - b.onset || a.pitch - b.pitch);
  return all;
}

// ─── metric weight (time-signature aware) ───────────────────────────────────

function metricMult(onset) {
  const { barLen, beatLen, num } = CURRENT_METER;
  const eps = 0.01;
  const pos = ((onset % barLen) + barLen) % barLen;
  if (pos < eps || Math.abs(pos - barLen) < eps) return 1.2;

  // Secondary accent (where musically plausible)
  if (num >= 4 && num % 2 === 0 && Math.abs(pos - (barLen / 2)) < eps) return 1.0;

  const beatPos = (pos / beatLen) % 1;
  if (beatPos < eps || Math.abs(beatPos - 1) < eps) return 0.75;

  const halfBeat = beatLen / 2;
  if (halfBeat > 0 && Math.abs((pos / halfBeat) % 1) < eps) return 0.5;

  return 0.4;
}

function approachMult(interval) {
  if (interval === null) return 1.0;
  const a = Math.abs(interval);
  if (a === 0) return 1.0;
  if (a <= 2) return 0.8;
  if (a <= 4) return 1.0;
  if (a === 5 || a === 7 || a === 12) return 1.2;
  return 1.0;
}

/**
 * Preprocess: split notes at beat boundaries.
 * For multi-voice, notes is already the merged array.
 * Approach multiplier computed per-voice (consecutive notes in same voice).
 */
function preprocessNotes(notes) {
  const segments = [];
  // Group by voice for approach calculation: notes at same onset are different voices
  // Simple heuristic: for each note, find previous note with strictly earlier onset
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    // Find the previous note at a strictly earlier onset (in any voice, closest onset)
    let prev = null;
    for (let j = i - 1; j >= 0; j--) {
      if (notes[j].onset < note.onset) { prev = notes[j]; break; }
    }
    const app = approachMult(prev ? note.pitch - prev.pitch : null);
    const end = note.onset + note.duration;
    let cursor = note.onset;
    while (cursor < end - 1e-9) {
      const beatIndex = Math.floor(cursor / CURRENT_METER.beatLen);
      const nextBoundary = (beatIndex + 1) * CURRENT_METER.beatLen;
      const e = Math.min(end, nextBoundary);
      if (e <= cursor) break;
      segments.push({ pitch: note.pitch, pitchClass: ((note.pitch % 12) + 12) % 12, onset: cursor, duration: e - cursor, approach: app });
      cursor = e;
    }
  }
  segments.sort((a, b) => a.onset - b.onset || a.pitch - b.pitch);
  return segments;
}

// ─── salience & collection ────────────────────────────────────────────────

function salience(seg, decay) {
  const raw = (seg.duration - PASSING_NOTE_THRESHOLD) * metricMult(seg.onset) * seg.approach;
  return Math.max(raw, MIN_SALIENCE) * decay;
}

function collectPast(segments, beat) {
  const out = [];
  for (const seg of segments) {
    const sb = Math.floor(seg.onset);
    if (sb > beat) break;
    const dist = beat - sb;
    const d = Math.max(1.0 - dist * DECAY_RATE, 0);
    if (d <= 0) continue;
    out.push({ pitchClass: seg.pitchClass, pitch: seg.pitch, salience: salience(seg, d), onset: seg.onset, decay: d });
  }
  return out;
}

function collectBidirectional(segments, beat) {
  const out = [];
  for (const seg of segments) {
    const sb = Math.floor(seg.onset);
    const dist = Math.abs(beat - sb);
    const d = Math.max(1.0 - dist * DECAY_RATE, 0);
    if (d <= 0) continue;
    out.push({ pitchClass: seg.pitchClass, pitch: seg.pitch, salience: salience(seg, d), onset: seg.onset, decay: d });
  }
  return out;
}

// ─── chord scoring ────────────────────────────────────────────────────────

function memberWeight(interval) {
  const n = ((interval % 12) + 12) % 12;
  if (n === 0) return 1.1;
  if (n === 3 || n === 4) return 1.0;
  if (n === 7 || n === 10 || n === 11) return 0.8;
  return 0.6;
}

function scoreChord(root, typeName, notes, positiveOnly) {
  const def = CHORD_TYPES[typeName];
  const pcs = new Set(notes.map(n => n.pitchClass));
  for (const req of def.required) { if (!pcs.has((root + req) % 12)) return null; }
  if (notes.length < 2) return null;
  let matchedSal = 0, nctPen = 0;
  const matched = [], nct = [];
  let lowestPitch = Infinity, lowestInterval = null;
  for (const n of notes) {
    if (n.pitch < lowestPitch) { lowestPitch = n.pitch; lowestInterval = ((n.pitchClass - root) + 12) % 12; }
  }
  for (const n of notes) {
    const iv = ((n.pitchClass - root) + 12) % 12;
    if (def.intervals.includes(iv)) {
      const w = memberWeight(iv);
      matchedSal += n.salience * w;
      matched.push({ onset: n.onset, pc: n.pitchClass, pitch: n.pitch, sal: n.salience, w, contrib: n.salience * w });
    } else {
      const p = positiveOnly ? 0 : Math.max(n.salience - NON_CHORD_TONE_FLOOR, 0);
      nctPen += p;
      nct.push({ onset: n.onset, pc: n.pitchClass, pitch: n.pitch, sal: n.salience, pen: p });
    }
  }
  let bassMult = 1.0;
  if (lowestInterval === 0) bassMult = 1.1;
  else if (lowestInterval === 7) bassMult = 0.9;
  else if (lowestInterval === 10 || lowestInterval === 11) bassMult = 0.8;
  const score = (matchedSal - nctPen) * bassMult;
  return { score, matched, nct, matchedSal, nctPen, bassMult, complexity: def.complexity };
}

function findCandidates(notes, positiveOnly) {
  const pcs = new Set(notes.map(n => n.pitchClass));
  const cands = [];
  for (let root = 0; root < 12; root++) {
    if (!pcs.has(root)) continue;
    for (const [t] of Object.entries(CHORD_TYPES)) {
      const r = scoreChord(root, t, notes, positiveOnly);
      if (r) cands.push({ root, type: t, ...r });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  return cands;
}

// ─── standard forward/backward DP ─────────────────────────────────────────

function forwardDP(beatData) {
  const n = beatData.length;
  const dp = Array.from({ length: n }, () => new Map());
  for (let b = 0; b < n; b++) {
    const cands = beatData[b];
    if (b === 0) {
      dp[0].set('null', { total: 0, prev: null, chord: null, chain: 0 });
      for (const c of cands) {
        dp[0].set(c.key, { total: c.score - c.complexity * COMPLEXITY_PENALTY, prev: null, chord: c, chain: 1 });
      }
      continue;
    }
    let bestNullTotal = -Infinity, bestNullPrev = null;
    for (const [pk, ps] of dp[b - 1]) {
      if (ps.total > bestNullTotal) { bestNullTotal = ps.total; bestNullPrev = pk; }
    }
    dp[b].set('null', { total: bestNullTotal, prev: bestNullPrev, chord: null, chain: 0 });
    for (const c of cands) {
      let bestTotal = -Infinity, bestPrev = null, bestChain = 1;
      for (const [pk, ps] of dp[b - 1]) {
        const same = ps.chord && ps.chord.root === c.root && ps.chord.type === c.type;
        const chain = same ? ps.chain + 1 : 1;
        const t = ps.total + c.score - c.complexity * COMPLEXITY_PENALTY;
        if (t > bestTotal) { bestTotal = t; bestPrev = pk; bestChain = chain; }
      }
      const existing = dp[b].get(c.key);
      if (!existing || bestTotal > existing.total) {
        dp[b].set(c.key, { total: bestTotal, prev: bestPrev, chord: c, chain: bestChain });
      }
    }
  }
  return dp;
}

function backtrack(dp) {
  const n = dp.length;
  let bestKey = null, bestTotal = -Infinity;
  for (const [k, s] of dp[n - 1]) { if (s.total > bestTotal) { bestTotal = s.total; bestKey = k; } }
  const path = [];
  let cur = bestKey;
  for (let b = n - 1; b >= 0; b--) {
    const s = dp[b].get(cur);
    path.unshift({ beat: b, key: cur, chord: s.chord, total: s.total, chain: s.chain });
    cur = s.prev;
  }
  return path;
}

function backwardDP(beatData) {
  const n = beatData.length;
  const dp = Array.from({ length: n }, () => new Map());
  for (let b = n - 1; b >= 0; b--) {
    const cands = beatData[b];
    if (b === n - 1) {
      dp[b].set('null', { total: 0, next: null, chord: null, chain: 0 });
      for (const c of cands) {
        dp[b].set(c.key, { total: c.score - c.complexity * COMPLEXITY_PENALTY, next: null, chord: c, chain: 1 });
      }
      continue;
    }
    let bestNullTotal = -Infinity, bestNullNext = null;
    for (const [nk, ns] of dp[b + 1]) {
      if (ns.total > bestNullTotal) { bestNullTotal = ns.total; bestNullNext = nk; }
    }
    dp[b].set('null', { total: bestNullTotal, next: bestNullNext, chord: null, chain: 0 });
    for (const c of cands) {
      let bestTotal = -Infinity, bestNext = null, bestChain = 1;
      for (const [nk, ns] of dp[b + 1]) {
        const same = ns.chord && ns.chord.root === c.root && ns.chord.type === c.type;
        const chain = same ? ns.chain + 1 : 1;
        const t = ns.total + c.score - c.complexity * COMPLEXITY_PENALTY;
        if (t > bestTotal) { bestTotal = t; bestNext = nk; bestChain = chain; }
      }
      const existing = dp[b].get(c.key);
      if (!existing || bestTotal > existing.total) {
        dp[b].set(c.key, { total: bestTotal, next: bestNext, chord: c, chain: bestChain });
      }
    }
  }
  return dp;
}

// ─── path-dependent DP ────────────────────────────────────────────────────

function pathDependentDP(segments, numBeats, collectFn) {
  const dp = Array.from({ length: numBeats }, () => new Map());
  for (let b = 0; b < numBeats; b++) {
    const allNotes = collectFn(segments, b);
    if (b === 0) {
      dp[0].set('null|-Inf', { total: 0, prevSK: null, chord: null, chain: 0, boundary: -Infinity });
      const cands = findCandidates(allNotes);
      for (const c of cands) {
        const bnd = c.matched.length > 0 ? Math.max(...c.matched.map(m => m.onset)) : -Infinity;
        const sk = `${c.root}-${c.type}|${bnd}`;
        const t = c.score - c.complexity * COMPLEXITY_PENALTY;
        const ex = dp[0].get(sk);
        if (!ex || t > ex.total) {
          dp[0].set(sk, { total: t, prevSK: null, chord: c, chain: 1, boundary: bnd });
        }
      }
      continue;
    }
    const updates = new Map();
    for (const [prevSK, prevState] of dp[b - 1]) {
      const prevChord = prevState.chord;
      const prevBoundary = prevState.boundary;
      const prevCK = prevChord ? `${prevChord.root}-${prevChord.type}` : 'null';
      {
        const sk = `null|${prevBoundary}`;
        const ex = updates.get(sk);
        if (!ex || prevState.total > ex.total) {
          updates.set(sk, { total: prevState.total, prevSK, chord: null, chain: 0, boundary: prevBoundary });
        }
      }
      const pcsAll = new Set(allNotes.map(n => n.pitchClass));
      for (let root = 0; root < 12; root++) {
        if (!pcsAll.has(root)) continue;
        for (const [typeName] of Object.entries(CHORD_TYPES)) {
          const candCK = `${root}-${typeName}`;
          const same = (candCK === prevCK);
          const filtered = same ? allNotes : allNotes.filter(n => n.onset > prevBoundary);
          const result = scoreChord(root, typeName, filtered);
          if (!result) continue;
          const chain = same ? prevState.chain + 1 : 1;
          const t = prevState.total + result.score - result.complexity * COMPLEXITY_PENALTY;
          const bnd = result.matched.length > 0 ? Math.max(...result.matched.map(m => m.onset)) : prevBoundary;
          const sk = `${candCK}|${bnd}`;
          const ex = updates.get(sk);
          if (!ex || t > ex.total) {
            updates.set(sk, { total: t, prevSK, chord: { key: candCK, root, type: typeName, ...result }, chain, boundary: bnd });
          }
        }
      }
    }
    dp[b] = updates;
  }
  const n = numBeats;
  let bestSK = null, bestTotal = -Infinity;
  for (const [sk, s] of dp[n - 1]) { if (s.total > bestTotal) { bestTotal = s.total; bestSK = sk; } }
  const path = [];
  let cur = bestSK;
  for (let b = n - 1; b >= 0; b--) {
    const s = dp[b].get(cur);
    path.unshift({ beat: b, key: s.chord ? `${s.chord.root}-${s.chord.type}` : 'null', chord: s.chord, total: s.total, chain: s.chain, boundary: s.boundary });
    cur = s.prevSK;
  }
  return { dp, path };
}

// ─── four approaches ──────────────────────────────────────────────────────

function approachA(segments, numBeats) {
  return pathDependentDP(segments, numBeats, collectBidirectional);
}

function approachB(segments, numBeats) {
  // Pass 1: positive-only (no unharmonised penalties — assignment not yet known)
  const p1BeatData = [];
  for (let b = 0; b < numBeats; b++) {
    const notes = collectPast(segments, b);
    const cands = findCandidates(notes, true);
    p1BeatData.push(cands.map(c => ({ key: `${c.root}-${c.type}`, ...c })));
  }
  const fwd = forwardDP(p1BeatData);
  const bwd = backwardDP(p1BeatData);
  const p1path = [];
  for (let b = 0; b < numBeats; b++) {
    let bestKey = 'null', bestCombined = -Infinity, bestChord = null;
    for (const [key, fs] of fwd[b]) {
      const bs = bwd[b].get(key);
      if (!bs) continue;
      const localScore = fs.chord ? fs.chord.score - fs.chord.complexity * COMPLEXITY_PENALTY : 0;
      const combined = fs.total + bs.total - localScore;
      if (combined > bestCombined) { bestCombined = combined; bestKey = key; bestChord = fs.chord; }
    }
    p1path.push({ beat: b, key: bestKey, chord: bestChord, total: bestCombined });
  }
  const p1info = p1path.map(p => {
    if (!p.chord) return { chordKey: 'null', matchedOnsets: [] };
    return { chordKey: p.key, matchedOnsets: p.chord.matched.map(m => m.onset) };
  });
  const p2BeatData = [];
  for (let b = 0; b < numBeats; b++) {
    const allNotes = collectPast(segments, b);
    const pcs = new Set(allNotes.map(n => n.pitchClass));
    const cands = [];
    for (let root = 0; root < 12; root++) {
      if (!pcs.has(root)) continue;
      for (const [typeName] of Object.entries(CHORD_TYPES)) {
        const candKey = `${root}-${typeName}`;
        let boundary = -Infinity;
        for (let pb = 0; pb < b; pb++) {
          if (p1info[pb].chordKey === candKey || p1info[pb].chordKey === 'null') continue;
          for (const onset of p1info[pb].matchedOnsets) { if (onset > boundary) boundary = onset; }
        }
        const filtered = allNotes.filter(n => {
          const noteBeat = Math.floor(n.onset);
          if (noteBeat < p1info.length && p1info[noteBeat].chordKey === candKey) return true;
          if (n.onset > boundary) return true;
          return false;
        });
        const result = scoreChord(root, typeName, filtered);
        if (result) cands.push({ key: candKey, root, type: typeName, ...result });
      }
    }
    cands.sort((a, b) => b.score - a.score);
    p2BeatData.push(cands);
  }
  const p2dp = forwardDP(p2BeatData);
  return { p1path, fwd, bwd, p2dp, path: backtrack(p2dp), p1BeatData, p2BeatData };
}

function approachC(segments, numBeats) {
  // Pass 1: positive-only (no unharmonised penalties — assignment not yet known)
  const p1BeatData = [];
  for (let b = 0; b < numBeats; b++) {
    const notes = collectPast(segments, b);
    const cands = findCandidates(notes, true);
    p1BeatData.push(cands.map(c => ({ key: `${c.root}-${c.type}`, ...c })));
  }
  const p1dp = forwardDP(p1BeatData);
  const p1path = backtrack(p1dp);
  const p1info = p1path.map(p => {
    if (!p.chord) return { chordKey: 'null', matchedOnsets: [] };
    return { chordKey: p.key, matchedOnsets: p.chord.matched.map(m => m.onset) };
  });
  const p2BeatData = [];
  for (let b = 0; b < numBeats; b++) {
    const allNotes = collectPast(segments, b);
    const pcs = new Set(allNotes.map(n => n.pitchClass));
    const cands = [];
    for (let root = 0; root < 12; root++) {
      if (!pcs.has(root)) continue;
      for (const [typeName] of Object.entries(CHORD_TYPES)) {
        const candKey = `${root}-${typeName}`;
        let boundary = -Infinity;
        for (let pb = 0; pb < b; pb++) {
          if (p1info[pb].chordKey === candKey || p1info[pb].chordKey === 'null') continue;
          for (const onset of p1info[pb].matchedOnsets) { if (onset > boundary) boundary = onset; }
        }
        const filtered = allNotes.filter(n => {
          const noteBeat = Math.floor(n.onset);
          if (noteBeat < p1info.length && p1info[noteBeat].chordKey === candKey) return true;
          if (n.onset > boundary) return true;
          return false;
        });
        const result = scoreChord(root, typeName, filtered);
        if (result) cands.push({ key: candKey, root, type: typeName, ...result });
      }
    }
    cands.sort((a, b) => b.score - a.score);
    p2BeatData.push(cands);
  }
  const p2dp = forwardDP(p2BeatData);
  return { p1path, p1dp, p2dp, path: backtrack(p2dp), p1BeatData, p2BeatData };
}

function approachD(segments, numBeats) {
  return pathDependentDP(segments, numBeats, collectPast);
}

// ─── harmony display helpers ──────────────────────────────────────────────

let lines = [];
let runSummaries = [];

const APP_BUILD = '2026-02-13-1';
function log(s) { lines.push(s); }

/** Backtrack path-dependent DP from a state at beat b. */
function backtrackPD(dp, beat, stateKey) {
  const path = [];
  let cur = stateKey;
  for (let b = beat; b >= 0; b--) {
    const s = dp[b].get(cur);
    if (!s) break;
    path.unshift({ beat: b, chord: s.chord, boundary: s.boundary, total: s.total });
    cur = s.prevSK;
  }
  return path;
}

/** Backtrack simple DP from a state at beat b. */
function backtrackFrom(dp, beat, key) {
  const path = [];
  let cur = key;
  for (let b = beat; b >= 0; b--) {
    const s = dp[b].get(cur);
    if (!s) break;
    path.unshift({ beat: b, chord: s.chord, total: s.total });
    cur = s.prev;
  }
  return path;
}

/** Format a harmony path as a chord progression string. */
function fmtHarmony(path) {
  const parts = [];
  for (const p of path) {
    const name = p.chord ? cn(p.chord.root, p.chord.type) : '-';
    const last = parts[parts.length - 1];
    if (last && last.name === name) last.count++;
    else parts.push({ name, count: 1 });
  }
  return parts.filter(p => p.name !== '-')
    .map(p => p.count > 1 ? `${p.name}(x${p.count})` : p.name)
    .join(' -> ') || '(none)';
}

/** Collect all unharmonised notes across a full harmony path. */
function getUnharmonised(path) {
  const notes = [];
  for (const p of path) {
    if (p.chord && p.chord.nct) {
      for (const n of p.chord.nct) {
        if (n.pen > 0) notes.push(n);
      }
    }
  }
  return notes;
}

/** Format a chord's scoring detail. */
function fmtChordDetail(chord) {
  if (!chord) return '(null)';
  const name = cn(chord.root, chord.type);
  const matchStr = chord.matched.map(m =>
    `${midiToSPN(m.pitch)}@${m.onset}: sal=${m.sal.toFixed(3)} * w=${m.w} = ${m.contrib.toFixed(3)}`
  ).join(', ');
  const unhStr = chord.nct.filter(n => n.pen > 0).map(n =>
    `${midiToSPN(n.pitch)}@${n.onset}: sal=${n.sal.toFixed(3)} pen=${n.pen.toFixed(3)}`
  ).join(', ');
  let s = `${name}  local=${chord.score.toFixed(3)}  cplx=${chord.complexity}  bass=${chord.bassMult.toFixed(1)}`;
  s += `\n               matched: [${matchStr}]`;
  if (unhStr) s += `\n               unharmonised: [${unhStr}]`;
  return s;
}

/** Show one harmony entry with full detail. */
function showHarmonyEntry(idx, path, total) {
  const prog = fmtHarmony(path);
  const unh = getUnharmonised(path);
  const unhStr = unh.length > 0
    ? unh.map(n => `${midiToSPN(n.pitch)}@${n.onset}(${n.pen.toFixed(3)})`).join(', ')
    : '(none)';
  log(`      #${idx}  ${prog}    total=${total.toFixed(3)}`);

  // Show each chord in the path
  const seen = new Set();
  for (const p of path) {
    if (!p.chord) continue;
    const key = `${p.beat}-${p.chord.root}-${p.chord.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const name = cn(p.chord.root, p.chord.type);
    const bndStr = p.boundary !== undefined ? `  bnd=${p.boundary}` : '';
    log(`            beat ${p.beat}: ${fmtChordDetail(p.chord)}${bndStr}`);
  }
  log(`            unharmonised in harmony: [${unhStr}]`);
}

// ─── approach display: path-dependent (A, D) ─────────────────────────────

function showApproachPD(label, dp, bestPath, numBeats) {
  log(`\n  ${label}`);

  for (let b = 0; b < numBeats; b++) {
    const map = dp[b];
    const states = [...map.entries()]
      .filter(([k]) => !k.startsWith('null'))
      .sort((a, b) => b[1].total - a[1].total);

    if (states.length === 0) { log(`    beat ${b}: (no candidates)`); continue; }

    log(`    beat ${b}:`);

    // (a) Top 3 harmonies up to this beat
    log(`      Top 3 harmonies to this beat:`);
    const shown = Math.min(3, states.length);
    for (let i = 0; i < shown; i++) {
      const [sk, s] = states[i];
      const path = backtrackPD(dp, b, sk);
      showHarmonyEntry(i + 1, path, s.total);
    }

    // (c) Best harmony for each of top 3 chords
    const byChord = new Map();
    for (const [sk, s] of states) {
      if (!s.chord) continue;
      const ck = `${s.chord.root}-${s.chord.type}`;
      const ex = byChord.get(ck);
      if (!ex || s.total > ex.total) byChord.set(ck, { sk, s });
    }
    const topChords = [...byChord.entries()]
      .sort((a, b) => b[1].s.total - a[1].s.total)
      .slice(0, 3);

    log(`      Best harmony per chord:`);
    for (const [ck, { sk, s }] of topChords) {
      const name = cn(s.chord.root, s.chord.type);
      const path = backtrackPD(dp, b, sk);
      log(`        ${name.padEnd(8)} via ${fmtHarmony(path).padEnd(24)} total=${s.total.toFixed(3)}`);
    }
  }

  // (b) Top 3 harmonies overall (at final beat)
  const lastMap = dp[numBeats - 1];
  const finalStates = [...lastMap.entries()]
    .filter(([k]) => !k.startsWith('null'))
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 3);

  log(`\n    Top 3 complete harmonies:`);
  for (let i = 0; i < finalStates.length; i++) {
    const [sk, s] = finalStates[i];
    const path = backtrackPD(dp, numBeats - 1, sk);
    showHarmonyEntry(i + 1, path, s.total);
  }

  // Best path result
  const prog = fmtHarmony(bestPath);
  log(`\n  RESULT: ${prog}  (total=${bestPath[bestPath.length - 1].total.toFixed(3)})`);
}

// ─── approach display: simple DP (B, C pass 2) ───────────────────────────

function showApproachSimple(label, dp, bestPath, numBeats) {
  log(`\n  ${label}`);

  for (let b = 0; b < numBeats; b++) {
    const map = dp[b];
    const states = [...map.entries()]
      .filter(([k]) => k !== 'null')
      .sort((a, b) => b[1].total - a[1].total);

    if (states.length === 0) { log(`    beat ${b}: (no candidates)`); continue; }

    log(`    beat ${b}:`);

    // (a) Top 3 harmonies to this beat
    log(`      Top 3 harmonies to this beat:`);
    const shown = Math.min(3, states.length);
    for (let i = 0; i < shown; i++) {
      const [key, s] = states[i];
      const path = backtrackFrom(dp, b, key);
      showHarmonyEntry(i + 1, path, s.total);
    }

    // (c) Best harmony per chord (for simple DP, key = chord, so top 3 states = top 3 chords)
    log(`      Best harmony per chord:`);
    for (let i = 0; i < shown; i++) {
      const [key, s] = states[i];
      if (!s.chord) continue;
      const name = cn(s.chord.root, s.chord.type);
      const path = backtrackFrom(dp, b, key);
      log(`        ${name.padEnd(8)} via ${fmtHarmony(path).padEnd(24)} total=${s.total.toFixed(3)}`);
    }
  }

  // (b) Top 3 complete harmonies
  const lastMap = dp[numBeats - 1];
  const finalStates = [...lastMap.entries()]
    .filter(([k]) => k !== 'null')
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 3);

  log(`\n    Top 3 complete harmonies:`);
  for (let i = 0; i < finalStates.length; i++) {
    const [key, s] = finalStates[i];
    const path = backtrackFrom(dp, numBeats - 1, key);
    showHarmonyEntry(i + 1, path, s.total);
  }

  const prog = fmtHarmony(bestPath);
  log(`\n  RESULT: ${prog}  (total=${bestPath[bestPath.length - 1].total.toFixed(3)})`);
}

// ─── run ──────────────────────────────────────────────────────────────────

function runTestFromNotes(allNotes, label) {
  const segments = preprocessNotes(allNotes);
  const maxEnd = Math.max(...allNotes.map(n => n.onset + n.duration));
  const numBeats = Math.ceil(maxEnd);

  const noteDesc = allNotes.map(n => midiToSPN(n.pitch)).join(' ');
  log(`\n${'='.repeat(78)}`);
  log(`  ${label}  (${noteDesc}, ${numBeats} beats)`);
  log('='.repeat(78));

  log('\n  Notes per beat:');
  for (let b = 0; b < numBeats; b++) {
    const past = collectPast(segments, b);
    const desc = past.map(n =>
      `${midiToSPN(n.pitch)}@${n.onset}(sal=${n.salience.toFixed(3)}, decay=${n.decay.toFixed(1)})`
    ).join('  ');
    log(`    beat ${b}: ${desc}`);
  }

  const a = approachA(segments, numBeats);
  showApproachPD('A - Bidirectional + path-dependent boundary', a.dp, a.path, numBeats);

  const bRes = approachB(segments, numBeats);
  log(`\n  B - Fwd+Bwd combined two-pass`);
  log(`    Pass 1 (positive-only, fwd+bwd): ${bRes.p1path.map(p => p.chord ? cn(p.chord.root, p.chord.type) : '-').join(' | ')}`);
  showApproachSimple('    Pass 2 (constrained, full scoring):', bRes.p2dp, bRes.path, numBeats);

  const c = approachC(segments, numBeats);
  log(`\n  C - Forward-only two-pass`);
  log(`    Pass 1 (positive-only, fwd): ${c.p1path.map(p => p.chord ? cn(p.chord.root, p.chord.type) : '-').join(' | ')}`);
  showApproachSimple('    Pass 2 (constrained, full scoring):', c.p2dp, c.path, numBeats);

  const d = approachD(segments, numBeats);
  showApproachPD('D - Path-dependent boundary (past-only)', d.dp, d.path, numBeats);

  const results = [
    { approach: 'A', path: a.path },
    { approach: 'B', path: bRes.path },
    { approach: 'C', path: c.path },
    { approach: 'D', path: d.path },
  ].map(r => ({
    approach: r.approach,
    progression: fmtHarmony(r.path),
    total: r.path[r.path.length - 1]?.total ?? -Infinity,
    path: r.path.map(p => ({ beat: p.beat, chordName: p.chord ? cn(p.chord.root, p.chord.type) : '-' })),
  }));
  const best = results.reduce((acc, r) => r.total > acc.total ? r : acc, results[0]);
  return { label, results, best };
}

// ─── UI ───────────────────────────────────────────────────────────────────

function setError(msg) { document.getElementById('error').textContent = msg; }

function preset(v1, v2) {
  document.getElementById('v1').value = v1;
  document.getElementById('v2').value = v2;
}

function buildNotes(v1str, dur1, v2str, dur2) {
  const v1 = parseVoice(v1str, dur1);
  const v2 = v2str.trim() ? parseVoice(v2str, dur2) : [];
  return mergeVoices(v1, v2);
}

function renderSummary() {
  const root = document.getElementById('summary');
  if (!runSummaries.length) {
    root.innerHTML = '';
    document.getElementById('output').innerHTML = renderStructuredOutput([], '');
    return;
  }
  const chips = runSummaries.map(s => `<div class="summary-chip"><strong>${s.label}</strong> • Best ${s.best.approach} (${s.best.total.toFixed(3)})</div>`).join('');
  root.innerHTML = `<div class="summary-chips">${chips}</div>`;
  document.getElementById('output').innerHTML = renderStructuredOutput(runSummaries, lines.join('\n'));
}

function saveState() {
  const state = {
    v1: document.getElementById('v1').value,
    v2: document.getElementById('v2').value,
    dur1: document.getElementById('dur1').value,
    dur2: document.getElementById('dur2').value,
    timeSig: document.getElementById('timeSig').value,
    outputHtml: document.getElementById('output').innerHTML,
    summary: runSummaries,
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return;
  try {
    const st = JSON.parse(raw);
    if (st.v1 !== undefined) document.getElementById('v1').value = st.v1;
    if (st.v2 !== undefined) document.getElementById('v2').value = st.v2;
    if (st.dur1 !== undefined) document.getElementById('dur1').value = st.dur1;
    if (st.dur2 !== undefined) document.getElementById('dur2').value = st.dur2;
    if (st.timeSig !== undefined) document.getElementById('timeSig').value = st.timeSig;
    if (Array.isArray(st.summary)) runSummaries = st.summary;
    if (typeof st.outputHtml === 'string' && st.outputHtml.trim()) document.getElementById('output').innerHTML = st.outputHtml;
    renderSummary();
  } catch (e) {
    console.warn('Failed to load saved state', e);
  }
}

function doRunAll() {
  lines = [];
  runSummaries = [];
  setError('');
  try {
    const v1str = document.getElementById('v1').value;
    const v2str = document.getElementById('v2').value;
    const dur2 = parseFloat(document.getElementById('dur2').value);
    setTimeSignature(document.getElementById('timeSig').value);

    log(`Harmonic Analysis Lab   Meter=${CURRENT_METER.num}/${CURRENT_METER.den}   Decay=${DECAY_RATE}, complexity_penalty=${COMPLEXITY_PENALTY}/level`);

    for (const [dur, label] of [[2,'HALF NOTES'],[1,'QUARTER NOTES'],[0.5,'EIGHTH NOTES'],[0.25,'SIXTEENTH NOTES']]) {
      const notes = buildNotes(v1str, dur, v2str, v2str.trim() ? dur2 : dur);
      if (notes.length < 2) { setError('Need at least 2 notes total.'); return; }
      const summary = runTestFromNotes(notes, label);
      runSummaries.push(summary);
    }

    document.getElementById('output').textContent = lines.join('\n');
    renderSummary();
    saveState();
    lines = [];
  } catch (e) { setError(e.message); }
}

function doRunOne() {
  lines = [];
  runSummaries = [];
  setError('');
  try {
    const v1str = document.getElementById('v1').value;
    const v2str = document.getElementById('v2').value;
    const dur1 = parseFloat(document.getElementById('dur1').value);
    const dur2 = parseFloat(document.getElementById('dur2').value);
    setTimeSignature(document.getElementById('timeSig').value);
    const notes = buildNotes(v1str, dur1, v2str, dur2);
    if (notes.length < 2) { setError('Need at least 2 notes total.'); return; }

    const labels = { 2: 'HALF', 1: 'QUARTER', 0.5: 'EIGHTH', 0.25: 'SIXTEENTH' };
    let label = `V1:${labels[dur1]||dur1}`;
    if (v2str.trim()) label += ` V2:${labels[dur2]||dur2}`;

    log(`Harmonic Analysis Lab   Meter=${CURRENT_METER.num}/${CURRENT_METER.den}   Decay=${DECAY_RATE}, complexity_penalty=${COMPLEXITY_PENALTY}/level`);
    const summary = runTestFromNotes(notes, label);
    runSummaries.push(summary);

    document.getElementById('output').textContent = lines.join('\n');
    renderSummary();
    saveState();
    lines = [];
  } catch (e) { setError(e.message); }
}

export function initHarmonicLab() {
  const tag = document.getElementById('buildTag');
  if (tag) tag.textContent = `build ${APP_BUILD}`;
  loadState();
  if (!runSummaries.length) doRunOne();
}
