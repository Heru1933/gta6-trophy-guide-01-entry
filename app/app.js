// app.js — Leonida Legend: an offline guide and tracker for the 55
// PlayStation 5 trophies of Grand Theft Auto VI.
//
// The official list and this entry's guides are data/trophies.json; the
// platinum roadmap, missable notes, save rules and source directory are
// data/roadmap.json. Progress lives in tracker.js (localStorage). The
// app loads nothing from the network: every file it uses sits beside it.

import {
  buildExport,
  clearState,
  loadState,
  parseImport,
  saveState,
} from './tracker.js';

const GRADE_LABEL = {
  platinum: 'Platinum',
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
};

const KIND_LABEL = {
  story: 'Story',
  missable: 'Missable',
  collectibles: 'Collectibles',
  activities: 'Activities',
  online: 'Online',
};

const MISSABLE_ID = 28; // Positive Mental Attitude: the reported missable.

const trophiesDoc = await (await fetch('data/trophies.json')).json();
const roadmapDoc = await (await fetch('data/roadmap.json')).json();
const trophies = trophiesDoc.trophies;
const trophyById = new Map(trophies.map((t) => [t.id, t]));
const sourceByName = new Map(roadmapDoc.sources.map((s) => [s.name, s]));

const state = loadState(new Set(trophies.map((t) => t.id)));
const earned = new Set(state.earned);

const filters = { view: 'tracker', kind: 'all', grade: 'all', state: 'all', q: '' };
let selectedId = trophies[0].id;

// Deep links and screenshot states: ?view=roadmap, ?grade=silver,
// ?kind=story, ?open=28, ?spoilers=off, ?q=vault.
const params = new URLSearchParams(location.search);
if (params.get('view')) filters.view = params.get('view');
if (params.get('kind')) filters.kind = params.get('kind');
if (params.get('grade')) filters.grade = params.get('grade');
if (params.get('q')) filters.q = params.get('q');
if (params.get('spoilers') === 'off') state.hideSpoilers = false;
if (params.get('spoilers') === 'on') state.hideSpoilers = true;
const openParam = Number(params.get('open'));
if (trophyById.has(openParam)) selectedId = openParam;

const el = {
  earnedCount: document.getElementById('earned-count'),
  progressFill: document.getElementById('progress-fill'),
  progressGrades: document.getElementById('progress-grades'),
  progressNote: document.getElementById('progress-note'),
  search: document.getElementById('search'),
  spoilers: document.getElementById('spoilers'),
  list: document.getElementById('trophy-list'),
  detail: document.getElementById('detail'),
  resultCount: document.getElementById('result-count'),
  toolStatus: document.getElementById('tool-status'),
  importInput: document.getElementById('import'),
  roadmapBody: document.getElementById('roadmap-body'),
  missablesBody: document.getElementById('missables-body'),
  sourcesBody: document.getElementById('sources-body'),
};

function esc(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function isStory(trophy) {
  return trophy.kinds.includes('story');
}

/** A story trophy is masked while spoilers are hidden and it is unearned. */
function isMasked(trophy) {
  return state.hideSpoilers && isStory(trophy) && !earned.has(trophy.id);
}

function displayName(trophy) {
  return isMasked(trophy) ? 'Hidden story trophy' : trophy.name;
}

function displayDescription(trophy) {
  if (isMasked(trophy)) {
    return 'A story trophy. Its name and description stay hidden until you earn it — or turn off “Hide story spoilers”.';
  }
  return trophy.description;
}

function gradeBadge(trophy) {
  return `<span class="badge grade-${trophy.grade}">${GRADE_LABEL[trophy.grade]}</span>`;
}

function flagBadges(trophy) {
  const flags = [];
  if (trophy.missable) flags.push('<span class="badge flag-missable">Missable</span>');
  if (trophy.hidden) flags.push('<span class="badge flag-hidden">Hidden on PS5</span>');
  for (const kind of trophy.kinds) {
    if (kind === 'missable') continue; // already shown by the Missable flag
    flags.push(`<span class="badge flag-kind">${KIND_LABEL[kind]}</span>`);
  }
  return flags.join(' ');
}

function sourceList(trophy) {
  const items = trophy.sources.map((name) => {
    const source = sourceByName.get(name);
    if (source && source.url) {
      return `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(name)}</a></li>`;
    }
    return `<li>${esc(name)}</li>`;
  });
  return `<ul class="source-list">${items.join('')}</ul>`;
}

function matchesFilters(trophy) {
  if (filters.grade !== 'all' && trophy.grade !== filters.grade) return false;
  if (filters.kind === 'missable' && !trophy.missable) return false;
  if (
    filters.kind !== 'all' &&
    filters.kind !== 'missable' &&
    !trophy.kinds.includes(filters.kind)
  ) {
    return false;
  }
  if (filters.state === 'earned' && !earned.has(trophy.id)) return false;
  if (filters.state === 'unearned' && earned.has(trophy.id)) return false;
  if (filters.q) {
    const haystack =
      `${trophy.name} ${trophy.description} ${trophy.guide} ${trophy.target ?? ''}`.toLowerCase();
    if (!haystack.includes(filters.q.toLowerCase())) return false;
  }
  return true;
}

function renderProgress() {
  el.earnedCount.textContent = String(earned.size);
  el.progressFill.style.width = `${(earned.size / trophies.length) * 100}%`;
  const tally = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  const totals = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const t of trophies) {
    totals[t.grade] += 1;
    if (earned.has(t.id)) tally[t.grade] += 1;
  }
  el.progressGrades.textContent =
    `Platinum ${tally.platinum}/${totals.platinum} · Gold ${tally.gold}/${totals.gold} · ` +
    `Silver ${tally.silver}/${totals.silver} · Bronze ${tally.bronze}/${totals.bronze}`;
  if (earned.size === trophies.length) {
    el.progressNote.textContent = 'All 55 earned — Vice Got a Price! Welcome to the legend.';
  } else if (!earned.has(MISSABLE_ID)) {
    el.progressNote.textContent =
      'One to watch: Positive Mental Attitude has a meditation spot that disappears after Chapter 1.';
  } else {
    el.progressNote.textContent = `${trophies.length - earned.size} to go. The missable is safe.`;
  }
}

function renderList() {
  const shown = trophies.filter(matchesFilters);
  el.resultCount.textContent = `Showing ${shown.length} of ${trophies.length} trophies`;
  if (filters.kind === 'online' && shown.length === 0) {
    el.list.innerHTML =
      '<p class="empty">Grand Theft Auto VI lists no online trophies: all 55 are earned in single player, so there is nothing to track here.</p>';
    return;
  }
  if (shown.length === 0) {
    el.list.innerHTML = '<p class="empty">No trophy matches those filters.</p>';
    return;
  }
  el.list.innerHTML = shown
    .map((t) => {
      const done = earned.has(t.id);
      return `<article class="trophy-row${done ? ' is-earned' : ''}${t.id === selectedId ? ' is-selected' : ''}" data-id="${t.id}">
        <label class="row-check" title="Mark as earned">
          <input type="checkbox" data-earn="${t.id}" ${done ? 'checked' : ''}>
        </label>
        <button type="button" class="row-open" data-open="${t.id}">
          <span class="row-top">${gradeBadge(t)}<span class="row-name">${esc(displayName(t))}</span></span>
          <span class="row-desc">${esc(displayDescription(t))}</span>
          <span class="row-flags">${flagBadges(t)}${t.target && !isMasked(t) ? `<span class="row-target">${esc(t.target)}</span>` : ''}</span>
        </button>
      </article>`;
    })
    .join('');
}

function renderDetail() {
  const t = trophyById.get(selectedId);
  if (!t) {
    el.detail.innerHTML = '<p class="empty">Pick a trophy to read its guide.</p>';
    return;
  }
  const done = earned.has(t.id);
  const stage = roadmapDoc.stages.find((s) => s.n === t.stage);
  el.detail.innerHTML = `
    <div class="detail-head">
      ${gradeBadge(t)}
      <h2>${esc(displayName(t))}</h2>
    </div>
    <p class="detail-desc">“${esc(displayDescription(t))}” <span class="official-tag">official description</span></p>
    <div class="detail-flags">${flagBadges(t)}</div>
    ${t.target && !isMasked(t) ? `<p class="detail-target"><strong>Target:</strong> ${esc(t.target)}</p>` : ''}
    ${t.missable ? '<p class="detail-warn"><strong>Missable:</strong> one of its 18 spots exists only in Chapter 1. See the Missables view before you finish that chapter.</p>' : ''}
    <h3>Guide</h3>
    <p class="detail-guide">${esc(isMasked(t) ? 'Earn this story trophy to reveal its guide, or turn off “Hide story spoilers”.' : t.guide)}</p>
    ${stage ? `<p class="detail-stage"><strong>Roadmap:</strong> Stage ${stage.n} — ${esc(stage.title)}</p>` : ''}
    <label class="detail-earn"><input type="checkbox" data-earn="${t.id}" ${done ? 'checked' : ''}> I have earned this trophy</label>
    <h3>Sources</h3>
    ${sourceList(t)}
    <p class="detail-source-note">The official name, description and grade are PlayStation's, as tracked by Exophase and PSNProfiles. The guide is this entry's own words; the sources named here are where its facts come from.</p>`;
}

function stageChips(stage) {
  return stage.trophyIds
    .map((id) => {
      const t = trophyById.get(id);
      const done = earned.has(id);
      return `<button type="button" class="stage-chip${done ? ' is-earned' : ''}" data-open="${id}">${done ? '✓ ' : ''}${esc(displayName(t))}</button>`;
    })
    .join(' ');
}

function renderRoadmap() {
  const stages = roadmapDoc.stages
    .map(
      (s) => `<article class="stage-card">
        <h3><span class="stage-n">Stage ${s.n}</span> ${esc(s.title)}</h3>
        <p>${esc(s.summary)}</p>
        <div class="stage-chips">${stageChips(s)}</div>
      </article>`,
    )
    .join('');
  el.roadmapBody.innerHTML = `
    <h2 class="view-title">${esc(roadmapDoc.title)}</h2>
    <p class="view-intro">${esc(roadmapDoc.intro)}</p>
    ${stages}
    <article class="stage-card save-card">
      <h3>Save rules that protect the run</h3>
      ${roadmapDoc.saveRules.map((r) => `<p><strong>${esc(r.title)}.</strong> ${esc(r.text)}</p>`).join('')}
    </article>`;
}

function renderMissables() {
  const cards = roadmapDoc.missables
    .map((m) => {
      const t = trophyById.get(m.trophyId);
      return `<article class="missable-card">
        <div class="detail-head">${gradeBadge(t)}<h3>${esc(t.name)}</h3></div>
        <p class="detail-desc">“${esc(t.description)}”</p>
        <p><strong>${esc(m.title)}.</strong> ${esc(m.text)}</p>
        <h4>Guide</h4>
        <p>${esc(t.guide)}</p>
        <h4>Sources</h4>
        ${sourceList(t)}
      </article>`;
    })
    .join('');
  el.missablesBody.innerHTML = `
    <h2 class="view-title">Missable trophies &amp; save rules</h2>
    <p class="view-intro">Built from the official descriptions and the published guides' reporting: of all 55 trophies, exactly one is reported missable. Everything else either cannot be missed (the 12 story trophies) or stays available after the credits. The save rules below are what keep a single playthrough safe, because GTA VI has no mission replay.</p>
    ${cards}
    <article class="stage-card save-card">
      <h3>Save rules</h3>
      ${roadmapDoc.saveRules.map((r) => `<p><strong>${esc(r.title)}.</strong> ${esc(r.text)}</p>`).join('')}
    </article>`;
}

function renderSources() {
  const cards = roadmapDoc.sources
    .map(
      (s) => `<article class="source-card">
        <h3>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name)}</h3>
        <p>${esc(s.what)}</p>
      </article>`,
    )
    .join('');
  el.sourcesBody.innerHTML = `
    <h2 class="view-title">Sources</h2>
    <p class="view-intro">The official trophy names, descriptions and grades are PlayStation's, as published on 18 November 2026 and tracked independently by Exophase and PSNProfiles, which agree on all 55. Every guide in this app is written in this entry's own words; beside each trophy the app names the sources its facts come from, and the directory below says what each source was used for. Links open only when you follow them — the app itself fetches nothing.</p>
    ${cards}`;
}

function renderAll() {
  renderProgress();
  renderList();
  renderDetail();
}

function showView(view) {
  filters.view = view;
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.view === view);
  });
  for (const name of ['tracker', 'roadmap', 'missables', 'sources']) {
    document.getElementById(`view-${name}`).hidden = name !== view;
  }
  if (view === 'roadmap') renderRoadmap();
  if (view === 'missables') renderMissables();
  if (view === 'sources') renderSources();
}

function persist() {
  state.earned = [...earned];
  saveState(state);
}

function setEarned(id, on) {
  if (on) earned.add(id);
  else earned.delete(id);
  persist();
  renderAll();
  if (filters.view === 'roadmap') renderRoadmap();
}

function markChipGroup(attr, value) {
  document.querySelectorAll(`[data-${attr}]`).forEach((chip) => {
    if (chip.dataset[attr] !== undefined && chip.classList.contains('chip')) {
      chip.classList.toggle('is-active', chip.dataset[attr] === value);
    }
  });
}

function openTrophy(id) {
  selectedId = id;
  showView('tracker');
  renderAll();
  const row = el.list.querySelector(`.trophy-row[data-id="${id}"]`);
  if (row) row.scrollIntoView({ block: 'nearest' });
}

// --- Controls -----------------------------------------------------------

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => showView(tab.dataset.view));
});

document.querySelectorAll('[data-kind]').forEach((chip) => {
  chip.addEventListener('click', () => {
    filters.kind = chip.dataset.kind;
    markChipGroup('kind', filters.kind);
    renderList();
  });
});

document.querySelectorAll('[data-grade]').forEach((chip) => {
  chip.addEventListener('click', () => {
    filters.grade = chip.dataset.grade;
    markChipGroup('grade', filters.grade);
    renderList();
  });
});

document.querySelectorAll('[data-state]').forEach((chip) => {
  chip.addEventListener('click', () => {
    filters.state = chip.dataset.state;
    markChipGroup('state', filters.state);
    renderList();
  });
});

el.search.addEventListener('input', () => {
  filters.q = el.search.value.trim();
  renderList();
});

el.spoilers.addEventListener('change', () => {
  state.hideSpoilers = el.spoilers.checked;
  persist();
  renderAll();
});

el.list.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-open]');
  if (opener) {
    selectedId = Number(opener.dataset.open);
    renderList();
    renderDetail();
  }
});

document.body.addEventListener('change', (event) => {
  const box = event.target.closest('[data-earn]');
  if (box) setEarned(Number(box.dataset.earn), box.checked);
});

document.body.addEventListener('click', (event) => {
  const chip = event.target.closest('.stage-chip[data-open]');
  if (chip) openTrophy(Number(chip.dataset.open));
});

document.getElementById('export').addEventListener('click', () => {
  const blob = new Blob([buildExport(state, trophies)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'gta6-trophy-progress.json';
  link.click();
  URL.revokeObjectURL(link.href);
  el.toolStatus.textContent = `Exported ${earned.size} earned trophies.`;
});

el.importInput.addEventListener('change', async () => {
  const file = el.importInput.files[0];
  if (!file) return;
  try {
    const ids = parseImport(await file.text(), trophies);
    earned.clear();
    for (const id of ids) earned.add(id);
    persist();
    renderAll();
    el.toolStatus.textContent = `Imported ${ids.length} earned trophies.`;
  } catch {
    el.toolStatus.textContent = 'That file could not be read as trophy progress.';
  }
  el.importInput.value = '';
});

document.getElementById('reset').addEventListener('click', () => {
  if (!window.confirm('Clear all earned trophies and settings?')) return;
  earned.clear();
  state.hideSpoilers = true;
  el.spoilers.checked = true;
  clearState();
  persist();
  renderAll();
  el.toolStatus.textContent = 'Progress cleared.';
});

// --- First paint ---------------------------------------------------------

el.search.value = filters.q;
el.spoilers.checked = state.hideSpoilers;
markChipGroup('kind', filters.kind);
markChipGroup('grade', filters.grade);
showView(filters.view);
renderAll();
