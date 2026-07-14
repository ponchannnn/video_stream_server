const POLL_INTERVAL_MS = 2000;

const connIndicatorEl = document.getElementById('conn-indicator');
const clockEl = document.getElementById('clock');
const streamInfoEl = document.getElementById('stream-info');
const previewVideoEl = document.getElementById('live-video');
const previewMessageEl = document.getElementById('preview-message');
const storageBarFillEl = document.getElementById('storage-bar-fill');
const storageUsedEl = document.getElementById('storage-used');
const storageFreeEl = document.getElementById('storage-free');
const storageCountEl = document.getElementById('storage-count');
const fileTableBodyEl = document.getElementById('file-table-body');

let flvPlayer = null;
let attachedStreamPath = null;

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function addInfoRow(container, label, value) {
  const row = document.createElement('div');
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  row.append(dt, dd);
  container.appendChild(row);
}

function setConnIndicator(isConnected) {
  connIndicatorEl.textContent = isConnected ? 'サーバー接続OK' : 'サーバーに接続できません';
  connIndicatorEl.className = `badge ${isConnected ? 'badge--ok' : 'badge--danger'}`;
}

function attachPreview(streamPath, httpFlvPort) {
  if (typeof flvjs === 'undefined' || !flvjs.isSupported()) return;
  if (attachedStreamPath === streamPath && flvPlayer) return;
  detachPreview();

  const url = `http://${location.hostname}:${httpFlvPort}${streamPath}.flv`;
  flvPlayer = flvjs.createPlayer({ type: 'flv', isLive: true, url });
  flvPlayer.attachMediaElement(previewVideoEl);
  flvPlayer.load();
  flvPlayer.play().catch(() => {});
  previewVideoEl.style.display = 'block';
  previewMessageEl.style.display = 'none';
  attachedStreamPath = streamPath;
}

function detachPreview() {
  if (flvPlayer) {
    try {
      flvPlayer.pause();
      flvPlayer.unload();
      flvPlayer.detachMediaElement();
      flvPlayer.destroy();
    } catch {
      // 破棄中の例外は無視
    }
    flvPlayer = null;
  }
  attachedStreamPath = null;
  previewVideoEl.style.display = 'none';
  previewMessageEl.style.display = 'block';
}

function renderStream(data) {
  streamInfoEl.innerHTML = '';
  const stream = data.streams[0];

  if (!stream) {
    previewMessageEl.textContent = '配信を待機中です...';
    detachPreview();
    addInfoRow(streamInfoEl, 'ステータス', '配信なし');
    return;
  }

  attachPreview(stream.streamPath, data.httpFlvPort);
  const elapsedMs = Date.now() - new Date(stream.startTime).getTime();

  addInfoRow(streamInfoEl, 'ステータス', stream.connected ? '配信中・録画中' : '配信切断・録画終了処理中');
  addInfoRow(streamInfoEl, 'ストリームパス', stream.streamPath);
  addInfoRow(streamInfoEl, '開始時刻', new Date(stream.startTime).toLocaleString('ja-JP'));
  addInfoRow(streamInfoEl, '経過時間', formatDuration(elapsedMs));
  addInfoRow(streamInfoEl, '録画ファイル', stream.outputFile);
  addInfoRow(streamInfoEl, '現在のファイルサイズ', formatBytes(stream.fileSizeBytes));
}

function renderStorage(data) {
  const rec = data.recordings;
  storageUsedEl.textContent = formatBytes(rec.totalSizeBytes);
  storageCountEl.textContent = `${rec.count} 件`;

  if (data.disk) {
    const usedRatio = 1 - data.disk.freeBytes / data.disk.totalBytes;
    const percent = Math.min(100, Math.max(0, usedRatio * 100));
    storageBarFillEl.style.width = `${percent.toFixed(1)}%`;
    storageBarFillEl.classList.toggle('storage__bar-fill--warn', usedRatio > 0.8 && usedRatio <= 0.92);
    storageBarFillEl.classList.toggle('storage__bar-fill--danger', usedRatio > 0.92);
    storageFreeEl.textContent = formatBytes(data.disk.freeBytes);
  } else {
    storageBarFillEl.style.width = '0%';
    storageFreeEl.textContent = '取得不可';
  }
}

function renderFileTable(data) {
  const files = data.recordings.files;
  if (files.length === 0) {
    fileTableBodyEl.innerHTML = '<tr><td colspan="3" class="file-table__empty">録画ファイルがありません</td></tr>';
    return;
  }
  fileTableBodyEl.innerHTML = files.map((f) => `
    <tr>
      <td>${escapeHtml(f.name)}</td>
      <td>${formatBytes(f.sizeBytes)}</td>
      <td>${new Date(f.mtime).toLocaleString('ja-JP')}</td>
    </tr>
  `).join('');
}

async function poll() {
  try {
    const res = await fetch('/api/status', { cache: 'no-store' });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    setConnIndicator(true);
    renderStream(data);
    renderStorage(data);
    renderFileTable(data);
  } catch (err) {
    setConnIndicator(false);
  }
}

setInterval(() => {
  clockEl.textContent = new Date().toLocaleString('ja-JP');
}, 1000);

setInterval(poll, POLL_INTERVAL_MS);
poll();
