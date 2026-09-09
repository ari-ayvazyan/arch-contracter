import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import os from 'node:os';
import defaultHandler, { createServer, createHandler } from '../server.mjs';

function createMockReqRes({ method = 'GET', url = '/', headers = {}, body = undefined } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { host: 'test-app.vercel.app', ...headers };
  req.body = body;

  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.body = '';
  res.writeHead = (status, headers = {}) => {
    res.statusCode = status;
    Object.assign(res.headers, headers);
  };
  res.end = (chunk) => {
    if (chunk) res.body += chunk;
    res.emit('finish');
  };

  return { req, res };
}

test('Vercel Export: Standard-Export ist eine Funktion mit .listen-Methode', async () => {
  const entrypoint = await import('../server.mjs');
  const handler = entrypoint.default || entrypoint;

  // Genau die Bedingung, die @vercel/node prüft:
  assert.ok(
    typeof handler === 'function' || (handler && typeof handler.listen === 'function'),
    'The default export must be a function or server.'
  );
  assert.equal(typeof defaultHandler, 'function');
  assert.equal(typeof defaultHandler.listen, 'function');
});

test('Vercel Serverless: Direkte Ausführung als Funktion mit Vercel-Umgebung', async () => {
  const prevVercel = process.env.VERCEL;
  const prevStorage = process.env.STORAGE_DIR;
  const tempDir = await import('node:fs/promises').then(fs => fs.mkdtemp(path.join(os.tmpdir(), 'arch-vercel-test-')));
  process.env.VERCEL = '1';
  process.env.STORAGE_DIR = tempDir;

  try {
    // 1. GET / liefert index.html
    const rootCall = createMockReqRes({ method: 'GET', url: '/' });
    await defaultHandler(rootCall.req, rootCall.res);
    assert.equal(rootCall.res.statusCode, 200);
    assert.ok(rootCall.res.body.includes('Arch-Contracter'));

    // 2. GET /app.js liefert JavaScript
    const jsCall = createMockReqRes({ method: 'GET', url: '/app.js' });
    await defaultHandler(jsCall.req, jsCall.res);
    assert.equal(jsCall.res.statusCode, 200);
    assert.equal(jsCall.res.headers['Content-Type'], 'text/javascript; charset=utf-8');

    // 3. GET /api/document liefert Dokumentdaten
    const getDocCall = createMockReqRes({ method: 'GET', url: '/api/document' });
    await defaultHandler(getDocCall.req, getDocCall.res);
    assert.equal(getDocCall.res.statusCode, 200);
    const docData = JSON.parse(getDocCall.res.body);
    assert.ok(docData.data.document.title);
    assert.ok(docData.revision);

    // 4. PUT /api/document mit pre-parsed req.body (@vercel/node Verhalten)
    const updated = structuredClone(docData.data);
    updated.document.customer = `Vercel Deployment Kunde ${Date.now()}`;
    const putDocCall = createMockReqRes({
      method: 'PUT',
      url: '/api/document',
      headers: {
        'content-type': 'application/json',
        origin: 'https://test-app.vercel.app'
      },
      body: { data: updated, revision: docData.revision }
    });
    await defaultHandler(putDocCall.req, putDocCall.res);
    assert.equal(putDocCall.res.statusCode, 200);
    const putResult = JSON.parse(putDocCall.res.body);
    assert.ok(putResult.revision);
    assert.notEqual(putResult.revision, docData.revision);

    // 5. Fremder Ursprung (CSRF) wird auch auf Vercel abgewiesen
    const csrfCall = createMockReqRes({
      method: 'PUT',
      url: '/api/document',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil-site.example.com'
      },
      body: { data: updated, revision: putResult.revision }
    });
    await defaultHandler(csrfCall.req, csrfCall.res);
    assert.equal(csrfCall.res.statusCode, 403);

    // 6. Rewrite-Header x-forwarded-url wird korrekt aufgelöst
    const rewrittenCall = createMockReqRes({
      method: 'GET',
      url: '/server.mjs',
      headers: { 'x-forwarded-url': '/api/document' }
    });
    await defaultHandler(rewrittenCall.req, rewrittenCall.res);
    assert.equal(rewrittenCall.res.statusCode, 200);
    const rewrittenBody = JSON.parse(rewrittenCall.res.body);
    assert.ok(rewrittenBody.revision);

    // 7. Direkter Aufruf von /server.mjs fällt auf / zurück (index.html)
    const fallbackCall = createMockReqRes({ method: 'GET', url: '/server.mjs' });
    await defaultHandler(fallbackCall.req, fallbackCall.res);
    assert.equal(fallbackCall.res.statusCode, 200);
    assert.ok(fallbackCall.res.body.includes('Arch-Contracter'));
  } finally {
    if (prevVercel !== undefined) process.env.VERCEL = prevVercel;
    else delete process.env.VERCEL;
    if (prevStorage !== undefined) process.env.STORAGE_DIR = prevStorage;
    else delete process.env.STORAGE_DIR;
    await import('node:fs/promises').then(fs => fs.rm(tempDir, { recursive: true, force: true }));
  }
});

test('Vercel Config: vercel.json hat ein gültiges Schema und includeFiles ist ein String', async () => {
  const { readFile } = await import('node:fs/promises');
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

  assert.equal(typeof config.functions?.['server.mjs']?.includeFiles, 'string');
  assert.ok(config.functions['server.mjs'].includeFiles.length <= 256);
  assert.ok(Array.isArray(config.rewrites));
});

