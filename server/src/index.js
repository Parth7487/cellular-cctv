import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createSignalingServer } from './signaling.js';
import { getIceServers } from './config.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../public');

const PORT = process.env.PORT || 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.apk': 'application/vnd.android.package-archive',
};

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() }));
    return;
  }

  if (url.pathname === '/api/ice-servers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ iceServers: getIceServers() }));
    return;
  }

  if (url.pathname === '/api/version') {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'cellular-cctv.onrender.com';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      versionCode: 1,
      versionName: '1.0.0',
      apkUrl: `${proto}://${host}/download/cctv-latest.apk`,
      releaseNotes: 'Automatic boot on phone restart, OTA update support'
    }));
    return;
  }


  // Serve static files from server/public
  let reqPath = decodeURIComponent(url.pathname);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.normalize(path.join(PUBLIC_DIR, reqPath));

  // Security check: ensure path does not escape PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (reqPath.startsWith('/download/')) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('APK not found on server');
        return;
      }
      // Fallback for single page app if file doesn't exist
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.stat(indexPath, (indexErr, indexStats) => {
        if (!indexErr && indexStats.isFile()) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
          fs.createReadStream(indexPath).pipe(res);
        } else {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Cellular Android CCTV Signaling & Relay Service is running.');
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

const { wss, rooms } = createSignalingServer(server, { getIceServers });

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[Signaling Server] Listening on port ${PORT}`);
    console.log(`[Signaling Server] Web Dashboard: http://localhost:${PORT}/`);
    console.log(`[Signaling Server] Health endpoint: http://localhost:${PORT}/api/health`);
    console.log(`[Signaling Server] ICE config endpoint: http://localhost:${PORT}/api/ice-servers`);
  });
}

export { server, wss, rooms };
