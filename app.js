import * as L from './logic.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
const today = () => L.parseDate(new Date());
const csv = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

let items = L.migrate(JSON.parse(localStorage.getItem('ms-items') || '[]'));
const settings = JSON.parse(localStorage.getItem('ms-settings') || '{}');
const ui = { type: '' };
const live = () => items.filter(i => !i.deleted && i.type !== 'Website'); // websites share the list so they sync and back up too
const sites = () => items.filter(i => !i.deleted && i.type === 'Website');
const byId = id => items.find(i => i.id === id);

function persist() {
  try { localStorage.setItem('ms-items', JSON.stringify(items)); }
  catch { toast('⚠ This device is out of storage space. Turn on GitHub sync or download a backup.'); }
}
const saveSettings = () => localStorage.setItem('ms-settings', JSON.stringify(settings));

// Call after any change. Pass the changed item(s) so they get a fresh timestamp for syncing.
function save(...changed) {
  const now = Date.now();
  for (const it of changed) { it.updatedAt = now; if (!items.includes(it)) items.push(it); }
  persist(); render(); schedulePush();
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 4000);
}

// ---------------- library screen ----------------
function filtered() {
  const q = L.normalize($('#search').value), st = $('#statusFilter').value, tag = $('#tagFilter').value, fav = $('#favFilter').checked;
  const list = live().filter(i => (!ui.type || i.type === ui.type) && (!st || i.status === st) && (!tag || i.tags.includes(tag)) && (!fav || i.fav) &&
    (!q || L.normalize([...L.allTitles(i), i.author, i.notes, i.tags.join(' '), i.source].join(' ')).includes(q)));
  const sorts = {
    updated: (a, b) => b.updatedAt - a.updatedAt,
    title: (a, b) => a.title.localeCompare(b.title),
    grade: (a, b) => (b.grade || 0) - (a.grade || 0),
    finished: (a, b) => (b.finished || '').localeCompare(a.finished || ''),
  };
  return list.sort(sorts[$('#sort').value]);
}

function card(it) {
  const others = [it.titles.english, it.titles.romaji, it.titles.native].filter(t => t && t !== it.title);
  const p = it.progress;
  return `<article class="card" data-id="${it.id}" tabindex="0">
    ${it.cover ? `<img src="${esc(safeUrl(it.cover))}" alt="" loading="lazy">` : `<div class="nocover">${esc(it.type)}</div>`}
    <div class="body">
      <h3>${esc(it.title)}</h3>
      ${others.length ? `<p class="alt">${esc([...new Set(others)].join(' · '))}</p>` : ''}
      <p class="meta"><span class="badge">${esc(it.type)}</span>
        <span class="st-${it.status}">${L.STATUSES[it.status]}</span>
        ${it.grade ? `<span>★ ${it.grade}</span>` : ''}
        ${it.releaseStatus ? `<span class="muted">${esc(it.releaseStatus)}</span>` : ''}</p>
      <div class="row">
        <span class="muted">${p.current || 0}${p.total ? '/' + p.total : ''} ${esc(p.unit)}${it.rereads ? ` · ${it.rereads}× again` : ''}</span>
        <button data-plus title="One more ${esc(p.unit)}" aria-label="Add one">+1</button>
        <button data-fav aria-label="Favourite" aria-pressed="${!!it.fav}">${it.fav ? '❤' : '♡'}</button>
      </div>
    </div></article>`;
}

function render() {
  const all = live(), counts = {};
  all.forEach(i => counts[i.type] = (counts[i.type] || 0) + 1);
  $('#tabs').innerHTML = [['', 'All', all.length], ...L.TYPES.filter(t => counts[t]).map(t => [t, t, counts[t]])]
    .map(([v, label, n]) => `<button role="tab" data-type="${esc(v)}" aria-selected="${ui.type === v}">${esc(label)} <small>${n}</small></button>`).join('');
  const tf = $('#tagFilter'), keep = tf.value, tags = [...new Set(all.flatMap(i => i.tags))].sort();
  tf.innerHTML = '<option value="">Any tag / list</option>' + tags.map(t => `<option ${t === keep ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const list = filtered();
  $('#list').innerHTML = list.map(card).join('') ||
    `<p class="muted">${all.length ? 'Nothing matches these filters.' : 'Your shelf is empty. Type a title or paste a link in the box at the top.'}</p>`;
}

$('#statusFilter').innerHTML += Object.entries(L.STATUSES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
['#search', '#statusFilter', '#tagFilter', '#favFilter', '#sort'].forEach(s => $(s).addEventListener('input', render));
$('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (b) { ui.type = b.dataset.type; render(); } });

function bump(it) {
  const p = it.progress;
  p.current = (p.current || 0) + 1;
  if (it.status === 'planning' || it.status === 'paused') it.status = 'progress';
  if (p.total && p.current >= p.total && it.status !== 'finished') {
    it.status = 'finished'; it.finished ||= today(); toast(`🎉 Finished “${it.title}”! Click it to give it a grade.`);
  }
  save(it);
}

$('#list').addEventListener('click', e => {
  const el = e.target.closest('.card'); if (!el) return;
  const it = byId(el.dataset.id);
  if (e.target.closest('[data-plus]')) bump(it);
  else if (e.target.closest('[data-fav]')) { it.fav = !it.fav; save(it); }
  else openEdit(it);
});
$('#list').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.card')) openEdit(byId(e.target.dataset.id)); });

$('#randomBtn').onclick = () => {
  const planned = live().filter(i => i.status === 'planning');
  const types = L.TYPES.filter(t => planned.some(i => i.type === t));
  if (!types.length) return toast('Nothing with status “Planning” yet.');
  const chosen = settings.randomTypes || types;
  showDialog(`<h2>🎲 What next?</h2><p class="muted">Pick at random from your Planning list, in these sections:</p>
    <div class="checks">${types.map(t => `<label><input type="checkbox" name="rt" value="${esc(t)}" ${chosen.includes(t) ? 'checked' : ''}> ${esc(t)} <small class="muted">${planned.filter(i => i.type === t).length}</small></label>`).join('')}</div>
    <p><button type="button" data-all="1">All</button> <button type="button" data-all="">None</button></p>
    <div id="pickResult"></div>
    <div class="actions"><button type="button" id="pickBtn" class="primary">🎲 Pick</button> <button type="button" data-close>Close</button></div>`);
  const boxes = () => [...dlgForm.querySelectorAll('[name=rt]')];
  dlgForm.onclick = e => {
    if (e.target.closest('[data-close]')) return dlg.close();
    const all = e.target.closest('[data-all]');
    if (all) return boxes().forEach(b => { b.checked = !!all.dataset.all; });
    const open = e.target.closest('[data-open]');
    if (open) return openEdit(byId(open.dataset.open));
    if (e.target.id !== 'pickBtn') return;
    settings.randomTypes = boxes().filter(b => b.checked).map(b => b.value); saveSettings();
    const pool = planned.filter(i => settings.randomTypes.includes(i.type));
    if (!pool.length) return toast('Tick at least one section.');
    const it = pool[Math.floor(Math.random() * pool.length)];
    $('#pickResult').innerHTML = `<div class="pick">${it.cover ? thumb(it.cover) : `<span class="nocover">${esc(it.type)}</span>`}
      <div><h3>${esc(it.title)}</h3><p class="muted">${esc(it.type)}${it.genres?.length ? ' · ' + esc(it.genres.slice(0, 3).join(', ')) : ''}</p>
      <button type="button" data-open="${it.id}">Open</button></div></div>`;
    e.target.textContent = '🎲 Pick another';
  };
};

// ---------------- dialogs ----------------
const dlg = $('#dlg'), dlgForm = $('#dlgForm');
function showDialog(html) { dlgForm.innerHTML = html; if (!dlg.open) dlg.showModal(); }
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }); // click outside closes
dlgForm.addEventListener('submit', e => e.preventDefault()); // Enter in a field must not close the dialog and lose edits

const typeOptions = sel => L.TYPES.map(t => `<option ${t === sel ? 'selected' : ''}>${t}</option>`).join('');
const statusOptions = sel => Object.entries(L.STATUSES).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');

// ---- add ----
$('#addForm').addEventListener('submit', e => {
  e.preventDefault();
  hideSuggest();
  const text = addInput.value.trim();
  if (!text) return;
  if (['TikTok', 'Video'].includes(L.isUrl(text) && L.parseLink(text)?.type)) { addInput.value = ''; openPost(text); } else openAdd(text);
});

// ---- suggestions while typing ----
const box = $('#suggest'), addInput = $('#addInput');
let sugTimer, sugSeq = 0, sugActions = [], sugActive = -1;
const thumb = src => src ? `<img src="${esc(safeUrl(src))}" alt="" loading="lazy">` : '<span class="nocover"></span>';

function hideSuggest() {
  clearTimeout(sugTimer); sugSeq++; // also cancels a search still running
  box.hidden = true; sugActive = -1;
  addInput.setAttribute('aria-expanded', 'false'); addInput.removeAttribute('aria-activedescendant');
}
addInput.addEventListener('input', () => {
  clearTimeout(sugTimer);
  const q = addInput.value.trim();
  if (q.length < 2 || L.isUrl(q)) return hideSuggest();
  sugTimer = setTimeout(() => suggest(q), 350);
});

async function suggest(q) {
  const seq = ++sugSeq, nq = L.normalize(q);
  const mine = live().filter(i => L.bestSimilarity(q, i) >= 0.6 || L.allTitles(i).some(t => L.normalize(t).includes(nq))).slice(0, 3);
  drawSuggest(q, mine, null, '');
  let online = [];
  try { online = (await searchAniList(q)).slice(0, 6); } catch { /* offline: shelf matches still show */ }
  if (seq !== sugSeq) return; // user kept typing
  const fix = q.length >= 4 && !online.some(r => L.isMatch(q, r)) ? await spellFix(q) : '';
  if (seq === sugSeq) drawSuggest(q, mine, online, fix);
}

function drawSuggest(q, mine, online, fix) {
  sugActions = [];
  const opt = (action, inner) => `<button type="button" role="option" id="sug${sugActions.push(action) - 1}" data-s="${sugActions.length - 1}">${inner}</button>`;
  let html = fix ? opt(() => { addInput.value = fix; suggest(fix); }, `<span class="fix">Did you mean <b>${esc(fix)}</b>?</span>`) : '';
  if (mine.length) html += '<div class="head">Already on your shelf</div>' + mine.map(i =>
    opt(() => { hideSuggest(); openEdit(i); }, `${thumb(i.cover)}<span>${esc(i.title)}<small>${esc(i.type)} · ${L.STATUSES[i.status]}</small></span>`)).join('');
  if (!online) html += '<div class="head">Searching…</div>';
  else if (online.length) html += '<div class="head">Add</div>' + online.map(r =>
    opt(() => { hideSuggest(); const it = addCandidate(r, 'planning'); if (it) openEdit(it); },
      `${thumb(r.cover)}<span>${esc(r.title)}<small>${esc([r.titles.native !== r.title && r.titles.native, r.type, r.year].filter(Boolean).join(' · '))}</small></span>`)).join('');
  html += opt(() => { hideSuggest(); openAdd(q); }, `<span>🔎 Search everywhere for “${esc(q)}”<small>also books, series, movies and audiobooks</small></span>`);
  box.innerHTML = html; box.hidden = false; sugActive = -1;
  addInput.setAttribute('aria-expanded', 'true');
}

box.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) sugActions[b.dataset.s](); });
addInput.addEventListener('keydown', e => {
  if (box.hidden) return;
  const opts = box.querySelectorAll('[data-s]'), n = opts.length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    sugActive = e.key === 'ArrowDown' ? (sugActive + 1) % n : (sugActive <= 0 ? n : sugActive) - 1;
    opts.forEach((o, i) => o.setAttribute('aria-selected', i === sugActive));
    addInput.setAttribute('aria-activedescendant', opts[sugActive].id);
    opts[sugActive].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && sugActive >= 0) { e.preventDefault(); sugActions[opts[sugActive].dataset.s](); }
  else if (e.key === 'Escape') hideSuggest();
});
document.addEventListener('click', e => { if (!e.target.closest('#addForm')) hideSuggest(); });

// "Did you mean …?" from Wikipedia's spelling suggestions; only offered when it is close to what was typed.
async function spellFix(q) {
  try {
    const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srinfo=suggestion&srlimit=1&format=json&origin=*`);
    const fixes = [j.query.searchinfo?.suggestion, j.query.search[0]?.title.replace(/\s*\(.*\)$/, '')]
      .filter(s => s && L.normalize(s) !== L.normalize(q) && L.similarity(s, q) >= 0.6);
    const fix = fixes[0] || '';
    return fix === fix.toLowerCase() ? fix.replace(/(^|\s)\p{L}/gu, c => c.toUpperCase()) : fix;
  } catch { return ''; }
}

async function openAdd(text) {
  const link = L.isUrl(text) ? L.parseLink(text) : null;
  const query = link ? link.title : text;
  const searchable = query && !(link && ['Fanfic', 'TikTok', 'Video'].includes(link.type));
  const head = `<h2>Add ${link ? `link from ${esc(link.site)}` : `“${esc(text)}”`}</h2>
    <label>Add it as <select id="addStatus">${statusOptions('planning')}</select></label>`;
  const manual = `<h3>Or add it yourself</h3><div class="stack">
    <label>Title <input id="manTitle" value="${esc(query)}" placeholder="Title"></label>
    <label>Section <select id="manType">${typeOptions(link?.type || 'Other')}</select></label>
    <button type="button" id="manAdd">Add</button></div>
    <p><button type="button" data-close>Cancel</button></p>`;
  showDialog(head + (searchable ? '<p class="muted" id="searching">Searching AniList, TVmaze, Wikipedia, Open Library and Apple Books…</p>' : '') + manual);
  let results = [], fix = '';
  dlgForm.onclick = e => { // set before searching so "add it yourself" works while the search runs
    if (e.target.closest('[data-close]')) return dlg.close();
    if (e.target.closest('[data-fix]')) return openAdd(fix);
    const status = $('#addStatus').value;
    const pick = e.target.closest('[data-pick]');
    let cand;
    if (pick) cand = results[pick.dataset.pick];
    else if (e.target.id === 'manAdd') {
      const title = $('#manTitle').value.trim();
      if (!title) return $('#manTitle').focus();
      cand = { title, type: $('#manType').value };
    } else return;
    if (link) cand = { ...cand, links: [{ label: link.site, url: text }, ...(cand.links || [])] };
    addCandidate(cand, status);
  };
  if (searchable) {
    results = byCloseness(query, await searchAll(query));
    if (!results.some(r => L.isMatch(query, r))) fix = await spellFix(query);
    if (!dlg.open || !$('#searching')) return; // closed or replaced meanwhile
    $('#searching').outerHTML = (fix ? `<p><button type="button" class="linklike fix" data-fix>Did you mean “${esc(fix)}”?</button></p>` : '') + (results.length
      ? `<p class="muted">Pick the right one. It goes into the right section automatically.</p>${resultsHtml(results)}`
      : '<p class="muted">Nothing found online. Add it yourself below.</p>');
  }
}

// Closest titles first; equally close ones keep the order the sources gave.
const byCloseness = (q, list, prefer) => list.map(r => [L.bestSimilarity(q, r), r]).sort((a, b) => b[0] - a[0] || (b[1].type === prefer) - (a[1].type === prefer)).map(x => x[1]);

const resultsHtml = results => `<div class="results">${results.map((r, i) => `
  <button type="button" class="result" data-pick="${i}">
    ${thumb(r.cover)}
    <span><b>${esc(r.title)}</b>
    <small>${esc([r.titles?.romaji, r.titles?.native].filter(t => t && t !== r.title).join(' · '))}</small>
    <small><span class="badge">${esc(r.type)}</span> ${esc(r.year || '')} ${esc(r.author || r.hint || '')} · ${esc(r.src)}</small></span>
  </button>`).join('')}</div>`;

function addCandidate(cand, status) {
  const dup = L.findDuplicate(items, cand);
  if (dup && !confirm(`“${dup.title}” is already in your ${dup.type} section. Add it again anyway?`)) return openEdit(dup);
  const it = L.makeItem({ ...cand, status, finished: status === 'finished' ? today() : '' });
  save(it);
  $('#addInput').value = '';
  toast(`Added to ${it.type}`);
  if (status === 'finished') openEdit(it); else dlg.close();
  return it;
}

// ---- edit ----
function related(it) {
  const mine = new Set(L.allTitles(it).map(L.normalize));
  const out = (it.relations || []).map(r => ({ ...r, have: live().find(o => o.ext?.anilist === r.anilistId) }));
  for (const o of live()) {
    if (o === it || out.some(r => r.have === o)) continue;
    const linked = (o.relations || []).some(r => r.anilistId && r.anilistId === it.ext?.anilist) ||
      (o.type !== it.type && L.allTitles(o).some(t => mine.has(L.normalize(t))));
    if (linked) out.push({ title: o.title, type: o.type, rel: 'same story', have: o });
  }
  return out;
}

function openEdit(it) {
  const t = it.titles, p = it.progress;
  const rel = related(it);
  const next = it.nextRelease?.at > Date.now() ? `Next: ${esc(it.nextRelease.label)} on ${new Date(it.nextRelease.at).toLocaleString()}` : '';
  const finds = L.findLinks(it, settings.country || 'us');
  showDialog(`
    <div class="edit-head">
      ${it.cover ? `<img src="${esc(safeUrl(it.cover))}" alt="">` : ''}
      <div><h2>${esc(it.title)}</h2>
        <p class="muted">${esc([it.type, it.year, it.author, it.releaseStatus].filter(Boolean).join(' · '))}</p>
        ${next ? `<p>📅 ${next}</p>` : ''}
        ${it.genres?.length ? `<p class="muted">${esc(it.genres.join(', '))}</p>` : ''}</div>
    </div>
    ${rel.length ? `<h3>Other versions of this story</h3><div class="chips">${rel.map(r => r.have
      ? `<button type="button" data-open="${r.have.id}">✔ ${esc(r.type)}: ${esc(r.title)}</button>`
      : `<button type="button" data-addrel="${r.anilistId}" title="Add to your list">＋ ${esc(r.type)}: ${esc(r.title)} <small>(${esc(r.rel)})</small></button>`).join('')}</div>` : ''}
    <p><button type="button" id="lookupBtn">🔎 ${Object.keys(it.ext).length ? 'Wrong title or cover? Search again' : 'Find titles, cover and links online'}</button></p>
    <h3>Read / watch / listen</h3>
    <div class="chips">${it.links.map(l => safeUrl(l.url) && `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || 'Link')}</a>`).join('')}</div>
    <p class="muted small">Search on: ${finds.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join(' · ')}</p>
    <div class="cols">
      <label>Title <input name="title" value="${esc(it.title)}" required></label>
      <label>Author <input name="author" value="${esc(it.author)}"></label>
      <label>English title <input name="english" value="${esc(t.english)}"></label>
      <label>Romanized title <input name="romaji" value="${esc(t.romaji)}"></label>
      <label>Original title <input name="native" value="${esc(t.native)}"></label>
      <label>Other names <small>(comma-separated)</small> <input name="alt" value="${esc(t.alt.join(', '))}"></label>
      <label>Section <select name="type">${typeOptions(it.type)}</select></label>
      <label>Status <select name="status">${statusOptions(it.status)}</select></label>
      <label>My grade (1–10) <input name="grade" type="number" min="1" max="10" step="0.5" value="${it.grade ?? ''}"></label>
      <label>Finished on <input name="finished" type="date" value="${esc(it.finished)}"></label>
      <label>Progress <span class="inline"><input name="current" type="number" min="0" value="${p.current || 0}"> of
        <input name="total" type="number" min="0" value="${p.total ?? ''}" placeholder="?">
        <input name="unit" value="${esc(p.unit)}" size="5" aria-label="unit"></span></label>
      <label>Times re-read / re-watched <input name="rereads" type="number" min="0" value="${it.rereads || 0}"></label>
      <label>Tags & lists <small>(comma-separated)</small> <input name="tags" value="${esc(it.tags.join(', '))}" placeholder="favourites, uni, comfort read"></label>
      <label>Heard about it from <input name="source" value="${esc(it.source)}" placeholder="friend, TikTok, …"></label>
      <label class="check"><input name="fav" type="checkbox" ${it.fav ? 'checked' : ''}> ❤ Favourite</label>
    </div>
    <label>Links <small>(one per line: name | address)</small>
      <textarea name="links" rows="3" placeholder="AO3 | https://archiveofourown.org/works/…">${esc(it.links.map(l => `${l.label} | ${l.url}`).join('\n'))}</textarea></label>
    <label>Notes <textarea name="notes" rows="3">${esc(it.notes)}</textarea></label>
    <details><summary>Spoiler notes (hidden)</summary><textarea name="spoilers" rows="3" aria-label="Spoiler notes">${esc(it.spoilers)}</textarea></details>
    <label>Favourite quotes <textarea name="quotes" rows="2">${esc(it.quotes)}</textarea></label>
    <div class="actions">
      <button type="button" id="saveBtn" class="primary">Save</button>
      <button type="button" data-close>Cancel</button>
      <button type="button" id="delBtn" class="danger">Delete</button>
    </div>`);

  dlgForm.onclick = async e => {
    if (e.target.closest('[data-close]')) return dlg.close();
    const open = e.target.closest('[data-open]');
    if (open) return openEdit(byId(open.dataset.open));
    const addRel = e.target.closest('[data-addrel]');
    if (addRel) {
      addRel.disabled = true;
      try {
        const [cand] = await aniListByIds([+addRel.dataset.addrel]);
        const added = addCandidate(cand, 'planning');
        if (added) openEdit(added);
      } catch (err) { toast('Could not load it: ' + err.message); addRel.disabled = false; }
      return;
    }
    if (e.target.id === 'lookupBtn') return openLookup(it);
    if (e.target.id === 'delBtn' && confirm(`Delete “${it.title}” from your shelf?`)) {
      it.deleted = true; save(it); dlg.close(); toast('Deleted');
    }
    if (e.target.id === 'saveBtn') {
      if (!dlgForm.reportValidity()) return;
      const f = Object.fromEntries(new FormData(dlgForm));
      Object.assign(it, {
        title: f.title.trim(), author: f.author.trim(), type: f.type, status: f.status,
        grade: f.grade ? +f.grade : null, finished: f.finished || (f.status === 'finished' && it.status !== 'finished' ? today() : ''),
        rereads: +f.rereads || 0, tags: csv(f.tags), source: f.source.trim(), fav: !!f.fav,
        notes: f.notes, spoilers: f.spoilers, quotes: f.quotes,
        titles: { english: f.english.trim(), romaji: f.romaji.trim(), native: f.native.trim(), alt: csv(f.alt) },
        progress: { current: +f.current || 0, total: +f.total || null, unit: f.unit.trim() },
        links: f.links.split('\n').map(line => {
          const m = line.match(/https?:\/\/\S+/);
          return m && { label: line.slice(0, m.index).replace(/[|:\s]+$/, '').trim() || L.parseLink(m[0])?.site || 'Link', url: m[0] };
        }).filter(Boolean),
      });
      save(it); dlg.close(); toast('Saved');
    }
  };
}

// For titles added by hand or imported: fill in titles, cover, links and versions, keep my own grade, notes and status.
async function openLookup(it) {
  showDialog(`<h2>Find “${esc(it.title)}” online</h2><p class="muted" id="searching">Searching…</p><p><button type="button" data-back>Back</button></p>`);
  let results = [];
  dlgForm.onclick = e => {
    if (e.target.closest('[data-back]')) return openEdit(it);
    const pick = e.target.closest('[data-pick]');
    if (!pick) return;
    const r = results[pick.dataset.pick];
    if (r.type !== it.type) it.progress.unit = L.unitFor(r.type);
    Object.assign(it, {
      type: r.type, titles: { ...it.titles, ...r.titles }, cover: r.cover || it.cover, genres: r.genres || it.genres, year: r.year || it.year,
      author: it.author || r.author || '', ext: r.ext || {}, releaseStatus: r.releaseStatus || '', nextRelease: r.nextRelease || null,
      relations: r.relations || [], links: [...it.links, ...(r.links || []).filter(l => !it.links.some(m => m.url === l.url))],
    });
    it.progress.total ||= r.total || null;
    it.tags = it.tags.filter(t => t !== 'please check' && t !== 'not found');
    save(it); toast('Details added'); openEdit(it);
  };
  results = byCloseness(it.title, await searchAll(it.title));
  results.sort((a, b) => (b.type === it.type) - (a.type === it.type)); // same section first
  if (!$('#searching')) return;
  $('#searching').outerHTML = results.length ? resultsHtml(results) : '<p class="muted">Nothing found. Try changing the title first.</p>';
}

// ---- shared posts: read the caption or pasted text, offer the titles found ----
$('#pasteBtn').onclick = () => openPost('');

// Only YouTube shares a post's title with outside apps; TikTok's answer has no caption.
async function postCaption(url) {
  if (L.parseLink(url)?.site !== 'YouTube') return '';
  try { return (await getJson('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url))).title || ''; }
  catch { return ''; } // private or deleted video, or offline: pasted text still works
}

function openPost(text) {
  showDialog(`<h2>📋 Paste a post or recommendations</h2>
    <p class="muted">Paste a link together with the caption or a list of titles. TikTok does not let apps read its captions, and no app here can see what is said or shown in a video, so type or copy those titles into the box too. For YouTube, the video's title is read for you.</p>
    <label>Post or list <textarea id="postText" rows="6" placeholder="https://www.tiktok.com/@…\n1. Dune\n2. Fourth Wing">${esc(text)}</textarea></label>
    <div class="actions"><button type="button" id="postFind" class="primary">Find titles</button> <button type="button" data-close>Cancel</button></div>
    <div id="postResult"></div>`);
  let rows = [], url = '', note = '';
  dlgForm.onclick = async e => {
    if (e.target.closest('[data-close]')) return dlg.close();
    if (e.target.id === 'postAdd') return addFromPost(rows, url, note);
    if (e.target.id !== 'postFind') return;
    e.target.disabled = true;
    const typed = $('#postText').value, out = $('#postResult');
    url = typed.match(/https?:\/\/\S+/)?.[0] || '';
    out.innerHTML = '<p class="muted">Reading the post…</p>';
    const caption = url ? await postCaption(url) : '';
    note = caption || typed.replace(url, '').trim();
    const words = (typed + '\n' + caption).replace(/https?:\/\/\S+/g, ' ');
    const titles = L.extractTitles(words), prefer = L.typeFromText(words) || (/\sby\s/i.test(words) ? 'Novel' : ''); // "booktok" or "by <author>": the book version first
    rows = [];
    for (const [n, title] of titles.entries()) {
      if (!$('#postResult')) return; // dialog was closed
      out.innerHTML = `<p class="muted">Searching ${n + 1} of ${titles.length}: ${esc(title)}…</p>`;
      rows.push({ title, results: byCloseness(title, await searchAll(title), prefer).slice(0, 5) });
    }
    if (!$('#postResult')) return;
    e.target.disabled = false;
    out.innerHTML = `${caption ? `<h3>Caption</h3><p class="caption">${esc(caption)}</p>` : ''}
      ${rows.length ? '<h3>Titles found</h3><p class="muted">Untick anything wrong, and choose the right version.</p>' : `<p class="muted">No titles found. Add them to the box above and press Find titles again${url ? ', or just save the link below' : ''}.</p>`}
      <div class="found">${rows.map((r, i) => `<label><input type="checkbox" data-row="${i}" ${r.results.some(x => L.isMatch(r.title, x)) ? 'checked' : ''} aria-label="Add ${esc(r.title)}">
        <select data-choice="${i}" aria-label="Version of ${esc(r.title)}">${r.results.map((x, k) => `<option value="${k}">${esc(x.title)} (${esc(x.type)}${x.year ? ', ' + esc(x.year) : ''})</option>`).join('')}
        <option value="typed">“${esc(r.title)}” as written (Other)</option></select></label>`).join('')}</div>
      ${url ? `<label class="check"><input type="checkbox" id="postSave" checked> Also save the post itself</label>` : ''}
      ${rows.length || url ? '<div class="actions"><button type="button" id="postAdd" class="primary">Add to my shelf</button></div>' : ''}`;
  };
}

function addFromPost(rows, url, note) {
  const source = url || 'shared post', added = [];
  let skipped = 0;
  rows.forEach((r, i) => {
    if (!dlgForm.querySelector(`[data-row="${i}"]`).checked) return;
    const choice = dlgForm.querySelector(`[data-choice="${i}"]`).value;
    const cand = choice === 'typed' ? { title: r.title, type: 'Other' } : r.results[choice];
    if (L.findDuplicate(items, cand)) { skipped++; return; }
    added.push(L.makeItem({ ...cand, source, tags: ['from a post'] }));
  });
  if (url && $('#postSave')?.checked && !items.some(i => !i.deleted && i.links?.some(l => l.url === url))) {
    const link = L.parseLink(url);
    added.push(L.makeItem({ type: link?.type, title: note.split('\n')[0].slice(0, 90) || `${link?.site || 'Saved'} post`, notes: note, links: [{ label: link?.site || 'Link', url }], tags: ['from a post'] }));
  }
  if (added.length) save(...added);
  dlg.close();
  toast(`Added ${added.length}${skipped ? `, skipped ${skipped} already on your shelf` : ''}.`);
}

// ---------------- online lookups ----------------
async function getJson(url, opts) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(8000) }); // one slow site must not hold up the others
  if (!r.ok) throw new Error(`${new URL(url).hostname} answered ${r.status}`);
  return r.json();
}

const AL_FIELDS = `id type format countryOfOrigin status episodes chapters genres siteUrl synonyms
  title{romaji english native} coverImage{large} startDate{year} nextAiringEpisode{airingAt episode}
  externalLinks{site url type language} relations{edges{relationType node{id type format countryOfOrigin title{romaji english}}}}`;
const REL = new Set(['ADAPTATION', 'SOURCE', 'ALTERNATIVE', 'SEQUEL', 'PREQUEL', 'SPIN_OFF', 'SIDE_STORY', 'PARENT']);

async function aniList(query, variables) {
  const j = await getJson('https://graphql.anilist.co', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query, variables }),
  });
  return j.data.Page.media;
}

const fromAniList = m => ({
  src: 'AniList', type: L.anilistType(m), title: m.title.english || m.title.romaji,
  titles: { english: m.title.english || '', romaji: m.title.romaji || '', native: m.title.native || '', alt: (m.synonyms || []).slice(0, 6) },
  cover: m.coverImage?.large, genres: m.genres, year: m.startDate?.year, total: m.episodes || m.chapters,
  releaseStatus: L.RELEASE[m.status] || '',
  nextRelease: m.nextAiringEpisode && { at: m.nextAiringEpisode.airingAt * 1000, label: `Episode ${m.nextAiringEpisode.episode}` },
  ext: { anilist: m.id },
  links: [{ label: 'AniList', url: m.siteUrl }, ...(m.externalLinks || []).filter(l => l.type !== 'SOCIAL').map(l => ({ label: l.language ? `${l.site} (${l.language})` : l.site, url: l.url }))],
  relations: (m.relations?.edges || []).filter(e => REL.has(e.relationType)).map(e => ({
    anilistId: e.node.id, title: e.node.title.english || e.node.title.romaji, type: L.anilistType(e.node), rel: e.relationType.replace('_', ' ').toLowerCase(),
  })),
});

async function searchAniList(q) {
  const run = s => aniList(`query($s:String){Page(perPage:8){media(search:$s,sort:SEARCH_MATCH){${AL_FIELDS}}}}`, { s });
  let found = await run(q);
  const noS = q.replace(/(\p{L}{3,})s\b/gu, '$1'); // titles from web addresses lose apostrophes: "Readers" was "Reader's"
  if (!found.length && noS !== q) found = await run(noS);
  return found.map(fromAniList);
}
const aniListByIds = async ids => (await aniList(`query($ids:[Int]){Page(perPage:50){media(id_in:$ids){${AL_FIELDS}}}}`, { ids })).map(fromAniList);

async function searchTvmaze(q) {
  const res = await getJson(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
  return res.slice(0, 5).map(({ show: s }) => ({
    src: 'TVmaze', type: 'Anime & Series', title: s.name,
    cover: s.image?.medium, genres: s.genres, year: s.premiered?.slice(0, 4), releaseStatus: L.RELEASE[s.status] || s.status, ext: { tvmaze: s.id },
    links: [s.officialSite && { label: (s.webChannel || s.network)?.name || 'Official site', url: s.officialSite }, { label: 'TVmaze', url: s.url }].filter(Boolean),
  }));
}

async function searchOpenLibrary(q) {
  const res = await getJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5&fields=key,title,author_name,first_publish_year,cover_i,subject`);
  return res.docs.map(d => ({
    src: 'Open Library', type: 'Novel', title: d.title, author: d.author_name?.[0], year: d.first_publish_year,
    cover: d.cover_i && `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`, genres: (d.subject || []).slice(0, 4),
    ext: { openlibrary: d.key }, links: [{ label: 'Open Library', url: 'https://openlibrary.org' + d.key }],
  }));
}

async function searchAudiobooks(q) {
  const res = await getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=audiobook&limit=4`);
  return res.results.map(r => ({
    src: 'Apple', type: 'Audiobook', title: r.collectionName, author: r.artistName, year: r.releaseDate?.slice(0, 4),
    cover: r.artworkUrl100?.replace('100x100', '300x300'), links: [{ label: 'Apple Books', url: r.collectionViewUrl }],
  }));
}

// Wikipedia knows films by name and has their posters, with no key needed.
async function searchMovies(q) {
  const res = await getJson(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q + ' film')}&gsrlimit=8&prop=pageimages|description|info&inprop=url&piprop=thumbnail&pithumbsize=300&pilicense=any&format=json&formatversion=2&origin=*`);
  return (res.query?.pages || []).sort((x, y) => x.index - y.index).filter(p => /\bfilm\b/.test(p.description || '') && !/series/.test(p.description)).slice(0, 4).map(p => ({
    src: 'Wikipedia', type: 'Movie', title: p.title.replace(/\s*\([^)]*\)$/, ''), cover: p.thumbnail?.source, year: p.description.match(/\b\d{4}\b/)?.[0], hint: p.description.replace(/^\d{4} /, ''),
    ext: { wikipedia: p.pageid }, links: [{ label: 'Wikipedia', url: p.fullurl }],
  }));
}

async function searchAll(q) {
  const all = await Promise.allSettled([searchAniList(q), searchTvmaze(q), searchMovies(q), searchOpenLibrary(q), searchAudiobooks(q)]);
  all.filter(r => r.status === 'rejected').forEach(r => console.warn('search failed:', r.reason));
  return all.flatMap(r => r.value || []).filter(r => r.title);
}

async function refreshReleases() {
  const btn = $('#refreshBtn'); btn.disabled = true; btn.textContent = 'Updating…';
  const changed = [];
  try {
    const al = live().filter(i => i.ext?.anilist);
    for (let n = 0; n < al.length; n += 50) {
      const fresh = await aniListByIds(al.slice(n, n + 50).map(i => i.ext.anilist));
      for (const f of fresh) for (const it of al.filter(i => i.ext.anilist === f.ext.anilist)) {
        const before = JSON.stringify([it.releaseStatus, it.nextRelease, it.progress.total]);
        Object.assign(it, { releaseStatus: f.releaseStatus, nextRelease: f.nextRelease || null });
        it.progress.total ||= f.total || null;
        if (JSON.stringify([it.releaseStatus, it.nextRelease, it.progress.total]) !== before) changed.push(it);
      }
    }
    for (const it of live().filter(i => i.ext?.tvmaze)) {
      const s = await getJson(`https://api.tvmaze.com/shows/${it.ext.tvmaze}?embed=nextepisode`);
      const ep = s._embedded?.nextepisode;
      const next = ep ? { at: Date.parse(ep.airstamp), label: `Season ${ep.season} episode ${ep.number}` } : null;
      if (JSON.stringify([it.releaseStatus, it.nextRelease]) !== JSON.stringify([L.RELEASE[s.status] || s.status, next])) {
        Object.assign(it, { releaseStatus: L.RELEASE[s.status] || s.status, nextRelease: next }); changed.push(it);
      }
      await new Promise(r => setTimeout(r, 500)); // shortcut: fixed pause to stay under TVmaze's rate limit; fine for a few hundred shows
    }
    if (changed.length) save(...changed);
    toast(`Release info updated (${changed.length} changed)`);
  } catch (e) { toast('Update stopped: ' + e.message); if (changed.length) save(...changed); }
  btn.disabled = false; btn.textContent = 'Update release status and next episodes';
}

// ---------------- other screens ----------------
function showView(name) {
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === name));
  for (const id of ['library', 'sites', 'upcoming', 'stats', 'settings']) $('#' + id).hidden = id !== name;
  if (name === 'sites') renderSites();
  if (name === 'upcoming') renderUpcoming();
  if (name === 'stats') renderStats();
  if (name === 'settings') fillSettings();
}
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => showView(b.dataset.view));

function renderUpcoming() {
  const now = Date.now();
  const dated = live().filter(i => i.nextRelease?.at > now).sort((a, b) => a.nextRelease.at - b.nextRelease.at);
  const ongoing = live().filter(i => i.releaseStatus === 'Ongoing' && !dated.includes(i) && i.status !== 'dropped');
  const row = (i, when) => `<li><button type="button" class="linklike" data-open="${i.id}">${esc(i.title)}</button> <span class="badge">${esc(i.type)}</span> ${when}</li>`;
  $('#upcoming').innerHTML = `<h2>Coming up</h2>
    ${dated.length ? `<ul>${dated.map(i => row(i, `— ${esc(i.nextRelease.label)}, ${new Date(i.nextRelease.at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} (in ${Math.ceil((i.nextRelease.at - now) / 864e5)} days)`)).join('')}</ul>`
      : '<p class="muted">No dates known. Press “Update release status” in Settings to check.</p>'}
    <h2>Still coming out (no date yet)</h2>
    ${ongoing.length ? `<ul>${ongoing.map(i => row(i, '')).join('')}</ul>` : '<p class="muted">None.</p>'}`;
}
$('#upcoming').addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) openEdit(byId(b.dataset.open)); });

function renderStats() {
  const s = L.stats(live());
  const years = Object.entries(s.byYear).sort().reverse(), max = Math.max(1, ...years.map(y => y[1]));
  $('#stats').innerHTML = `<h2>Your shelf in numbers</h2><p>${s.total} titles in total.</p>
    <table><thead><tr><th>Section</th><th>Titles</th><th>Finished</th><th>Average grade</th></tr></thead><tbody>
    ${Object.entries(s.byType).map(([t, v]) => `<tr><td>${esc(t)}</td><td>${v.count}</td><td>${v.finished}</td><td>${v.graded ? (v.gradeSum / v.graded).toFixed(1) : '–'}</td></tr>`).join('')}
    </tbody></table>
    <h2>Finished per year</h2>
    ${years.map(([y, n]) => `<div class="bar"><span>${y}</span><i style="width:${n / max * 100}%"></i><b>${n}</b></div>`).join('') || '<p class="muted">No finish dates yet.</p>'}
    <h2>Favourite genres</h2>
    <p>${s.topGenres.map(([g, n]) => `<span class="chip">${esc(g)} ${n}</span>`).join(' ') || '<span class="muted">No genres yet.</span>'}</p>`;
}

// ---------------- useful websites ----------------
function renderSites() {
  const box = $('#sites'), keep = box.querySelector('#siteSearch')?.value || '', nq = L.normalize(keep), all = sites();
  const shown = all.filter(s => !nq || L.normalize([s.title, s.note, s.folder, s.url].join(' ')).includes(nq));
  const tree = {};
  for (const s of shown) { const [top, sub = ''] = s.folder.split(' › '); ((tree[top] ||= {})[sub] ||= []).push(s); }
  const list = group => `<div class="grid">${group.sort((a, b) => a.title.localeCompare(b.title)).map(s => `<article class="site">
    <img src="https://icons.duckduckgo.com/ip3/${esc(new URL(s.url).hostname)}.ico" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
    <div><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><p>${esc(s.note)}</p></div>
    <button type="button" data-site="${s.id}" aria-label="Edit ${esc(s.title)}">✎</button></article>`).join('')}</div>`;
  box.innerHTML = `<div class="siteBar"><input id="siteSearch" type="search" placeholder="Search websites…" aria-label="Search websites" value="${esc(keep)}">
    <button type="button" id="siteAdd" class="primary">＋ Add website</button>
    ${L.STARTER_SITES.some(s => !all.some(x => L.siteKey(x.url) === L.siteKey(s.url))) ? '<button type="button" id="siteStarter" title="Reading, watching, listening and game sites with a short explanation">Add suggested websites</button>' : ''}</div>
    ${Object.keys(tree).sort().map(top => `<h2>${esc(top)}</h2>${Object.keys(tree[top]).sort().map(sub => `${sub ? `<h3>${esc(sub)}</h3>` : ''}${list(tree[top][sub])}`).join('')}`).join('')
      || `<p class="muted">${all.length ? 'No website matches.' : 'No websites yet. Add your own, or start with the suggested ones.'}</p>`}`;
}

$('#sites').addEventListener('input', e => {
  if (e.target.id !== 'siteSearch') return;
  renderSites();
  const input = $('#siteSearch'); input.focus(); input.setSelectionRange(input.value.length, input.value.length);
});
$('#sites').addEventListener('click', e => {
  const edit = e.target.closest('[data-site]');
  if (edit) return openSite(byId(edit.dataset.site));
  if (e.target.id === 'siteAdd') return openSite(null);
  if (e.target.id === 'siteStarter') {
    const have = new Set(sites().map(s => L.siteKey(s.url)));
    save(...L.STARTER_SITES.filter(s => !have.has(L.siteKey(s.url))).map(s => L.makeSite(s)));
    renderSites();
  }
});

function openSite(s) {
  const folders = [...new Set([...sites().map(x => x.folder), ...L.STARTER_SITES.map(x => x.folder)])].sort();
  showDialog(`<h2>${s ? 'Edit website' : 'Add a website'}</h2>
    <label>Address <input name="url" value="${esc(s?.url || '')}" placeholder="https://…" required></label>
    <label>Name <input name="title" value="${esc(s?.title || '')}" placeholder="Filled in from the address if empty"></label>
    <label>What is it for? <textarea name="note" rows="2">${esc(s?.note || '')}</textarea></label>
    <label>Folder <small>(use › for a subfolder, like Reading › Manga)</small>
      <input name="folder" list="siteFolders" value="${esc(s?.folder || '')}" placeholder="Other"><datalist id="siteFolders">${folders.map(f => `<option value="${esc(f)}">`).join('')}</datalist></label>
    <div class="actions"><button type="button" id="siteSave" class="primary">Save</button> <button type="button" data-close>Cancel</button>
      ${s ? '<button type="button" id="siteDel" class="danger">Delete</button>' : ''}</div>`);
  dlgForm.onclick = e => {
    if (e.target.closest('[data-close]')) return dlg.close();
    if (e.target.id === 'siteDel' && confirm(`Delete “${s.title}”?`)) { s.deleted = true; save(s); dlg.close(); return renderSites(); }
    if (e.target.id !== 'siteSave') return;
    if (!dlgForm.reportValidity()) return;
    const f = Object.fromEntries(new FormData(dlgForm));
    const typed = f.url.trim(), url = /^https?:\/\//i.test(typed) ? typed : 'https://' + typed;
    let host;
    try { host = new URL(url).hostname; } catch { return toast('That address does not look right.'); }
    if (!host.includes('.')) return toast('That address does not look right.');
    if (sites().some(x => x !== s && L.siteKey(x.url) === L.siteKey(url))) return toast('That website is already in your list.');
    const values = { url, title: f.title.trim() || host.replace(/^www\./, ''), note: f.note.trim(), folder: f.folder.trim() || 'Other' };
    if (s) { Object.assign(s, values); save(s); } else save(L.makeSite(values));
    dlg.close(); renderSites();
  };
}

// ---------------- settings, import, export ----------------
function fillSettings() {
  const f = $('#syncForm');
  if (settings.sync) for (const k of ['owner', 'repo', 'token']) f[k].value = settings.sync[k];
  $('#country').value = settings.country || (navigator.language.split('-')[1] || 'us').toLowerCase();
}
$('#syncForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  settings.sync = { owner: f.owner.value.trim(), repo: f.repo.value.trim(), token: f.token.value.trim() };
  saveSettings(); sha = null; sync();
});
$('#unsyncBtn').onclick = () => { delete settings.sync; saveSettings(); $('#syncForm').reset(); setSync('Sync off'); };
$('#country').onchange = e => { settings.country = e.target.value.trim().toLowerCase(); saveSettings(); };
$('#refreshBtn').onclick = refreshReleases;

function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.onload = () => ok(window.XLSX);
    s.onerror = () => fail(new Error('could not load the Excel reader. Are you online?'));
    document.head.append(s);
  });
}

$('#importFile').onchange = async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    const X = await loadXlsx();
    const wb = X.read(await file.arrayBuffer(), { cellDates: true });
    let added = 0, skipped = 0;
    for (const name of wb.SheetNames) {
      const rows = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true });
      let start = rows.slice(0, 5).findIndex(r => L.guessColumns(r).title !== undefined);
      const map = start >= 0 ? L.guessColumns(rows[start]) : {};
      for (const row of rows.slice(start + 1)) {
        const cand = L.rowToCandidate(row, map, name);
        if (!cand) continue;
        if (L.findDuplicate(items, cand)) { skipped++; continue; }
        items.push(L.makeItem(cand)); added++;
      }
    }
    save(); toast(`Imported ${added} titles (tagged “imported”). Skipped ${skipped} already on your shelf.`);
  } catch (err) { toast('Import failed: ' + err.message); }
};

$('#exportXlsx').onclick = async () => {
  try {
    const X = await loadXlsx(), wb = X.utils.book_new();
    for (const type of L.TYPES) {
      const rows = live().filter(i => i.type === type).map(i => ({
        Title: i.title, English: i.titles.english, Romanized: i.titles.romaji, Original: i.titles.native, Author: i.author,
        Status: L.STATUSES[i.status], Grade: i.grade ?? '', Finished: i.finished,
        Progress: `${i.progress.current || 0}/${i.progress.total || '?'} ${i.progress.unit}`, Favourite: i.fav ? '❤' : '',
        Tags: i.tags.join(', '), 'Heard about it from': i.source, Links: i.links.map(l => l.url).join(' '), Notes: i.notes,
      }));
      if (rows.length) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows), type);
    }
    if (!wb.SheetNames.length) return toast('Your shelf is empty.');
    X.writeFile(wb, `media-shelf-${today()}.xlsx`);
  } catch (err) { toast('Export failed: ' + err.message); }
};

$('#backupBtn').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, items }, null, 1)], { type: 'application/json' }));
  a.download = `media-shelf-backup-${today()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#restoreFile').onchange = async e => {
  const file = e.target.files[0]; e.target.value = '';
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.items)) throw new Error('this is not a Media Shelf backup');
    items = L.mergeItems(items, data.items); persist(); render(); schedulePush(); toast('Backup restored (merged with your current list)');
  } catch (err) { toast('Restore failed: ' + err.message); }
};

// ---------------- GitHub sync ----------------
let sha = null, syncing = false, again = false, pushTimer;
const setSync = msg => $('#syncState').textContent = msg;
const encode = s => {
  const b = new TextEncoder().encode(s); let out = '';
  for (let i = 0; i < b.length; i += 0x8000) out += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(out);
};
const decode = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));

function gh(method, body, raw) {
  const { owner, repo, token } = settings.sync;
  return fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/data.json`, {
    method, cache: 'no-store', body: body && JSON.stringify(body),
    headers: { Authorization: `Bearer ${token}`, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json' },
  });
}
function ghError(r) {
  return new Error({ 401: 'the token is wrong or expired', 403: 'the token may not write to this repository', 404: 'repository not found (check the name, and that the token may use it)' }[r.status] || `GitHub answered ${r.status}`);
}
async function pull() {
  const r = await gh('GET');
  if (r.status === 404) { // file missing is fine (first sync); repo missing is not
    const repo = await fetch(`https://api.github.com/repos/${encodeURIComponent(settings.sync.owner)}/${encodeURIComponent(settings.sync.repo)}`, { headers: { Authorization: `Bearer ${settings.sync.token}` } });
    if (!repo.ok) throw ghError(repo);
    sha = null; return [];
  }
  if (!r.ok) throw ghError(r);
  const j = await r.json(); sha = j.sha;
  const text = j.content ? decode(j.content) : await (await gh('GET', null, true)).text(); // files over 1 MB come without content
  return JSON.parse(text).items || [];
}

async function sync() {
  if (!settings.sync) return;
  if (syncing) { again = true; return; }
  syncing = true; setSync('Syncing…');
  try {
    for (let attempt = 0; ; attempt++) {
      const remote = await pull();
      items = L.mergeItems(items, remote); persist(); render();
      const rmap = new Map(remote.map(i => [i.id, i.updatedAt]));
      if (items.length === remote.length && items.every(i => rmap.get(i.id) === i.updatedAt)) break; // nothing new to upload
      const r = await gh('PUT', { message: `Update shelf (${live().length} titles)`, content: encode(JSON.stringify({ version: 1, items })), ...(sha && { sha }) });
      if (r.ok) { sha = (await r.json()).content.sha; break; }
      if (![409, 422].includes(r.status) || attempt) throw ghError(r); // 409/422: another device saved first, so pull again and retry once
    }
    setSync('Synced ✓ ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  } catch (e) { setSync('⚠ Not synced: ' + e.message); }
  syncing = false;
  if (again) { again = false; sync(); }
}
function schedulePush() { clearTimeout(pushTimer); if (settings.sync) pushTimer = setTimeout(sync, 2000); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });

// ---------------- start ----------------
const applyTheme = () => settings.theme ? document.documentElement.dataset.theme = settings.theme : delete document.documentElement.dataset.theme;
$('#themeBtn').onclick = () => {
  const dark = settings.theme ? settings.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  settings.theme = dark ? 'light' : 'dark'; saveSettings(); applyTheme();
};
applyTheme();
render();
setSync(settings.sync ? '' : 'Sync off');
sync();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

// Shared from another app (on phones): the system opens this page with the post in the address.
const shared = new URLSearchParams(location.search);
const sharedText = ['title', 'text', 'url'].map(k => shared.get(k)).filter(Boolean).join('\n');
if (sharedText) { history.replaceState(null, '', location.pathname); openPost(sharedText); }
