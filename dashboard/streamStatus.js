// 配信中/録画中のストリーム状態を保持する小さなインメモリストア。
// server.js (NMSのイベント) と dashboard/server.js (状態API) の橋渡し役。

const activeStreams = new Map();

function streamStarted(streamPath, { id, outputFile, startTime = new Date() }) {
  activeStreams.set(streamPath, { id, streamPath, startTime, outputFile, connected: true });
}

function streamDisconnected(streamPath) {
  const stream = activeStreams.get(streamPath);
  if (stream) stream.connected = false;
}

function streamEnded(streamPath) {
  activeStreams.delete(streamPath);
}

function getActiveStreams() {
  return [...activeStreams.values()];
}

module.exports = { streamStarted, streamDisconnected, streamEnded, getActiveStreams };
