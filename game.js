const rounds = [
  { question: 'Name a reason you’d stay inside on a Saturday.', answers: [['Bad Weather', 46, 'rain|snow|storm|weather'], ['Sick', 38, 'ill|illness|unwell'], ['Tired', 6, 'sleep|sleepy|exhausted'], ['Watching TV', 5, 'tv|television|movies|netflix'], ['Housework', 4, 'chores|cleaning|laundry']] },
  { question: 'Name a weather condition you hate to drive in.', answers: [['Snow', 46, 'snowy|blizzard'], ['Rain', 26, 'rainy|downpour'], ['Icy Roads', 9, 'ice|icy|black ice'], ['Sleet / Hail', 8, 'sleet|hail'], ['Fog', 5, 'foggy']] },
  { question: 'Tell me a symbol used to represent love.', answers: [['Heart', 59, 'hearts'], ['Cupid', 17, 'cupid arrow'], ['Kiss', 6, 'kissing|lips'], ['Ring', 5, 'wedding ring|engagement ring'], ['Rose', 4, 'roses|flower']] },
  { question: 'If you had to be locked inside a building for a year, which place would you want it to be?', answers: [['Shopping Center', 31, 'mall|shopping mall'], ['Restaurant', 26, 'diner|cafe'], ['Grocery Store', 23, 'supermarket|food store'], ['Home', 12, 'house|my house'], ['Hotel', 7, 'resort']] },
  { question: 'Name a color.', answers: [['Blue', 35, ''], ['Red', 28, ''], ['Green', 18, ''], ['Purple', 10, '']] },
  { question: 'Name a fast food chain.', answers: [['McDonald’s', 50, 'mcdonald|mc donalds'], ['Burger King', 20, 'bk'], ['Wendy’s', 14, 'wendy'], ['Taco Bell', 10, '']] },
  { question: 'Name something with wheels.', answers: [['Car', 38, 'cars|automobile'], ['Bike', 24, 'bicycle|cycling'], ['Skateboard', 18, 'skate board'], ['Shopping Cart', 12, 'cart|trolley']] },
  { question: 'Name a holiday.', answers: [['Christmas', 40, 'xmas'], ['Thanksgiving', 24, 'turkey day'], ['Halloween', 18, ''], ['Easter', 10, '']] },
  { question: 'Name a room in a house.', answers: [['Kitchen', 32, ''], ['Bedroom', 24, 'bed room'], ['Bathroom', 22, 'restroom|toilet|washroom'], ['Living Room', 14, 'lounge|family room']] }
];

const $ = (id) => document.getElementById(id);
const initialState = () => ({ round: 0, scores: [0, 0], names: ['Team A', 'Team B'], playing: 0, owner: 0, revealed: [], strikes: 0, bank: 0, phase: 'play' });
let state = initialState();
try {
  const saved = JSON.parse(localStorage.getItem('family-feud-game'));
  if (saved && Number.isInteger(saved.round) && saved.round >= 0 && saved.round < rounds.length && Array.isArray(saved.scores) && saved.scores.length === 2 && Array.isArray(saved.revealed) && ['play', 'steal', 'result', 'finished'].includes(saved.phase)) state = saved;
} catch (_) { /* A disabled or invalid storage entry should not stop the game. */ }

function save() { try { localStorage.setItem('family-feud-game', JSON.stringify(state)); } catch (_) { /* Storage is optional. */ } }
function name(team) { return state.names[team]?.trim() || `Team ${team === 0 ? 'A' : 'B'}`; }
function normalize(text) { return text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
function feedback(message, type = '') { $('feedback').textContent = message; $('feedback').className = `feedback ${type}`; }

function render() {
  const round = rounds[state.round];
  $('round-label').textContent = `ROUND ${String(state.round + 1).padStart(2, '0')} / ${String(rounds.length).padStart(2, '0')}`;
  $('question-title').textContent = round.question;
  $('answer-count').textContent = `${state.revealed.length} OF ${round.answers.length} REVEALED`;
  $('bank-points').textContent = state.bank;
  $('strike-count').textContent = `${state.strikes} / 3`;
  $('strikes').setAttribute('aria-label', `${state.strikes} of 3 strikes`);
  [...$('strikes').children].forEach((el, i) => el.classList.toggle('hit', i < state.strikes));
  $('round-progress').replaceChildren(...round.answers.map((_, i) => { const bar = document.createElement('span'); bar.classList.toggle('done', state.revealed.includes(i)); return bar; }));

  const board = $('answer-board');
  board.replaceChildren(...round.answers.map(([answer, points], i) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = `answer-tile${state.revealed.includes(i) ? ' revealed' : ''}`;
    tile.disabled = state.revealed.includes(i) || state.phase === 'result' || state.phase === 'finished';
    tile.setAttribute('aria-label', state.revealed.includes(i) ? `Answer ${i + 1}: ${answer}, ${points} points` : `Reveal answer ${i + 1}`);
    const number = document.createElement('span'); number.className = 'answer-number'; number.textContent = String(i + 1).padStart(2, '0');
    const text = document.createElement('span'); text.className = state.revealed.includes(i) ? 'answer-text' : 'answer-text answer-placeholder'; text.textContent = state.revealed.includes(i) ? answer : '';
    const score = document.createElement('span'); score.className = state.revealed.includes(i) ? 'answer-points' : 'hidden-points'; score.textContent = state.revealed.includes(i) ? points : '';
    tile.append(number, text, score);
    tile.addEventListener('click', () => reveal(i));
    return tile;
  }));

  for (let i = 0; i < 2; i++) {
    $(`team-${i}`).classList.toggle('active', state.playing === i && !['result', 'finished'].includes(state.phase));
    $(`score-${i}`).textContent = state.scores[i];
    if (document.activeElement !== $(`name-${i}`)) $(`name-${i}`).value = state.names[i];
    $(`tag-${i}`).textContent = state.phase === 'steal' ? 'STEALING' : 'PLAYING';
  }
  const active = state.phase === 'play' || state.phase === 'steal';
  $('guess-input').disabled = !active;
  $('submit-guess').disabled = !active;
  $('strike-button').disabled = !active;
  $('bank-button').disabled = !active || state.phase === 'steal';
  $('bank-button').textContent = state.phase === 'steal' ? 'Steal in progress' : 'Bank points & end round →';
  $('round-note').textContent = state.phase === 'steal' ? `${name(state.playing)} gets one guess to steal the round!` : 'Got them all? Bank your points to move on.';
  $('result-modal').classList.toggle('hidden', active);
  if (!active) renderResult();
  save();
}

function reveal(index) {
  if (!['play', 'steal'].includes(state.phase) || state.revealed.includes(index)) return;
  const [answer, points] = rounds[state.round].answers[index];
  state.revealed.push(index);
  if (state.phase === 'steal') {
    // A successful steal takes the entire board, including the answer just found.
    state.bank += points;
    feedback(`${answer} is on the board! ${name(state.playing)} steals ${state.bank} points.`, 'success');
    finishRound(state.playing);
  } else {
    state.bank += points;
    feedback(`${answer} is on the board! +${points} points.`, 'success');
    if (state.revealed.length === rounds[state.round].answers.length) finishRound(state.playing);
    else render();
  }
}

function strike() {
  if (state.phase === 'steal') {
    feedback(`No steal! ${name(state.owner)} takes the ${state.bank} points.`, 'error');
    finishRound(state.owner);
    return;
  }
  if (state.phase !== 'play') return;
  state.strikes++;
  if (state.strikes === 3) {
    state.phase = 'steal';
    state.playing = 1 - state.owner;
    feedback(`Three strikes! ${name(state.playing)} gets ONE guess to steal.`, 'error');
  } else {
    feedback(`Strike ${state.strikes}! Try another answer.`, 'error');
  }
  render();
}

function finishRound(winner) {
  state.lastWinner = winner;
  state.scores[winner] += state.bank;
  state.phase = state.round === rounds.length - 1 ? 'finished' : 'result';
  render();
  $('next-button').focus();
}

function renderResult() {
  const finished = state.phase === 'finished';
  $('result-eyebrow').textContent = finished ? 'GAME OVER' : `ROUND ${state.round + 1} COMPLETE`;
  if (finished) {
    const tied = state.scores[0] === state.scores[1];
    $('result-title').textContent = tied ? 'It’s a tie!' : `${name(state.scores[0] > state.scores[1] ? 0 : 1)} wins!`;
    $('result-description').textContent = tied ? 'An incredible game — both teams finish even!' : 'The final scores are in. Thanks for playing!';
  } else {
    $('result-title').textContent = `${name(state.lastWinner)} takes the round!`;
    $('result-description').textContent = `${state.bank} points banked. Ready for the next question?`;
  }
  $('modal-scores').replaceChildren(...[0, 1].map(i => {
    const item = document.createElement('div'); const label = document.createElement('span'); const score = document.createElement('strong');
    label.textContent = name(i); score.textContent = state.scores[i]; item.append(label, score); return item;
  }));
  $('next-button').textContent = finished ? 'Play again ↻' : 'Next round →';
}

$('guess-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const guess = normalize($('guess-input').value);
  if (!guess) return;
  $('guess-input').value = '';
  const match = rounds[state.round].answers.findIndex(([answer, , aliases]) => [answer, ...aliases.split('|')].some(value => normalize(value) === guess));
  if (match >= 0 && state.revealed.includes(match)) {
    if (state.phase === 'steal') strike();
    else feedback('That answer is already on the board. Try another!', 'error');
    return;
  }
  if (match >= 0) reveal(match);
  else strike();
});
$('strike-button').addEventListener('click', strike);
$('bank-button').addEventListener('click', () => { if (state.phase === 'play') finishRound(state.playing); });
$('next-button').addEventListener('click', () => {
  if (state.phase === 'finished') { state = initialState(); feedback('New game started. Make it count!'); }
  else {
    state.round++;
    state.owner = state.round % 2;
    state.playing = state.owner;
    state.revealed = [];
    state.strikes = 0;
    state.bank = 0;
    state.phase = 'play';
    state.lastWinner = null;
    feedback(`${name(state.playing)} starts this round. Make it count!`);
  }
  render(); $('guess-input').focus();
});
$('new-game').addEventListener('click', () => {
  if (!confirm('Start a new game? Current scores and progress will be reset.')) return;
  state = initialState(); feedback('New game started. Make it count!'); render();
});
for (let i = 0; i < 2; i++) $('name-' + i).addEventListener('input', (event) => { state.names[i] = event.target.value; save(); });
render();
