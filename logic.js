// Pure helpers (no screen, no network) so they can be tested with `node logic.test.js`.

export const BOOKS = 'Books & Novels';
export const COMICS = 'Manga & Manhwa';
export const TYPES = ['Anime & Series', COMICS, BOOKS, 'Fanfic', 'Movie', 'TikTok', 'Video', 'Other'];

export const STATUSES = { planning: 'Planning', progress: 'In progress', finished: 'Finished', paused: 'Paused', dropped: 'Dropped' };

const UNIT_FOR = { 'Anime & Series': 'ep', Movie: 'min', Video: 'min', TikTok: 'part', Other: '' };
export const unitFor = type => UNIT_FOR[type] ?? 'ch';

export const RELEASE = { RELEASING: 'Ongoing', FINISHED: 'Complete', HIATUS: 'On hiatus', NOT_YET_RELEASED: 'Not out yet',
  CANCELLED: 'Cancelled', Running: 'Ongoing', Ended: 'Complete', 'To Be Determined': 'Unclear', 'In Development': 'Not out yet' };

// AniList "format" + country -> our section
export function anilistType(m) {
  if (m.format === 'NOVEL') return BOOKS;
  if (m.type === 'MANGA') return COMICS;
  return 'Anime & Series';
}

const SITES = [
  [/archiveofourown\.org/, 'AO3', 'Fanfic'],
  [/fanfiction\.net/, 'FanFiction.net', 'Fanfic'],
  [/wattpad\.com/, 'Wattpad', BOOKS],
  [/novelupdates\.com/, 'NovelUpdates', BOOKS],
  [/royalroad\.com/, 'Royal Road', BOOKS],
  [/webnovel\.com/, 'Webnovel', BOOKS],
  [/wuxiaworld/, 'Wuxiaworld', BOOKS],
  [/scribblehub\.com/, 'Scribble Hub', BOOKS],
  [/j-novel\.club/, 'J-Novel Club', BOOKS],
  [/mangadex\.org/, 'MangaDex', COMICS],
  [/mangaplus/, 'MANGA Plus', COMICS],
  [/webtoons\.com/, 'Webtoon', COMICS],
  [/tapas\.io/, 'Tapas', COMICS],
  [/anilist\.co\/anime/, 'AniList', 'Anime & Series'],
  [/anilist\.co\/manga/, 'AniList', COMICS],
  [/myanimelist\.net\/anime/, 'MyAnimeList', 'Anime & Series'],
  [/myanimelist\.net\/manga/, 'MyAnimeList', COMICS],
  [/crunchyroll\.com/, 'Crunchyroll', 'Anime & Series'],
  [/imdb\.com/, 'IMDb', 'Movie'],
  [/goodreads\.com/, 'Goodreads', BOOKS],
  [/audible\./, 'Audible', BOOKS],
  [/storytel\./, 'Storytel', BOOKS],
  [/tiktok\.com/, 'TikTok', 'TikTok'],
  [/youtube\.com|youtu\.be/, 'YouTube', 'Video'],
];
const GENERIC = new Set(['works', 'work', 's', 'series', 'chapters', 'chapter', 'title', 'manga', 'anime', 'read', 'watch', 'video',
  'story', 'stories', 'book', 'show', 'list', 'en', 'de', 'www', 'novel', 'fiction', 'viewer', 'episode', 'comics']);

export const isUrl = s => /^https?:\/\/\S+$/i.test(s.trim());

// Which site a link is from, what section it belongs in, and a title guess from the address.
export function parseLink(url) {
  let u;
  try { u = new URL(url.trim()); } catch { return null; }
  const hit = SITES.find(([re]) => re.test(u.hostname + u.pathname));
  const site = hit ? hit[1] : u.hostname.replace(/^www\./, '');
  const segs = u.pathname.split('/').map(decodeURIComponent).filter(s =>
    /\p{L}/u.test(s) && !GENERIC.has(s.toLowerCase()) && !s.startsWith('@') && !/^[0-9a-f-]{20,}$/i.test(s) && !/\.\w+$/.test(s));
  const slug = segs.filter(s => /[-_]/.test(s)).pop() || (hit && segs.length === 1 ? segs[0] : '');
  const title = slug.replace(/[-_]+/g, ' ').trim().replace(/\b\p{L}/gu, c => c.toUpperCase());
  return { site, type: hit ? hit[2] : 'Other', title };
}

export const normalize = s => (s || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// How alike two titles are, 0..1 (letter pairs in common), ignoring case, spaces and punctuation.
export function similarity(a, b) {
  const pairs = s => { const n = normalize(s), m = new Map(); for (let i = 0; i < n.length - 1; i++) m.set(n.slice(i, i + 2), (m.get(n.slice(i, i + 2)) || 0) + 1); return m; };
  const A = pairs(a), B = pairs(b);
  let common = 0, total = 0;
  for (const [k, v] of A) { common += Math.min(v, B.get(k) || 0); total += v; }
  for (const v of B.values()) total += v;
  return total ? 2 * common / total : normalize(a) === normalize(b) ? 1 : 0;
}

// Best match of a query among an item's/result's titles.
export const bestSimilarity = (q, x) => Math.max(0, ...allTitles(x).map(t => similarity(q, t)));

// Typed text clearly found this result: nearly the same, or contained in one of its titles ("frieren" in "Frieren: Beyond …").
export const isMatch = (q, x) => bestSimilarity(q, x) >= 0.75 || (normalize(q).length >= 3 && allTitles(x).some(t => normalize(t).includes(normalize(q))));

export const allTitles =it => [it.title, it.titles?.english, it.titles?.romaji, it.titles?.native, ...(it.titles?.alt || [])].filter(Boolean);

// Same work in the same section = duplicate. Same title in another section is an adaptation, not a duplicate.
export function findDuplicate(items, cand) {
  const names = new Set(allTitles(cand).map(normalize).filter(Boolean));
  return items.find(it => !it.deleted && it.type === cand.type &&
    ((cand.ext?.anilist && it.ext?.anilist === cand.ext.anilist) || allTitles(it).some(t => names.has(normalize(t)))));
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function makeItem(c, now = Date.now()) {
  const type = TYPES.includes(c.type) ? c.type : 'Other';
  return {
    id: newId(), type, title: c.title || 'Untitled', author: c.author || '',
    titles: { english: '', romaji: '', native: '', alt: [], ...c.titles },
    cover: c.cover || '', genres: c.genres || [], year: c.year || null,
    status: c.status || 'planning', grade: c.grade ?? null, finished: c.finished || '',
    progress: { current: c.current || 0, total: c.total || null, unit: unitFor(type) },
    audiobook: !!c.audiobook || (c.links || []).some(l => /audible\.|storytel\.|librivox\.|books\.apple\./.test(l.url)),
    rereads: 0, fav: false, tags: c.tags || [], source: c.source || '',
    notes: c.notes || '', spoilers: '', quotes: '',
    links: c.links || [], ext: c.ext || {}, releaseStatus: c.releaseStatus || '', nextRelease: c.nextRelease || null,
    relations: c.relations || [], createdAt: now, updatedAt: now,
  };
}

// Lists saved before Anime and Series became one section.
const OLD_SECTIONS = { Anime: 'Anime & Series', Series: 'Anime & Series', 'Light novel': BOOKS, 'Web novel': BOOKS, Novel: BOOKS, Audiobook: BOOKS, Manga: COMICS, Manhwa: COMICS, Manhua: COMICS };
export const sectionName = type => OLD_SECTIONS[type] || type;

export function migrate(list) {
  let joined = false;
  for (const i of list) {
    const now = OLD_SECTIONS[i.type];
    if (!now) continue;
    if (i.type === 'Audiobook') i.audiobook = true;
    if (now !== 'Anime & Series') joined = true;
    i.type = now;
  }
  if (joined) joinSameBooks(list);
  return list;
}

// Sections that became one could both hold the same work: keep one entry and everything I wrote on either.
function joinSameBooks(list, now = Date.now()) {
  const seen = new Map();
  for (const it of list) {
    if (it.deleted || (it.type !== BOOKS && it.type !== COMICS)) continue;
    const keys = [it.ext?.anilist && 'a' + it.ext.anilist, it.title, it.titles?.english, it.titles?.romaji].filter(Boolean).map(k => normalize(String(k))).filter(Boolean).map(k => it.type + k);
    const twin = keys.map(k => seen.get(k)).find(Boolean);
    if (!twin) { keys.forEach(k => seen.set(k, it)); continue; }
    twin.audiobook ||= it.audiobook;
    twin.grade ??= it.grade;
    twin.finished ||= it.finished;
    twin.notes ||= it.notes;
    twin.fav ||= it.fav;
    if (twin.status === 'planning') twin.status = it.status;
    if ((it.progress?.current || 0) > (twin.progress?.current || 0)) twin.progress = it.progress;
    twin.tags = [...new Set([...(twin.tags || []), ...(it.tags || [])])];
    twin.links = [...(twin.links || []), ...(it.links || []).filter(l => !(twin.links || []).some(m => m.url === l.url))];
    twin.cover ||= it.cover;
    it.deleted = true;
    it.updatedAt = twin.updatedAt = now;
  }
}

// Two copies of the list (this device + GitHub): per item, the newest edit wins. Deleted items stay as markers.
export function mergeItems(a, b) {
  const byId = new Map(a.map(it => [it.id, it]));
  for (const it of b) {
    const mine = byId.get(it.id);
    if (!mine || (it.updatedAt || 0) > (mine.updatedAt || 0)) byId.set(it.id, it);
  }
  return migrate([...byId.values()]);
}

// "Find it on" search links, picked by section.
export function findLinks(it, country = 'us') {
  const q = encodeURIComponent(it.titles?.english || it.title);
  const L = (label, url) => ({ label, url });
  const yt = L('YouTube', `https://www.youtube.com/results?search_query=${q}`);
  const watch = [L('JustWatch', `https://www.justwatch.com/${country}/search?q=${q}`), yt];
  const comic = [L('MangaDex', `https://mangadex.org/search?q=${q}`), L('MangaUpdates', `https://www.mangaupdates.com/series?search=${q}`)];
  const novel = [L('NovelUpdates', `https://www.novelupdates.com/?s=${q}&post_type=seriesplans`)];
  const book = [L('Goodreads', `https://www.goodreads.com/search?q=${q}`), L('Google Books', `https://www.google.com/search?tbm=bks&q=${q}`)];
  const audio = [L('Audible', `https://www.audible.com/search?keywords=${q}`), L('YouTube audiobook', `https://www.youtube.com/results?search_query=${q}+audiobook`)];
  const fic = [L('AO3', `https://archiveofourown.org/works/search?work_search%5Bquery%5D=${q}`),
    L('FanFiction.net', `https://www.fanfiction.net/search/?keywords=${q}&type=story`), L('Wattpad', `https://www.wattpad.com/search/${q}`)];
  return {
    'Anime & Series': watch, Movie: watch,
    [COMICS]: [...comic, L('MANGA Plus', 'https://mangaplus.shueisha.co.jp/search_result?keyword=' + q), L('Webtoon', `https://www.webtoons.com/en/search?keyword=${q}`), L('Tapas', `https://tapas.io/search?q=${q}`)],
    [BOOKS]: [...book, ...novel, L('Royal Road', `https://www.royalroad.com/fictions/search?title=${q}`), L('Webnovel', `https://www.webnovel.com/search?keywords=${q}`), ...audio],
    Fanfic: fic,
  }[it.type] || [yt, L('Google', `https://www.google.com/search?q=${q}`)];
}

// ---------- Excel / CSV import ----------
const COLS = {
  title: /^(title|name|titel|book|media|werk)$/,
  type: /^(type|kind|category|kategorie|art|format|medium|section)$/,
  grade: /^(grade|rating|score|my rating|bewertung|stars?|sterne)$/,
  finished: /^(finished|date read|completed|date finished|beendet|fertig|end date|datum|date)$/,
  status: /^(status|exclusive shelf|shelf|state)$/,
  link: /^(link|url|links|website|where)$/,
  notes: /^(notes?|comments?|review|my review|notiz|notizen|kommentar)$/,
  author: /^(author|autor|authors?)$/,
  progress: /^(progress|chapter|chapters|episode|episodes|kapitel|folge|folgen)$/,
};
export function guessColumns(header) {
  const map = {};
  header.forEach((h, i) => {
    const k = String(h ?? '').trim().toLowerCase();
    for (const [field, re] of Object.entries(COLS)) if (map[field] === undefined && re.test(k)) map[field] = i;
  });
  return map;
}

const TYPE_WORDS = [
  [/light ?novel|\bln\b|web ?novel|\bwn\b|novelupdates/, BOOKS], [/manhwa|manhua|manga|webtoon/, COMICS],
  [/anime|series|serie|show|\btv\b/, 'Anime & Series'], [/fanfic|fan fic|ao3|\bff\b/, 'Fanfic'],
  [/audio|h(ö|oe)rb[uü]ch/, BOOKS], [/movie|film/, 'Movie'],
  [/tiktok/, 'TikTok'], [/youtube|video/, 'Video'], [/novel|book|b[uü]ch|roman/, BOOKS],
];
export const typeFromText = s => (TYPE_WORDS.find(([re]) => re.test(String(s || '').toLowerCase())) || [])[1];

export function statusFromText(s) {
  s = String(s || '').toLowerCase();
  if (/drop|abgebrochen/.test(s)) return 'dropped';
  if (/pause|hold/.test(s)) return 'paused';
  if (/plan|to-read|to read|want|später|later/.test(s)) return 'planning';
  if (/current|reading|watching|progress|lese|schaue/.test(s)) return 'progress';
  if (/finish|complete|read|done|seen|watched|fertig|gelesen|gesehen/.test(s)) return 'finished';
  return '';
}

// Accepts Date objects, 2024-05-03, 2024/05/03 and 03.05.2024. Returns yyyy-mm-dd or ''.
export function parseDate(v) {
  if (v instanceof Date && !isNaN(v)) return new Date(v.getTime() - v.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}

// One spreadsheet row -> candidate for makeItem. sheetName is a hint for the section ("Manga", "Bücher", ...).
export function rowToCandidate(row, map, sheetName = '') {
  const get = f => map[f] === undefined ? '' : String(row[map[f]] ?? '').trim();
  const title = map.title === undefined ? String(row.find(c => String(c ?? '').trim()) ?? '').trim() : get('title');
  if (!title) return null;
  const link = get('link');
  const fromLink = isUrl(link) ? parseLink(link) : null;
  const grade = parseFloat(get('grade').replace(',', '.'));
  const finished = map.finished === undefined ? '' : parseDate(row[map.finished]);
  return {
    title, author: get('author'), notes: get('notes'),
    audiobook: /audio|h(ö|oe)rb[uü]ch/i.test(get('type') + ' ' + sheetName),
    type: typeFromText(get('type')) || (fromLink?.type !== 'Other' && fromLink?.type) || typeFromText(sheetName) || 'Other',
    status: statusFromText(get('status')) || (finished ? 'finished' : 'planning'),
    grade: grade > 0 ? Math.min(grade, 10) : null, finished,
    current: parseInt(get('progress')) || 0,
    links: fromLink ? [{ label: fromLink.site, url: link }] : [],
    tags: ['imported'],
  };
}

// ---------- statistics ----------
export function stats(items) {
  const live = items.filter(i => !i.deleted);
  const byType = {}, byYear = {}, genres = {};
  for (const it of live) {
    const t = byType[it.type] ||= { count: 0, finished: 0, gradeSum: 0, graded: 0 };
    t.count++;
    if (it.status === 'finished') t.finished++;
    if (it.grade) { t.gradeSum += it.grade; t.graded++; }
    if (it.finished) byYear[it.finished.slice(0, 4)] = (byYear[it.finished.slice(0, 4)] || 0) + 1;
    for (const g of it.genres || []) genres[g] = (genres[g] || 0) + 1;
  }
  return {
    total: live.length, byType, byYear,
    topGenres: Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 10),
  };
}

// ---------- shared posts ----------
const NOT_A_TITLE = /^(top|best|my |these|here|follow|part \d|comment|link|watch|read|must|recommend|if you|you |i |we |this|that|what|why|how to|check|save|like|share|omg|pov)\b/i;

// Likely titles in a caption or pasted list: quoted names, list lines, and short parts between commas.
export function extractTitles(text) {
  const clean = String(text || '').replace(/https?:\/\/\S+/g, ' ').replace(/#[\p{L}\p{N}_]+/gu, ' ').replace(/@[\w.]+/g, ' ');
  const out = [...clean.matchAll(/["“«„]([^"“”«»„]{2,80})["”»“]/g)].map(m => m[1]);
  for (const line of clean.split(/[\n;•|]+/)) {
    if (line.trim().endsWith(':')) continue; // a heading like "Books you need:"
    const parts = line.split(',').length > 2 || /^\s*\d+[.)]/.test(line) ? line.split(',') : [line];
    for (const part of parts) {
      const t = part.replace(/^[\s\d.)\-–—*:]+/, '').replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/["“”«»„]/g, '').replace(/\s+by\s+.*$/i, '').replace(/[\s.!?:]+$/, '').trim();
      if (t.length >= 2 && t.split(/\s+/).length <= 10 && /\p{L}/u.test(t) && !NOT_A_TITLE.test(t)) out.push(t);
    }
  }
  const seen = new Set();
  return out.map(t => t.trim()).filter(t => { const n = normalize(t); if (!n || seen.has(n)) return false; seen.add(n); return true; }).slice(0, 20);
}

// ---------- useful websites ----------
export const makeSite = (s, now = Date.now()) => ({ id: newId(), type: 'Website', title: s.title, url: s.url, note: s.note || '', folder: s.folder || 'Other', createdAt: now, updatedAt: now });
export const siteKey = url => { try { const u = new URL(url); return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, ''); } catch { return url; } };

const site = (folder, title, url, note) => ({ folder, title, url, note });
export const STARTER_SITES = [
  site('Reading › Books', 'Goodreads', 'https://www.goodreads.com', 'Find books, read reviews and see what others liked.'),
  site('Reading › Books', 'The StoryGraph', 'https://www.thestorygraph.com', 'Book tracking with recommendations based on mood and pace.'),
  site('Reading › Books', 'Project Gutenberg', 'https://www.gutenberg.org', 'Free classic books whose copyright has expired.'),
  site('Reading › Books', 'Open Library', 'https://openlibrary.org', 'Catalogue of books, many of them free to borrow online.'),
  site('Reading › Web novels', 'NovelUpdates', 'https://www.novelupdates.com', 'Directory of translated Asian novels, showing where each is published.'),
  site('Reading › Web novels', 'Royal Road', 'https://www.royalroad.com', 'Free web novels in English: LitRPG, progression fantasy and more.'),
  site('Reading › Web novels', 'Scribble Hub', 'https://www.scribblehub.com', 'Free original web novels, many in Asian-novel style.'),
  site('Reading › Web novels', 'Wuxiaworld', 'https://www.wuxiaworld.com', 'Licensed translations of Chinese and Korean novels.'),
  site('Reading › Fanfiction', 'Archive of Our Own (AO3)', 'https://archiveofourown.org', 'Large fanfiction archive with very detailed tags.'),
  site('Reading › Fanfiction', 'FanFiction.net', 'https://www.fanfiction.net', 'One of the oldest fanfiction sites, sorted by fandom.'),
  site('Reading › Fanfiction', 'Wattpad', 'https://www.wattpad.com', 'Free stories and fanfiction, works well on a phone.'),
  site('Reading › Manga & manhwa', 'MangaDex', 'https://mangadex.org', 'Free manga reader run by fans, in many languages.'),
  site('Reading › Manga & manhwa', 'MANGA Plus', 'https://mangaplus.shueisha.co.jp', 'Official free Shueisha manga, including new chapters of popular series.'),
  site('Reading › Manga & manhwa', 'WEBTOON', 'https://www.webtoons.com', 'Official vertical-scroll comics, many free.'),
  site('Reading › Manga & manhwa', 'Tapas', 'https://tapas.io', 'Official comics and novels, some free and some paid per episode.'),
  site('Reading › Manga & manhwa', 'MangaUpdates', 'https://www.mangaupdates.com', 'Database of manga, manhwa and manhua: other titles, status and related works.'),
  site('Listening › Audiobooks', 'Audible', 'https://www.audible.com', 'Large paid audiobook shop and subscription.'),
  site('Listening › Audiobooks', 'LibriVox', 'https://librivox.org', 'Free audiobooks of classic books, read by volunteers.'),
  site('Watching › Movies & series', 'JustWatch', 'https://www.justwatch.com', 'Shows which streaming service has a movie or series in your country.'),
  site('Watching › Movies & series', 'Letterboxd', 'https://letterboxd.com', 'Log and rate movies, and browse other people\'s lists.'),
  site('Watching › Movies & series', 'Trakt', 'https://trakt.tv', 'Track movies and series, with upcoming episodes.'),
  site('Watching › Anime', 'Crunchyroll', 'https://www.crunchyroll.com', 'Official anime streaming, including new seasons.'),
  site('Watching › Anime', 'AniList', 'https://anilist.co', 'Anime and manga database with tracking and recommendations.'),
  site('Watching › Anime', 'MyAnimeList', 'https://myanimelist.net', 'The best-known anime and manga database, with rankings and reviews.'),
  site('Playing › Web games', 'itch.io', 'https://itch.io', 'Indie games, many free and playable in the browser.'),
  site('Playing › Web games', 'CrazyGames', 'https://www.crazygames.com', 'Free browser games with nothing to install.'),
  site('Playing › Web games', 'Poki', 'https://poki.com', 'Free browser games, mostly quick and casual.'),
];

// ---------- other versions, as small icons ----------
const VERSION_TOKENS = { 'Anime & Series': '📺 Anime/Series', [COMICS]: '📕 Manga', [BOOKS]: '📖 Book', Fanfic: '✍️ Fanfic', Movie: '🎬 Movie' };
const SAME_STORY = new Set(['adaptation', 'source', 'alternative']);

// Which sections hold each title, and each AniList work, across the whole list.
export function versionIndex(items) {
  const byTitle = new Map(), byWork = new Map();
  const add = (map, key, type) => { if (key) { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(type); } };
  for (const it of items) {
    for (const t of allTitles(it)) add(byTitle, normalize(t), it.type);
    for (const r of it.relations || []) if (SAME_STORY.has(r.rel)) add(byWork, r.anilistId, it.type);
  }
  return { byTitle, byWork };
}

// The sections this story also exists in, besides its own.
export function otherVersions(it, index) {
  const found = new Set();
  for (const r of it.relations || []) if (SAME_STORY.has(r.rel)) found.add(r.type);
  for (const t of allTitles(it)) for (const type of index.byTitle.get(normalize(t)) || []) found.add(type);
  for (const type of index.byWork.get(it.ext?.anilist) || []) found.add(type);
  found.delete(it.type);
  return TYPES.filter(t => found.has(t) && VERSION_TOKENS[t]);
}
export const versionTokens = (it, index) => [...otherVersions(it, index).map(t => VERSION_TOKENS[t]), ...(it.audiobook ? ['🎧 Audiobook'] : [])];

// ---------- what is new ----------
// Compares a title before and after a release check. '' means nothing worth telling.
export function releaseNews(before, after, now = Date.now()) {
  const was = before.nextRelease;
  if (was?.at && was.at <= now && was.label !== after.nextRelease?.label) return was.label + ' is out';
  if (before.releaseStatus && after.releaseStatus && before.releaseStatus !== after.releaseStatus) return 'Now: ' + after.releaseStatus;
  return '';
}

// Chapter numbers from the daily GitHub job. The first number for a title is just noted; only a higher one later counts as news.
export function applyChapters(items, updates) {
  const changed = [];
  for (const it of items) {
    const u = updates[it.id];
    if (!u?.latest || it.deleted || it.latestChapter === u.latest) continue;
    if (it.latestChapter != null && u.latest > it.latestChapter && it.status !== 'dropped') it.news = 'Chapter ' + u.latest + ' is out';
    it.latestChapter = u.latest;
    if (u.url && !it.links.some(l => l.url === u.url)) it.links.push({ label: 'MangaUpdates', url: u.url });
    changed.push(it);
  }
  return changed;
}

// ---------- read aloud ----------
const MAX_SPOKEN = 220; // browsers can stop speaking in the middle of very long sentences

// Text -> short pieces to speak one after another.
export function splitSentences(text) {
  const out = [];
  for (const para of String(text || '').split(/\n+/)) {
    for (const raw of para.match(/[^.!?…。！？]+[.!?…。！？]*["'”’)\]]*\s*|[.!?…。！？]+\s*/g) || []) {
      let s = raw.trim();
      while (s.length > MAX_SPOKEN) {
        const cut = Math.max(s.lastIndexOf(', ', MAX_SPOKEN), s.lastIndexOf(' ', MAX_SPOKEN));
        const at = cut > 40 ? cut + 1 : MAX_SPOKEN;
        out.push(s.slice(0, at).trim());
        s = s.slice(at).trim();
      }
      if (/[\p{L}\p{N}]/u.test(s)) out.push(s);
    }
  }
  return out;
}

// One pasted text or file -> chapters, using lines like "Chapter 12" when there are at least two.
export function splitChapters(text, fallback = 'Chapter') {
  const heading = /^[ \t]*(chapter|kapitel|ch\.)[ \t]*\d+[^\n]{0,80}$/gim;
  const marks = [...String(text || '').matchAll(heading)];
  if (marks.length < 2) return String(text || '').trim() ? [{ title: fallback, text: String(text).trim() }] : [];
  return marks.map((m, i) => ({ title: m[0].trim(), text: text.slice(m.index + m[0].length, marks[i + 1]?.index ?? text.length).trim() })).filter(c => c.text);
}

// Best sounding first: the "natural" kinds, then good device voices. The reader's language comes first within each kind.
export function rankVoices(voices, lang = 'en') {
  const quality = v => /natural|neural|online/i.test(v.name) ? 3 : /premium|enhanced|siri|google/i.test(v.name) ? 2 : 0;
  const base = lang.slice(0, 2).toLowerCase();
  const closeness = v => { const l = (v.lang || '').slice(0, 2).toLowerCase(); return l === base ? 2 : l === 'en' ? 1 : 0; };
  return [...voices].sort((a, b) => quality(b) - quality(a) || closeness(b) - closeness(a) || a.name.localeCompare(b.name))
    .map(voice => ({ voice, recommended: quality(voice) > 0 && closeness(voice) > 0 }));
}

// ---------- files to read aloud ----------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
const decodeEntities = s => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? m;
  const code = /^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
});
export const htmlToText = html => decodeEntities(String(html || '')
  .replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<br\b[^>]*>|<\/(p|div|h[1-6]|li|tr|blockquote|section)>/gi, '\n').replace(/<[^>]+>/g, ''))
  .replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n').trim();

// PDFs break lines at the page edge: rejoin them unless the line really ended a sentence.
export const unwrapLines = text => String(text || '').replace(/([^\s.!?…。！？"”:])[ \t]*\n(?=[^\n])/g, '$1 ').trim();

// Minimal zip reader: EPUB and Word files are zip files inside.
export function readZip(buffer) {
  const b = new Uint8Array(buffer), v = new DataView(b.buffer, b.byteOffset, b.length), names = new TextDecoder();
  let end = b.length - 22;
  while (end >= 0 && v.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error('this file looks damaged');
  const files = new Map();
  let p = v.getUint32(end + 16, true);
  for (let i = v.getUint16(end + 10, true); i > 0; i--) {
    const nameLen = v.getUint16(p + 28, true), local = v.getUint32(p + 42, true);
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    files.set(names.decode(b.subarray(p + 46, p + 46 + nameLen)), { method: v.getUint16(p + 10, true), data: b.subarray(start, start + v.getUint32(p + 20, true)) });
    p += 46 + nameLen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return {
    has: name => files.has(name),
    async text(name) {
      const f = files.get(name);
      if (!f) throw new Error('this file looks damaged');
      if (f.method === 0) return new TextDecoder().decode(f.data);
      return new Response(new Blob([f.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    },
  };
}

export const docxText = async zip => decodeEntities((await zip.text('word/document.xml')).replace(/<\/w:p>/g, '\n').replace(/<w:(tab|br)\b[^>]*\/>/g, ' ').replace(/<[^>]+>/g, '')).replace(/\n{2,}/g, '\n').trim();

// EPUB: the book's own reading order gives the chapters.
export async function epubChapters(zip, fallback = 'Chapter') {
  const opfPath = (await zip.text('META-INF/container.xml')).match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new Error('this file looks damaged');
  const opf = await zip.text(opfPath), base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const attr = (tag, name) => tag.match(new RegExp('\\b' + name + '="([^"]*)"'))?.[1];
  const hrefs = new Map([...opf.matchAll(/<item\b[^>]*>/g)].map(m => [attr(m[0], 'id'), attr(m[0], 'href')]));
  const out = [];
  for (const m of opf.matchAll(/<itemref\b[^>]*>/g)) {
    const href = hrefs.get(attr(m[0], 'idref'));
    if (!href) continue;
    const path = base + decodeURIComponent(href.split('#')[0]);
    if (!zip.has(path)) continue;
    const html = await zip.text(path), text = htmlToText(html);
    if (text.length < 40) continue; // covers and blank pages
    const heading = html.match(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1] || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    out.push({ title: htmlToText(heading || '').slice(0, 80) || fallback + ' ' + (out.length + 1), text });
  }
  return out;
}

// Which way a chosen file is handled.
export function fileKind(name, mime = '') {
  const ext = String(name).split('.').pop().toLowerCase();
  if (mime.startsWith('audio/') || mime.startsWith('video/') || ['mp3', 'm4a', 'm4b', 'mp4', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'webm'].includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'epub') return 'epub';
  if (ext === 'docx') return 'docx';
  if (['htm', 'html', 'xhtml'].includes(ext)) return 'html';
  if (['txt', 'md', 'text'].includes(ext) || mime.startsWith('text/')) return 'text';
  return '';
}

// ---------- tabs in my own order ----------
export const orderTabs = (ids, order = []) => [...ids].sort((a, b) => {
  const rank = id => { const r = order.indexOf(id); return r < 0 ? order.length + ids.indexOf(id) : r; };
  return rank(a) - rank(b);
});
export function moveTab(ids, order, id, step) {
  const now = orderTabs(ids, order), from = now.indexOf(id), to = from + step;
  if (from < 0 || to < 0 || to >= now.length) return now;
  now.splice(from, 1); now.splice(to, 0, id);
  return now;
}

// ---------- hidden folder: only the sealed text is ever saved or synced ----------
const toB64 = bytes => { let out = ''; for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(out); };
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const newVaultSalt = () => toB64(crypto.getRandomValues(new Uint8Array(16)));
export async function vaultKey(password, salt) {
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(salt), iterations: 600000 }, raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function sealVault(list, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(list)));
  return { iv: toB64(iv), data: toB64(new Uint8Array(data)) };
}
// Fails if the password was wrong, or if the sealed text was changed.
export async function openVault(record, key) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(record.iv) }, key, fromB64(record.data));
  return JSON.parse(new TextDecoder().decode(plain));
}
