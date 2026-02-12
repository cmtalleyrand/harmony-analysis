export const ANALYSIS_CONSTANTS = {
  DECAY_RATE: 0.3,
  PASSING_NOTE_THRESHOLD: 0.125,
  MIN_SALIENCE: 0.025,
  NON_CHORD_TONE_FLOOR: 0.05,
  COMPLEXITY_PENALTY: 0.05,
};

export const CHORD_TYPES = {
  major:       { intervals: [0, 4, 7],     required: [0, 4],         complexity: 1 },
  minor:       { intervals: [0, 3, 7],     required: [0, 3],         complexity: 1 },
  diminished:  { intervals: [0, 3, 6],     required: [0, 3, 6],     complexity: 2 },
  augmented:   { intervals: [0, 4, 8],     required: [0, 4, 8],     complexity: 2 },
  dominant_7:  { intervals: [0, 4, 7, 10], required: [0, 4, 10],    complexity: 3 },
  major_7:     { intervals: [0, 4, 7, 11], required: [0, 4, 11],    complexity: 3 },
  minor_7:     { intervals: [0, 3, 7, 10], required: [0, 3, 10],    complexity: 3 },
  half_dim_7:  { intervals: [0, 3, 6, 10], required: [0, 3, 6, 10], complexity: 4 },
  dim_7:       { intervals: [0, 3, 6, 9],  required: [0, 3, 6, 9],  complexity: 4 },
  min_maj_7:   { intervals: [0, 3, 7, 11], required: [0, 3, 11],    complexity: 4 },
  major_6:     { intervals: [0, 4, 7, 9],  required: [0, 4, 9],     complexity: 3 },
  minor_6:     { intervals: [0, 3, 7, 9],  required: [0, 3, 9],     complexity: 3 },
};

export const NOTE_NAMES = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
export const TYPE_SHORT = {
  major:'', minor:'m', diminished:'dim', augmented:'aug',
  dominant_7:'7', major_7:'maj7', minor_7:'m7',
  half_dim_7:'m7b5', dim_7:'dim7', min_maj_7:'m(maj7)',
  major_6:'6', minor_6:'m6',
};

export const STORE_KEY = 'harmonicLabState.v2';
