import { ESPLoader, Transport } from 'https://cdn.jsdelivr.net/npm/esptool-js@0.6.1/+esm';
import { overallWriteProgress, validateManifest } from './flasher-core.js';

const $ = (selector) => document.querySelector(selector);
const fileInput = $('#flashFile');
const flashButton = $('#serialFlash');
const choosePortButton = $('#choosePort');
const log = $('#flashLog');
const state = $('#deviceState');
const nextBoard = $('#nextBoard');
const eraseProgress = $('#eraseProgress');
const writeProgress = $('#writeProgress');

let manifest = null;
let localApplication = null;
let port = null;
let transport = null;
let loader = null;
let busy = false;

const setLog = (message) => { log.textContent = message; };
const setProgress = (bar, label, value) => {
  const rounded = Math.max(0, Math.min(100, Math.round(value)));
  bar.value = rounded;
  $(label).textContent = `${rounded}%`;
};
const sizeInMiB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

function showPackage() {
  if (!manifest) return;
  const packageSize = manifest.segments.reduce((sum, segment) => sum + segment.size, 0);
  $('#fileName').textContent = localApplication
    ? `${localApplication.name} + bundled Chinese font assets`
    : `${manifest.package} · complete package`;
  $('#fileMeta').textContent = localApplication
    ? `${sizeInMiB(localApplication.size)} application + bundled assets at 0x820000`
    : `${sizeInMiB(packageSize)} · application and font assets · integrity checked before flash`;
}

async function sha256Hex(data) {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function loadImages() {
  const images = [];
  for (const segment of manifest.segments) {
    let data;
    if (segment.address === 0 && localApplication) {
      data = new Uint8Array(await localApplication.arrayBuffer());
      if (data.byteLength >= manifest.segments[1].address) {
        throw new Error('The selected application image overlaps the font assets partition at 0x820000.');
      }
    } else {
      const response = await fetch(segment.path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load ${segment.path} (${response.status}).`);
      data = new Uint8Array(await response.arrayBuffer());
      if (data.byteLength !== segment.size) throw new Error(`${segment.name} has the wrong size.`);
      if (await sha256Hex(data) !== segment.sha256) throw new Error(`${segment.name} failed its SHA-256 check.`);
    }
    images.push({ ...segment, size: data.byteLength, data });
  }
  return images;
}

function makeLoader() {
  transport = new Transport(port, false);
  const terminal = {
    clean() {},
    write(value) { setLog(String(value).trim() || 'Working…'); },
    writeLine(value) { setLog(String(value).trim() || 'Working…'); },
  };
  loader = new ESPLoader({ transport, baudrate: 115200, terminal, debugLogging: false });
  return loader;
}

async function closeTransport({ forgetPort = false } = {}) {
  const activeTransport = transport;
  transport = null;
  loader = null;
  if (activeTransport) {
    try { await activeTransport.disconnect(); } catch {}
  } else if (port?.readable) {
    try { await port.close(); } catch {}
  }
  if (forgetPort) port = null;
}

async function requestPort() {
  if (!('serial' in navigator)) throw new Error('Web Serial is unavailable. Use current Chrome or Edge over HTTPS.');
  if (!port) {
    const grantedPorts = await navigator.serial.getPorts();
    const espressifPorts = grantedPorts.filter((candidate) => candidate.getInfo().usbVendorId === 0x303a);
    if (espressifPorts.length === 1) port = espressifPorts[0];
    else if (grantedPorts.length === 1) port = grantedPorts[0];
    else port = await navigator.serial.requestPort();
  }
  const info = port.getInfo();
  const usbId = info.usbVendorId
    ? `${info.usbVendorId.toString(16).padStart(4, '0')}:${(info.usbProductId || 0).toString(16).padStart(4, '0')}`
    : 'serial';
  state.textContent = `USB ${usbId} selected · ready`;
  choosePortButton.textContent = 'USB port selected';
}

async function connectLoader() {
  try {
    setLog('Connecting with the automatic ESP32-S3 reset sequence…');
    return await makeLoader().main();
  } catch (firstError) {
    await closeTransport();
    setLog('Automatic reset did not answer. Retrying a board already in download mode…');
    try {
      return await makeLoader().main('no_reset');
    } catch (secondError) {
      secondError.cause = firstError;
      throw secondError;
    }
  }
}

async function loadManifest() {
  try {
    const response = await fetch('firmware/manifest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`manifest request returned ${response.status}`);
    manifest = validateManifest(await response.json());
    showPackage();
    flashButton.disabled = false;
    setLog('Complete firmware package is ready. Connect one board to begin.');
  } catch (error) {
    state.textContent = 'Firmware package unavailable';
    setLog(`Cannot load the bundled firmware package: ${error.message || error}`);
  }
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  localApplication = file;
  showPackage();
  setLog('Local application selected. The bundled Chinese font assets will still be written.');
});

$('#chooseAnother').addEventListener('click', () => fileInput.click());

choosePortButton.addEventListener('click', async () => {
  if (busy) return;
  choosePortButton.disabled = true;
  nextBoard.hidden = true;
  try {
    await requestPort();
    setLog('Port selected. Click “Erase and flash complete package”.');
  } catch (error) {
    state.textContent = 'Waiting for a board';
    setLog(`USB selection failed: ${error.message || error}`);
  } finally {
    choosePortButton.disabled = false;
  }
});

flashButton.addEventListener('click', async () => {
  if (busy || !manifest) return;
  busy = true;
  flashButton.disabled = true;
  choosePortButton.disabled = true;
  nextBoard.hidden = true;
  eraseProgress.value = writeProgress.value = 0;
  $('#erasePercent').textContent = $('#writePercent').textContent = '—';

  try {
    if (!port) await requestPort();
    state.textContent = 'Checking firmware package';
    setLog('Loading and checking both firmware images…');
    const images = await loadImages();

    state.textContent = 'Connecting to ESP32-S3 bootloader';
    const chip = await connectLoader();
    state.textContent = `${chip} detected · erasing`;
    setLog('Erasing the entire 16 MB flash…');
    await loader.eraseFlash();
    setProgress(eraseProgress, '#erasePercent', 100);

    state.textContent = `${chip} detected · writing two images`;
    setLog('Erase complete. Writing boot/application and Chinese font assets…');
    await loader.writeFlash({
      fileArray: images.map(({ address, data }) => ({ address, data })),
      flashSize: manifest.flashSize,
      flashMode: manifest.flashMode,
      flashFreq: manifest.flashFreq,
      eraseAll: false,
      compress: true,
      reportProgress(fileIndex, written, total) {
        const percent = overallWriteProgress(images, fileIndex, written, total);
        setProgress(writeProgress, '#writePercent', percent);
        setLog(`Writing ${images[fileIndex].name}… ${percent}% overall`);
      },
    });
    setProgress(writeProgress, '#writePercent', 100);

    state.textContent = 'Images verified · resetting board';
    setLog('Both images were written and verified. Resetting into the application…');
    await loader.after('hard_reset');
    state.textContent = 'Flash complete · board reset';
    setLog('Flash complete. The application and Chinese font assets are installed.');
    nextBoard.hidden = false;
  } catch (error) {
    state.textContent = 'Flash failed · port released';
    const message = String(error?.message || error);
    setLog(`Flash failed: ${message}\n\nThe USB port was released. Re-enter download mode (hold BOOT, tap RESET, release BOOT) and retry.`);
  } finally {
    await closeTransport({ forgetPort: true });
    choosePortButton.textContent = 'Choose USB port';
    choosePortButton.disabled = false;
    flashButton.disabled = false;
    busy = false;
  }
});

$('#flashAgain').addEventListener('click', () => {
  nextBoard.hidden = true;
  state.textContent = 'Waiting for a board';
  eraseProgress.value = writeProgress.value = 0;
  $('#erasePercent').textContent = $('#writePercent').textContent = '—';
  setLog('Connect the next board, then choose its USB port.');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

navigator.serial?.addEventListener('disconnect', () => {
  if (!busy) {
    port = null;
    choosePortButton.textContent = 'Choose USB port';
    state.textContent = 'USB board disconnected';
  }
});

loadManifest();
