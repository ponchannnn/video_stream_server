const path = require('path');
const fs = require('fs');
const express = require('express');
const streamStatus = require('./streamStatus');

// 録画中ファイルとrecordingsディレクトリ全体の状況をJSONで返すAPI + フロントエンド配信
function createDashboardServer({ recordingsDir, httpFlvPort }) {
  const app = express();
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/status', async (req, res) => {
    const streams = streamStatus.getActiveStreams().map((s) => {
      let fileSizeBytes = 0;
      try {
        fileSizeBytes = fs.statSync(s.outputFile).size;
      } catch {
        // ffmpegがまだファイルを作成していない場合など
      }
      return {
        streamPath: s.streamPath,
        startTime: s.startTime,
        connected: s.connected,
        outputFile: path.basename(s.outputFile),
        fileSizeBytes
      };
    });

    const files = [];
    let totalSizeBytes = 0;
    try {
      for (const name of fs.readdirSync(recordingsDir)) {
        const full = path.join(recordingsDir, name);
        const stat = fs.statSync(full);
        if (!stat.isFile()) continue;
        totalSizeBytes += stat.size;
        files.push({ name, sizeBytes: stat.size, mtime: stat.mtime });
      }
      files.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    } catch {
      // recordingsディレクトリが未作成の場合など
    }

    let disk = null;
    try {
      const st = await fs.promises.statfs(recordingsDir);
      disk = { totalBytes: st.blocks * st.bsize, freeBytes: st.bavail * st.bsize };
    } catch {
      // statfs非対応の環境ではnullのまま
    }

    res.json({
      now: new Date(),
      httpFlvPort,
      streams,
      recordings: { totalSizeBytes, count: files.length, files: files.slice(0, 50) },
      disk
    });
  });

  return app;
}

module.exports = { createDashboardServer };
