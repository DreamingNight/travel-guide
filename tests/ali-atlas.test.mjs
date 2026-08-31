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
