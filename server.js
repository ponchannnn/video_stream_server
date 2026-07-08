const NodeMediaServer = require('node-media-server');
const { spawn } = require('child_process');
const path = require('path');

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  }
};

const nms = new NodeMediaServer(config);
nms.run();

nms.on('prePublish', (id, StreamPath, args) => {
  console.log(`[Stream Started] ID: ${id} Path: ${StreamPath}`);
  
  // ファイル名にタイムスタンプを付与
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(__dirname, 'recordings', `stream_${timestamp}.mkv`);

  // FFmpegを子プロセスとして起動し、MKVに書き出す
  const ffmpeg = spawn('ffmpeg', [
    '-y',
    '-i', `rtmp://127.0.0.1:1935${StreamPath}`,
    '-c', 'copy',
    outputFile
  ]);

  ffmpeg.on('close', (code) => {
     console.log(`[Stream Ended] 録画プロセス終了 (コード: ${code}): ${outputFile}`);
  });

  // エラー、詳細ログ
  // ffmpeg.stderr.on('data', (data) => { console.log(`FFmpeg: ${data}`); });
});