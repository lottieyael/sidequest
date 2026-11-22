import { categories, games } from './games.mjs';

const storageKey = 'sidequest.saved.v1';
const title = document.querySelector('#catalog-title');
const search = document.querySelector('#search');
const filters = document.querySelector('#categories');
const categorySelect = document.querySelector('#category-select');
const listHeader = document.querySelector('#list-header');
const listing = document.querySelector('#games');
const empty = document.querySelector('#empty');
const emptyMessage = document.querySelector('#empty-message');
const reset = document.querySelector('#reset');
const count = document.querySelector('#result-count');
const savedCount = document.querySelector('#saved-count');
const template = document.querySelector('#game-template');
const navigation = document.querySelectorAll('[data-view]');
const playable = games.filter(game => game.action === 'Play');

let view = 'all';
let category = 'all';
let lastRandomId;
const saved = readSaved();

function readSaved() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    return new Set(games.filter(game => Array.isArray(stored) && stored.includes(game.id)).map(game => game.id));
  } catch {
    return new Set();
  }
}

function updateSaveButton(button, game) {
  const isSaved = saved.has(game.id);
  button.setAttribute('aria-pressed', String(isSaved));
  button.setAttribute('aria-label', `Bookmark ${game.title}`);
  button.title = isSaved ? `Remove ${game.title} from bookmarks` : `Bookmark ${game.title}`;
}

function toggleSaved(game, button) {
  if (saved.has(game.id)) {
    saved.delete(game.id);
  } else {
    saved.add(game.id);
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify([...saved]));
  } catch {
    // Keep the current session usable when browser storage is disabled.
  }

  savedCount.textContent = saved.size;
  if (view === 'all') {
    updateSaveButton(button, game);
    return;
  }

  const row = button.closest('.game');
  const nextId = (row.nextElementSibling ?? row.previousElementSibling)?.dataset.game;
  render();
  const nextButton = nextId && listing.querySelector(`[data-game="${nextId}"] .save`);
  (nextButton || reset).focus();
}

function renderGame(game) {
  const row = template.content.firstElementChild.cloneNode(true);
  row.dataset.game = game.id;
  const link = row.querySelector('.game-link');
  link.textContent = game.title;
  link.href = game.url;
  const note = row.querySelector('.game-note');
  if (game.action !== 'Play') {
    note.textContent = game.action;
    note.id = `note-${game.id}`;
    note.hidden = false;
    link.setAttribute('aria-describedby', note.id);
  }
  row.querySelector('.game-description').textContent = game.description;
  row.querySelector('.game-category').textContent = categories[game.category];
  const button = row.querySelector('.save');
  updateSaveButton(button, game);
  button.addEventListener('click', () => toggleSaved(game, button));
  return row;
}

function normalize(value) {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

const searchableGames = games.map(game => ({
  game,
  text: normalize([game.title, categories[game.category], game.aliases, game.description].join(' ')),
}));

function render() {
  const terms = normalize(search.value).split(/\s+/).filter(Boolean);
  const matching = searchableGames
    .filter(({ game, text }) =>
      (view === 'all' || saved.has(game.id)) && terms.every(term => text.includes(term))
    )
    .map(({ game }) => game);
  const totals = {};
  for (const game of matching) {
    totals[game.category] = (totals[game.category] ?? 0) + 1;
  }
  const visible = category === 'all' ? matching : matching.filter(game => category === game.category);

  count.textContent = `${visible.length} ${visible.length === 1 ? 'game' : 'games'}`;
  listHeader.hidden = visible.length === 0;
  listing.replaceChildren(...visible.map(renderGame));
  empty.hidden = visible.length > 0;
  emptyMessage.textContent = view === 'saved' && saved.size === 0
    ? 'Bookmark a game to find it here later.'
    : 'No games match your search and category.';

  categorySelect.value = category;
  for (const button of filters.children) {
    const key = button.dataset.category;
    button.setAttribute('aria-pressed', String(key === category));
    const tally = button.querySelector('.tally');
    if (tally) tally.textContent = totals[key] ?? 0;
  }
}

function setView(nextView, focusTitle = false) {
  view = nextView;
  category = 'all';
  search.value = '';
  title.textContent = view === 'saved' ? 'Bookmarks' : 'All games';
  for (const button of navigation) {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
  render();
  if (focusTitle) title.focus();
}

function setCategory(nextCategory) {
  category = nextCategory;
  if (title.getBoundingClientRect().top < 0) {
    title.scrollIntoView({ block: 'start' });
  }
  render();
}

for (const [key, label] of Object.entries({ all: 'All categories', ...categories })) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'index-button';
  button.dataset.category = key;
  button.textContent = label;
  if (key !== 'all') {
    const tally = document.createElement('span');
    tally.className = 'tally';
    tally.setAttribute('aria-hidden', 'true');
    button.append(tally);
  }
  button.addEventListener('click', () => setCategory(key));
  filters.append(button);
  categorySelect.add(new Option(label, key));
}

for (const button of navigation) {
  button.addEventListener('click', () => setView(button.dataset.view, true));
}

categorySelect.addEventListener('change', () => setCategory(categorySelect.value));
search.addEventListener('input', render);
reset.addEventListener('click', () => setView('all', true));
document.querySelector('#shuffle').addEventListener('click', () => {
  const options = playable.filter(game => game.id !== lastRandomId);
  const game = options[Math.floor(Math.random() * options.length)];
  lastRandomId = game.id;
  window.open(game.url, '_blank', 'noopener,noreferrer');
});

document.addEventListener('keydown', event => {
  if (event.key !== '/' || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.target.closest('input, textarea, select, [contenteditable]')) return;
  event.preventDefault();
  search.focus();
});

savedCount.textContent = saved.size;
render();
