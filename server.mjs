import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { validate } from './dist/model.js';

const base = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(base, 'data', 'lastenheft.json');
const hash = value => createHash('sha256').update(value).digest('hex');
let queue = Promise.resolve();

function getWorkingFile(file) {
  const storageDir = process.env.STORAGE_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), 'arch-contracter') : null);
  if (file === dataFile && storageDir) {
    return path.join(storageDir, 'data', 'lastenheft.json');
  }
  return file;
}

export function createHandler(file = dataFile) {
  return async (req, res) => {
    const send = (status, value, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(type.startsWith('application/json') ? JSON.stringify(value) : value);
    };

    try {
      const host = req.headers.host || '';
      const allowRemote = Boolean(process.env.VERCEL || process.env.ALLOW_REMOTE);
      if (!allowRemote && !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
        return send(403, { error: 'Nur lokaler Zugriff erlaubt.' });
      }

      if (req.headers.origin) {
        const allowedOrigins = new Set([`http://${host}`, `https://${host}`]);
        if (res.socket?.localPort) {
          allowedOrigins.add(`http://127.0.0.1:${res.socket.localPort}`);
          allowedOrigins.add(`http://localhost:${res.socket.localPort}`);
        }
        if (!allowedOrigins.has(req.headers.origin)) {
          return send(403, { error: 'Fremder Ursprung ist nicht erlaubt.' });
        }
      }

      const rawUrl = req.headers['x-forwarded-url'] || req.headers['x-original-url'] || req.url;
      const parsedUrl = new URL(rawUrl, `http://${host}`);
      let pathname = parsedUrl.searchParams.get('path') || parsedUrl.pathname;
      if (pathname && !pathname.startsWith('/')) pathname = `/${pathname}`;
      if (pathname === '/server.mjs') pathname = '/';

      const workingFile = getWorkingFile(file);

      if (pathname === '/api/document' && (req.method === 'GET' || req.method === 'HEAD')) {
        let raw;
        try {
          raw = await readFile(workingFile, 'utf8');
        } catch (error) {
          if (error.code === 'ENOENT' && workingFile !== file) {
            await mkdir(path.dirname(workingFile), { recursive: true });
            raw = await readFile(file, 'utf8');
            await writeFile(workingFile, raw, 'utf8');
          } else {
            throw error;
          }
        }
        return send(200, { data: validate(JSON.parse(raw)), revision: hash(raw) });
      }

      if (pathname === '/api/document' && req.method === 'PUT') {
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON erforderlich.' });

        let input;
        if (req.body !== undefined) {
          input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } else {
          let body = '', length = 0;
          for await (const chunk of req) {
            length += chunk.length;
            if (length > 5_000_000) return send(413, { error: 'Datei ist zu groß (maximal 5 MB).' });
            body += chunk;
          }
          input = JSON.parse(body);
        }

        validate(input.data);

        const task = queue.then(async () => {
          let old;
          try {
            old = await readFile(workingFile, 'utf8');
          } catch (error) {
            if (error.code === 'ENOENT' && workingFile !== file) {
              await mkdir(path.dirname(workingFile), { recursive: true });
              old = await readFile(file, 'utf8');
              await writeFile(workingFile, old, 'utf8');
            } else {
              throw error;
            }
          }

          if (hash(old) !== input.revision) {
            return send(409, { error: 'Die JSON-Datei wurde außerhalb des Editors geändert. Lade den Dateistand neu oder sichere zuerst deinen Entwurf.' });
          }

          const raw = JSON.stringify(input.data, null, 2) + '\n';
          await mkdir(path.dirname(workingFile), { recursive: true });
          await writeFile(workingFile.replace(/\.json$/, '.backup.json'), old);
          const temp = `${workingFile}.${process.pid}.tmp`;
          await writeFile(temp, raw, 'utf8');

          // Detect an external edit that happened while the backup was being written.
          if (hash(await readFile(workingFile, 'utf8')) !== input.revision) {
            return send(409, { error: 'Externe Änderung erkannt. Bitte Dateistand neu laden.' });
          }

          await rename(temp, workingFile);
          send(200, { revision: hash(raw) });
        });
        queue = task.catch(() => {});
        await task;
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, { error: 'Methode nicht erlaubt.' });

      const files = {
        '/': 'index.html',
        '/index.html': 'index.html',
        '/dist/index.html': 'index.html',
        '/app.js': 'app.js',
        '/dist/app.js': 'app.js',
        '/model.js': 'model.js',
        '/dist/model.js': 'model.js',
        '/pagination.js': 'pagination.js',
        '/dist/pagination.js': 'pagination.js',
        '/styles.css': 'styles.css',
        '/dist/styles.css': 'styles.css',
        '/print.css': 'print.css',
        '/dist/print.css': 'print.css'
      };

      if (!files[pathname]) return send(404, { error: 'Nicht gefunden.' });
      const name = files[pathname], ext = path.extname(name);
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8'
      }[ext];
      return send(200, await readFile(path.join(base, 'dist', name)), mime);
    } catch (error) {
      send(error.code === 'ENOENT' ? 404 : 400, { error: error.message });
    }
  };
}

export function createServer(file = dataFile) {
  return http.createServer(createHandler(file));
}

const defaultHandler = createHandler();
defaultHandler.listen = (...args) => {
  const server = createServer();
  return server.listen(...args);
};

export default defaultHandler;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4317);
  const server = createServer();
  server.on('error', error => { console.error(`Start fehlgeschlagen: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Arch-Contracter läuft lokal: http://127.0.0.1:${port}\nDaten: ${dataFile}\nBeenden mit Strg+C.`));
}
