// Spielstand im localStorage. Zugriffe können in privaten Fenstern fehlschlagen;
// dann läuft die App mit einem Stand im Arbeitsspeicher weiter.

export const PROGRESS_VERSION = 1;
export const KEY = 'felis-reise:v1';
export const CHAPTER_COUNT = 6;

export function defaultProgress() {
  return {
    version: PROGRESS_VERSION,
    step: 'card', // aktueller Schritt im ersten Durchlauf (siehe flow.js)
    firstRunDone: false,
    results: Array(CHAPTER_COUNT).fill(null), // null = offen, true = Teil gewonnen, false = Teil verloren
    muted: false,
  };
}

// Bringt beliebige (auch beschädigte) Daten in die aktuelle Form.
export function normalizeProgress(raw) {
  const base = defaultProgress();
  if (!raw || typeof raw !== 'object') return base;
  const results = base.results.map((_, i) => {
    const v = Array.isArray(raw.results) ? raw.results[i] : null;
    return v === true || v === false ? v : null;
  });
  return {
    version: PROGRESS_VERSION,
    step: typeof raw.step === 'string' ? raw.step : base.step,
    firstRunDone: raw.firstRunDone === true,
    results,
    muted: raw.muted === true,
  };
}

// Ein gewonnenes Teil bleibt gewonnen, auch wenn das Spiel später im Spielesaal verloren wird.
export function recordResult(progress, chapter, won) {
  if (chapter < 0 || chapter >= CHAPTER_COUNT) return progress;
  if (progress.results[chapter] !== true) progress.results[chapter] = !!won;
  return progress;
}

export const wonCount = (progress) => progress.results.filter((r) => r === true).length;

function browserBackend() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = KEY + ':probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

export function createProgressStore(backend = browserBackend()) {
  let memory = null;
  const read = () => {
    if (!backend) return memory;
    try {
      const txt = backend.getItem(KEY);
      return txt ? JSON.parse(txt) : null;
    } catch {
      return null;
    }
  };
  const write = (p) => {
    memory = p;
    if (!backend) return false;
    try {
      backend.setItem(KEY, JSON.stringify(p));
      return true;
    } catch {
      return false;
    }
  };

  let progress = normalizeProgress(read());
  return {
    get: () => progress,
    persistent: !!backend,
    update(fn) {
      const draft = structuredClone(progress);
      fn(draft);
      progress = normalizeProgress(draft);
      write(progress);
      return progress;
    },
    reset() {
      progress = { ...defaultProgress(), muted: progress.muted };
      write(progress);
      return progress;
    },
  };
}
