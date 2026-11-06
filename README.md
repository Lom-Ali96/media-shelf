# Media Shelf

My books, novels, light novels, web novels, manga, manhwa, manhua, anime, series, movies, audiobooks, fanfics and TikToks in one place.

## Put it online (once, about 10 minutes)

**1. The app**
1. On github.com click **+** (top right) → **New repository**.
2. Name: `media-shelf`, choose **Public** (free hosting needs public; there is nothing private in the app itself), click **Create repository**.
3. Click **uploading an existing file**, drag in **all files from this folder**, click **Commit changes**.
4. Open **Settings → Pages**. Under "Branch" pick **main** and **/ (root)**, click **Save**.
5. Wait 1–2 minutes. Your app is at `https://YOUR-USERNAME.github.io/media-shelf/`

**2. A private place for your list (for syncing between devices)**
1. **+** → **New repository**, name `media-shelf-data`, choose **Private**, tick **Add a README file**, **Create repository**.
2. Make a key: click your picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Name: `media shelf`, Expiration: up to 1 year (put a reminder in your calendar to renew it).
   - Repository access: **Only select repositories** → `media-shelf-data`.
   - Permissions → Repository permissions → **Contents: Read and write**.
   - **Generate token** and copy it. It works like a password: don't share it and don't paste it anywhere else.
3. In the app: **Settings** → fill in your GitHub user name, `media-shelf-data` and the key → **Save & sync now**.
   Do step 3 once on each device.

## Install it like an app

- **PC / laptop (Edge or Chrome):** open your app link, click the install icon at the right end of the address bar (or menu ⋯ → Apps → Install).
- **Android phone / tablet (Chrome):** menu ⋮ → **Add to Home screen / Install app**.
- **iPhone / iPad (Safari):** Share button → **Add to Home Screen**.

## Using it

- **Add:** type a title in any language, or paste a link (AO3, FanFiction.net, NovelUpdates, Webtoon, MangaDex, TikTok, YouTube, …). Pick the right match and it goes into the right section, with English, original and romanized titles, cover, and links.
- **Suggestions while typing:** after a moment, a list appears under the add box. It shows matches already on your shelf, titles you can add with one click, and **Did you mean …?** when a title looks misspelled. You can use the arrow keys and Enter, or click. Enter without choosing a suggestion searches all sources.
- **Paste post:** paste a link together with a caption or list of titles. The app finds the titles, you confirm the versions, and they are added with the post as their source. TikTok does not share captions with apps, so copy those in yourself. On Android, an installed app can also appear in the Share menu.
- **What next?:** tick the sections to pick from, and the app picks at random from your Planning list.
- **Websites:** your useful sites with a short explanation, in folders and subfolders (use › as in Reading › Manga).
- **Other versions:** open any title to see its manga / anime / novel versions. ＋ adds one, ✔ means you already have it.
- **+1** moves your chapter or episode on. At the last one it is marked finished with today's date.
- **Old Excel list:** Settings → Import Excel / CSV. Imported titles are tagged "imported". Open one and press **🔎 Find titles, cover and links online** to fill in the details.
- **Backups:** Settings → Download as Excel, or full backup (.json).

## Icons and updates

Small icons beside a title show the other versions of that story, like 📕 manga or 📺 anime. **🔎 To check** gathers titles the online check wasn't sure about. **Updates** shows new episodes and status changes, checked once a day while the app is open. With sync on, a daily job in the private data repository also finds new chapters on MangaUpdates.

## Read aloud

In a book or fanfic, press **🔊 Read aloud**, then paste a chapter or load a .txt file. Choose a voice, speed and pitch. Chapters stay on that device (they don't sync), so with a device voice you can listen offline. It can't read websites opened from the app; that needs a separate browser add-on.

## Books and audiobooks

Light novels, web novels, novels and audiobooks all live in **Books & Novels**. A 🎧 on a card means the book also exists as an audiobook. New books are checked automatically, and Settings can check your whole list.

## Where the information comes from

AniList (anime, manga, manhwa, manhua, light novels), TVmaze (series, in the "Anime & Series" section), Wikipedia (movies), Open Library (books), Apple Books (audiobooks). Fanfics and web novels can't be looked up automatically, so the app reads the title from the link where it can, and gives you search links for AO3, FanFiction.net, NovelUpdates and more.

## For whoever changes the code

`logic.js` holds the parts that can be tested (`node logic.test.js`), and `app.js` holds the screens. `sw.js` lets the app open without internet. There is no build step.
