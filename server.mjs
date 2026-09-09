import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validate } from './dist/model.js';

const base = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(base, 'data', 'lastenheft.json');
const hash = value => createHash('sha256').update(value).digest('hex');
let queue = Promise.resolve();
export function createServer(file = dataFile) {
  return http.createServer(async (req, res) => {
    const send = (status, value, type = 'application/json; charset=utf-8') => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(type.startsWith('application/json') ? JSON.stringify(value) : value); };
    try {
      const host = req.headers.host || '';
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return send(403, { error: 'Nur lokaler Zugriff erlaubt.' });
      if (req.headers.origin && ![`http://${host}`, `http://127.0.0.1:${res.socket.localPort}`, `http://localhost:${res.socket.localPort}`].includes(req.headers.origin)) return send(403, { error: 'Fremder Ursprung ist nicht erlaubt.' });
      const pathname = new URL(req.url, `http://${host}`).pathname;
      if (pathname === '/api/document' && req.method === 'GET') {
        const raw = await readFile(file, 'utf8');
        return send(200, { data: validate(JSON.parse(raw)), revision: hash(raw) });
      }
      if (pathname === '/api/document' && req.method === 'PUT') {
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON erforderlich.' });
        let body = '', length = 0;
        for await (const chunk of req) { length += chunk.length; if (length > 5_000_000) return send(413, { error: 'Datei ist zu groß (maximal 5 MB).' }); body += chunk; }
        const input = JSON.parse(body); validate(input.data);
        const task = queue.then(async () => {
          const old = await readFile(file, 'utf8');
          if (hash(old) !== input.revision) return send(409, { error: 'Die JSON-Datei wurde außerhalb des Editors geändert. Lade den Dateistand neu oder sichere zuerst deinen Entwurf.' });
          const raw = JSON.stringify(input.data, null, 2) + '\n';
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file.replace(/\.json$/, '.backup.json'), old);
          const temp = `${file}.${process.pid}.tmp`;
          await writeFile(temp, raw, 'utf8');
          // Detect an external edit that happened while the backup was being written.
          if (hash(await readFile(file, 'utf8')) !== input.revision) return send(409, { error: 'Externe Änderung erkannt. Bitte Dateistand neu laden.' });
          await rename(temp, file);
          send(200, { revision: hash(raw) });
        });
        queue = task.catch(() => {}); await task; return;
      }
      if (req.method !== 'GET') return send(405, { error: 'Methode nicht erlaubt.' });
      const files = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/model.js': 'model.js', '/pagination.js': 'pagination.js', '/styles.css': 'styles.css', '/print.css': 'print.css' };
      if (!files[pathname]) return send(404, { error: 'Nicht gefunden.' });
      const name = files[pathname], ext = path.extname(name);
      const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }[ext];
      return send(200, await readFile(path.join(base, 'dist', name)), mime);
    } catch (error) { send(error.code === 'ENOENT' ? 404 : 400, { error: error.message }); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4317);
  const server = createServer();
  server.on('error', error => { console.error(`Start fehlgeschlagen: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Arch-Contracter läuft lokal: http://127.0.0.1:${port}\nDaten: ${dataFile}\nBeenden mit Strg+C.`));
}
