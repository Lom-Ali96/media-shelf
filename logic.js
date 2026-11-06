// Pure helpers (no screen, no network) so they can be tested with `node logic.test.js`.

export const BOOKS = 'Books & Novels';
export const TYPES = ['Anime & Series', 'Manga', 'Manhwa', 'Manhua', BOOKS, 'Fanfic', 'Movie', 'TikTok', 'Video', 'Other'];

export const STATUSES = { planning: 'Planning', progress: 'In progress', finished: 'Finished', paused: 'Paused', dropped: 'Dropped' };

const UNIT_FOR = { 'Anime & Series': 'ep', Movie: 'min', Video: 'min', TikTok: 'part', Other: '' };
export const unitFor = type => UNIT_FOR[type] ?? 'ch';

export const RELEASE = { RELEASING: 'Ongoing', FINISHED: 'Complete', HIATUS: 'On hiatus', NOT_YET_RELEASED: 'Not out yet',
  CANCELLED: 'Cancelled', Running: 'Ongoing', Ended: 'Complete', 'To Be Determined': 'Unclear', 'In Development': 'Not out yet' };

// AniList "format" + country -> our section
export function anilistType(m) {
  const c = m.countryOfOrigin;
  if (m.format === 'NOVEL') return BOOKS;
  if (m.type === 'MANGA') return c === 'KR' ? 'Manhwa' : (c === 'CN' || c === 'TW') ? 'Manhua' : 'Manga';
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
  [/mangadex\.org/, 'MangaDex', 'Manga'],
  [/mangaplus/, 'MANGA Plus', 'Manga'],
  [/webtoons\.com/, 'Webtoon', 'Manhwa'],
  [/tapas\.io/, 'Tapas', 'Manhwa'],
  [/anilist\.co\/anime/, 'AniList', 'Anime & Series'],
  [/anilist\.co\/manga/, 'AniList', 'Manga'],
  [/myanimelist\.net\/anime/, 'MyAnimeList', 'Anime & Series'],
  [/myanimelist\.net\/manga/, 'MyAnimeList', 'Manga'],
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

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

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
export function migrate(list) {
  let booksMerged = false;
  for (const i of list) {
    if (i.type === 'Anime' || i.type === 'Series') i.type = 'Anime & Series';
    if (['Light novel', 'Web novel', 'Novel', 'Audiobook'].includes(i.type)) {
      if (i.type === 'Audiobook') i.audiobook = true;
      i.type = BOOKS; booksMerged = true;
    }
  }
  if (booksMerged) joinSameBooks(list);
  return list;
}

// The old Novel and Audiobook sections could both hold the same book: keep one entry and everything I wrote on either.
function joinSameBooks(list, now = Date.now()) {
  const seen = new Map();
  for (const it of list) {
    if (it.deleted || it.type !== BOOKS) continue;
    const keys = [it.ext?.anilist && 'a' + it.ext.anilist, it.title, it.titles?.english, it.titles?.romaji].filter(Boolean).map(k => normalize(String(k))).filter(Boolean);
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
    Manga: [...comic, L('MANGA Plus', 'https://mangaplus.shueisha.co.jp/search_result?keyword=' + q)],
    Manhwa: [...comic, L('Webtoon', `https://www.webtoons.com/en/search?keyword=${q}`), L('Tapas', `https://tapas.io/search?q=${q}`)],
    Manhua: comic,
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
  [/light ?novel|\bln\b|web ?novel|\bwn\b|novelupdates/, BOOKS], [/manhwa|webtoon/, 'Manhwa'],
  [/manhua/, 'Manhua'], [/manga/, 'Manga'], [/anime|series|serie|show|\btv\b/, 'Anime & Series'], [/fanfic|fan fic|ao3|\bff\b/, 'Fanfic'],
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
