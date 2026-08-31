import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const atlasDir = new URL('../ali-atlas/assets/atlas/', import.meta.url);
const sources = JSON.parse(await readFile(new URL('sources.json', atlasDir), 'utf8'));
let failed = false;

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
