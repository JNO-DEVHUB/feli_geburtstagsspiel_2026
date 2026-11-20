// Register der sechs Minispiele (Schlüssel = CHAPTERS[n].game in content.js).
import * as runner from './runner/game.js';
import * as meowdoku from './meowdoku/game.js';
import * as wimmel from './wimmel/game.js';
import * as wordle from './wordle/game.js';
import * as handball from './handball/game.js';
import * as lacher from './lacher/game.js';
import './runner/style.css';
import './meowdoku/style.css';
import './wimmel/style.css';
import './wordle/style.css';
import './handball/style.css';
import './lacher/style.css';

export const GAMES = { runner, meowdoku, wimmel, wordle, handball, lacher };
