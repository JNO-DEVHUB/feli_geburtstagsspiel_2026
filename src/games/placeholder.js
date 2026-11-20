// Platzhalter-Spiel, solange ein Minispiel noch nicht gebaut ist.
import { banner, h, onTap, wait } from './kit.js';

export function createGame(ctx) {
  const finish = async (won) => {
    box.remove();
    banner(ctx.root, won ? 'GESCHAFFT!' : 'VERLOREN!', won ? 'win' : 'lose');
    ctx.audio.play(won ? 'win' : 'lose');
    await wait(900);
    ctx.end(won);
  };
  const win = h('button.btn', 'Gewinnen');
  const lose = h('button.btn.ghost', 'Verlieren');
  onTap(win, () => finish(true));
  onTap(lose, () => finish(false));
  const box = h('div.placeholder-game', h('p', 'Dieses Spiel wird gerade gebaut.'), win, lose);
  ctx.root.append(box);
  return { destroy() {} };
}
