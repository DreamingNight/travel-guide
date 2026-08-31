import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

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
