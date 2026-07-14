const NodeMediaServer = require('node-media-server');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const streamStatus = require('./dashboard/streamStatus');
const { createDashboardServer } = require('./dashboard/server');

const RECORDINGS_DIR = path.join(__dirname, 'recordings');
const MEDIA_ROOT = path.join(__dirname, 'media');
const HTTP_FLV_PORT = 8000;
const DASHBOARD_PORT = 8888;

fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    // ダッシュボードのライブプレビュー(flv.js)向けにHTTP-FLV配信を有効化
    port: HTTP_FLV_PORT,
    mediaroot: MEDIA_ROOT,
    allow_origin: '*'
  }
};

const nms = new NodeMediaServer(config);
nms.run();

nms.on('prePublish', (id, StreamPath, args) => {
  console.log(`[Stream Started] ID: ${id} Path: ${StreamPath}`);

  // ファイル名にタイムスタンプを付与
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(RECORDINGS_DIR, `stream_${timestamp}.mkv`);

  // FFmpegを子プロセスとして起動し、MKVに書き出す
  const ffmpeg = spawn('ffmpeg', [
    '-y',
    '-i', `rtmp://127.0.0.1:1935${StreamPath}`,
    '-c', 'copy',
    outputFile
  ]);

  streamStatus.streamStarted(StreamPath, { id, outputFile, startTime: now });

  ffmpeg.on('close', (code) => {
     console.log(`[Stream Ended] 録画プロセス終了 (コード: ${code}): ${outputFile}`);
     streamStatus.streamEnded(StreamPath);
  });

  // エラー、詳細ログ
  // ffmpeg.stderr.on('data', (data) => { console.log(`FFmpeg: ${data}`); });
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log(`[Client Disconnected] ID: ${id} Path: ${StreamPath}`);
  // 配信元との接続は切れたが、ffmpegがファイルを閉じるまでは録画継続中として扱う
  streamStatus.streamDisconnected(StreamPath);
});

createDashboardServer({ recordingsDir: RECORDINGS_DIR, httpFlvPort: HTTP_FLV_PORT })
  .listen(DASHBOARD_PORT, () => {
    console.log(`[Dashboard] http://0.0.0.0:${DASHBOARD_PORT}`);
  });