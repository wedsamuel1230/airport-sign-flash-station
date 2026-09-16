import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ASSETS_FLASH_ADDRESS,
  overallWriteProgress,
  validateManifest,
} from '../flasher-core.js';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('firmware/manifest.json', root), 'utf8'));

test('bundled package includes application and Chinese font asset partitions', () => {
  const checked = validateManifest(manifest);
  assert.equal(checked.target, 'esp32s3');
  assert.deepEqual(checked.segments.map(({ address }) => address), [0, ASSETS_FLASH_ADDRESS]);
});

test('manifest segment sizes and hashes match the bundled binaries', async () => {
  for (const segment of manifest.segments) {
    const data = await readFile(new URL(segment.path, root));
    assert.equal(data.byteLength, segment.size, segment.path);
    const { createHash } = await import('node:crypto');
    assert.equal(createHash('sha256').update(data).digest('hex'), segment.sha256, segment.path);
  }
});

test('overall progress includes completed earlier images', () => {
  const segments = [{ size: 25 }, { size: 75 }];
  assert.equal(overallWriteProgress(segments, 0, 25, 25), 25);
  assert.equal(overallWriteProgress(segments, 1, 37.5, 75), 63);
  assert.equal(overallWriteProgress(segments, 1, 75, 75), 100);
});

test('page has one owner for firmware file selection', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const flasher = await readFile(new URL('flasher.js', root), 'utf8');
  assert.doesNotMatch(html, /flashFile[^\n]{0,100}onchange|\.onchange\s*=/);
  assert.match(flasher, /flashFile.*addEventListener|fileInput\.addEventListener/s);
});

test('manifest rejects packages that would omit the font partition', () => {
  assert.throws(
    () => validateManifest({ ...manifest, segments: manifest.segments.slice(0, 1) }),
    /0x820000/i,
  );
});
