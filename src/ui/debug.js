// Debug-Leiste, nur mit ?debug=1: Kapitel springen, Spiel sofort gewinnen/verlieren, Fortschritt zurücksetzen.

import { STEPS } from '../flow.js';
import { h, onTap } from './dom.js';

export function mountDebug(root, api) {
  const select = h('select', STEPS.map((s) => h('option', { value: s }, s)));
  const btn = (label, fn) => {
    const b = h('button', label);
    onTap(b, fn);
    return b;
  };
  const body = h(
    'div.debug-body',
    btn('◀', api.prev),
    select,
    btn('▶', api.next),
    btn('Gewinnen', () => api.win()),
    btn('Verlieren', () => api.lose()),
    btn('Reset', api.reset),
  );
  const toggle = btn('🐞', () => panel.classList.toggle('closed'));
  const panel = h('div.debug.closed', toggle, body);
  select.addEventListener('change', () => api.go(select.value));
  root.append(panel);
  return {
    setStep(step) {
      select.value = step;
    },
  };
}
