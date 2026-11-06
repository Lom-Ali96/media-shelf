// Run with: node logic.test.js   (prints "all tests passed" or stops at the first failure)
import assert from 'node:assert/strict';
import * as L from './logic.js';

// sorting AniList results into sections
assert.equal(L.anilistType({ type: 'MANGA', format: 'MANGA', countryOfOrigin: 'KR' }), 'Manhwa');
assert.equal(L.anilistType({ type: 'MANGA', format: 'MANGA', countryOfOrigin: 'CN' }), 'Manhua');
assert.equal(L.anilistType({ type: 'MANGA', format: 'NOVEL', countryOfOrigin: 'JP' }), L.BOOKS);
assert.equal(L.anilistType({ type: 'MANGA', format: 'NOVEL', countryOfOrigin: 'KR' }), L.BOOKS);
assert.equal(L.anilistType({ type: 'ANIME', format: 'MOVIE', countryOfOrigin: 'JP' }), 'Anime & Series');

// links
assert.deepEqual(L.parseLink('https://www.fanfiction.net/s/1234567/1/Harry-Potter-and-the-Something'),
  { site: 'FanFiction.net', type: 'Fanfic', title: 'Harry Potter And The Something' });
assert.deepEqual(L.parseLink('https://www.novelupdates.com/series/the-beginning-after-the-end/'),
  { site: 'NovelUpdates', type: L.BOOKS, title: 'The Beginning After The End' });
assert.deepEqual(L.parseLink('https://archiveofourown.org/works/123456/chapters/999'), { site: 'AO3', type: 'Fanfic', title: '' });
assert.equal(L.parseLink('https://www.webtoons.com/en/action/omniscient-reader/list?title_no=2154').title, 'Omniscient Reader');
assert.equal(L.parseLink('https://www.tiktok.com/@someone/video/7123456789').type, 'TikTok');
assert.equal(L.parseLink('https://www.tiktok.com/@someone/video/7123456789').title, '');
assert.equal(L.parseLink('not a link'), null);
assert.ok(L.isUrl('https://ao3.org/x') && !L.isUrl('Solo Leveling'));

// duplicates: same title + same section only, any language
const a = L.makeItem({ type: 'Manhwa', title: 'Solo Leveling', titles: { native: '나 혼자만 레벨업' } });
assert.ok(L.findDuplicate([a], { type: 'Manhwa', title: 'solo-leveling!' }));
assert.ok(L.findDuplicate([a], { type: 'Manhwa', title: 'x', titles: { alt: ['나 혼자만 레벨업'] } }));
assert.equal(L.findDuplicate([a], { type: 'Anime & Series', title: 'Solo Leveling' }), undefined);
assert.equal(L.findDuplicate([{ ...a, deleted: true }], { type: 'Manhwa', title: 'Solo Leveling' }), undefined);

// spelling closeness
assert.equal(L.similarity('Solo Leveling', 'solo-leveling!'), 1);
assert.ok(L.similarity('solo levling', 'Solo Leveling') > 0.8);
assert.ok(L.similarity('frieren', 'friesen') < 0.8);
assert.ok(L.similarity('Berserk', 'Harry Potter') < 0.2);
assert.equal(L.similarity('a', 'a'), 1); // one letter: no pairs, still equal
assert.ok(L.isMatch('frieren', { title: 'Frieren: Beyond Journey’s End' }));
assert.ok(L.isMatch('solo levling', { title: 'Solo Leveling' }));
assert.ok(!L.isMatch('berzerk', { title: 'Harry Potter' }));
assert.ok(L.bestSimilarity('nihon',{ title: 'x', titles: { romaji: 'Nihon' } }) === 1);

// sync merge: newest edit wins per item, nothing lost
const old = { id: '1', title: 'old', updatedAt: 1 }, neu = { id: '1', title: 'new', updatedAt: 2 }, other = { id: '2', updatedAt: 1 };
assert.equal(L.mergeItems([old], [neu, other]).find(i => i.id === '1').title, 'new');
assert.equal(L.mergeItems([neu], [old]).find(i => i.id === '1').title, 'new');
assert.equal(L.mergeItems([neu], [other]).length, 2);

assert.equal(L.migrate([{ type: 'Series' }])[0].type, 'Anime & Series');
assert.equal(L.mergeItems([], [{ id: '9', type: 'Anime' }])[0].type, 'Anime & Series');
assert.equal(L.typeFromText('TV show'), 'Anime & Series');

// search links follow the section
assert.ok(L.findLinks({ type: 'Fanfic', title: 'A b' }).some(l => l.url.startsWith('https://archiveofourown.org/') && l.url.includes('A%20b')));
assert.ok(L.findLinks({ type: L.BOOKS, title: 'x' }).some(l => l.label === 'NovelUpdates'));
assert.ok(L.findLinks({ type: 'Other', title: 'x' }).length > 0);

// spreadsheet import
const map = L.guessColumns(['Title', 'Type', 'Rating', 'Date Read', 'Link', 'Notes']);
assert.deepEqual(map, { title: 0, type: 1, grade: 2, finished: 3, link: 4, notes: 5 });
const c = L.rowToCandidate(['Omniscient Reader', 'webtoon', '9,5', '03.05.2024', '', 'great'], map);
assert.equal(c.type, 'Manhwa'); assert.equal(c.grade, 9.5); assert.equal(c.finished, '2024-05-03'); assert.equal(c.status, 'finished');
const c2 = L.rowToCandidate(['Some fic', '', '', '', 'https://archiveofourown.org/works/1', ''], map);
assert.equal(c2.type, 'Fanfic'); assert.equal(c2.status, 'planning');
assert.equal(L.rowToCandidate(['', '', '', '', '', ''], map), null);
assert.equal(L.rowToCandidate(['Berserk'], {}, 'Manga').type, 'Manga');
assert.equal(L.rowToCandidate(['fic', '', '', '', 'https://archiveofourown.org/works/5'], map, 'Manhwa').type, 'Fanfic'); // link beats sheet name
assert.equal(L.rowToCandidate(['x', '', '', '', 'https://example.com/x'], map, 'Manhwa').type, 'Manhwa'); // unknown site: sheet name
assert.equal(L.parseDate(new Date(2024, 0, 9)), '2024-01-09');
assert.equal(L.parseDate('2024/1/9'), '2024-01-09');
assert.equal(L.statusFromText('to-read'), 'planning');
assert.equal(L.statusFromText('currently-reading'), 'progress');
assert.equal(L.statusFromText('read'), 'finished');
assert.equal(L.typeFromText('Light Novel'), L.BOOKS);
assert.equal(L.typeFromText('Bücher'), L.BOOKS);

// statistics
const s = L.stats([{ ...a, status: 'finished', grade: 8, finished: '2025-02-01', genres: ['Action'] }, { ...a, id: 'x', deleted: true }]);
assert.equal(s.total, 1); assert.equal(s.byType.Manhwa.gradeSum, 8); assert.equal(s.byYear['2025'], 1);
assert.equal(L.STATUSES.finished, 'Finished');
assert.equal(L.RELEASE.FINISHED, 'Complete'); // release state must not read like my own "Finished"

// titles in shared posts
assert.deepEqual(L.extractTitles('1. Dune\n2) The Way of Kings by Brandon Sanderson\n3. Fourth Wing 🔥'), ['Dune', 'The Way of Kings', 'Fourth Wing']);
assert.deepEqual(L.extractTitles('You HAVE to read "Red Rising" #booktok #fyp https://x.co/a @someone'), ['Red Rising']);
assert.deepEqual(L.extractTitles('Solo Leveling, Omniscient Reader, Tower of God'), ['Solo Leveling', 'Omniscient Reader', 'Tower of God']);
assert.deepEqual(L.extractTitles('Top 5 books you must read\nDune\nDUNE'), ['Dune']);
assert.deepEqual(L.extractTitles('Books you need:\n1. Dune'), ['Dune']);
assert.deepEqual(L.extractTitles(''), []);
assert.equal(L.extractTitles(Array.from({ length: 30 }, (_, i) => 'Book ' + i).join('\n')).length, 20);

// books and audiobooks in one section
const oldList = [
  { id: 'n', type: 'Novel', title: 'Dune', titles: {}, tags: ['checked'], links: [{ label: 'A', url: 'https://a.b' }], grade: 9, status: 'finished', notes: 'great', updatedAt: 1 },
  { id: 'a', type: 'Audiobook', title: 'dune!', titles: {}, tags: ['not found'], links: [{ label: 'C', url: 'https://c.d' }], status: 'planning', updatedAt: 1 },
  { id: 'l', type: 'Light novel', title: 'Overlord', titles: {}, tags: [], links: [], updatedAt: 1 },
  { id: 'w', type: 'Web novel', title: 'Shadow Slave', titles: {}, tags: [], links: [], updatedAt: 1 },
  { id: 'h', type: 'Audiobook', title: 'Test Audio Story', titles: {}, tags: [], links: [], updatedAt: 1 },
  { id: 'm', type: 'Manga', title: 'Dune', titles: {}, tags: [], links: [], updatedAt: 1 },
];
const newList = L.migrate(oldList), keptBook = id => newList.find(i => i.id === id);
assert.ok(newList.filter(i => i.id !== 'm').every(i => i.type === L.BOOKS));
assert.equal(keptBook('a').deleted, true); assert.equal(keptBook('n').audiobook, true);
assert.equal(keptBook('n').grade, 9); assert.equal(keptBook('n').notes, 'great'); assert.equal(keptBook('n').links.length, 2);
assert.ok(keptBook('n').updatedAt > 1);
assert.equal(keptBook('h').audiobook, true); assert.ok(!keptBook('h').deleted);
assert.ok(!keptBook('m').deleted); // the manga of the same name is another version, not a duplicate
assert.ok(!keptBook('l').audiobook);
const stable = JSON.stringify(newList); L.migrate(newList); assert.equal(JSON.stringify(newList), stable); // running it again changes nothing
const twoAdded = [{ id: '1', type: L.BOOKS, title: 'Same', titles: {}, updatedAt: 1 }, { id: '2', type: L.BOOKS, title: 'Same', titles: {}, updatedAt: 1 }];
assert.ok(!L.migrate(twoAdded)[1].deleted); // books I chose to add twice later stay
assert.equal(L.makeItem({ title: 'x', type: L.BOOKS, links: [{ url: 'https://www.audible.com/pd/x' }] }).audiobook, true);
assert.equal(L.makeItem({ title: 'x', type: L.BOOKS }).audiobook, false);
assert.equal(L.rowToCandidate(['Mistborn'], {}, 'Hörbücher').audiobook, true);
assert.equal(L.rowToCandidate(['Mistborn'], {}, 'Hörbücher').type, L.BOOKS);

// version icons
const vNovel = { id: 'v1', type: L.BOOKS, title: 'Story', titles: {}, ext: { anilist: 1 }, relations: [{ anilistId: 2, type: 'Manga', rel: 'adaptation' }, { anilistId: 3, type: L.BOOKS, rel: 'sequel' }, { anilistId: 4, type: 'Movie', rel: 'side story' }] };
const vManga = { id: 'v2', type: 'Manga', title: 'Other Name', titles: {}, ext: { anilist: 2 }, relations: [] };
const vFilm = { id: 'v3', type: 'Movie', title: 'story!', titles: {}, ext: {} };
const vIndex = L.versionIndex([vNovel, vManga, vFilm]);
assert.deepEqual(L.otherVersions(vNovel, vIndex), ['Manga', 'Movie']); // own section left out; sequels and side stories don't count
assert.deepEqual(L.otherVersions(vManga, vIndex), [L.BOOKS]); // found through the novel pointing at it
assert.deepEqual(L.otherVersions(vFilm, vIndex), [L.BOOKS]); // found through the same title
assert.deepEqual(L.otherVersions({ type: 'Other', title: 'Alone', titles: {}, ext: {} }, vIndex), []);

// what is new
const ep = (label, at) => ({ label, at });
assert.equal(L.releaseNews({ nextRelease: ep('Episode 5', 100) }, { nextRelease: ep('Episode 6', 900) }, 200), 'Episode 5 is out');
assert.equal(L.releaseNews({ nextRelease: ep('Episode 5', 300) }, { nextRelease: ep('Episode 5', 300) }, 200), '');
assert.equal(L.releaseNews({ nextRelease: ep('Episode 5', 100) }, { nextRelease: null }, 200), 'Episode 5 is out'); // it was the last one
assert.equal(L.releaseNews({ releaseStatus: 'Ongoing' }, { releaseStatus: 'Complete' }, 200), 'Now: Complete');
assert.equal(L.releaseNews({ releaseStatus: '' }, { releaseStatus: 'Ongoing' }, 200), ''); // first look at a title is not news

// new chapters
const reader = { id: 'c', title: 'x', status: 'progress', links: [] };
assert.deepEqual(L.applyChapters([reader], { c: { latest: 50, url: 'https://mu/x' } }), [reader]);
assert.equal(reader.latestChapter, 50); assert.equal(reader.news, undefined); assert.equal(reader.links.length, 1); // first look: no news
assert.deepEqual(L.applyChapters([reader], { c: { latest: 50, url: 'https://mu/x' } }), []); // nothing new, nothing to save
L.applyChapters([reader], { c: { latest: 51, url: 'https://mu/x' } });
assert.equal(reader.news, 'Chapter 51 is out'); assert.equal(reader.links.length, 1);
const quitter = { id: 'd', title: 'y', status: 'dropped', links: [], latestChapter: 1 };
L.applyChapters([quitter], { d: { latest: 2 } }); assert.equal(quitter.news, undefined); assert.equal(quitter.latestChapter, 2);
assert.deepEqual(L.applyChapters([{ id: 'e', links: [], title: 'z' }], { e: { mu: 0 } }), []); // unknown to MangaUpdates

// websites
assert.equal(L.siteKey('https://www.royalroad.com/'), 'royalroad.com');
assert.equal(L.siteKey('not a link'), 'not a link');
assert.equal(L.makeSite({ title: 'x', url: 'https://x.y' }).folder, 'Other');
assert.ok(L.STARTER_SITES.every(s => s.url.startsWith('https://') && s.note && s.folder.includes(' › ')));

console.log('all tests passed');
