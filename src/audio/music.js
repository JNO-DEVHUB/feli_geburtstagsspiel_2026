// Eigene, prozedural erzeugte Musik (Web Audio, keine Audiodateien, keine fremden Melodien):
//   - Stimmungen als leise Hintergrund-Schleifen (Sequenzer mit Vorausplanung wie im Hochzeits-Runner)
//   - ein auskomponierter Trailer-Vorspann, der Spannung aufbaut
// createMusic(getCtx, out) hängt sich an den Audio-Kontext aus audio.js.

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);

// Akkorde als MIDI-Töne (Grundton, Terz, Quinte).
const C = [48, 52, 55];
const Am = [45, 48, 52];
const F = [41, 45, 48];
const G = [43, 47, 50];
const Dm = [50, 53, 57];
const Bb = [46, 50, 53];
const Em = [40, 43, 47];
const D = [50, 54, 57];
const A = [45, 49, 52];
const Gm = [43, 46, 50];

// Melodiemuster: je Achtel ein Index in die Akkordtöne (0–2, +3 = eine Oktave höher), null = Pause.
const _ = null;
export const MOODS = Object.freeze({
  // Story, Bilderrahmen, Spielesaal: ruhig und freundlich
  calm: { tempo: 86, chords: [C, Am, F, G], vol: 0.9, pad: true, bass: 'half', arp: '8', lead: [0, _, _, 2, _, 1, _, _, 3, _, _, 2, _, _, 1, _, 0, _, _, 1, _, 2, _, _, 2, _, 1, _, 0, _, _, _] },
  // Rätselspiele: nachdenklich, tickend
  think: { tempo: 78, chords: [F, Dm, Bb, C], vol: 0.85, pad: true, bass: 'half', arp: 'sparse', hat: 'tick' },
  // Runner und Siebenmeter: treibend
  action: { tempo: 124, chords: [F, C, Dm, Bb], vol: 0.8, pad: true, bass: 'eighth', arp: '16', kick: 'four', hat: 'off', snare: true, lead: [3, _, 2, 3, _, 4, _, 2, 3, _, 2, 1, _, 2, _, _, 3, _, 4, 5, _, 4, _, 3, 2, _, 3, 4, _, 3, 2, _] },
  // Lacher wischen: Showbühne mit Swing
  show: { tempo: 132, chords: [G, Em, Am, D], vol: 0.8, bass: 'walk', hat: 'swing', snare: true, stab: true, swing: 0.34, lead: [3, _, _, 4, 3, _, 2, _, 3, _, _, 2, 1, _, 2, _, 3, _, 4, _, 5, _, 4, _, 3, _, 2, _, 3, _, _, _] },
  // Finale vor der Auflösung: Herzklopfen
  tense: { tempo: 100, chords: [Dm, Dm, Bb, A], vol: 0.9, pad: true, bass: 'pulse', kick: 'heart', hat: 'tick', trem: true },
  // Konfetti und Gutschein: Feier
  party: { tempo: 134, chords: [C, F, G, F], vol: 0.85, pad: true, bass: 'eighth', arp: '16', kick: 'four', hat: 'eighth', snare: true, stab: true, lead: [3, _, 4, 5, _, 4, 3, _, 3, _, 4, 5, _, 5, 4, _, 4, _, 5, 6, _, 5, 4, _, 3, _, 4, 3, _, 2, 3, _] },
});

const tone3 = (chord, i) => chord[i % 3] + 12 * Math.floor(i / 3);

export function createMusic(getCtx, getOut) {
  let bus = null;
  let dry = null;
  let noiseBuf = null;
  let timer = null;
  let mood = null; // gewünschte Stimmung (Name) oder null
  let playing = null; // gerade laufende Stimmung (Objekt)
  let step = 0;
  let nextTime = 0;
  let score = null; // laufender Trailer-Vorspann { gain }
  const BASE_GAIN = 0.3; // leise im Hintergrund, aber auf Handy-Lautsprechern noch hörbar

  function ensure() {
    const ctx = getCtx();
    if (!ctx) return null;
    if (!bus) {
      bus = ctx.createGain();
      bus.gain.value = BASE_GAIN;
      bus.connect(getOut());
      dry = ctx.createGain();
      dry.connect(bus);
      // einfacher Hall aus abklingendem Rauschen
      const len = Math.floor(ctx.sampleRate * 1.7);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
      }
      const conv = ctx.createConvolver();
      conv.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.28;
      dry.connect(conv);
      conv.connect(wet);
      wet.connect(bus);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const n = noiseBuf.getChannelData(0);
      for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
    }
    return ctx;
  }

  // --- Klangbausteine (dest = Zielknoten, t = Startzeit auf der Audio-Uhr) ---
  function osc(dest, { f, f2 = f, t, dur, type = 'sine', vol = 0.1, attack = 0.006, release = 0.08, filter = 0, filter2 = 0, detune = 0 }) {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2 !== f) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const bq = ctx.createBiquadFilter();
      bq.type = 'lowpass';
      bq.frequency.setValueAtTime(filter, t);
      if (filter2) bq.frequency.exponentialRampToValueAtTime(filter2, t + dur);
      o.connect(bq);
      node = bq;
    }
    node.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function noise(dest, { t, dur, vol = 0.1, hp = 6000, lp = 0, vol2 = 0.0001 }) {
    const ctx = getCtx();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = lp ? 'lowpass' : 'highpass';
    f.frequency.value = lp || hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, vol), t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol2), t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
  const pad = (d, chord, t, dur, vol) => {
    for (const n of chord) {
      osc(d, { f: NOTE(n), t, dur, type: 'sawtooth', vol, attack: 0.35, release: 0.5, filter: 900, detune: -6 });
      osc(d, { f: NOTE(n), t, dur, type: 'sawtooth', vol, attack: 0.35, release: 0.5, filter: 900, detune: 7 });
    }
  };
  const pluck = (d, n, t, dur, vol) => {
    osc(d, { f: NOTE(n), t, dur, type: 'triangle', vol, attack: 0.004, release: dur * 0.85 });
    osc(d, { f: NOTE(n) * 2, t, dur: dur * 0.5, type: 'sine', vol: vol * 0.35, attack: 0.004, release: dur * 0.4 });
  };
  const bassNote = (d, n, t, dur, vol) => {
    osc(d, { f: NOTE(n), t, dur, type: 'triangle', vol, attack: 0.01, release: 0.1 });
    osc(d, { f: NOTE(n), t, dur, type: 'sawtooth', vol: vol * 0.35, attack: 0.01, release: 0.1, filter: 420 });
  };
  const lead = (d, n, t, dur, vol) => {
    osc(d, { f: NOTE(n), t, dur, type: 'square', vol: vol * 0.55, attack: 0.012, release: dur * 0.5, filter: 2400 });
    osc(d, { f: NOTE(n), t, dur, type: 'triangle', vol, attack: 0.012, release: dur * 0.5 });
  };
  const kick = (d, t, vol) => osc(d, { f: 150, f2: 42, t, dur: 0.17, type: 'sine', vol, attack: 0.002, release: 0.12 });
  const hat = (d, t, vol) => noise(d, { t, dur: 0.04, vol, hp: 7500 });
  const snare = (d, t, vol) => {
    noise(d, { t, dur: 0.13, vol, hp: 1600 });
    osc(d, { f: 190, f2: 120, t, dur: 0.1, type: 'triangle', vol: vol * 0.7, attack: 0.002 });
  };
  const stab = (d, chord, t, dur, vol) => chord.forEach((n) => osc(d, { f: NOTE(n + 12), t, dur, type: 'sawtooth', vol, attack: 0.008, release: dur * 0.6, filter: 1900 }));
  const stacc = (d, n, t, dur, vol, bright = 2000) => {
    osc(d, { f: NOTE(n), t, dur, type: 'sawtooth', vol, attack: 0.008, release: dur * 0.7, filter: bright, detune: -5 });
    osc(d, { f: NOTE(n), t, dur, type: 'sawtooth', vol, attack: 0.008, release: dur * 0.7, filter: bright, detune: 6 });
  };
  const timpani = (d, n, t, vol) => {
    osc(d, { f: NOTE(n) * 1.5, f2: NOTE(n), t, dur: 0.9, type: 'sine', vol, attack: 0.003, release: 0.8 });
    noise(d, { t, dur: 0.12, vol: vol * 0.5, lp: 500 });
  };

  // --- Schleifen ---
  function scheduleStep(m, s16, t) {
    const d = dry;
    const six = 60 / m.tempo / 4;
    const bar = Math.floor(s16 / 16) % m.chords.length;
    const s = s16 % 16;
    const ch = m.chords[bar];
    const v = m.vol ?? 1;
    const tt = t + (m.swing && s % 2 === 1 ? six * m.swing : 0);
    if (m.pad && s === 0) pad(d, ch.map((n) => n + 12), t, six * 16.4, 0.022 * v);
    if (m.trem && s % 2 === 0) stacc(d, ch[2] + 24, t, six * 1.4, 0.014 * v * (s % 8 === 0 ? 1.4 : 1), 1500);
    if (m.bass === 'half' && (s === 0 || s === 8)) bassNote(d, ch[0] - 12, t, six * 7, 0.1 * v);
    if (m.bass === 'eighth' && s % 2 === 0) bassNote(d, ch[0] - 12 + (s % 8 === 6 ? 7 : 0), t, six * 1.7, 0.095 * v);
    if (m.bass === 'pulse' && s % 2 === 0) bassNote(d, ch[0] - 12, t, six * 1.2, 0.085 * v);
    if (m.bass === 'walk' && s % 4 === 0) bassNote(d, [ch[0], ch[1], ch[2], ch[1]][s / 4] - 12, t, six * 3.6, 0.11 * v);
    if (m.arp === '8' && s % 2 === 0) pluck(d, ch[[0, 1, 2, 1][(s / 2) % 4]] + 24, t, six * 2.6, 0.045 * v);
    if (m.arp === '16') pluck(d, ch[[0, 2, 1, 2][s % 4]] + 24 + (s >= 8 ? 12 : 0), tt, six * 1.5, 0.03 * v);
    if (m.arp === 'sparse' && (s === 0 || s === 6 || s === 10 || s === 12)) pluck(d, ch[[0, 2, 1, 2][(s / 2) % 4]] + 24, t, six * 5, 0.06 * v);
    if (m.kick === 'four' && s % 4 === 0) kick(d, t, 0.26 * v);
    if (m.kick === 'heart' && (s === 0 || s === 3)) kick(d, t, (s ? 0.2 : 0.28) * v);
    if (m.hat === 'off' && s % 4 === 2) hat(d, t, 0.045 * v);
    if (m.hat === 'eighth' && s % 2 === 0) hat(d, t, (s % 4 === 2 ? 0.05 : 0.028) * v);
    if (m.hat === 'tick' && s % 4 === 0) hat(d, t, 0.02 * v);
    if (m.hat === 'swing' && (s % 4 === 0 || s % 4 === 3)) hat(d, tt, (s % 4 === 0 ? 0.045 : 0.03) * v);
    if (m.snare && (s === 4 || s === 12)) snare(d, t, 0.075 * v);
    if (m.stab && (s === 6 || s === 14)) stab(d, ch, tt, six * 1.3, 0.022 * v);
    if (m.lead && s % 2 === 0) {
      const i = m.lead[(bar * 8 + s / 2) % m.lead.length];
      if (i !== null && i !== undefined) lead(d, tone3(ch, i) + 24, tt, six * 2.4, 0.05 * v);
    }
  }

  function tick() {
    const ctx = getCtx();
    if (!ctx || !playing || ctx.state !== 'running') return;
    // Nach einer Pause (Tab verborgen) nicht alles nachholen
    if (nextTime < ctx.currentTime - 0.2) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.16) {
      // Stimmungswechsel immer zum Taktanfang
      if (step % 16 === 0) {
        const want = mood ? MOODS[mood] : null;
        if (want !== playing) {
          if (!want) return stopLoop();
          playing = want;
          step = 0;
        }
      }
      scheduleStep(playing, step, nextTime);
      nextTime += 60 / playing.tempo / 4;
      step++;
    }
  }

  function stopLoop() {
    playing = null;
    clearInterval(timer);
    timer = null;
  }

  // Ausklingende Töne der Schleife schnell ausblenden bzw. den Weg wieder öffnen.
  function gate(open) {
    const ctx = getCtx();
    if (!ctx || !dry) return;
    dry.gain.cancelScheduledValues(ctx.currentTime);
    if (open) dry.gain.setValueAtTime(1, ctx.currentTime);
    else dry.gain.setTargetAtTime(0, ctx.currentTime, 0.09);
  }

  function startLoop() {
    const ctx = ensure();
    if (!ctx || playing || !mood || score) return;
    gate(true);
    playing = MOODS[mood];
    step = 0;
    nextTime = ctx.currentTime + 0.08;
    timer = setInterval(tick, 30);
  }

  // --- Trailer-Vorspann: 9 Takte bei 96 Schlägen (ein Takt = 2,5 s = eine Trailer-Szene) ---
  // Takt 1 Herzklopfen und Ticken, Takt 2 großer Einsatz zum Titel, Takte 3–8 treibendes Ostinato, das sich
  // Kapitel für Kapitel steigert, Takt 9 plötzlich leise (Dominante), dann die Auflösung in Dur.
  function playTrailer(delay = 0) {
    const ctx = ensure();
    if (!ctx) return () => {};
    stopScore();
    mood = null;
    stopLoop();
    gate(true);
    const out = ctx.createGain();
    out.gain.value = 2.3; // der Vorspann darf deutlich lauter sein als die Hintergrund-Schleifen
    out.connect(dry);
    score = { gain: out };
    const BAR = 2.5;
    const b8 = BAR / 8;
    const t0 = ctx.currentTime + 0.06 + delay;
    const at = (bar, eighth = 0) => t0 + bar * BAR + eighth * b8;

    // Takt 1: tiefer Liegeton, Herzschlag, Uhr, anschwellendes Rauschen
    osc(out, { f: NOTE(38), t: at(0), dur: BAR * 2, type: 'sawtooth', vol: 0.05, attack: 1.2, release: 0.6, filter: 260 });
    for (const e of [0, 1, 4, 5]) kick(out, at(0, e), e % 4 ? 0.16 : 0.24);
    for (let e = 0; e < 8; e++) hat(out, at(0, e), 0.018);
    for (const e of [0, 2, 4, 6]) pluck(out, e % 4 ? 69 : 74, at(0, e), b8 * 1.6, 0.03); // Tick-Tack in hörbarer Lage
    noise(out, { t: at(0, 4), dur: BAR / 2, vol: 0.002, vol2: 0.12, hp: 1800 });
    // Takt 2: Einsatz zum Titel
    for (const [n, det] of [[26, -8], [26, 9], [38, -5], [45, 6], [50, 0]]) {
      osc(out, { f: NOTE(n), t: at(1), dur: BAR * 0.95, type: 'sawtooth', vol: 0.085, attack: 0.02, release: 1.4, filter: 2600, filter2: 300, detune: det });
    }
    timpani(out, 38, at(1), 0.3);
    noise(out, { t: at(1), dur: 1.6, vol: 0.12, hp: 5000 });
    for (let i = 0; i < 8; i++) timpani(out, 38, at(1, 6) + (i * b8) / 4, 0.05 + i * 0.022);
    // Takte 3–8: Ostinato, Bass und Melodie, je Takt dichter
    const prog = [Dm, Dm, Bb, Bb, Gm, A];
    const top = [74, 77, 77, 81, 82, 85];
    prog.forEach((ch, i) => {
      const bar = 2 + i;
      const k = i / 5; // 0 → 1
      timpani(out, ch[0] - 12, at(bar), 0.24 + k * 0.1);
      bassNote(out, ch[0] - 12, at(bar), BAR * 0.98, 0.1 + k * 0.03);
      const fig = [0, 0, 2, 0, 1, 0, 2, 3];
      for (let e = 0; e < 8; e++) {
        stacc(out, tone3(ch, fig[e]) + 12, at(bar, e), b8 * 0.62, 0.04 + k * 0.022, 1500 + k * 1500);
        if (i >= 2) stacc(out, tone3(ch, fig[e]) + 24, at(bar, e), b8 * 0.5, 0.016 + k * 0.014, 2400);
        if (i >= 1) hat(out, at(bar, e), 0.014 + k * 0.022);
        if (i >= 3) hat(out, at(bar, e) + b8 / 2, 0.012 + k * 0.014);
      }
      if (i >= 2) for (const e of [0, 3, 6]) kick(out, at(bar, e), 0.16 + k * 0.1);
      if (i >= 1) osc(out, { f: NOTE(top[i]), t: at(bar), dur: BAR * 0.96, type: 'sawtooth', vol: 0.02 + k * 0.022, attack: 0.25, release: 0.4, filter: 2400 });
      if (i === 5) {
        for (let q = 0; q < 16; q++) snare(out, at(bar, 4) + (q * b8) / 4, 0.02 + q * 0.008);
        noise(out, { t: at(bar, 2), dur: BAR * 0.75, vol: 0.002, vol2: 0.16, hp: 1500 });
      }
    });
    // Takt 9: Stille mit Herzklopfen, die Dominante flirrt
    for (let e = 0; e < 8; e++) stacc(out, 69, at(8, e), b8 * 0.5, 0.012 + (e % 2 ? 0 : 0.006), 1300);
    osc(out, { f: NOTE(45), t: at(8), dur: BAR, type: 'sawtooth', vol: 0.035, attack: 0.4, release: 0.3, filter: 300 });
    for (const e of [0, 1, 4, 5]) kick(out, at(8, e), e % 4 ? 0.14 : 0.2);
    noise(out, { t: at(8, 5), dur: b8 * 3, vol: 0.002, vol2: 0.1, hp: 2500 });
    // Auflösung
    timpani(out, 38, at(9), 0.3);
    for (const n of [50, 54, 57, 62, 66, 69]) {
      osc(out, { f: NOTE(n), t: at(9), dur: 3.4, type: 'sawtooth', vol: 0.06, attack: 0.03, release: 2.6, filter: 3200, filter2: 700, detune: n % 2 ? 6 : -6 });
    }
    noise(out, { t: at(9), dur: 1.8, vol: 0.09, hp: 6000 });
    [74, 78, 81, 86].forEach((n, i) => pluck(out, n, at(9) + 0.12 + i * 0.09, 0.9, 0.05)); // kleiner Aufgang in Dur
    const mine = score;
    return () => {
      if (score === mine) stopScore();
    };
  }

  function stopScore() {
    const ctx = getCtx();
    if (!score || !ctx) return;
    const g = score.gain;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
    setTimeout(() => g.disconnect(), 600);
    score = null;
  }

  return {
    // name: Schlüssel aus MOODS oder null/'off' für Stille. Wechselt zum nächsten Taktanfang.
    setMood(name) {
      mood = MOODS[name] ? name : null;
      if (mood) stopScore();
      if (mood && !playing) startLoop();
      if (!mood && playing) {
        stopLoop();
        gate(false);
      }
    },
    // Für Tests: plant eine Stimmung taktweise fest ein (ohne Timer), z. B. im OfflineAudioContext.
    scheduleBars(name, bars, t0 = 0) {
      if (!ensure()) return 0;
      const m = MOODS[name];
      const six = 60 / m.tempo / 4;
      for (let i = 0; i < bars * 16; i++) scheduleStep(m, i, t0 + i * six);
      return bars * 16 * six;
    },
    get mood() {
      return mood;
    },
    // Nach dem Entsperren des Tons oder der Rückkehr in den Tab: Schleife wieder aufnehmen.
    resume() {
      if (mood && !playing) startLoop();
    },
    playTrailer,
    stopScore,
    // Kurz leiser machen (z. B. unter einem großen Effekt), danach zurück.
    duck(seconds = 1.2, level = 0.35) {
      const ctx = getCtx();
      if (!ctx || !bus) return;
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setTargetAtTime(BASE_GAIN * level, ctx.currentTime, 0.05);
      bus.gain.setTargetAtTime(BASE_GAIN, ctx.currentTime + seconds, 0.3);
    },
  };
}
