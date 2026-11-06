// Run with: node logic.test.js   (prints "all tests passed" or stops at the first failure)
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import * as L from './logic.js';

// sorting AniList results into sections
assert.equal(L.anilistType({ type: 'MANGA', format: 'MANGA', countryOfOrigin: 'KR' }), L.COMICS);
assert.equal(L.anilistType({ type: 'MANGA', format: 'MANGA', countryOfOrigin: 'CN' }), L.COMICS);
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
const a = L.makeItem({ type: L.COMICS, title: 'Solo Leveling', titles: { native: '나 혼자만 레벨업' } });
assert.ok(L.findDuplicate([a], { type: L.COMICS, title: 'solo-leveling!' }));
assert.ok(L.findDuplicate([a], { type: L.COMICS, title: 'x', titles: { alt: ['나 혼자만 레벨업'] } }));
assert.equal(L.findDuplicate([a], { type: 'Anime & Series', title: 'Solo Leveling' }), undefined);
assert.equal(L.findDuplicate([{ ...a, deleted: true }], { type: L.COMICS, title: 'Solo Leveling' }), undefined);

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
assert.equal(c.type, L.COMICS); assert.equal(c.grade, 9.5); assert.equal(c.finished, '2024-05-03'); assert.equal(c.status, 'finished');
const c2 = L.rowToCandidate(['Some fic', '', '', '', 'https://archiveofourown.org/works/1', ''], map);
assert.equal(c2.type, 'Fanfic'); assert.equal(c2.status, 'planning');
assert.equal(L.rowToCandidate(['', '', '', '', '', ''], map), null);
assert.equal(L.rowToCandidate(['Berserk'], {}, 'Manga').type, L.COMICS);
assert.equal(L.rowToCandidate(['fic', '', '', '', 'https://archiveofourown.org/works/5'], map, L.COMICS).type, 'Fanfic'); // link beats sheet name
assert.equal(L.rowToCandidate(['x', '', '', '', 'https://example.com/x'], map, L.COMICS).type, L.COMICS); // unknown site: sheet name
assert.equal(L.parseDate(new Date(2024, 0, 9)), '2024-01-09');
assert.equal(L.parseDate('2024/1/9'), '2024-01-09');
assert.equal(L.statusFromText('to-read'), 'planning');
assert.equal(L.statusFromText('currently-reading'), 'progress');
assert.equal(L.statusFromText('read'), 'finished');
assert.equal(L.typeFromText('Light Novel'), L.BOOKS);
assert.equal(L.typeFromText('Bücher'), L.BOOKS);

// statistics
const s = L.stats([{ ...a, status: 'finished', grade: 8, finished: '2025-02-01', genres: ['Action'] }, { ...a, id: 'x', deleted: true }]);
assert.equal(s.total, 1); assert.equal(s.byType[L.COMICS].gradeSum, 8); assert.equal(s.byYear['2025'], 1);
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
const vNovel = { id: 'v1', type: L.BOOKS, title: 'Story', titles: {}, ext: { anilist: 1 }, relations: [{ anilistId: 2, type: L.COMICS, rel: 'adaptation' }, { anilistId: 3, type: L.BOOKS, rel: 'sequel' }, { anilistId: 4, type: 'Movie', rel: 'side story' }] };
const vManga = { id: 'v2', type: L.COMICS, title: 'Other Name', titles: {}, ext: { anilist: 2 }, relations: [] };
const vFilm = { id: 'v3', type: 'Movie', title: 'story!', titles: {}, ext: {} };
const vIndex = L.versionIndex([vNovel, vManga, vFilm]);
assert.deepEqual(L.otherVersions(vNovel, vIndex), [L.COMICS, 'Movie']); // own section left out; sequels and side stories don't count
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

// read aloud
assert.deepEqual(L.splitSentences('Hello there. How are you?\n\n"Fine!" she said'), ['Hello there.', 'How are you?', '"Fine!"', 'she said']);
assert.deepEqual(L.splitSentences(''), []);
assert.deepEqual(L.splitSentences('...\n***'), []); // nothing to say
assert.ok(L.splitSentences('word '.repeat(300)).every(s => s.length <= 220));
assert.equal(L.splitSentences('word '.repeat(300)).join(' ').split(' ').length, 300); // nothing lost when long text is cut
assert.equal(L.splitSentences('x'.repeat(500)).join('').length, 500); // even with no spaces
assert.deepEqual(L.splitSentences('これは本です。次の文！'), ['これは本です。', '次の文！']);
const twoCh = L.splitChapters('Intro line\nChapter 1: Start\nOne text.\nChapter 2\nTwo text.', 'My file');
assert.deepEqual(twoCh, [{ title: 'Chapter 1: Start', text: 'One text.' }, { title: 'Chapter 2', text: 'Two text.' }]);
assert.deepEqual(L.splitChapters('Just some text.', 'My file'), [{ title: 'My file', text: 'Just some text.' }]);
assert.deepEqual(L.splitChapters('   ', 'x'), []);
assert.deepEqual(L.splitChapters('A chapter 5 mention in a sentence, and\nChapter 7 alone').length, 1); // one heading isn't a list of chapters
const ranked = L.rankVoices([{ name: 'Old', lang: 'en-US' }, { name: 'Ana (Natural)', lang: 'de-DE' }, { name: 'Aria Online (Natural)', lang: 'en-US' }, { name: 'Pierre Online', lang: 'fr-FR' }, { name: 'Google US', lang: 'en-US' }], 'de-DE');
assert.deepEqual(ranked.map(r => r.voice.name), ['Ana (Natural)', 'Aria Online (Natural)', 'Pierre Online', 'Google US', 'Old']);
assert.deepEqual(ranked.map(r => r.recommended), [true, true, false, true, false]);

// files to read aloud
assert.equal(L.htmlToText('<html><head><title>T</title><style>p{}</style></head><body><h1>Big</h1><p>One &amp; two&#33;</p><script>bad()</script><p>Caf&eacute;<br>Next</p></body></html>'), 'Big\nOne & two!\nCaf&eacute;\nNext');
assert.equal(L.unwrapLines('A line that\ngoes on. New one\n\nPara two'), 'A line that goes on. New one\n\nPara two');
const zipOf = entries => { // small real zip, compressed like EPUB and Word files
  const enc = new TextEncoder(), locals = [], central = []; let off = 0;
  for (const [name, text, stored] of entries) {
    const n = enc.encode(name), raw = enc.encode(text), data = stored ? raw : deflateRawSync(raw), method = stored ? 0 : 8;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(method, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(method, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, n, data); central.push(ch, n); off += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central), eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(entries.length, 10); eo.writeUInt32LE(cd.length, 12); eo.writeUInt32LE(off, 16);
  const all = Buffer.concat([...locals, cd, eo]); return all.buffer.slice(all.byteOffset, all.byteOffset + all.length);
};
const long = 'This sentence is long enough to count as a real chapter of the book.';
const epub = L.readZip(zipOf([
  ['mimetype', 'application/epub+zip', true],
  ['META-INF/container.xml', '<rootfile full-path="OEBPS/book.opf"/>'],
  ['OEBPS/book.opf', '<manifest><item id="c" href="cover.xhtml"/><item href="ch%202.xhtml" id="b"/><item id="a" href="ch1.xhtml"/></manifest><spine><itemref idref="c"/><itemref idref="a"/><itemref idref="b"/><itemref idref="gone"/></spine>'],
  ['OEBPS/cover.xhtml', '<p>Cover</p>'],
  ['OEBPS/ch1.xhtml', '<title>x</title><h1>First</h1><p>' + long + '</p>'],
  ['OEBPS/ch 2.xhtml', '<p>' + long + '</p>'],
]));
const epubOut = await L.epubChapters(epub, 'Part');
assert.deepEqual(epubOut.map(c => c.title), ['First', 'Part 2']); // reading order from the book, cover skipped
assert.ok(epubOut[0].text.endsWith(long));
assert.equal(await L.docxText(L.readZip(zipOf([['word/document.xml', '<w:p><w:r><w:t>Hello &amp; hi</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t></w:r></w:p>']]))), 'Hello & hi\nSecond');
assert.throws(() => L.readZip(new ArrayBuffer(50)), /damaged/);
await assert.rejects(L.epubChapters(L.readZip(zipOf([['a', 'b']]))), /damaged/);
assert.equal(L.fileKind('Book.MP3'), 'audio'); assert.equal(L.fileKind('x.mp4'), 'audio'); assert.equal(L.fileKind('x.bin', 'audio/mpeg'), 'audio');
assert.equal(L.fileKind('a.pdf'), 'pdf'); assert.equal(L.fileKind('a.epub'), 'epub'); assert.equal(L.fileKind('a.docx'), 'docx'); assert.equal(L.fileKind('a.html'), 'html'); assert.equal(L.fileKind('a.md'), 'text'); assert.equal(L.fileKind('a.doc'), '');

// one comics section
const comicsOld = [
  { id: 'j', type: 'Manga', title: 'Twin Title', titles: {}, links: [], tags: [], grade: 8, updatedAt: 1 },
  { id: 'k', type: 'Manhwa', title: 'Twin Title', titles: {}, links: [], tags: [], updatedAt: 1 },
  { id: 'o', type: 'Manhua', title: 'Only Here', titles: {}, links: [], tags: [], updatedAt: 1 },
  { id: 'p', type: L.BOOKS, title: 'Twin Title', titles: {}, links: [], tags: [], updatedAt: 1 },
];
L.migrate(comicsOld);
assert.ok(comicsOld.filter(i => i.id !== 'p').every(i => i.type === L.COMICS));
assert.equal(comicsOld[1].deleted, true); assert.equal(comicsOld[0].grade, 8); assert.ok(!comicsOld[2].deleted);
assert.ok(!comicsOld[3].deleted); // a book of the same name is another version
assert.equal(L.sectionName('Manhua'), L.COMICS); assert.equal(L.sectionName('Movie'), 'Movie');
assert.deepEqual(L.versionTokens({ type: 'Movie', title: 'x', titles: {}, ext: {}, audiobook: true, relations: [{ anilistId: 1, type: L.COMICS, rel: 'source' }] }, L.versionIndex([])), ['📕 Manga', '🎧 Audiobook']);

// tabs in my own order
assert.deepEqual(L.orderTabs(['a', 'b', 'c'], []), ['a', 'b', 'c']);
assert.deepEqual(L.orderTabs(['a', 'b', 'c'], ['c', 'a']), ['c', 'a', 'b']); // a new tab goes last
assert.deepEqual(L.orderTabs(['a', 'b'], ['gone', 'b', 'a']), ['b', 'a']);
assert.deepEqual(L.moveTab(['a', 'b', 'c'], [], 'c', -1), ['a', 'c', 'b']);
assert.deepEqual(L.moveTab(['a', 'b', 'c'], [], 'a', -1), ['a', 'b', 'c']); // already first
assert.deepEqual(L.moveTab(['a', 'b', 'c'], [], 'c', 1), ['a', 'b', 'c']); // already last

// hidden folder
const salt = L.newVaultSalt(), secretKey = await L.vaultKey('correct horse', salt);
const secret = [{ id: 'h1', title: 'Geheimnis 秘密', hidden: true }];
const sealed = await L.sealVault(secret, secretKey);
assert.ok(!JSON.stringify(sealed).includes('Geheimnis') && !atob(sealed.data).includes('Geheimnis')); // the title can't be read in what is saved
assert.deepEqual(await L.openVault(sealed, secretKey), secret);
await assert.rejects(L.openVault(sealed, await L.vaultKey('wrong', salt))); // wrong password
await assert.rejects(L.openVault({ ...sealed, data: btoa('tampered with this text') }, secretKey)); // changed text
assert.notEqual((await L.sealVault(secret, secretKey)).data, sealed.data); // sealed differently every time

// websites
assert.equal(L.siteKey('https://www.royalroad.com/'), 'royalroad.com');
assert.equal(L.siteKey('not a link'), 'not a link');
assert.equal(L.makeSite({ title: 'x', url: 'https://x.y' }).folder, 'Other');
assert.ok(L.STARTER_SITES.every(s => s.url.startsWith('https://') && s.note && s.folder.includes(' › ')));

console.log('all tests passed');
