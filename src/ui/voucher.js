// Der Gutschein: gestaltetes Ticket mit Krone, Katerpfoten und orangem Rand.

import { VOUCHER } from '../content.js';
import { h, onTap } from './dom.js';

export function voucherEl() {
  return h(
    'div.voucher',
    h('div.voucher-crown', '👑'),
    h('div.voucher-head', VOUCHER.head),
    h('h2.voucher-title', VOUCHER.title),
    h('p.voucher-sub', VOUCHER.sub),
    h('p.voucher-date', VOUCHER.date),
    h('p.voucher-times', VOUCHER.times),
    h('p.voucher-seats', VOUCHER.seats),
    h('div.voucher-cut'),
    VOUCHER.rows.map((r) => h('div.voucher-row', h('span.voucher-icon', r.icon), h('div', h('b', r.label + ': '), r.text, h('small', r.small)))),
    h('div.voucher-cut'),
    h('p.voucher-fine', VOUCHER.fine[0]),
    h('p.voucher-love', VOUCHER.fine[1]),
    h('span.voucher-paw.p1', '🐾'),
    h('span.voucher-paw.p2', '🐾'),
  );
}

export function mountVoucher(root, app, { onDone }) {
  const go = h('button.btn', VOUCHER.toHall);
  const screen = h('div.screen.voucher-screen', h('div.voucher-scroll', voucherEl(), go, h('p.voucher-shot', VOUCHER.screenshot)));
  root.append(screen);
  onTap(go, () => {
    app.audio.play('tap');
    onDone();
  });
  return { destroy: () => screen.remove() };
}
