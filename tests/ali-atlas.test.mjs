import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';

const execFileAsync = promisify(execFile);

const html = await readFile(new URL('../ali-atlas/index.html', import.meta.url), 'utf8');
const sources = JSON.parse(await readFile(new URL('../ali-atlas/assets/atlas/sources.json', import.meta.url), 'utf8'));
const approvedFiles = `
  lhasa-palace.webp lhasa-jokhang.webp lhasa-museum.webp
  yamdrok-overlook.webp yamdrok-bay.webp yamdrok-pastoral.webp
  kailash-dawn.webp manasarovar.webp rakshastal.webp
  guge-panorama.webp guge-caves.webp tholing.webp
  samye.webp yarlung-valley.webp yumbulagang.webp
  g317-road.webp g317-grassland.webp g317-wildlife.webp
  siling-bay.webp siling-gradient.webp siling-mountains.webp
  namtso-bay.webp namtso-range.webp namtso-shore.webp
`.trim().split(/\s+/).sort();

const classTokenCount = (source, token) => [...source.matchAll(/class="([^"]*)"/g)]
  .filter(([, classes]) => classes.split(/\s+/).includes(token)).length;
const atlasHtml = html.slice(html.indexOf('<section class="section atlas-section'), html.indexOf('<section class="section reveal" id="intro"'));
const atlasCards = [...atlasHtml.matchAll(/<article class="atlas-card">([\s\S]*?)<\/article>/g)].map(([, card]) => card);
const attribute = (markup, name) => markup.match(new RegExp(`${name}="([^"]*)"`))?.[1];

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const open = html.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < html.length; index += 1) {
    if (html[index] === '{') depth += 1;
    if (html[index] === '}') depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`unterminated function ${name}`);
}

test('destination atlas has the approved compact structure', () => {
  assert.equal(classTokenCount(atlasHtml, 'atlas-card'), 8);
  assert.equal(classTokenCount(atlasHtml, 'atlas-photo'), 24);
  assert.match(atlasHtml, /data-atlas-prev/);
  assert.match(atlasHtml, /data-atlas-next/);
  assert.match(atlasHtml, /id="atlas-status"/);
});

test('all approved destinations are represented', () => {
  for (const name of ['拉萨', '羊卓雍措', '冈仁波齐', '古格', '山南', 'G317', '色林措', '纳木措']) {
    assert.match(atlasHtml, new RegExp(name));
  }
});

test('atlas uses every approved image once with useful image metadata', () => {
  const images = [...atlasHtml.matchAll(/<img\s+([^>]+)>/g)].map(([, attributes]) => attributes);
  assert.equal(images.length, 24);
  assert.deepEqual(images.map((attributes) => attributes.match(/src="assets\/atlas\/([^"]+)"/)?.[1]).sort(), approvedFiles);
  for (const attributes of images) {
    assert.match(attributes, /alt="[^"]+"/);
    assert.match(attributes, /width="\d+"/);
    assert.match(attributes, /height="\d+"/);
  }
  assert.equal(images.filter((attributes) => /loading="eager"/.test(attributes)).length, 1);
  assert.match(images.find((attributes) => /lhasa-palace\.webp/.test(attributes)), /loading="eager"/);
  assert.equal(images.filter((attributes) => /loading="lazy"/.test(attributes)).length, 23);
});

test('every atlas card owns exactly three complete photo triggers', () => {
  assert.equal(atlasCards.length, 8);
  const ledgerByFile = new Map(sources.map((row) => [row.file, row]));
  for (const [cardIndex, card] of atlasCards.entries()) {
    const photos = [...card.matchAll(/<button class="[^"]*\batlas-photo\b[^"]*"([^>]*)>([\s\S]*?)<\/button>/g)];
    assert.equal(photos.length, 3, `card ${cardIndex + 1}: expected exactly 3 photos`);
    for (const [, buttonAttributes, contents] of photos) {
      assert.match(attribute(buttonAttributes, 'aria-label') ?? '', /^查看.+大图$/);
      assert.ok(attribute(buttonAttributes, 'data-credit'));
      const source = attribute(buttonAttributes, 'data-source');
      assert.match(source ?? '', /^https:\/\//);
      const file = contents.match(/src="assets\/atlas\/([^"]+)"/)?.[1];
      const ledger = ledgerByFile.get(file);
      assert.equal(source, ledger?.url, `${file}: source URL must match ledger`);
      if (source.includes('commons.wikimedia.org')) {
        assert.equal(attribute(buttonAttributes, 'data-credit'), `${ledger?.creator} · ${ledger?.license}`, `${file}: credit must match ledger`);
        assert.match(attribute(buttonAttributes, 'data-license-url') ?? '', /^https:\/\/creativecommons\.org\//, `${file}: Commons image needs a license URL`);
      } else {
        assert.match(attribute(buttonAttributes, 'data-credit') ?? '', new RegExp(`^${ledger?.creator} · 小红书创作者$`), `${file}: creator credit must match ledger`);
      }
    }
  }
});

test('atlas status maps the end of the scroll range to the final card', () => {
  const context = {};
  runInNewContext(`${extractFunction('getAtlasIndex')}; result = [
    getAtlasIndex(0, 1200, 420, 8),
    getAtlasIndex(420, 1200, 420, 8),
    getAtlasIndex(1200, 1200, 420, 8)
  ];`, context);
  assert.deepEqual([...context.result], [0, 1, 7]);
  assert.match(html, /requestAnimationFrame\(/);
  assert.match(html, /atlasStatus\.textContent\s*!==\s*nextStatus/);
});

test('desktop arrow stops expose every atlas card without skipping Siling Co', () => {
  assert.match(html, /--atlas-card-width:\s*min\(78vw,\s*410px\)/);
  assert.match(html, /padding-inline-end:\s*max\(1px,\s*calc\(100%\s*-\s*var\(--atlas-card-width\)\)\)/);

  const context = {};
  runInNewContext(`${extractFunction('getAtlasIndex')};
    const step = 428;
    const maxScroll = step * 7;
    result = Array.from({ length: 8 }, (_, index) =>
      getAtlasIndex(Math.min(index * step, maxScroll), maxScroll, step, 8)
    );`, context);
  assert.deepEqual([...context.result], [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('lightbox exposes attribution and constrains modal focus', () => {
  const lightboxHtml = html.slice(html.indexOf('<div class="lightbox"'), html.indexOf('<script>'));
  assert.match(lightboxHtml, /id="lightbox-credit"/);
  assert.match(lightboxHtml, /id="lightbox-source"/);
  assert.match(lightboxHtml, /id="lightbox-license"/);
  assert.match(html, /backgroundElements[\s\S]*?\.inert\s*=\s*true/);
  assert.match(html, /backgroundElements[\s\S]*?\.inert\s*=\s*false/);
  assert.match(html, /e\.key\s*===\s*['"]Tab['"]/);
  assert.match(html, /lightboxFocusables/);
  assert.match(html, /lightboxTrigger\?\.focus\(\)/);
});

test('lightbox focus wrapping handles forward and reverse tabbing', () => {
  const context = {};
  runInNewContext(`${extractFunction('getFocusWrapTarget')};
    const focusables = ['first', 'middle', 'last'];
    result = [
      getFocusWrapTarget('Tab', false, 'last', focusables),
      getFocusWrapTarget('Tab', true, 'first', focusables),
      getFocusWrapTarget('Tab', false, 'first', focusables),
      getFocusWrapTarget('Escape', false, 'last', focusables)
    ];`, context);
  assert.deepEqual([...context.result], ['first', 'last', null, null]);
});

test('atlas implements progressive, accessible interaction', () => {
  assert.match(html, /scroll-snap-type:\s*x mandatory/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
  assert.match(atlasHtml, /aria-label="查看[^"]+大图"/);
  assert.match(html, /addEventListener\(['"]keydown['"]/);
  assert.match(html, /scrollBy\(/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /\.focus\(\)/);
});

test('atlas provides desktop and mobile card sizing', () => {
  assert.match(html, /\.atlas-section\s*\{[\s\S]*?max-width:\s*1000px/);
  assert.match(html, /--atlas-card-width:\s*min\(78vw,\s*410px\)/);
  assert.match(html, /grid-auto-columns:\s*var\(--atlas-card-width\)/);
  assert.match(html, /@media\s*\(max-width:\s*640px\)[\s\S]*?--atlas-card-width:\s*86vw/);
});

test('Siling Co imagery covers three distinct visual subjects', () => {
  for (const subject of ['湖湾曲线', '湖水渐变', '远山台地']) assert.match(atlasHtml, new RegExp(subject));
});

test('legacy page assets resolve through the actual ali asset library', () => {
  assert.doesNotMatch(html, /(?:src|url\()=["']?assets\/(?:commons|xhs|2026-dual)/);
  assert.match(html, /\.\.\/ali\/assets\/commons\/05-kailash-cover\.png/);
  assert.match(html, /\.\.\/ali\/assets\/2026-dual\/route-dual\.svg/);
});

test('image ledger contains 24 complete unique records', () => {
  assert.equal(sources.length, 24);
  assert.equal(new Set(sources.map(({ file }) => file)).size, 24);
  for (const row of sources) {
    for (const key of ['file', 'destination', 'subject', 'creator', 'title', 'url', 'license', 'accessNote']) {
      assert.ok(row[key], `${row.file}: missing ${key}`);
    }
  }
});

test('image ledger uses exactly the approved filenames and groups', () => {
  assert.deepEqual(sources.map(({ file }) => file).sort(), approvedFiles);
  const counts = Object.groupBy(sources, ({ destination }) => destination);
  assert.equal(Object.keys(counts).length, 8);
  for (const [destination, rows] of Object.entries(counts)) {
    assert.equal(rows.length, 3, `${destination}: expected exactly 3 images`);
  }
  assert.deepEqual(
    sources.filter(({ destination }) => destination === '色林措').map(({ subject }) => subject).sort(),
    ['湖水渐变', '湖湾曲线', '远山台地'].sort(),
  );
});

test('multi-image social posts identify the exact source image', () => {
  const expected = {
    'g317-road.webp': 5,
    'g317-grassland.webp': 7,
    'siling-bay.webp': 5,
    'siling-gradient.webp': 6,
    'siling-mountains.webp': 8,
    'namtso-bay.webp': 6,
    'namtso-range.webp': 9,
    'namtso-shore.webp': 1,
  };
  for (const [file, imageIndex] of Object.entries(expected)) {
    assert.equal(sources.find((row) => row.file === file)?.imageIndex, imageIndex, file);
  }
});

test('each optimized image stays below the hard limits', async () => {
  for (const { file } of sources) {
    const info = await stat(new URL(`../ali-atlas/assets/atlas/${file}`, import.meta.url));
    assert.ok(info.size < 256000, `${file} is ${info.size} bytes`);
  }
});

test('asset verifier accepts the complete optimized library', async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    new URL('../scripts/verify-atlas-assets.mjs', import.meta.url).pathname,
  ]);
  assert.equal((stdout.match(/^ok /gm) || []).length, 24);
});

test('asset verifier rejects a self-consistent but unapproved ledger', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-ledger-'));
  const ledger = structuredClone(sources);
  ledger[0].file = 'unapproved.webp';
  const ledgerPath = join(directory, 'sources.json');
  await writeFile(ledgerPath, JSON.stringify(ledger));
  await assert.rejects(execFileAsync(process.execPath, [
    new URL('../scripts/verify-atlas-assets.mjs', import.meta.url).pathname,
    '--ledger', ledgerPath,
  ]));
});
