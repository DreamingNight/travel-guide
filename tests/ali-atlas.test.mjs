import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const html = await readFile(new URL('../ali-atlas/index.html', import.meta.url), 'utf8');
const sources = JSON.parse(await readFile(new URL('../ali-atlas/assets/atlas/sources.json', import.meta.url), 'utf8'));

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
