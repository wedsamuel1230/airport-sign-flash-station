import { ESPLoader, Transport } from 'https://cdn.jsdelivr.net/npm/esptool-js@0.6.1/+esm';
import {
  DEFAULT_FLASH_CONCURRENCY,
  overallWriteProgress,
  runWithConcurrency,
  validateManifest,
} from './flasher-core.js?v=20260917-5';

const $ = (selector) => document.querySelector(selector);
const fileInput = $('#flashFile');
const flashButton = $('#serialFlash');
const resetButton = $('#resetSelected');
const choosePortButton = $('#choosePort');
const refreshPortsButton = $('#refreshPorts');
const boardList = $('#boardList');
const emptyState = $('#emptyState');
const log = $('#flashLog');
const packageState = $('#packageState');

let manifest = null;
let localApplication = null;
let packageImages = null;
let nextBoardId = 1;
let batchBusy = false;
const boards = [];
const logLines = [];

const sizeInMiB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function appendLog(message) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  logLines.push(`${time}  ${message}`);
  log.textContent = logLines.slice(-40).join('\n');
  log.scrollTop = log.scrollHeight;
}

function usbId(port) {
  const info = port.getInfo();
  if (!info.usbVendorId) return 'Serial device';
  const vendor = info.usbVendorId.toString(16).padStart(4, '0');
  const product = (info.usbProductId || 0).toString(16).padStart(4, '0');
  return `USB ${vendor}:${product}`;
}

function setPackageState(label, state) {
  packageState.textContent = label;
  packageState.dataset.state = state;
}

function selectedBoards() {
  return boards.filter((board) => board.selected && board.state !== 'disconnected');
}

function renderSummary() {
  $('#boardCount').textContent = String(boards.length);
  $('#selectedCount').textContent = String(selectedBoards().length);
  $('#completeCount').textContent = String(boards.filter(({ state }) => state === 'complete').length);
  $('#failedCount').textContent = String(boards.filter(({ state }) => ['failed', 'disconnected'].includes(state)).length);
  emptyState.hidden = boards.length > 0;

  const hasSelected = selectedBoards().length > 0;
  flashButton.disabled = batchBusy || !manifest || !packageImages || !hasSelected;
  resetButton.disabled = batchBusy || !hasSelected;
  choosePortButton.disabled = batchBusy || !('serial' in navigator);
  refreshPortsButton.disabled = batchBusy || !('serial' in navigator);
  $('#chooseAnother').disabled = batchBusy;

  for (const board of boards) {
    board.elements.checkbox.disabled = batchBusy || board.busy;
    board.elements.remove.disabled = batchBusy || board.busy;
  }
}

function setBoardState(board, state, status, detail, progress = board.progress) {
  board.state = state;
  board.progress = progress;
  board.elements.row.dataset.state = state;
  board.elements.status.textContent = status;
  board.elements.detail.textContent = detail;
  if (progress === null) {
    board.elements.progress.removeAttribute('value');
    board.elements.percent.textContent = 'Working';
  } else {
    const value = Math.max(0, Math.min(100, Math.round(progress)));
    board.elements.progress.value = value;
    board.elements.percent.textContent = `${value}%`;
  }
  renderSummary();
}

function removeBoard(board) {
  if (batchBusy || board.busy) return;
  const index = boards.indexOf(board);
  if (index >= 0) boards.splice(index, 1);
  board.elements.row.remove();
  appendLog(`${board.name} removed from the batch.`);
  renderSummary();
}

function createBoardRow(board) {
  const row = document.createElement('article');
  row.className = 'board-row';
  row.dataset.state = 'ready';
  row.innerHTML = `
    <label class="board-select" aria-label="Select ${board.name}">
      <input type="checkbox" checked>
    </label>
    <div class="board-identity">
      <strong></strong>
      <span></span>
    </div>
    <div class="board-progress">
      <progress max="100" value="0"></progress>
      <div class="board-progress-copy"><span class="board-detail"></span></div>
    </div>
    <div class="board-progress-copy">
      <span class="board-status">Ready</span>
      <span class="board-percent">0%</span>
    </div>
    <button class="remove-board" type="button">Remove</button>`;

  row.querySelector('.board-identity strong').textContent = board.name;
  row.querySelector('.board-identity span').textContent = usbId(board.port);
  const checkbox = row.querySelector('input');
  const remove = row.querySelector('.remove-board');
  board.elements = {
    row,
    checkbox,
    remove,
    progress: row.querySelector('progress'),
    detail: row.querySelector('.board-detail'),
    status: row.querySelector('.board-status'),
    percent: row.querySelector('.board-percent'),
  };

  checkbox.addEventListener('change', () => {
    board.selected = checkbox.checked;
    renderSummary();
  });
  remove.addEventListener('click', () => removeBoard(board));
  boardList.append(row);
  setBoardState(board, 'ready', 'Ready', 'Approved port, waiting for batch', 0);
}

function addPort(port) {
  const existing = boards.find((board) => board.port === port);
  if (existing) return existing;
  const board = {
    id: nextBoardId++,
    name: `Board ${nextBoardId - 1}`,
    port,
    state: 'ready',
    selected: true,
    progress: 0,
    busy: false,
    loader: null,
    transport: null,
    elements: null,
  };
  boards.push(board);
  createBoardRow(board);
  appendLog(`${board.name} added: ${usbId(port)}.`);
  renderSummary();
  return board;
}

async function sha256Hex(data) {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function loadImages() {
  if (packageImages) return packageImages;
  const images = [];
  for (const segment of manifest.segments) {
    let data;
    if (segment.address === 0 && localApplication) {
      data = new Uint8Array(await localApplication.arrayBuffer());
      if (data.byteLength >= manifest.segments[1].address) {
        throw new Error('The local application overlaps the font asset partition at 0x820000.');
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
  packageImages = images;
  return images;
}

function showPackage() {
  const packageSize = packageImages.reduce((sum, segment) => sum + segment.size, 0);
  $('#fileName').textContent = localApplication
    ? `${localApplication.name} with bundled regional font assets`
    : `${manifest.package} complete package`;
  $('#fileMeta').textContent = localApplication
    ? `${sizeInMiB(localApplication.size)} local app plus checked assets at 0x820000`
    : `${sizeInMiB(packageSize)} across two checked images`;
}

async function loadManifest() {
  try {
    setPackageState('Checking', 'loading');
    const response = await fetch('firmware/manifest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`manifest request returned ${response.status}`);
    manifest = validateManifest(await response.json());
    await loadImages();
    showPackage();
    setPackageState('Ready', 'ready');
    appendLog('Firmware package passed size and SHA-256 checks.');
  } catch (error) {
    setPackageState('Unavailable', 'error');
    $('#fileName').textContent = 'Firmware package unavailable';
    $('#fileMeta').textContent = String(error?.message || error);
    appendLog(`Package error: ${error?.message || error}`);
  } finally {
    renderSummary();
  }
}

async function discoverGrantedPorts({ quiet = false } = {}) {
  if (!('serial' in navigator)) {
    if (!quiet) appendLog('Web Serial is unavailable. Use current Chrome or Edge over HTTPS.');
    return;
  }
  try {
    const ports = await navigator.serial.getPorts();
    const espPorts = ports.filter((port) => port.getInfo().usbVendorId === 0x303a);
    espPorts.forEach(addPort);
    if (!quiet) appendLog(espPorts.length ? `${espPorts.length} approved ESP32 port(s) found.` : 'No approved ESP32 ports found. Add each board once.');
  } catch (error) {
    appendLog(`Port discovery failed: ${error?.message || error}`);
  }
}

function makeLoader(board) {
  board.transport = new Transport(board.port, false);
  const terminal = {
    clean() {},
    write(value) {
      const message = String(value).trim();
      if (message) board.elements.detail.textContent = message;
    },
    writeLine(value) {
      const message = String(value).trim();
      if (message) board.elements.detail.textContent = message;
    },
  };
  board.loader = new ESPLoader({ transport: board.transport, baudrate: 115200, terminal, debugLogging: false });
  return board.loader;
}

async function closeBoard(board) {
  const activeTransport = board.transport;
  board.transport = null;
  board.loader = null;
  if (activeTransport) {
    try { await activeTransport.disconnect(); } catch {}
  } else if (board.port?.readable) {
    try { await board.port.close(); } catch {}
  }
}

async function connectLoader(board) {
  try {
    setBoardState(board, 'connecting', 'Connecting', 'Sending automatic ESP32-S3 reset', null);
    return await makeLoader(board).main();
  } catch (firstError) {
    await closeBoard(board);
    setBoardState(board, 'connecting', 'Retrying', 'Trying a board already in download mode', null);
    try {
      return await makeLoader(board).main('no_reset');
    } catch (secondError) {
      secondError.cause = firstError;
      throw secondError;
    }
  }
}

async function flashBoard(board, images) {
  board.busy = true;
  renderSummary();
  try {
    const chip = await connectLoader(board);
    appendLog(`${board.name}: ${chip} connected.`);

    setBoardState(board, 'erasing', 'Erasing', 'Full 16 MB flash erase', null);
    await board.loader.eraseFlash();

    setBoardState(board, 'writing', 'Writing', 'Application and regional font assets', 0);
    await board.loader.writeFlash({
      fileArray: images.map(({ address, data }) => ({ address, data: new Uint8Array(data) })),
      flashSize: manifest.flashSize,
      flashMode: manifest.flashMode,
      flashFreq: manifest.flashFreq,
      eraseAll: false,
      compress: true,
      reportProgress(fileIndex, written, total) {
        const percent = overallWriteProgress(images, fileIndex, written, total);
        setBoardState(board, 'writing', 'Writing', `${images[fileIndex].name} at ${percent}% overall`, percent);
      },
    });

    setBoardState(board, 'resetting', 'Resetting', 'Verified images, sending hard reset', 100);
    await board.loader.after('hard_reset', true);
    await sleep(400);
    setBoardState(board, 'complete', 'Complete', 'Reset sent, wait for the first display frame', 100);
    appendLog(`${board.name}: verified and reset into the application.`);
  } catch (error) {
    const message = String(error?.message || error);
    setBoardState(board, 'failed', 'Needs attention', message, board.progress ?? 0);
    appendLog(`${board.name}: failed. ${message}`);
    throw error;
  } finally {
    await closeBoard(board);
    board.busy = false;
    renderSummary();
  }
}

async function resetBoard(board) {
  board.busy = true;
  renderSummary();
  try {
    const chip = await connectLoader(board);
    setBoardState(board, 'resetting', 'Resetting', `${chip} detected, sending hard reset`, null);
    await board.loader.after('hard_reset', true);
    await sleep(400);
    setBoardState(board, 'complete', 'Reset sent', 'Application boot requested, wait for the first display frame', 100);
    appendLog(`${board.name}: reset signal sent.`);
  } catch (error) {
    const message = String(error?.message || error);
    setBoardState(board, 'failed', 'Reset failed', message, board.progress ?? 0);
    appendLog(`${board.name}: reset failed. ${message}`);
    throw error;
  } finally {
    await closeBoard(board);
    board.busy = false;
    renderSummary();
  }
}

async function runBatch(action, worker) {
  const targets = selectedBoards();
  if (batchBusy || targets.length === 0) return;
  batchBusy = true;
  for (const board of targets) setBoardState(board, 'queued', 'Queued', `Waiting to ${action}`, 0);
  renderSummary();

  const results = await runWithConcurrency(targets, DEFAULT_FLASH_CONCURRENCY, worker);
  const failures = results.filter(({ status }) => status === 'rejected').length;
  appendLog(failures ? `${action} batch finished with ${failures} board(s) needing attention.` : `${action} batch finished for ${targets.length} board(s).`);
  batchBusy = false;
  renderSummary();
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file || batchBusy) return;
  localApplication = file;
  packageImages = null;
  setPackageState('Checking', 'loading');
  try {
    await loadImages();
    showPackage();
    setPackageState('Ready', 'ready');
    appendLog('Local application selected. Bundled font assets remain enabled.');
  } catch (error) {
    setPackageState('Invalid', 'error');
    appendLog(`Local image rejected: ${error?.message || error}`);
  }
  renderSummary();
});

$('#chooseAnother').addEventListener('click', () => fileInput.click());

choosePortButton.addEventListener('click', async () => {
  if (batchBusy) return;
  try {
    const port = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x303a }] });
    addPort(port);
  } catch (error) {
    if (error?.name !== 'NotFoundError') appendLog(`USB selection failed: ${error?.message || error}`);
  }
});

refreshPortsButton.addEventListener('click', () => discoverGrantedPorts());

flashButton.addEventListener('click', async () => {
  if (!packageImages) return;
  const images = await loadImages();
  await runBatch('flash', (board) => flashBoard(board, images));
});

resetButton.addEventListener('click', () => runBatch('reset', resetBoard));

navigator.serial?.addEventListener('connect', () => discoverGrantedPorts({ quiet: true }));
navigator.serial?.addEventListener('disconnect', (event) => {
  const port = event.port || event.target;
  const board = boards.find((candidate) => candidate.port === port);
  if (board && !board.busy) {
    board.selected = false;
    board.elements.checkbox.checked = false;
    setBoardState(board, 'disconnected', 'Disconnected', 'Reconnect USB, then find approved boards', board.progress);
  }
});

if (location.protocol === 'file:') $('#originNotice').hidden = false;
if (!('serial' in navigator)) appendLog('Web Serial is unavailable. Use current Chrome or Edge over HTTPS.');

renderSummary();
loadManifest().then(() => discoverGrantedPorts({ quiet: true }));
