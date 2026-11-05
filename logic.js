// Pure helpers (no screen, no network) so they can be tested with `node logic.test.js`.

export const TYPES = ['Anime', 'Manga', 'Manhwa', 'Manhua', 'Light novel', 'Web novel', 'Novel', 'Fanfic',
  'Series', 'Movie', 'Audiobook', 'TikTok', 'Video', 'Other'];

export const STATUSES = { planning: 'Planning', progress: 'In progress', finished: 'Finished', paused: 'Paused', dropped: 'Dropped' };

const UNIT_FOR = { Anime: 'ep', Series: 'ep', Movie: 'min', Audiobook: 'h', Novel: 'page', Video: 'min', TikTok: 'part', Other: '' };
export const unitFor = type => UNIT_FOR[type] ?? 'ch';

export const RELEASE = { RELEASING: 'Ongoing', FINISHED: 'Complete', HIATUS: 'On hiatus', NOT_YET_RELEASED: 'Not out yet',
  CANCELLED: 'Cancelled', Running: 'Ongoing', Ended: 'Complete', 'To Be Determined': 'Unclear', 'In Development': 'Not out yet' };

// AniList "format" + country -> our section
export function anilistType(m) {
  const c = m.countryOfOrigin;
  if (m.format === 'NOVEL') return c === 'JP' ? 'Light novel' : 'Web novel';
  if (m.type === 'MANGA') return c === 'KR' ? 'Manhwa' : (c === 'CN' || c === 'TW') ? 'Manhua' : 'Manga';
  return 'Anime';
}

const SITES = [
  [/archiveofourown\.org/, 'AO3', 'Fanfic'],
  [/fanfiction\.net/, 'FanFiction.net', 'Fanfic'],
  [/wattpad\.com/, 'Wattpad', 'Web novel'],
  [/novelupdates\.com/, 'NovelUpdates', 'Web novel'],
  [/royalroad\.com/, 'Royal Road', 'Web novel'],
  [/webnovel\.com/, 'Webnovel', 'Web novel'],
  [/wuxiaworld/, 'Wuxiaworld', 'Web novel'],
  [/scribblehub\.com/, 'Scribble Hub', 'Web novel'],
  [/j-novel\.club/, 'J-Novel Club', 'Light novel'],
  [/mangadex\.org/, 'MangaDex', 'Manga'],
  [/mangaplus/, 'MANGA Plus', 'Manga'],
  [/webtoons\.com/, 'Webtoon', 'Manhwa'],
  [/tapas\.io/, 'Tapas', 'Manhwa'],
  [/anilist\.co\/anime/, 'AniList', 'Anime'],
  [/anilist\.co\/manga/, 'AniList', 'Manga'],
  [/myanimelist\.net\/anime/, 'MyAnimeList', 'Anime'],
  [/myanimelist\.net\/manga/, 'MyAnimeList', 'Manga'],
  [/crunchyroll\.com/, 'Crunchyroll', 'Anime'],
  [/imdb\.com/, 'IMDb', 'Movie'],
  [/goodreads\.com/, 'Goodreads', 'Novel'],
  [/audible\./, 'Audible', 'Audiobook'],
  [/storytel\./, 'Storytel', 'Audiobook'],
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

export const allTitles = it => [it.title, it.titles?.english, it.titles?.romaji, it.titles?.native, ...(it.titles?.alt || [])].filter(Boolean);

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
    rereads: 0, fav: false, tags: c.tags || [], source: c.source || '',
    notes: c.notes || '', spoilers: '', quotes: '',
    links: c.links || [], ext: c.ext || {}, releaseStatus: c.releaseStatus || '', nextRelease: c.nextRelease || null,
    relations: c.relations || [], createdAt: now, updatedAt: now,
  };
}

// Two copies of the list (this device + GitHub): per item, the newest edit wins. Deleted items stay as markers.
export function mergeItems(a, b) {
  const byId = new Map(a.map(it => [it.id, it]));
  for (const it of b) {
    const mine = byId.get(it.id);
    if (!mine || (it.updatedAt || 0) > (mine.updatedAt || 0)) byId.set(it.id, it);
  }
  return [...byId.values()];
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
    Anime: watch, Series: watch, Movie: watch,
    Manga: [...comic, L('MANGA Plus', 'https://mangaplus.shueisha.co.jp/search_result?keyword=' + q)],
    Manhwa: [...comic, L('Webtoon', `https://www.webtoons.com/en/search?keyword=${q}`), L('Tapas', `https://tapas.io/search?q=${q}`)],
    Manhua: comic,
    'Light novel': [...novel, L('J-Novel Club', `https://j-novel.club/search?q=${q}`), ...book],
    'Web novel': [...novel, L('Royal Road', `https://www.royalroad.com/fictions/search?title=${q}`), L('Webnovel', `https://www.webnovel.com/search?keywords=${q}`)],
    Novel: [...book, ...audio],
    Audiobook: audio,
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
  [/light ?novel|\bln\b/, 'Light novel'], [/web ?novel|\bwn\b|novelupdates/, 'Web novel'], [/manhwa|webtoon/, 'Manhwa'],
  [/manhua/, 'Manhua'], [/manga/, 'Manga'], [/anime/, 'Anime'], [/fanfic|fan fic|ao3|\bff\b/, 'Fanfic'],
  [/audio|hörbuch|hoerbuch/, 'Audiobook'], [/movie|film/, 'Movie'], [/series|serie|show|\btv\b/, 'Series'],
  [/tiktok/, 'TikTok'], [/youtube|video/, 'Video'], [/novel|book|b[uü]ch|roman/, 'Novel'],
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
