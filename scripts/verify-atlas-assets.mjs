import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const atlasDir = new URL('../ali-atlas/assets/atlas/', import.meta.url);
const ledgerFlag = process.argv.indexOf('--ledger');
const ledgerPath = ledgerFlag === -1 ? new URL('sources.json', atlasDir) : process.argv[ledgerFlag + 1];
const sources = JSON.parse(await readFile(ledgerPath, 'utf8'));
const approvedByDestination = {
  '拉萨': ['lhasa-palace.webp', 'lhasa-jokhang.webp', 'lhasa-museum.webp'],
  '羊卓雍措': ['yamdrok-overlook.webp', 'yamdrok-bay.webp', 'yamdrok-pastoral.webp'],
  '冈仁波齐与两湖': ['kailash-dawn.webp', 'manasarovar.webp', 'rakshastal.webp'],
  'A线·古格': ['guge-panorama.webp', 'guge-caves.webp', 'tholing.webp'],
  'B线·山南': ['samye.webp', 'yarlung-valley.webp', 'yumbulagang.webp'],
  'G317 羌塘': ['g317-road.webp', 'g317-grassland.webp', 'g317-wildlife.webp'],
  '色林措': ['siling-bay.webp', 'siling-gradient.webp', 'siling-mountains.webp'],
  '纳木措': ['namtso-bay.webp', 'namtso-range.webp', 'namtso-shore.webp'],
};
let failed = false;

const expectedFiles = Object.values(approvedByDestination).flat().sort();
const actualFiles = sources.map(({ file }) => file).sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  console.error('invalid ledger: filenames do not match the approved 24-file set');
  process.exit(1);
}

for (const [destination, files] of Object.entries(approvedByDestination)) {
  const actual = sources.filter((row) => row.destination === destination).map(({ file }) => file).sort();
  if (JSON.stringify(actual) !== JSON.stringify(files.toSorted())) {
    console.error(`invalid ledger: ${destination} must contain its three approved files`);
    process.exit(1);
  }
}

const silingSubjects = sources
  .filter(({ destination }) => destination === '色林措')
  .map(({ subject }) => subject)
  .sort();
if (JSON.stringify(silingSubjects) !== JSON.stringify(['湖水渐变', '湖湾曲线', '远山台地'].sort())) {
  console.error('invalid ledger: Siling Co subjects do not match the approved set');
  process.exit(1);
}

for (const { file } of sources) {
  const url = new URL(file, atlasDir);
  try {
    await stat(url);
    const { stdout } = await execFileAsync('magick', [
      'identify', '-format', '%w %h %m', url.pathname,
    ]);
    const [width, height, format] = stdout.trim().split(/\s+/);
    if (format !== 'WEBP') throw new Error(`format is ${format}`);
    if (Number(width) > 1600 || Number(height) > 1600) {
      throw new Error(`dimensions are ${width}x${height}`);
    }
    console.log(`ok ${file} ${width}x${height} ${format}`);
  } catch (error) {
    failed = true;
    console.error(`invalid ${file}: ${error.message}`);
  }
}

if (failed) process.exitCode = 1;
