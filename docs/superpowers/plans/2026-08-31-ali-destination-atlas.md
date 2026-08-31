# Ali Destination Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a concise, image-led Ali trip page at `/travel-guide/ali-atlas/` while leaving `/travel-guide/ali/` unchanged.

**Architecture:** Create a self-contained static page in `ali-atlas/`, using the current `ali/index.html` as the visual baseline but adding one compact eight-card horizontal destination atlas. Store the 24 optimized WebP images and a machine-readable provenance ledger beside the new page; use dependency-free JavaScript for scrolling and the existing lightbox pattern.

**Tech Stack:** Semantic HTML, responsive CSS, vanilla JavaScript, WebP, Node.js built-in test runner, GitHub Pages.

## Global Constraints

- Keep the existing six-image lead gallery and keep the whole page concise.
- Use exactly eight atlas cards and exactly three genuinely attractive, visually distinct images per card.
- Give A-line Guge and B-line Shannan equal visual weight.
- Siling Co must show three distinct subjects: bay geometry, water-color gradient, and distant plateau/mountains.
- Do not imply that drone use, trekking, off-road access, unsafe viewpoints, or unapproved wild lakeshore access belongs to the itinerary.
- Desktop shows about 2.3 cards with arrow and trackpad navigation; mobile uses native swipe, about 86vw cards, a visible next-card edge, and scroll snap.
- Every Xiaohongshu image must retain author, post title, and source URL; public long-term use still requires author permission.
- Each new image uses WebP, long edge no greater than 1600px, target size below 250KB, and lazy loading except the first atlas card's main image.
- Respect `prefers-reduced-motion`; all controls and image triggers must work by keyboard.
- Verify at 1440×1000 and 375×812 with no page-level horizontal overflow or console errors.
- Publish at `https://dreamingnight.cn/travel-guide/ali-atlas/`; do not modify the deployed content at `/travel-guide/ali/`.

---

### Task 1: Create the independent atlas page contract

**Files:**
- Create: `ali-atlas/index.html`
- Create: `tests/ali-atlas.test.mjs`

**Interfaces:**
- Consumes: visual structure and copy from `ali/index.html`.
- Produces: an independent page with `data-atlas-track`, eight `.atlas-card` elements, 24 `.atlas-photo` buttons, `[data-atlas-prev]`, `[data-atlas-next]`, and `#atlas-status`.

- [ ] **Step 1: Write the failing structural test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../ali-atlas/index.html', import.meta.url), 'utf8');

test('destination atlas has the approved compact structure', () => {
  assert.equal((html.match(/class="atlas-card/g) || []).length, 8);
  assert.equal((html.match(/class="atlas-photo/g) || []).length, 24);
  assert.match(html, /data-atlas-prev/);
  assert.match(html, /data-atlas-next/);
  assert.match(html, /id="atlas-status"/);
});

test('all approved destinations are represented', () => {
  for (const name of ['拉萨', '羊卓雍措', '冈仁波齐', '古格', '山南', 'G317', '色林措', '纳木措']) {
    assert.match(html, new RegExp(name));
  }
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/ali-atlas.test.mjs`

Expected: FAIL with `ENOENT` for `ali-atlas/index.html`.

- [ ] **Step 3: Create the page shell**

Use `ali/index.html` as the exact starting content, change canonical page metadata for `/ali-atlas/`, and insert this semantic section immediately after the existing six-image gallery:

```html
<section class="section atlas-section reveal" id="atlas" aria-labelledby="atlas-title">
  <p class="section-label">核心景点图鉴</p>
  <h2 class="section-title" id="atlas-title">八个地方，构成这趟阿里</h2>
  <p class="section-text">自然、人文与两条支线，只挑最值得记住的画面。</p>
  <div class="atlas-toolbar">
    <p id="atlas-status" aria-live="polite">01 / 08</p>
    <div class="atlas-arrows">
      <button type="button" data-atlas-prev aria-label="上一处景点">←</button>
      <button type="button" data-atlas-next aria-label="下一处景点">→</button>
    </div>
  </div>
  <div class="atlas-track" data-atlas-track tabindex="0" aria-label="核心景点图鉴，横向滑动浏览">
  </div>
</section>
```

- [ ] **Step 4: Run the structural test**

Run: `node --test tests/ali-atlas.test.mjs`

Expected: FAIL because the track does not yet contain eight cards and 24 photos; metadata and page shell load without malformed markup.

- [ ] **Step 5: Commit the page contract**

```bash
git add ali-atlas/index.html tests/ali-atlas.test.mjs
git commit -m "test: define Ali destination atlas contract"
```

### Task 2: Curate, verify, and optimize the image set

**Files:**
- Create: `ali-atlas/assets/atlas/*.webp`
- Create: `ali-atlas/assets/atlas/sources.json`
- Create: `scripts/verify-atlas-assets.mjs`
- Modify: `tests/ali-atlas.test.mjs`

**Interfaces:**
- Consumes: roadbook image references, current `ali/assets/`, Xiaohongshu results, and reusable Commons assets.
- Produces: the 24 filenames listed below and a `sources.json` array whose objects use `{ file, destination, subject, creator, title, url, license, accessNote }`.

Approved filenames:

```text
lhasa-palace.webp       lhasa-jokhang.webp       lhasa-museum.webp
yamdrok-overlook.webp   yamdrok-bay.webp         yamdrok-pastoral.webp
kailash-dawn.webp       manasarovar.webp         rakshastal.webp
guge-panorama.webp      guge-caves.webp          tholing.webp
samye.webp              yarlung-valley.webp      yumbulagang.webp
g317-road.webp          g317-grassland.webp      g317-wildlife.webp
siling-bay.webp         siling-gradient.webp     siling-mountains.webp
namtso-bay.webp         namtso-range.webp         namtso-shore.webp
```

- [ ] **Step 1: Extend the failing test for the asset contract**

```js
import { stat } from 'node:fs/promises';
const sources = JSON.parse(await readFile(new URL('../ali-atlas/assets/atlas/sources.json', import.meta.url), 'utf8'));

test('image ledger contains 24 complete unique records', () => {
  assert.equal(sources.length, 24);
  assert.equal(new Set(sources.map(({ file }) => file)).size, 24);
  for (const row of sources) {
    for (const key of ['file', 'destination', 'subject', 'creator', 'title', 'url', 'license', 'accessNote']) {
      assert.ok(row[key], `${row.file}: missing ${key}`);
    }
  }
});

test('each optimized image stays below the hard limits', async () => {
  for (const { file } of sources) {
    const info = await stat(new URL(`../ali-atlas/assets/atlas/${file}`, import.meta.url));
    assert.ok(info.size < 256000, `${file} is ${info.size} bytes`);
  }
});
```

- [ ] **Step 2: Run the asset tests and verify they fail**

Run: `node --test tests/ali-atlas.test.mjs`

Expected: FAIL with `ENOENT` for `sources.json`.

- [ ] **Step 3: Search and shortlist real imagery**

Use OpenCLI Xiaohongshu search for `拉萨 布达拉宫 大昭寺 八廓街 西藏博物馆 摄影`, `羊卓雍措 观景台 湖湾 鲁日拉`, `冈仁波齐 日照金山 玛旁雍措 拉昂措`, `古格遗址 托林寺 壁画`, `山南 桑耶寺 雍布拉康 雅鲁藏布江`, `G317 羌塘 公路 野生动物`, `色林错 湖湾 观景台 远山`, and `纳木措 念青唐古拉 湖湾 景区`. For each destination, compare at least six candidates and retain three that differ in subject, distance, or cultural content. Reject watermarked collages, low-resolution screenshots, unverified locations, and images whose viewpoint is not safely representative of the itinerary.

- [ ] **Step 4: Build the provenance ledger**

Write one complete `sources.json` record for every chosen image. Set `license` to the explicit Commons license or `Xiaohongshu creator-owned; permission recommended`, and describe safe itinerary relevance in `accessNote`. The three Siling Co records must use subjects `湖湾曲线`, `湖水渐变`, and `远山台地` exactly.

- [ ] **Step 5: Optimize all files**

Place the 24 selected originals in a temporary directory outside the repository using their approved basenames, then use ImageMagick to auto-orient, resize, and encode every file:

```bash
for source in "$ATLAS_SOURCE_DIR"/*; do
  base="$(basename "${source%.*}")"
  magick "$source" -auto-orient -resize '1600x1600>' -strip -quality 78 "ali-atlas/assets/atlas/$base.webp"
done
```

Reduce quality only as needed to keep every output below 256000 bytes without visible banding in skies or lakes.

- [ ] **Step 6: Add and run dimensional verification**

Create `scripts/verify-atlas-assets.mjs` to call `magick identify -format '%w %h'` for each ledger file and exit non-zero if width or height exceeds 1600, if a file is not WebP, or if a file is absent. Run:

```bash
node scripts/verify-atlas-assets.mjs
node --test tests/ali-atlas.test.mjs
```

Expected: both commands exit 0; 24 records and 24 WebPs pass size and dimension checks.

- [ ] **Step 7: Commit the verified image library**

```bash
git add ali-atlas/assets/atlas scripts/verify-atlas-assets.mjs tests/ali-atlas.test.mjs
git commit -m "assets: curate Ali destination atlas imagery"
```

### Task 3: Implement the compact responsive atlas

**Files:**
- Modify: `ali-atlas/index.html`
- Modify: `tests/ali-atlas.test.mjs`

**Interfaces:**
- Consumes: the 24 image filenames and `sources.json` contract from Task 2.
- Produces: eight cards in this order: Lhasa, Yamdrok, Kailash and two lakes, A Guge, B Shannan, G317 Changtang, Siling Co, Namtso.

- [ ] **Step 1: Add failing behavior and accessibility assertions**

```js
test('atlas implements progressive, accessible interaction', () => {
  assert.match(html, /scroll-snap-type:\s*x mandatory/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
  assert.match(html, /aria-label="查看[^\"]+大图"/);
  assert.match(html, /addEventListener\(['"]keydown['"]/);
  assert.match(html, /scrollBy\(/);
});

test('Siling Co imagery covers three distinct visual subjects', () => {
  for (const subject of ['湖湾曲线', '湖水渐变', '远山台地']) assert.match(html, new RegExp(subject));
});
```

- [ ] **Step 2: Run the behavior tests and verify they fail**

Run: `node --test tests/ali-atlas.test.mjs`

Expected: FAIL because the atlas CSS, cards, and controls are not implemented.

- [ ] **Step 3: Add the responsive CSS**

Implement `.atlas-track` as `display:grid; grid-auto-flow:column; grid-auto-columns:min(78vw, 410px); overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none`. Each `.atlas-card` uses a 2×2 grid with the main image spanning two rows, rounded corners, dark surface, equal-height A/B badges, and a single sentence below the collage. At `max-width:640px`, use `grid-auto-columns:86vw`; at `prefers-reduced-motion:reduce`, disable smooth scroll and image transitions.

- [ ] **Step 4: Insert all eight cards and concise copy**

Use three `<button class="atlas-photo">` elements per card, each with a precise `aria-label`, `data-credit`, and a nested `<img>` with accurate `alt`, `width`, `height`, and `loading="lazy"`. Set only `lhasa-palace.webp` to `loading="eager"`. Use these one-sentence card messages:

```text
拉萨：先用宫殿、寺院与当代馆藏，慢慢进入西藏的时间尺度。
羊卓雍措：从高位湖盆走到近岸湖湾，看见羊湖不止一种蓝。
神山与两湖：不转山，也把晨光里的冈仁波齐与两座性格相反的湖看完整。
A线·古格：在土林之外，看一座王朝如何留下城堡、洞窟与寺院。
B线·山南：沿雅鲁藏布江进入西藏文明腹地，寺院与河谷彼此解释。
G317·羌塘：真正的主角是公路之外无边的湖盆、草场与高原生命。
色林措：湖湾、色阶和远山层层展开，是共同北线最辽阔的一幕。
纳木措：从合规景区湖岸收束旅程，让念青唐古拉留在最后一帧。
```

- [ ] **Step 5: Add navigation and reuse the lightbox**

Implement arrow buttons with `track.scrollBy({ left: cardWidth + gap, behavior })`; update `#atlas-status` from the card nearest the track's left edge on a passive `scroll` listener; support ArrowLeft and ArrowRight on the track; disable animation when reduced motion is requested. Replace inline lightbox assumptions with delegated click handling that supports both `.gallery-item` and `.atlas-photo`, preserves alt text, closes on Escape, closes on backdrop only, returns focus to the triggering button, and toggles `aria-hidden`.

- [ ] **Step 6: Run all static tests**

Run:

```bash
node scripts/verify-atlas-assets.mjs
node --test tests/ali-atlas.test.mjs
```

Expected: PASS with eight cards, 24 image triggers, correct Siling Co subjects, valid asset limits, and required accessibility behavior.

- [ ] **Step 7: Commit the complete atlas UI**

```bash
git add ali-atlas/index.html tests/ali-atlas.test.mjs
git commit -m "feat: add responsive Ali destination atlas"
```

### Task 4: Visual QA and production publication

**Files:**
- Modify only if QA finds defects: `ali-atlas/index.html`, `ali-atlas/assets/atlas/*.webp`, `tests/ali-atlas.test.mjs`

**Interfaces:**
- Consumes: completed local `/ali-atlas/` page.
- Produces: verified GitHub Pages URL `https://dreamingnight.cn/travel-guide/ali-atlas/`.

- [ ] **Step 1: Start a local static server**

Run: `python3 -m http.server 4173`

Expected: server listens on port 4173 and `http://127.0.0.1:4173/ali-atlas/` returns 200.

- [ ] **Step 2: Verify desktop behavior at 1440×1000**

Open the page, confirm about 2.3 cards are visible, both arrows traverse all eight cards, trackpad scrolling works, all 24 images open in the lightbox, Escape and backdrop close it, focus returns to the trigger, and no page-level horizontal scrollbar or console error appears.

- [ ] **Step 3: Verify mobile behavior at 375×812**

Confirm cards occupy about 86vw, the next card edge remains visible, native swiping snaps correctly, text never covers essential photo subjects, buttons have usable tap targets, all eight groups remain concise, and no page-level horizontal overflow appears.

- [ ] **Step 4: Audit image quality and itinerary truthfulness**

Inspect every collage at rendered size. Replace any soft, repetitive, misleading, over-watermarked, badly cropped, or visually weak photo. Specifically verify that Siling Co reads as three different views rather than three similar blue-lake frames, and that Guge and Shannan feel equally important.

- [ ] **Step 5: Re-run the complete verification suite**

Run:

```bash
node scripts/verify-atlas-assets.mjs
node --test tests/ali-atlas.test.mjs
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit QA fixes, push, and wait for Pages**

```bash
git add ali-atlas tests scripts/verify-atlas-assets.mjs
git commit -m "fix: polish Ali atlas across screen sizes"
git push origin main
```

Wait for the GitHub Pages deployment triggered by `main` to finish.

- [ ] **Step 7: Verify the new production URL without altering the old one**

Run HTTP checks for both URLs and compare SHA-256 hashes of production and local `ali-atlas/index.html` plus every new WebP. Expected: `/travel-guide/ali-atlas/` returns 200 and matches local files; `/travel-guide/ali/` still returns 200 and its content is unchanged from commit `128c60d`.
