import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ASSETS_FLASH_ADDRESS,
  DEFAULT_FLASH_CONCURRENCY,
  overallWriteProgress,
  runWithConcurrency,
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

test('batch queue keeps at most two destructive flashes active', async () => {
  assert.equal(DEFAULT_FLASH_CONCURRENCY, 2);
  let active = 0;
  let maximumActive = 0;
  const results = await runWithConcurrency([1, 2, 3, 4, 5], DEFAULT_FLASH_CONCURRENCY, async (value) => {
    active++;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return value * 2;
  });
  assert.equal(maximumActive, 2);
  assert.deepEqual(results.map(({ status, value }) => [status, value]), [
    ['fulfilled', 2],
    ['fulfilled', 4],
    ['fulfilled', 6],
    ['fulfilled', 8],
    ['fulfilled', 10],
  ]);
});

test('batch queue isolates one board failure from its teammates', async () => {
  const results = await runWithConcurrency([1, 2, 3], 2, async (value) => {
    if (value === 2) throw new Error('port lost');
    return value;
  });
  assert.deepEqual(results.map(({ status }) => status), ['fulfilled', 'rejected', 'fulfilled']);
});

test('page has one owner for firmware file selection', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const flasher = await readFile(new URL('flasher.js', root), 'utf8');
  assert.doesNotMatch(html, /flashFile[^\n]{0,100}onchange|\.onchange\s*=/);
  assert.match(flasher, /flashFile.*addEventListener|fileInput\.addEventListener/s);
});

test('flasher reuses an already granted Web Serial port', async () => {
  const flasher = await readFile(new URL('flasher.js', root), 'utf8');
  assert.match(flasher, /navigator\.serial\.getPorts\(\)/);
  assert.match(flasher, /usbVendorId === 0x303a/);
});

test('page exposes a multi-board queue and independent reset action', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const flasher = await readFile(new URL('flasher.js', root), 'utf8');
  assert.match(html, /id="boardList"/);
  assert.match(html, /id="resetSelected"/);
  assert.match(html, /Flash selected boards/);
  assert.match(flasher, /runWithConcurrency/);
  assert.match(flasher, /after\('hard_reset', true\)/);
});

test('operator interface avoids clipped dash placeholders and generic numbered steps', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const flasher = await readFile(new URL('flasher.js', root), 'utf8');
  assert.doesNotMatch(`${html}\n${flasher}`, /[—–]/);
  assert.doesNotMatch(html, />\s*0[123]\s*</);
});

test('deployed module URLs are versioned together to avoid stale browser code', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const flasher = await readFile(new URL('flasher.js', root), 'utf8');
  const pageVersion = html.match(/flasher\.js\?v=([^"']+)/)?.[1];
  const coreVersion = flasher.match(/flasher-core\.js\?v=([^"']+)/)?.[1];
  assert.ok(pageVersion);
  assert.equal(coreVersion, pageVersion);
});

test('each active device state has a distinct status color', async () => {
  const css = await readFile(new URL('style.css', root), 'utf8');
  for (const state of ['ready', 'queued', 'connecting', 'erasing', 'writing', 'resetting', 'complete', 'failed', 'disconnected']) {
    assert.match(css, new RegExp(`data-state=["']${state}["']`), state);
  }
  assert.match(css, /\.board-status::before/);
});

test('manifest rejects packages that would omit the font partition', () => {
  assert.throws(
    () => validateManifest({ ...manifest, segments: manifest.segments.slice(0, 1) }),
    /0x820000/i,
  );
});
