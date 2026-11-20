// Sprungphysik des Gespanns, übernommen aus dem Hochzeits-Runner (src/game/physics.js):
// Tippen = springen, gedrückt halten = höher (verminderte Schwerkraft), in der Luft nochmal
// tippen = Doppelsprung mit Drehung. Ohne DOM; die Zahlen (cfg) stehen in logic.js → PHYSICS.

// Zustand in Höhen-Koordinaten: alt = Höhe über dem Boden (nach oben positiv).
export function createPlayer() {
  return {
    alt: 0,
    v: 0,
    grounded: true,
    jumps: 0,
    buffer: 0,
    holding: false,
    holdTime: 0,
    airTime: 0,
    spin: 0, // 0..1 Fortschritt der Drehung beim Doppelsprung
    spinning: false,
  };
}

/**
 * Ein fester Physikschritt.
 * input.pressed: Tipp in diesem Schritt; input.held: Finger liegt noch auf.
 * Rückgabe: 'jump' | 'doubleJump' | 'land' | null (höchstens ein Ereignis je Schritt).
 */
export function stepPlayer(p, dt, input, cfg) {
  let event = null;
  p.buffer = input.pressed ? cfg.jumpBuffer : Math.max(0, p.buffer - dt);

  if (p.buffer > 0) {
    if (p.grounded) {
      p.v = cfg.jumpVelocity;
      p.grounded = false;
      p.jumps = 1;
      p.buffer = 0;
      p.holding = true;
      p.holdTime = 0;
      p.airTime = 0;
      event = 'jump';
    } else if (input.pressed && p.jumps < 2) {
      p.v = cfg.doubleJumpVelocity;
      p.jumps = 2;
      p.buffer = 0;
      p.holding = false; // Doppelsprung hat feste Höhe
      p.spinning = true;
      p.spin = 0;
      event = 'doubleJump';
    }
  }

  if (!input.held) p.holding = false;
  if (p.holding) {
    p.holdTime += dt;
    if (p.holdTime >= cfg.maxHoldTime || p.v <= 0) p.holding = false;
  }

  if (!p.grounded) {
    p.airTime += dt;
    const g = cfg.gravity * (p.holding ? cfg.holdGravityFactor : 1);
    p.v = Math.max(-cfg.maxFallSpeed, p.v - g * dt);
    p.alt += p.v * dt;
    if (p.spinning) {
      p.spin = Math.min(1, p.spin + dt / cfg.spinTime);
      if (p.spin >= 1) p.spinning = false;
    }
    if (p.alt <= 0) {
      p.alt = 0;
      p.v = 0;
      p.grounded = true;
      p.jumps = 0;
      p.spinning = false;
      p.spin = 0;
      event = 'land';
    }
  }
  return event;
}

// Ein Sprung im Trockenen: Gipfelhöhe und Flugzeit. holdFor = Haltedauer des Fingers,
// doubleAt = Zeitpunkt des zweiten Tipps (null = keiner), tripleAt = dritter Tipp (für Tests).
export function simulateJump(cfg, { holdFor = 0, doubleAt = null, tripleAt = null, dt = 1 / 120 } = {}) {
  const p = createPlayer();
  let t = 0;
  let peak = 0;
  let doubles = 0;
  stepPlayer(p, dt, { pressed: true, held: true }, cfg);
  while (!p.grounded && t < 6) {
    t += dt;
    const pressed = (doubleAt !== null && Math.abs(t - doubleAt) < dt / 2) || (tripleAt !== null && Math.abs(t - tripleAt) < dt / 2);
    if (stepPlayer(p, dt, { pressed, held: t < holdFor }, cfg) === 'doubleJump') doubles++;
    peak = Math.max(peak, p.alt);
  }
  return { peak, airtime: t, doubles };
}

// Zeit vom Absprung (voll gehalten) bis zur Höhe h; Infinity, wenn ein Einzelsprung nicht so hoch kommt.
export function riseTime(cfg, h, dt = 1 / 120) {
  const p = createPlayer();
  let t = 0;
  stepPlayer(p, dt, { pressed: true, held: true }, cfg);
  while (!p.grounded && p.v > 0) {
    if (p.alt >= h) return t;
    t += dt;
    stepPlayer(p, dt, { pressed: false, held: true }, cfg);
  }
  return p.alt >= h ? t : Infinity;
}
