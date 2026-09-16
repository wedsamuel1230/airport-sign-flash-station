export const ASSETS_FLASH_ADDRESS = 0x820000;

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export function validateManifest(manifest) {
  if (!manifest || manifest.schema !== 1) throw new Error('Unsupported firmware manifest.');
  if (manifest.target !== 'esp32s3') throw new Error('Firmware package is not for ESP32-S3.');
  if (!Array.isArray(manifest.segments) || manifest.segments.length !== 2) {
    throw new Error('Firmware package must contain images at 0x0 and 0x820000.');
  }

  const addresses = manifest.segments.map(({ address }) => address);
  if (addresses[0] !== 0 || addresses[1] !== ASSETS_FLASH_ADDRESS) {
    throw new Error('Firmware package must write images at 0x0 and 0x820000.');
  }

  for (const segment of manifest.segments) {
    if (!Number.isInteger(segment.address) || !Number.isInteger(segment.size) || segment.size <= 0) {
      throw new Error(`Invalid image metadata for ${segment.name || 'unnamed image'}.`);
    }
    if (typeof segment.path !== 'string' || !segment.path.startsWith('firmware/') || segment.path.includes('..')) {
      throw new Error(`Unsafe image path for ${segment.name || 'unnamed image'}.`);
    }
    if (!SHA256_PATTERN.test(segment.sha256 || '')) {
      throw new Error(`Missing SHA-256 for ${segment.name || 'unnamed image'}.`);
    }
  }

  return manifest;
}

export function overallWriteProgress(segments, fileIndex, written, total) {
  const packageSize = segments.reduce((sum, segment) => sum + segment.size, 0);
  if (!packageSize || fileIndex < 0 || fileIndex >= segments.length) return 0;
  const completed = segments.slice(0, fileIndex).reduce((sum, segment) => sum + segment.size, 0);
  const currentSize = segments[fileIndex].size;
  const currentWritten = total > 0 ? Math.min(currentSize, Math.max(0, written / total * currentSize)) : 0;
  return Math.min(100, Math.round((completed + currentWritten) / packageSize * 100));
}
