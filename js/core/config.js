import htm from 'https://esm.sh/htm@3.1.1';

// ─── htm binding ────────────────────────────────────────────────────────────
export const html = htm.bind(React.createElement);

// ─── Categories ─────────────────────────────────────────────────────────────
const CATEGORIES = Object.freeze([
  { id: 'process',     label: 'Processes & SOPs', icon: 'folder',    color: 'blue'   },
  { id: 'decision',    label: 'Decision Log',     icon: 'scale',     color: 'purple' },
  { id: 'stakeholder', label: 'Stakeholder Map',  icon: 'users',     color: 'green'  },
  { id: 'calendar',    label: 'Recurring Calendar', icon: 'calendar', color: 'orange' },
  { id: 'lesson',      label: 'Lessons & Gotchas', icon: 'lightbulb', color: 'yellow' },
  { id: 'issue',       label: 'Active Issues',    icon: 'flag',      color: 'red'    },
]);

// ─── Priorities ─────────────────────────────────────────────────────────────
const PRIORITIES = Object.freeze([
  { id: 'high',   label: 'High',   color: 'red'    },
  { id: 'medium', label: 'Medium', color: 'yellow' },
  { id: 'low',    label: 'Low',    color: 'gray'   },
]);

// ─── Verification ───────────────────────────────────────────────────────────
const VERIFICATION_INTERVAL_DAYS = 90;

// ─── Storage keys ───────────────────────────────────────────────────────────
const STORAGE_KEYS = Object.freeze({
  BILLET:      'passdown_billet',
  ENTRIES:     'passdown_entries',
  NARRATIVES:  'passdown_narratives',
  START_HERE:  'passdown_start_here',
  SETTINGS:    'passdown_settings',
  VERSION:     'passdown_version',
});

// ─── Enumerations ───────────────────────────────────────────────────────────
const FREQUENCIES = Object.freeze([
  'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'asNeeded',
]);

const RECURRENCES = Object.freeze([
  'annual', 'quarterly', 'monthly', 'weekly', 'oneTime',
]);

// ─── Defaults ───────────────────────────────────────────────────────────────
const DEFAULT_BILLET = Object.freeze({
  title: '',
  rank: '',
  name: '',
  unit: '',
  billetDescription: '',
  turnoverDate: '',
  outgoingName: '',
  outgoingContact: '',
  incomingName: '',
  incomingContact: '',
  notes: '',
});

const DEFAULT_SETTINGS = Object.freeze({
  verifyIntervalDays: 90,
  firebaseConfig: null,
  aiEnabled: false,
});

// ─── Built-in Firebase Config (free tier, users just sign in with Google) ────
export const FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyAaMZ5HNwKBCNIaf8LYJXQ7K6RMe-FA_B4",
  authDomain: "mli-automate-hours.firebaseapp.com",
  projectId: "mli-automate-hours",
  storageBucket: "mli-automate-hours.firebasestorage.app",
  messagingSenderId: "770958006562",
  appId: "1:770958006562:web:b22a5b4cd36ec6138fad7b",
});

// ─── Config ─────────────────────────────────────────────────────────────────
const CONFIG = Object.freeze({
  VERSION: '1.0.0',
  APP_NAME: 'Passdown',
  CATEGORIES,
  PRIORITIES,
  VERIFICATION_INTERVAL_DAYS,
  STORAGE_KEYS,
  FREQUENCIES,
  RECURRENCES,
  DEFAULT_BILLET,
  DEFAULT_SETTINGS,
});

export default CONFIG;
export {
  CATEGORIES,
  PRIORITIES,
  VERIFICATION_INTERVAL_DAYS,
  STORAGE_KEYS,
  FREQUENCIES,
  RECURRENCES,
  DEFAULT_BILLET,
  DEFAULT_SETTINGS,
  FIREBASE_CONFIG,
};
